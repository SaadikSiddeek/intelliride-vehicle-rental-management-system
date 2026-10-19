import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { TriangleAlert, UserRoundPlus } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";
import Flatpickr from "react-flatpickr";

import FieldError from "@/components/ErrorField";
import TableSearch from "@/components/TableSearch";
import FormSection from "@/components/forms/FormSection";
import { Input, Textarea, NativeSelect } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import CarLoader from "@/components/CarLoader";
import CustomDrawer from "@/components/Drawer";
import axiosClient from "@/axios-client";

import "tabulator-tables/dist/css/tabulator.min.css";
import "flatpickr/dist/flatpickr.min.css";

const EMPTY_FORM = {
  employee_code: "",
  first_name: "",
  last_name: "",
  gender: "Male",
  nic: "",
  phone_number: "",
  email: "",
  address: "",
  branch: "",
  designation: "",
  department: "",
  joining_date: "",
  status: true,
};

// Keep options outside the component so they remain stable.
const DATE_OPTIONS = {
  dateFormat: "Y-m-d",
  disableMobile: true,
  allowInput: false,
  static: true,
};

// Replace these options with your actual reference data.
const JOB_FIELDS = [
  {
    name: "branch",
    label: "Branch",
    options: [{ value: "1", label: "1" }],
  },
  {
    name: "designation",
    label: "Designation",
    options: [{ value: "1", label: "1" }],
  },
  {
    name: "department",
    label: "Department",
    options: [{ value: "1", label: "1" }],
  },
];

const PERSONAL_FIELDS = [
  {
    name: "employee_code",
    label: "Employee Code",
    maxLength: 50,
  },
  {
    name: "first_name",
    label: "First Name",
    maxLength: 100,
  },
  {
    name: "last_name",
    label: "Last Name",
    maxLength: 100,
  },
  {
    name: "nic",
    label: "NIC",
    maxLength: 20,
  },
  {
    name: "phone_number",
    label: "Phone Number",
    type: "tel",
    maxLength: 20,
  },
  {
    name: "email",
    label: "Email",
    type: "email",
    maxLength: 255,
  },
];

