import { useCallback, useEffect, useRef, useState } from "react";
import { useController, useFormContext } from "react-hook-form";
import AsyncSelect from "react-select/async";
import axiosClient from "@/axios-client";

export default function Select2({
  name,
  endpoint,
  placeholder = "Select...",
  rules,
  disabled = false,
  clearable = true,
}) {
  const { control } = useFormContext();

  const {
    field,
    fieldState: { error },
  } = useController({
    name,
    control,
    rules,
  });

  const [selectedOption, setSelectedOption] = useState(null);
  const [loadError, setLoadError] = useState("");

  // Remember options already loaded to avoid fetching their labels again.
  const optionCache = useRef(new Map());

  const fetchOptions = useCallback(
    async (params = {}, signal) => {
      const { data: response } = await axiosClient.post(
        endpoint,
        params, // Laravel receives { q: "ahamed" } or { id: 12 }
        { signal }, // Axios uses this to cancel the request
      );

      const options = response?.data;

      if (
        response?.success !== true ||
        !Array.isArray(options) ||
        options.some(
          (option) => option?.id == null || typeof option.text !== "string",
        )
      ) {
        throw new Error(response?.message || "Invalid select response.");
      }

      options.forEach((option) => {
        optionCache.current.set(`${endpoint}:${String(option.id)}`, option);
      });

      return options;
    },
    [endpoint],
  );

  // Called automatically when the dropdown loads or the user searches.
  const loadOptions = useCallback(
    async (searchText) => {
      setLoadError("");

      try {
        return await fetchOptions({ q: searchText });
      } catch (error) {
        console.error("Select options could not be loaded:", error);
        setLoadError("Unable to load options. Please try again.");
        return [];
      }
    },
    [fetchOptions],
  );

  // Resolve the display text when reset() sets an existing ID for editing.
  useEffect(() => {
    const id = field.value;

    if (id === null || id === undefined || id === "") {
      setSelectedOption(null);
      return;
    }

    const cachedOption = optionCache.current.get(`${endpoint}:${String(id)}`);

    if (cachedOption) {
      setSelectedOption(cachedOption);
      setLoadError("");
      return;
    }

    const controller = new AbortController();

    setSelectedOption(null);
    setLoadError("");

    fetchOptions({ id }, controller.signal)
      .then((options) => {
        if (controller.signal.aborted) return;

        const option = options.find((item) => String(item.id) === String(id));

        setSelectedOption(option ?? null);

        if (!option) {
          setLoadError("The selected option is unavailable.");
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        console.error("Selected option could not be loaded:", error);
        setLoadError("Unable to load the selected option.");
      });

    return () => controller.abort();
  }, [endpoint, field.value, fetchOptions]);

  const handleChange = (option) => {
    if (option) {
      optionCache.current.set(`${endpoint}:${String(option.id)}`, option);
    }

    setSelectedOption(option);
    setLoadError("");

    // Only the ID is stored in React Hook Form.
    field.onChange(option?.id ?? null);
  };

  return (
    <div>
      <AsyncSelect
        key={endpoint}
        ref={field.ref}
        inputId={name}
        instanceId={name}
        name={name}
        value={selectedOption}
        onChange={handleChange}
        onBlur={field.onBlur}
        loadOptions={loadOptions}
        defaultOptions
        cacheOptions
        filterOption={null}
        getOptionValue={(option) => String(option.id)}
        getOptionLabel={(option) => option.text}
        placeholder={placeholder}
        isDisabled={disabled}
        isClearable={clearable}
        aria-invalid={!!error}
        aria-describedby={error || loadError ? `${name}-error` : undefined}
        loadingMessage={() => "Loading..."}
        noOptionsMessage={({ inputValue }) =>
          inputValue ? "No matching results." : "No options available."
        }
        classNamePrefix="select2"
      />

      {(error?.message || loadError) && (
        <p
          id={`${name}-error`}
          role="alert"
          className="mt-1 text-sm text-destructive"
        >
          {error?.message || loadError}
        </p>
      )}
    </div>
  );
}
