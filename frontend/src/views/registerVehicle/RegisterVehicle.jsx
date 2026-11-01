import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Plus, Trash2, Undo2, TriangleAlert } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import TableSearch from "@/components/TableSearch";
import FieldError from "@/components/ErrorField";
import { Input, NativeSelect } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import CustomDrawer from "@/components/Drawer";
import CarLoader from "@/components/CarLoader";
import axiosClient from "@/axios-client";

import "tabulator-tables/dist/css/tabulator.min.css";

const EMPTY_FORM = {
  number_plate: "",
  category: "",
  brand: "",
  model: "",
  manufacture_year: "",
  color: "",
  fuel_type: "",
  transmission: "",
  engine_number: "",
  chassis_number: "",
  mileage: "",
  seating_capacity: "",
  purchase_date: "",
  purchase_price: "",
  daily_rental_rate: "",
  weekly_rental_rate: "",
  monthly_rental_rate: "",
  insurance_expiry_date: "",
  registration_expiry_date: "",
  vehicle_status: "",
};

const EMPTY_OPTIONS = {
  categories: [],
  brands: [],
  models: [],
  fuels: [],
  transmissions: [],
  features: [],
};

const VEHICLE_STATUSES = [
  "Available",
  "Rented",
  "Under Maintenance",
  "Out of Service",
];

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const SECTIONS = [
  {
    title: "Vehicle identity",
    description: "Registration and basic vehicle details.",
    fields: [
      {
        name: "number_plate",
        label: "Vehicle Number Plate",
        required: true,
        maxLength: 50,
        placeholder: "e.g. CAB-1234",
        wide: true,
      },
      {
        name: "category",
        label: "Category",
        options: "categories",
        labelKey: "category_name",
        required: true,
      },
      {
        name: "brand",
        label: "Brand",
        options: "brands",
        labelKey: "brand_name",
        required: true,
      },
      {
        name: "model",
        label: "Model",
        options: "models",
        labelKey: "model_name",
        required: true,
      },
      {
        name: "manufacture_year",
        label: "Manufacture Year",
        type: "number",
        min: 1886,
        integer: true,
      },
      {
        name: "color",
        label: "Color",
        maxLength: 50,
        placeholder: "e.g. White",
      },
    ],
  },
  {
    title: "Specifications",
    description: "Technical information and capacity.",
    fields: [
      {
        name: "fuel_type",
        label: "Fuel Type",
        options: "fuels",
        labelKey: "fuel_type_name",
        required: true,
      },
      {
        name: "transmission",
        label: "Transmission",
        options: "transmissions",
        labelKey: "transmission_name",
        required: true,
      },
      { name: "engine_number", label: "Engine Number", maxLength: 100 },
      { name: "chassis_number", label: "Chassis Number", maxLength: 100 },
      { name: "mileage", label: "Mileage (km)", type: "number", min: 0 },
      {
        name: "seating_capacity",
        label: "Seating Capacity",
        type: "number",
        min: 1,
        max: 200,
        integer: true,
      },
    ],
  },
  {
    title: "Purchase & pricing",
    description: "Ownership details and rental rates.",
    fields: [
      { name: "purchase_date", label: "Purchase Date", type: "date" },
      {
        name: "purchase_price",
        label: "Purchase Price",
        type: "number",
        min: 0,
      },
      {
        name: "daily_rental_rate",
        label: "Daily Rental Rate",
        type: "number",
        min: 0,
        required: true,
      },
      {
        name: "weekly_rental_rate",
        label: "Weekly Rental Rate",
        type: "number",
        min: 0,
      },
      {
        name: "monthly_rental_rate",
        label: "Monthly Rental Rate",
        type: "number",
        min: 0,
      },
    ],
  },
  {
    title: "Compliance & availability",
    description: "Key dates and operating status.",
    fields: [
      {
        name: "insurance_expiry_date",
        label: "Insurance Expiry Date",
        type: "date",
      },
      {
        name: "registration_expiry_date",
        label: "Registration Expiry Date",
        type: "date",
      },
      {
        name: "vehicle_status",
        label: "Vehicle Status",
        statusOptions: true,
        required: true,
        wide: true,
      },
    ],
  },
];

function getErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

