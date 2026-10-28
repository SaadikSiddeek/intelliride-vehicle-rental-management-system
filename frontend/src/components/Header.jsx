import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import SessionTimer from "./SessionTimer";
import {
  Menu,
  ChevronRight,
  LogOut,
  Search,
  X,
  Settings2,
  CircleHelp,
} from "lucide-react";
import ProductTour from "./layout/ProductTour";
import { navigationItems } from "./layout/navigation";
import ThemeToggle from "./layout/ThemeToggle";
import { Button } from "./ui/button";
import { Dialog } from "@base-ui/react/dialog";
export default function Header({ user, onLogout, setMobileOpen }) {
  const { pathname } = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  useEffect(() => {
    const searchShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setQuery("");
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", searchShortcut);
    return () => window.removeEventListener("keydown", searchShortcut);
  }, []);
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";
  const current =
    navigationItems.find((item) => item.to === pathname)?.label || "Workspace";
  return (
    <header className="app-header">
      <div className="header-trail">
        <Button
          className="mobile-menu"
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu />
        </Button>
        <span className="muted header-workspace">IntelliRide</span>
        <ChevronRight size={14} className="header-workspace muted" />
        <span>{current}</span>
      </div>
      <div className="header-actions">
        <SessionTimer />
        <Button
          variant="outline"
          className="nav-search-trigger"
          onClick={() => {
            setQuery("");
            setSearchOpen(true);
          }}
        >
          <Search size={16} />
          <span>Find a page</span>
        </Button>
        <button
          className="header-help"
          aria-label="Open guided workspace tour"
          title="Workspace tour"
          onClick={() => setTourOpen(true)}
        >
          <CircleHelp size={18} />
        </button>
        <Link
          to="/settings"
          title="Personalize workspace"
          className="header-settings-link"
          aria-label="Appearance settings"
        >
          <Settings2 size={17} />
        </Link>
        <ThemeToggle />
        <div className="header-divider" />
        <details className="profile-menu">
          <summary aria-label="Account menu">
            <span className="avatar">{initials}</span>
            <span className="profile-copy">
              <strong>{user?.name || "My account"}</strong>
              <small>Account</small>
            </span>
          </summary>
          <div className="profile-popover">
            <strong>{user?.name}</strong>
            <p>{user?.email}</p>
            <Link to="/settings" className="profile-settings-link">
              <Settings2 size={16} /> Appearance & settings
            </Link>
            <button onClick={onLogout}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </details>
      </div>
      <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="dialog-backdrop" />
          <Dialog.Popup className="search-dialog">
            <div className="search-dialog-header">
              <Dialog.Title>Find a page</Dialog.Title>
              <Dialog.Close
                render={
                  <Button variant="ghost" size="icon" aria-label="Close search">
                    <X />
                  </Button>
                }
              />
            </div>
            <Dialog.Description className="muted">
              Jump to a module in your workspace.
            </Dialog.Description>
            <div className="search-field">
              <Search size={18} />
              <input
                aria-label="Search pages"
                placeholder="Search vehicles, staff, settings…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="search-results">
              {navigationItems
                .filter((i) =>
                  i.label.toLowerCase().includes(query.toLowerCase()),
                )
                .map(({ label, to, icon: Icon }) => (
                  <Link key={to} to={to} onClick={() => setSearchOpen(false)}>
                    <Icon size={18} />
                    {label}
                    <ChevronRight size={15} />
                  </Link>
                ))}
              {!navigationItems.some((i) =>
                i.label.toLowerCase().includes(query.toLowerCase()),
              ) && (
                <p className="empty-search">
                  No pages match “{query}”. Try another name.
                </p>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      <ProductTour open={tourOpen} onOpenChange={setTourOpen} />
    </header>
  );
}
