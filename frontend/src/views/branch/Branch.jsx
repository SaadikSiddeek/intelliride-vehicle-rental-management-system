import usePermissions from "@/hooks/usePermissions";
import PermissionGate from "@/components/PermissionGate";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { TriangleAlert, Plus } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import FieldError from "@/components/ErrorField";
import TableSearch from "@/components/TableSearch";
import FormSection from "@/components/forms/FormSection";
import { Input, Textarea } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import CarLoader from "@/components/CarLoader";
import CustomDrawer from "@/components/Drawer";
import axiosClient from "@/axios-client";
import Select2 from "../../components/Select2";

import "tabulator-tables/dist/css/tabulator.min.css";

const DEFAULT_MANAGER_ID = "1";

const EMPTY_FORM = {
  branch_name: "",
  branch_code: "",
  address: "",
  contact_number: "",
  manager_id: "",
  status: true,
};

const BRANCH_FIELDS = [
  { name: "branch_name", label: "Branch Name", maxLength: 100, required: true },
  { name: "branch_code", label: "Branch Code", maxLength: 50, required: true },
  {
    name: "contact_number",
    label: "Contact Number",
    type: "tel",
    maxLength: 20,
  },
];

export default function Branch() {
  const { can } = usePermissions();
  // ================= STATE =================
  const [openDrawer, setOpenDrawer] = useState(false);
  const [updateId, setUpdateId] = useState("");
  const [managers, setManagers] = useState([]);

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

  // ================= REACT HOOK FORM =================

  const methods = useForm({
    defaultValues: EMPTY_FORM,
  });

  const {
    register,
    handleSubmit,
    reset,
    clearErrors,
    setError,
    formState: { errors },
  } = methods;

  // ================= LOAD TABLE =================
  const getBranches = useCallback(async () => {
    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post("/get_branches");

      if (!data.status) {
        throw new Error(data.message || "Unable to load branches.");
      }

      if (!Array.isArray(data.data) || !Array.isArray(data.managers)) {
        throw new Error("Invalid branch or manager data received.");
      }

      setManagers(data.managers);
      await table.current?.setData(data.data);
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          error.message ||
          "Unable to load branches.",
      );
    } finally {
      setTableLoading(false);
    }
  }, []);

  // ================= OPEN CREATE FORM =================
  const openCreateDrawer = () => {
    if (requestBusy.current) return;

    const hasDefaultManager = managers.some(
      (person) => String(person.id) === DEFAULT_MANAGER_ID,
    );

    reset({
      ...EMPTY_FORM,
      manager_id: hasDefaultManager ? DEFAULT_MANAGER_ID : "",
    });
    setUpdateId("");
    setFormError("");
    setSuccessMessage("");
    setOpenDrawer(true);
  };

  // ================= FETCH FOR EDIT =================
  const fetchBranchData = useCallback(
    async (id) => {
      if (id === null || id === undefined || id === "" || requestBusy.current) {
        return;
      }

      requestBusy.current = true;

      reset(EMPTY_FORM);
      setUpdateId(String(id));
      setFormError("");
      setPageError("");
      setSuccessMessage("");
      setFormLoading(true);
      setOpenDrawer(true);

      try {
        const { data } = await axiosClient.post("/fetch_branch_data", {
          upd_id: id,
        });

        if (!data.status || !data.data) {
          throw new Error(data.message || "Unable to fetch branch.");
        }

        const branch = data.data;

        setUpdateId(String(branch.ID ?? branch.id ?? id));
        reset(
          {
            branch_name: branch.branch_name ?? "",
            branch_code: branch.branch_code ?? "",
            address: branch.address ?? "",
            contact_number: branch.contact_number ?? "",
            manager_id: String(branch.manager_id ?? ""),
            status: Number(branch.status) === 1,
          },
          { keepDefaultValues: true },
        );
      } catch (error) {
        reset(EMPTY_FORM);
        setUpdateId("");
        setOpenDrawer(false);
        setPageError(
          error.response?.data?.message ||
            error.message ||
            "Unable to fetch branch.",
        );
      } finally {
        setFormLoading(false);
        requestBusy.current = false;
      }
    },
    [reset],
  );

  // ================= SAVE CREATE / UPDATE =================
  const saveBranch = async (formData) => {
    if (requestBusy.current) return;

    requestBusy.current = true;

    clearErrors();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    const payload = {
      branch_name: formData.branch_name.trim(),
      branch_code: formData.branch_code.trim(),
      address: formData.address.trim() || null,
      contact_number: formData.contact_number.trim() || null,
      manager_id: formData.manager_id || null,
      status: formData.status ? 1 : 0,
    };

    if (isEditing) {
      payload.upd_id = updateId;
    }

    try {
      const { data } = await axiosClient.post("/save_branch", payload);

      if (!data.status) {
        throw new Error(data.message || "Unable to save branch.");
      }

      reset(EMPTY_FORM);
      setUpdateId("");
      setOpenDrawer(false);
      setSuccessMessage(data.message || "Branch saved successfully.");

      await getBranches();
    } catch (error) {
      if (error.response?.status === 422) {
        const serverErrors = error.response.data.errors ?? {};
        const generalMessages = [];

        Object.entries(serverErrors).forEach(([field, messages]) => {
          const message = Array.isArray(messages)
            ? messages[0]
            : String(messages);

          if (Object.prototype.hasOwnProperty.call(EMPTY_FORM, field)) {
            setError(field, { type: "server", message });
          } else {
            generalMessages.push(message);
          }
        });

        if (generalMessages.length) {
          setFormError(generalMessages.join(" "));
        } else if (!Object.keys(serverErrors).length) {
          setFormError(
            error.response?.data?.message ||
              "Please check the submitted values.",
          );
        }
      } else {
        setFormError(
          error.response?.data?.message ||
            error.message ||
            "Unable to save branch.",
        );
      }
    } finally {
      setSaving(false);
      requestBusy.current = false;
    }
  };

  // ================= CLOSE DRAWER =================
  const handleDrawerChange = (open) => {
    if (requestBusy.current) return;

    setOpenDrawer(open);

    if (!open) {
      reset(EMPTY_FORM);
      setUpdateId("");
      setFormError("");
    }
  };

  // ================= INITIALIZE TABLE =================
  useEffect(() => {
    const branchTable = new Tabulator(tableRef.current, {
      index: "id",
      layout: "fitColumns",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",
      placeholder: "No branches found.",

      columns: [
        {
          title: "Branch Name",
          field: "branch_name",
          formatter: "plaintext",
          frozen: true,
          minWidth: 160,
        },
        {
          title: "Code",
          field: "branch_code",
          formatter: "plaintext",
          frozen: true,
          width: 120,
        },
        {
          title: "Address",
          field: "address",
          formatter: "plaintext",
          minWidth: 200,
          widthGrow: 2,
        },
        {
          title: "Contact Number",
          field: "contact_number",
          formatter: "plaintext",
          width: 155,
        },
        {
          title: "Manager",
          field: "manager",
          formatter: "plaintext",
          minWidth: 160,
        },
        {
          title: "Status",
          field: "status",
          hozAlign: "center",
          width: 110,
          formatter: (cell) =>
            Number(cell.getValue()) === 1
              ? `<span class="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs text-[var(--success)]">Active</span>`
              : `<span class="rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs text-destructive">Inactive</span>`,
        },
        {
          title: "Actions",
          field: "id",
          hozAlign: "center",
          width: 100,
          headerSort: false,
          formatter: () => can("branches.edit") ? (`
            <button
              type="button"
              class="table-action-btn"
              aria-label="Edit branch"
              title="Edit branch"
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
            fetchBranchData(cell.getRow().getData().id);
          },
        },
      ],
    });

    table.current = branchTable;
    branchTable.on("tableBuilt", getBranches);

    return () => {
      branchTable.off("tableBuilt", getBranches);
      branchTable.destroy();
      if (table.current === branchTable) {
        table.current = null;
      }
    };
  }, [fetchBranchData, getBranches, can]);

  // ================= BUTTON TEXT =================
  let submitText = isEditing ? "Update Branch" : "Save Branch";

  if (formLoading) {
    submitText = "Loading...";
  } else if (saving) {
    submitText = isEditing ? "Updating..." : "Saving...";
  }

  // ================= UI =================
  return (
    <>
      <PageHeader
        title="Branch Management"
        sub_text="Create, manage and maintain company branches."
        breadcrumbs={[{ label: "Branch" }, { label: "Branch Management" }]}
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
            <PermissionGate permission="branches.create"><button
              type="button"
              className="btn-primary management-add"
              disabled={isBusy}
              onClick={openCreateDrawer}
            >
              <Plus size={16} aria-hidden="true" className="mr-2" />
              Add Branch
            </button></PermissionGate>

            <CustomDrawer canSubmit={can("branches.create") && !isEditing || can("branches.edit") && isEditing}
              open={openDrawer}
              setOpen={handleDrawerChange}
              saving={isBusy}
              title={isEditing ? "Update Branch" : "Create Branch"}
              description="Add or update a company branch."
              submitText={submitText}
              onSubmit={event => { void handleSubmit(saveBranch)(event); }}
              size="max-w-3xl"
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
                  Loading branch details...
                </p>
              )}

              <FormProvider {...methods}>
                <form
                  noValidate
                  aria-busy={isBusy}
                  onSubmit={event => { void handleSubmit(saveBranch)(event); }}
                >
                  <fieldset
                    disabled={isBusy}
                    className="m-0 min-w-0 space-y-6 border-0 p-0"
                  >
                    <FormSection
                      title="Branch information"
                      description="Basic company branch and contact details."
                    >
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        {BRANCH_FIELDS.slice(0, 2).map((item) => (
                          <div key={item.name}>
                            <label
                              htmlFor={item.name}
                              className="mb-2 block text-sm font-semibold"
                            >
                              {item.label}
                            </label>

                            <Input
                              id={item.name}
                              type={item.type ?? "text"}
                              placeholder={`Enter ${item.label.toLowerCase()}`}
                              maxLength={item.maxLength}
                              className={`custom-input-sm ${
                                errors[item.name] ? "border-red-400" : ""
                              }`}
                              aria-invalid={!!errors[item.name]}
                              {...register(item.name, {
                                validate: (value) =>
                                  !!value.trim() || `${item.label} is required`,
                                maxLength: {
                                  value: item.maxLength,
                                  message: `Maximum ${item.maxLength} characters`,
                                },
                              })}
                            />
                            <FieldError errors={errors} name={item.name} />
                          </div>
                        ))}

                        <div className="sm:col-span-2">
                          <label
                            htmlFor="address"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Address
                          </label>
                          <Textarea
                            id="address"
                            rows={3}
                            placeholder="Enter branch address"
                            className={`custom-input-sm resize-none ${
                              errors.address ? "border-red-400" : ""
                            }`}
                            aria-invalid={!!errors.address}
                            {...register("address", {
                              maxLength: {
                                value: 5000,
                                message: "Maximum 5000 characters",
                              },
                            })}
                          />
                          <FieldError errors={errors} name="address" />
                        </div>
                      </div>
                    </FormSection>

                    <FormSection
                      title="Branch assignment"
                      description="Manager assignment, contact number and status."
                    >
                      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="manager_id"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Manager
                          </label>

                          <Select2
                            name="manager_id"
                            endpoint="/staff_filter"
                            placeholder="Select Manager..."
                            disabled={isBusy}
                            rules={{ required: "Please select a manager." }}
                          />

                          <FieldError errors={errors} name="manager_id" />
                        </div>

                        <div>
                          <label
                            htmlFor="contact_number"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Contact Number
                          </label>
                          <Input
                            id="contact_number"
                            type="tel"
                            maxLength={20}
                            placeholder="Enter contact number"
                            className={`custom-input-sm ${
                              errors.contact_number ? "border-red-400" : ""
                            }`}
                            aria-invalid={!!errors.contact_number}
                            {...register("contact_number", {
                              maxLength: {
                                value: 20,
                                message: "Maximum 20 characters",
                              },
                            })}
                          />
                          <FieldError errors={errors} name="contact_number" />
                        </div>

                        <div className="flex items-center gap-3 pt-1 sm:col-span-2">
                          <label
                            htmlFor="status"
                            className="text-sm font-semibold"
                          >
                            Active Status
                          </label>

                          <label className="relative inline-flex cursor-pointer items-center">
                            <input
                              id="status"
                              type="checkbox"
                              className="peer sr-only"
                              {...register("status")}
                            />

                            <span className="h-6 w-11 rounded-full bg-secondary transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary" />
                            <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-card transition-transform peer-checked:translate-x-5" />
                          </label>
                          <FieldError errors={errors} name="status" />
                        </div>
                      </div>
                    </FormSection>
                  </fieldset>
                </form>
              </FormProvider>
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold">Branch List</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage company branches and locations.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Branch
                  </span>
                </div>

                <div id="branch-tb" className="p-6">
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
        targetId="branch-tb"
        show={tableLoading}
        text="Loading Branch Details"
      />
    </>
  );
}
