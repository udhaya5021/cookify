// Small helper for pages/actions that need a logged-in user — React Router
// navigation needs to happen inside a component (via useNavigate), so this
// just does the redirect via window.location for use in plain event
// handlers where a hook isn't available.
import { getToken } from "./api";

export function requireAuthOrAlert() {
  if (!getToken()) {
    window.location.href = "/login";
    return false;
  }
  return true;
}

export { api, API_BASE, getMyUserId, getToken } from "./api";
