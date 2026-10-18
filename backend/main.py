import os
import uuid
import shutil
from pathlib import Path
from fastapi import UploadFile, File, HTTPException
from database import Base, SessionLocal, engine
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from models import Hazard, Location
from location_updates import LocationUpdate
from sqlalchemy import text
import math
from ultralytics import YOLO
from pydantic import BaseModel, Field
from typing import Literal

# Load RoadWatch AI detection models once
BASE_DIR = Path(__file__).resolve().parent

DEBRIS_MODEL = YOLO(
    str(BASE_DIR / "models" / "debris" / "Vision Classification.pt")
)

WATERLOGGING_MODEL = YOLO(
    str(BASE_DIR / "models" / "waterlogging" / "weights" / "best.pt")
)


def calculate_distance_meters(lat1, lon1, lat2, lon2):

    earth_radius = 6371000

    lat1 = math.radians(lat1)
    lat2 = math.radians(lat2)
    lat_difference = math.radians(lat2 - lat1)
    lon_difference = math.radians(lon2 - lon1)

    a = (
        math.sin(lat_difference / 2) ** 2
        + math.cos(lat1)
        * math.cos(lat2)
        * math.sin(lon_difference / 2) ** 2
    )

    return earth_radius * 2 * math.atan2(
        math.sqrt(a),
        math.sqrt(1 - a)
    )

def find_or_create_location(db, latitude, longitude):
    locations = db.query(Location).all()

    for location in locations:
        distance = calculate_distance_meters(
            latitude,
            longitude,
            location.latitude,
            location.longitude
        )

        if distance <= 10:
            return location

    new_location = Location(
        latitude=latitude,
        longitude=longitude
    )

    db.add(new_location)
    db.flush()

    return new_location

app = FastAPI(title="RoadWatch  API")
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


Base.metadata.create_all(bind=engine)
with engine.begin() as connection:
    connection.execute(
        text("ALTER TABLE hazards ADD COLUMN IF NOT EXISTS photo_url VARCHAR(255)")
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
def root():
    return {
        "message": "RoadWatch  backend is running!"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }


@app.post("/hazards")
def create_hazard(
    hazard_type: str,
    latitude: float,
    longitude: float,
    severity: str = "low",
    description: str = None,
    photo_url: str = None,
    db: Session = Depends(get_db)
):
    location = find_or_create_location(db, latitude, longitude)

    hazard = Hazard(
        location_id=location.id,
        hazard_type=hazard_type,
        latitude=latitude,
        longitude=longitude,
        severity=severity,
        description=description,
        photo_url=photo_url
    )

    db.add(hazard)
    db.commit()
    db.refresh(hazard)

    return {
        "message": "Hazard reported successfully",
        "hazard_id": hazard.id,
        "location_id": location.id
    }



class HazardReviewRequest(BaseModel):
    hazard_type: Literal[
        "pothole",
        "road_crack",
        "waterlogging",
        "road_debris",
        "damaged_road_sign",
        "other",
    ]
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    severity: Literal["low", "medium", "high", "critical"]
    description: str | None = None
    photo_url: str | None = None


@app.post("/hazards/review/approve")
def approve_reviewed_hazard(
    review: HazardReviewRequest,
    db: Session = Depends(get_db),
):
    location = find_or_create_location(
        db,
        review.latitude,
        review.longitude,
    )

    hazard = Hazard(
        location_id=location.id,
        hazard_type=review.hazard_type,
        latitude=review.latitude,
        longitude=review.longitude,
        severity=review.severity,
        description=review.description or "Human-verified AI detection",
        photo_url=review.photo_url,
    )

    db.add(hazard)
    db.commit()
    db.refresh(hazard)

    return {
        "message": "Human-approved hazard saved successfully",
        "hazard_id": hazard.id,
        "location_id": location.id,
        "hazard_type": hazard.hazard_type,
        "severity": hazard.severity,
        "latitude": hazard.latitude,
        "longitude": hazard.longitude,
    }


@app.get("/hazards")
def get_hazards(db: Session = Depends(get_db)):
    return (
        db.query(Hazard)
        .order_by(Hazard.created_at.desc())
        .all()
    )


@app.get("/hazards/active")
def get_active_hazards(db: Session = Depends(get_db)):
    hazards = (
        db.query(Hazard)
        .order_by(Hazard.created_at.desc())
        .all()
    )

    active_hazards = []

    for hazard in hazards:
        if hazard.location_id is None:
            active_hazards.append(hazard)
            continue

        latest_update = (
            db.query(LocationUpdate)
            .filter(
                LocationUpdate.location_key == str(hazard.location_id)
            )
            .order_by(
                LocationUpdate.created_at.desc(),
                LocationUpdate.id.desc(),
            )
            .first()
        )

        if latest_update and latest_update.status == "resolved":
            continue

        active_hazards.append(hazard)

    return active_hazards

class LocationUpdateRequest(BaseModel):
    location_id: int
    status: str
    description: str
@app.post("/location-updates")
def create_location_update(
    update: LocationUpdateRequest,
    db: Session = Depends(get_db),
):
    allowed_statuses = {"reported", "in_progress", "resolved"}

    if update.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Status must be reported, in_progress, or resolved.",
        )

    if not update.description.strip():
        raise HTTPException(
            status_code=400,
            detail="Description is required.",
        )

    location = db.query(Location).filter(
        Location.id == update.location_id
    ).first()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found.",
        )

    new_update = LocationUpdate(
        location_key=str(update.location_id),
        status=update.status,
        description=update.description.strip(),
    )

    db.add(new_update)
    db.commit()
    db.refresh(new_update)

    return {
        "message": "Location update saved successfully",
        "id": new_update.id,
        "location_id": update.location_id,
        "status": new_update.status,
        "description": new_update.description,
        "created_at": new_update.created_at,
    }


