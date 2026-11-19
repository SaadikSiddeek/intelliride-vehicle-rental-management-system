import axios from "axios";
import { normalizeIdentifiers } from "./lib/opaque-identifiers.mjs";
import { apiFailure, API_FAILURE_EVENT } from "./lib/api-error.mjs";
import { TOKEN_KEY, notifySessionExpired } from "./auth-session";

const axiosClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "")}/api`,
  headers: {
    Accept: "application/json",
    "X-IntelliRide-Identifiers": "encrypted-v1",
  },
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

axiosClient.interceptors.response.use(
  (response) => {
    if (response.config.responseType !== "blob" && response.data) response.data = normalizeIdentifiers(response.data);
    return response;
  },
  (error) => {
    const inactive = error.response?.status === 403 && error.response?.data?.code === "ACCOUNT_INACTIVE";
    if (error.response?.status === 401 || inactive) {
      // Avoid clearing a newer login because an older request failed.
      const currentToken = localStorage.getItem(TOKEN_KEY);
      const sentToken = error.config?.headers?.Authorization;

      if (currentToken && sentToken === `Bearer ${currentToken}`) {
        notifySessionExpired(inactive ? "inactive" : "expired");
      }
    }

    // Keep validation errors intact; replace transport/permission/server details with safe UI messages.
    const failure = apiFailure(error);
    if (failure && error.code !== "ERR_CANCELED") {
      if (error.response) error.response.data = { ...error.response.data, message: failure.message };
      if (error.response?.status !== 401 && !error.config?.handleErrorsLocally) window.dispatchEvent(new CustomEvent(API_FAILURE_EVENT, { detail: failure }));
    }
    return Promise.reject(error);
  },
);

export default axiosClient;
