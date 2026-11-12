import { useEffect, useEffectEvent, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import flatpickr from "flatpickr";
import { X } from "lucide-react";
import "@/styles/date-picker.css";

// Preserve local calendar strings: business dates must never pass through UTC.
export function DatePicker({ value, onValueChange, onChange, onBlur, type = "date", range = false, ref: fieldRef, className = "", ...props }) {
  const input = useRef(null), picker = useRef(null);
  const changed = useEffectEvent((dates, dateString, instance) => {
    onValueChange?.(range ? dates.map(date => instance.formatDate(date, "Y-m-d")) : dateString);
    onChange?.({ target: instance.input, type: "change" });
  });
  const blurred = useEffectEvent(instance => onBlur?.({ target: instance.input, type: "blur" }));
  const bindField = useEffectEvent(node => {
    if (typeof fieldRef === "function") fieldRef(node);
    else if (fieldRef) fieldRef.current = node;
  });
  const { min, max, disabled, readOnly } = props;
  useEffect(() => {
    const element = input.current;
    const instance = flatpickr(element, {
      mode: range ? "range" : "single",
      enableTime: type === "datetime-local",
      time_24hr: true,
      dateFormat: type === "datetime-local" ? "Y-m-d\\TH:i" : "Y-m-d",
      disableMobile: true,
      allowInput: false,
      static: Boolean(element.closest('[role="dialog"]')),
      clickOpens: !disabled && !readOnly,
      minDate: min || undefined,
      maxDate: max || undefined,
      onOpen: (_, __, current) => {
        if (current.config.static) requestAnimationFrame(() => {
          if (!current.isOpen || !current.calendarContainer?.isConnected) return;
          const body = current.input.closest(".form-drawer-body");
          if (body) {
            const calendar = current.calendarContainer.getBoundingClientRect();
            const bounds = body.getBoundingClientRect();
            if (calendar.bottom > bounds.bottom - 16) body.scrollTop += calendar.bottom - bounds.bottom + 16;
            else if (calendar.top < bounds.top + 16) body.scrollTop += calendar.top - bounds.top - 16;
          } else current.calendarContainer.scrollIntoView({ block: "nearest" });
        });
      },
      onChange: (dates, text, current) => changed(dates, text, current),
      onClose: (_, __, current) => blurred(current),
    });
    const closeCalendar = event => {
      if (event.key === "Escape" && instance.isOpen) {
        event.preventDefault(); event.stopImmediatePropagation(); instance.close();
      }
    };
    window.addEventListener("keydown", closeCalendar, true);
    picker.current = instance;
    bindField(element);
    return () => { window.removeEventListener("keydown", closeCalendar, true); bindField(null); instance.destroy(); picker.current = null; };
  }, [range, type, min, max, disabled, readOnly]);
  useEffect(() => {
    const instance = picker.current;
    if (value === undefined || !instance) return;
    const expected = (Array.isArray(value) ? value : [value]).filter(Boolean);
    const actual = instance.selectedDates.map(date => instance.formatDate(date, instance.config.dateFormat));
    if (expected.join("|") !== actual.join("|")) instance.setDate(expected, false);
  }, [value, range, type, min, max, disabled, readOnly]);
  return <div className="date-picker">
    <input {...props} ref={input} type="text" className={`custom-input-sm date-picker-input ${className}`} placeholder={props.placeholder || (range ? "Select date range" : type === "datetime-local" ? "Select date and time" : "Select date")} autoComplete="off" />
    <button type="button" className="date-picker-clear" disabled={disabled || readOnly} aria-label={`Clear ${props["aria-label"] || props.id || (range ? "date range" : "date")}`} title="Clear date" onClick={() => { picker.current?.clear(); input.current?.focus(); }}><X size={14} aria-hidden="true" /></button>
  </div>;
}
function RegisteredDateInput({ methods, ...props }) {
  const value = useWatch({ control: methods.control, name: props.name });
  return <DatePicker {...props} value={value ?? ""} />;
}
export default function DateInput(props) {
  const methods = useFormContext();
  return methods && props.name ? <RegisteredDateInput methods={methods} {...props} /> : <DatePicker {...props} />;
}
