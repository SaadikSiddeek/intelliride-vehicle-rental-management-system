import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Plus, TriangleAlert } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";

import axiosClient from "@/axios-client";
import PageHeader from "@/components/PageHeader";
import CustomDrawer from "@/components/Drawer";
import TableSearch from "@/components/TableSearch";
import FieldError from "@/components/ErrorField";
import FormSection from "@/components/forms/FormSection";
import CarLoader from "@/components/CarLoader";
import { Input, Textarea } from "@/components/ui/input";

const EMPTY_FORM = {
  customer_type: "Local",
  full_name: "",
  mobile: "",
  email: "",
  address: "",
  country: "",
  document_type: "",
  document_number: "",
  document_expiry: "",
  licence_number: "",
  licence_country: "",
  licence_expiry: "",
  emergency_name: "",
  emergency_number: "",
  notes: "",
  status: "Active",
  block_reason: "",
};

const DOCUMENTS = {
  nic_front: "NIC front",
  nic_back: "NIC back",
  passport: "Passport photo page",
  licence_front: "Driving licence front",
  licence_back: "Driving licence back",
};

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

const EDIT_BUTTON = `
  <button type="button" class="table-action-btn"
    aria-label="Edit customer" title="Edit customer">
    <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="1.7"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="m16 3 5 5M9 15l-1 4 4-1L22 8a2.1 2.1 0 0 0-5-5Z"/>
    </svg>
  </button>
`;

function Section({ title, children }) {
  return (
    <FormSection title={title}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </FormSection>
  );
}

