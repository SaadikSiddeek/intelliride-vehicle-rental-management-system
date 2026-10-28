import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import axiosClient from "../axios-client";

import {
  TOKEN_KEY,
  ACTIVITY_KEY,
  AUTH_EXPIRED_EVENT,
  IDLE_TIMEOUT_MS,
  clearStoredSession,
} from "../auth-session";

const StateContext = createContext(null);

// Send at most one activity request every 30 seconds.
const ACTIVITY_SYNC_MS = 30 * 1000;

function readLastActivity() {
  const value = Number(localStorage.getItem(ACTIVITY_KEY));

  return Number.isFinite(value) && value > 0 ? value : 0;
}

function isIdle() {
  const lastActivity = readLastActivity();

  return !lastActivity || Date.now() - lastActivity >= IDLE_TIMEOUT_MS;
}

export function ContextProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, updateToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const clearSession = useCallback((expired = false) => {
    clearStoredSession();

    setUser(null);
    updateToken(null);
    setAuthLoading(false);
    setSessionExpired(expired);
  }, []);

  // Used by login/signup and existing logout code.
  const setToken = useCallback(
    (nextToken) => {
      if (!nextToken) {
        clearSession(false);
        return;
      }

      localStorage.setItem(TOKEN_KEY, nextToken);
      localStorage.setItem(ACTIVITY_KEY, String(Date.now()));

      updateToken(nextToken);
      setSessionExpired(false);
    },
    [clearSession],
  );

  useEffect(() => {
    const handleExpired = () => clearSession(true);

    const handleStorage = (event) => {
      if (event.key === TOKEN_KEY || event.key === null) {
        const storedToken = localStorage.getItem(TOKEN_KEY);

        if (!storedToken) {
          clearSession(false);
        } else {
          // Also handles login/token replacement in another tab.
          setUser(null);
          updateToken(storedToken);
          setSessionExpired(false);
        }
      }
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
      window.removeEventListener("storage", handleStorage);
    };
  }, [clearSession]);

  useEffect(() => {
    if (!token) {
      setAuthLoading(false);
      return;
    }

    let cancelled = false;
    let expiring = false;
    let syncing = false;

    // Force the first real interaction to sync with Laravel.
    let lastSyncAt = 0;
    let lastWriteAt = 0;

    const expireSession = () => {
      if (expiring) return;

      expiring = true;

      // Start revocation before clearing the stored token.
      // If offline, the backend token still expires by itself.
      void axiosClient.post("/logout").catch(() => {});

      clearSession(true);
    };

    if (isIdle()) {
      expireSession();
      return;
    }

    setAuthLoading(true);

    // Validate the stored token when opening/reloading the app.
    // This endpoint does not renew the inactivity deadline.
    axiosClient
      .get("/user")
      .then(({ data }) => {
        if (!cancelled && !expiring) {
          setUser(data);
        }
      })
      .catch(() => {
        if (!cancelled && !expiring) {
          clearSession(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAuthLoading(false);
        }
      });

    const checkTimeout = () => {
      if (isIdle()) {
        expireSession();
        return false;
      }

      return true;
    };

    const syncActivity = async () => {
      if (syncing || Date.now() - lastSyncAt < ACTIVITY_SYNC_MS) {
        return;
      }

      syncing = true;
      lastSyncAt = Date.now();

      try {
        await axiosClient.post("/auth/activity");
      } catch {
        // Axios handles 401.
        // A network failure cannot renew the backend token.
      } finally {
        syncing = false;
      }
    };

    const handleActivity = (event) => {
      if (
        !event.isTrusted ||
        document.visibilityState !== "visible" ||
        !checkTimeout()
      ) {
        return;
      }

      const now = Date.now();

      // Avoid writing localStorage on every pointer movement.
      if (now - lastWriteAt >= 1000) {
        localStorage.setItem(ACTIVITY_KEY, String(now));
        lastWriteAt = now;
      }

      void syncActivity();
    };

    const handleResume = () => {
      // Check expiration BEFORE allowing new interaction to renew it.
      checkTimeout();
    };

    const activityEvents = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, {
        passive: true,
        capture: true,
      });
    });

    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handleResume);
    document.addEventListener("visibilitychange", handleResume);

    const interval = window.setInterval(checkTimeout, 1000);

    return () => {
      cancelled = true;

      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity, true);
      });

      window.removeEventListener("focus", handleResume);
      window.removeEventListener("pageshow", handleResume);
      document.removeEventListener("visibilitychange", handleResume);

      window.clearInterval(interval);
    };
  }, [token, clearSession]);

  return (
    <StateContext.Provider
      value={{
        user,
        token,
        setUser,
        setToken,
        authLoading,
        sessionExpired,
      }}
    >
      {children}
    </StateContext.Provider>
  );
}

export function useStateContext() {
  const context = useContext(StateContext);

  if (!context) {
    throw new Error("useStateContext must be used inside ContextProvider");
  }

  return context;
}
