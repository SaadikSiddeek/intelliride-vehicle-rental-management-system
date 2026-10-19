import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Brand from "./layout/Brand";
/** Keeps the original targetId/show/text contract; only the overlay presentation changed. */
export default function CarLoader({ targetId, show, text = "Loading" }) {
    const [target, setTarget] = useState(null);

    useEffect(() => {
        const el = document.getElementById(targetId);
        if (!el) {
            console.warn(`CarLoader: no element found with id "${targetId}"`);
            return;
        }

        // The overlay is absolutely positioned, so its container needs to be a
        // positioning context. If the target isn't already positioned, make it
        // "relative" for us, and restore whatever it was before on cleanup.
        const previousPosition = el.style.position;
        const computedPosition = window.getComputedStyle(el).position;

        if (computedPosition === "static") {
            el.style.position = "relative";
        }

        // eslint-disable-next-line react-hooks/set-state-in-effect -- Portal target is discovered from the mounted DOM.
        setTarget(el);

        return () => {
            el.style.position = previousPosition;
        };
    }, [targetId]);

    if (!target || !show) return null;

    return createPortal(
        <div className="record-loading-overlay" role="status" aria-live="polite">
            <Brand compact/>
            <strong>{text}</strong>
            <LoaderCircle size={19} className="animate-spin" aria-hidden="true"/>
        </div>, target
    );
}
