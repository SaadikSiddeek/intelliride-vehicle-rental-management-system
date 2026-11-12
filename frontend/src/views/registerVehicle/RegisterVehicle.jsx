import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Plus, Trash2, Undo2, TriangleAlert } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import TableSearch from "@/components/TableSearch";
import FieldError from "@/components/ErrorField";
import { Input, NativeSelect } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import CustomDrawer from "@/components/Drawer";
import CarLoader from "@/components/CarLoader";
import axiosClient from "@/axios-client";
import Select2 from "@/components/Select2";

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

// Used to name the field in the error summary at the top of the form.
const FIELD_LABELS = {
  number_plate: "Vehicle Number Plate",
  category: "Category",
  brand: "Brand",
  model: "Model",
  manufacture_year: "Manufacture Year",
  color: "Color",
  fuel_type: "Fuel Type",
  transmission: "Transmission",
  engine_number: "Engine Number",
  chassis_number: "Chassis Number",
  mileage: "Mileage",
  seating_capacity: "Seating Capacity",
  purchase_date: "Purchase Date",
  purchase_price: "Purchase Price",
  daily_rental_rate: "Daily Rental Rate",
  weekly_rental_rate: "Weekly Rental Rate",
  monthly_rental_rate: "Monthly Rental Rate",
  insurance_expiry_date: "Insurance Expiry Date",
  registration_expiry_date: "Registration Expiry Date",
  vehicle_status: "Vehicle Status",
  features: "Features",
  images: "Images",
};

const EMPTY_OPTIONS = {
  categories: [],
  models: [],
  features: [],
};

const MAX_IMAGES = 10;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Turns any failed request into a message the user can understand.
function getErrorMessage(error, fallback) {
  const response = error.response;

  // The request never reached the server (or no reply came back).
  if (!response) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return "The request timed out. Please check your connection and try again.";
    }

    if (error.code === "ERR_NETWORK" || error.message === "Network Error") {
      return "Cannot reach the server. Please check your internet connection and try again.";
    }

    return error.message || fallback;
  }

  const data =
    response.data && typeof response.data === "object" ? response.data : {};

  switch (response.status) {
    case 401:
      return "Your session has expired. Please log in again.";
    case 413:
      return "The selected images are too large to upload together. Remove some images or use smaller ones.";
    case 419:
      return "Your session has expired. Please refresh the page and try again.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      break;
  }

  const serverMessage =
    typeof data.message === "string" ? data.message.trim() : "";
  const details = data.debug ? ` Details: ${data.debug}` : "";

  if (serverMessage) return serverMessage + details;

  return `${fallback} (Server responded with status ${response.status}.)`;
}

