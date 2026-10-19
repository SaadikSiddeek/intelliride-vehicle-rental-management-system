import { Toaster } from "sonner";
import { CircleCheck, CircleAlert, Info, LoaderCircle } from "lucide-react";

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      closeButton
      duration={4500}
      visibleToasts={3}
      gap={12}
      offset={24}
      mobileOffset={16}
      icons={{
        success: (
          <CircleCheck size={20} className="text-primary" aria-hidden="true" />
        ),
        error: (
          <CircleAlert
            size={20}
            className="text-destructive"
            aria-hidden="true"
          />
        ),
        warning: (
          <CircleAlert
            size={20}
            className="text-amber-500"
            aria-hidden="true"
          />
        ),
        info: <Info size={20} className="text-primary" aria-hidden="true" />,
        loading: (
          <LoaderCircle
            size={20}
            className="animate-spin text-primary"
            aria-hidden="true"
          />
        ),
      }}
      toastOptions={{
        className: "app-toast",
        style: {
          background: "var(--card)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          boxShadow: "0 12px 36px rgb(0 0 0 / 0.14)",
          padding: "16px",
          fontFamily: "inherit",
        },
      }}
    />
  );
}