// IMAGE FUNCTIONALITY:
// Release each temporary URL when its preview is removed.
function NewImagePreview({ file, onRemove }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {url && (
        <img
          src={url}
          alt={`New vehicle photo: ${file.name}`}
          className="h-28 w-full object-cover"
        />
      )}

      <div className="space-y-2 p-2">
        <p className="truncate text-xs" title={file.name}>
          {file.name}
        </p>

        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"
        >
          <Trash2 size={13} aria-hidden="true" />
          Remove new image
        </button>
      </div>
    </div>
  );
}

export default function VehicleRegistration() {
  const [openDrawer, setOpenDrawer] = useState(false);
  const [updateId, setUpdateId] = useState("");
  const [options, setOptions] = useState(EMPTY_OPTIONS);

  const [tableLoading, setTableLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedFeatures, setSelectedFeatures] = useState([]);

  // IMAGE FUNCTIONALITY: saved images, new uploads and pending removals.
  const [savedImages, setSavedImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);

  const imageSequence = useRef(0);
  const fileInputRef = useRef(null);
  const tableRef = useRef(null);
  const table = useRef(null);
  const requestBusy = useRef(false);
  const mounted = useRef(false);
  const listRequest = useRef(null);
  const formRequest = useRef(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: EMPTY_FORM,
  });

  const selectedBrand = useWatch({ control, name: "brand" });

  const isEditing = updateId !== "";
  const isBusy = saving || formLoading;
  const maxYear = new Date().getFullYear() + 1;

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      listRequest.current?.abort();
      formRequest.current?.abort();
    };
  }, []);

  const resetExtras = useCallback(() => {
    setSelectedFeatures([]);
    setSavedImages([]);
    setNewImages([]);
    setRemovedImageIds([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // ================= LOAD TABLE AND REFERENCE DATA =================

  const getVehicles = useCallback(async () => {
    listRequest.current?.abort();

    const controller = new AbortController();
    listRequest.current = controller;

    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post(
        "/get_vehicles",
        {},
        { signal: controller.signal },
      );

      if (controller.signal.aborted || !mounted.current) return;

      if (
        !data.status ||
        !Array.isArray(data.data) ||
        !data.options ||
        !Object.keys(EMPTY_OPTIONS).every((key) =>
          Array.isArray(data.options[key]),
        )
      ) {
        throw new Error(data.message || "Unable to load vehicles.");
      }

      setOptions(data.options);
      await table.current?.setData(data.data);
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;

      setPageError(getErrorMessage(error, "Unable to load vehicles."));
    } finally {
      if (mounted.current && listRequest.current === controller) {
        listRequest.current = null;
        setTableLoading(false);
      }
    }
  }, []);

  // ================= OPEN CREATE FORM =================

  const openCreateDrawer = () => {
    if (requestBusy.current) return;

    reset({ ...EMPTY_FORM });
    resetExtras();
    setUpdateId("");
    setFormError("");
    setSuccessMessage("");
    setOpenDrawer(true);
  };

  // ================= FETCH FOR EDIT =================

  const fetchVehicleData = useCallback(
    async (id) => {
      if (!id || requestBusy.current) return;

      requestBusy.current = true;

      const controller = new AbortController();
      formRequest.current = controller;

      reset({ ...EMPTY_FORM });
      resetExtras();
      setUpdateId(id);
      setFormError("");
      setPageError("");
      setSuccessMessage("");
      setFormLoading(true);
      setOpenDrawer(true);

      try {
        const { data } = await axiosClient.post(
          "/fetch_vehicle_data",
          { upd_id: id },
          { signal: controller.signal },
        );

        if (controller.signal.aborted || !mounted.current) return;

        if (!data.status || !data.data) {
          throw new Error(data.message || "Unable to fetch vehicle.");
        }

        const vehicle = data.data;

        reset(
          Object.fromEntries(
            Object.keys(EMPTY_FORM).map((key) => [
              key,
              String(vehicle[key] ?? ""),
            ]),
          ),
        );

        setUpdateId(vehicle.ID);
        setSelectedFeatures((vehicle.features ?? []).map(String));

        // IMAGE FUNCTIONALITY: populate existing photos for editing.
        setSavedImages(vehicle.images ?? []);
      } catch (error) {
        if (controller.signal.aborted || !mounted.current) return;

        reset({ ...EMPTY_FORM });
        resetExtras();
        setUpdateId("");
        setOpenDrawer(false);
        setPageError(getErrorMessage(error, "Unable to fetch vehicle."));
      } finally {
        requestBusy.current = false;

        if (formRequest.current === controller) {
          formRequest.current = null;
        }

        if (mounted.current) setFormLoading(false);
      }
    },
    [reset, resetExtras],
  );

  // ================= FEATURES =================

  const toggleFeature = (id) => {
    const key = String(id);
    clearErrors("features");

    setSelectedFeatures((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  };

  // ================= IMAGE FUNCTIONALITY: SELECT =================

  const handleImageChange = (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) return;

    clearErrors("images");

    if (files.some((file) => !IMAGE_TYPES.includes(file.type))) {
      setError("images", {
        type: "manual",
        message: "Please select only JPG, PNG or WebP images.",
      });
      return;
    }

    if (files.some((file) => file.size > MAX_IMAGE_SIZE)) {
      setError("images", {
        type: "manual",
        message: "Each image must not exceed 2 MB.",
      });
      return;
    }

    const keptCount = savedImages.filter(
      (image) => !removedImageIds.includes(String(image.ID)),
    ).length;

    if (keptCount + newImages.length + files.length > MAX_IMAGES) {
      setError("images", {
        type: "manual",
        message: "A vehicle can have at most 10 images.",
      });
      return;
    }

    const additions = files.map((file) => ({
      key: ++imageSequence.current,
      file,
    }));

    setNewImages((current) => [...current, ...additions]);
  };

  // ================= IMAGE FUNCTIONALITY: REMOVE / RESTORE =================

  const toggleSavedImage = (id) => {
    const key = String(id);
    const restoring = removedImageIds.includes(key);

    if (restoring) {
      const currentCount =
        savedImages.length - removedImageIds.length + newImages.length;

      if (currentCount >= MAX_IMAGES) {
        setError("images", {
          type: "manual",
          message: "Remove a new image before restoring this photo.",
        });
        return;
      }
    }

    clearErrors("images");

    setRemovedImageIds((current) =>
      current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key],
    );
  };

  // ================= SAVE CREATE / UPDATE =================

  const saveVehicle = async (values) => {
    if (requestBusy.current) return;

    requestBusy.current = true;

    const controller = new AbortController();
    formRequest.current = controller;

    clearErrors();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    // IMAGE FUNCTIONALITY: multipart payload carries actual files.
    const payload = new FormData();

    Object.keys(EMPTY_FORM).forEach((key) => {
      const value = String(values[key] ?? "").trim();

      payload.append(key, key === "number_plate" ? value.toUpperCase() : value);
    });

    // Explicit [] supports clearing all previously selected features.
    payload.append("features", JSON.stringify(selectedFeatures));

    if (isEditing) payload.append("upd_id", String(updateId));

    newImages.forEach(({ file }) => {
      payload.append("images[]", file);
    });

    removedImageIds.forEach((id) => {
      payload.append("removed_image_ids[]", id);
    });

    try {
      // Browser sets multipart Content-Type and its boundary.
      const { data } = await axiosClient.post("/save_vehicle", payload, {
        signal: controller.signal,
      });

      if (controller.signal.aborted || !mounted.current) return;

      if (!data.status) {
        throw new Error(data.message || "Unable to save vehicle.");
      }

      reset({ ...EMPTY_FORM });
      resetExtras();
      setUpdateId("");
      setOpenDrawer(false);
      setSuccessMessage(data.message || "Vehicle saved successfully.");

      await getVehicles();
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;

      if (error.response?.status === 422) {
        const serverErrors = error.response.data.errors ?? {};
        const generalMessages = [];
        const groupedMessages = {};

        Object.entries(serverErrors).forEach(([field, messages]) => {
          const message = Array.isArray(messages)
            ? messages[0]
            : String(messages);

          const root = field.split(".")[0];

          if (root === "images" || root === "features") {
            groupedMessages[root] ??= [];
            groupedMessages[root].push(message);
          } else if (Object.prototype.hasOwnProperty.call(EMPTY_FORM, field)) {
            setError(field, { type: "server", message });
          } else {
            generalMessages.push(message);
          }
        });

        Object.entries(groupedMessages).forEach(([field, messages]) => {
          setError(field, {
            type: "server",
            message: [...new Set(messages)].join(" "),
          });
        });

        if (generalMessages.length) {
          setFormError(generalMessages.join(" "));
        } else if (!Object.keys(serverErrors).length) {
          setFormError(
            error.response.data.message || "Please check the submitted values.",
          );
        }
      } else {
        setFormError(getErrorMessage(error, "Unable to save vehicle."));
      }
    } finally {
      requestBusy.current = false;

      if (formRequest.current === controller) {
        formRequest.current = null;
      }

      if (mounted.current) setSaving(false);
    }
  };

  const handleDrawerChange = (open) => {
    if (requestBusy.current) return;

    setOpenDrawer(open);

    if (!open) {
      reset({ ...EMPTY_FORM });
      resetExtras();
      setUpdateId("");
      setFormError("");
    }
  };

  // ================= INITIALIZE TABLE =================

  useEffect(() => {
    const vehicleTable = new Tabulator(tableRef.current, {
      index: "id",
      layout: "fitColumns",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",
      placeholder: "No vehicles found.",

      columns: [
        {
          title: "Number Plate",
          field: "number_plate",
          formatter: "plaintext",
          frozen: true,
          width: 160,
        },
        { title: "Brand", field: "brand", formatter: "plaintext", width: 130 },
        { title: "Model", field: "model", formatter: "plaintext", width: 140 },
        {
          title: "Category",
          field: "category",
          formatter: "plaintext",
          width: 130,
        },
        {
          title: "Fuel Type",
          field: "fuel_type",
          formatter: "plaintext",
          width: 110,
        },
        {
          title: "Daily Rate",
          field: "daily_rental_rate",
          hozAlign: "right",
          width: 150,
          formatter: (cell) => {
            const value = cell.getValue();

            return value === null || value === ""
              ? "-"
              : `Rs. ${Number(value).toLocaleString("en-LK", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`;
          },
        },
        {
          title: "Status",
          field: "status",
          width: 170,
          hozAlign: "center",
          formatter: (cell) => {
            const value = cell.getValue();
            const styles = {
              Available: "bg-[var(--success-soft)] text-[var(--success)]",
              Rented: "bg-[var(--info-soft)] text-primary",
              "Under Maintenance":
                "bg-[var(--warning-soft)] text-[var(--warning)]",
              "Out of Service": "bg-[var(--danger-soft)] text-destructive",
            };

            const badge = document.createElement("span");

            badge.className =
              "inline-flex rounded-full px-3 py-1 text-xs font-medium " +
              (styles[value] || "bg-muted text-foreground");

            badge.textContent = value || "Unknown";

            return badge;
          },
        },
        {
          title: "Actions",
          field: "id",
          width: 100,
          headerSort: false,
          hozAlign: "center",
          formatter: () => `
            <button
              type="button"
              class="table-action-btn"
              aria-label="Edit vehicle"
              title="Edit vehicle"
            >
              <svg
                aria-hidden="true"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="m16 3 5 5M9 15l-1 4 4-1L22 8a2.1 2.1 0 0 0-5-5Z"/>
              </svg>
            </button>
          `,
          cellClick: (event, cell) => {
            if (!event.target.closest("button")) return;

            void fetchVehicleData(cell.getRow().getData().id);
          },
        },
      ],
    });

    table.current = vehicleTable;
    vehicleTable.on("tableBuilt", getVehicles);

    return () => {
      listRequest.current?.abort();
      vehicleTable.off("tableBuilt", getVehicles);
      vehicleTable.destroy();

      if (table.current === vehicleTable) table.current = null;
    };
  }, [fetchVehicleData, getVehicles]);

  // ================= FORM FIELDS =================

  const renderField = (field) => {
    const id = `vehicle_${field.name}`;
    const rules = {};

    if (field.required) {
      rules.required = `${field.label} is required.`;
    }

    if (field.maxLength) {
      rules.maxLength = {
        value: field.maxLength,
        message: `Maximum ${field.maxLength} characters.`,
      };
    }

    if (field.type === "number") {
      rules.validate = (value) => {
        if (value === "") return true;

        const number = Number(value);

        if (!Number.isFinite(number)) return "Enter a valid number.";

        if (field.integer && !Number.isInteger(number)) {
          return "Enter a whole number.";
        }

        if (field.min !== undefined && number < field.min) {
          return `Minimum value is ${field.min}.`;
        }

        const maximum = field.name === "manufacture_year" ? maxYear : field.max;

        if (maximum !== undefined && number > maximum) {
          return `Maximum value is ${maximum}.`;
        }

        return true;
      };
    } else if (field.required && !field.options && !field.statusOptions) {
      rules.validate = (value) =>
        String(value).trim().length > 0 ||
        `${field.label} cannot contain only spaces.`;
    }

    if (field.name === "brand") {
      rules.onChange = () => {
        setValue("model", "", { shouldDirty: true });
        clearErrors("model");
      };
    }

    let entries = field.options ? options[field.options] : [];

    if (field.name === "model") {
      entries = entries.filter(
        (model) => String(model.brand_id) === String(selectedBrand),
      );
    }

    return (
      <div key={field.name} className={field.wide ? "sm:col-span-2" : ""}>
        <label htmlFor={id} className="mb-2 block text-sm font-semibold">
          {field.label}
          {!field.required && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              Optional
            </span>
          )}
        </label>

        {field.options || field.statusOptions ? (
          <NativeSelect
            id={id}
            className="custom-input-sm"
            aria-invalid={!!errors[field.name]}
            disabled={field.name === "model" && !selectedBrand}
            {...register(field.name, rules)}
          >
            <option value="">Select {field.label.toLowerCase()}</option>

            {field.statusOptions
              ? VEHICLE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))
              : entries.map((entry) => (
                  <option key={entry.ID} value={String(entry.ID)}>
                    {entry[field.labelKey]}
                    {field.name === "model" && entry.manufacture_year
                      ? ` (${entry.manufacture_year})`
                      : ""}
                  </option>
                ))}
          </NativeSelect>
        ) : (
          <Input
            id={id}
            type={field.type ?? "text"}
            maxLength={field.maxLength}
            min={field.min}
            max={field.name === "manufacture_year" ? maxYear : field.max}
            step={
              field.type === "number"
                ? field.integer
                  ? "1"
                  : "0.01"
                : undefined
            }
            placeholder={
              field.placeholder ?? `Enter ${field.label.toLowerCase()}`
            }
            className="custom-input-sm"
            aria-invalid={!!errors[field.name]}
            {...register(field.name, rules)}
          />
        )}

        <FieldError errors={errors} name={field.name} />
      </div>
    );
  };

  const keptImageCount =
    savedImages.length - removedImageIds.length + newImages.length;

  let submitText = isEditing ? "Update Vehicle" : "Save Vehicle";

  if (formLoading) submitText = "Loading...";
  else if (saving) submitText = isEditing ? "Updating..." : "Saving...";

  return (
    <>
      <PageHeader
        title="Vehicle Registration"
        sub_text="Register, manage and maintain fleet vehicles."
        breadcrumbs={[{ label: "Vehicle" }, { label: "Vehicle Registration" }]}
      />

      <div className="management-page">
        <div className="page-container">
          {pageError && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-[var(--danger-soft)] px-4 py-3"
            >
              <TriangleAlert
                size={16}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-destructive"
              />

              <div>
                <p className="text-sm text-destructive">{pageError}</p>
                <button
                  type="button"
                  disabled={tableLoading}
                  onClick={() => void getVehicles()}
                  className="mt-2 text-sm font-semibold underline disabled:opacity-50"
                >
                  Retry loading vehicles
                </button>
              </div>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-border bg-[var(--info-soft)] px-4 py-3 text-sm text-primary"
            >
              {successMessage}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <button
              type="button"
              className="btn-primary management-add"
              disabled={isBusy || tableLoading}
              onClick={openCreateDrawer}
            >
              <Plus size={16} aria-hidden="true" className="mr-2" />
              Add Vehicle
            </button>

            <CustomDrawer
              open={openDrawer}
              setOpen={handleDrawerChange}
              saving={isBusy}
              title={isEditing ? "Update Vehicle" : "Register Vehicle"}
              description="Manage vehicle details, features and photographs."
              submitText={submitText}
              onSubmit={handleSubmit(saveVehicle)}
              size="max-w-3xl"
            >
              {formError && (
                <div role="alert" className="form-alert mb-5">
                  {formError}
                </div>
              )}

              {formLoading && (
                <p role="status" className="mb-4 text-sm text-muted-foreground">
                  Loading vehicle details...
                </p>
              )}

              <form
                noValidate
                aria-busy={isBusy}
                onSubmit={handleSubmit(saveVehicle)}
              >
                <fieldset
                  disabled={isBusy}
                  className="m-0 min-w-0 space-y-7 border-0 p-0"
                >
                  {SECTIONS.map((section) => (
                    <section key={section.title}>
                      <div className="form-section-heading mb-4">
                        <h2>{section.title}</h2>
                        <p>{section.description}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {section.fields.map(renderField)}
                      </div>
                    </section>
                  ))}

                  <section>
                    <div className="form-section-heading mb-4">
                      <h2>Vehicle features</h2>
                      <p>Select the features available in this vehicle.</p>
                    </div>

                    {options.features.length ? (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {options.features.map((feature) => (
                          <label
                            key={feature.ID}
                            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedFeatures.includes(
                                String(feature.ID),
                              )}
                              onChange={() => toggleFeature(feature.ID)}
                              className="h-4 w-4 accent-primary"
                            />
                            <span>{feature.feature_name}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No vehicle features found. You can save without
                        features.
                      </p>
                    )}

                    <FieldError errors={errors} name="features" />
                  </section>

                  {/* IMAGE FUNCTIONALITY: saved and newly selected photos */}
                  <section>
                    <div className="form-section-heading mb-4">
                      <h2>Vehicle images</h2>
                      <p>
                        Up to 10 photos. JPG, PNG or WebP, maximum 2 MB each.
                      </p>
                    </div>

                    <label
                      htmlFor="registered_vehicle_images"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Upload photographs
                    </label>

                    <input
                      ref={fileInputRef}
                      id="registered_vehicle_images"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleImageChange}
                      aria-invalid={!!errors.images}
                      className="block w-full rounded-lg border border-border bg-card text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-primary file:px-4 file:py-3 file:font-medium file:text-primary-foreground"
                    />

                    <FieldError errors={errors} name="images" />

                    <p className="mt-2 text-xs text-muted-foreground">
                      {keptImageCount}/{MAX_IMAGES} photos selected. Changes are
                      applied when you save.
                    </p>

                    {(savedImages.length > 0 || newImages.length > 0) && (
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {savedImages.map((image) => {
                          const removed = removedImageIds.includes(
                            String(image.ID),
                          );

                          return (
                            <div
                              key={`saved-${image.ID}`}
                              className="overflow-hidden rounded-xl border border-border bg-card"
                            >
                              <img
                                src={image.url}
                                alt="Saved vehicle photograph"
                                className={`h-28 w-full object-cover ${
                                  removed ? "opacity-30" : ""
                                }`}
                              />

                              <div className="space-y-2 p-2">
                                <p className="text-xs text-muted-foreground">
                                  {removed
                                    ? "Will be removed on save"
                                    : "Saved image"}
                                </p>

                                <button
                                  type="button"
                                  onClick={() => toggleSavedImage(image.ID)}
                                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                    removed
                                      ? "text-primary"
                                      : "text-destructive"
                                  }`}
                                >
                                  {removed ? (
                                    <Undo2 size={13} aria-hidden="true" />
                                  ) : (
                                    <Trash2 size={13} aria-hidden="true" />
                                  )}
                                  {removed ? "Restore" : "Remove"}
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {newImages.map((item) => (
                          <NewImagePreview
                            key={item.key}
                            file={item.file}
                            onRemove={() => {
                              setNewImages((current) =>
                                current.filter(
                                  (entry) => entry.key !== item.key,
                                ),
                              );
                              clearErrors("images");
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                </fieldset>
              </form>
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold">
                      Registered Vehicle List
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage fleet vehicles in your branch.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Vehicles
                  </span>
                </div>

                <div
                  id="registered-vehicle-tb"
                  className="relative p-6"
                  aria-busy={tableLoading}
                >
                  <TableSearch table={table} />
                  <div
                    ref={tableRef}
                    className="overflow-hidden rounded-xl border border-border"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CarLoader
        targetId="registered-vehicle-tb"
        show={tableLoading}
        text="Loading Registered Vehicles"
      />
    </>
  );
}
