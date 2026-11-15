import { getPlaces, mock } from "./api.js";
import { getUser } from "./auth.js";
import { estimateCrowd } from "./estimates.js";
import { favoriteButtonMarkup, getFavorites, toggleFavorite } from "./favorites.js";
import { escapeHtml, formatDateTime, formatUpdated, renderShell, showToast, showViewError, statusBadge, statusInfo } from "./ui.js";
import { REQUIRE_LOCATION_FOR_REPORTS } from "./config.js";
import { verifyReportLocation } from "./location.js";

renderShell("places");

const state = document.getElementById("places-state");
const list = document.getElementById("places-list");
const summary = document.getElementById("summary-strip");
const count = document.getElementById("result-count");
const search = document.getElementById("place-search");
const sortSelect = document.getElementById("place-sort");
const chips = document.getElementById("category-chips");
const mapView = document.getElementById("map-view");
const mapStatus = document.getElementById("map-search-status");
const locationMessage = document.getElementById("location-message");
const searchForm = document.getElementById("map-search-form");
const searchButton = document.getElementById("map-search-button");
const searchResults = document.getElementById("map-search-results");
const detailsPanel = document.getElementById("osm-place-details");
let reportPanel;
let reportOptions;
let reportSubmit;
let places = [];
let selectedCategory = "";
let savedFilter = false;
let debounceTimer;
let map;
let markers;
let miniMap;
let selectedMarker;
let nearMeActive = false;
let lastNominatimRequest = 0;
let selectedOsmPlace = null;
let selectedCrowdLevel = null;

const cityCenter = [30.7333, 76.7794];
const crowdLevels = [
  { label: "Very quiet", value: 10, index: 0 },
  { label: "Quiet", value: 30, index: 1 },
  { label: "Moderate", value: 50, index: 2 },
  { label: "Busy", value: 70, index: 3 },
  { label: "Very crowded", value: 90, index: 4 }
];
const pendingPlaceKey = "crowdpeek.pendingOsmPlace";

function renderSummary() {
  if (!places.length) {
    summary.replaceChildren();
    return;
  }
  const quietest = [...places].sort((a, b) => Number(a.crowd) - Number(b.crowd))[0];
  const busiest = [...places].sort((a, b) => Number(b.crowd) - Number(a.crowd))[0];
  const calm = places.filter((place) => Number(place.crowd) <= 40).length;
  const card = (label, place) => {
    const status = statusInfo(place.crowd);
    return `<article class="summary-card">
      <span class="summary-label">${label}</span>
      <div class="summary-value ${status.className}">
        <span>${escapeHtml(place.name)}</span><span class="tabular">${escapeHtml(place.crowd)}%</span>
        ${statusBadge(place.crowd)}
      </div>
    </article>`;
  };
  summary.innerHTML = `${card("Quietest right now", quietest)}${card("Busiest right now", busiest)}
    <article class="summary-card"><span class="summary-label">Calm places right now</span>
      <div class="summary-value"><span class="tabular">${calm} of ${places.length}</span></div>
      <span class="summary-detail">At 40% crowd or below</span>
    </article>`;
}

function renderChips() {
  const categories = [...new Set(places.map((place) => place.category))].sort((a, b) => a.localeCompare(b));
  chips.innerHTML = `<button class="category-chip" type="button" data-category="" aria-pressed="${String(!selectedCategory && !savedFilter)}">All</button>
    ${categories.map((category) => `<button class="category-chip" type="button" data-category="${escapeHtml(category)}" aria-pressed="${String(category === selectedCategory && !savedFilter)}">${escapeHtml(category)}</button>`).join("")}
    <button class="category-chip saved-chip" type="button" data-saved="true" aria-pressed="${String(savedFilter)}">Saved <span class="saved-count">${getFavorites().length}</span></button>`;
}