// IMAGE FUNCTIONALITY:
// Release each temporary URL when its preview is removed.
function NewImagePreview({ file, onRemove }) {
  const imageRef = useRef(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    if (imageRef.current) imageRef.current.src = objectUrl;

    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {(
        <img
          ref={imageRef}
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
  const [formErrorList, setFormErrorList] = useState([]);
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
  const errorBannerRef = useRef(null);

  const methods = useForm({
    defaultValues: EMPTY_FORM,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    clearErrors,
    setError,
    formState: { errors },
  } = methods;

  const selectedBrand = useWatch({ control, name: "brand" });

  const isEditing = updateId !== "";
  const isBusy = saving || formLoading;
  const maxYear = new Date().getFullYear() + 1;

  // Sets (or clears) the error banner shown at the top of the form.
  const showFormError = useCallback((message, list = []) => {
    setFormError(message);
    setFormErrorList(list);
  }, []);

  // Bring the error banner into view so the user always sees why it failed.
  useEffect(() => {
    if (formError) {
      errorBannerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [formError, formErrorList]);

  // Clear an incompatible model after the brand selection changes.
  useEffect(() => {
    if (formLoading) return;
    const modelId = getValues("model");
    if (!modelId) return;
    const matchesBrand = options.models.some(
      (model) =>
        String(model.ID) === String(modelId) &&
        String(model.brand_id) === String(selectedBrand),
    );
    if (!matchesBrand) {
      setValue("model", "", { shouldDirty: true });
      clearErrors("model");
    }
  }, [
    selectedBrand,
    options.models,
    formLoading,
    getValues,
    setValue,
    clearErrors,
  ]);

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

      setOptions({
        categories: data.options.categories,
        models: data.options.models,
        features: data.options.features,
      });
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
    showFormError("");
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
      showFormError("");
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
    [reset, resetExtras, showFormError],
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
    showFormError("");
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
      showFormError("");
      setSuccessMessage(data.message || "Vehicle saved successfully.");

      await getVehicles();
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;

      const responseData =
        error.response?.data && typeof error.response.data === "object"
          ? error.response.data
          : {};

      if (error.response?.status === 422) {
        const serverErrors =
          responseData.errors && typeof responseData.errors === "object"
            ? responseData.errors
            : {};
        const summary = [];
        const groupedMessages = {};

        Object.entries(serverErrors).forEach(([field, messages]) => {
          const list = (Array.isArray(messages) ? messages : [messages]).map(
            String,
          );

          const root = field.split(".")[0];

          if (root === "images" || root === "features") {
            groupedMessages[root] ??= [];
            groupedMessages[root].push(...list);
          } else if (Object.prototype.hasOwnProperty.call(EMPTY_FORM, field)) {
            // Show the error under the field itself.
            setError(field, { type: "server", message: list[0] });
          }

          // Every message also goes in the summary at the top, so nothing
          // is hidden when the field is scrolled out of view.
          summary.push(...list);
        });

        Object.entries(groupedMessages).forEach(([field, messages]) => {
          setError(field, {
            type: "server",
            message: [...new Set(messages)].join(" "),
          });
        });

        if (summary.length) {
          showFormError("Please correct the following before saving:", [
            ...new Set(summary),
          ]);
        } else {
          showFormError(
            responseData.message || "Please check the submitted values.",
          );
        }
      } else {
        showFormError(getErrorMessage(error, "Unable to save vehicle."));
      }
    } finally {
      requestBusy.current = false;

      if (formRequest.current === controller) {
        formRequest.current = null;
      }

      if (mounted.current) setSaving(false);
    }
  };

  // Runs when client-side validation fails, so the user is told exactly why
  // nothing was submitted instead of the button seeming to do nothing.
  const onInvalid = (formErrors) => {
    const items = Object.entries(formErrors ?? {}).map(([name, err]) => {
      const label = FIELD_LABELS[name] || name;

      return `${label}: ${err?.message || "Invalid value."}`;
    });

    setSuccessMessage("");
    showFormError(
      "Please correct the following before saving:",
      items.length ? items : [],
    );
  };

  // The images/features errors are not registered inputs. react-hook-form
  // would keep them and silently block every later submit, so clear them
  // first. The server re-validates both anyway.
  const submitForm = (event) => {
    clearErrors(["images", "features"]);

    return handleSubmit(saveVehicle, onInvalid)(event);
  };

  const handleDrawerChange = (open) => {
    if (requestBusy.current) return;

    setOpenDrawer(open);

    if (!open) {
      reset({ ...EMPTY_FORM });
      resetExtras();
      setUpdateId("");
      showFormError("");
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
              onSubmit={submitForm}
              size="max-w-3xl"
            >
              {formError && (
                <div
                  ref={errorBannerRef}
                  role="alert"
                  className="form-alert mb-5"
                >
                  <div>
                    {formError}
                    {formErrorList.length > 0 && (
                      <ul className="mt-2 list-disc pl-5">
                        {formErrorList.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {formLoading && (
                <p role="status" className="mb-4 text-sm text-muted-foreground">
                  Loading vehicle details...
                </p>
              )}

              <FormProvider {...methods}>
                <form noValidate aria-busy={isBusy} onSubmit={submitForm}>
                  <fieldset
                    disabled={isBusy}
                    className="m-0 min-w-0 space-y-7 border-0 p-0"
                  >
                    <section>
                      <div className="form-section-heading mb-4">
                        <h2>Vehicle identity</h2>
                        <p>Registration and basic vehicle details.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="vehicle_number_plate"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Vehicle Number Plate
                          </label>
                          <Input
                            id="vehicle_number_plate"
                            type="text"
                            maxLength={50}
                            placeholder="e.g. CAB-1234"
                            className="custom-input-sm"
                            aria-invalid={!!errors.number_plate}
                            {...register("number_plate", {
                              required: "Vehicle Number Plate is required.",
                              maxLength: {
                                value: 50,
                                message: "Maximum 50 characters.",
                              },
                              validate: (value) =>
                                String(value).trim().length > 0 ||
                                "Vehicle Number Plate cannot contain only spaces.",
                            })}
                          />
                          <FieldError errors={errors} name="number_plate" />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_category"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Category
                          </label>

                          <Select2
                            name="category"
                            endpoint="/vehciel_category_filter"
                            placeholder="Select category..."
                            disabled={isBusy}
                            rules={{ required: "Please select a category." }}
                          />

                          <FieldError errors={errors} name="category" />
                        </div>
                        <div>
                          <label
                            htmlFor="brand"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Brand
                          </label>
                          <Select2
                            name="brand"
                            endpoint="/brand_filter"
                            placeholder="Select brand..."
                            disabled={isBusy}
                            rules={{ required: "Please select a brand." }}
                          />
                          <FieldError errors={errors} name="brand" />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_model"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Model
                          </label>

                          <Select2
                            name="model"
                            endpoint="/model_filter"
                            placeholder="Select model..."
                            disabled={isBusy}
                            rules={{ required: "Please select a model." }}
                          />

                          <FieldError errors={errors} name="model" />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_manufacture_year"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Manufacture Year
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_manufacture_year"
                            type="number"
                            min={1886}
                            max={maxYear}
                            step="1"
                            placeholder="Enter manufacture year"
                            className="custom-input-sm"
                            aria-invalid={!!errors.manufacture_year}
                            {...register("manufacture_year", {
                              validate: (value) => {
                                if (value === "") return true;
                                const number = Number(value);
                                if (!Number.isFinite(number))
                                  return "Enter a valid number.";
                                if (!Number.isInteger(number))
                                  return "Enter a whole number.";
                                if (number < 1886)
                                  return "Minimum value is 1886.";
                                if (number > maxYear)
                                  return `Maximum value is ${maxYear}.`;
                                return true;
                              },
                            })}
                          />
                          <FieldError errors={errors} name="manufacture_year" />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_color"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Color
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_color"
                            type="text"
                            maxLength={50}
                            placeholder="e.g. White"
                            className="custom-input-sm"
                            aria-invalid={!!errors.color}
                            {...register("color", {
                              maxLength: {
                                value: 50,
                                message: "Maximum 50 characters.",
                              },
                            })}
                          />
                          <FieldError errors={errors} name="color" />
                        </div>
                      </div>
                    </section>
                    <section>
                      <div className="form-section-heading mb-4">
                        <h2>Specifications</h2>
                        <p>Technical information and capacity.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="fuel_type"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Fuel Type
                          </label>
                          <Select2
                            name="fuel_type"
                            endpoint="/fuel_type_filter"
                            placeholder="Select fuel type..."
                            disabled={isBusy}
                            rules={{ required: "Please select a fuel type." }}
                          />
                          <FieldError errors={errors} name="fuel_type" />
                        </div>
                        <div>
                          <label
                            htmlFor="transmission"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Transmission
                          </label>
                          <Select2
                            name="transmission"
                            endpoint="/transmission_type_filter"
                            placeholder="Select transmission..."
                            disabled={isBusy}
                            rules={{
                              required: "Please select a transmission.",
                            }}
                          />
                          <FieldError errors={errors} name="transmission" />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_engine_number"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Engine Number
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_engine_number"
                            type="text"
                            maxLength={100}
                            placeholder="Enter engine number"
                            className="custom-input-sm"
                            aria-invalid={!!errors.engine_number}
                            {...register("engine_number", {
                              maxLength: {
                                value: 100,
                                message: "Maximum 100 characters.",
                              },
                            })}
                          />
                          <FieldError errors={errors} name="engine_number" />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_chassis_number"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Chassis Number
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_chassis_number"
                            type="text"
                            maxLength={100}
                            placeholder="Enter chassis number"
                            className="custom-input-sm"
                            aria-invalid={!!errors.chassis_number}
                            {...register("chassis_number", {
                              maxLength: {
                                value: 100,
                                message: "Maximum 100 characters.",
                              },
                            })}
                          />
                          <FieldError errors={errors} name="chassis_number" />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_mileage"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Mileage (km)
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_mileage"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Enter mileage (km)"
                            className="custom-input-sm"
                            aria-invalid={!!errors.mileage}
                            {...register("mileage", {
                              validate: (value) => {
                                if (value === "") return true;
                                const number = Number(value);
                                if (!Number.isFinite(number))
                                  return "Enter a valid number.";
                                if (number < 0) return "Minimum value is 0.";
                                return true;
                              },
                            })}
                          />
                          <FieldError errors={errors} name="mileage" />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_seating_capacity"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Seating Capacity
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_seating_capacity"
                            type="number"
                            min={1}
                            max={200}
                            step="1"
                            placeholder="Enter seating capacity"
                            className="custom-input-sm"
                            aria-invalid={!!errors.seating_capacity}
                            {...register("seating_capacity", {
                              validate: (value) => {
                                if (value === "") return true;
                                const number = Number(value);
                                if (!Number.isFinite(number))
                                  return "Enter a valid number.";
                                if (!Number.isInteger(number))
                                  return "Enter a whole number.";
                                if (number < 1) return "Minimum value is 1.";
                                if (number > 200)
                                  return "Maximum value is 200.";
                                return true;
                              },
                            })}
                          />
                          <FieldError errors={errors} name="seating_capacity" />
                        </div>
                      </div>
                    </section>
                    <section>
                      <div className="form-section-heading mb-4">
                        <h2>Purchase &amp; pricing</h2>
                        <p>Ownership details and rental rates.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="vehicle_purchase_date"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Purchase Date
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_purchase_date"
                            type="date"
                            placeholder="Enter purchase date"
                            className="custom-input-sm"
                            aria-invalid={!!errors.purchase_date}
                            {...register("purchase_date", {})}
                          />
                          <FieldError errors={errors} name="purchase_date" />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_purchase_price"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Purchase Price
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_purchase_price"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Enter purchase price"
                            className="custom-input-sm"
                            aria-invalid={!!errors.purchase_price}
                            {...register("purchase_price", {
                              validate: (value) => {
                                if (value === "") return true;
                                const number = Number(value);
                                if (!Number.isFinite(number))
                                  return "Enter a valid number.";
                                if (number < 0) return "Minimum value is 0.";
                                return true;
                              },
                            })}
                          />
                          <FieldError errors={errors} name="purchase_price" />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_daily_rental_rate"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Daily Rental Rate
                          </label>
                          <Input
                            id="vehicle_daily_rental_rate"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Enter daily rental rate"
                            className="custom-input-sm"
                            aria-invalid={!!errors.daily_rental_rate}
                            {...register("daily_rental_rate", {
                              required: "Daily Rental Rate is required.",
                              validate: (value) => {
                                if (value === "") return true;
                                const number = Number(value);
                                if (!Number.isFinite(number))
                                  return "Enter a valid number.";
                                if (number < 0) return "Minimum value is 0.";
                                return true;
                              },
                            })}
                          />
                          <FieldError
                            errors={errors}
                            name="daily_rental_rate"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_weekly_rental_rate"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Weekly Rental Rate
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_weekly_rental_rate"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Enter weekly rental rate"
                            className="custom-input-sm"
                            aria-invalid={!!errors.weekly_rental_rate}
                            {...register("weekly_rental_rate", {
                              validate: (value) => {
                                if (value === "") return true;
                                const number = Number(value);
                                if (!Number.isFinite(number))
                                  return "Enter a valid number.";
                                if (number < 0) return "Minimum value is 0.";
                                return true;
                              },
                            })}
                          />
                          <FieldError
                            errors={errors}
                            name="weekly_rental_rate"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_monthly_rental_rate"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Monthly Rental Rate
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_monthly_rental_rate"
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Enter monthly rental rate"
                            className="custom-input-sm"
                            aria-invalid={!!errors.monthly_rental_rate}
                            {...register("monthly_rental_rate", {
                              validate: (value) => {
                                if (value === "") return true;
                                const number = Number(value);
                                if (!Number.isFinite(number))
                                  return "Enter a valid number.";
                                if (number < 0) return "Minimum value is 0.";
                                return true;
                              },
                            })}
                          />
                          <FieldError
                            errors={errors}
                            name="monthly_rental_rate"
                          />
                        </div>
                      </div>
                    </section>
                    <section>
                      <div className="form-section-heading mb-4">
                        <h2>Compliance &amp; availability</h2>
                        <p>Key dates and operating status.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="vehicle_insurance_expiry_date"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Insurance Expiry Date
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_insurance_expiry_date"
                            type="date"
                            placeholder="Enter insurance expiry date"
                            className="custom-input-sm"
                            aria-invalid={!!errors.insurance_expiry_date}
                            {...register("insurance_expiry_date", {})}
                          />
                          <FieldError
                            errors={errors}
                            name="insurance_expiry_date"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="vehicle_registration_expiry_date"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Registration Expiry Date
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Optional
                            </span>
                          </label>
                          <Input
                            id="vehicle_registration_expiry_date"
                            type="date"
                            placeholder="Enter registration expiry date"
                            className="custom-input-sm"
                            aria-invalid={!!errors.registration_expiry_date}
                            {...register("registration_expiry_date", {})}
                          />
                          <FieldError
                            errors={errors}
                            name="registration_expiry_date"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="vehicle_vehicle_status"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Vehicle Status
                          </label>
                          <NativeSelect
                            id="vehicle_vehicle_status"
                            className="custom-input-sm"
                            aria-invalid={!!errors.vehicle_status}
                            disabled={isBusy}
                            {...register("vehicle_status", {
                              required: "Vehicle Status is required.",
                            })}
                          >
                            <option value="">Select vehicle status</option>
                            <option value="Available">Available</option>
                            <option value="Rented">Rented</option>
                            <option value="Inspection Required">Inspection Required</option>
                            <option value="Cleaning">Cleaning</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Under Maintenance">
                              Under Maintenance
                            </option>
                            <option value="Out of Service">
                              Out of Service
                            </option>
                          </NativeSelect>
                          <FieldError errors={errors} name="vehicle_status" />
                        </div>
                      </div>
                    </section>

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
                        {keptImageCount}/{MAX_IMAGES} photos selected. Changes
                        are applied when you save.
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
              </FormProvider>
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
