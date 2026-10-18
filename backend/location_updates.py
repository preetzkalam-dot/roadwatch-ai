from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func

from database import Base


class LocationUpdate(Base):
    __tablename__ = "location_updates"

    id = Column(Integer, primary_key=True, index=True)

    location_key = Column(String(100), nullable=False, index=True)
    hazard_type = Column(String(50), nullable=True, index=True)

    hazard_id = Column(
        Integer,
        ForeignKey("hazards.id"),
        nullable=True,
        index=True,
    )

    status = Column(String(30), nullable=False, default="reported")
    description = Column(Text, nullable=False)

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )