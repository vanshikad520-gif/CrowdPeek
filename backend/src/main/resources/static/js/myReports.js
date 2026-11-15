import { getMyReports } from "./api.js";
import { requireAuth } from "./auth.js";
import { escapeHtml, formatDateTime, renderShell, showViewError, statusBadge } from "./ui.js";

renderShell("reports");
const state = document.getElementById("reports-state");
const wrap = document.getElementById("reports-wrap");
const empty = document.getElementById("reports-empty");
const body = document.getElementById("reports-body");

async function loadReports() {
  state.classList.remove("d-none", "error-state");
  state.textContent = "Loading your reports…";
  wrap.classList.add("d-none");
  empty.classList.add("d-none");
  try {
    const reports = await getMyReports();
    if (!Array.isArray(reports)) throw new Error("The reports response was not in the expected format.");
    if (reports.length === 0) {
      state.classList.add("d-none");
      empty.classList.remove("d-none");
      return;
    }
    body.innerHTML = reports.map((report) => {
      const placeName = report.place?.name || report.placeName || "Unknown place";
      const placeLink = report.place?.id
        ? `<a href="place.html?id=${encodeURIComponent(report.place.id)}">${escapeHtml(placeName)}</a>`
        : escapeHtml(placeName);
      return `<tr>
      <td data-label="Place">${placeLink}</td>
      <td data-label="Level">${statusBadge(Number(report.crowdLevel ?? report.level))}${report.verified === true ? '<span class="verified-tag">Verified on site</span>' : ""}</td>
      <td data-label="Date and time" class="tabular">${escapeHtml(formatDateTime(report.createdAt || report.reportedAt))}</td>
    </tr>`;
    }).join("");
    wrap.classList.remove("d-none");
    state.classList.add("d-none");
  } catch (error) {
    showViewError(state, error.message || "Your reports could not be loaded.", loadReports);
  }
}

if (requireAuth()) loadReports();