export default function Staff() {
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

  // ================= LOAD TABLE =================

  const getStaff = useCallback(async () => {
    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post("/get_staff");

      if (!data.status) {
        throw new Error(data.message || "Unable to load staff.");
      }

      await table.current?.setData(data.data ?? []);
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          error.message ||
          "Unable to load staff.",
      );
    } finally {
      setTableLoading(false);
    }
  }, []);

  // ================= OPEN CREATE FORM =================

  const openCreateDrawer = () => {
    if (requestBusy.current) return;

    reset();
    setUpdateId("");
    setFormError("");
    setSuccessMessage("");
    setOpenDrawer(true);
  };

  // ================= FETCH FOR EDIT =================

  const fetchStaffData = useCallback(
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
        const { data } = await axiosClient.post("/fetch_staff_data", {
          upd_id: id,
        });

        if (!data.status || !data.data) {
          throw new Error(data.message || "Unable to fetch staff.");
        }

        const staff = data.data;

        setUpdateId(staff.ID);

        reset(
          {
            employee_code: staff.emp_code ?? "",
            first_name: staff.first_name ?? "",
            last_name: staff.last_name ?? "",
            gender: staff.gender ?? "Male",
            nic: staff.nic ?? "",
            phone_number: staff.phone ?? "",
            email: staff.email ?? "",
            address: staff.address ?? "",
            branch: String(staff.branch_id ?? ""),
            designation: String(staff.designation_id ?? ""),
            department: String(staff.department_id ?? ""),
            joining_date: staff.join_date ?? "",
            status: Number(staff.status) === 1,
          },
          { keepDefaultValues: true },
        );
      } catch (error) {
        reset();
        setUpdateId("");
        setOpenDrawer(false);

        setPageError(
          error.response?.data?.message ||
            error.message ||
            "Unable to fetch staff.",
        );
      } finally {
        setFormLoading(false);
        requestBusy.current = false;
      }
    },
    [reset],
  );

  // ================= SAVE CREATE / UPDATE =================

  const saveStaff = async (formData) => {
    if (requestBusy.current) return;

    requestBusy.current = true;

    clearErrors();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    // Preserve your Staff API's existing flat payload.
    const payload = {
      ...formData,
      status: formData.status ? 1 : 0,
    };

    if (isEditing) {
      payload.upd_id = updateId;
    }

    try {
      const { data } = await axiosClient.post("/save_staff", payload);

      if (!data.status) {
        throw new Error(data.message || "Unable to save staff.");
      }

      reset();
      setUpdateId("");
      setOpenDrawer(false);
      setSuccessMessage(data.message || "Staff saved successfully.");

      await getStaff();
    } catch (error) {
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
          error.response?.data?.message ||
            error.message ||
            "Unable to save staff.",
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
      reset();
      setUpdateId("");
      setFormError("");
    }
  };

  // ================= INITIALIZE TABLE =================

  useEffect(() => {
    const staffTable = new Tabulator(tableRef.current, {
      index: "id",
      layout: "fitColumns",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",
      placeholder: "No staff found.",

      columns: [
        {
          title: "Employee Code",
          field: "employee_code",
          formatter: "plaintext",
          frozen: true,
          width: 140,
        },
        {
          title: "Full Name",
          field: "full_name",
          formatter: "plaintext",
          frozen: true,
          width: 180,
        },
        {
          title: "Email",
          field: "email",
          formatter: "plaintext",
          minWidth: 200,
          widthGrow: 2,
        },
        {
          title: "Branch ID",
          field: "branch",
          formatter: "plaintext",
          width: 120,
        },
        {
          title: "Designation ID",
          field: "designation",
          formatter: "plaintext",
          width: 140,
        },
        {
          title: "Department ID",
          field: "department",
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
              ? `<span class="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs text-[var(--success)]">Active</span>`
              : `<span class="rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs text-destructive">Inactive</span>`,
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
              aria-label="Edit staff"
              title="Edit staff"
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

            fetchStaffData(cell.getRow().getData().id);
          },
        },
      ],
    });

    table.current = staffTable;
    staffTable.on("tableBuilt", getStaff);

    return () => {
      staffTable.off("tableBuilt", getStaff);
      staffTable.destroy();

      if (table.current === staffTable) {
        table.current = null;
      }
    };
  }, [fetchStaffData, getStaff]);

  // ================= BUTTON TEXT =================

  let submitText = isEditing ? "Update Staff" : "Save Staff";

  if (formLoading) {
    submitText = "Loading...";
  } else if (saving) {
    submitText = isEditing ? "Updating..." : "Saving...";
  }

  // ================= UI =================

  return (
    <>
      <PageHeader
        title="Staff Management"
        sub_text="Create, manage and maintain staff records."
        breadcrumbs={[{ label: "Staff" }, { label: "Staff Management" }]}
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
              disabled={isBusy}
              onClick={openCreateDrawer}
            >
              <UserRoundPlus size={16} aria-hidden="true" className="mr-2" />
              Add Staff
            </button>

            <CustomDrawer
              open={openDrawer}
              setOpen={handleDrawerChange}
              saving={isBusy}
              title={isEditing ? "Update Staff" : "Create Staff"}
              description="Add or update a staff member."
              submitText={submitText}
              onSubmit={handleSubmit(saveStaff)}
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
                  Loading staff details...
                </p>
              )}

              <form
                noValidate
                aria-busy={isBusy}
                onSubmit={handleSubmit(saveStaff)}
              >
                <fieldset
                  disabled={isBusy}
                  className="m-0 min-w-0 space-y-6 border-0 p-0"
                >
                  <FormSection
                    title="Personal information"
                    description="Identity and contact details of the staff member."
                  >
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      {PERSONAL_FIELDS.map((item) => (
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
                            className={`custom-input-sm ${
                              errors[item.name] ? "border-red-400" : ""
                            }`}
                            aria-invalid={!!errors[item.name]}
                            {...register(item.name, {
                              required: `${item.label} is required`,
                              maxLength: {
                                value: item.maxLength,
                                message: `Maximum ${item.maxLength} characters`,
                              },
                              ...(item.name === "email"
                                ? {
                                    pattern: {
                                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                      message: "Enter a valid email address",
                                    },
                                  }
                                : {}),
                            })}
                          />

                          <FieldError errors={errors} name={item.name} />
                        </div>
                      ))}

                      <div className="sm:col-span-2">
                        <label className="mb-2 block text-sm font-semibold">
                          Gender
                        </label>

                        <div className="flex items-center gap-5">
                          {["Male", "Female"].map((gender) => (
                            <label
                              key={gender}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <input
                                type="radio"
                                value={gender}
                                className="h-4 w-4 accent-[var(--primary)]"
                                {...register("gender", {
                                  required: "Gender is required",
                                })}
                              />
                              {gender}
                            </label>
                          ))}
                        </div>

                        <FieldError errors={errors} name="gender" />
                      </div>

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
                          placeholder="Enter address"
                          className="custom-input-sm resize-none"
                          aria-invalid={!!errors.address}
                          {...register("address", {
                            required: "Address is required",
                            maxLength: {
                              value: 500,
                              message: "Maximum 500 characters",
                            },
                          })}
                        />

                        <FieldError errors={errors} name="address" />
                      </div>
                    </div>
                  </FormSection>

                  <FormSection
                    title="Job information"
                    description="Work assignment, joining date and status."
                  >
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      {JOB_FIELDS.map((item) => (
                        <div key={item.name}>
                          <label
                            htmlFor={item.name}
                            className="mb-2 block text-sm font-semibold"
                          >
                            {item.label}
                          </label>

                          <NativeSelect
                            id={item.name}
                            className="custom-input-sm"
                            aria-invalid={!!errors[item.name]}
                            {...register(item.name, {
                              required: `${item.label} is required`,
                            })}
                          >
                            <option value="">
                              Select {item.label.toLowerCase()}
                            </option>

                            {item.options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </NativeSelect>

                          <FieldError errors={errors} name={item.name} />
                        </div>
                      ))}

                      {/* Flatpickr date field */}
                      <div>
                        <label
                          htmlFor="joining_date"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Joining Date
                        </label>

                        <Controller
                          name="joining_date"
                          control={control}
                          rules={{
                            required: "Joining date is required",
                          }}
                          render={({ field }) => (
                            <Flatpickr
                              id="joining_date"
                              name={field.name}
                              value={field.value || ""}
                              options={DATE_OPTIONS}
                              disabled={isBusy}
                              placeholder="Select joining date"
                              className={`custom-input-sm w-full ${
                                errors.joining_date ? "border-red-400" : ""
                              }`}
                              aria-invalid={!!errors.joining_date}
                              onChange={(_, dateString) => {
                                field.onChange(dateString);
                              }}
                              onClose={() => {
                                field.onBlur();
                              }}
                              onReady={(_, __, instance) => {
                                field.ref(instance.input);
                              }}
                            />
                          )}
                        />

                        <FieldError errors={errors} name="joining_date" />
                      </div>

                      {/* Active status */}
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
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold">Staff List</h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage staff members across all branches.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Staff
                  </span>
                </div>

                <div id="staff-tb" className="p-6">
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
        targetId="staff-tb"
        show={tableLoading}
        text="Loading Staff Details"
      />
    </>
  );
}