function filteredPlaces() {
  const query = search.value.trim().toLocaleLowerCase();
  const favorites = getFavorites();
  const filtered = places.filter((place) => {
    const matchesText = !query || `${place.name} ${place.sector}`.toLocaleLowerCase().includes(query);
    return matchesText && (!selectedCategory || place.category === selectedCategory)
      && (!savedFilter || favorites.includes(String(place.id)));
  });
  if (nearMeActive) {
    filtered.sort((a, b) => a.distanceKm - b.distanceKm);
  } else if (sortSelect.value === "name") {
    filtered.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  } else {
    const direction = sortSelect.value === "busiest" ? -1 : 1;
    filtered.sort((a, b) => (Number(a.crowd) - Number(b.crowd)) * direction);
  }
  return filtered;
}

function renderRows(filtered) {
  const favorites = getFavorites();
  count.textContent = `${filtered.length} ${filtered.length === 1 ? "place" : "places"}`;
  if (!filtered.length) {
    list.classList.add("d-none");
    state.classList.remove("d-none", "error-state");
    state.innerHTML = savedFilter && favorites.length === 0
      ? `<strong>No saved places yet.</strong> <p class="mb-0 mt-1">Tap Save on a place to keep an eye on it.</p>`
      : `<strong>No places found</strong><p class="mb-0 mt-1">Try another name, sector, or category.</p>`;
    return;
  }
  list.innerHTML = filtered.map((place) => {
    const status = statusInfo(place.crowd);
    const distance = Number.isFinite(place.distanceKm) ? `<span class="place-distance">${place.distanceKm.toFixed(1)} km away</span>` : "";
    return `<article class="place-row">
      <a class="place-row-main" href="place.html?id=${encodeURIComponent(place.id)}" aria-label="${escapeHtml(place.name)}, ${escapeHtml(place.crowd)}% crowded, ${status.label}">
        <div class="place-heading"><span class="place-name">${escapeHtml(place.name)}</span><span class="place-sector">${escapeHtml(place.sector)} - ${escapeHtml(place.category)}</span></div>
        <div class="crowd-cell ${status.className}">
          <div class="crowd-cell-top"><span class="crowd-percent-small tabular">${escapeHtml(place.crowd)}%</span></div>
          <progress class="crowd-progress" max="100" value="${Math.min(100, Math.max(0, Number(place.crowd)))}" aria-label="Crowd level ${escapeHtml(place.crowd)} percent"></progress>
        </div>
        <span class="place-status">${statusBadge(place.crowd)}</span>
        <span class="updated-cell">${distance ? `${distance}<span class="row-updated"> · Updated ${escapeHtml(formatUpdated(place.updatedMinutes))}</span>` : `Updated ${escapeHtml(formatUpdated(place.updatedMinutes))}`}</span>
      </a>
      ${favoriteButtonMarkup(place.id, getFavorites().includes(String(place.id)))}
    </article>`;
  }).join("");
  list.classList.remove("d-none");
  state.classList.add("d-none");
}

function markerColor(level) {
  const variable = ["--very-quiet", "--quiet", "--moderate", "--busy", "--very-crowded"][level];
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
}

function ensureMap() {
  if (map) return true;
  if (!window.L) {
    setMapStatus("The map is unavailable. Check your connection and try again.", true);
    return false;
  }
  map = window.L.map("places-map", { scrollWheelZoom: false }).setView(cityCenter, 12);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  markers = window.L.layerGroup().addTo(map);
  window.setTimeout(() => map.invalidateSize(), 0);
  return true;
}

function renderMapMarkers(filtered) {
  if (!map || !markers) return;
  markers.clearLayers();
  for (const place of filtered) {
    if (!Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) continue;
    const status = statusInfo(place.crowd);
    const marker = window.L.circleMarker([place.latitude, place.longitude], {
      radius: 9,
      color: markerColor(status.level),
      fillColor: markerColor(status.level),
      fillOpacity: .82,
      weight: 2
    });
    marker.bindPopup(`<strong>${escapeHtml(place.name)}</strong><br>${escapeHtml(place.crowd)}% · ${escapeHtml(status.label)}<br><a href="place.html?id=${encodeURIComponent(place.id)}">View place</a>`);
    marker.addTo(markers);
  }
}

