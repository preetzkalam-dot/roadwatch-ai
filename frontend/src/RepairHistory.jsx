import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./ReportDetails.css";
const API = "https://roadwatch-ai-ys0v.onrender.com";

export default function RepairHistory() {
  const { locationId } = useParams();
  const searchParams = new URLSearchParams(window.location.search);
const hazardType = searchParams.get("hazard_type");

  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("reported");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadUpdates() {
      try {
        const response = await fetch(
          `${API}/location-updates/${encodeURIComponent(locationId)}`
        );

        if (!response.ok) {
  const errorText = await response.text();
  throw new Error(
    `Repair history error (${response.status}): ${errorText}`
  );
}

        setUpdates(await response.json());
      } catch (err) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    loadUpdates();
  }, [locationId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(`${API}/location-updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
  location_id: Number(locationId),
  hazard_type: hazardType,
  status,
  description,
}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Could not save the repair update.");
      }

      setMessage("Repair update saved successfully!");
      setDescription("");

      const historyResponse = await fetch(
        `${API}/location-updates/${encodeURIComponent(locationId)}`
      );

      if (historyResponse.ok) {
        setUpdates(await historyResponse.json());
      }
    } catch (err) {
      setMessage(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="report-page">
      <Link to="/" className="back-link">
        ← Back to map
      </Link>

      <header className="report-header">
        <p>ROADWATCH  · LOCATION HISTORY</p>
        <h1>Repair History</h1>
        <p>Permanent Location ID: {locationId}</p>
      </header>

      <section className="report-details-card">
        <h2>Add a repair update</h2>

        <form onSubmit={handleSubmit}>
          <label>
            Repair status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="reported">Reported</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>

          <label>
            Description
            <textarea
              rows="3"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the repair work or current condition..."
              required
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save repair update"}
          </button>

          {message && <p role="status">{message}</p>}
        </form>
      </section>

      {loading && <p>Loading repair history...</p>}
      {error && <p>{error}</p>}

      {!loading && !error && updates.length === 0 && (
        <section className="report-details-card">
          <h2>No updates yet</h2>
          <p>No repair updates have been recorded for this location.</p>
        </section>
      )}

      {!loading && !error && updates.length > 0 && (
        <section className="report-details-card">
          <h2>
            {updates.length} update{updates.length !== 1 ? "s" : ""}
          </h2>

          {updates.map((update) => (
            <article key={update.id} className="repair-update">
              <div className="report-detail-row">
                <span>Status</span>
                <strong>{update.status.replaceAll("_", " ")}</strong>
              </div>

              <p>{update.description}</p>

              <small>
                {update.created_at
                  ? new Date(update.created_at).toLocaleString()
                  : "Date unavailable"}
              </small>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}