import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, TriangleAlert } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import axiosClient from "@/axios-client";
import FieldError from "@/components/ErrorField";
import TableSearch from "@/components/TableSearch";
import FormSection from "@/components/forms/FormSection";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import CarLoader from "@/components/CarLoader";
import CustomDrawer from "@/components/Drawer";

import "tabulator-tables/dist/css/tabulator.min.css";

const DEFAULT_VALUES = {
  department_name: "",
  status: true,
};

export default function Department() {
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

  const isEditing = updateId !== "";
  const isBusy = saving || formLoading;

  const {
    register,
    handleSubmit,
    reset,
    clearErrors,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: DEFAULT_VALUES,
  });

  const getDepartments = useCallback(async () => {
    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post("/get_department");

      if (!data.status) {
        throw new Error(data.message || "Unable to load departments.");
      }

      await table.current?.setData(data.data ?? []);
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          error.message ||
          "Unable to load departments.",
      );
    } finally {
      setTableLoading(false);
    }
  }, []);

  const openCreateDrawer = () => {
    if (requestBusy.current) return;

    reset();
    setUpdateId("");
    setFormError("");
    setSuccessMessage("");
    setOpenDrawer(true);
  };

  const fetchDepartmentData = useCallback(
    async (id) => {
      if (!id || requestBusy.current) return;

      requestBusy.current = true;

      reset();
      setUpdateId(id);
      setFormError("");
      setPageError("");
      setSuccessMessage("");
      setFormLoading(true);
      setOpenDrawer(true);

      try {
        const { data } = await axiosClient.post("/fetch_department_data", {
          upd_id: id,
        });

        if (!data.status || !data.data) {
          throw new Error(data.message || "Unable to load department.");
        }

        const department = data.data;

        setUpdateId(department.ID);

        reset(
          {
            department_name: department.department_name ?? "",
            status: Number(department.status) === 1,
          },
          { keepDefaultValues: true },
        );
      } catch (error) {
        setOpenDrawer(false);
        setUpdateId("");
        reset();

        setPageError(
          error.response?.data?.message ||
            error.message ||
            "Unable to load department.",
        );
      } finally {
        setFormLoading(false);
        requestBusy.current = false;
      }
    },
    [reset],
  );

  const saveDepartment = async (formData) => {
    if (requestBusy.current) return;

    requestBusy.current = true;

    clearErrors();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    const payload = {
      form_data: {
        department_name: formData.department_name.trim(),
        status: formData.status ? 1 : 0,
      },
    };

    if (isEditing) {
      payload.upd_id = updateId;
    }

    try {
      const { data } = await axiosClient.post("/save_department", payload);

      if (!data.status) {
        throw new Error(data.message || "Unable to save department.");
      }

      reset();
      setUpdateId("");
      setOpenDrawer(false);

      setSuccessMessage(data.message || "Department saved successfully.");

      await getDepartments();
    } catch (error) {
      if (error.response?.status === 422) {
        const serverErrors = error.response.data.errors ?? {};
        const generalMessages = [];

        Object.entries(serverErrors).forEach(([field, messages]) => {
          const fieldName = field.replace(/^form_data\./, "");
          const message = Array.isArray(messages)
            ? messages[0]
            : String(messages);

          if (Object.prototype.hasOwnProperty.call(DEFAULT_VALUES, fieldName)) {
            setError(fieldName, {
              type: "server",
              message,
            });
          } else {
            generalMessages.push(message);
          }
        });

        if (generalMessages.length > 0) {
          setFormError(generalMessages.join(" "));
        } else if (Object.keys(serverErrors).length === 0) {
          setFormError("Please check the submitted values.");
        }
      } else {
        setFormError(
          error.response?.data?.message ||
            error.message ||
            "Unable to save department.",
        );
      }
    } finally {
      setSaving(false);
      requestBusy.current = false;
    }
  };

  const handleDrawerChange = (open) => {
    if (requestBusy.current) return;

    setOpenDrawer(open);

    if (!open) {
      reset();
      setUpdateId("");
      setFormError("");
    }
  };

  useEffect(() => {
    const departmentTable = new Tabulator(tableRef.current, {
      index: "ID",
      layout: "fitColumns",
      responsiveLayout: "collapse",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",

      placeholder: `
        <div class="ir-table-empty">
          <strong>No Departments Found</strong>
          <p>Add a department or clear your search.</p>
        </div>
      `,

      columns: [
        {
          title: "Department Name",
          field: "department_name",
          formatter: "plaintext",
          widthGrow: 2,
          minWidth: 180,
        },
        {
          title: "Status",
          field: "status",
          hozAlign: "center",
          vertAlign: "middle",
          width: 140,

          formatter: (cell) =>
            Number(cell.getValue()) === 1
              ? `
                <span class="inline-flex items-center rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-medium text-[var(--success)]">
                  Active
                </span>
              `
              : `
                <span class="inline-flex items-center rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-medium text-destructive">
                  Inactive
                </span>
              `,
        },
        {
          title: "Actions",
          field: "ID",
          hozAlign: "center",
          vertAlign: "middle",
          width: 110,
          headerSort: false,

          formatter: () => `
            <button
              type="button"
              class="table-action-btn"
              aria-label="Edit department"
              title="Edit department"
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

            fetchDepartmentData(cell.getRow().getData().ID);
          },
        },
      ],
    });

    table.current = departmentTable;
    departmentTable.on("tableBuilt", getDepartments);

    return () => {
      departmentTable.off("tableBuilt", getDepartments);
      departmentTable.destroy();

      if (table.current === departmentTable) {
        table.current = null;
      }
    };
  }, [fetchDepartmentData, getDepartments]);

  let submitText = isEditing ? "Update Department" : "Create Department";

  if (formLoading) {
    submitText = "Loading...";
  } else if (saving) {
    submitText = isEditing ? "Updating..." : "Creating...";
  }

  return (
    <>
      <PageHeader
        title="Department Management"
        sub_text="Create, manage and maintain company departments."
        breadcrumbs={[
          { label: "Department" },
          { label: "Department Management" },
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
                className="mt-0.5 shrink-0 text-red-500"
              />

              <p className="text-sm text-destructive">{pageError}</p>
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
              onClick={openCreateDrawer}
              disabled={isBusy}
            >
              <Plus size={16} aria-hidden="true" className="mr-2" />
              Add Department
            </button>

            <CustomDrawer
              open={openDrawer}
              setOpen={handleDrawerChange}
              saving={isBusy}
              title={isEditing ? "Update Department" : "Create Department"}
              description={
                isEditing
                  ? "Update the selected department's details."
                  : "Enter the details for a new department."
              }
              submitText={submitText}
              onSubmit={handleSubmit(saveDepartment)}
              size="max-w-xl"
            >
              {formError && (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-[var(--danger-soft)] px-4 py-3"
                >
                  <TriangleAlert
                    size={16}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-red-500"
                  />

                  <p className="text-sm text-destructive">{formError}</p>
                </div>
              )}

              {formLoading && (
                <p role="status" className="mb-4 text-sm text-muted-foreground">
                  Loading department details...
                </p>
              )}

              <form
                onSubmit={handleSubmit(saveDepartment)}
                aria-busy={isBusy}
                noValidate
              >
                <fieldset
                  disabled={isBusy}
                  className="m-0 min-w-0 space-y-6 border-0 p-0"
                >
                  <FormSection
                    title="Department details"
                    description="Set the department name and active status."
                  >
                    <div className="space-y-5">
                      <div>
                        <label
                          htmlFor="department_name"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Department Name
                        </label>

                        <Input
                          id="department_name"
                          type="text"
                          placeholder="Enter department name"
                          className="custom-input-sm"
                          aria-invalid={!!errors.department_name}
                          {...register("department_name", {
                            required: "Department name is required",
                            validate: (value) =>
                              value.trim().length > 0 ||
                              "Department name is required",
                            maxLength: {
                              value: 100,
                              message: "Maximum 100 characters",
                            },
                          })}
                        />

                        <FieldError errors={errors} name="department_name" />
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <label
                              htmlFor="department_status"
                              className="block text-sm font-semibold"
                            >
                              Active Status
                            </label>

                            <p className="mt-1 text-xs text-muted-foreground">
                              Enable to mark this department as active.
                            </p>
                          </div>

                          <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                            <input
                              id="department_status"
                              type="checkbox"
                              role="switch"
                              className="peer sr-only"
                              aria-invalid={!!errors.status}
                              {...register("status")}
                            />

                            <span className="h-6 w-11 rounded-full bg-secondary transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50" />

                            <span className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-card transition-transform peer-checked:translate-x-5" />
                          </label>
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
                    <h2 className="text-base font-semibold">Department List</h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      All registered company departments.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Departments
                  </span>
                </div>

                <div id="department-tb" className="p-6">
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
        targetId="department-tb"
        show={tableLoading}
        text="Loading Departments"
      />
    </>
  );
}