@app.get("/location-updates/{location_id}")
def get_location_updates(
    location_id: int,
    db: Session = Depends(get_db),
):
    location = db.query(Location).filter(
        Location.id == location_id
    ).first()

    if not location:
        raise HTTPException(
            status_code=404,
            detail="Location not found.",
        )

    updates = (
        db.query(LocationUpdate)
        .filter(LocationUpdate.location_key == str(location_id))
        .order_by(LocationUpdate.created_at.desc())
        .all()
    )

    return [
        {
            "id": update.id,
            "location_id": location_id,
            "status": update.status,
            "description": update.description,
            "created_at": update.created_at,
        }
        for update in updates
    ]

@app.post("/upload-photo")
def upload_photo(photo: UploadFile = File(...)):
    allowed_types = {"image/jpeg", "image/png", "image/webp"}

    if photo.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, PNG, or WebP image."
        )

    filename = f"{uuid.uuid4().hex}{Path(photo.filename or 'photo.jpg').suffix.lower()}"

    if Path(filename).suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=400, detail="Unsupported file extension.")

    destination = UPLOAD_DIR / filename

    try:
        with destination.open("wb") as buffer:
            shutil.copyfileobj(photo.file, buffer)
    finally:
        photo.file.close()

    return {"photo_url": f"/uploads/{filename}"}

@app.delete("/hazards/{hazard_id}")
def delete_hazard(
    hazard_id: int,
    db: Session = Depends(get_db)
):
    hazard = db.query(Hazard).filter(Hazard.id == hazard_id).first()

    if hazard is None:
        raise HTTPException(
            status_code=404,
            detail="Hazard report not found"
        )

    db.delete(hazard)
    db.commit()

    return {
        "message": "Hazard deleted successfully",
        "hazard_id": hazard_id
    }
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.post("/upload")
@app.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    allowed_types = {"image/jpeg", "image/png", "image/webp"}

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Please upload a JPG, PNG, or WEBP image.",
        )

    extension = Path(file.filename or "").suffix.lower()

    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image extension.",
        )

    filename = f"{uuid.uuid4().hex}{extension}"
    file_path = UPLOAD_DIR / filename

    try:
        contents = await file.read()

        if not contents:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image is empty.",
            )

        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Image must be 10 MB or smaller.",
            )

        with file_path.open("wb") as buffer:
            buffer.write(contents)

        detections = []

        models = [
            ("road_damage", DEBRIS_MODEL),
            ("waterlogging", WATERLOGGING_MODEL),
        ]

        for model_name, model in models:
            results = model.predict(
                source=str(file_path),
                conf=0.25,
                verbose=False,
            )

            for result in results:
                for box in result.boxes:
                    class_id = int(box.cls[0].item())
                    confidence = float(box.conf[0].item())
                    label = result.names[class_id]

                    detections.append({
                        "category": label,
                        "confidence": round(confidence, 4),
                        "model": model_name,
                        "review_required": True,
                    })

        return {
            "message": "Image uploaded and analyzed successfully",
            "filename": filename,
            "detections": detections,
            "human_review_required": True,
            "unsupported_categories": [
                "damaged_road_sign",
                "other_hazards",
            ],
        }

    except HTTPException:
        raise
    except Exception as exc:
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=500,
            detail=f"Image detection failed: {str(exc)}",
        )
    finally:
        await file.close()