import { Link } from "react-router-dom";
import { MapPinOff, ArrowLeft } from "lucide-react";
import ThemeToggle from "../components/layout/ThemeToggle";
export default function NotFound() {
  return (
    <main className="not-found">
      <ThemeToggle />
      <MapPinOff size={46} />
      <span className="eyebrow">404 / PAGE NOT FOUND</span>
      <h1>A little off route.</h1>
      <p>The page you’re looking for isn’t here.</p>
      <Link className="btn-primary" to="/">
        <ArrowLeft size={16} />
        Back to home
      </Link>
    </main>
  );
}
