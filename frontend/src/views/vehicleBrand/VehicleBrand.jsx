import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Plus, TriangleAlert, ImagePlus, Trash2, Undo2 } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";

import TableSearch from "@/components/TableSearch";
import FieldError from "@/components/ErrorField";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/PageHeader";
import CustomDrawer from "@/components/Drawer";
import CarLoader from "@/components/CarLoader";
import axiosClient from "@/axios-client";

import "tabulator-tables/dist/css/tabulator.min.css";

const EMPTY_FORM = {
  brand_name: "",
  country: "",
  status: true,
};

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function errorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

export default function VehicleBrand() {
  const [openDrawer, setOpenDrawer] = useState(false);
  const [updateId, setUpdateId] = useState("");

  const [tableLoading, setTableLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // IMAGE FUNCTIONALITY:
  // Keep the selected file separate from the existing saved image.
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState("");
  const [localPreview, setLocalPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const fileInputRef = useRef(null);

  const tableRef = useRef(null);
  const table = useRef(null);
  const requestBusy = useRef(false);

  const mounted = useRef(false);
  const listRequest = useRef(null);
  const formRequest = useRef(null);

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

  const status = useWatch({ control, name: "status" });

  const isEditing = updateId !== "";
  const isBusy = saving || formLoading;

  const previewUrl = localPreview || (!removeLogo ? existingLogoUrl : "");

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      listRequest.current?.abort();
      formRequest.current?.abort();
    };
  }, []);

  // IMAGE FUNCTIONALITY:
  // Release temporary browser URLs when files change or page unmounts.
  useEffect(() => {
    if (!selectedLogo) {
      setLocalPreview("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedLogo);
    setLocalPreview(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedLogo]);

  const resetImages = useCallback(() => {
    setSelectedLogo(null);
    setExistingLogoUrl("");
    setLocalPreview("");
    setRemoveLogo(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  // ================= LOAD TABLE =================

  const getVehicleBrands = useCallback(async () => {
    listRequest.current?.abort();

    const controller = new AbortController();
    listRequest.current = controller;

    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post(
        "/get_vehicle_brands",
        {},
        { signal: controller.signal },
      );

      if (controller.signal.aborted || !mounted.current) return;

      if (!data.status || !Array.isArray(data.data)) {
        throw new Error(data.message || "Unable to load vehicle brands.");
      }

      await table.current?.setData(data.data);
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;

      setPageError(errorMessage(error, "Unable to load vehicle brands."));
    } finally {
      if (mounted.current && listRequest.current === controller) {
        setTableLoading(false);
        listRequest.current = null;
      }
    }
  }, []);

  // ================= OPEN CREATE =================

  const openCreateDrawer = () => {
    if (requestBusy.current) return;

    reset({ ...EMPTY_FORM });
    resetImages();
    setUpdateId("");
    setFormError("");
    setSuccessMessage("");
    setOpenDrawer(true);
  };

  // ================= FETCH FOR EDIT =================

  const fetchVehicleBrandData = useCallback(
    async (id) => {
      if (!id || requestBusy.current) return;

      requestBusy.current = true;

      const controller = new AbortController();
      formRequest.current = controller;

      reset({ ...EMPTY_FORM });
      resetImages();
      setUpdateId(id);
      setFormError("");
      setPageError("");
      setSuccessMessage("");
      setFormLoading(true);
      setOpenDrawer(true);

      try {
        const { data } = await axiosClient.post(
          "/fetch_vehicle_brand_data",
          { upd_id: id },
          { signal: controller.signal },
        );

        if (controller.signal.aborted || !mounted.current) return;

        if (!data.status || !data.data) {
          throw new Error(data.message || "Unable to fetch vehicle brand.");
        }

        const brand = data.data;

        setUpdateId(brand.ID);

        reset({
          brand_name: brand.brand_name ?? "",
          country: brand.country ?? "",
          status: Number(brand.status) === 1,
        });

        // IMAGE FUNCTIONALITY: display the existing saved logo.
        setExistingLogoUrl(brand.logo_url ?? "");
      } catch (error) {
        if (controller.signal.aborted || !mounted.current) return;

        reset({ ...EMPTY_FORM });
        resetImages();
        setUpdateId("");
        setOpenDrawer(false);

        setPageError(errorMessage(error, "Unable to fetch vehicle brand."));
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
    [reset, resetImages],
  );

  // ================= IMAGE FUNCTIONALITY: SELECT =================

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    clearErrors("logo");

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("logo", {
        type: "manual",
        message: "Please select a JPG, PNG or WebP image.",
      });

      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("logo", {
        type: "manual",
        message: "Logo must not exceed 2 MB.",
      });

      event.target.value = "";
      return;
    }

    setSelectedLogo(file);
    setRemoveLogo(false);
  };

  // ================= IMAGE FUNCTIONALITY: REMOVE =================

  const handleRemoveLogo = () => {
    setSelectedLogo(null);
    setLocalPreview("");
    setRemoveLogo(Boolean(existingLogoUrl));
    clearErrors("logo");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // IMAGE FUNCTIONALITY:
  // Cancel replacement/removal and restore the original saved image.
  const handleRestoreLogo = () => {
    setSelectedLogo(null);
    setLocalPreview("");
    setRemoveLogo(false);
    clearErrors("logo");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ================= SAVE CREATE / UPDATE =================

  const saveVehicleBrand = async (values) => {
    if (requestBusy.current) return;

    requestBusy.current = true;

    const controller = new AbortController();
    formRequest.current = controller;

    clearErrors();
    setFormError("");
    setSuccessMessage("");
    setSaving(true);

    // IMAGE FUNCTIONALITY:
    // FormData sends the actual file as multipart/form-data.
    const payload = new FormData();

    payload.append("brand_name", values.brand_name.trim());
    payload.append("country", values.country.trim());
    payload.append("status", values.status ? "1" : "0");
    payload.append("remove_logo", removeLogo ? "1" : "0");

    if (isEditing) {
      payload.append("upd_id", String(updateId));
    }

    if (selectedLogo) {
      payload.append("logo", selectedLogo);
    }

    try {
      // Do not manually set Content-Type:
      // the browser supplies the multipart boundary.
      const { data } = await axiosClient.post("/save_vehicle_brand", payload, {
        signal: controller.signal,
      });

      if (controller.signal.aborted || !mounted.current) return;

      if (!data.status) {
        throw new Error(data.message || "Unable to save vehicle brand.");
      }

      reset({ ...EMPTY_FORM });
      resetImages();
      setUpdateId("");
      setOpenDrawer(false);

      setSuccessMessage(data.message || "Vehicle brand saved successfully.");

      await getVehicleBrands();
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;

      if (error.response?.status === 422) {
        const serverErrors = error.response.data.errors ?? {};
        const generalMessages = [];
        const knownFields = ["brand_name", "country", "status", "logo"];

        Object.entries(serverErrors).forEach(([field, messages]) => {
          const message = Array.isArray(messages)
            ? messages[0]
            : String(messages);

          if (knownFields.includes(field)) {
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
        setFormError(errorMessage(error, "Unable to save vehicle brand."));
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

  const handleDrawerChange = (open) => {
    if (requestBusy.current) return;

    setOpenDrawer(open);

    if (!open) {
      reset({ ...EMPTY_FORM });
      resetImages();
      setUpdateId("");
      setFormError("");
    }
  };

  // ================= INITIALIZE TABLE =================

  useEffect(() => {
    const brandTable = new Tabulator(tableRef.current, {
      index: "id",
      layout: "fitColumns",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",
      placeholder: "No vehicle brands found.",

      columns: [
        {
          title: "Brand Name",
          field: "brand_name",
          formatter: "plaintext",
          minWidth: 180,
          widthGrow: 2,
        },
        {
          title: "Country",
          field: "country",
          formatter: "plaintext",
          minWidth: 160,
          widthGrow: 2,
        },
        {
          title: "Logo",
          field: "logo_url",
          hozAlign: "center",
          width: 110,
          headerSort: false,

          // IMAGE FUNCTIONALITY:
          // Use DOM elements instead of interpolating URLs into HTML.
          formatter: (cell) => {
            const wrapper = document.createElement("div");
            wrapper.className = "flex items-center justify-center";

            const showFallback = () => {
              const label = document.createElement("span");
              label.className = "text-xs text-muted-foreground";
              label.textContent = "No logo";
              wrapper.replaceChildren(label);
            };

            const value = cell.getValue();

            if (!value) {
              showFallback();
              return wrapper;
            }

            const image = document.createElement("img");

            image.src = value;
            image.alt = `${cell.getRow().getData().brand_name} logo`;
            image.loading = "lazy";
            image.width = 40;
            image.height = 40;
            image.className =
              "h-10 w-10 rounded-lg border border-border bg-white p-1 object-contain";

            image.addEventListener("error", showFallback, {
              once: true,
            });

            wrapper.appendChild(image);

            return wrapper;
          },
        },
        {
          title: "Status",
          field: "status",
          hozAlign: "center",
          width: 120,

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
              aria-label="Edit vehicle brand"
              title="Edit vehicle brand"
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

            void fetchVehicleBrandData(cell.getRow().getData().id);
          },
        },
      ],
    });

    table.current = brandTable;
    brandTable.on("tableBuilt", getVehicleBrands);

    return () => {
      listRequest.current?.abort();

      brandTable.off("tableBuilt", getVehicleBrands);
      brandTable.destroy();

      if (table.current === brandTable) {
        table.current = null;
      }
    };
  }, [fetchVehicleBrandData, getVehicleBrands]);

  let submitText = isEditing ? "Update Brand" : "Save Brand";

  if (formLoading) {
    submitText = "Loading...";
  } else if (saving) {
    submitText = isEditing ? "Updating..." : "Saving...";
  }

  return (
    <>
      <PageHeader
        title="Vehicle Brand Management"
        sub_text="Create, manage and maintain vehicle brands."
        breadcrumbs={[
          { label: "Vehicle" },
          { label: "Vehicle Brand Management" },
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
                  onClick={() => void getVehicleBrands()}
                  className="mt-2 text-sm font-semibold underline disabled:opacity-50"
                >
                  Retry loading brands
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
              Add Vehicle Brand
            </button>

            <CustomDrawer
              open={openDrawer}
              setOpen={handleDrawerChange}
              saving={isBusy}
              title={
                isEditing ? "Update Vehicle Brand" : "Create Vehicle Brand"
              }
              description="Manage brand details and the brand logo."
              submitText={submitText}
              onSubmit={handleSubmit(saveVehicleBrand)}
              size="max-w-2xl"
            >
              {formError && (
                <div role="alert" className="form-alert mb-5">
                  {formError}
                </div>
              )}

              {formLoading && (
                <p role="status" className="mb-4 text-sm text-muted-foreground">
                  Loading vehicle brand details...
                </p>
              )}

              <form
                noValidate
                aria-busy={isBusy}
                onSubmit={handleSubmit(saveVehicleBrand)}
              >
                <fieldset
                  disabled={isBusy}
                  className="m-0 min-w-0 space-y-5 border-0 p-0"
                >
                  <div>
                    <label
                      htmlFor="brand_name"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Brand Name
                    </label>

                    <Input
                      id="brand_name"
                      type="text"
                      maxLength={100}
                      placeholder="Enter brand name"
                      className="custom-input-sm"
                      aria-invalid={!!errors.brand_name}
                      {...register("brand_name", {
                        required: "Brand name is required.",
                        validate: (value) =>
                          value.trim().length > 0 ||
                          "Brand name cannot contain only spaces.",
                        maxLength: {
                          value: 100,
                          message: "Maximum 100 characters.",
                        },
                      })}
                    />

                    <FieldError errors={errors} name="brand_name" />
                  </div>

                  <div>
                    <label
                      htmlFor="brand_country"
                      className="mb-2 block text-sm font-semibold"
                    >
                      Country
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        Optional
                      </span>
                    </label>

                    <Input
                      id="brand_country"
                      type="text"
                      maxLength={100}
                      placeholder="Enter country"
                      className="custom-input-sm"
                      aria-invalid={!!errors.country}
                      {...register("country", {
                        maxLength: {
                          value: 100,
                          message: "Maximum 100 characters.",
                        },
                      })}
                    />

                    <FieldError errors={errors} name="country" />
                  </div>

                  {/* IMAGE FUNCTIONALITY: upload, preview and removal */}
                  <div className="rounded-xl border border-border bg-secondary/10 p-5">
                    <div className="mb-4 flex items-start gap-3">
                      <span className="rounded-lg bg-primary/10 p-2 text-primary">
                        <ImagePlus size={19} aria-hidden="true" />
                      </span>

                      <div>
                        <label
                          htmlFor="brand_logo"
                          className="block text-sm font-semibold"
                        >
                          Brand Logo
                        </label>

                        <p className="mt-1 text-xs text-muted-foreground">
                          Optional · JPG, PNG or WebP · Maximum 2 MB
                        </p>
                      </div>
                    </div>

                    <input
                      ref={fileInputRef}
                      id="brand_logo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleLogoChange}
                      aria-invalid={!!errors.logo}
                      className="block w-full rounded-lg border border-border bg-card text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:border-0 file:bg-primary file:px-4 file:py-3 file:text-sm file:font-medium file:text-primary-foreground disabled:opacity-50"
                    />

                    <FieldError errors={errors} name="logo" />

                    {previewUrl && (
                      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
                        <img
                          src={previewUrl}
                          alt="Vehicle brand logo preview"
                          className="h-20 w-20 rounded-xl border border-border bg-white p-2 object-contain"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="break-all text-sm font-medium">
                            {selectedLogo
                              ? selectedLogo.name
                              : "Current brand logo"}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedLogo
                              ? "New image will be uploaded when you save."
                              : "Choose another image to replace this logo."}
                          </p>

                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-destructive hover:underline"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            Remove image
                          </button>
                        </div>
                      </div>
                    )}

                    {removeLogo && !selectedLogo && (
                      <p
                        role="status"
                        className="mt-3 text-sm text-destructive"
                      >
                        The saved logo will be removed when you save.
                      </p>
                    )}

                    {existingLogoUrl && (removeLogo || selectedLogo) && (
                      <button
                        type="button"
                        onClick={handleRestoreLogo}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                      >
                        <Undo2 size={14} aria-hidden="true" />
                        Keep original image
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                    <div>
                      <label
                        htmlFor="brand_status"
                        className="block text-sm font-semibold"
                      >
                        Active Status
                      </label>

                      <p className="mt-1 text-xs text-muted-foreground">
                        {status
                          ? "This brand is marked as active."
                          : "This brand is marked as inactive."}
                      </p>

                      <FieldError errors={errors} name="status" />
                    </div>

                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        id="brand_status"
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
                </fieldset>
              </form>
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold">
                      Vehicle Brand List
                    </h2>

                    <p className="mt-1 text-sm text-muted-foreground">
                      Manage vehicle brands and their logos.
                    </p>
                  </div>

                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Brands
                  </span>
                </div>

                <div
                  id="vehicle-brand-tb"
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
        targetId="vehicle-brand-tb"
        show={tableLoading}
        text="Loading Vehicle Brands"
      />
    </>
  );
}
