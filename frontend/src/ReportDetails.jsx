import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "./ReportDetails.css";

const API = "http://127.0.0.1:8000";

export default function ReportDetails() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
const [status, setStatus] = useState("reported");
const [description, setDescription] = useState("");
const [saving, setSaving] = useState(false);
const [message, setMessage] = useState("");


  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await fetch(`${API}/hazards`);

        if (!response.ok) {
          throw new Error("Could not load reports.");
        }

        const hazards = await response.json();
        const selected = hazards.find(
          (hazard) => String(hazard.id) === String(id)
        );

        if (!selected) {
          throw new Error("This report could not be found.");
        }

        setReport(selected);
      } catch (err) {
        setError(err.message || "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    fetchReport();
  }, [id]);

  if (loading) return <main className="report-page">Loading report...</main>;

  if (error) {
    return (
      <main className="report-page">
        <p>{error}</p>
        <Link to="/">Back to map</Link>
      </main>
    );
  }

  return (
    <main className="report-page">
      
<div className="report-navigation">
  <Link to="/" className="back-link">
    ← Back to map
  </Link>

  
<Link
  to={`/location/${report.location_id}/history`}
  className="back-link"
>
  View location repair history →
</Link>
</div>

      


      <header className="report-header">
        <p>ROADWATCH  · HAZARD REPORT</p>
        <h1>{report.hazard_type.replaceAll("_", " ")}</h1>
        <span className={`report-severity ${report.severity}`}>
          {report.severity} severity
        </span>
      </header>

      <section className="report-details-card">
        <h2>Report details</h2>

        <div className="report-detail-row">
          <span>Report ID</span>
          <strong>#{report.id}</strong>
        </div>

        <div className="report-detail-row">
          <span>Hazard type</span>
          <strong>{report.hazard_type.replaceAll("_", " ")}</strong>
        </div>

        <div className="report-detail-row">
          <span>Severity</span>
          <strong>{report.severity}</strong>
        </div>

        <div className="report-detail-row">
          <span>Latitude</span>
          <strong>{report.latitude}</strong>
        </div>

        <div className="report-detail-row">
          <span>Longitude</span>
          <strong>{report.longitude}</strong>
        </div>

        <div className="report-detail-row">
          <span>Date reported</span>
          <strong>
            {report.created_at
              ? new Date(report.created_at).toLocaleString()
              : "Not available"}
          </strong>
        </div>

        <h3>Description</h3>
        <p>{report.description || "No description provided."}</p>

        {report.photo_url && (
          <div className="report-photo-section">
            <h3>Attached photo</h3>
            <img
              src={`${API}${report.photo_url}`}
              alt="Reported road hazard"
            />
          </div>
        )}
      </section>
    </main>
  );
}