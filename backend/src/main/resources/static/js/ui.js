import { getUser, logout } from "./auth.js";
import { mock, USE_MOCK } from "./api.js";

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

export function renderShell(activePage = "") {
  const user = getUser();
  const currentFile = window.location.pathname.split("/").pop();
  const navRoot = document.getElementById("site-nav");
  if (navRoot) {
    navRoot.innerHTML = `<nav class="navbar navbar-expand-md site-navbar" aria-label="Main navigation">
      <div class="container app-container">
        <a class="navbar-brand" href="index.html"><img src="img/logo-mark.svg" width="28" height="28" alt="" aria-hidden="true"><span>CrowdPeek</span></a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#main-nav" aria-controls="main-nav" aria-expanded="false" aria-label="Toggle navigation"><span class="navbar-toggler-icon"></span></button>
        <div class="collapse navbar-collapse" id="main-nav">
          <ul class="navbar-nav me-auto"><li class="nav-item"><a class="nav-link ${activePage === "places" ? "active" : ""}" ${activePage === "places" ? 'aria-current="page"' : ""} href="index.html">Places</a></li>
          <li class="nav-item"><a class="nav-link ${activePage === "reports" ? "active" : ""}" ${activePage === "reports" ? 'aria-current="page"' : ""} href="my-reports.html">My reports</a></li></ul>
          <div class="navbar-account">${user
            ? `<span class="account-name">${escapeHtml(user.name)}</span><button class="btn btn-outline-primary btn-sm" id="sign-out" type="button">Log out</button>`
            : `<a class="nav-auth-link ${currentFile === "login.html" ? "active" : ""}" ${currentFile === "login.html" ? 'aria-current="page"' : ""} href="login.html">Sign in</a><a class="btn btn-outline-primary btn-sm ${currentFile === "register.html" ? "active" : ""}" ${currentFile === "register.html" ? 'aria-current="page"' : ""} href="register.html">Register</a>`}</div>
        </div>
      </div>
    </nav>`;
    document.getElementById("sign-out")?.addEventListener("click", () => {
      logout();
      window.location.assign("index.html");
    });
  }
  const footer = document.getElementById("site-footer");
  if (footer) footer.innerHTML = `<footer class="site-footer"><div class="container app-container footer-content"><span>© ${new Date().getFullYear()} CrowdPeek · Chandigarh</span>${USE_MOCK ? '<span class="demo-note">Demo data</span>' : ""}</div></footer>`;
  if (!document.getElementById("toast-root")) {
    const root = document.createElement("div");
    root.id = "toast-root";
    root.className = "toast-container position-fixed bottom-0 end-0 p-3";
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "true");
    document.body.append(root);
  }
}

export function statusInfo(value) {
  const status = mock.crowdStatus(value);
  return { ...status, className: `status-${status.level}` };
}

export function statusBadge(value) {
  const status = statusInfo(value);
  return `<span class="status-badge ${status.className}"><span class="status-dot" aria-hidden="true"></span>${escapeHtml(status.label)}</span>`;
}

export function formatUpdated(minutes) {
  const count = Number(minutes);
  if (!Number.isFinite(count) || count < 1) return "Just now";
  if (count === 1) return "1 min ago";
  if (count < 60) return `${Math.round(count)} min ago`;
  const hours = Math.floor(count / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}

export function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function showToast(message, type = "success") {
  const root = document.getElementById("toast-root");
  if (!root || !window.bootstrap?.Toast) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "toast-error" : ""}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  toast.innerHTML = `<div class="d-flex"><div class="toast-body">${escapeHtml(message)}</div><button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  root.append(toast);
  const instance = window.bootstrap.Toast.getOrCreateInstance(toast, { delay: 4500 });
  toast.addEventListener("hidden.bs.toast", () => toast.remove(), { once: true });
  instance.show();
}

export function showViewError(element, message, retryAction) {
  element.classList.add("error-state");
  element.replaceChildren();
  const text = document.createElement("p");
  text.textContent = message;
  text.className = "mb-2";
  element.append(text);
  if (retryAction) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-outline-primary";
    button.textContent = "Try again";
    button.addEventListener("click", retryAction);
    element.append(button);
  }
  element.classList.remove("d-none");
}
