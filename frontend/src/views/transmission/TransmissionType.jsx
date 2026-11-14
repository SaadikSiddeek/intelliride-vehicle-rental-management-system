import usePermissions from "@/hooks/usePermissions";
import PermissionGate from "@/components/PermissionGate";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Plus, TriangleAlert } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import TableSearch from "@/components/TableSearch";
import FieldError from "@/components/ErrorField";
import { Input, Textarea } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import CustomDrawer from "@/components/Drawer";
import CarLoader from "@/components/CarLoader";
import axiosClient from "@/axios-client";

import "tabulator-tables/dist/css/tabulator.min.css";

const EMPTY_FORM = {
  transmission_name: "",
  description: "",
  status: true,
};

function getErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

export default function TransmissionType() {
  const { can } = usePermissions();
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

  // ================= REACT HOOK FORM =================

  const {
    register,
    control,
    handleSubmit,
    reset,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: EMPTY_FORM,
  });

  const status = useWatch({
    control,
    name: "status",
  });

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      listRequest.current?.abort();
      formRequest.current?.abort();
    };
  }, []);

  // ================= LOAD TABLE =================

  const getVehicleTransmissions = useCallback(async () => {
    listRequest.current?.abort();

    const controller = new AbortController();
    listRequest.current = controller;

    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post(
        "/get_vehicle_transmissions",
        {},
        { signal: controller.signal },
      );

      if (controller.signal.aborted || !mounted.current) return;

      if (!data.status || !Array.isArray(data.data)) {
        throw new Error(data.message || "Unable to load transmission types.");
      }

      await table.current?.setData(data.data);
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;

      setPageError(
        getErrorMessage(error, "Unable to load transmission types."),
      );
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

  const fetchVehicleTransmissionData = useCallback(
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
          "/fetch_vehicle_transmission_data",
          { upd_id: id },
          { signal: controller.signal },
        );

        if (controller.signal.aborted || !mounted.current) return;

        if (!data.status || !data.data) {
          throw new Error(data.message || "Unable to fetch transmission type.");
        }

        const transmission = data.data;

        setUpdateId(transmission.ID);

        reset({
          transmission_name: transmission.transmission_name ?? "",
          description: transmission.description ?? "",
          status: Number(transmission.status) === 1,
        });
      } catch (error) {
        if (controller.signal.aborted || !mounted.current) return;

        reset({ ...EMPTY_FORM });
        setUpdateId("");
        setOpenDrawer(false);

        setPageError(
          getErrorMessage(error, "Unable to fetch transmission type."),
        );
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

  const saveVehicleTransmission = async (formData) => {
    if (requestBusy.current) return;

    requestBusy.current = true;

    const controller = new AbortController();
    formRequest.current = controller;

    clearErrors();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    const payload = {
      transmission_name: formData.transmission_name.trim(),
      description: formData.description.trim() || null,
      status: formData.status ? 1 : 0,
    };

    if (isEditing) {
      payload.upd_id = updateId;
    }

    try {
      const { data } = await axiosClient.post(
        "/save_vehicle_transmission",
        payload,
        { signal: controller.signal },
      );

      if (controller.signal.aborted || !mounted.current) return;

      if (!data.status) {
        throw new Error(data.message || "Unable to save transmission type.");
      }

      reset({ ...EMPTY_FORM });
      setUpdateId("");
      setOpenDrawer(false);

      setSuccessMessage(
        data.message || "Transmission type saved successfully.",
      );

      // Refresh actual database records after insert/update.
      await getVehicleTransmissions();
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
        setFormError(
          getErrorMessage(error, "Unable to save transmission type."),
        );
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
    const transmissionTable = new Tabulator(tableRef.current, {
      index: "id",
      layout: "fitColumns",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",
      placeholder: "No transmission types found.",

      columns: [
        {
          title: "Transmission Name",
          field: "transmission_name",
          formatter: "plaintext",
          frozen: true,
          width: 200,
        },
        {
          title: "Description",
          field: "description",
          formatter: "plaintext",
          minWidth: 220,
          widthGrow: 2,
        },
        {
          title: "Status",
          field: "status",
          hozAlign: "center",
          width: 120,

          formatter: (cell) =>
            Number(cell.getValue()) === 1
              ? `<span class="inline-flex items-center rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-medium text-[var(--success)]">Active</span>`
              : `<span class="inline-flex items-center rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-medium text-destructive">Inactive</span>`,
        },
        {
          title: "Actions",
          field: "id",
          hozAlign: "center",
          width: 100,
          headerSort: false,

          formatter: () => can("transmissions.edit") ? (`
            <button
              type="button"
              class="table-action-btn"
              aria-label="Edit transmission type"
              title="Edit transmission type"
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
          `) : "",

          cellClick: (event, cell) => {
            if (!event.target.closest("button")) return;

            void fetchVehicleTransmissionData(cell.getRow().getData().id);
          },
        },
      ],
    });

    table.current = transmissionTable;

    transmissionTable.on("tableBuilt", getVehicleTransmissions);

    return () => {
      listRequest.current?.abort();

      transmissionTable.off("tableBuilt", getVehicleTransmissions);

      transmissionTable.destroy();

      if (table.current === transmissionTable) {
        table.current = null;
      }
    };
  }, [fetchVehicleTransmissionData, getVehicleTransmissions, can]);

  // ================= BUTTON TEXT =================

  let submitText = isEditing
    ? "Update Transmission Type"
    : "Save Transmission Type";

  if (formLoading) {
    submitText = "Loading...";
  } else if (saving) {
    submitText = isEditing ? "Updating..." : "Saving...";
  }

  // ================= UI =================

  return (
    <>
      <PageHeader
        title="Transmission Type Management"
        sub_text="Create, manage and maintain vehicle transmission types."
        breadcrumbs={[
          { label: "Transmission Type" },
          { label: "Transmission Type Management" },
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
                  onClick={() => void getVehicleTransmissions()}
                  className="mt-2 text-sm font-semibold underline disabled:opacity-50"
                >
                  Retry loading transmission types
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
            <PermissionGate permission="transmissions.create"><button
              type="button"
              className="btn-primary management-add"
              disabled={isBusy}
              onClick={openCreateDrawer}
            >
              <Plus size={16} aria-hidden="true" className="mr-2" />
              Add Transmission Type
            </button></PermissionGate>

            <CustomDrawer canSubmit={can("transmissions.create") && !isEditing || can("transmissions.edit") && isEditing}
              open={openDrawer}
              setOpen={handleDrawerChange}
              saving={isBusy}
              title={
                isEditing
                  ? "Update Transmission Type"
                  : "Create Transmission Type"
              }
              description="Add or update a vehicle transmission type."
              submitText={submitText}
              onSubmit={event => { void handleSubmit(saveVehicleTransmission)(event); }}
              size="max-w-2xl"
            >
              {formError && (
                <div
                  role="alert"
                  className="mb-5 rounded-lg border border-red-200 bg-[var(--danger-soft)] px-4 py-3 text-sm text-destructive"
                >
                  {formError}
                </div>
              )}

              {formLoading && (
                <p role="status" className="mb-4 text-sm text-muted-foreground">
                  Loading transmission type details...
                </p>
              )}

              <form
                noValidate
                aria-busy={isBusy}
                onSubmit={event => { void handleSubmit(saveVehicleTransmission)(event); }}
              >
                <fieldset
                  disabled={isBusy}
                  className="m-0 min-w-0 space-y-5 border-0 p-0"
                >
                  <div>
                    <label
                      htmlFor="transmission_name"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Transmission Name
                    </label>

                    <Input
                      id="transmission_name"
                      type="text"
                      maxLength={100}
                      placeholder="Enter transmission name"
                      className="custom-input-sm"
                      aria-invalid={!!errors.transmission_name}
                      {...register("transmission_name", {
                        required: "Transmission name is required.",
                        validate: (value) =>
                          value.trim().length > 0 ||
                          "Transmission name cannot contain only spaces.",
                        maxLength: {
                          value: 100,
                          message: "Maximum 100 characters.",
                        },
                      })}
                    />

                    <FieldError errors={errors} name="transmission_name" />
                  </div>

                  <div>
                    <label
                      htmlFor="transmission_description"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Description
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Optional
                      </span>
                    </label>

                    <Textarea
                      id="transmission_description"
                      rows={4}
                      maxLength={500}
                      placeholder="Enter description"
                      className="custom-input-sm resize-none"
                      aria-invalid={!!errors.description}
                      {...register("description", {
                        maxLength: {
                          value: 500,
                          message: "Maximum 500 characters.",
                        },
                      })}
                    />

                    <FieldError errors={errors} name="description" />
                  </div>

                  <div className="rounded-xl border border-border bg-secondary/20 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <label
                          htmlFor="transmission_status"
                          className="block text-sm font-semibold"
                        >
                          Active Status
                        </label>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {status
                            ? "This transmission type is marked as active."
                            : "This transmission type is marked as inactive."}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {status ? "Active" : "Inactive"}
                        </span>

                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            id="transmission_status"
                            type="checkbox"
                            className="peer sr-only"
                            {...register("status")}
                          />

                          <span
                            aria-hidden="true"
                            className="h-6 w-11 rounded-full bg-secondary transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:opacity-50"
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
                </fieldset>
              </form>
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold">
                      Transmission Type List
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage available transmission types.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Transmission
                  </span>
                </div>

                <div
                  id="transmission-type-tb"
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
        targetId="transmission-type-tb"
        show={tableLoading}
        text="Loading Transmission Types"
      />
    </>
  );
}