function FormField({
  name,
  label,
  register,
  errors,
  required = false,
  type = "text",
  options,
  maxLength,
  multiline = false,
}) {
  const rules = {
    required: required ? `${label} is required.` : false,
    validate: (value) =>
      !required ||
      Boolean(String(value ?? "").trim()) ||
      `${label} is required.`,
  };

  if (type === "email") {
    rules.pattern = { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address." };
  }

  if (type === "tel") {
    rules.validate = (value) => {
      if (!value?.trim()) return required ? `${label} is required.` : true;
      const digits = value.replace(/\D/g, "");

      return (
        (/^\+?[\d ()-]+$/.test(value.trim()) &&
          digits.length >= 7 &&
          digits.length <= 15) ||
        "Enter a phone number with 7 to 15 digits, including the country code if applicable."
      );
    };
  }

  const props = {
    id: name,
    "aria-invalid": Boolean(errors[name]),
    ...register(name, rules),
  };

  return (
    <div className={multiline ? "sm:col-span-2" : ""}>
      <label htmlFor={name} className="mb-2 block text-sm font-semibold">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>

      {options ? (
        <select
          {...props}
          className="custom-input-sm w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          {!required && <option value="">Select if available</option>}
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : multiline ? (
        <Textarea {...props} rows={3} maxLength={maxLength} />
      ) : (
        <Input
          {...props}
          type={type}
          maxLength={maxLength}
          className="custom-input-sm"
        />
      )}

      <FieldError errors={errors} name={name} />
    </div>
  );
}

function DocumentField({ kind, savedId, change, onChange, onError, errors }) {
  const previewRef = useRef(null);
  const [downloading, setDownloading] = useState(false);
  const file = change instanceof File ? change : null;

  useEffect(() => {
    if (!file || !previewRef.current) return;
    const image = previewRef.current;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => {
      image.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function selectFile(event) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;

    if (
      !IMAGE_TYPES.includes(selected.type) ||
      selected.size > MAX_IMAGE_SIZE
    ) {
      onError("Choose a JPG, PNG or WebP image up to 2 MB.");
      return;
    }

    onChange(selected);
  }

  async function downloadSavedFile() {
    setDownloading(true);
    try {
      // Axios supplies the Sanctum bearer token for this private download.
      const { data } = await axiosClient.get(`/customer_documents/${savedId}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${kind}.${data.type.split("/")[1] || "jpg"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      onError("Unable to download the saved document. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-w-0 rounded-lg border border-border p-3">
      <label htmlFor={kind} className="mb-2 block text-sm font-semibold">
        {DOCUMENTS[kind]}
      </label>

      <input
        id={kind}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        onChange={selectFile}
        className="block w-full text-xs"
      />

      {file && (
        <img
          ref={previewRef}
          alt={`${DOCUMENTS[kind]} preview`}
          className="mt-3 h-24 max-w-full rounded-md object-contain"
        />
      )}

      {savedId && change === null && (
        <p className="mt-2 text-xs text-destructive">
          This document will be removed when you save.
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-primary">
        {savedId && (
          <button
            type="button"
            disabled={downloading}
            onClick={downloadSavedFile}
          >
            {downloading ? "Downloading…" : "Download saved copy"}
          </button>
        )}

        {(file || (savedId && change !== null)) && (
          <button
            type="button"
            onClick={() => onChange(savedId ? null : undefined)}
          >
            Remove
          </button>
        )}

        {savedId && change !== undefined && (
          <button type="button" onClick={() => onChange(undefined)}>
            Keep original
          </button>
        )}
      </div>

      <FieldError errors={errors} name={kind} />
    </div>
  );
}

export default function Customer() {
  const methods = useForm({ defaultValues: EMPTY_FORM });
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    formState: { errors },
  } = methods;

  const [customerType, documentType, licenceNumber, licenceExpiry, status] =
    useWatch({
      control,
      name: [
        "customer_type",
        "document_type",
        "licence_number",
        "licence_expiry",
        "status",
      ],
    });

  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).get("create") === "1");
  const [updateId, setUpdateId] = useState(null);
  const [customerCode, setCustomerCode] = useState("");
  const [savedDocuments, setSavedDocuments] = useState({});
  const [changes, setChanges] = useState({});
  const [tableLoading, setTableLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const tableRef = useRef(null);
  const table = useRef(null);
  const listRequest = useRef(null);
  const listFilters = useRef({ status: "", customer_type: "" });
  const formRequest = useRef(null);

  const busy = formLoading || saving;
  const isEditing = updateId !== null;
  const hasLicenceImage = ["licence_front", "licence_back"].some(
    (key) =>
      changes[key] instanceof File ||
      (Boolean(savedDocuments[key]) && changes[key] !== null),
  );

  const resetDrawer = useCallback(() => {
    reset({ ...EMPTY_FORM });
    setUpdateId(null);
    setCustomerCode("");
    setSavedDocuments({});
    setChanges({});
    setFormError("");
  }, [reset]);

  const getCustomers = useCallback(async () => {
    listRequest.current?.abort();
    const request = new AbortController();
    listRequest.current = request;
    setTableLoading(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post(
        "/get_customers",
        listFilters.current,
        { signal: request.signal },
      );
      if (request.signal.aborted) return;
      if (!data.status || !Array.isArray(data.data)) {
        throw new Error("The customer list could not be loaded.");
      }
      await table.current?.setData(data.data);
    } catch (error) {
      if (!request.signal.aborted) {
        setPageError(error.response?.data?.message || error.message);
      }
    } finally {
      if (!request.signal.aborted) setTableLoading(false);
    }
  }, []);

  const editCustomer = useCallback(
    async (id) => {
      if (formRequest.current) return;
      const request = new AbortController();
      formRequest.current = request;

      resetDrawer();
      setUpdateId(id);
      setSuccess("");
      setPageError("");
      setFormLoading(true);
      setOpen(true);

      try {
        const { data } = await axiosClient.post(
          "/fetch_customer_data",
          { upd_id: id },
          { signal: request.signal },
        );
        if (request.signal.aborted) return;
        if (!data.status || !data.data)
          throw new Error("Unable to load customer.");

        const row = data.data;
        reset(
          Object.fromEntries(
            Object.entries(EMPTY_FORM).map(([key, fallback]) => [
              key,
              row[key] ?? fallback,
            ]),
          ),
        );
        setCustomerCode(row.customer_code);
        setSavedDocuments(row.documents || {});
      } catch (error) {
        if (!request.signal.aborted) {
          setOpen(false);
          setPageError(error.response?.data?.message || error.message);
        }
      } finally {
        if (formRequest.current === request) formRequest.current = null;
        if (!request.signal.aborted) setFormLoading(false);
      }
    },
    [reset, resetDrawer],
  );

  useEffect(() => {
    const instance = new Tabulator(tableRef.current, {
      index: "id",
      layout: "fitColumns",
      maxHeight: "550px",
      movableColumns: true,
      columnHeaderVertAlign: "middle",
      placeholder: "No customers found.",
      columns: [
        {
          title: "Customer Code",
          field: "customer_code",
          minWidth: 145,
          formatter: "plaintext",
        },
        {
          title: "Full Name",
          field: "full_name",
          minWidth: 180,
          formatter: "plaintext",
        },
        {
          title: "Type",
          field: "customer_type",
          width: 95,
          formatter: "plaintext",
        },
        {
          title: "Mobile",
          field: "mobile",
          minWidth: 135,
          formatter: "plaintext",
        },
        {
          title: "Email",
          field: "email",
          minWidth: 165,
          formatter: "plaintext",
        },
        {
          title: "Status",
          field: "status",
          width: 110,
          hozAlign: "center",
          formatter(cell) {
            const value = cell.getValue();
            const badge = document.createElement("span");
            const color = {
              Active: "bg-[var(--success-soft)] text-[var(--success)]",
              Inactive: "bg-secondary text-muted-foreground",
              Blocked: "bg-[var(--danger-soft)] text-destructive",
            };
            badge.className = `rounded-full px-3 py-1 text-xs font-medium ${color[value] || ""}`;
            badge.textContent = value;
            return badge;
          },
        },
        {
          title: "Actions",
          field: "id",
          width: 90,
          hozAlign: "center",
          headerSort: false,
          formatter: () => EDIT_BUTTON,
          cellClick(event, cell) {
            if (event.target.closest("button"))
              void editCustomer(cell.getValue());
          },
        },
      ],
    });

    table.current = instance;
    instance.on("tableBuilt", getCustomers);

    return () => {
      listRequest.current?.abort();
      formRequest.current?.abort();
      instance.off("tableBuilt", getCustomers);
      instance.destroy();
      table.current = null;
    };
  }, [editCustomer, getCustomers]);

  function openCreate() {
    if (formRequest.current) return;
    resetDrawer();
    setSuccess("");
    setOpen(true);
  }

  function changeDrawer(nextOpen) {
    if (formRequest.current) return;
    setOpen(nextOpen);
    if (!nextOpen) resetDrawer();
  }

  async function saveCustomer(values) {
    if (formRequest.current) return;
    const request = new AbortController();
    formRequest.current = request;
    setSaving(true);
    setFormError("");
    setSuccess("");
    clearErrors();

    const payload = new FormData();
    for (const key of Object.keys(EMPTY_FORM)) {
      let value = String(values[key] ?? "").trim();
      if (key === "block_reason" && values.status !== "Blocked") value = "";
      if (key === "document_expiry" && values.document_type !== "Passport")
        value = "";
      payload.append(key, value);
    }
    if (isEditing) payload.append("upd_id", String(updateId));

    // An omitted slot keeps its saved file. null requests removal.
    for (const [kind, change] of Object.entries(changes)) {
      if (change instanceof File) payload.append(kind, change);
      if (change === null) payload.append("remove[]", kind);
    }

    try {
      const { data } = await axiosClient.post("/save_customer", payload, {
        signal: request.signal,
      });
      if (request.signal.aborted) return;
      if (!data.status)
        throw new Error(data.message || "Unable to save customer.");

      setOpen(false);
      resetDrawer();
      setSuccess(data.message);
      await getCustomers();
    } catch (error) {
      if (request.signal.aborted) return;
      const response = error.response;
      if (response?.status === 422 && response.data.errors) {
        const general = [];
        for (const [key, messages] of Object.entries(response.data.errors)) {
          const message = Array.isArray(messages)
            ? messages[0]
            : String(messages);
          if (Object.hasOwn(EMPTY_FORM, key) || Object.hasOwn(DOCUMENTS, key)) {
            setError(key, { type: "server", message });
          } else {
            general.push(message);
          }
        }
        setFormError(
          general.join(" ") || "Please check the highlighted fields.",
        );
      } else {
        setFormError(
          response?.data?.message ||
            error.message ||
            "Unable to save customer.",
        );
      }
    } finally {
      if (formRequest.current === request) formRequest.current = null;
      if (!request.signal.aborted) setSaving(false);
    }
  }

  const fieldProps = { register, errors };
  let submitText = isEditing ? "Update Customer" : "Save Customer";
  if (saving) submitText = isEditing ? "Updating..." : "Saving...";
  if (formLoading) submitText = "Loading...";

  return (
    <>
      <PageHeader
        title="Customer Management"
        sub_text="Create and manage individual rental customers."
        breadcrumbs={[{ label: "Customer" }, { label: "Customer Management" }]}
      />

      <div className="management-page">
        <div className="page-container">
          {pageError && (
            <div
              role="alert"
              className="form-alert mb-5 flex items-start gap-2"
            >
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <div>
                <p>{pageError}</p>
                <button
                  type="button"
                  onClick={getCustomers}
                  className="mt-1 underline"
                >
                  Reload customer list
                </button>
              </div>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mb-5 rounded-lg border border-border bg-[var(--info-soft)] px-4 py-3 text-sm text-primary"
            >
              {success}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <button
              type="button"
              className="btn-primary management-add"
              onClick={openCreate}
              disabled={busy}
            >
              <Plus size={16} aria-hidden="true" className="mr-2" />
              Add Customer
            </button>

            <CustomDrawer
              open={open}
              setOpen={changeDrawer}
              saving={busy}
              title={isEditing ? "Update Customer" : "Create Customer"}
              description="Manage contact details, identification and driving documents."
              submitText={submitText}
              onSubmit={(event) => handleSubmit(saveCustomer)(event)}
              size="max-w-3xl"
            >
              {formError && (
                <div role="alert" className="form-alert mb-4">
                  {formError}
                </div>
              )}
              {formLoading && (
                <p role="status" className="mb-4 text-sm">
                  Loading customer details...
                </p>
              )}

              <FormProvider {...methods}>
                <form
                  noValidate
                  onSubmit={(event) => handleSubmit(saveCustomer)(event)}
                  aria-busy={busy}
                >
                  <fieldset
                    disabled={busy}
                    className="m-0 min-w-0 space-y-5 border-0 p-0"
                  >
                    <Section title="Basic details">
                      <div>
                        <label
                          htmlFor="customer_code"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Customer code
                        </label>
                        <Input
                          id="customer_code"
                          readOnly
                          value={customerCode || "Assigned on save"}
                          className="custom-input-sm"
                        />
                      </div>
                      <FormField
                        {...fieldProps}
                        name="customer_type"
                        label="Customer type"
                        options={["Local", "Tourist"]}
                        required
                      />
                      <FormField
                        {...fieldProps}
                        name="full_name"
                        label="Full name"
                        maxLength={150}
                        required
                      />
                    </Section>

                    <Section title="Contact details">
                      <FormField
                        {...fieldProps}
                        name="mobile"
                        label="Mobile number"
                        type="tel"
                        maxLength={30}
                        required
                      />
                      <FormField
                        {...fieldProps}
                        name="email"
                        label="Email"
                        type="email"
                        maxLength={255}
                      />
                      <FormField
                        {...fieldProps}
                        name="country"
                        label="Country"
                        maxLength={100}
                        required={customerType === "Tourist"}
                      />
                      <FormField
                        {...fieldProps}
                        name="address"
                        label="Address"
                        maxLength={500}
                        multiline
                      />
                    </Section>

                    <Section title="Identification">
                      <FormField
                        {...fieldProps}
                        name="document_type"
                        label="Document type"
                        options={["NIC", "Passport"]}
                      />
                      <FormField
                        {...fieldProps}
                        name="document_number"
                        label="Document number"
                        maxLength={50}
                      />
                      {documentType === "Passport" && (
                        <FormField
                          {...fieldProps}
                          name="document_expiry"
                          label="Passport expiry"
                          type="date"
                        />
                      )}
                    </Section>

                    <Section title="Driving details">
                      <FormField
                        {...fieldProps}
                        name="licence_number"
                        label="Driving licence number"
                        maxLength={50}
                      />
                      <FormField
                        {...fieldProps}
                        name="licence_country"
                        label="Licence issuing country"
                        maxLength={100}
                        required={Boolean(
                          licenceNumber || licenceExpiry || hasLicenceImage,
                        )}
                      />
                      <FormField
                        {...fieldProps}
                        name="licence_expiry"
                        label="Licence expiry"
                        type="date"
                      />
                    </Section>

                    <Section title="Emergency contact">
                      <FormField
                        {...fieldProps}
                        name="emergency_name"
                        label="Contact name"
                        maxLength={150}
                      />
                      <FormField
                        {...fieldProps}
                        name="emergency_number"
                        label="Contact number"
                        type="tel"
                        maxLength={30}
                      />
                    </Section>

                    <Section title="Documents">
                      {Object.keys(DOCUMENTS).map((kind) => (
                        <DocumentField
                          key={kind}
                          kind={kind}
                          savedId={savedDocuments[kind]}
                          change={changes[kind]}
                          errors={errors}
                          onError={(message) =>
                            setError(kind, { type: "manual", message })
                          }
                          onChange={(value) => {
                            clearErrors(kind);
                            setChanges((previous) => ({
                              ...previous,
                              [kind]: value,
                            }));
                          }}
                        />
                      ))}
                    </Section>

                    <Section title="Internal details">
                      <FormField
                        {...fieldProps}
                        name="status"
                        label="Status"
                        options={["Active", "Inactive", "Blocked"]}
                        required
                      />
                      {status === "Blocked" && (
                        <FormField
                          {...fieldProps}
                          name="block_reason"
                          label="Block reason"
                          maxLength={500}
                          required
                        />
                      )}
                      <FormField
                        {...fieldProps}
                        name="notes"
                        label="Staff notes"
                        maxLength={2000}
                        multiline
                      />
                    </Section>
                  </fieldset>
                </form>
              </FormProvider>
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold">Customer List</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Search customer records and update their details.
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Customers
                  </span>
                </div>
                <div
                  id="customer-tb"
                  className="relative p-6"
                  aria-busy={tableLoading}
                >
                  <div className="mb-4 flex flex-wrap gap-3">
                    {[['status', 'Customer status', ['Active', 'Inactive', 'Blocked']], ['customer_type', 'Customer type', ['Local', 'Tourist']]].map(([name, label, options]) => (
                      <select key={name} aria-label={label} className="custom-input-sm" defaultValue="" onChange={(event) => {
                        listFilters.current[name] = event.target.value;
                        void getCustomers();
                      }}>
                        <option value="">{name === "status" ? "All customer statuses" : "All customer types"}</option>
                        {options.map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    ))}
                  </div>
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
        targetId="customer-tb"
        show={tableLoading}
        text="Loading Customers"
      />
    </>
  );
}
