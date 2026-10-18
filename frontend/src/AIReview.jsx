import { useState } from "react";
import "./AIReview.css";

const API = "http://127.0.0.1:8000";

export default function AIReview() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
const [reviewed, setReviewed] = useState("");

const [hazardType, setHazardType] = useState("pothole");
const [severity, setSeverity] = useState("medium");
const [latitude, setLatitude] = useState("");
const [longitude, setLongitude] = useState("");
const [locationConfirmed, setLocationConfirmed] = useState(false);

  function handleFileChange(event) {
    const selected = event.target.files?.[0];

    if (!selected) return;

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setResult(null);
    setError("");
    setReviewed("");
  }

  async function analyzeImage() {
    if (!file) {
      setError("Please select a road image first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);
    setReviewed("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Image analysis failed.");
      }

      setResult(data);
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to the backend. Check that FastAPI is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="ai-review-page">
      <header className="ai-review-header">
        <div>
          <p className="ai-review-eyebrow">ROADWATCH AI · INTELLIGENCE</p>
          <h1>AI Hazard Review</h1>
          <p>Upload a road image and inspect the model's predictions.</p>
        </div>
        <span className="ai-review-status">● REVIEW MODE</span>
      </header>

      <section className="ai-review-layout">
        <div className="ai-review-panel">
          <h2>01 / Upload image</h2>
          <p className="ai-review-muted">
            Select a JPG, PNG, or WEBP image of a road.
          </p>

          <label className="ai-review-upload">
            <span className="ai-review-upload-icon">＋</span>
            <strong>{file ? file.name : "Choose a road image"}</strong>
            <span>Click here to select a file</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
            />
          </label>

          {preview && (
            <img
              className="ai-review-preview"
              src={preview}
              alt="Selected road for AI analysis"
            />
          )}

          <button
            className="ai-review-analyze"
            onClick={analyzeImage}
            disabled={!file || loading}
          >
            {loading ? "Analyzing image..." : "Analyze road image →"}
          </button>

          {error && <p className="ai-review-error">{error}</p>}
        </div>

        <div className="ai-review-panel">
          <h2>02 / Detection results</h2>
          <p className="ai-review-muted">
            Predictions from your connected AI models appear here.
          </p>

          {!result && !loading && (
            <div className="ai-review-empty">
              <span>⌕</span>
              <strong>Awaiting image analysis</strong>
              <p>Upload an image and run the analysis to see results.</p>
            </div>
          )}

          {loading && (
            <div className="ai-review-empty">
              <strong>AI analysis in progress...</strong>
              <p>Your image is being checked by the connected models.</p>
            </div>
          )}

          {result && (
            <>
              <div className="ai-review-summary">
                <span>DETECTIONS FOUND</span>
                <strong>{result.detections?.length ?? 0}</strong>
              </div>

              {result.detections?.length > 0 ? (
                <div className="ai-review-detections">
                  {result.detections.map((detection, index) => (
                    <article
                      className="ai-review-detection"
                      key={`${detection.model}-${detection.category}-${index}`}
                    >
                      <div>
                        <strong>{detection.category.replaceAll("_", " ")}</strong>
                        <p>{detection.model.replaceAll("_", " ")} model</p>
                      </div>
                      <span>
                        {Math.round(detection.confidence * 100)}%
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ai-review-empty">
                  <strong>No detections returned</strong>
                  <p>
                    This does not guarantee the road is hazard-free. Review the
                    image yourself.
                  </p>
                </div>
              )}

              <div className="ai-review-warning">
                <strong>Human verification required</strong>
                <p>
                  AI predictions can be wrong. Check the image before making a
                  decision.
                </p>
              </div>

              <div className="ai-review-verification">
  <h3>03 / Verify hazard details</h3>
  <p className="ai-review-muted">
    Confirm the hazard and its location before approving.
  </p>

  <label className="ai-review-field">
    Hazard type
    <select
      value={hazardType}
      onChange={(e) => {
        setHazardType(e.target.value);
        setLocationConfirmed(false);
      }}
    >
      <option value="pothole">Pothole</option>
      <option value="road_crack">Road cracks</option>
      <option value="waterlogging">Flooding / Waterlogging</option>
      <option value="road_debris">Road debris</option>
      <option value="damaged_road_sign">Damaged road sign</option>
      <option value="other">Other hazard</option>
    </select>
  </label>

  <label className="ai-review-field">
    Severity
    <select
      value={severity}
      onChange={(e) => setSeverity(e.target.value)}
    >
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
      <option value="critical">Critical</option>
    </select>
  </label>

  <div className="ai-review-coordinate-grid">
    <label className="ai-review-field">
      Latitude
      <input
        type="number"
        step="any"
        min="-90"
        max="90"
        placeholder="e.g. 13.0827"
        value={latitude}
        onChange={(e) => {
          setLatitude(e.target.value);
          setLocationConfirmed(false);
        }}
      />
    </label>

    <label className="ai-review-field">
      Longitude
      <input
        type="number"
        step="any"
        min="-180"
        max="180"
        placeholder="e.g. 80.2707"
        value={longitude}
        onChange={(e) => {
          setLongitude(e.target.value);
          setLocationConfirmed(false);
        }}
      />
    </label>
  </div>

  <label className="ai-review-location-check">
    <input
      type="checkbox"
      checked={locationConfirmed}
      onChange={(e) => setLocationConfirmed(e.target.checked)}
    />
    I have verified that these coordinates match the hazard.
  </label>

  <p className="ai-review-muted">
    Coordinates must be checked against the actual hazard location.
    Example coordinates are not automatically verified.
  </p>
</div>

              <p className="ai-review-muted ai-review-file">
                Upload reference: {result.filename}
              </p>

              <div className="ai-review-actions">
                <button
  className="ai-review-approve"
  onClick={async () => {
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!hazardType || !severity) {
      setError("Please confirm the hazard type and severity.");
      return;
    }

    if (
      latitude.trim() === "" ||
      longitude.trim() === "" ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setError("Enter valid latitude and longitude coordinates.");
      return;
    }

    if (!locationConfirmed) {
      setError("Please confirm that the hazard location is verified.");
      return;
    }

    setError("");

    try {
      const response = await fetch(
        `${API}/hazards/review/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hazard_type: hazardType,
            latitude: lat,
            longitude: lon,
            severity,
            description: `${hazardType.replaceAll("_", " ")} — ${severity} severity`,
            photo_url: null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Could not save the approved hazard."
        );
      }

      setReviewed("approved");
      alert(`Hazard saved successfully! ID: ${data.hazard_id}`);
    } catch (err) {
      setError(err.message || "Failed to save the hazard.");
    }
  }}
  disabled={Boolean(reviewed)}
>
  Approve
</button>
                <button
                  className="ai-review-reject"
                  onClick={() => setReviewed("rejected")}
                  disabled={Boolean(reviewed)}
                >
                  Reject
                </button>
              </div>

              {reviewed && (
                <p className="ai-review-review-note">
                  Marked {reviewed} in this page only. This decision has not
                  been saved to the database.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}