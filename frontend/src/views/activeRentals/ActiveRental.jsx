import PermissionGate from "@/components/PermissionGate";
import useRecordLink from "@/hooks/useRecordLink";
import { tableAction } from "@/lib/table-actions";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Plus, Download } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import axiosClient from "@/axios-client";
import PageHeader from "@/components/PageHeader";
import CustomDrawer from "@/components/Drawer";
import Select2 from "@/components/Select2";
import FormSection from "@/components/forms/FormSection";
import FieldError from "@/components/ErrorField";
import TableSearch from "@/components/TableSearch";
import CarLoader from "@/components/CarLoader";
import { Input, Textarea, NativeSelect } from "@/components/ui/input";

const EMPTY = {
  booking_id: "",
  actual_pickup_at: "",
  starting_odometer: "",
  pickup_fuel_litres: "",
  driver_name: "",
  driver_document_number: "",
  driver_licence_number: "",
  driver_licence_expiry: "",
  identity_verified: false,
  licence_verified: false,
  agreement_accepted: false,
  agreement_reference: "",
  existing_damage: "",
  condition_notes: "",
  deposit_received: "",
  deposit_method: "cash",
  deposit_reference: "",
};
const money = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
});

function PhotoPreview({ file }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const image = ref.current;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => {
      image.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [file]);
  return (
    <img
      ref={ref}
      alt={`Condition preview: ${file.name}`}
      className="h-24 w-28 rounded-lg border border-border object-cover"
    />
  );
}

