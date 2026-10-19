import { cn } from "@/lib/utils";
export function Badge({ children, tone = "neutral", className, ...props }) {
  return (
    <span
      className={cn("status-badge", `status-${tone}`, className)}
      {...props}
    >
      {children}
    </span>
  );
}
