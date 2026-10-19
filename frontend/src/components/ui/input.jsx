import { cn } from "@/lib/utils";
import { useId } from "react";
export function Input({ className, type, error, ...props }) {
  const generatedId = useId();
  const errorId = `${props.id || generatedId}-error`;
  return (
    <>
    <input
      type={type}
      data-slot="input"
      className={cn(
        type === "checkbox" || type === "radio" ? "" : "custom-input-sm",
        className,
      )}
      {...props}
      aria-invalid={error ? true : props["aria-invalid"]}
      aria-describedby={error ? errorId : props["aria-describedby"]}
    />
    {error && <span id={errorId} className="field-error" role="alert">{error}</span>}
    </>
  );
}
export function Textarea({ className, error, ...props }) {
  const generatedId = useId();
  const errorId = `${props.id || generatedId}-error`;
  return (
    <>
    <textarea
      data-slot="textarea"
      className={cn("custom-input-sm", className)}
      {...props}
      aria-invalid={error ? true : props["aria-invalid"]}
      aria-describedby={error ? errorId : props["aria-describedby"]}
    />
    {error && <span id={errorId} className="field-error" role="alert">{error}</span>}
    </>
  );
}
export function NativeSelect({ className, error, ...props }) {
  const generatedId = useId();
  const errorId = `${props.id || generatedId}-error`;
  return (
    <>
    <select
      data-slot="native-select"
      className={cn("custom-input-sm", className)}
      {...props}
      aria-invalid={error ? true : props["aria-invalid"]}
      aria-describedby={error ? errorId : props["aria-describedby"]}
    />
    {error && <span id={errorId} className="field-error" role="alert">{error}</span>}
    </>
  );
}
