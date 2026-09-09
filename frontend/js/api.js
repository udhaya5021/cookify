// Shared API client — every page includes this before its own script.
// Relative (same-origin) rather than a hardcoded host:port, since the
// backend serves the frontend itself in dev (see backend/app/main.py) —
// this also means it keeps working unchanged in a real deployment behind
// any domain/port, not just localhost.
const API_BASE = "";

function getToken() {
  return localStorage.getItem("cookify_token");
}
function setToken(token) {
  localStorage.setItem("cookify_token", token);
}
function clearToken() {
  localStorage.removeItem("cookify_token");
}
function getDeviceToken() {
  return localStorage.getItem("cookify_device_token") || "";
}
function setDeviceToken(token) {
  localStorage.setItem("cookify_device_token", token);
}

async function api(path, { method = "GET", body, form, auth = false } = {}) {
  const headers = {};
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let payload;
  if (form) {
    payload = form; // FormData — browser sets multipart content-type itself
  } else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || "Something went wrong");
  }
  return data;
}

function getMyUserId() {
  // JWTs are base64-encoded, not encrypted, so the payload can be read
  // client-side without an extra API call — fine here since it's only used
  // to build a link, never trusted for actual authorization (the backend
  // re-validates the token on every request).
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return parseInt(payload.sub, 10);
  } catch {
    return null;
  }
}

function requireAuth() {
  if (!getToken()) {
    window.location.href = "login.html";
  }
}

function logout() {
  clearToken();
  window.location.href = "index.html";
}
