import { useController, useFormContext } from "react-hook-form";
import { DatePicker } from "@/components/DateInput";

// The API field names are supplied explicitly; existing reports use from/to.
export default function DateRange({ fromName = "from", toName = "to", ...props }) {
  const { control, setValue, getValues, trigger, formState } = useFormContext();
  const { field: { value: fromValue, onBlur: blurFrom, ref: fromRef }, fieldState: fromState } = useController({ name: fromName, control, rules: { validate: value => !value || !!getValues(toName) || "Select the end of the date range." } });
  const { field: { value: toValue, onBlur: blurTo }, fieldState: toState } = useController({ name: toName, control, rules: { validate: value => !value || (!!getValues(fromName) && value >= getValues(fromName)) || "End date must be on or after the start date." } });
  const error = fromState.error?.message || toState.error?.message;
  return <div className="date-range-field">
    <DatePicker {...props} range value={[fromValue, toValue].filter(Boolean)} ref={fromRef} aria-invalid={!!error} aria-describedby={error ? `${props.id}-error` : undefined} onBlur={() => { blurFrom(); blurTo(); }} onValueChange={dates => {
      setValue(fromName, dates[0] || "", { shouldDirty: true });
      setValue(toName, dates[1] || "", { shouldDirty: true });
      if (formState.isSubmitted) void trigger([fromName, toName]);
    }} />
    {error && <span id={`${props.id}-error`} className="field-error" role="alert">{error}</span>}
  </div>;
}
