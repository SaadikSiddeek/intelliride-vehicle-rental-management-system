import test from "node:test";
import assert from "node:assert/strict";
import { canVisit, hasPermission, pagePermissions, firstAllowedPage } from "./permissions.js";

const user = permissions => ({ authorization_mode: "rbac", effective_permissions: permissions, user_type: "user" });
test("RBAC denies pages and actions when permissions are absent", () => {
  assert.equal(canVisit(user([]), "/customer-management/manage"), false);
  assert.equal(hasPermission(user([]), "customers.create"), false);
  assert.equal(canVisit(null, "/permission-management/manage"), false);
});
test("view permission does not imply create or edit", () => {
  const viewer = user(["customers.view"]);
  assert.equal(canVisit(viewer, "/customer-management/manage"), true);
  assert.equal(hasPermission(viewer, "customers.create"), false);
  assert.equal(hasPermission(viewer, "customers.edit"), false);
});
test("authority labels never replace server-provided grants", () => {
  assert.equal(hasPermission({ ...user([]), user_type: "super_admin" }, "permissions.assign"), false);
  assert.equal(hasPermission({ ...user([]), user_type: "admin", can_manage_business: true }, "company_settings.view"), false);
});
test("financial report navigation requires its separate grant", () => {
  assert.equal(canVisit(user(["reports.view"]), "/reports/financial"), false);
  assert.equal(canVisit(user(["reports.view"]), "/reports/rental_history"), true);
  assert.equal(canVisit(user(["reports.view", "reports.finance"]), "/reports/deposit_history"), true);
});
test("query strings preserve route access decisions", () => {
  assert.equal(canVisit(user(["rentals.view"]), "/active-rental-management/manage?open=1"), true);
});
test("permission revocation changes route and action checks immediately", () => {
  const account = user(["users.view", "users.edit"]);
  assert.equal(canVisit(account, "/user-management/manage"), true);
  account.effective_permissions = [];
  assert.equal(canVisit(account, "/user-management/manage"), false);
  assert.equal(hasPermission(account, "users.edit"), false);
});
test("unimplemented AI pages receive no fabricated RBAC access", () => {
  assert.equal(canVisit(user(Object.values(pagePermissions)), "/ai/agent"), false);
  assert.equal(canVisit(user([]), "/settings"), true);
});
test("legacy access remains explicit and cannot expose new permission management", () => {
  const legacy = { permissions: { administration: true }, can_manage_business: false };
  assert.equal(canVisit(legacy, "/user-management/manage"), true);
  assert.equal(canVisit(legacy, "/company-settings"), false);
  assert.equal(canVisit(legacy, "/permission-management/manage"), false);
});
test("login lands on a permitted page or appearance settings without inventing dashboard access", () => {
  assert.equal(firstAllowedPage(user(["customers.view"])), "/customer-management/manage");
  assert.equal(firstAllowedPage(user([])), "/settings");
});
