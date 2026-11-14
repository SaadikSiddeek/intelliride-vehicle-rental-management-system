import usePermissions from "@/hooks/usePermissions";
import PermissionGate from "@/components/PermissionGate";
import useRecordLink from "@/hooks/useRecordLink";
import { tableAction } from "@/lib/table-actions";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Plus } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import axiosClient from "@/axios-client";
import PageHeader from "@/components/PageHeader";
import CustomDrawer from "@/components/Drawer";
import FormSection from "@/components/forms/FormSection";
import Select2 from "@/components/Select2";
import TableSearch from "@/components/TableSearch";
import FieldError from "@/components/ErrorField";
import CarLoader from "@/components/CarLoader";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";

const EMPTY_FORM = {
  customer_id: "",
  pickup_at: "",
  expected_return_at: "",
  pickup_branch_id: "",
  vehicle_id: "",
  package_id: "",
  agreed_rate: "",
  discount: "0.00",
  extras: [],
  advance_amount: "0.00",
  payment_method: "cash",
  payment_date: "",
  payment_reference: "",
  notes: "",
  status: "Draft",
};
const money = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
});
const AMOUNT = /^\d{1,10}(\.\d{1,2})?$/;
const STATUSES = [
  "Draft",
  "Confirmed",
  "Converted to Rental",
  "Cancelled",
  "No-show",
];

function Field({ name, label, children, errors, select = false }) {
  return (
    <div className="min-w-0">
      <label htmlFor={name} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {!select && <FieldError name={name} errors={errors} />}
    </div>
  );
}

