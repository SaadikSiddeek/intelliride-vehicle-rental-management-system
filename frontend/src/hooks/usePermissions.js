import { useCallback, useMemo } from "react";
import { useStateContext } from "@/contexts/ContextProvider";
import { hasPermission } from "@/lib/permissions";

export default function usePermissions() {
  const { user } = useStateContext();
  const authenticated = Boolean(user);
  const mode = user?.authorization_mode;
  const grants = JSON.stringify([...(user?.effective_permissions || [])].sort());
  const administration = user?.permissions?.administration === true;
  const company = user?.can_manage_business === true;
  // Ordinary session/avatar refreshes must not recreate Tabulator or discard its filters.
  const snapshot = useMemo(() => authenticated ? {
    authorization_mode: mode,
    effective_permissions: JSON.parse(grants),
    permissions: { administration },
    can_manage_business: company,
  } : null, [authenticated, mode, grants, administration, company]);
  const can = useCallback(code => hasPermission(snapshot, code), [snapshot]);
  return { user, can, isRbac: user?.authorization_mode === "rbac", isSuperAdmin: user?.authorization_mode === "rbac" && user?.user_type === "super_admin" };
}
