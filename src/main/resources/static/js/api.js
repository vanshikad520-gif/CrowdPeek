import * as mock from "./mockData.js";
import { getToken, getUser, logout } from "./auth.js";

export const USE_MOCK = true;

function unauthorizedRedirect() {
  logout();
  const returnTo = `${window.location.pathname.split("/").pop()}${window.location.search}`;
  window.location.assign(`login.html?returnTo=${encodeURIComponent(returnTo)}`);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(path, { ...options, headers });
  if (response.status === 401) {
    unauthorizedRedirect();
    throw new Error("Your session has expired. Please sign in again.");
  }
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const error = new Error(body && typeof body === "object" && body.message ? body.message : `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return body;
}

export async function login(email, password) {
  if (!USE_MOCK) return request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  if (!email || !password) throw new Error("Enter your email address and password.");
  return mock.demoLogin(email);
}

export async function register(name, email, password) {
  if (!USE_MOCK) return request("/api/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
  return mock.registerUser(name, email);
}

export async function getPlaces(query = "", category = "") {
  if (!USE_MOCK) {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("category", category);
    return request(`/api/places?${params.toString()}`);
  }
  return mock.listPlaces(query, category);
}

export async function getPlace(id) {
  if (!USE_MOCK) return request(`/api/places/${encodeURIComponent(id)}`);
  return mock.findPlace(id);
}

export async function getCurrentCrowd(id) {
  if (!USE_MOCK) return request(`/api/crowd/${encodeURIComponent(id)}/current`);
  return mock.currentCrowd(id);
}

export async function submitReport(placeId, level, verified = false) {
  if (!USE_MOCK) return request("/api/crowd/report", { method: "POST", body: JSON.stringify({ placeId, crowdLevel: level, verified }) });
  const user = getUser();
  if (!user) {
    unauthorizedRedirect();
    throw new Error("Sign in to submit a crowd report.");
  }
  return mock.createReport(placeId, level, user, verified);
}

export async function getHistory(id, dayType) {
  if (!USE_MOCK) return request(`/api/crowd/${encodeURIComponent(id)}/history`);
  return mock.history(id, dayType);
}

export async function getBestTime(id, dayType) {
  if (!USE_MOCK) return request(`/api/crowd/${encodeURIComponent(id)}/best-time`);
  return mock.bestTime(id, dayType);
}

export async function getMyReports() {
  if (!USE_MOCK) return request("/api/crowd/my-reports");
  const user = getUser();
  if (!user) {
    unauthorizedRedirect();
    throw new Error("Sign in to view your reports.");
  }
  return mock.myReports(user);
}

export { mock };
