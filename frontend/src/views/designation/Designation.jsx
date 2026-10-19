import TableSearch from "@/components/TableSearch";
import { Plus } from "lucide-react";
import axiosClient from "@/axios-client";
import PageHeader from "@/components/PageHeader";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import CarLoader from "@/components/CarLoader";
import CustomDrawer from "@/components/Drawer";

import DesignationForm from "./DesignationForm";

export default function Designation() {
  const [openDrawer, setOpenDrawer] = useState(false);

  const [tableLoading, setTableLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generalError, setGeneralError] = useState("");

  const [update_id, set_update_id] = useState("");
  const [form_load, set_form_load] = useState(false);

  const tableRef = useRef(null);
  const table = useRef(null);

  // ================= react-hook-form =================
  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm({
    defaultValues: {
      designation_name: "",
      status: true,
    },
  });

  const open_create_drawer = () => {
    reset({
      designation_name: "",
      status: true,
    });
    clearErrors();
    set_update_id("");
    setGeneralError("");
    setOpenDrawer(true);
  };

  const get_designation = () => {
    setTableLoading(true);

    axiosClient
      .post("/get_designation")
      .then(({ data }) => {
        table.current?.setData(data.data);
      })
      .catch(() => {
        console.log("Failed loading designations");
      })
      .finally(() => {
        setTableLoading(false);
      });
  };

  // ================= SAVE (Create / Update) =================
  const onSubmit = (form_data) => {
    setGeneralError("");
    setSaving(true);

    const payload = {
      form_data: {
        ...form_data,
        status: form_data.status ? 1 : 0,
      },
    };

    if (update_id) {
      payload.upd_id = update_id;
    }

    axiosClient
      .post("/save_designation", payload)
      .then(() => {
        reset({
          designation_name: "",
          status: true,
        });

        set_update_id("");
        setOpenDrawer(false);
        get_designation();
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

  // ================= FETCH FOR EDIT =================
  const fetch_designation_data = (id) => {
    set_form_load(true);
    clearErrors();
    setGeneralError("");
    setOpenDrawer(true);

    axiosClient
      .post("/fetch_designation_data", {
        upd_id: id,
      })
      .then(({ data }) => {
        set_update_id(data.data.ID);

        reset({
          designation_name: data.data.designation_name || "",
          status: data.data.status == 1,
        });
      })
      .catch(() => {
        console.log("Failed fetching designation data");
      })
      .finally(() => {
        set_form_load(false);
      });
  };

  useEffect(() => {
    table.current = new Tabulator(tableRef.current, {
      layout: "fitColumns",
      maxHeight: "550px",
      placeholder: '<div class="ir-table-empty"><strong>No Designations Found</strong><p>Add a record using the create button, or clear your search to see more results.</p></div>',
      movableColumns: true,
      columnHeaderVertAlign: "middle",

      columns: [
        {
          title: "Designation Name",
          field: "designation_name",
          frozen: true,
          widthGrow: 2,
        },
        {
          title: "Status",
          field: "status",
          hozAlign: "center",
          width: 140,
          formatter: function (cell) {
            let value = cell.getValue();
            if (value == 1) {
              return `<span class="inline-flex items-center rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-medium text-[var(--success)]">Active</span>`;
            }
            return `<span class="inline-flex items-center rounded-full bg-[var(--danger-soft)] px-3 py-1 text-xs font-medium text-destructive">Deactive</span>`;
          },
        },
        {
          title: "Actions",
          field: "id",
          hozAlign: "center",
          vertAlign: "middle",
          width: 120,
          headerSort: false,
          formatter: function () {
            return `
                <div class="flex items-center justify-center w-full">
                    <button aria-label="Edit record" title="Edit record" class="table-action-btn" id="edit-designation">
                        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="m16 3 5 5M9 15l-1 4 4-1L22 8a2.1 2.1 0 0 0-5-5Z"/></svg>
                    </button>
                </div>
            `;
          },
          cellClick: function (e, cell) {
            let id = cell.getRow().getData().id;
            fetch_designation_data(id);
          },
        },
      ],
    });

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Keep the existing initial API request and loading state.
    get_designation();

    return () => {
      table.current?.destroy();
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Designation Management"
        sub_text="Create, manage and maintain staff designations."
        breadcrumbs={[
          { label: "Designation" },
          { label: "Designation Management" },
        ]}
      />

      <div className="management-page">
        <div className="page-container">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <button
              className="btn-primary management-add"
              onClick={open_create_drawer}
            >
              <Plus size={16} aria-hidden="true" className="mr-2" />
              Add Designation
            </button>

            <CustomDrawer
              saving={saving || form_load}
              open={openDrawer}
              setOpen={setOpenDrawer}
              title={update_id ? "Update Designation" : "Create Designation"}
              description="Add or update a staff designation"
              submitText={
                saving
                  ? update_id
                    ? "Updating..."
                    : "Saving..."
                  : update_id
                    ? "Update Designation"
                    : "Save Designation"
              }
              onSubmit={(event) => handleSubmit(onSubmit)(event)}
              size="max-w-xl"
            >
              <DesignationForm
                register={register}
                errors={errors}
                generalError={generalError}
                onSubmit={(event) => handleSubmit(onSubmit)(event)}
              />
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b bg-card">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Designation List
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Manage staff designations.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[var(--info-soft)] text-primary text-sm font-medium">
                    Designations
                  </span>
                </div>

                <div id="designation-tb" className="p-6">
                  <TableSearch table={table} />
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

      <CarLoader
        targetId="designation-tb"
        show={tableLoading}
        text="Loading Designations"
      />
    </>
  );
}
