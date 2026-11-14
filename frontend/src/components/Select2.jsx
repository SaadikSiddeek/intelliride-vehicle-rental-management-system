import { useCallback, useEffect, useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import AsyncSelect from "react-select/async";
import axiosClient from "@/axios-client";
import "./select2.css";

export default function Select2({ name, endpoint, placeholder = "Select...", rules, disabled = false, clearable = true, onValueChange }) {
  const { control } = useFormContext();
  const { field, fieldState: { error } } = useController({ name, control, rules });
  const [cache, setCache] = useState({});
  const [failure, setFailure] = useState(null);
  const id = field.value;
  const hasValue = id !== null && id !== undefined && id !== "";
  const cacheKey = `${endpoint}:${String(id)}`;
  const selectedOption = hasValue ? cache[cacheKey] || null : null;
  const loadError = failure?.endpoint === endpoint && (failure.id === undefined || String(failure.id) === String(id)) ? failure.message : "";
  const fetchOptions = useCallback(async (params = {}, signal) => {
    const { data: response } = await axiosClient.post(endpoint, params, { signal });
    const options = response?.data;
    if (response?.success !== true || !Array.isArray(options) || options.some(o => o?.id == null || typeof o.text !== "string")) throw new Error("Invalid select response.");
    return options;
  }, [endpoint]);
  const remember = useCallback(options => setCache(previous => ({ ...previous, ...Object.fromEntries(options.map(o => [`${endpoint}:${String(o.id)}`, o])) })), [endpoint]);
  const loadOptions = useCallback(async q => {
    setFailure(null);
    try { const options = await fetchOptions({ q }); remember(options); return options; }
    catch { setFailure({ endpoint, message: "Unable to load options. Please try again." }); return []; }
  }, [endpoint, fetchOptions, remember]);
  useEffect(() => {
    if (!hasValue || selectedOption) return;
    const request = new AbortController();
    fetchOptions({ id }, request.signal).then(options => {
      if (!request.signal.aborted) { remember(options); setFailure(options.some(o => String(o.id) === String(id)) ? null : { endpoint, id, message: "The selected option is unavailable." }); }
    }).catch(() => { if (!request.signal.aborted) setFailure({ endpoint, id, message: "Unable to load the selected option." }); });
    return () => request.abort();
  }, [endpoint, id, hasValue, selectedOption, fetchOptions, remember]);
  const handleChange = option => {
    if (option) setCache(previous => ({ ...previous, [`${endpoint}:${String(option.id)}`]: option }));
    setFailure(null);
    field.onChange(option?.id ?? null);
    onValueChange?.(option?.id ?? null);
  };
  return <div className={`ir-select2 ${error ? "ir-select2-invalid" : ""}`}>
    <AsyncSelect key={`${endpoint}:${disabled ? 'disabled' : 'enabled'}`} ref={node => field.ref(node)} inputId={name} instanceId={name} name={name} value={selectedOption} onChange={handleChange} onBlur={() => field.onBlur()} loadOptions={loadOptions} defaultOptions={!disabled} cacheOptions filterOption={null} getOptionValue={o => String(o.id)} getOptionLabel={o => o.text} placeholder={placeholder} isDisabled={disabled} isClearable={clearable} aria-invalid={!!error} aria-describedby={error || loadError ? `${name}-error` : undefined} loadingMessage={() => "Loading..."} noOptionsMessage={({ inputValue }) => loadError || (inputValue ? "No matching results." : "No options available.")} classNamePrefix="select2" unstyled />
    {(error?.message || loadError) && <p id={`${name}-error`} role="alert" className="field-error">{error?.message || loadError}</p>}
  </div>;
}
