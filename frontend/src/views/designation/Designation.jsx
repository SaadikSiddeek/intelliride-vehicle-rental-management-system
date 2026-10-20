import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, TriangleAlert } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import axiosClient from "@/axios-client";
import TableSearch from "@/components/TableSearch";
import PageHeader from "@/components/PageHeader";
import CarLoader from "@/components/CarLoader";
import CustomDrawer from "@/components/Drawer";
import DesignationForm from "./DesignationForm";

import "tabulator-tables/dist/css/tabulator.min.css";

const DEFAULT_VALUES = {
  designation_name: "",
  status: true,
};

export default function Designation() {
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

  const getDesignations = useCallback(async () => {
    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post("/get_designation");

      if (!data.status) {
        throw new Error(data.message || "Unable to load designations.");
      }

      await table.current?.setData(data.data ?? []);
    } catch (error) {
      setPageError(
        error.response?.data?.message ||
          error.message ||
          "Unable to load designations.",
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

  const fetchDesignationData = useCallback(
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
        const { data } = await axiosClient.post("/fetch_designation_data", {
          upd_id: id,
        });

        if (!data.status || !data.data) {
          throw new Error(data.message || "Unable to load designation.");
        }

        const designation = data.data;

        setUpdateId(designation.ID);

        reset(
          {
            designation_name: designation.designation_name ?? "",
            status: Number(designation.status) === 1,
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
            "Unable to load designation.",
        );
      } finally {
        setFormLoading(false);
        requestBusy.current = false;
      }
    },
    [reset],
  );

  const saveDesignation = async (formData) => {
    if (requestBusy.current) return;

    requestBusy.current = true;

    clearErrors();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    const payload = {
      form_data: {
        designation_name: formData.designation_name.trim(),
        status: formData.status ? 1 : 0,
      },
    };

    if (isEditing) {
      payload.upd_id = updateId;
    }

    try {
      const { data } = await axiosClient.post("/save_designation", payload);

      if (!data.status) {
        throw new Error(data.message || "Unable to save designation.");
      }

      reset();
      setUpdateId("");
      setOpenDrawer(false);

      setSuccessMessage(
        data.message ||
          (isEditing
            ? "Designation updated successfully."
            : "Designation created successfully."),
      );

      await getDesignations();
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
          setFormError(
            error.response.data.message || "Please check the submitted values.",
          );
        }
      } else {
        setFormError(
          error.response?.data?.message ||
            error.message ||
            "Unable to save designation.",
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
    const designationTable = new Tabulator(tableRef.current, {
      index: "ID",
      layout: "fitColumns",
      responsiveLayout: "collapse",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",

      placeholder: `
        <div class="ir-table-empty">
          <strong>No Designations Found</strong>
          <p>Add a designation or clear your search.</p>
        </div>
      `,

      columns: [
        {
          title: "Designation Name",
          field: "designation_name",
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
              aria-label="Edit designation"
              title="Edit designation"
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

            fetchDesignationData(cell.getRow().getData().ID);
          },
        },
      ],
    });

    table.current = designationTable;
    designationTable.on("tableBuilt", getDesignations);

    return () => {
      designationTable.off("tableBuilt", getDesignations);
      designationTable.destroy();

      if (table.current === designationTable) {
        table.current = null;
      }
    };
  }, [fetchDesignationData, getDesignations]);

  let submitText = isEditing ? "Update Designation" : "Create Designation";

  if (formLoading) {
    submitText = "Loading...";
  } else if (saving) {
    submitText = isEditing ? "Updating..." : "Creating...";
  }

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
              Add Designation
            </button>

            <CustomDrawer
              open={openDrawer}
              setOpen={handleDrawerChange}
              saving={isBusy}
              title={isEditing ? "Update Designation" : "Create Designation"}
              description={
                isEditing
                  ? "Update the selected designation's details."
                  : "Enter the details for a new designation."
              }
              submitText={submitText}
              onSubmit={handleSubmit(saveDesignation)}
              size="max-w-xl"
            >
              <DesignationForm
                register={register}
                errors={errors}
                generalError={formError}
                formLoading={formLoading}
                isBusy={isBusy}
                onSubmit={handleSubmit(saveDesignation)}
              />
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Designation List
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      All registered staff designations.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Designations
                  </span>
                </div>

                <div id="designation-tb" className="p-6">
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
        targetId="designation-tb"
        show={tableLoading}
        text="Loading Designations"
      />
    </>
  );
}
