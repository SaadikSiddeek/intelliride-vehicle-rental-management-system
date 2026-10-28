export const TOKEN_KEY = "ACCESS_TOKEN";
export const ACTIVITY_KEY = "LAST_ACTIVITY_AT";
export const AUTH_EXPIRED_EVENT = "auth:expired";

export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

export function clearStoredSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACTIVITY_KEY);
}

export function notifySessionExpired() {
  clearStoredSession();
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}
