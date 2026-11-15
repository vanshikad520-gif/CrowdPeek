const TOKEN_KEY = "crowdpeek.token";
const USER_KEY = "crowdpeek.user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
    return user && typeof user.email === "string" ? user : null;
  } catch (error) {
    console.error("Could not read the saved CrowdPeek account.", error);
    return null;
  }
}

export function saveSession(payload) {
  const token = payload?.token || payload?.accessToken;
  const user = payload?.user || payload?.account;
  if (!token || !user || typeof user.email !== "string") {
    throw new Error("The sign-in response did not include a valid account and access token.");
  }
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify({ name: user.name || user.fullName || user.email, email: user.email }));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function requireAuth() {
  if (getToken() && getUser()) return true;
  const file = window.location.pathname.split("/").pop() || "index.html";
  const placeId = new URLSearchParams(window.location.search).get("id");
  const next = file === "place.html" && placeId ? `place.html?id=${placeId}` : file;
  window.location.replace(`login.html?next=${encodeURIComponent(next)}`);
  return false;
}

export function postLoginDestination() {
  const params = new URLSearchParams(window.location.search);
  const destination = params.get("next") || params.get("returnTo");
  if (!destination) return "index.html";
  const match = destination.match(/^([a-z0-9-]+\.html)(?:\?id=([a-z0-9-]+))?$/i);
  return match ? `${match[1]}${match[2] ? `?id=${match[2]}` : ""}` : "index.html";
}
