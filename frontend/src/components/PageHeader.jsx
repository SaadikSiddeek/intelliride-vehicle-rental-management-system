import { sampleModules } from "./layout/module-status";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, House, Info } from "lucide-react";
export default function PageHeader({
  title,
  sub_text,
  breadcrumbs = [],
  children,
}) {
  const { pathname } = useLocation();
  return (
    <div className="page-header">
      <nav aria-label="Breadcrumb">
        <Link to="/dashboard" aria-label="Dashboard">
          <House size={14} />
        </Link>
        {breadcrumbs.map((item, i) => (
          <span key={i}>
            <ChevronRight size={12} />
            {item.to ? (
              <Link to={item.to}>{item.label}</Link>
            ) : (
              <span
                aria-current={i === breadcrumbs.length - 1 ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        ))}
      </nav>
      <div className="page-heading-row">
        <div>
          <h1>{title}</h1>
          {sub_text && <p>{sub_text}</p>}
        </div>
        {children}
      </div>
      {/* {sampleModules.has(pathname) && (
        <div className="page-data-note">
          <Info size={13} />
          <span>
            {pathname === "/role-management/manage"
              ? "This list contains sample records."
              : "Sample records · changes are not saved in this version."}
          </span>
        </div>
      )} */}
    </div>
  );
}
