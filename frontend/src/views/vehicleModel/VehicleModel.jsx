import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Plus, TriangleAlert } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import TableSearch from "@/components/TableSearch";
import FieldError from "@/components/ErrorField";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import CustomDrawer from "@/components/Drawer";
import CarLoader from "@/components/CarLoader";
import axiosClient from "@/axios-client";
import Select2 from "@/components/Select2";

import "tabulator-tables/dist/css/tabulator.min.css";

const EMPTY_FORM = {
  brand: "",
  model_name: "",
  year: "",
  engine_capacity: "",
  fuel_type: "",
  transmission: "",
  status: true,
};

function getErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

export default function VehicleModel() {
  // ================= STATE =================

  const [openDrawer, setOpenDrawer] = useState(false);
  const [updateId, setUpdateId] = useState("");

  const [tableLoading, setTableLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const tableRef = useRef(null);
  const table = useRef(null);
  const requestBusy = useRef(false);
  const mounted = useRef(false);
  const listRequest = useRef(null);
  const formRequest = useRef(null);

  const isEditing = updateId !== "";
  const isBusy = saving || formLoading;
  const maxYear = new Date().getFullYear() + 1;

  // ================= REACT HOOK FORM =================

  const methods = useForm({
    defaultValues: EMPTY_FORM,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    clearErrors,
    setError,
    formState: { errors },
  } = methods;

  const status = useWatch({ control, name: "status" });

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      listRequest.current?.abort();
      formRequest.current?.abort();
    };
  }, []);

  // ================= LOAD TABLE AND BRANDS =================

  const getVehicleModels = useCallback(async () => {
    listRequest.current?.abort();

    const controller = new AbortController();
    listRequest.current = controller;

    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post(
        "/get_vehicle_models",
        {},
        { signal: controller.signal },
      );

      if (controller.signal.aborted || !mounted.current) return;

      if (
        !data.status ||
        !Array.isArray(data.data) ||
        !Array.isArray(data.brands)
      ) {
        throw new Error(data.message || "Unable to load vehicle models.");
      }

      await table.current?.setData(data.data);
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;

      setPageError(getErrorMessage(error, "Unable to load vehicle models."));
    } finally {
      if (mounted.current && listRequest.current === controller) {
        setTableLoading(false);
        listRequest.current = null;
      }
    }
  }, []);

  // ================= OPEN CREATE FORM =================

  const openCreateDrawer = () => {
    if (requestBusy.current) return;

    reset({ ...EMPTY_FORM });
    setUpdateId("");
    setFormError("");
    setSuccessMessage("");
    setOpenDrawer(true);
  };

  // ================= FETCH FOR EDIT =================

  const fetchVehicleModelData = useCallback(
    async (id) => {
      if (!id || requestBusy.current) return;

      requestBusy.current = true;

      const controller = new AbortController();
      formRequest.current = controller;

      reset({ ...EMPTY_FORM });
      setUpdateId(id);
      setFormError("");
      setPageError("");
      setSuccessMessage("");
      setFormLoading(true);
      setOpenDrawer(true);

      try {
        const { data } = await axiosClient.post(
          "/fetch_vehicle_model_data",
          { upd_id: id },
          { signal: controller.signal },
        );

        if (controller.signal.aborted || !mounted.current) return;

        if (!data.status || !data.data) {
          throw new Error(data.message || "Unable to fetch vehicle model.");
        }

        const model = data.data;

        setUpdateId(model.ID);

        // Correct mapping for your actual database columns.
        reset({
          brand: String(model.brand_id ?? ""),
          model_name: model.model_name ?? "",
          year: String(model.manufacture_year ?? ""),
          engine_capacity: String(model.engine_capacity ?? ""),
          fuel_type: String(model.fuel_type_id ?? ""),
          transmission: String(model.transmission_type_id ?? ""),
          status: Number(model.status) === 1,
        });
      } catch (error) {
        if (controller.signal.aborted || !mounted.current) return;

        reset({ ...EMPTY_FORM });
        setUpdateId("");
        setOpenDrawer(false);

        setPageError(getErrorMessage(error, "Unable to fetch vehicle model."));
      } finally {
        requestBusy.current = false;

        if (formRequest.current === controller) {
          formRequest.current = null;
        }

        if (mounted.current) {
          setFormLoading(false);
        }
      }
    },
    [reset],
  );

  // ================= SAVE CREATE / UPDATE =================

  const saveVehicleModel = async (values) => {
    if (requestBusy.current) return;

    requestBusy.current = true;

    const controller = new AbortController();
    formRequest.current = controller;

    clearErrors();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    const payload = {
      brand: Number(values.brand),
      model_name: values.model_name.trim(),
      year: values.year === "" ? null : Number(values.year),
      engine_capacity: values.engine_capacity.trim() || null,
      fuel_type: Number(values.fuel_type),
      transmission: Number(values.transmission),
      status: values.status ? 1 : 0,
    };

    if (isEditing) {
      payload.upd_id = updateId;
    }

    try {
      const { data } = await axiosClient.post("/save_vehicle_model", payload, {
        signal: controller.signal,
      });

      if (controller.signal.aborted || !mounted.current) return;

      if (!data.status) {
        throw new Error(data.message || "Unable to save vehicle model.");
      }

      reset({ ...EMPTY_FORM });
      setUpdateId("");
      setOpenDrawer(false);
      setSuccessMessage(data.message || "Vehicle model saved successfully.");

      await getVehicleModels();
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;

      if (error.response?.status === 422) {
        const serverErrors = error.response.data.errors ?? {};
        const generalMessages = [];

        Object.entries(serverErrors).forEach(([field, messages]) => {
          const message = Array.isArray(messages)
            ? messages[0]
            : String(messages);

          if (Object.prototype.hasOwnProperty.call(EMPTY_FORM, field)) {
            setError(field, {
              type: "server",
              message,
            });
          } else {
            generalMessages.push(message);
          }
        });

        if (generalMessages.length) {
          setFormError(generalMessages.join(" "));
        } else if (!Object.keys(serverErrors).length) {
          setFormError("Please check the submitted values.");
        }
      } else {
        setFormError(getErrorMessage(error, "Unable to save vehicle model."));
      }
    } finally {
      requestBusy.current = false;

      if (formRequest.current === controller) {
        formRequest.current = null;
      }

      if (mounted.current) {
        setSaving(false);
      }
    }
  };

  // ================= CLOSE DRAWER =================

  const handleDrawerChange = (open) => {
    if (requestBusy.current) return;

    setOpenDrawer(open);

    if (!open) {
      reset({ ...EMPTY_FORM });
      setUpdateId("");
      setFormError("");
    }
  };

  // ================= INITIALIZE TABLE =================

  useEffect(() => {
    const modelTable = new Tabulator(tableRef.current, {
      index: "id",
      layout: "fitColumns",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",
      placeholder: "No vehicle models found.",

      columns: [
        {
          title: "Brand",
          field: "brand",
          formatter: "plaintext",
          frozen: true,
          width: 140,
        },
        {
          title: "Model Name",
          field: "model_name",
          formatter: "plaintext",
          frozen: true,
          minWidth: 160,
          widthGrow: 2,
        },
        {
          title: "Year",
          field: "year",
          formatter: "plaintext",
          width: 90,
          hozAlign: "center",
        },
        {
          title: "Engine Capacity",
          field: "engine_capacity",
          formatter: "plaintext",
          width: 150,
        },
        {
          title: "Fuel Type",
          field: "fuel_type",
          formatter: "plaintext",
          width: 120,
        },
        {
          title: "Transmission",
          field: "transmission",
          formatter: "plaintext",
          width: 140,
        },
        {
          title: "Status",
          field: "status",
          hozAlign: "center",
          width: 110,
          formatter: (cell) =>
            Number(cell.getValue()) === 1
              ? `<span class="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-medium text-[var(--success)]">Active</span>`
              : `<span class="rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-medium text-destructive">Inactive</span>`,
        },
        {
          title: "Actions",
          field: "id",
          hozAlign: "center",
          width: 100,
          headerSort: false,

          formatter: () => `
            <button
              type="button"
              class="table-action-btn"
              aria-label="Edit vehicle model"
              title="Edit vehicle model"
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

            void fetchVehicleModelData(cell.getRow().getData().id);
          },
        },
      ],
    });

    table.current = modelTable;
    modelTable.on("tableBuilt", getVehicleModels);

    return () => {
      listRequest.current?.abort();

      modelTable.off("tableBuilt", getVehicleModels);
      modelTable.destroy();

      if (table.current === modelTable) {
        table.current = null;
      }
    };
  }, [fetchVehicleModelData, getVehicleModels]);

  // ================= BUTTON TEXT =================

  let submitText = isEditing ? "Update Model" : "Save Model";

  if (formLoading) {
    submitText = "Loading...";
  } else if (saving) {
    submitText = isEditing ? "Updating..." : "Saving...";
  }

  // ================= UI =================

  return (
    <>
      <PageHeader
        title="Vehicle Model Management"
        sub_text="Create, manage and maintain vehicle models."
        breadcrumbs={[
          { label: "Vehicle Model" },
          { label: "Vehicle Model Management" },
        ]}
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
                  onClick={() => void getVehicleModels()}
                  className="mt-2 text-sm font-semibold underline disabled:opacity-50"
                >
                  Retry loading models
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
              Add Vehicle Model
            </button>

            <CustomDrawer
              open={openDrawer}
              setOpen={handleDrawerChange}
              saving={isBusy}
              title={
                isEditing ? "Update Vehicle Model" : "Create Vehicle Model"
              }
              description="Add or update vehicle model details."
              submitText={submitText}
              onSubmit={event => { void handleSubmit(saveVehicleModel)(event); }}
              size="max-w-3xl"
            >
              {formError && (
                <div role="alert" className="form-alert mb-5">
                  {formError}
                </div>
              )}

              {formLoading && (
                <p role="status" className="mb-4 text-sm text-muted-foreground">
                  Loading vehicle model details...
                </p>
              )}

              <FormProvider {...methods}>
                <form
                  noValidate
                  aria-busy={isBusy}
                  onSubmit={event => { void handleSubmit(saveVehicleModel)(event); }}
                >
                  <fieldset
                    disabled={isBusy}
                    className="m-0 min-w-0 border-0 p-0"
                  >
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                          htmlFor="model_name"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Model Name
                        </label>

                        <Input
                          id="model_name"
                          type="text"
                          maxLength={100}
                          placeholder="Enter model name"
                          className="custom-input-sm"
                          aria-invalid={!!errors.model_name}
                          {...register("model_name", {
                            required: "Model name is required.",
                            validate: (value) =>
                              value.trim().length > 0 ||
                              "Model name cannot contain only spaces.",
                            maxLength: {
                              value: 100,
                              message: "Maximum 100 characters.",
                            },
                          })}
                        />

                        <FieldError errors={errors} name="model_name" />
                      </div>

                      <div>
                        <label
                          htmlFor="model_year"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Manufacturing Year
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            Optional
                          </span>
                        </label>

                        <Input
                          id="model_year"
                          type="number"
                          min={1886}
                          max={maxYear}
                          step={1}
                          placeholder="Enter manufacturing year"
                          className="custom-input-sm"
                          aria-invalid={!!errors.year}
                          {...register("year", {
                            validate: (value) =>
                              value === "" ||
                              (Number.isInteger(Number(value)) &&
                                Number(value) >= 1886 &&
                                Number(value) <= maxYear) ||
                              `Enter a whole year between 1886 and ${maxYear}.`,
                          })}
                        />

                        <FieldError errors={errors} name="year" />
                      </div>

                      <div>
                        <label
                          htmlFor="model_engine_capacity"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Engine Capacity
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            Optional
                          </span>
                        </label>

                        <Input
                          id="model_engine_capacity"
                          type="text"
                          maxLength={50}
                          placeholder="Eg: 1500cc"
                          className="custom-input-sm"
                          aria-invalid={!!errors.engine_capacity}
                          {...register("engine_capacity", {
                            maxLength: {
                              value: 50,
                              message: "Maximum 50 characters.",
                            },
                          })}
                        />

                        <FieldError errors={errors} name="engine_capacity" />
                      </div>

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
                          placeholder="Select transmission type..."
                          disabled={isBusy}
                          rules={{
                            required: "Please select a transmission type.",
                          }}
                        />
                      </div>

                      <div className="rounded-xl border border-border bg-secondary/20 p-4 sm:col-span-2">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <label
                              htmlFor="model_status"
                              className="block text-sm font-semibold"
                            >
                              Active Status
                            </label>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {status
                                ? "This model is marked as active."
                                : "This model is marked as inactive."}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {status ? "Active" : "Inactive"}
                            </span>

                            <label className="relative inline-flex cursor-pointer items-center">
                              <input
                                id="model_status"
                                type="checkbox"
                                className="peer sr-only"
                                {...register("status")}
                              />

                              <span
                                aria-hidden="true"
                                className="h-6 w-11 rounded-full bg-secondary transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-disabled:opacity-50"
                              />

                              <span
                                aria-hidden="true"
                                className="absolute left-1 top-1 h-4 w-4 rounded-full bg-card shadow-sm transition-transform peer-checked:translate-x-5"
                              />
                            </label>
                          </div>
                        </div>

                        <FieldError errors={errors} name="status" />
                      </div>
                    </div>
                  </fieldset>
                </form>
              </FormProvider>
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold">
                      Vehicle Model List
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage available vehicle models.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Models
                  </span>
                </div>

                <div
                  id="vehicle-model-tb"
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
        targetId="vehicle-model-tb"
        show={tableLoading}
        text="Loading Vehicle Models"
      />
    </>
  );
}
