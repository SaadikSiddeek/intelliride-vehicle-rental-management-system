import { NavLink } from "react-router-dom";
import { PanelLeftClose, PanelLeftOpen, X, LogOut } from "lucide-react";
import { navigation } from "./layout/navigation";
import Brand from "./layout/Brand";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "./ui/drawer";
import { Button } from "./ui/button";
export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  mobileOpen,
  setMobileOpen,
  onLogout,
}) {
  const content = (expanded, mobile = false) => (
    <>
      <div className="sidebar-brand">
        <NavLink
          to="/dashboard"
          aria-label="IntelliRide dashboard"
          onClick={() => setMobileOpen(false)}
        >
          <Brand compact={!expanded} />
        </NavLink>
        {mobile && (
          <DrawerClose
            render={
              <Button size="icon" variant="ghost" aria-label="Close navigation">
                <X />
              </Button>
            }
          />
        )}
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {navigation.map((group) => (
          <div key={group.label} className="nav-group">
            {expanded ? (
              <p className="nav-group-label">{group.label}</p>
            ) : (
              <div className="nav-divider" />
            )}
            {group.items.map(({ label, to, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                title={label}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <Icon size={18} strokeWidth={1.7} />
                {expanded && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button onClick={onLogout} className="nav-item" title="Sign out">
          <LogOut size={18} />
          {expanded && <span>Sign out</span>}
        </button>
        {!mobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="nav-item collapse-control"
            title={expanded ? "Collapse navigation" : "Expand navigation"}
            aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
          >
            {expanded ? (
              <PanelLeftClose size={18} />
            ) : (
              <PanelLeftOpen size={18} />
            )}{" "}
            {expanded && <span>Collapse sidebar</span>}
          </button>
        )}
      </div>
    </>
  );
  return (
    <>
      <aside className={`desktop-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        {content(sidebarOpen)}
      </aside>
      <Drawer
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        swipeDirection="left"
      >
        <DrawerContent className="mobile-sidebar">
          <DrawerTitle className="sr-only">Navigation</DrawerTitle>
          <DrawerDescription className="sr-only">
            Navigate your IntelliRide workspace
          </DrawerDescription>
          {content(true, true)}
        </DrawerContent>
      </Drawer>
    </>
  );
}
