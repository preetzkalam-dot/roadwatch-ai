import { Routes, Route } from "react-router-dom";
import ReportDetails from "./ReportDetails.jsx";

import RepairHistory from "./RepairHistory.jsx";
import AIReview from "./AIReview.jsx";

import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "./App.css";

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const API = "https://roadwatch-ai-ys0v.onrender.com";
function MapClickHandler({ setForm, selectedLocation, setSelectedLocation }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedLocation) return;

    map.flyTo(
      [selectedLocation.lat, selectedLocation.lng],
      Math.max(map.getZoom(), 15),
      { duration: 0.8 }
    );
  }, [selectedLocation, map]);

  useMapEvents({
    click(event) {
      const lat = event.latlng.lat;
      const lng = event.latlng.lng;

      setForm((previous) => ({
        ...previous,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));
      setSelectedLocation({ lat, lng });
    },
  });

  return selectedLocation ? (
    <Marker position={[selectedLocation.lat, selectedLocation.lng]}>
      <Popup>Selected incident location</Popup>
    </Marker>
  ) : null;
}

function FitHazards({ hazards }) {
  const map = useMap();
  const positionsKey = hazards
    .map((hazard) => `${hazard.id}:${hazard.latitude}:${hazard.longitude}`)
    .join("|");

  useEffect(() => {
    if (hazards.length === 0) return;

    const points = hazards
      .filter(
        (hazard) =>
          Number.isFinite(Number(hazard.latitude)) &&
          Number.isFinite(Number(hazard.longitude))
      )
      .map((hazard) => [Number(hazard.latitude), Number(hazard.longitude)]);

    if (points.length === 1) {
      map.flyTo(points[0], 15, { duration: 0.6 });
    } else if (points.length > 1) {
      map.fitBounds(points, { padding: [28, 28], maxZoom: 15 });
    }
  }, [positionsKey, map]);

  return null;
}

function FocusNearbyLocation({ location }) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.flyTo([location.lat, location.lng], 14, { duration: 0.8 });
    }
  }, [location, map]);

  return null;
}

