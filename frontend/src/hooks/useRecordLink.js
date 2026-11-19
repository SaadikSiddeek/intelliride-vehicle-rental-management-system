import { useEffect } from "react";
import { isOpaqueIdentifier, stableIdentifier } from "@/lib/opaque-identifiers.mjs";
/** Resolve a dashboard URL intent after the management view has mounted. */
export default function useRecordLink(openRecord) {
  useEffect(() => {
    const open = () => { const id = new URLSearchParams(window.location.search).get("open"); if (id && (isOpaqueIdentifier(id) || /^[1-9][0-9]*$/.test(id))) void openRecord(stableIdentifier(id)); };
    const timer = window.setTimeout(open, 0);
    window.addEventListener("popstate", open);
    return () => { window.clearTimeout(timer); window.removeEventListener("popstate", open); };
  }, [openRecord]);
}
