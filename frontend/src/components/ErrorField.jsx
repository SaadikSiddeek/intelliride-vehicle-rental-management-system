import { CircleAlert } from "lucide-react";
export default function FieldError({ errors, name }) {
  if (!errors[name]) return null;
  return <p id={`${name}-error`} className="field-error flex items-center gap-1" role="alert"><CircleAlert size={14} aria-hidden="true"/>{errors[name].message}</p>;
}
