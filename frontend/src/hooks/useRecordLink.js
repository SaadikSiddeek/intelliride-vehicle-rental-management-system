import { useEffect } from "react";
/** Resolve a dashboard URL intent after the management view has mounted. */
export default function useRecordLink(openRecord) {
  useEffect(() => {
    const open = () => { const id = new URLSearchParams(window.location.search).get("open"); if (id && /^[1-9][0-9]*$/.test(id)) void openRecord(Number(id)); };
    const timer = window.setTimeout(open, 0);
    window.addEventListener("popstate", open);
    return () => { window.clearTimeout(timer); window.removeEventListener("popstate", open); };
  }, [openRecord]);
}
