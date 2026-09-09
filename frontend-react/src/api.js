// Shared API client — same logic as the original vanilla-JS version, ported
// to a plain module usable from any React component/hook.
export const API_BASE = ""; // relative — backend serves this build, see main.py

export function getToken() {
  return localStorage.getItem("cookify_token");
}
export function setToken(token) {
  localStorage.setItem("cookify_token", token);
}
export function clearToken() {
  localStorage.removeItem("cookify_token");
}
export function getDeviceToken() {
  return localStorage.getItem("cookify_device_token") || "";
}
export function setDeviceToken(token) {
  localStorage.setItem("cookify_device_token", token);
}

export async function api(path, { method = "GET", body, form, auth = false } = {}) {
  const headers = {};
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let payload;
  if (form) {
    payload = form;
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

export function getMyUserId() {
  // JWTs are base64-encoded, not encrypted — safe to read client-side for
  // building links; the backend re-validates the token on every request.
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return parseInt(payload.sub, 10);
  } catch {
    return null;
  }
}
