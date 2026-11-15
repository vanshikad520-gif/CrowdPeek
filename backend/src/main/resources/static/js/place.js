import { getBestTime, getCurrentCrowd, getHistory, getPlace, getPlaces, submitReport } from "./api.js";
import { getUser } from "./auth.js";
import { isFavorite, toggleFavorite } from "./favorites.js";
import { REQUIRE_LOCATION_FOR_REPORTS } from "./config.js";
import { verifyReportLocation } from "./location.js";
import { escapeHtml, formatUpdated, renderShell, showToast, showViewError, statusBadge, statusInfo } from "./ui.js";

renderShell("places");

const id = new URLSearchParams(window.location.search).get("id");
const state = document.getElementById("place-state");
const content = document.getElementById("place-content");
const reportPanel = document.getElementById("report-panel");
const reportOpen = document.getElementById("report-open");
const shareButton = document.getElementById("place-share-button");
const whatsappLink = document.getElementById("place-whatsapp-link");
const reportForm = document.getElementById("report-form");
const reportOptions = document.getElementById("report-options");
const reportSubmit = document.getElementById("report-submit");
const compareSelect = document.getElementById("compare-place-select");
const compareButton = document.getElementById("compare-place-button");
const weekdayButton = document.getElementById("weekday-button");
const weekendButton = document.getElementById("weekend-button");
let selectedDayType = [0, 6].includes(new Date().getDay()) ? "weekend" : "weekday";
let chart;
let place;
let selectedLevel = null;
let currentShareText = "";

compareSelect.addEventListener("change", () => {
  compareButton.disabled = !compareSelect.value;
});
compareButton.addEventListener("click", () => {
  if (!compareSelect.value || !id) return;
  const params = new URLSearchParams({ a: id, b: compareSelect.value });
  window.location.assign(`compare.html?${params.toString()}`);
});

const levels = [
  { name: "Very quiet", value: 10, index: 0 },
  { name: "Quiet", value: 30, index: 1 },
  { name: "Moderate", value: 50, index: 2 },
  { name: "Busy", value: 70, index: 3 },
  { name: "Very crowded", value: 90, index: 4 }
];

function showFailure(error) {
  showViewError(state, error.message || "Place details could not be loaded.", loadPlace);
}

function requireLogin() {
  const next = `place.html?id=${encodeURIComponent(id || "")}`;
  window.location.assign(`login.html?next=${encodeURIComponent(next)}`);
}

function renderReportOptions() {
  reportOptions.innerHTML = `<legend class="visually-hidden">Select current crowd level</legend>${levels.map((level) => `<button class="report-option status-${level.index}" type="button" data-level="${level.value}" aria-pressed="false"><span class="status-dot" aria-hidden="true"></span>${level.name}</button>`).join("")}`;
  reportOptions.querySelectorAll("[data-level]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedLevel = Number(button.dataset.level);
      reportOptions.querySelectorAll("[data-level]").forEach((option) => option.setAttribute("aria-pressed", String(option === button)));
      reportSubmit.disabled = false;
      document.getElementById("report-error").classList.add("d-none");
    });
  });
  selectedLevel = null;
  reportSubmit.disabled = true;
}

