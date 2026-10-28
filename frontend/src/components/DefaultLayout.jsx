import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useStateContext } from "../contexts/ContextProvider";
import axiosClient from "../axios-client";
import Sidebar from "./Sidebar";
import Header from "../components/Header";
import { useTheme } from "../contexts/theme-context";
import Brand from "./layout/Brand";

export default function DefaultLayout() {
  const { user, token, setToken, authLoading } = useStateContext();

  const { preferences, setPreference } = useTheme();

  const sidebarOpen = !preferences.sidebarCompact;

  const setSidebarOpen = (open) => {
    setPreference("sidebarCompact", !open);
  };

  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async (event) => {
    event?.preventDefault();

    if (loggingOut) return;

    setLoggingOut(true);

    try {
      await axiosClient.post("/logout");
    } catch (error) {
      console.error("Server logout failed:", error);
    } finally {
      // Clear local authentication even if the request fails.
      // The updated provider also clears the user and activity timestamp.
      setToken(null);
      setLoggingOut(false);
    }
  };

  // All hooks must remain above these conditional returns.
  if (authLoading) {
    return (
      <div className="app-opening" role="status">
        <Brand compact />
        <p>Checking your session…</p>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <Sidebar
        onLogout={onLogout}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="app-main">
        <Header user={user} onLogout={onLogout} setMobileOpen={setMobileOpen} />

        <main id="main-content" className="workspace-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