function renderPlaces() {
  const filtered = filteredPlaces();
  renderRows(filtered);
  renderMapMarkers(filtered);
}

function setMapStatus(message, isError = false) {
  mapStatus.textContent = message;
  mapStatus.classList.toggle("d-none", !message);
  mapStatus.classList.toggle("error-state", isError);
}

function setView(view) {
  const showingMap = view === "map";
  list.classList.toggle("d-none", showingMap || !filteredPlaces().length);
  mapView.classList.toggle("d-none", !showingMap);
  document.getElementById("list-view-button").classList.toggle("is-selected", !showingMap);
  document.getElementById("map-view-button").classList.toggle("is-selected", showingMap);
  document.getElementById("list-view-button").setAttribute("aria-pressed", String(!showingMap));
  document.getElementById("map-view-button").setAttribute("aria-pressed", String(showingMap));
  if (showingMap && ensureMap()) {
    renderPlaces();
    window.setTimeout(() => map.invalidateSize(), 0);
  }
}

function haversineDistance(firstLat, firstLon, secondLat, secondLon) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const deltaLat = toRadians(secondLat - firstLat);
  const deltaLon = toRadians(secondLon - firstLon);
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(firstLat)) * Math.cos(toRadians(secondLat)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function findNearbyPlaces() {
  locationMessage.classList.add("d-none");
  if (!navigator.geolocation) {
    locationMessage.textContent = "Location is not available in this browser.";
    locationMessage.classList.remove("d-none");
    return;
  }
  const button = document.getElementById("near-me-button");
  button.disabled = true;
  button.textContent = "Finding you…";
  navigator.geolocation.getCurrentPosition((position) => {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    places = places.map((place) => ({
      ...place,
      distanceKm: haversineDistance(latitude, longitude, place.latitude, place.longitude)
    }));
    nearMeActive = true;
    sortSelect.disabled = true;
    button.disabled = false;
    button.textContent = "Clear nearby sort";
    locationMessage.textContent = "Places are sorted by distance from you.";
    locationMessage.classList.remove("d-none");
    renderPlaces();
    if (map) {
      map.setView([latitude, longitude], 12);
      renderMapMarkers(filteredPlaces());
    }
  }, (error) => {
    button.disabled = false;
    button.textContent = "Near me";
    locationMessage.textContent = error.code === error.PERMISSION_DENIED
      ? "Location access was denied. Allow location access in your browser to find nearby places."
      : "Your location could not be found. Try again or check your device settings.";
    locationMessage.classList.remove("d-none");
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
}

function safeWebsite(value) {
  if (!value) return null;
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function renderOsmReportOptions() {
  reportOptions = document.getElementById("osm-report-options");
  reportSubmit = document.getElementById("osm-report-submit");
  reportPanel = document.getElementById("osm-report-panel");
  reportOptions.innerHTML = crowdLevels.map((level) => `<button class="report-option status-${level.index}" type="button" data-level="${level.value}" aria-pressed="false"><span class="status-dot" aria-hidden="true"></span>${level.label}</button>`).join("");
  reportOptions.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedCrowdLevel = Number(button.dataset.level);
      reportOptions.querySelectorAll("[data-level]").forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
      reportSubmit.disabled = false;
      document.getElementById("osm-report-error").classList.add("d-none");
    });
  });
  selectedCrowdLevel = null;
  reportSubmit.disabled = true;
}