function PricingSummary({ quote, paid = 0 }) {
  if (!quote)
    return (
      <p className="text-sm text-muted-foreground">
        Calculate pricing to see the server estimate. Saving recalculates all
        charges.
      </p>
    );
  return (
    <dl className="space-y-2 rounded-lg bg-secondary/40 p-4 text-sm">
      {[
        [
          "Duration",
          `${quote.duration_minutes / 60} hours · ${quote.units} ${quote.billing_unit} units`,
        ],
        [
          "Included kilometres",
          quote.included_km == null ? "Unlimited" : `${quote.included_km} km`,
        ],
        ["Excess kilometre charge", money.format(quote.extra_km_charge)],
        ["Subtotal", money.format(quote.subtotal)],
        ["Discount", money.format(quote.discount)],
        [`Tax (${quote.tax_basis_points / 100}%)`, money.format(quote.tax)],
        ["Rental total", money.format(quote.total)],
        ["Refundable security deposit", money.format(quote.security_deposit)],
        ["Recorded rental payments", money.format(paid)],
        ["Rental balance", money.format(Number(quote.total) - paid)],
      ].map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="text-right font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
      <p className="pt-2 text-xs text-muted-foreground">
        The security deposit is tracked separately from rental charges.
      </p>
    </dl>
  );
}

export default function Booking() {
  const { can } = usePermissions();
  const methods = useForm({ defaultValues: EMPTY_FORM });
  const {
    register,
    control,
    reset,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    formState: { errors },
  } = methods;
  const [pickup, expectedReturn, branch, vehicle, advance] = useWatch({
    control,
    name: [
      "pickup_at",
      "expected_return_at",
      "pickup_branch_id",
      "vehicle_id",
      "advance_amount",
    ],
  });
  const [open, setOpen] = useState(false);
  const [record, setRecord] = useState(null);
  const [options, setOptions] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quotedValues, setQuotedValues] = useState("");
  const currentValues = useWatch({ control });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const tableElement = useRef(null);
  const table = useRef(null);
  const listRequest = useRef(null);
  const formRequest = useRef(null);
  const listStatus = useRef("");
  const readOnly = record && (record.status !== "Draft" || !can("bookings.edit"));
  const paid =
    record?.payments?.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0,
    ) || 0;

  const loadTable = useCallback(async () => {
    listRequest.current?.abort();
    const request = new AbortController();
    listRequest.current = request;
    setLoading(true);
    setPageError("");
    try {
      const { data } = await axiosClient.post(
        "/get_bookings",
        { status: listStatus.current },
        { signal: request.signal },
      );
      if (!request.signal.aborted) {
        if (!data.status)
          throw new Error(data.message || "Unable to load bookings.");
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
      const request = new AbortController();
      formRequest.current = request;
      reset({ ...EMPTY_FORM, extras: [] });
      setRecord(null);
      setQuote(null);
      setOptions(null);
      setFormError("");
      setSuccess("");
      setOpen(true);
      setBusy(true);
      try {
        const [settings, detail] = await Promise.all([
          axiosClient.post("/booking_options", {}, { signal: request.signal }),
          id == null
            ? Promise.resolve(null)
            : axiosClient.post(
                "/fetch_booking_data",
                { upd_id: id },
                { signal: request.signal },
              ),
        ]);
        if (request.signal.aborted) return;
        setOptions(settings.data.data);
        if (detail) {
          const row = detail.data.data;
          setRecord(row);
          setQuote(row.pricing_snapshot);
          reset({
            ...EMPTY_FORM,
            ...Object.fromEntries(
              Object.keys(EMPTY_FORM)
                .filter((key) => row[key] != null)
                .map((key) => [key, row[key]]),
            ),
            pickup_at: row.pickup_at.slice(0, 16).replace(" ", "T"),
            expected_return_at: row.expected_return_at
              .slice(0, 16)
              .replace(" ", "T"),
            agreed_rate: row.pricing_snapshot.agreed_rate,
            discount: row.pricing_snapshot.discount,
            extras: row.pricing_snapshot.extras.map((extra) => extra.code),
            advance_amount: "0.00",
          });
        }
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
      placeholder: "No bookings found.",
      columns: [
        ...[
          ["Booking", "booking_code"],
          ["Customer", "full_name"],
          ["Vehicle", "vehicle_number"],
          ["Pickup", "pickup_at"],
          ["Expected return", "expected_return_at"],
          ["Status", "status"],
          ["Payment", "payment_status"],
        ].map(([title, field]) => ({
          title,
          field,
          minWidth: 140,
          formatter: "plaintext",
        })),
        {
          title: "Total",
          field: "total",
          minWidth: 130,
          formatter: (cell) => money.format(cell.getValue()),
        },
        {
          title: "Actions",
          field: "id",
          minWidth: 90,
          headerSort: false,
          formatter: cell =>
            tableAction(cell.getRow().getData().status === "Draft" ? "edit" : "view", cell.getRow().getData().status === "Draft" ? "Edit booking" : "Open booking", ""),
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
      instance.off("tableBuilt", loadTable);
      instance.destroy();
      table.current = null;
    };
  }, [loadTable, openForm]);

  function showError(error) {
    const response = error.response?.data;
    if (error.response?.status === 422 && response.errors) {
      const general = [];
      Object.entries(response.errors).forEach(([key, messages]) => {
        const message = Array.isArray(messages)
          ? messages[0]
          : String(messages);
        if (Object.hasOwn(EMPTY_FORM, key))
          setError(key, { type: "server", message });
        else general.push(message);
      });
      setFormError(general.join(" ") || "Please check the highlighted fields.");
    } else
      setFormError(
        response?.message || error.message || "Unable to save booking.",
      );
  }

  async function submit(values, preview = false) {
    if (formRequest.current || readOnly) return;
    const request = new AbortController();
    formRequest.current = request;
    setBusy(true);
    clearErrors();
    setFormError("");
    const payload = {
      ...values,
      return_branch_id: values.pickup_branch_id,
      extras: values.extras || [],
    };
    if (record) payload.upd_id = record.ID;
    try {
      const { data } = await axiosClient.post(
        preview ? "/quote_booking" : "/save_booking",
        payload,
        { signal: request.signal },
      );
      if (request.signal.aborted) return;
      if (!data.status)
        throw new Error(data.message || "Unable to save booking.");
      if (preview) {
        setQuote(data.data);
        setQuotedValues(JSON.stringify(values));
      } else {
        setOpen(false);
        setSuccess(data.message);
        await loadTable();
      }
    } catch (error) {
      if (!request.signal.aborted) showError(error);
    } finally {
      if (formRequest.current === request) formRequest.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  async function changeStatus(status) {
    if (formRequest.current || !record) return;
    const request = new AbortController();
    formRequest.current = request;
    setBusy(true);
    setFormError("");
    try {
      const { data } = await axiosClient.post(
        "/booking_status",
        { upd_id: record.ID, status },
        { signal: request.signal },
      );
      if (!request.signal.aborted) {
        setOpen(false);
        setSuccess(data.message);
        await loadTable();
      }
    } catch (error) {
      if (!request.signal.aborted) showError(error);
    } finally {
      if (formRequest.current === request) formRequest.current = null;
      if (!request.signal.aborted) setBusy(false);
    }
  }

  useRecordLink(openForm);
  const vehicleEndpoint = `/booking_vehicle_filter?${new URLSearchParams({ pickup_at: pickup || "", expected_return_at: expectedReturn || "", pickup_branch_id: branch || "" })}`;
  const required = (label) => ({ required: `${label} is required.` });
  const amount = {
    pattern: {
      value: AMOUNT,
      message: "Enter a valid amount with up to two decimal places.",
    },
  };
  const field = (name, label, input) => (
    <Field name={name} label={label} errors={errors}>
      {input}
    </Field>
  );

  return (
    <>
      <PageHeader
        title="Bookings"
        sub_text="Plan a rental, confirm availability and record agreed pricing."
        breadcrumbs={[{ label: "Rental Operations" }, { label: "Bookings" }]}
      />
      <div className="management-page">
        <div className="page-container">
          {pageError && (
            <div role="alert" className="form-alert mb-5">
              {pageError}{" "}
              <button type="button" onClick={loadTable} className="underline">
                Reload bookings
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
          <PermissionGate permission="bookings.create"><button
            type="button"
            className="btn-primary management-add mb-6"
            disabled={busy}
            onClick={() => void openForm()}
          >
            <Plus size={16} className="mr-2" />
            Add Booking
          </button></PermissionGate>
          <CustomDrawer canSubmit={readOnly || can(record ? "bookings.edit" : "bookings.create")}
            open={open}
            setOpen={(next) => {
              if (!formRequest.current) setOpen(next);
            }}
            saving={busy}
            title={
              record
                ? `Booking BKG-${String(record.ID).padStart(6, "0")}`
                : "Create Booking"
            }
            description="One vehicle · same-branch pickup and return · times in Asia/Colombo"
            submitText={
              readOnly
                ? "Close"
                : busy
                  ? "Working..."
                  : record
                    ? "Update Booking"
                    : "Save Booking"
            }
            onSubmit={(event) =>
              readOnly
                ? setOpen(false)
                : handleSubmit((values) => submit(values))(event)
            }
            size="max-w-3xl"
          >
            {formError && (
              <div role="alert" className="form-alert mb-4">
                {formError}
              </div>
            )}
            {busy && (
              <p role="status" className="mb-4 text-sm">
                Processing booking...
              </p>
            )}
            {readOnly && (
              <p className="mb-4 rounded-lg bg-secondary p-3 text-sm">
                {record.status} · {record.payment_status}. Confirmed pricing is
                preserved. Cancellation retains payments for finance review.
              </p>
            )}
            <FormProvider {...methods}>
              <form
                noValidate
                onChange={() => {
                  if (!readOnly) setQuote(null);
                }}
                onSubmit={(event) =>
                  handleSubmit((values) => submit(values))(event)
                }
              >
                <fieldset
                  disabled={busy || !!readOnly}
                  className="m-0 min-w-0 space-y-5 border-0 p-0"
                >
                  <FormSection title="Customer and schedule">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field name="customer_id" label="Customer *" select>
                        {readOnly ? (
                          <Input
                            id="customer_id"
                            readOnly
                            value={record.customer_label || ""}
                          />
                        ) : (
                          <Select2
                            name="customer_id"
                            endpoint="/customer_filter"
                            disabled={busy}
                            rules={required("Customer")}
                          />
                        )}
                        <a
                          href="/customer-management/manage?create=1"
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-block text-xs font-semibold text-primary"
                        >
                          Add Customer in a new tab
                        </a>
                      </Field>
                      <Field
                        name="pickup_branch_id"
                        label="Pickup branch *"
                        select
                      >
                        {readOnly ? (
                          <Input
                            id="pickup_branch_id"
                            readOnly
                            value={record.branch_label || ""}
                          />
                        ) : (
                          <Select2
                            name="pickup_branch_id"
                            endpoint="/branch_filter"
                            onValueChange={() => {
                              setValue("vehicle_id", "");
                              setValue("package_id", "");
                            }}
                            disabled={busy || !!readOnly}
                            rules={required("Pickup branch")}
                          />
                        )}
                      </Field>
                      {field(
                        "pickup_at",
                        "Pickup date and time *",
                        <Input
                          id="pickup_at"
                          type="datetime-local"
                          {...register(
                            "pickup_at",
                            required("Pickup date and time"),
                          )}
                          onChange={(event) => {
                            register("pickup_at").onChange(event);
                            setValue("vehicle_id", "");
                            setValue("package_id", "");
                          }}
                        />,
                      )}
                      {field(
                        "expected_return_at",
                        "Expected return date and time *",
                        <Input
                          id="expected_return_at"
                          type="datetime-local"
                          {...register("expected_return_at", {
                            ...required("Expected return"),
                            validate: (value) =>
                              value > pickup || "Return must be after pickup.",
                          })}
                          onChange={(event) => {
                            register("expected_return_at").onChange(event);
                            setValue("vehicle_id", "");
                            setValue("package_id", "");
                          }}
                        />,
                      )}
                      {field(
                        "return_branch",
                        "Return branch",
                        <Input
                          id="return_branch"
                          value="Same as pickup branch"
                          readOnly
                        />,
                      )}
                    </div>
                  </FormSection>
                  <FormSection title="Vehicle and rental terms">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field
                        name="vehicle_id"
                        label="Available vehicle *"
                        select
                      >
                        {readOnly ? (
                          <Input
                            id="vehicle_id"
                            readOnly
                            value={record.vehicle_label || ""}
                          />
                        ) : (
                          <Select2
                            name="vehicle_id"
                            endpoint={vehicleEndpoint}
                            onValueChange={() => {
                              setValue("package_id", "");
                              setValue("agreed_rate", "");
                            }}
                            disabled={
                              busy ||
                              !!readOnly ||
                              !pickup ||
                              !expectedReturn ||
                              !branch
                            }
                            rules={required("Vehicle")}
                          />
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                          Choose dates and branch first. Availability is checked
                          again on confirmation.
                        </p>
                      </Field>
                      <Field name="package_id" label="Rental package *" select>
                        {readOnly ? (
                          <Input
                            id="package_id"
                            readOnly
                            value={
                              record.pricing_snapshot.package_name ||
                              record.package_label ||
                              ""
                            }
                          />
                        ) : (
                          <Select2
                            name="package_id"
                            endpoint={`/booking_package_filter?vehicle_id=${vehicle || ""}`}
                            onValueChange={() => setValue("agreed_rate", "")}
                            disabled={busy || !!readOnly || !vehicle}
                            rules={required("Rental package")}
                          />
                        )}
                      </Field>
                      {field(
                        "agreed_rate",
                        "Agreed rate per unit (LKR)",
                        <Input
                          id="agreed_rate"
                          placeholder="Use package rate"
                          inputMode="decimal"
                          readOnly={!options?.can_override_pricing}
                          {...register("agreed_rate", amount)}
                        />,
                      )}
                      {field(
                        "discount",
                        "Authorized discount (LKR)",
                        <Input
                          id="discount"
                          inputMode="decimal"
                          readOnly={!options?.can_override_pricing}
                          {...register("discount", amount)}
                        />,
                      )}
                    </div>
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-semibold">Optional extras</p>
                      {options?.extras?.length ? (
                        options.extras.map((extra) => (
                          <label
                            key={extra.code}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              value={extra.code}
                              {...register("extras")}
                            />
                            {extra.label} · {money.format(extra.amount)}
                          </label>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No extras are configured.
                        </p>
                      )}
                      <FieldError errors={errors} name="extras" />
                    </div>
                  </FormSection>
                  {!record && (
                    <FormSection title="Advance payment">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {field(
                          "advance_amount",
                          "Advance amount (LKR)",
                          <Input
                            id="advance_amount"
                            inputMode="decimal"
                            {...register("advance_amount", amount)}
                          />,
                        )}
                        {field(
                          "payment_method",
                          "Payment method",
                          <NativeSelect
                            id="payment_method"
                            {...register("payment_method")}
                          >
                            <option value="cash">Cash</option>
                            <option value="bank_transfer">Bank transfer</option>
                            <option value="card">Card</option>
                          </NativeSelect>,
                        )}
                        {field(
                          "payment_date",
                          "Payment date",
                          <Input
                            id="payment_date"
                            type="date"
                            {...register("payment_date", {
                              required:
                                Number(advance) > 0
                                  ? "Payment date is required."
                                  : false,
                            })}
                          />,
                        )}
                        {field(
                          "payment_reference",
                          "Payment reference",
                          <Input
                            id="payment_reference"
                            maxLength={150}
                            {...register("payment_reference")}
                          />,
                        )}
                      </div>
                    </FormSection>
                  )}
                  <FormSection title="Booking details">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {field(
                        "status",
                        "Booking status",
                        <NativeSelect id="status" {...register("status")}>
                          {(readOnly ? STATUSES : can("bookings.confirm") ? ["Draft", "Confirmed"] : ["Draft"]).map(
                            (status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ),
                          )}
                        </NativeSelect>,
                      )}
                      {field(
                        "notes",
                        "Booking notes",
                        <Textarea
                          id="notes"
                          rows={3}
                          maxLength={2000}
                          {...register("notes")}
                        />,
                      )}
                    </div>
                  </FormSection>
                </fieldset>
                <div className="mt-5 space-y-4">
                  {!readOnly && (
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy}
                      onClick={(event) =>
                        handleSubmit((values) => submit(values, true))(event)
                      }
                    >
                      Calculate pricing
                    </button>
                  )}
                  <PricingSummary
                    quote={
                      readOnly || JSON.stringify(currentValues) === quotedValues
                        ? quote
                        : null
                    }
                    paid={paid}
                  />
                  {record?.status === "Draft" && can("bookings.confirm") && <button type="button" className="btn-primary" disabled={busy} onClick={() => void changeStatus("Confirmed")}>Confirm saved booking</button>}
                  {record?.payments?.length > 0 && (
                    <p className="text-sm">
                      {record.payments.length} payment record(s) retained.
                      Payment status: {record.payment_status}.
                    </p>
                  )}
                  {can("bookings.cancel") && record && ["Draft", "Confirmed"].includes(record.status) && (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={busy}
                        onClick={() => void changeStatus("Cancelled")}
                      >
                        Cancel Booking
                      </button>
                      {record.status === "Confirmed" && (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={busy}
                          onClick={() => void changeStatus("No-show")}
                        >
                          Mark No-show
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </form>
            </FormProvider>
          </CustomDrawer>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b px-6 py-5">
              <h2 className="text-base font-semibold">Booking List</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Drafts do not reserve vehicles. Confirmation checks the selected
                period.
              </p>
            </div>
            <div id="booking-tb" className="relative p-6" aria-busy={loading}>
              <NativeSelect
                aria-label="Booking status filter"
                defaultValue=""
                onChange={(event) => {
                  listStatus.current = event.target.value;
                  void loadTable();
                }}
              >
                <option value="">All booking statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </NativeSelect>
              <TableSearch table={table} />
              <div
                ref={tableElement}
                className="overflow-hidden rounded-xl border border-border"
              />
            </div>
          </div>
        </div>
      </div>
      <CarLoader targetId="booking-tb" show={loading} text="Loading Bookings" />
    </>
  );
}
