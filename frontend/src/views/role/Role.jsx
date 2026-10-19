import TableSearch from "@/components/TableSearch";
import { Plus } from "lucide-react";
import { Input, Textarea } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import { useEffect, useRef, useState } from "react";
import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import CustomDrawer from "@/components/Drawer";
import { useForm, useWatch } from "react-hook-form";
import axiosClient from "@/axios-client";

export default function Role() {
  const [openDrawer, setOpenDrawer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [update_id, set_update_id] = useState("");

  const tableRef = useRef(null);
  const table = useRef(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: {
      role_name: "",
      role_description: "",
      status: true,
    },
  });

  const status = useWatch({ control, name: "status" });

  const open_create_drawer = () => {
    reset({
      role_name: "",
      role_description: "",
      status: true,
    });
    set_update_id("");
    setGeneralError("");
    setOpenDrawer(true);
  };

  const onSubmit = (form_data) => {
    setGeneralError("");
    setSaving(true);

    const payload = { form_data };

    if (update_id) {
      payload.upd_id = update_id;
    }

    axiosClient
      .post("/save_role", payload)
      .then(() => {
        reset({
          role_name: "",
          role_description: "",
          status: true,
        });

        set_update_id("");
        setOpenDrawer(false);
      })
      .catch((err) => {
        if (err.response && err.response.status === 422) {
          const server_errors = err.response.data.errors || {};

          Object.keys(server_errors).forEach((field) => {
            setError(field, {
              type: "server",
              message: server_errors[field][0],
            });
          });
        } else {
          setGeneralError("Something went wrong. Please try again.");
        }
      })
      .finally(() => {
        setSaving(false);
      });
  };

  useEffect(() => {
    table.current = new Tabulator(tableRef.current, {
      layout: "fitColumns",
      responsiveLayout: "collapse",
      maxHeight: "550px",
      placeholder: '<div class="ir-table-empty"><strong>No Roles Found</strong><p>Add a record using the create button, or clear your search to see more results.</p></div>',
      movableColumns: true,
      columnHeaderVertAlign: "middle",

      // Dummy Data
      data: [
        {
          id: 1,
          role_name: "Administrator",
          description: "Full system access with all modules and permissions.",
          status: 1,
        },
        {
          id: 2,
          role_name: "Manager",
          description: "Manage branches, vehicles, employees and reports.",
          status: 1,
        },
        {
          id: 3,
          role_name: "Staff",
          description: "Limited access for daily operational activities.",
          status: 1,
        },
        {
          id: 4,
          role_name: "Customer Support",
          description: "Handle customer inquiries and rental issues.",
          status: 0,
        },
        {
          id: 5,
          role_name: "Accountant",
          description: "Manage payments, invoices and financial reports.",
          status: 1,
        },
      ],

      columns: [
        {
          title: "Role Name",
          field: "role_name",
          frozen: true,
          width: 160,
        },
        {
          title: "Description",
          field: "description",
          widthGrow: 2,
        },
        {
          title: "Status",
          field: "status",
          hozAlign: "center",
          width: 130,

          formatter: function (cell) {
            let value = cell.getValue();

            if (value == 1) {
              return `
                <span class="inline-flex items-center rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-medium text-[var(--success)]">
                    Active
                </span>
            `;
            }

            return `
            <span class="inline-flex items-center rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-medium text-destructive">
                Deactive
            </span>
        `;
          },
        },
        {
          title: "Actions",
          field: "id",
          hozAlign: "center",
          width: 110,
          headerSort: false,

          formatter: function () {
            return `
                        <div class="flex items-center justify-center">
                            <button aria-label="Edit record" title="Edit record" class="table-action-btn">
                                <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m16 3 5 5M9 15l-1 4 4-1L22 8a2.1 2.1 0 0 0-5-5Z"/></svg>
                            </button>
                        </div>
                    `;
          },
        },
      ],
    });

    return () => {
      table.current?.destroy();
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Role Management"
        sub_text="Create, manage and control system roles and permissions."
        breadcrumbs={[{ label: "Role" }, { label: "Role Management" }]}
      />

      <div className="management-page">
        <div className="page-container">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <button
              className="btn-primary management-add"
              onClick={open_create_drawer}
            >
              <Plus size={16} aria-hidden="true" className="mr-2"/>
              Add Role
            </button>

            <CustomDrawer
              saving={saving}
              open={openDrawer}
              setOpen={setOpenDrawer}
              title={update_id ? "Update Role" : "Create Role"}
              description="Add a new system role and permissions"
              submitText="Save Role"
              onSubmit={handleSubmit(onSubmit)}
              size="max-w-2xl"
            >
              {generalError && <div className="form-alert" role="alert">{generalError}</div>}
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Role Name
                    </label>
                    <Input aria-label="Role Name"
                      {...register("role_name", {
                        required: "Username is required",
                      })}
                      type="text"
                      placeholder="Enter role name"
                      className="custom-input-sm"
                    />
                    {errors.role_name && <p role="alert" className="mt-2 text-xs text-destructive">{errors.role_name.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Description
                    </label>
                    <Textarea aria-label="Description"
                      {...register("role_description", {
                        required: "Description is required",
                      })}
                      rows="3"
                      placeholder="Enter role description"
                      className="custom-input-sm resize-none"
                    />
                    {errors.role_description && <p role="alert" className="mt-2 text-xs text-destructive">{errors.role_description.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-3">
                      Status
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <Input aria-label="Status"
                          {...register("status")}
                          type="checkbox"
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-secondary rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
                      </label>
                      <span className="text-sm text-muted-foreground">
                        {status ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                </div>
              </form>
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b bg-card">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Role List
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage system roles and permissions.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[var(--info-soft)] text-primary text-sm font-medium">
                    Roles
                  </span>
                </div>

                <div className="p-6">
                  <TableSearch table={table}/>
                  <div
                    ref={tableRef}
                    className="rounded-xl border border-border overflow-hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
