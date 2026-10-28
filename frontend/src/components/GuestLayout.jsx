import { Navigate, Outlet, Link } from "react-router-dom";
import { useStateContext } from "../contexts/ContextProvider";
import { ArrowLeft, Check } from "lucide-react";
import Brand from "./layout/Brand";
import ThemeToggle from "./layout/ThemeToggle";
import DrivingScene from "./marketing/DrivingScene";

export default function GuestLayout() {
  const { token, authLoading } = useStateContext();

  if (authLoading) {
    return (
      <div className="app-opening" role="status">
        <Brand compact />
        <p>Checking your session…</p>
      </div>
    );
  }

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Link to="/" aria-label="IntelliRide home">
          <Brand tone="white" />
        </Link>

        <div className="auth-story-content">
          <span className="eyebrow">BUILT AROUND YOUR OPERATIONS</span>

          <h1>
            Your fleet.
            <br />
            Your people.
            <br />
            <span>One workspace.</span>
          </h1>

          <p>
            A clear view of the details that keep your rental business moving.
          </p>

          <div className="auth-feature-list">
            <div>
              <Check size={16} />
              <span>Organized vehicles and reference data</span>
            </div>

            <div>
              <Check size={16} />
              <span>Connected people and administration</span>
            </div>
          </div>

          <div className="auth-car-detail">
            <DrivingScene compact />
          </div>
        </div>

        <p className="auth-story-footer">
          IntelliRide · Vehicle Rental Management
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-top">
          <Link to="/">
            <ArrowLeft size={15} /> Back to home
          </Link>

          <ThemeToggle />
        </div>

        <div className="auth-card">
          <Link
            to="/"
            className="auth-brand-mobile"
            aria-label="IntelliRide home"
          >
            <Brand />
          </Link>

          <Outlet />
        </div>

        <p className="auth-bottom">Your workspace starts here.</p>
      </main>
    </div>
  );
}