function renderOsmReports(reports) {
  const reportContainer = document.getElementById("osm-crowd-content");
  if (reports.length) {
    const average = Math.round(reports.reduce((sum, report) => sum + Number(report.crowdLevel), 0) / reports.length);
    const status = statusInfo(average);
    const verifiedCount = reports.filter((report) => report.verified === true).length;
    reportContainer.innerHTML = `<h3>Crowd reports</h3>
      <p class="osm-crowd-average ${status.className}"><strong>${average}%</strong> average from ${reports.length} ${reports.length === 1 ? "report" : "reports"} ${statusBadge(average)}</p>
      <p class="verified-summary">${verifiedCount} of ${reports.length} reports verified</p>
      <ul class="osm-report-list">${reports.map((report) => `<li>${statusBadge(report.crowdLevel)}${report.verified ? '<span class="verified-tag">Verified on site</span>' : ""}<time datetime="${escapeHtml(report.createdAt)}">${escapeHtml(formatDateTime(report.createdAt))}</time></li>`).join("")}</ul>`;
    document.getElementById("osm-report-open").textContent = "Report crowd";
  } else {
    const estimate = estimateCrowd(selectedOsmPlace.category);
    reportContainer.innerHTML = `<h3>Estimate</h3>
      <p class="estimate-note">An estimate based on this place category and time of day, not a live report.</p>
      <p class="osm-crowd-average ${statusInfo(estimate).className}"><strong>${estimate}%</strong> ${statusBadge(estimate)}</p>`;
    document.getElementById("osm-report-open").textContent = "Be the first to report";
  }
  const openButton = document.getElementById("osm-report-open");
  openButton.addEventListener("click", () => {
    reportPanel.classList.remove("d-none");
    openButton.setAttribute("aria-expanded", "true");
    reportOptions.querySelector("[data-level]")?.focus();
  });
}

