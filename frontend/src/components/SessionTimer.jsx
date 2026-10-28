import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { ACTIVITY_KEY, IDLE_TIMEOUT_MS } from "../auth-session";

function getRemainingSeconds() {
  const lastActivity = Number(localStorage.getItem(ACTIVITY_KEY));

  if (!Number.isFinite(lastActivity) || lastActivity <= 0) {
    return 0;
  }

  const remaining = IDLE_TIMEOUT_MS - (Date.now() - lastActivity);

  return Math.max(
    0,
    Math.min(Math.ceil(IDLE_TIMEOUT_MS / 1000), Math.ceil(remaining / 1000)),
  );
}

export default function SessionTimer() {
  const [remaining, setRemaining] = useState(getRemainingSeconds);

  useEffect(() => {
    const update = () => {
      setRemaining(getRemainingSeconds());
    };

    const handleStorage = (event) => {
      if (event.key === ACTIVITY_KEY || event.key === null) {
        update();
      }
    };

    const interval = window.setInterval(update, 1000);

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);

    update();

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  const warning = remaining > 0 && remaining <= 120;
  const expired = remaining === 0;

  const appearance = expired
    ? {
        badge:
          "border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
        icon: "bg-rose-100 text-rose-600 dark:bg-rose-400/15 dark:text-rose-300",
        dot: "bg-rose-500",
        divider: "bg-rose-200/80 dark:bg-rose-400/20",
      }
    : warning
      ? {
          badge:
            "border-amber-200/80 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
          icon: "bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
          dot: "bg-amber-500",
          divider: "bg-amber-200/80 dark:bg-amber-400/20",
        }
      : {
          badge:
            "border-emerald-200/70 bg-emerald-50/80 text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
          icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300",
          dot: "bg-emerald-500",
          divider: "bg-emerald-200/80 dark:bg-emerald-400/20",
        };

  return (
    <div
      role="timer"
      aria-live="off"
      aria-label={`Inactivity time remaining: ${Number(minutes)} minutes ${Number(seconds)} seconds`}
      title="Time until automatic sign-out due to inactivity. Interacting with the workspace resets this timer."
      className={`
        group relative inline-flex h-10 shrink-0 items-center
        gap-2 overflow-hidden rounded-full border py-1 pl-1 pr-2
        shadow-sm transition-all duration-300 ease-out
        hover:shadow-md
        motion-safe:hover:-translate-y-0.5
        motion-reduce:transition-none
        sm:gap-2.5 sm:pr-3
        ${appearance.badge}
      `}
    >
      {/* Subtle highlight along the top edge */}
      <span
        aria-hidden="true"
        className="
          pointer-events-none absolute inset-x-4 top-0 h-px
          bg-gradient-to-r from-transparent via-white/80 to-transparent
          dark:via-white/20
        "
      />

      {/* Clock icon */}
      <span
        aria-hidden="true"
        className={`
          flex h-7 w-7 shrink-0 items-center justify-center
          rounded-full transition-colors duration-300
          ${appearance.icon}
        `}
      >
        <Clock3
          size={15}
          strokeWidth={1.8}
          className="
            transition-transform duration-300
            motion-safe:group-hover:rotate-12
            motion-reduce:transition-none
          "
        />
      </span>

      {/* Label is hidden on smaller screens */}
      <span className="hidden text-[11px] font-semibold tracking-wide sm:block">
        {expired ? "Session ended" : warning ? "Expires in" : "Session"}
      </span>

      <span
        aria-hidden="true"
        className={`
          hidden h-4 w-px sm:block
          ${appearance.divider}
        `}
      />

      {/* Fixed-width countdown prevents layout movement */}
      <span
        className="
          inline-flex min-w-[5.5ch] items-center justify-center
          rounded-lg bg-white/70 px-1.5 py-1
          font-mono text-xs font-semibold leading-none
          tabular-nums tracking-wide
          ring-1 ring-inset ring-black/5
          dark:bg-black/15 dark:ring-white/5
        "
      >
        {minutes}
        <span className="mx-px opacity-40">:</span>
        {seconds}
      </span>

      {/* Status dot pulses only during the warning period */}
      <span
        aria-hidden="true"
        className="relative ml-0.5 hidden h-2 w-2 shrink-0 sm:flex"
      >
        {warning && (
          <span
            className={`
              absolute inset-0 rounded-full opacity-40
              motion-safe:animate-ping
              ${appearance.dot}
            `}
          />
        )}

        <span
          className={`
            relative inline-flex h-2 w-2 rounded-full
            ${appearance.dot}
          `}
        />
      </span>
    </div>
  );
}
