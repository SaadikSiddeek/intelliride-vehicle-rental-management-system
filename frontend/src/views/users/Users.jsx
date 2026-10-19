import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { TriangleAlert, UserRoundCog, Eye, EyeOff } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import FieldError from "@/components/ErrorField";
import TableSearch from "@/components/TableSearch";
import FormSection from "@/components/forms/FormSection";
import { Input, NativeSelect } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";

import axiosClient from "../../axios-client";
import CarLoader from "../../components/CarLoader";
import CustomDrawer from "../../components/Drawer";

import "tabulator-tables/dist/css/tabulator.min.css";
import { toast } from "sonner";

// reset() returns the form to these empty values.
const DEFAULT_VALUES = {
  username: "",
  email: "",
  emp_id: "",
  role_id: "",
  password: "",
  password_confirmation: "",
};

export default function Users() {
  // ================= PAGE STATE =================

  const [openDrawer, setOpenDrawer] = useState(false);
  const [updateId, setUpdateId] = useState("");

  const [tableLoading, setTableLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const isEditing = updateId !== "";
  const isBusy = saving || formLoading;

  // These refs manage Tabulator and prevent duplicate requests.
  const tableRef = useRef(null);
  const table = useRef(null);
  const requestBusy = useRef(false);

  // ================= REACT HOOK FORM =================

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

  // ================= LOAD USER LIST =================

  const getUsers = useCallback(async () => {
    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post("/get_users");

      if (!data.status) {
        throw new Error(data.message || "Unable to load users.");
      }

      await table.current?.setData(data.data ?? []);
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          error.message ||
          "Unable to load users.",
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

    setShowPassword(false);
    setShowConfirmPassword(false);

    setFormError("");
    setSuccessMessage("");
    setOpenDrawer(true);
  };

  // ================= FETCH USER FOR EDIT =================

  const fetchUserData = useCallback(
    async (id) => {
      if (!id || requestBusy.current) return;

      requestBusy.current = true;

      reset();
      setUpdateId(id);

      setShowPassword(false);
      setShowConfirmPassword(false);

      setFormError("");
      setPageError("");
      setSuccessMessage("");

      setFormLoading(true);
      setOpenDrawer(true);

      try {
        const { data } = await axiosClient.post("/fetch_user_data", {
          upd_id: id,
        });

        if (!data.status || !data.data) {
          throw new Error(data.message || "Unable to load user.");
        }

        const user = data.data;

        setUpdateId(user.ID);

        // Populate registered fields.
        // Preserve original defaults so reset() clears the form.
        reset(
          {
            username: user.username ?? "",
            email: user.email ?? "",
            emp_id: String(user.emp_id ?? ""),
            role_id: String(user.role_id ?? ""),
            password: "",
            password_confirmation: "",
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
            "Unable to load user.",
        );
      } finally {
        setFormLoading(false);
        requestBusy.current = false;
      }
    },
    [reset],
  );

  // ================= CREATE / UPDATE USER =================

  const saveUser = async (formData) => {
    if (requestBusy.current) return;

    requestBusy.current = true;

    clearErrors();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    const payload = {
      form_data: formData,
    };

    // Including upd_id tells the backend to update.
    if (isEditing) {
      payload.upd_id = updateId;
    }

    try {
      const { data } = await axiosClient.post("/save_user", payload);

      if (!data.status) {
        throw new Error(data.message || "Unable to save user.");
      }

      reset();
      setUpdateId("");
      setOpenDrawer(false);

      setShowPassword(false);
      setShowConfirmPassword(false);

      setSuccessMessage(data.message || "User saved successfully.");
      // toast.success("User created successfully");
      await getUsers();
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
            "Unable to save user.",
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

      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  };

  // ================= INITIALIZE TABLE =================

  useEffect(() => {
    const userTable = new Tabulator(tableRef.current, {
      index: "ID",
      layout: "fitColumns",
      responsiveLayout: "collapse",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",

      placeholder: `
        <div class="ir-table-empty">
          <strong>No Users Found</strong>
          <p>Add a user or clear your search.</p>
        </div>
      `,

      columns: [
        {
          title: "Username",
          field: "username",
          formatter: "plaintext",
          widthGrow: 1,
        },
        {
          title: "Email",
          field: "email",
          formatter: "plaintext",
          widthGrow: 2,
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
              aria-label="Edit user"
              title="Edit user"
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
                <path
                  d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                />
                <path
                  d="m16 3 5 5M9 15l-1 4 4-1L22 8a2.1 2.1 0 0 0-5-5Z"
                />
              </svg>
            </button>
          `,

          cellClick: (event, cell) => {
            if (!event.target.closest("button")) return;

            fetchUserData(cell.getRow().getData().ID);
          },
        },
      ],
    });

    table.current = userTable;

    userTable.on("tableBuilt", getUsers);

    return () => {
      userTable.off("tableBuilt", getUsers);
      userTable.destroy();

      if (table.current === userTable) {
        table.current = null;
      }
    };
  }, [fetchUserData, getUsers]);

  // ================= SUBMIT BUTTON TEXT =================

  let submitText = isEditing ? "Update User" : "Create User";

  if (formLoading) {
    submitText = "Loading...";
  } else if (saving) {
    submitText = isEditing ? "Updating..." : "Creating...";
  }

  // ================= UI =================

  return (
    <>
      <PageHeader
        title="Users Management"
        sub_text="Create, manage and monitor system users."
        breadcrumbs={[{ label: "User" }, { label: "User Management" }]}
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
              <UserRoundCog size={16} aria-hidden="true" className="mr-2" />
              Add User
            </button>

            <CustomDrawer
              open={openDrawer}
              setOpen={handleDrawerChange}
              saving={isBusy}
              title={isEditing ? "Update User" : "Create User"}
              description={
                isEditing
                  ? "Update the selected user's account details."
                  : "Enter the details for a new system user."
              }
              submitText={submitText}
              onSubmit={handleSubmit(saveUser)}
              size="max-w-2xl"
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
                  Loading user details...
                </p>
              )}

              <form
                onSubmit={handleSubmit(saveUser)}
                aria-busy={isBusy}
                noValidate
              >
                <fieldset
                  disabled={isBusy}
                  className="m-0 min-w-0 space-y-6 border-0 p-0"
                >
                  <FormSection
                    title="Account details"
                    description="Identify the person and their account email."
                  >
                    <div className="space-y-5">
                      {/* Username */}
                      <div>
                        <label
                          htmlFor="username"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Username
                        </label>

                        <Input
                          id="username"
                          type="text"
                          placeholder="Enter username"
                          autoComplete="username"
                          className="custom-input-sm"
                          aria-invalid={!!errors.username}
                          {...register("username", {
                            required: "Username is required",
                            maxLength: {
                              value: 100,
                              message: "Maximum 100 characters",
                            },
                          })}
                        />

                        <FieldError errors={errors} name="username" />
                      </div>

                      {/* Email */}
                      <div>
                        <label
                          htmlFor="email"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Email Address
                        </label>

                        <Input
                          id="email"
                          type="email"
                          placeholder="example@email.com"
                          autoComplete="email"
                          className="custom-input-sm"
                          aria-invalid={!!errors.email}
                          {...register("email", {
                            required: "Email is required",
                            maxLength: {
                              value: 150,
                              message: "Maximum 150 characters",
                            },
                            pattern: {
                              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                              message: "Enter a valid email address",
                            },
                          })}
                        />

                        <FieldError errors={errors} name="email" />
                      </div>
                    </div>
                  </FormSection>

                  <FormSection
                    title="Access & security"
                    description="Choose account access and password details."
                  >
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Employee */}
                        <div>
                          <label
                            htmlFor="emp_id"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Employee
                          </label>

                          <NativeSelect
                            id="emp_id"
                            className="custom-input-sm"
                            aria-invalid={!!errors.emp_id}
                            {...register("emp_id")}
                          >
                            <option value="">Select employee</option>
                            <option value="1">Ahamed Saadik</option>
                          </NativeSelect>

                          <FieldError errors={errors} name="emp_id" />
                        </div>

                        {/* Role */}
                        <div>
                          <label
                            htmlFor="role_id"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Role
                          </label>

                          <NativeSelect
                            id="role_id"
                            className="custom-input-sm"
                            aria-invalid={!!errors.role_id}
                            {...register("role_id", {
                              required: "Role is required",
                            })}
                          >
                            <option value="">Select role</option>
                            <option value="1">Software Engineer</option>
                          </NativeSelect>

                          <FieldError errors={errors} name="role_id" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Password */}
                        <div>
                          <label
                            htmlFor="password"
                            className="mb-2 block text-sm font-semibold"
                          >
                            {isEditing ? "New Password" : "Password"}
                          </label>

                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder={
                                isEditing
                                  ? "Leave blank to keep current"
                                  : "Enter password"
                              }
                              className="custom-input-sm pr-11"
                              aria-invalid={!!errors.password}
                              {...register("password", {
                                required: isEditing
                                  ? false
                                  : "Password is required",
                                minLength: {
                                  value: 8,
                                  message: "Use at least 8 characters",
                                },
                                deps: ["password_confirmation"],
                              })}
                            />

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                setShowPassword((visible) => !visible)
                              }
                              aria-label={
                                showPassword ? "Hide password" : "Show password"
                              }
                              aria-controls="password"
                              aria-pressed={showPassword}
                              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              {showPassword ? (
                                <EyeOff size={18} aria-hidden="true" />
                              ) : (
                                <Eye size={18} aria-hidden="true" />
                              )}
                            </button>
                          </div>

                          <FieldError errors={errors} name="password" />
                        </div>

                        {/* Confirm password */}
                        <div>
                          <label
                            htmlFor="password_confirmation"
                            className="mb-2 block text-sm font-semibold"
                          >
                            Confirm Password
                          </label>

                          <div className="relative">
                            <Input
                              id="password_confirmation"
                              type={showConfirmPassword ? "text" : "password"}
                              autoComplete="new-password"
                              placeholder="Confirm password"
                              className="custom-input-sm pr-11"
                              aria-invalid={!!errors.password_confirmation}
                              {...register("password_confirmation", {
                                validate: (value, values) =>
                                  value === values.password ||
                                  "Passwords do not match",
                              })}
                            />

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                setShowConfirmPassword((visible) => !visible)
                              }
                              aria-label={
                                showConfirmPassword
                                  ? "Hide confirmed password"
                                  : "Show confirmed password"
                              }
                              aria-controls="password_confirmation"
                              aria-pressed={showConfirmPassword}
                              className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              {showConfirmPassword ? (
                                <EyeOff size={18} aria-hidden="true" />
                              ) : (
                                <Eye size={18} aria-hidden="true" />
                              )}
                            </button>
                          </div>

                          <FieldError
                            errors={errors}
                            name="password_confirmation"
                          />
                        </div>
                      </div>

                      {isEditing && (
                        <p className="text-xs text-muted-foreground">
                          Leave both password fields blank to keep the current
                          password. Enter and confirm a new password only when
                          you want to change it.
                        </p>
                      )}
                    </div>
                  </FormSection>
                </fieldset>
              </form>
            </CustomDrawer>

            {/* User table */}
            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold">User List</h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      All registered system users.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Users
                  </span>
                </div>

                <div id="user-tb" className="p-6">
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

      <CarLoader targetId="user-tb" show={tableLoading} text="Loading Users" />
    </>
  );
}
