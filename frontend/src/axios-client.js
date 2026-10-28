import axios from "axios";
import { TOKEN_KEY, notifySessionExpired } from "./auth-session";

const axiosClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "")}/api`,
  headers: {
    Accept: "application/json",
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
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Avoid clearing a newer login because an older request failed.
      const currentToken = localStorage.getItem(TOKEN_KEY);
      const sentToken = error.config?.headers?.Authorization;

      if (currentToken && sentToken === `Bearer ${currentToken}`) {
        notifySessionExpired();
      }
    }

    return Promise.reject(error);
  },
);

export default axiosClient;