function selectOsmPlace(result, openReport = false) {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    setMapStatus("This search result did not include a valid location.", true);
    return;
  }
  const tags = result.extratags || {};
  const address = result.display_name || result.name || "Address not available";
  const name = result.name || result.namedetails?.name || address.split(",")[0];
  const category = result.category || result.class || "Place";
  const type = result.type || "Not available";
  const osmKey = `${String(result.osm_type || "node").toLowerCase()}/${result.osm_id}`;
  const website = safeWebsite(tags.website || tags["contact:website"]);
  selectedOsmPlace = { osmKey, latitude, longitude, name, category, type, address, result };
  const reports = mock.listOsmReports(osmKey);
  detailsPanel.innerHTML = `<div class="osm-details-heading"><div><p class="summary-label">OpenStreetMap place</p><h2>${escapeHtml(name)}</h2></div><span class="osm-type-tag">${escapeHtml(category)} · ${escapeHtml(type.replaceAll("_", " "))}</span></div>
    <dl class="osm-place-facts">
      <div><dt>Address</dt><dd>${escapeHtml(address)}</dd></div>
      <div><dt>Opening hours</dt><dd>${escapeHtml(tags.opening_hours || "Not available")}</dd></div>
      <div><dt>Phone</dt><dd>${escapeHtml(tags.phone || tags["contact:phone"] || "Not available")}</dd></div>
      <div><dt>Website</dt><dd>${website ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(tags.website || tags["contact:website"])}</a>` : "Not available"}</dd></div>
      <div><dt>OpenStreetMap ID</dt><dd class="tabular">${escapeHtml(osmKey)}</dd></div>
    </dl>
    <div id="osm-mini-map" class="osm-mini-map" aria-label="Map showing ${escapeHtml(name)}"></div>
    <section class="osm-crowd-section" id="osm-crowd-content"></section>
    <button id="osm-report-open" class="btn btn-primary w-100" type="button" aria-expanded="false" aria-controls="osm-report-panel"></button>
    <p class="report-location-note">${REQUIRE_LOCATION_FOR_REPORTS ? "We check that you are near the place." : "Location checks are disabled for this demo."}</p>
    <section id="osm-report-panel" class="report-panel d-none" aria-labelledby="osm-report-heading">
      <h3 id="osm-report-heading">How crowded is it?</h3>
      <form id="osm-report-form">
        <fieldset class="report-options" id="osm-report-options"><legend class="visually-hidden">Select current crowd level</legend></fieldset>
        <div id="osm-report-error" class="form-alert d-none" role="alert"></div>
        <button id="osm-report-submit" class="btn btn-primary w-100" type="submit" disabled>Submit report</button>
      </form>
    </section>
    <p class="osm-attribution">Place details from <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.</p>`;
  detailsPanel.classList.remove("d-none");
  renderOsmReports(reports);
  renderOsmReportOptions();
  document.getElementById("osm-report-form").addEventListener("submit", submitOsmReport);

  if (miniMap) miniMap.remove();
  miniMap = window.L.map("osm-mini-map", { scrollWheelZoom: false, dragging: false, zoomControl: false }).setView([latitude, longitude], 16);
  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
  }).addTo(miniMap);
  window.L.circleMarker([latitude, longitude], { radius: 8, color: markerColor(2), fillColor: markerColor(2), fillOpacity: .9 }).addTo(miniMap);
  if (selectedMarker) selectedMarker.remove();
  selectedMarker = window.L.circleMarker([latitude, longitude], {
    radius: 10,
    color: markerColor(2),
    fillColor: markerColor(2),
    fillOpacity: .88,
    weight: 3
  }).bindPopup(`<strong>${escapeHtml(name)}</strong><br>${escapeHtml(category)} · ${escapeHtml(type.replaceAll("_", " "))}`).addTo(map);
  map.setView([latitude, longitude], 15);
  window.setTimeout(() => miniMap.invalidateSize(), 0);
  setMapStatus("", false);
  if (openReport) {
    reportPanel.classList.remove("d-none");
    document.getElementById("osm-report-open").setAttribute("aria-expanded", "true");
  }
  detailsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

async function submitOsmReport(event) {
  event.preventDefault();
  const errorNode = document.getElementById("osm-report-error");
  if (!getUser()) {
    try {
      sessionStorage.setItem(pendingPlaceKey, JSON.stringify(selectedOsmPlace.result));
    } catch (error) {
      errorNode.textContent = `Your place could not be saved for sign in. ${error.message}`;
      errorNode.classList.remove("d-none");
      return;
    }
    window.location.assign(`login.html?next=${encodeURIComponent("index.html")}`);
    return;
  }
  if (selectedCrowdLevel === null) return;
  reportSubmit.disabled = true;
  reportSubmit.textContent = REQUIRE_LOCATION_FOR_REPORTS ? "Checking location…" : "Submitting…";
  errorNode.classList.add("d-none");
  try {
    const location = await verifyReportLocation(selectedOsmPlace.latitude, selectedOsmPlace.longitude);
    if (location.message) {
      errorNode.textContent = location.message;
      errorNode.classList.remove("d-none");
      return;
    }
    reportSubmit.textContent = "Submitting…";
    mock.createOsmReport(selectedOsmPlace.osmKey, selectedOsmPlace, selectedCrowdLevel, getUser(), location.verified);
    selectedCrowdLevel = null;
    reportPanel.classList.add("d-none");
    document.getElementById("osm-report-open").setAttribute("aria-expanded", "false");
    showToast("Your crowd report has been submitted.");
    renderOsmReports(mock.listOsmReports(selectedOsmPlace.osmKey));
    renderOsmReportOptions();
  } catch (error) {
    errorNode.textContent = error.message || "Your report could not be submitted. Please try again.";
    errorNode.classList.remove("d-none");
  } finally {
    reportSubmit.textContent = "Submit report";
    reportSubmit.disabled = selectedCrowdLevel === null;
  }
}

async function searchNominatim(query) {
  const wait = Math.max(0, 1000 - (Date.now() - lastNominatimRequest));
  if (wait) await new Promise((resolve) => window.setTimeout(resolve, wait));
  lastNominatimRequest = Date.now();
  const parameters = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    limit: "5",
    q: query
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${parameters.toString()}`, {
    headers: { Accept: "application/json" }
  });
  if (!response.ok) throw new Error(response.status === 429
    ? "OpenStreetMap search is busy. Wait a moment and try again."
    : "The place search could not be completed. Try again.");
  const results = await response.json();
  if (!Array.isArray(results)) throw new Error("The place search returned an unexpected response.");
  return results;
}

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = document.getElementById("map-place-query").value.trim();
  if (!query) return;
  searchButton.disabled = true;
  searchButton.textContent = "Searching…";
  searchResults.replaceChildren();
  detailsPanel.classList.add("d-none");
  setMapStatus("Searching OpenStreetMap…");
  try {
    const results = await searchNominatim(query);
    if (!results.length) {
      setMapStatus("No places found. Try a nearby street, landmark, or address.");
      return;
    }
    setMapStatus(`${results.length} ${results.length === 1 ? "place" : "places"} found. Select one to see its details.`);
    searchResults.innerHTML = results.map((result, index) => `<button class="map-result" type="button" data-result="${index}">
      <strong>${escapeHtml(result.name || result.display_name?.split(",")[0] || "Unnamed place")}</strong>
      <span>${escapeHtml(result.display_name || "Address not available")}</span>
      <small>${escapeHtml(result.category || "Place")} · ${escapeHtml(String(result.type || "").replaceAll("_", " "))}</small>
    </button>`).join("");
    searchResults.querySelectorAll("[data-result]").forEach((button) => {
      button.addEventListener("click", () => selectOsmPlace(results[Number(button.dataset.result)]));
    });
  } catch (error) {
    setMapStatus(error.message || "The place search could not be completed. Try again.", true);
  } finally {
    searchButton.disabled = false;
    searchButton.textContent = "Search";
  }
});

