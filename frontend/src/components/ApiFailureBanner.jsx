import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShieldAlert, X } from "lucide-react";
import { API_FAILURE_EVENT } from "../lib/api-error.mjs";
export default function ApiFailureBanner() {
  const [failure, setFailure] = useState(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const receive = event => setFailure({ ...event.detail, pathname });
    window.addEventListener(API_FAILURE_EVENT, receive);
    return () => window.removeEventListener(API_FAILURE_EVENT, receive);
  }, [pathname]);
  if (!failure || failure.pathname !== pathname) return null;
  return <section role="alert" className="form-alert mb-5 flex items-start gap-3 p-4"><ShieldAlert size={20} className="shrink-0"/><div className="min-w-0 flex-1"><h2 className="font-semibold">{failure.title}</h2><p className="mt-1 text-sm">{failure.message}</p></div><button type="button" title="Dismiss message" aria-label="Dismiss message" onClick={() => setFailure(null)}><X size={18}/></button></section>;
}