export default function ActiveRental() {
  const methods = useForm({ defaultValues: EMPTY });
  const filterMethods = useForm({ defaultValues: { filter_branch: "" } });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = methods;
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState(null);
  const [context, setContext] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const tableElement = useRef(null),
    table = useRef(null);
  const listRequest = useRef(null),
    formRequest = useRef(null),
    contextRequest = useRef(null);
  const filters = useRef({ status: "Active", branch_id: "" });

  const loadTable = useCallback(async () => {
    listRequest.current?.abort();
    const request = new AbortController();
    listRequest.current = request;
    setLoading(true);
    setPageError("");
    try {
      const { data } = await axiosClient.post("/get_rentals", filters.current, {
        signal: request.signal,
      });
      if (!request.signal.aborted) {
        if (!data.status)
          throw new Error(data.message || "Unable to load rentals.");
        await table.current?.setData(data.data || []);
      }
    } catch (error) {
      if (!request.signal.aborted)
        setPageError(error.response?.data?.message || error.message);
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, []);

  const openForm = useCallback(
    async (id = null) => {
      if (formRequest.current) return;
      contextRequest.current?.abort();
      reset({ ...EMPTY });
      setRecord(null);
      setContext(null);
      setPhotos([]);
      setFormError("");
      setSuccess("");
      setContextLoading(false);
      setOpen(true);
      if (!id) return;
      const request = new AbortController();
      formRequest.current = request;
      setBusy(true);
      try {
        const { data } = await axiosClient.post(
          "/fetch_rental_data",
          { upd_id: id },
          { signal: request.signal },
        );
        if (request.signal.aborted) return;
        if (!data.status)
          throw new Error(data.message || "Unable to load rental.");
        const row = data.data;
        setRecord(row);
        reset({
          ...EMPTY,
          ...row,
          actual_pickup_at: row.actual_pickup_at.slice(0, 16).replace(" ", "T"),
          agreement_accepted: true,
          deposit_received: row.deposits
            .filter((entry) => entry.entry_type === "Received")
            .reduce((sum, entry) => sum + Number(entry.amount), 0)
            .toFixed(2),
        });
      } catch (error) {
        if (!request.signal.aborted) {
          setOpen(false);
          setPageError(error.response?.data?.message || error.message);
        }
      } finally {
        if (formRequest.current === request) formRequest.current = null;
        if (!request.signal.aborted) setBusy(false);
      }
    },
    [reset],
  );

  useEffect(() => {
    const instance = new Tabulator(tableElement.current, {
      index: "id",
      layout: "fitColumns",
      maxHeight: "550px",
      movableColumns: true,
      placeholder: "No rentals found.",
      columns: [
        ...[
          ["Rental", "rental_number"],
          ["Booking", "booking_number"],
          ["Customer", "customer_name"],
          ["Vehicle", "vehicle_number"],
          ["Pickup branch", "pickup_branch"],
          ["Actual pickup", "actual_pickup_at"],
          ["Expected return", "expected_return_at"],
          ["Handed over by", "handed_over_by"],
          ["Status", "status"],
        ].map(([title, field]) => ({
          title,
          field,
          minWidth: 145,
          formatter: "plaintext",
        })),
        {
          title: "Actions",
          field: "id",
          minWidth: 90,
          headerSort: false,
          formatter: () =>
            tableAction("view", "View rental", ""),
          cellClick: (event, cell) => {
            if (event.target.closest("button")) void openForm(cell.getValue());
          },
        },
      ],
    });
    table.current = instance;
    instance.on("tableBuilt", loadTable);
    return () => {
      listRequest.current?.abort();
      formRequest.current?.abort();
      contextRequest.current?.abort();
      instance.off("tableBuilt", loadTable);
      instance.destroy();
      table.current = null;
    };
  }, [loadTable, openForm]);

  async function selectBooking(id) {
    contextRequest.current?.abort();
    setContext(null);
    setValue("deposit_received", "");
    setFormError("");
    if (!id) {
      setContextLoading(false);
      return;
    }
    const request = new AbortController();
    contextRequest.current = request;
    setContextLoading(true);
    try {
      const { data } = await axiosClient.post(
        "/handover_context",
        { booking_id: id },
        { signal: request.signal },
      );
      if (!request.signal.aborted) {
        setContext(data.data);
        setValue("starting_odometer", String(data.data.mileage || 0));
        setValue(
          "deposit_received",
          data.data.pricing_snapshot.security_deposit,
        );
      }
    } catch (error) {
      if (!request.signal.aborted)
        setFormError(
          error.response?.data?.message || "Unable to load booking details.",
        );
    } finally {
      if (!request.signal.aborted) setContextLoading(false);
    }
  }

  async function save(values) {
    if (formRequest.current || contextLoading || !context || record) return;
    const request = new AbortController();
    formRequest.current = request;
    setBusy(true);
    setFormError("");
    clearErrors();
    const payload = new FormData();
    Object.keys(EMPTY).forEach((key) =>
      payload.append(
        key,
        typeof values[key] === "boolean"
          ? values[key]
            ? "1"
            : "0"
          : String(values[key] ?? "").trim(),
      ),
    );
    photos.forEach((photo) => payload.append("photos[]", photo));
    try {
      const { data } = await axiosClient.post("/save_handover", payload, {
        signal: request.signal,
      });
      if (!request.signal.aborted) {
        if (!data.status)
          throw new Error(data.message || "Unable to activate rental.");
        setOpen(false);
        setSuccess(data.message);
        await loadTable();
      }
    } catch (error) {
      if (request.signal.aborted) return;
      if (error.response?.status === 422) {
        const general = [];
        Object.entries(error.response.data.errors || {}).forEach(
          ([name, messages]) => {
            const message = Array.isArray(messages)
              ? messages[0]
              : String(messages);
            if (Object.hasOwn(EMPTY, name))
              setError(name, { type: "server", message });
            else general.push(message);
          },
        );
        setFormError(
          general.join(" ") || "Please check the highlighted fields.",
        );
      } else
        setFormError(
          error.response?.data?.message ||
            error.message ||
            "Unable to activate rental.",
        );
    } finally {
      if (formRequest.current === request) formRequest.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  async function downloadPhoto(id) {
    try {
      const { data } = await axiosClient.get(`/rental_photos/${id}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data),
        link = document.createElement("a");
      link.href = url;
      link.download = `rental-photo-${id}.${data.type.split("/")[1] || "jpg"}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setFormError("Unable to download the condition photo.");
    }
  }

  const field = (name, label, input) => (
    <div className="min-w-0">
      <label htmlFor={name} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      {input}
      <FieldError errors={errors} name={name} />
    </div>
  );
  useRecordLink(openForm);
  const required = (label) => ({ required: `${label} is required.` });
  const snapshot = record?.rental_snapshot;

  return (
    <>
      <PageHeader
        title="Active Rentals"
        sub_text="Verify the driver, inspect the vehicle and record a secure handover."
        breadcrumbs={[
          { label: "Rental Operations" },
          { label: "Active Rentals" },
        ]}
      />
      <div className="management-page">
        <div className="page-container">
          {pageError && (
            <div role="alert" className="form-alert mb-5">
              {pageError}{" "}
              <button type="button" onClick={loadTable} className="underline">
                Reload rentals
              </button>
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
          <PermissionGate permission="rentals.handover"><button
            type="button"
            className="btn-primary management-add mb-6"
            disabled={busy}
            onClick={() => void openForm()}
          >
            <Plus size={16} className="mr-2" />
            New Handover
          </button></PermissionGate>
          <CustomDrawer
            open={open}
            setOpen={(next) => {
              if (!formRequest.current) {
                contextRequest.current?.abort();
                setOpen(next);
              }
            }}
            saving={busy || contextLoading}
            title={
              record
                ? `Rental RNT-${String(record.ID).padStart(6, "0")}`
                : "Vehicle Handover"
            }
            description="The signed-in account is recorded as responsible for this handover. Times are in Asia/Colombo."
            submitText={
              record ? "Close" : busy ? "Activating..." : "Activate Rental"
            }
            onSubmit={(event) =>
              record ? setOpen(false) : handleSubmit(save)(event)
            }
            size="max-w-3xl"
          >
            {formError && (
              <div role="alert" className="form-alert mb-4">
                {formError}
              </div>
            )}
            {(busy || contextLoading) && (
              <p role="status" className="mb-4 text-sm">
                Loading handover details...
              </p>
            )}
            {record && (
              <div className="mb-5 rounded-lg bg-secondary p-4 text-sm">
                <p>
                  {record.status} · Handed over by {record.handover_staff_name}
                </p>
                <p>
                  {snapshot.customer.name} · {snapshot.vehicle.number} ·{" "}
                  {snapshot.pickup_branch}
                </p>
                <p>Expected return: {snapshot.expected_return_at}</p>
              </div>
            )}
            <FormProvider {...methods}>
              <form noValidate onSubmit={(event) => handleSubmit(save)(event)}>
                <fieldset
                  disabled={busy || !!record}
                  className="m-0 min-w-0 space-y-5 border-0 p-0"
                >
                  {!record && (
                    <FormSection title="Confirmed booking">
                      <label
                        htmlFor="booking_id"
                        className="mb-2 block text-sm font-semibold"
                      >
                        Booking *
                      </label>
                      <Select2
                        name="booking_id"
                        endpoint="/handover_booking_filter"
                        rules={required("Booking")}
                        disabled={busy}
                        onValueChange={(id) => void selectBooking(id)}
                      />
                      {context && (
                        <dl className="mt-4 grid grid-cols-1 gap-2 rounded-lg bg-secondary/40 p-4 text-sm sm:grid-cols-2">
                          {[
                            ["Customer", context.customer_name],
                            ["Vehicle", context.vehicle_number],
                            ["Pickup branch", context.branch_name],
                            ["Reserved pickup", context.pickup_at],
                            ["Expected return", context.expected_return_at],
                            [
                              "Agreed deposit",
                              money.format(
                                context.pricing_snapshot.security_deposit,
                              ),
                            ],
                          ].map(([label, value]) => (
                            <div key={label}>
                              <dt className="text-muted-foreground">{label}</dt>
                              <dd className="font-semibold">{value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </FormSection>
                  )}
                  <FormSection title="Driver and verified documents">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {field(
                        "driver_name",
                        "Actual driver name *",
                        <Input
                          id="driver_name"
                          maxLength={150}
                          {...register("driver_name", required("Driver name"))}
                        />,
                      )}
                      {field(
                        "driver_document_number",
                        "Driver NIC / passport *",
                        <Input
                          id="driver_document_number"
                          maxLength={50}
                          {...register(
                            "driver_document_number",
                            required("Driver identity document"),
                          )}
                        />,
                      )}
                      {field(
                        "driver_licence_number",
                        "Driving licence number *",
                        <Input
                          id="driver_licence_number"
                          maxLength={50}
                          {...register(
                            "driver_licence_number",
                            required("Driving licence"),
                          )}
                        />,
                      )}
                      {field(
                        "driver_licence_expiry",
                        "Licence expiry *",
                        <Input
                          id="driver_licence_expiry"
                          type="date"
                          {...register(
                            "driver_licence_expiry",
                            required("Licence expiry"),
                          )}
                        />,
                      )}
                      {[
                        [
                          "identity_verified",
                          "Original identity document verified",
                        ],
                        [
                          "licence_verified",
                          "Original driving licence verified",
                        ],
                      ].map(([name, label]) => (
                        <div key={name}>
                          <label className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              {...register(name, required(label))}
                            />
                            {label}
                          </label>
                          <FieldError errors={errors} name={name} />
                        </div>
                      ))}
                    </div>
                  </FormSection>
                  <FormSection title="Pickup inspection">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {field(
                        "actual_pickup_at",
                        "Actual pickup date and time *",
                        <Input
                          id="actual_pickup_at"
                          type="datetime-local"
                          {...register(
                            "actual_pickup_at",
                            required("Actual pickup time"),
                          )}
                        />,
                      )}
                      {field(
                        "starting_odometer",
                        "Starting odometer (km) *",
                        <Input
                          id="starting_odometer"
                          type="number"
                          min="0"
                          step="1"
                          {...register("starting_odometer", {
                            ...required("Starting odometer"),
                            min: {
                              value: 0,
                              message: "Odometer cannot be negative.",
                            },
                          })}
                        />,
                      )}
                      {field(
                        "pickup_fuel_litres",
                        "Measured pickup fuel (litres) *",
                        <Input
                          id="pickup_fuel_litres"
                          type="number"
                          min="0"
                          step="0.001"
                          {...register(
                            "pickup_fuel_litres",
                            required("Pickup fuel"),
                          )}
                        />,
                      )}
                      {field(
                        "existing_damage",
                        "Existing damage",
                        <Textarea
                          id="existing_damage"
                          rows={3}
                          maxLength={4000}
                          {...register("existing_damage")}
                        />,
                      )}
                      {field(
                        "condition_notes",
                        "Vehicle condition report *",
                        <Textarea
                          id="condition_notes"
                          rows={3}
                          maxLength={4000}
                          {...register(
                            "condition_notes",
                            required("Vehicle condition report"),
                          )}
                        />,
                      )}
                    </div>
                    {!record && (
                      <div className="mt-4">
                        <label
                          htmlFor="handover_photos"
                          className="mb-2 block text-sm font-semibold"
                        >
                          Condition photos
                        </label>
                        <input
                          id="handover_photos"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(event) => {
                            const files = Array.from(event.target.files || []);
                            event.target.value = "";
                            if (
                              files.length > 10 ||
                              files.some(
                                (file) =>
                                  ![
                                    "image/jpeg",
                                    "image/png",
                                    "image/webp",
                                  ].includes(file.type) || file.size > 2097152,
                              )
                            ) {
                              setFormError(
                                "Choose up to 10 JPG, PNG or WebP photos, at most 2 MB each.",
                              );
                              return;
                            }
                            setPhotos(files);
                            setFormError("");
                          }}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Measured litres are used for return fuel comparisons.
                          Photos are stored privately.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {photos.map((file, index) => (
                            <PhotoPreview
                              key={`${index}-${file.name}`}
                              file={file}
                            />
                          ))}
                        </div>
                        {photos.length > 0 && (
                          <button
                            type="button"
                            className="mt-2 text-xs text-primary underline"
                            onClick={() => setPhotos([])}
                          >
                            Clear selected photos
                          </button>
                        )}
                      </div>
                    )}
                  </FormSection>
                  <FormSection title="Security deposit and agreement">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {field(
                        "deposit_received",
                        "Security deposit received (LKR) *",
                        <Input
                          id="deposit_received"
                          inputMode="decimal"
                          {...register("deposit_received", {
                            ...required("Security deposit received"),
                            pattern: {
                              value: /^\d{1,10}(\.\d{1,2})?$/,
                              message:
                                "Enter an amount with at most two decimal places.",
                            },
                          })}
                        />,
                      )}
                      {!record &&
                        field(
                          "deposit_method",
                          "Deposit payment method",
                          <NativeSelect
                            id="deposit_method"
                            {...register("deposit_method")}
                          >
                            <option value="cash">Cash</option>
                            <option value="bank_transfer">Bank transfer</option>
                            <option value="card">Card</option>
                          </NativeSelect>,
                        )}
                      {!record &&
                        field(
                          "deposit_reference",
                          "Deposit reference",
                          <Input
                            id="deposit_reference"
                            maxLength={150}
                            {...register("deposit_reference")}
                          />,
                        )}
                      {field(
                        "agreement_reference",
                        "Signed agreement reference *",
                        <Input
                          id="agreement_reference"
                          maxLength={150}
                          {...register(
                            "agreement_reference",
                            required("Agreement reference"),
                          )}
                        />,
                      )}
                      <div className="sm:col-span-2">
                        <label className="flex items-start gap-2 text-sm">
                          <input
                            type="checkbox"
                            {...register(
                              "agreement_accepted",
                              required("Agreement acceptance"),
                            )}
                          />
                          Customer agreement acceptance has been verified and
                          recorded.
                        </label>
                        <FieldError errors={errors} name="agreement_accepted" />
                        <p className="mt-2 text-xs text-muted-foreground">
                          The deposit is held separately from rental income.
                          Booking advances are not received again.
                        </p>
                      </div>
                    </div>
                  </FormSection>
                </fieldset>
              </form>
            </FormProvider>
            {record?.photos?.length > 0 && (
              <FormSection title="Private condition photos">
                <div className="flex flex-wrap gap-3">
                  {record.photos.map((photo) => (
                    <button
                      key={photo.ID}
                      type="button"
                      className="btn-primary"
                      onClick={() => void downloadPhoto(photo.ID)}
                    >
                      <Download size={14} className="mr-2" />
                      {photo.stage} photo {photo.ID}
                    </button>
                  ))}
                </div>
              </FormSection>
            )}
            {record?.deposits?.length > 0 && (
              <FormSection title="Deposit history">
                {record.deposits.map((entry) => (
                  <p key={entry.ID} className="text-sm">
                    {entry.entry_type}: {money.format(entry.amount)} ·{" "}
                    {entry.method || "Account settlement"} ·{" "}
                    {entry.reference || "No reference"}
                  </p>
                ))}
              </FormSection>
            )}
          </CustomDrawer>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b px-6 py-5">
              <h2 className="text-base font-semibold">Rental Register</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Active rentals block the vehicle until a reviewed return is
                finalized.
              </p>
            </div>
            <div id="rental-tb" className="relative p-6" aria-busy={loading}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NativeSelect
                  aria-label="Rental status filter"
                  defaultValue="Active"
                  onChange={(event) => {
                    filters.current.status = event.target.value;
                    void loadTable();
                  }}
                >
                  <option value="">All rentals</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                </NativeSelect>
                <FormProvider {...filterMethods}>
                  <Select2
                    name="filter_branch"
                    endpoint="/branch_filter"
                    placeholder="All pickup branches"
                    onValueChange={(id) => {
                      filters.current.branch_id = id || "";
                      void loadTable();
                    }}
                  />
                </FormProvider>
              </div>
              <TableSearch table={table} />
              <div
                ref={tableElement}
                className="overflow-hidden rounded-xl border border-border"
              />
            </div>
          </div>
        </div>
      </div>
      <CarLoader targetId="rental-tb" show={loading} text="Loading Rentals" />
    </>
  );
}
