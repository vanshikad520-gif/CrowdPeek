import { getBestTime, getCurrentCrowd, getPlace } from "./api.js";
import { renderShell, showViewError, statusBadge, statusInfo } from "./ui.js";

renderShell("places");

const state = document.getElementById("compare-state");
const content = document.getElementById("compare-content");
const params = new URLSearchParams(window.location.search);
const ids = [params.get("a"), params.get("b")];

function showInvalid(message = "Choose two valid places to compare.") {
  state.replaceChildren();
  const text = document.createElement("p");
  text.className = "mb-2";
  text.textContent = message;
  const link = document.createElement("a");
  link.className = "btn btn-primary";
  link.href = "index.html";
  link.textContent = "Back to Places";
  state.append(text, link);
  state.classList.remove("d-none", "error-state");
}

function renderPlace(place, crowdData, bestTimeRows, quieter) {
  const crowd = Number(crowdData.crowd ?? crowdData.crowdLevel ?? crowdData.percentage);
  if (!Number.isFinite(crowd)) throw new Error("The current crowd response is not in the expected format.");
  if (!Array.isArray(bestTimeRows)) throw new Error("Typical visit times are currently unavailable.");
  const status = statusInfo(crowd);
  const quietest = bestTimeRows.find((item) => item.period === "Quietest");
  const busiest = bestTimeRows.find((item) => item.period === "Busiest");
  if (!quietest || !busiest) throw new Error("Typical visit times are currently unavailable.");

  const card = document.createElement("article");
  card.className = "panel compare-card";
  const heading = document.createElement("div");
  heading.className = "compare-card-heading";
  const title = document.createElement("div");
  const name = document.createElement("h2");
  name.className = "compare-place-name";
  name.textContent = place.name;
  const location = document.createElement("p");
  location.className = "compare-place-meta";
  location.textContent = `${place.category} · ${place.sector}`;
  title.append(name, location);
  heading.append(title);
  if (quieter) {
    const tag = document.createElement("span");
    tag.className = "quieter-tag";
    tag.textContent = "Quieter right now";
    heading.append(tag);
  }
  const crowdSummary = document.createElement("div");
  crowdSummary.className = "compare-crowd-summary";
  const percent = document.createElement("strong");
  percent.className = `compare-percent status-${status.level}`;
  percent.textContent = `${crowd}%`;
  const badge = document.createElement("span");
  badge.innerHTML = statusBadge(crowd);
  crowdSummary.append(percent, badge);

  const meter = document.createElement("div");
  meter.className = `level-scale status-${status.level} compare-meter`;
  meter.setAttribute("role", "img");
  meter.setAttribute("aria-label", `Current crowd level: ${status.label}, step ${status.level + 1} of 5`);
  for (let level = 0; level < 5; level += 1) {
    const segment = document.createElement("span");
    segment.className = `level-segment${level <= status.level ? " is-filled" : ""}`;
    meter.append(segment);
  }

  const details = document.createElement("dl");
  details.className = "detail-list compare-details";
  const reports = document.createElement("div");
  const reportsLabel = document.createElement("dt");
  reportsLabel.textContent = "Reports today";
  const reportsValue = document.createElement("dd");
  reportsValue.textContent = String(crowdData.reportsToday ?? crowdData.reportCount ?? "—");
  reports.append(reportsLabel, reportsValue);
  const quietRow = document.createElement("div");
  const quietLabel = document.createElement("dt");
  quietLabel.textContent = "Quietest time";
  const quietValue = document.createElement("dd");
  quietValue.textContent = quietest.window;
  quietRow.append(quietLabel, quietValue);
  const busyRow = document.createElement("div");
  const busyLabel = document.createElement("dt");
  busyLabel.textContent = "Busiest time";
  const busyValue = document.createElement("dd");
  busyValue.textContent = busiest.window;
  busyRow.append(busyLabel, busyValue);
  details.append(reports, quietRow, busyRow);
  card.append(heading, crowdSummary, meter, details);
  return card;
}

async function loadComparison() {
  if (ids.some((id) => !id?.trim())) {
    showInvalid("Add two place IDs to the link to compare places.");
    return;
  }
  try {
    const results = await Promise.all(ids.map(async (id) => {
      const [place, crowd, bestTime] = await Promise.all([
        getPlace(id),
        getCurrentCrowd(id),
        getBestTime(id)
      ]);
      return { place, crowd, bestTime };
    }));
    if (results.some(({ place, crowd, bestTime }) => !place || !crowd || !bestTime)) {
      showInvalid();
      return;
    }
    const crowds = results.map(({ crowd }) => Number(crowd.crowd ?? crowd.crowdLevel ?? crowd.percentage));
    if (crowds.some((value) => !Number.isFinite(value))) throw new Error("Current crowd levels are not available.");
    const quieterIndex = crowds[0] === crowds[1] ? -1 : crowds[0] < crowds[1] ? 0 : 1;
    content.replaceChildren(...results.map(({ place, crowd, bestTime }, index) =>
      renderPlace(place, crowd, bestTime, index === quieterIndex)
    ));
    content.classList.remove("d-none");
    state.classList.add("d-none");
    document.title = `${results[0].place.name} and ${results[1].place.name} | CrowdPeek`;
  } catch (error) {
    if (error.status === 404) {
      showInvalid();
      return;
    }
    showViewError(state, error.message || "These places could not be compared.", loadComparison);
  }
}

loadComparison();