function renderChart(history) {
  if (!window.Chart || !history) throw new Error("The crowd chart is unavailable right now.");
  chart?.destroy();
  const styles = getComputedStyle(document.documentElement);
  const brand = styles.getPropertyValue("--brand").trim();
  const dim = styles.getPropertyValue("--dim").trim();
  const line = styles.getPropertyValue("--line").trim();
  const card = styles.getPropertyValue("--card").trim();
  chart = new window.Chart(document.getElementById("crowd-chart"), {
    type: "line",
    data: {
      labels: history.labels,
      datasets: [{
        label: "Average crowd",
        data: history.values,
        borderColor: brand,
        backgroundColor: brand,
        borderWidth: 2,
        tension: 0.25,
        fill: false,
        pointRadius: history.values.map((_, index) => index === history.currentIndex ? 7 : 2),
        pointHoverRadius: 7,
        pointBackgroundColor: history.values.map((_, index) => index === history.currentIndex ? brand : card),
        pointBorderColor: brand
      }]
    },
    options: {
      animation: false,
      maintainAspectRatio: false,
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.parsed.y}%` } } },
      scales: {
        x: { grid: { display: false }, ticks: { color: dim, maxRotation: 0, autoSkip: false, font: { family: "Manrope", size: 12 } } },
        y: { min: 0, max: 100, ticks: { stepSize: 20, color: dim, callback: (value) => `${value}%`, font: { family: "Manrope", size: 12 } }, grid: { color: line } }
      }
    }
  });
}

function renderBestTime(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Typical visit times are currently unavailable.");
  const titles = ["Quietest", "Also good", "Busiest"];
  document.getElementById("best-time-body").innerHTML = rows.map((item, index) => `<article class="best-time-card">
    <h3>${titles[index] || escapeHtml(item.period)}</h3>
    <p class="best-time-window tabular">${escapeHtml(item.window)}</p>
    <p class="best-time-range tabular">Expected ${escapeHtml(item.min)}–${escapeHtml(item.max)}%</p>
    ${statusBadge(item.crowd)}
  </article>`).join("");
}

function formatHour(hour) {
  const suffix = hour < 12 ? "AM" : "PM";
  return `${hour % 12 || 12} ${suffix}`;
}

function renderVisitPlanner(history, preserveSelection = false) {
  if (!Array.isArray(history?.labels) || !Array.isArray(history.values) || history.labels.length !== history.values.length || history.labels.length === 0) {
    throw new Error("Typical crowd estimates are currently unavailable.");
  }
  const select = document.getElementById("visit-time-select");
  const previousSelection = preserveSelection ? select.value : "";
  const firstHour = Number(history.labels[0].match(/\d+/)?.[0]);
  const firstPeriod = history.labels[0].match(/[AP]M/i)?.[0].toUpperCase();
  if (!Number.isFinite(firstHour) || !firstPeriod) throw new Error("Typical crowd times are not in the expected format.");
  const startHour = firstHour % 12 + (firstPeriod === "PM" ? 12 : 0);
  const hourValues = new Map(history.labels.map((label, index) => {
    const match = label.match(/^(\d+)\s*(AM|PM)$/i);
    if (!match) throw new Error("Typical crowd times are not in the expected format.");
    const hour = Number(match[1]) % 12 + (match[2].toUpperCase() === "PM" ? 12 : 0);
    const nextHour = hour < startHour ? hour + 24 : hour;
    return [nextHour, Number(history.values[index])];
  }));
  const hours = [];
  for (let hour = startHour; hour <= 22; hour += 1) {
    if (hourValues.has(hour)) hours.push(hour);
    else {
      const lower = Math.floor(hour / 2) * 2;
      const upper = lower + 2;
      const lowerValue = hourValues.get(lower);
      const upperValue = hourValues.get(upper);
      if (Number.isFinite(lowerValue) && Number.isFinite(upperValue)) {
        hours.push(hour);
        hourValues.set(hour, Math.round(lowerValue + (upperValue - lowerValue) * ((hour - lower) / 2)));
      }
    }
  }
  if (!hours.length) throw new Error("Typical crowd estimates are currently unavailable.");
  select.innerHTML = hours.map((hour) => `<option value="${hour}">${formatHour(hour)}</option>`).join("");
  if (previousSelection && hours.includes(Number(previousSelection))) {
    select.value = previousSelection;
  } else {
    const now = new Date();
    const nextHour = now.getHours() + 1;
    select.value = String(hours.find((hour) => hour >= nextHour) ?? hours[0]);
  }
  const updatePlan = () => {
    const selectedHour = Number(select.value);
    const crowd = hourValues.get(selectedHour);
    if (!Number.isFinite(crowd)) throw new Error("The selected typical crowd estimate is unavailable.");
    const status = statusInfo(crowd);
    document.getElementById("visit-crowd-percent").textContent = `${crowd}%`;
    document.getElementById("visit-crowd-percent").className = `visit-crowd-percent tabular ${status.className}`;
    document.getElementById("visit-status").innerHTML = statusBadge(crowd);
    const quieterHour = hours
      .filter((hour) => hour !== selectedHour && Math.abs(hour - selectedHour) <= 2 && hourValues.get(hour) < crowd)
      .sort((a, b) => Math.abs(a - selectedHour) - Math.abs(b - selectedHour))[0];
    const advice = `Expected to be ${status.label.toLowerCase()} at ${formatHour(selectedHour)}. ${crowd <= 40 ? "A good time to go." : "Crowd levels may change."}`;
    document.getElementById("visit-advice").textContent = quieterHour === undefined
      ? advice
      : `${advice} ${formatHour(quieterHour)} may be quieter (${hourValues.get(quieterHour)}%).`;
  };
  select.onchange = updatePlan;
  updatePlan();
}

function updateDayTypeButtons() {
  const isWeekday = selectedDayType === "weekday";
  weekdayButton.setAttribute("aria-pressed", String(isWeekday));
  weekendButton.setAttribute("aria-pressed", String(!isWeekday));
  weekdayButton.classList.toggle("is-selected", isWeekday);
  weekendButton.classList.toggle("is-selected", !isWeekday);
  const dayLabel = isWeekday ? "Weekday" : "Weekend";
  document.getElementById("typical-subtitle").textContent = `Average ${dayLabel.toLowerCase()} crowd by time of day`;
  document.querySelector("#plan-visit-heading + p").textContent =
    `Expected, based on typical ${isWeekday ? "weekdays" : "weekends"}`;
}

async function selectDayType(dayType) {
  if (dayType === selectedDayType) return;
  selectedDayType = dayType;
  updateDayTypeButtons();
  try {
    const [historyData, bestTimeData] = await Promise.all([
      getHistory(id, selectedDayType),
      getBestTime(id, selectedDayType)
    ]);
    renderChart(historyData);
    renderBestTime(bestTimeData);
    renderVisitPlanner(historyData, true);
  } catch (error) {
    showToast(error.message || "Typical crowd data could not be loaded.", "error");
  }
}

function renderCurrent(current, bestTimeRows) {
  const crowd = Number(current.crowd ?? current.crowdLevel ?? current.percentage);
  if (!Number.isFinite(crowd)) throw new Error("The current crowd response is not in the expected format.");
  const status = statusInfo(crowd);
  currentShareText = `${place.name} is ${status.label} (${crowd}%) right now. Checked on CrowdPeek\n${window.location.href}`;
  whatsappLink.href = `https://wa.me/?text=${encodeURIComponent(currentShareText)}`;
  const percent = document.getElementById("current-percent");
  percent.textContent = `${crowd}%`;
  percent.className = `crowd-percent ${status.className}`;
  document.getElementById("current-status").innerHTML = statusBadge(crowd);
  const scale = document.getElementById("level-scale");
  scale.className = `level-scale ${status.className}`;
  scale.innerHTML = [0, 1, 2, 3, 4].map((level) => `<span class="level-segment ${level <= status.level ? "is-filled" : ""}"></span>`).join("");
  scale.setAttribute("aria-label", `Current crowd level: ${status.label}, step ${status.level + 1} of 5`);
  document.getElementById("reports-today").textContent = String(current.reportsToday ?? current.reportCount ?? "—");
  const verifiedCount = Number(current.verifiedReportsToday ?? current.verifiedReportCount ?? 0);
  const totalCount = Number(current.reportsToday ?? current.reportCount ?? 0);
  document.getElementById("verified-summary").textContent = `${verifiedCount} of ${totalCount} reports verified`;
  const recentReportCount = Number(current.reportsInLast3Hours ?? 0);
  const confidence = current.confidence || "Low";
  document.getElementById("crowd-basis").textContent = recentReportCount > 0
    ? `Based on ${recentReportCount} reports in the last 3 hours · ${confidence} confidence`
    : `Estimate based on typical days · ${confidence} confidence`;
  document.getElementById("last-updated").textContent = formatUpdated(current.updatedMinutes ?? 0);
  const quietest = bestTimeRows[0];
  const advice = crowd <= 40
    ? "Good time to go. It’s quiet right now."
    : quietest && Number(quietest.crowd) < crowd
      ? `${status.label} right now. Try ${quietest.window} (about ${quietest.crowd}%).`
      : `${status.label} right now. Crowd levels may change during the day.`;
  document.getElementById("crowd-advice").textContent = advice;
}

async function loadPlace() {
  state.classList.remove("d-none", "error-state");
  state.textContent = "Loading place details…";
  content.classList.add("d-none");
  if (!id) {
    showViewError(state, "A place was not specified. Return to Places and select a location.");
    return;
  }
  try {
    const [placeData, crowdData, historyData, bestTimeData, placesData] = await Promise.all([
      getPlace(id), getCurrentCrowd(id), getHistory(id, selectedDayType), getBestTime(id, selectedDayType), getPlaces()
    ]);
    if (!placeData || !crowdData) {
      showViewError(state, "This place could not be found. Return to Places to choose another location.");
      return;
    }
    place = placeData;
    if (!Array.isArray(placesData)) throw new Error("The place list is not in the expected format.");
    compareSelect.replaceChildren(new Option("Choose a place", ""));
    placesData
      .filter((item) => String(item.id) !== String(place.id))
      .forEach((item) => {
        const option = new Option(`${item.name} — ${item.category}, ${item.sector}`, String(item.id));
        compareSelect.add(option);
      });
    compareButton.disabled = true;
    document.title = `${place.name} | CrowdPeek`;
    document.getElementById("place-breadcrumb").textContent = place.name;
    document.getElementById("place-name").textContent = place.name;
    document.getElementById("place-meta").textContent = `${place.category} - ${place.sector}`;
    document.getElementById("report-location-note").textContent = REQUIRE_LOCATION_FOR_REPORTS
      ? "We check that you are near the place."
      : "Location checks are disabled for this demo.";
    const favoriteButton = document.getElementById("place-favorite-button");
    const saved = isFavorite(place.id);
    favoriteButton.setAttribute("aria-pressed", String(saved));
    favoriteButton.setAttribute("aria-label", saved ? "Remove from saved places" : "Save place");
    favoriteButton.querySelector("span").textContent = saved ? "Saved" : "Save";
    renderCurrent(crowdData, bestTimeData);
    updateDayTypeButtons();
    renderVisitPlanner(historyData);
    renderChart(historyData);
    renderBestTime(bestTimeData);
    content.classList.remove("d-none");
    state.classList.add("d-none");
  } catch (error) {
    showFailure(error);
  }
}

async function handleReportSubmit(event) {
  event.preventDefault();
  const button = reportSubmit;
  const errorNode = document.getElementById("report-error");
  if (!getUser()) {
    requireLogin();
    return;
  }
  if (selectedLevel === null) return;
  button.disabled = true;
  button.textContent = REQUIRE_LOCATION_FOR_REPORTS ? "Checking location…" : "Submitting…";
  errorNode.classList.add("d-none");
  try {
    const location = await verifyReportLocation(place.latitude, place.longitude);
    if (location.message) {
      errorNode.textContent = location.message;
      errorNode.classList.remove("d-none");
      return;
    }
    button.textContent = "Submitting…";
    await submitReport(id, selectedLevel, location.verified);
    reportPanel.classList.add("d-none");
    reportOpen.setAttribute("aria-expanded", "false");
    button.textContent = "Submit report";
    showToast("Your crowd report has been submitted.");
    await loadPlace();
  } catch (error) {
    errorNode.textContent = error.status === 409 || error.status === 429
      ? "You have already reported this place recently. Please try again later."
      : error.message || "Your report could not be submitted. Please try again.";
    errorNode.classList.remove("d-none");
  } finally {
    button.disabled = selectedLevel === null;
    button.textContent = "Submit report";
  }
}

reportOpen.addEventListener("click", () => {
  if (!getUser()) {
    requireLogin();
    return;
  }
  const isOpening = reportPanel.classList.contains("d-none");
  reportPanel.classList.toggle("d-none", !isOpening);
  reportOpen.setAttribute("aria-expanded", String(isOpening));
  if (isOpening) reportOptions.querySelector("[data-level]")?.focus();
});
weekdayButton.addEventListener("click", () => selectDayType("weekday"));
weekendButton.addEventListener("click", () => selectDayType("weekend"));
shareButton.addEventListener("click", async () => {
  if (!currentShareText) return;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text: currentShareText });
    } catch (error) {
      if (error.name !== "AbortError") showToast(error.message || "Sharing could not be completed.", "error");
    }
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(currentShareText);
    } else {
      const input = document.createElement("textarea");
      input.value = currentShareText;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      if (!copied) throw new Error("Clipboard access is unavailable.");
    }
    showToast("Link copied");
  } catch (error) {
    showToast(error.message || "The share text could not be copied.", "error");
  }
});
reportForm.addEventListener("submit", handleReportSubmit);
document.getElementById("place-favorite-button").addEventListener("click", (event) => {
  const button = event.currentTarget;
  try {
    const saved = toggleFavorite(id);
    button.setAttribute("aria-pressed", String(saved));
    button.setAttribute("aria-label", saved ? "Remove from saved places" : "Save place");
    button.querySelector("span").textContent = saved ? "Saved" : "Save";
  } catch (error) {
    showToast(error.message || "This place could not be saved.", "error");
  }
});
renderReportOptions();
loadPlace();
