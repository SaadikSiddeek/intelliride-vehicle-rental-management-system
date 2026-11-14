export const pagePermissions = {
  "/dashboard": "dashboard.view", "/company-settings": "company_settings.view", "/my-profile": "profile.view",
  "/user-management/manage": "users.view", "/role-management/manage": "roles.manage", "/permission-management/manage": "permissions.assign",
  "/staff-management/manage": "staff.view", "/branch-management/manage": "branches.view", "/department-management/manage": "departments.view", "/designation-management/manage": "designations.view",
  "/customer-management/manage": "customers.view", "/rental-package-management/manage": "rental_packages.view", "/booking-management/manage": "bookings.view", "/active-rental-management/manage": "rentals.view", "/return-management/manage": "returns.view",
  "/invoice-management/manage": "invoices.view", "/payment-management/manage": "payments.view", "/deposit-refund-management/manage": "deposits.view", "/vehicle-document-management/manage": "vehicle_documents.view", "/maintenance-management/manage": "maintenance.view",
  "/register-vehicle-management/manage": "vehicles.view", "/vehicle-category-management/manage": "categories.view", "/vehicle-brand-management/manage": "brands.view", "/vehicle-model-management/manage": "models.view", "/fuel-type-management/manage": "fuel_types.view", "/transmission-type-management/manage": "transmissions.view", "/vehicle-feature-management/manage": "vehicle_features.view",
};

export function hasPermission(user, code) {
  if (!user) return false;
  if (user.authorization_mode === "rbac") return user.effective_permissions?.includes(code) === true;
  if (code.startsWith("permissions.") || code.startsWith("authorization_audit.")) return false;
  if (code.startsWith("company_settings.")) return user.can_manage_business === true;
  if (/^(users|roles)\./.test(code)) return user.permissions?.administration === true;
  // Existing legacy pages retain their existing controller checks until explicit activation.
  return true;
}

export function canVisit(user, path) {
  const pathname = path.split("?")[0];
  if (user?.authorization_mode !== "rbac") {
    return !pagePermissions[pathname] || hasPermission(user, pagePermissions[pathname]);
  }
  if (pathname === "/settings") return true;
  if (pathname.startsWith("/reports/")) {
    const financial = ["financial", "outstanding_invoices", "daily_transactions", "deposit_history"].includes(pathname.split("/").pop());
    return hasPermission(user, "reports.view") && (!financial || hasPermission(user, "reports.finance"));
  }
  return Boolean(pagePermissions[pathname]) && hasPermission(user, pagePermissions[pathname]);
}

export function firstAllowedPage(user) {
  return Object.keys(pagePermissions).find(path => canVisit(user, path)) || '/settings';
}
