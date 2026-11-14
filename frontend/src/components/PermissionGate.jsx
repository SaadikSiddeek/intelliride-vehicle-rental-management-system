import usePermissions from "@/hooks/usePermissions";

export default function PermissionGate({ permission, children }) {
  const { can } = usePermissions();
  return can(permission) ? children : null;
}