document.getElementById("list-view-button").addEventListener("click", () => setView("list"));
document.getElementById("map-view-button").addEventListener("click", () => setView("map"));
document.getElementById("near-me-button").addEventListener("click", () => {
  if (nearMeActive) {
    nearMeActive = false;
    sortSelect.disabled = false;
    places = places.map(({ distanceKm, ...place }) => place);
    document.getElementById("near-me-button").textContent = "Near me";
    locationMessage.classList.add("d-none");
    renderPlaces();
    return;
  }
  findNearbyPlaces();
});
list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-favorite-id]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  try {
    toggleFavorite(decodeURIComponent(button.dataset.favoriteId));
    renderChips();
    renderPlaces();
  } catch (error) {
    showToast(error.message || "This place could not be saved.", "error");
  }
});
search.addEventListener("input", () => {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(renderPlaces, 180);
});
sortSelect.addEventListener("change", renderPlaces);
chips.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  const savedButton = event.target.closest("[data-saved]");
  if (savedButton) {
    savedFilter = !savedFilter;
    selectedCategory = "";
    renderChips();
    renderPlaces();
    return;
  }
  if (!button) return;
  savedFilter = false;
  selectedCategory = button.dataset.category;
  chips.querySelectorAll("[data-category]").forEach((chip) => chip.setAttribute("aria-pressed", String(chip === button)));
  renderPlaces();
});

async function loadPlaces() {
  state.classList.remove("d-none", "error-state");
  state.textContent = "Loading places…";
  list.classList.add("d-none");
  try {
    places = await getPlaces();
    if (!Array.isArray(places)) throw new Error("The places response was not in the expected format.");
    renderSummary();
    renderChips();
    renderPlaces();
    try {
      const pendingResult = sessionStorage.getItem(pendingPlaceKey);
      if (pendingResult) {
        sessionStorage.removeItem(pendingPlaceKey);
        setView("map");
        selectOsmPlace(JSON.parse(pendingResult), true);
      }
    } catch (error) {
      sessionStorage.removeItem(pendingPlaceKey);
      setMapStatus(`The place saved for reporting could not be restored. ${error.message}`, true);
      setView("map");
    }
  } catch (error) {
    showViewError(state, error.message || "Places could not be loaded.", loadPlaces);
  }
}

loadPlaces();
