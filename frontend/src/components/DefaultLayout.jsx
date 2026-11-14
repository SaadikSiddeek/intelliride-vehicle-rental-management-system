import { canVisit } from "@/lib/permissions";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useStateContext } from "../contexts/ContextProvider";
import axiosClient from "../axios-client";
import Sidebar from "./Sidebar";
import Header from "../components/Header";
import { useTheme } from "../contexts/theme-context";
import Brand from "./layout/Brand";
import ApiFailureBanner from "./ApiFailureBanner";
import InitialPasswordChange from "./InitialPasswordChange";
import FloatingCalculator from "./calculator/FloatingCalculator";

export default function DefaultLayout() {
  const { pathname } = useLocation();
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

  if (user?.must_change_password) return <InitialPasswordChange onLogout={onLogout} />;

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>

      <FloatingCalculator />
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
          <ApiFailureBanner />
          {canVisit(user, pathname) ? <Outlet key={JSON.stringify([user?.authorization_mode, user?.effective_permissions])} /> : <section className="rounded-xl border border-border bg-card p-8 text-center" role="alert"><ShieldCheck className="mx-auto mb-4 text-muted-foreground" /><h1 className="text-xl font-semibold">Access denied</h1><p className="mt-2 text-muted-foreground">Your account has not been assigned access to this page. Contact your administrator.</p></section>}
        </main>
      </div>
    </div>
  );
}
