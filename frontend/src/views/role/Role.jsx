import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Plus, TriangleAlert } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import FieldError from "@/components/ErrorField";
import TableSearch from "@/components/TableSearch";
import FormSection from "@/components/forms/FormSection";
import { Input, Textarea } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import CarLoader from "@/components/CarLoader";
import CustomDrawer from "@/components/Drawer";
import axiosClient from "@/axios-client";

import "tabulator-tables/dist/css/tabulator.min.css";

const EMPTY_FORM = {
  role_name: "",
  role_description: "",
  status: true,
};

function getErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

export default function Role() {
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

  const getRoles = useCallback(async () => {
    listRequest.current?.abort();

    const controller = new AbortController();
    listRequest.current = controller;

    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post(
        "/get_roles",
        {},
        { signal: controller.signal },
      );

      if (controller.signal.aborted || !mounted.current) return;

      if (!data.status || !Array.isArray(data.data)) {
        throw new Error(data.message || "Unable to load roles.");
      }

      await table.current?.setData(data.data);
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;

      setPageError(
        getErrorMessage(error, "Unable to load roles. Please try again."),
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

  const fetchRoleData = useCallback(
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
          "/fetch_role_data",
          { upd_id: id },
          { signal: controller.signal },
        );

        if (controller.signal.aborted || !mounted.current) return;

        if (!data.status || !data.data) {
          throw new Error(data.message || "Unable to fetch role.");
        }

        const role = data.data;

        setUpdateId(role.ID);

        reset(
          {
            role_name: role.role_name ?? "",
            role_description: role.description ?? "",
            status: Number(role.status) === 1,
          },
          { keepDefaultValues: true },
        );
      } catch (error) {
        if (controller.signal.aborted || !mounted.current) return;

        reset({ ...EMPTY_FORM });
        setUpdateId("");
        setOpenDrawer(false);

        setPageError(
          getErrorMessage(error, "Unable to fetch role. Please try again."),
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

  const saveRole = async (formData) => {
    if (requestBusy.current) return;

    requestBusy.current = true;

    const controller = new AbortController();
    formRequest.current = controller;

    clearErrors();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    const payload = {
      form_data: {
        role_name: formData.role_name.trim(),
        role_description: formData.role_description.trim(),
        status: formData.status ? 1 : 0,
      },
    };

    if (isEditing) {
      payload.upd_id = updateId;
    }

    try {
      const { data } = await axiosClient.post("/save_role", payload, {
        signal: controller.signal,
      });

      if (controller.signal.aborted || !mounted.current) return;

      if (!data.status) {
        throw new Error(data.message || "Unable to save role.");
      }

      reset({ ...EMPTY_FORM });
      setUpdateId("");
      setOpenDrawer(false);
      setSuccessMessage(data.message || "Role saved successfully.");

      await getRoles();
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;

      if (error.response?.status === 422) {
        const serverErrors = error.response.data.errors ?? {};
        const generalMessages = [];

        Object.entries(serverErrors).forEach(([key, messages]) => {
          // Supports both flat errors and form_data.field errors.
          const field = key.replace(/^form_data\./, "");

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
          getErrorMessage(error, "Unable to save role. Please try again."),
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
    const roleTable = new Tabulator(tableRef.current, {
      index: "id",
      layout: "fitColumns",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",
      placeholder: "No roles found.",

      columns: [
        {
          title: "Role Name",
          field: "role_name",
          formatter: "plaintext",
          frozen: true,
          minWidth: 180,
          widthGrow: 1,
        },
        {
          title: "Description",
          field: "description",
          formatter: "plaintext",
          minWidth: 250,
          widthGrow: 3,
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

          formatter: () => `
            <button
              type="button"
              class="table-action-btn"
              aria-label="Edit role"
              title="Edit role"
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

            void fetchRoleData(cell.getRow().getData().id);
          },
        },
      ],
    });

    table.current = roleTable;
    roleTable.on("tableBuilt", getRoles);

    return () => {
      listRequest.current?.abort();

      roleTable.off("tableBuilt", getRoles);
      roleTable.destroy();

      if (table.current === roleTable) {
        table.current = null;
      }
    };
  }, [fetchRoleData, getRoles]);

  // ================= BUTTON TEXT =================

  let submitText = isEditing ? "Update Role" : "Save Role";

  if (formLoading) {
    submitText = "Loading...";
  } else if (saving) {
    submitText = isEditing ? "Updating..." : "Saving...";
  }

  // ================= UI =================

  return (
    <>
      <PageHeader
        title="Role Management"
        sub_text="Create, manage and maintain system roles."
        breadcrumbs={[{ label: "Role" }, { label: "Role Management" }]}
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
                className="mt-0.5 shrink-0 text-red-500"
              />

              <div className="flex-1">
                <p className="text-sm text-destructive">{pageError}</p>

                <button
                  type="button"
                  disabled={tableLoading}
                  onClick={() => void getRoles()}
                  className="mt-2 text-sm font-semibold underline disabled:opacity-50"
                >
                  Retry loading roles
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
              disabled={isBusy}
              onClick={openCreateDrawer}
            >
              <Plus size={16} aria-hidden="true" className="mr-2" />
              Add Role
            </button>

            <CustomDrawer
              open={openDrawer}
              setOpen={handleDrawerChange}
              saving={isBusy}
              title={isEditing ? "Update Role" : "Create Role"}
              description="Add or update a system role."
              submitText={submitText}
              onSubmit={handleSubmit(saveRole)}
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
                  Loading role details...
                </p>
              )}

              <form
                noValidate
                aria-busy={isBusy}
                onSubmit={handleSubmit(saveRole)}
              >
                <fieldset
                  disabled={isBusy}
                  className="m-0 min-w-0 space-y-6 border-0 p-0"
                >
                  <FormSection
                    title="Role information"
                    description="Set the role name, description and availability."
                  >
                    <div className="space-y-5">
                      <div>
                        <label
                          htmlFor="role_name"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Role Name
                        </label>

                        <Input
                          id="role_name"
                          type="text"
                          maxLength={100}
                          placeholder="Enter role name"
                          className={`custom-input-sm ${
                            errors.role_name ? "border-red-400" : ""
                          }`}
                          aria-invalid={!!errors.role_name}
                          {...register("role_name", {
                            required: "Role name is required.",
                            validate: (value) =>
                              value.trim().length > 0 ||
                              "Role name cannot contain only spaces.",
                            maxLength: {
                              value: 100,
                              message: "Maximum 100 characters.",
                            },
                          })}
                        />

                        <FieldError errors={errors} name="role_name" />
                      </div>

                      <div>
                        <label
                          htmlFor="role_description"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Description
                        </label>

                        <Textarea
                          id="role_description"
                          rows={4}
                          maxLength={255}
                          placeholder="Describe this role"
                          className={`custom-input-sm resize-none ${
                            errors.role_description ? "border-red-400" : ""
                          }`}
                          aria-invalid={!!errors.role_description}
                          {...register("role_description", {
                            required: "Description is required.",
                            validate: (value) =>
                              value.trim().length > 0 ||
                              "Description cannot contain only spaces.",
                            maxLength: {
                              value: 255,
                              message: "Maximum 255 characters.",
                            },
                          })}
                        />

                        <FieldError errors={errors} name="role_description" />
                      </div>

                      <div className="rounded-xl border border-border bg-secondary/20 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <label
                              htmlFor="role_status"
                              className="block text-sm font-semibold"
                            >
                              Active Status
                            </label>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {status
                                ? "This role is marked as active."
                                : "This role is marked as inactive."}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {status ? "Active" : "Inactive"}
                            </span>

                            <label className="relative inline-flex cursor-pointer items-center">
                              <input
                                id="role_status"
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
                    </div>
                  </FormSection>
                </fieldset>
              </form>
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold">Role List</h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      View and update your system roles.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Roles
                  </span>
                </div>

                <div
                  id="role-tb"
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
        targetId="role-tb"
        show={tableLoading}
        text="Loading Role Details"
      />
    </>
  );
}