function distanceInKm(lat1, lon1, lat2, lon2) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function App() {
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState(null);
const [photoPreview, setPhotoPreview] = useState("");
const photoInputRef = useRef(null);
  
const [severityFilter, setSeverityFilter] = useState("all");
const [typeFilter, setTypeFilter] = useState("all");
const [selectedLocation, setSelectedLocation] = useState(null);
const [locationSearch, setLocationSearch] = useState("");
const [locationSuggestions, setLocationSuggestions] = useState([]);
const [locationSearching, setLocationSearching] = useState(false);
const [deviceLocation, setDeviceLocation] = useState(null);
const skipAutocompleteRef = useRef(false);
const [isSubmitting, setIsSubmitting] = useState(false);
const [deletingHazardId, setDeletingHazardId] = useState(null);
const [nearbyLocation, setNearbyLocation] = useState(null);
const [nearbyScope, setNearbyScope] = useState(null);
const [nearbyLoading, setNearbyLoading] = useState(false);
const cameraInputRef = useRef(null);

  const [form, setForm] = useState({
    hazard_type: "pothole",
    latitude: "",
    longitude: "",
    severity: "medium",
    description: "",
  });

  // Capture the device location when the user focuses the location search.
  // If permission is unavailable, search results use the selected map pin or Chennai as a fallback.
  function captureSearchLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDeviceLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        // Permission is optional; the search still works with its fallback location.
      },
      { enableHighAccuracy: false, timeout: 7000, maximumAge: 120000 }
    );
  }

  function getSearchReference() {
  return deviceLocation || selectedLocation || { lat: 13.0827, lng: 80.2707 };
}

  function rankSuggestionsNearReference(features) {
    const reference = getSearchReference();
    return [...features].sort((a, b) => {
      const aCoords = a.geometry?.coordinates || [];
      const bCoords = b.geometry?.coordinates || [];
      const aDistance = aCoords.length >= 2
        ? distanceInKm(reference.lat, reference.lng, Number(aCoords[1]), Number(aCoords[0]))
        : Number.POSITIVE_INFINITY;
      const bDistance = bCoords.length >= 2
        ? distanceInKm(reference.lat, reference.lng, Number(bCoords[1]), Number(bCoords[0]))
        : Number.POSITIVE_INFINITY;
      return aDistance - bDistance;
    });
  }

  function addProximityBias(url) {
    const reference = getSearchReference();
    url.searchParams.set("lat", String(reference.lat));
    url.searchParams.set("lon", String(reference.lng));
  }

  async function loadHazards() {
  try {
    const response = await fetch(`${API}/hazards/active`);

    if (!response.ok) {
      throw new Error("Could not load hazards");
    }

    const data = await response.json();
    console.log("ROADWATCH HAZARD DATA:", data);
    setHazards(data);
    setMessage("");
  } catch (error) {
    console.error("Failed to refresh hazards:", error);
    setMessage("Could not refresh reports. Check that the backend is running.");
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
  loadHazards();

  const intervalId = setInterval(() => {
    loadHazards();
  }, 15000);

  return () => clearInterval(intervalId);
}, []);
  function useCurrentLocation() {
  if (!window.isSecureContext) {
    setMessage(
      "Location requires localhost or HTTPS. Open the app on localhost or use a secure HTTPS address."
    );
    return;
  }

  if (!navigator.geolocation) {
    setMessage("This browser does not support location access.");
    return;
  }

  setMessage("Requesting location permission...");

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      setDeviceLocation({ lat, lng });
      setSelectedLocation({ lat, lng });

      setForm((previous) => ({
        ...previous,
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6),
      }));

      setMessage(
        `Location detected: ${lat.toFixed(5)}, ${lng.toFixed(5)}`
      );
    },
    (error) => {
      console.error("Geolocation error:", error);

      if (error.code === 1) {
        setMessage(
          "Location permission is blocked. Allow Location for this site in your browser settings, then try again."
        );
      } else if (error.code === 2) {
        setMessage("Your device could not determine its location. Check device Location Services.");
      } else if (error.code === 3) {
        setMessage("Location request timed out. Try again.");
      } else {
        setMessage("Could not get your location. Check browser and device permissions.");
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    }
  );
}

  function findNearbyHazards() {
    if (!navigator.geolocation) {
      setMessage("Location is not supported by this browser. Enable location or use the map.");
      return;
    }

    setNearbyLoading(true);
    setMessage("Searching nearby first, then expanding the search area if needed...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        // Progressive search scopes. Locality/city/state are practical distance
        // approximations; country scope is limited to India's approximate bounds.
        const scopes = [
          { key: "locality", label: "Locality", radiusKm: 5 },
          { key: "city", label: "City", radiusKm: 25 },
          { key: "state", label: "State", radiusKm: 200 },
          { key: "country", label: "India", radiusKm: Infinity },
        ];
        const isInIndia = (hazard) => {
          const lat = Number(hazard.latitude);
          const lng = Number(hazard.longitude);
          return Number.isFinite(lat) && Number.isFinite(lng) &&
            lat >= 6.5 && lat <= 35.7 && lng >= 68.1 && lng <= 97.4;
        };
        const validHazards = hazards.filter((hazard) => {
          const lat = Number(hazard.latitude);
          const lng = Number(hazard.longitude);
          return Number.isFinite(lat) && Number.isFinite(lng);
        });
        const countryHazards = validHazards.filter(isInIndia);
        const countInScope = (scope) => {
          if (scope.key === "country") return countryHazards.length;
          return countryHazards.filter((hazard) =>
            distanceInKm(
              location.lat,
              location.lng,
              Number(hazard.latitude),
              Number(hazard.longitude)
            ) <= scope.radiusKm
          ).length;
        };

        // Prefer a scope with at least 3 results. If there are fewer, expand
        // until there are enough or the countrywide scope has been checked.
        const chosenScope = scopes.find((scope) => countInScope(scope) >= 3) ||
          [...scopes].reverse().find((scope) => countInScope(scope) > 0) ||
          scopes[scopes.length - 1];

        setNearbyLocation(location);
        setNearbyScope(chosenScope);
        setNearbyLoading(false);

        const count = countInScope(chosenScope);
        if (count === 0) {
          setMessage("No reported hazards found in India yet. Try again after more reports are added.");
        } else {
          const expanded = chosenScope.key === "locality"
            ? "Locality search"
            : `Search expanded to ${chosenScope.label}`;
          setMessage(`${expanded}: found ${count} reported hazard${count === 1 ? "" : "s"}.`);
        }
      },
      (error) => {
        setNearbyLoading(false);
        const reason =
          error.code === 1
            ? "Location permission was denied."
            : error.code === 2
              ? "Your location is unavailable."
              : "The location request timed out.";
        setMessage(`${reason} Allow location access and try again.`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  }

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Please select or capture a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Photo must be smaller than 5 MB.");
      event.target.value = "";
      setPhoto(null);
      setPhotoPreview("");
      return;
    }

    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setMessage("");
  }

  function getSuggestionLabel(feature) {
    const properties = feature.properties || {};
    const primary = properties.name || properties.street || properties.locality || properties.city || properties.district || "Unnamed location";
    // Keep the address hierarchy readable: locality/city, then state, then country.
    const secondaryParts = [
      properties.street && properties.name && properties.street !== properties.name ? properties.street : null,
      properties.locality,
      properties.city,
      properties.district,
      properties.state,
      properties.country,
    ].filter((part, index, all) => part && all.indexOf(part) === index && part !== primary);
    return { primary, secondary: secondaryParts.join(", "), full: [primary, ...secondaryParts].join(", ") };
  }

  useEffect(() => {
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return undefined;
    }
    const query = locationSearch.trim();
    if (query.length < 2) {
      setLocationSuggestions([]);
      setLocationSearching(false);
      return undefined;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      setLocationSearching(true);
      try {
        // Photon supports search-as-you-type; Nominatim's public service does not allow client-side autocomplete.
        const url = new URL("https://photon.komoot.io/api/");
        url.searchParams.set("q", query);
        url.searchParams.set("limit", "10");
        url.searchParams.set("lang", "en");
        // Keep results in India and bias ranking toward the user's/map's location.
        url.searchParams.set("bbox", "68.1,6.5,97.4,35.7");
        addProximityBias(url);

        const response = await fetch(url.toString(), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Location suggestions could not be loaded.");
        const data = await response.json();
        const indiaOnly = (Array.isArray(data.features) ? data.features : []).filter(
          (feature) => String(feature.properties?.country || "").toLowerCase() === "india"
        );
        setLocationSuggestions(rankSuggestionsNearReference(indiaOnly).slice(0, 5));
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error("Location autocomplete failed:", error);
          setLocationSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setLocationSearching(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [locationSearch, deviceLocation]);

  function chooseLocationSuggestion(feature) {
    const coordinates = feature.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return;

    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const label = getSuggestionLabel(feature).full;
    skipAutocompleteRef.current = true;
    setForm((previous) => ({
      ...previous,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
    setSelectedLocation({ lat, lng });
    setLocationSearch(label);
    setLocationSuggestions([]);
    setMessage(`Location selected: ${label}. Click the map to adjust the exact hazard point if needed.`);
  }

  async function searchIncidentLocation(event) {
    event.preventDefault();
    const query = locationSearch.trim();

    if (!query) {
      setMessage("Enter a street, area, or landmark to search.");
      return;
    }

    if (locationSuggestions.length > 0) {
      chooseLocationSuggestion(locationSuggestions[0]);
      return;
    }

    setLocationSearching(true);
    setMessage("");
    try {
      const url = new URL("https://photon.komoot.io/api/");
      url.searchParams.set("q", query);
      url.searchParams.set("limit", "10");
      url.searchParams.set("lang", "en");
      url.searchParams.set("bbox", "68.1,6.5,97.4,35.7");
      addProximityBias(url);
      const response = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Location search failed.");
      const data = await response.json();
      const indiaResults = (data.features || []).filter(
        (feature) => String(feature.properties?.country || "").toLowerCase() === "india"
      );
      const firstResult = rankSuggestionsNearReference(indiaResults)[0];
      if (!firstResult) {
        setMessage("No matching place found. Try a nearby street or landmark.");
        return;
      }
      chooseLocationSuggestion(firstResult);
    } catch (error) {
      console.error(error);
      setMessage("Couldn't search for that place. You can still click directly on the map.");
    } finally {
      setLocationSearching(false);
    }
  }

  function startPickingLocation() {
    setLocationSuggestions([]);
    setSelectedLocation(null);
    setForm((previous) => ({ ...previous, latitude: "", longitude: "" }));
    setMessage("Choose the incident location by clicking the map, searching for a landmark, or using your current location.");
    document.querySelector(".map-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function updateManualCoordinate(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
    const next = {
      lat: Number(field === "latitude" ? value : form.latitude),
      lng: Number(field === "longitude" ? value : form.longitude),
    };

    if (
      Number.isFinite(next.lat) &&
      Number.isFinite(next.lng) &&
      Math.abs(next.lat) <= 90 &&
      Math.abs(next.lng) <= 180
    ) {
      setSelectedLocation(next);
    }
  }

  async function reportHazard(event) {
    event.preventDefault();

    if (isSubmitting) return;

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);
    if (
      !selectedLocation ||
      !form.latitude.trim() ||
      !form.longitude.trim() ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    ) {
      setMessage("Select the hazard location first: click the map, search for a landmark, or use your current location.");
      return;
    }

    setIsSubmitting(true);
    setMessage("Submitting hazard report...");

    try {
      let photoUrl = "";

      if (photo) {
        const photoData = new FormData();
        photoData.append("photo", photo);

        const uploadResponse = await fetch(`${API}/upload-photo`, {
          method: "POST",
          body: photoData,
        });
        if (!uploadResponse.ok) throw new Error("Photo upload failed.");
        const uploadResult = await uploadResponse.json();
        photoUrl = uploadResult.photo_url;
      }

      const params = new URLSearchParams({
        ...form,
        latitude: String(lat),
        longitude: String(lng),
      });
      if (photoUrl) params.set("photo_url", photoUrl);

      const response = await fetch(`${API}/hazards?${params}`, { method: "POST" });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || "The report could not be saved.");
      }

      // Refresh saved hazards, then clear the temporary selection pin and location.
      await loadHazards();
      setSelectedLocation(null);
      setForm((previous) => ({
        ...previous,
        latitude: "",
        longitude: "",
        description: "",
      }));
      setPhoto(null);
      setPhotoPreview("");
      if (photoInputRef.current) photoInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      setMessage("Hazard reported successfully. Select a location before submitting another report.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Report failed. Check the backend.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteHazard(hazard) {
    const confirmed = window.confirm(
      `Delete this ${hazard.hazard_type.replaceAll("_", " ")} report? Use this if the hazard has been cleared or the report was incorrect.`
    );
    if (!confirmed) return;

    setDeletingHazardId(hazard.id);
    setMessage("");
    try {
      const response = await fetch(`${API}/hazards/${hazard.id}`, { method: "DELETE" });
      if (!response.ok) {
        const details = await response.text();
        throw new Error(details || "Could not delete this hazard. Check the backend DELETE endpoint.");
      }
      setHazards((previous) => previous.filter((item) => item.id !== hazard.id));
      setMessage("Hazard report deleted.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Could not delete the hazard.");
    } finally {
      setDeletingHazardId(null);
    }
  }

  const critical = hazards.filter((h) => h.severity === "high").length;
  
const filteredHazards = hazards.filter((hazard) => {
  const matchesSeverity =
    severityFilter === "all" || hazard.severity === severityFilter;

  const matchesType =
    typeFilter === "all" || hazard.hazard_type === typeFilter;

  const matchesNearby = (() => {
    if (!nearbyLocation || !nearbyScope) return true;
    const lat = Number(hazard.latitude);
    const lng = Number(hazard.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    // Countrywide scope includes hazards inside India's approximate bounds.
    if (nearbyScope.key === "country") {
      return lat >= 6.5 && lat <= 35.7 && lng >= 68.1 && lng <= 97.4;
    }
    return distanceInKm(nearbyLocation.lat, nearbyLocation.lng, lat, lng) <= nearbyScope.radiusKm;
  })();

  return matchesSeverity && matchesType && matchesNearby;
});

const categoryStats = {
  pothole: hazards.filter((h) => h.hazard_type === "pothole").length,
  crack: hazards.filter((h) => h.hazard_type === "crack").length,
  flooding: hazards.filter((h) => h.hazard_type === "flooding").length,
  debris: hazards.filter((h) => h.hazard_type === "debris").length,
  damaged_sign: hazards.filter((h) => h.hazard_type === "damaged_sign").length,
  other: hazards.filter((h) => h.hazard_type === "other").length,
};

const severityRank = {
  high: 3,
  medium: 2,
  low: 1,
};

const sortedHazards = [...filteredHazards].sort(
  (a, b) =>
    (severityRank[b.severity] || 0) -
    (severityRank[a.severity] || 0)
);



  return (
    <main className="app">
     <header className="topbar">
  <a className="brand" href="/">
    
<span className="brand-icon">R</span>
<span>
  RoadWatch<span className="brand-ai"> </span>
  <small>ROAD HAZARD INTELLIGENCE</small>
</span>
</a>


  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
    
    <span className="live-status">
      <i /> SYSTEM ONLINE
    </span>
  </div>
</header> 

      <section className="welcome">
  <div>
    <p className="eyebrow">ROAD SAFETY MONITORING PLATFORM</p>
          <h1>Smarter roads.<br /><span>Safer journeys.</span></h1>
          <p className="intro">
            Report road hazards, monitor dangerous locations, and help make
            every journey safer.
          </p>
        </div>
        <div className="welcome-mark" aria-hidden="true">⌁</div>
      </section>

     <section className="stats">
  <article className="stat-card">
    <span>Total reports</span>
    <strong>{loading ? "—" : hazards.length}</strong>
    <small>All recorded hazards</small>
  </article>

  <article className="stat-card">
    <span>Map status</span>
    <strong className="green-number">LIVE</strong>
    <small>OpenStreetMap</small>
  </article>
</section>

      <section className="content-grid">
        <article className="panel map-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">GEOSPATIAL VIEW</p>
              <h2>Hazard map</h2>
            </div>
            <span className="count-pill">{hazards.length} reports</span>
          </div>
          
<div className="map-filters">
  <label>
    Severity
    <select
      value={severityFilter}
      onChange={(e) => setSeverityFilter(e.target.value)}
    >
      <option value="all">All severities</option>
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
    </select>
  </label>

  <label>
    Hazard type
    <select
      value={typeFilter}
      onChange={(e) => setTypeFilter(e.target.value)}
    >
      <option value="all">All types</option>
      <option value="pothole">Pothole</option>
      <option value="crack">Road crack</option>
      <option value="flooding">Flooding</option>
      <option value="debris">Road debris</option>
      <option value="damaged_sign">Damaged road sign</option>
      <option value="other">Other</option>
    </select>
  </label>

  <button
    type="button"
    className="refresh-button"
    onClick={() => {
      setSeverityFilter("all");
      setTypeFilter("all");
      setNearbyLocation(null);
      setNearbyScope(null);
      setMessage("Map filters reset.");
    }}
  >
    Reset filters
  </button>

  <button
    type="button"
    className="refresh-button"
    onClick={findNearbyHazards}
    disabled={nearbyLoading}
  >
    {nearbyLoading ? "Finding nearby..." : "📍 Find hazards near me"}
  </button>
  {nearbyLocation && nearbyScope && (
    <span className="map-note">
      Scope: {nearbyScope.label}{nearbyScope.radiusKm !== Infinity ? ` · ${nearbyScope.radiusKm} km radius` : " · India-wide"}
    </span>
  )}
</div>


          <MapContainer
            center={[13.0827, 80.2707]}
            zoom={12}
            scrollWheelZoom={true}
            className="hazard-map"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler
              setForm={setForm}
              selectedLocation={selectedLocation}
              setSelectedLocation={setSelectedLocation}
            />
            <FitHazards hazards={filteredHazards} />
            <FocusNearbyLocation location={nearbyLocation} />

            {filteredHazards.map((hazard) => (
              <CircleMarker
                key={hazard.id}
                center={[hazard.latitude, hazard.longitude]}
                radius={9}
                pathOptions={{
  color:
    hazard.severity === "high"
      ? "#e5484d"
      : hazard.severity === "medium"
        ? "#e6a23c"
        : "#22a06b",
  fillColor:
    hazard.severity === "high"
      ? "#e5484d"
      : hazard.severity === "medium"
        ? "#e6a23c"
        : "#22a06b",
  fillOpacity: 0.8,
}}
              >
                <Popup>
  <div className="hazard-popup">
    <h3>{hazard.hazard_type.replace("_", " ")}</h3>

    <p>
      <strong>Severity:</strong>{" "}
      <span className={`severity-${hazard.severity}`}>
        {hazard.severity}
      </span>
    </p>

    <p>{hazard.description || "No description provided."}</p>

    <button
      type="button"
      className="show-report-btn"
      onClick={() => {
        window.location.href = `/report/${hazard.id}`;
      }}
    >
      Show Report
    </button>
  </div>
</Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          <p className="map-note">
            Showing {filteredHazards.length} matching hazards{nearbyScope ? ` in the ${nearbyScope.label} search scope` : ""}. Click the map to choose an incident location; the selected location uses a separate pin. Locality, city, and state scopes use approximate distance radii; India-wide search uses approximate country bounds.
          </p>
        </article>

        <article className="panel form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">COMMUNITY REPORTING</p>
              <h2>Report a hazard</h2>
            </div>
            <button
              type="button"
              className="form-icon"
              title="Pick incident location on the map"
              aria-label="Pick incident location on the map"
              onClick={startPickingLocation}
            >
              ＋
            </button>
          </div>

          <form onSubmit={reportHazard}>
            <div className="location-picker">
              <label htmlFor="location-search">Find the incident location</label>
              <div style={{ position: "relative" }}>
                <div className="field-row">
                  <input
                    id="location-search"
                    type="text"
                    value={locationSearch}
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-controls="location-suggestions"
                    onChange={(event) => setLocationSearch(event.target.value)}
                    onFocus={() => {
                      captureSearchLocation();
                      if (locationSearch.trim().length >= 2) setMessage("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setLocationSuggestions([]);
                      if (event.key === "Enter" && locationSuggestions.length > 0) {
                        event.preventDefault();
                        chooseLocationSuggestion(locationSuggestions[0]);
                      }
                    }}
                    placeholder="Start typing a street, area, or landmark"
                  />
                  <button
                    type="button"
                    className="refresh-button"
                    onClick={searchIncidentLocation}
                    disabled={locationSearching}
                  >
                    {locationSearching ? "Searching..." : "Search"}
                  </button>
                </div>
                {(locationSuggestions.length > 0 || (locationSearching && locationSearch.trim().length >= 2)) && (
                  <div
                    id="location-suggestions"
                    role="listbox"
                    aria-label="Location suggestions"
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 1200,
                      background: "var(--panel, #fff)",
                      border: "1px solid var(--border, #d7dce2)",
                      borderRadius: "10px",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.14)",
                      maxHeight: "260px",
                      overflowY: "auto",
                    }}
                  >
                    {locationSearching && locationSuggestions.length === 0 ? (
                      <div style={{ padding: "12px 14px", fontSize: "14px" }}>Finding matching places…</div>
                    ) : locationSuggestions.map((feature, index) => {
                      const label = getSuggestionLabel(feature);
                      return (
                        <button
                          key={`${feature.properties?.osm_type || "place"}-${feature.properties?.osm_id || index}-${feature.geometry?.coordinates?.join(",")}`}
                          type="button"
                          role="option"
                          aria-selected="false"
                          onClick={() => chooseLocationSuggestion(feature)}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "11px 14px",
                            textAlign: "left",
                            background: "transparent",
                            border: 0,
                            borderBottom: index < locationSuggestions.length - 1 ? "1px solid var(--border, #e5e7eb)" : 0,
                            cursor: "pointer",
                            color: "inherit",
                          }}
                        >
                          <span style={{ display: "block", fontWeight: 600 }}>{label.primary}</span>
                          {label.secondary && <span style={{ display: "block", marginTop: "3px", fontSize: "12px", opacity: 0.72 }}>{label.secondary}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="refresh-button"
                onClick={useCurrentLocation}
              >
                📍 Use my current location
              </button>
              <p className="map-note">
                Or click the map to mark where the hazard occurred. The pin and coordinates will update automatically.
              </p>
            </div>


            <label>
              Hazard type
              <select
                value={form.hazard_type}
                onChange={(e) =>
                  setForm({ ...form, hazard_type: e.target.value })
                }
              >
                <option value="pothole">Pothole</option>
                <option value="crack">Road crack</option>
                <option value="flooding">Flooding</option>
                <option value="debris">Road debris</option>
                <option value="damaged_sign">Damaged road sign</option>
                <option value="other">Other</option>
              </select>
            </label>

            <div className="field-row">
              <label>
                Latitude
                <input
                  type="number"
                  step="any"
                  required
                  readOnly
                  value={form.latitude}
                  onChange={(e) => updateManualCoordinate("latitude", e.target.value)}
                />
              </label>
              <label>
                Longitude
                <input
                  type="number"
                  step="any"
                  required
                  readOnly
                  value={form.longitude}
                  onChange={(e) => updateManualCoordinate("longitude", e.target.value)}
                />
              </label>
            </div>

            <label>
              Severity
              <select
                value={form.severity}
                onChange={(e) =>
                  setForm({ ...form, severity: e.target.value })
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>

            <label>
              Description
              <textarea
                rows="3"
                placeholder="Describe the hazard and nearby landmark..."
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
            
            <div className="photo-options">
              <label>
                Road photo (optional) — upload a file
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                />
              </label>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                style={{ display: "none" }}
                aria-label="Take a road photo with the camera"
              />
              <button
                type="button"
                className="refresh-button camera-button"
                onClick={() => cameraInputRef.current?.click()}
              >
                📷 Take road photo
              </button>
              <p className="map-note">
                On supported phones, this opens the rear camera. You can still upload an existing photo above.
              </p>
            </div>

            {photoPreview && (
              <img
                src={photoPreview}
                alt="Selected road hazard"
                style={{
                  width: "100%",
                  maxHeight: "220px",
                  objectFit: "contain",
                  borderRadius: "8px",
                }}
              />
            )}


            <button className="submit-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting report..." : "Submit hazard report"} <span>→</span>
            </button>
            {message && <p className="form-message" role="status">{message}</p>}
          </form>
        </article>
      </section>

      <section className="panel reports-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">LATEST ACTIVITY</p>
            <h2>Recent hazard reports</h2>
            <p className="map-note">Sorted by severity: High → Medium → Low</p>
            
          </div>
          <button className="refresh-button" onClick={loadHazards}>
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <p className="empty-state">Loading reports...</p>
        ) : filteredHazards.length === 0 ? (
          <p className="empty-state">No reports yet. Submit your first hazard above.</p>
        ) : (
          
<div className="report-list">
  {sortedHazards.map((hazard) => (
    <article
      className="report-card"
      key={hazard.id}
      onClick={() => {
        window.location.href = `/report/${hazard.id}`;
      }}
    >
      <div className="report-card-top">
        <span className={`severity-label ${hazard.severity}`}>
          {hazard.severity}
        </span>

        <button
          type="button"
          className="report-delete"
          onClick={(e) => {
            e.stopPropagation();
            deleteHazard(hazard);
          }}
          disabled={deletingHazardId === hazard.id}
          aria-label={`Delete ${hazard.hazard_type} report ${hazard.id}`}
          title="Delete this report"
        >
          {deletingHazardId === hazard.id ? "Deleting..." : "Delete"}
        </button>
      </div>

      {hazard.photo_url ? (
        <img
          className="report-card-image"
          src={hazard.photo_url}
          alt={hazard.hazard_type.replaceAll("_", " ")}
        />
      ) : (
        <div className="report-card-placeholder">
          <span>📍</span>
          <small>Road hazard report</small>
        </div>
      )}

      <div className="report-card-body">
        <h3>{hazard.hazard_type.replaceAll("_", " ")}</h3>

        <p className="report-card-location">
          📍 {Number(hazard.latitude).toFixed(4)},{" "}
          {Number(hazard.longitude).toFixed(4)}
        </p>

        {nearbyLocation && (
          <p className="report-card-distance">
            {distanceInKm(
              nearbyLocation.lat,
              nearbyLocation.lng,
              Number(hazard.latitude),
              Number(hazard.longitude)
            ).toFixed(2)}{" "}
            km away
          </p>
        )}

        {hazard.description && (
          <p className="report-card-description">
            {hazard.description}
          </p>
        )}
      </div>
    </article>
  ))}
</div>

        )}
      </section>

      <footer>ROADWATCH  · Building safer roads through shared intelligence</footer>
    </main>
  );
}


export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/report/:id" element={<ReportDetails />} />
      <Route path="/ai-review" element={<AIReview />} />
      <Route
  path="/location/:locationId/history"
  element={<RepairHistory />}
/>
    </Routes>
  );
}
