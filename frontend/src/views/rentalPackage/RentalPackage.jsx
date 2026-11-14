import usePermissions from "@/hooks/usePermissions";
import PermissionGate from "@/components/PermissionGate";
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
import Select2 from "@/components/Select2";
import FormSection from "@/components/forms/FormSection";
import CarLoader from "@/components/CarLoader";
import { Input } from "@/components/ui/input";

const EMPTY_FORM = {
  package_name: "",
  vehicle_id: "",
  billing_unit: "day",
  rate_per_unit: "",
  included_km_per_unit: "",
  extra_km_charge: "0.00",
  security_deposit: "0.00",
  minimum_units: "1",
  status: true,
};

const UNIT_HOURS = { day: 24, week: 168, month: 720 };
const UNIT_LABELS = { day: "Day", week: "Week", month: "Month" };

const currency = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  currencyDisplay: "code",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

const EDIT_BUTTON = `
  <button type="button" class="table-action-btn"
    aria-label="Edit rental package" title="Edit rental package">
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

function Field({ name, label, errors, children, hint }) {
  return (
    <div className="min-w-0">
      <label htmlFor={name} className="mb-2 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <FieldError errors={errors} name={name} />
    </div>
  );
}

function moneyRules(label, positive = false) {
  return {
    required: `${label} is required.`,
    pattern: {
      value: MONEY_PATTERN,
      message:
        "Enter an amount with up to 10 whole digits and 2 decimal places.",
    },
    validate: (value) =>
      !positive || Number(value) > 0 || `${label} must be greater than zero.`,
  };
}

function integerRules(label, minimum, maximum, optional = false) {
  return {
    validate: (value) => {
      if (value === "" || value == null) {
        return optional || `${label} is required.`;
      }
      return (
        (/^\d+$/.test(String(value)) &&
          Number(value) >= minimum &&
          Number(value) <= maximum) ||
        `Enter a whole number between ${minimum} and ${maximum}.`
      );
    },
  };
}

// Parse decimal text into cents before multiplying rates.
function toCents(value) {
  const text = String(value ?? "");
  if (!MONEY_PATTERN.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function calculatePreview(values, hoursText, distanceText) {
  const hours = Number(hoursText);
  const distance = Number(distanceText);
  const duration = UNIT_HOURS[values.billing_unit];
  const minimum = Number(values.minimum_units);
  const rate = toCents(values.rate_per_unit);
  const deposit = toCents(values.security_deposit);
  const unlimited =
    values.included_km_per_unit === "" || values.included_km_per_unit == null;
  const allowance = Number(values.included_km_per_unit);
  const extraRate = unlimited ? 0 : toCents(values.extra_km_charge);

  if (
    !duration ||
    !Number.isFinite(hours) ||
    hours <= 0 ||
    distanceText === "" ||
    !Number.isSafeInteger(distance) ||
    distance < 0 ||
    !Number.isInteger(minimum) ||
    minimum < 1 ||
    minimum > 365 ||
    rate === null ||
    rate <= 0 ||
    deposit === null ||
    extraRate === null ||
    (!unlimited &&
      (!Number.isSafeInteger(allowance) ||
        allowance < 0 ||
        allowance > 1000000))
  )
    return null;

  const units = Math.max(minimum, Math.ceil(hours / duration));
  const included = unlimited ? null : units * allowance;
  const excessKm = unlimited ? 0 : Math.max(0, distance - included);
  const base = rate * units;
  const excess = excessKm * extraRate;
  const total = base + excess;

  if (
    !Number.isSafeInteger(total) ||
    (included !== null && !Number.isSafeInteger(included))
  ) {
    return null;
  }

  return { units, included, excessKm, base, excess, total, deposit };
}

function PricePreview({ control }) {
  const values = useWatch({ control });
  const [hours, setHours] = useState("24");
  const [distance, setDistance] = useState("100");
  const preview = calculatePreview(values, hours, distance);

  return (
    <Section title="Price preview">
      <div>
        <label
          htmlFor="preview-hours"
          className="mb-2 block text-sm font-semibold"
        >
          Example rental hours
        </label>
        <Input
          id="preview-hours"
          type="number"
          min="0.01"
          step="any"
          value={hours}
          onChange={(event) => setHours(event.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="preview-distance"
          className="mb-2 block text-sm font-semibold"
        >
          Example distance (km)
        </label>
        <Input
          id="preview-distance"
          type="number"
          min="0"
          step="1"
          value={distance}
          onChange={(event) => setDistance(event.target.value)}
        />
      </div>

      {preview ? (
        <dl className="space-y-2 rounded-lg bg-secondary/40 p-4 text-sm sm:col-span-2">
          {[
            [
              "Billed units",
              `${preview.units} × ${UNIT_LABELS[values.billing_unit]}`,
            ],
            [
              "Included distance",
              preview.included === null
                ? "Unlimited"
                : `${preview.included} km`,
            ],
            ["Base rental", currency.format(preview.base / 100)],
            [
              `Excess distance (${preview.excessKm} km)`,
              currency.format(preview.excess / 100),
            ],
            ["Rental charge", currency.format(preview.total / 100)],
            [
              "Refundable security deposit",
              currency.format(preview.deposit / 100),
            ],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Enter valid package rates, rental hours and distance to see the
          estimate.
        </p>
      )}
    </Section>
  );
}

export default function RentalPackage() {
  const { can } = usePermissions();
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

  const includedKm = useWatch({ control, name: "included_km_per_unit" });
  const active = useWatch({ control, name: "status" });
  const unlimited = includedKm === "" || includedKm == null;

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loadingTable, setLoadingTable] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  const tableElement = useRef(null);
  const table = useRef(null);
  const listRequest = useRef(null);
  const listFilters = useRef({ status: "", billing_unit: "" });
  const formRequest = useRef(null);

  const editing = editId !== null;
  const busy = loadingForm || saving;

  const loadTable = useCallback(async () => {
    listRequest.current?.abort();
    const request = new AbortController();
    listRequest.current = request;
    setLoadingTable(true);
    setPageError("");

    try {
      const { data } = await axiosClient.post(
        "/get_rental_packages",
        listFilters.current,
        { signal: request.signal },
      );
      if (request.signal.aborted) return;
      if (!data.status || !Array.isArray(data.data)) {
        throw new Error("Unable to load rental packages.");
      }
      await table.current?.setData(data.data);
    } catch (error) {
      if (!request.signal.aborted) {
        setPageError(error.response?.data?.message || error.message);
      }
    } finally {
      if (!request.signal.aborted) setLoadingTable(false);
    }
  }, []);

  const openForm = useCallback(
    async (id = null) => {
      if (formRequest.current) return;

      const request = new AbortController();
      formRequest.current = request;
      const config = { signal: request.signal };

      reset({ ...EMPTY_FORM });
      setEditId(id);
      setSuccess("");
      setPageError("");
      setFormError("");
      setOpen(true);
      setLoadingForm(true);

      try {
        const packageResponse = id === null ? null : await axiosClient.post(
          "/fetch_rental_package_data", { upd_id: id }, config,
        );
        if (request.signal.aborted) return;

        if (packageResponse) {
          const result = packageResponse.data;
          if (!result.status || !result.data)
            throw new Error("Rental package not found.");
          const row = result.data;

          reset({
            package_name: row.package_name,
            vehicle_id: String(row.vehicle_id),
            billing_unit: row.billing_unit,
            rate_per_unit: String(row.rate_per_unit),
            included_km_per_unit:
              row.included_km_per_unit == null
                ? ""
                : String(row.included_km_per_unit),
            extra_km_charge: String(row.extra_km_charge),
            security_deposit: String(row.security_deposit),
            minimum_units: String(row.minimum_units),
            status: Number(row.status) === 1,
          });
        }
      } catch (error) {
        if (!request.signal.aborted) {
          setOpen(false);
          setPageError(error.response?.data?.message || error.message);
        }
      } finally {
        if (formRequest.current === request) formRequest.current = null;
        if (!request.signal.aborted) setLoadingForm(false);
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
      columnHeaderVertAlign: "middle",
      placeholder: "No rental packages found.",
      columns: [
        {
          title: "Package",
          field: "package_name",
          minWidth: 180,
          formatter: "plaintext",
        },
        {
          title: "Vehicle",
          field: "vehicle_number",
          minWidth: 130,
          formatter: "plaintext",
        },
        {
          title: "Unit",
          field: "billing_unit",
          width: 90,
          formatter: (cell) => UNIT_LABELS[cell.getValue()] || "",
        },
        {
          title: "Rate / Unit",
          field: "rate_per_unit",
          minWidth: 135,
          hozAlign: "right",
          formatter: (cell) => currency.format(Number(cell.getValue())),
        },
        {
          title: "Km / Unit",
          field: "included_km_per_unit",
          width: 110,
          formatter: (cell) =>
            cell.getValue() == null
              ? "Unlimited"
              : String(Number(cell.getValue())),
        },
        {
          title: "Deposit",
          field: "security_deposit",
          minWidth: 135,
          hozAlign: "right",
          formatter: (cell) => currency.format(Number(cell.getValue())),
        },
        {
          title: "Status",
          field: "status",
          width: 105,
          hozAlign: "center",
          formatter: (cell) =>
            Number(cell.getValue()) === 1
              ? '<span class="rounded-full bg-[var(--success-soft)] px-3 py-1 text-xs font-medium text-[var(--success)]">Active</span>'
              : '<span class="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">Inactive</span>',
        },
        {
          title: "Actions",
          field: "id",
          width: 85,
          hozAlign: "center",
          headerSort: false,
          formatter: () => can("rental_packages.edit") ? (EDIT_BUTTON) : "",
          cellClick(event, cell) {
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
  }, [loadTable, openForm, can]);

  function changeDrawer(nextOpen) {
    if (formRequest.current) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setFormError("");
      reset({ ...EMPTY_FORM });
    }
  }

  async function savePackage(values) {
    if (formRequest.current) return;

    const request = new AbortController();
    formRequest.current = request;
    setSaving(true);
    setFormError("");
    setSuccess("");
    clearErrors();

    const hasUnlimitedKm =
      values.included_km_per_unit === "" || values.included_km_per_unit == null;

    const payload = {
      ...values,
      package_name: values.package_name.trim(),
      vehicle_id: Number(values.vehicle_id),
      included_km_per_unit: hasUnlimitedKm
        ? null
        : Number(values.included_km_per_unit),
      extra_km_charge: hasUnlimitedKm ? "0.00" : values.extra_km_charge,
      minimum_units: Number(values.minimum_units),
      status: values.status ? 1 : 0,
    };

    if (editing) payload.upd_id = editId;

    try {
      const { data } = await axiosClient.post("/save_rental_package", payload, {
        signal: request.signal,
      });
      if (request.signal.aborted) return;
      if (!data.status)
        throw new Error(data.message || "Unable to save rental package.");

      setOpen(false);
      reset({ ...EMPTY_FORM });
      setSuccess(data.message);
      await loadTable();
    } catch (error) {
      if (request.signal.aborted) return;
      const response = error.response;

      if (response?.status === 422 && response.data.errors) {
        const general = [];
        for (const [name, messages] of Object.entries(response.data.errors)) {
          const message = Array.isArray(messages)
            ? messages[0]
            : String(messages);
          if (Object.hasOwn(EMPTY_FORM, name)) {
            setError(name, { type: "server", message });
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
            "Unable to save rental package.",
        );
      }
    } finally {
      if (formRequest.current === request) formRequest.current = null;
      if (!request.signal.aborted) setSaving(false);
    }
  }

  const selectClass =
    "custom-input-sm w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground";

  let submitText = editing ? "Update Package" : "Save Package";
  if (saving) submitText = editing ? "Updating..." : "Saving...";
  if (loadingForm) submitText = "Loading...";

  return (
    <>
      <PageHeader
        title="Rental Packages"
        sub_text="Manage vehicle rental rates, mileage allowances and deposits."
        breadcrumbs={[{ label: "Rental" }, { label: "Rental Packages" }]}
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
                  className="mt-1 underline"
                  onClick={loadTable}
                >
                  Reload package list
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
            <PermissionGate permission="rental_packages.create"><button
              type="button"
              className="btn-primary management-add"
              disabled={busy}
              onClick={() => void openForm()}
            >
              <Plus size={16} aria-hidden="true" className="mr-2" />
              Add Rental Package
            </button></PermissionGate>

            <CustomDrawer canSubmit={can("rental_packages.create") && !editing || can("rental_packages.edit") && editing}
              open={open}
              setOpen={changeDrawer}
              saving={busy}
              title={
                editing ? "Update Rental Package" : "Create Rental Package"
              }
              description="Set the rate and rental terms for this vehicle."
              submitText={submitText}
              onSubmit={(event) => handleSubmit(savePackage)(event)}
              size="max-w-3xl"
            >
              {formError && (
                <div role="alert" className="form-alert mb-4">
                  {formError}
                </div>
              )}
              {loadingForm && (
                <p role="status" className="mb-4 text-sm">
                  Loading package details...
                </p>
              )}

              <FormProvider {...methods}>
                <form
                  noValidate
                  onSubmit={(event) => handleSubmit(savePackage)(event)}
                  aria-busy={busy}
                >
                  <fieldset
                    disabled={busy}
                    className="m-0 min-w-0 space-y-5 border-0 p-0"
                  >
                    <Section title="Package details">
                      <Field
                        name="package_name"
                        label="Package name *"
                        errors={errors}
                      >
                        <Input
                          id="package_name"
                          maxLength={100}
                          className="custom-input-sm"
                          placeholder="Standard Daily Rental"
                          aria-invalid={!!errors.package_name}
                          {...register("package_name", {
                            required: "Package name is required.",
                            validate: (value) =>
                              Boolean(value.trim()) ||
                              "Package name is required.",
                          })}
                        />
                      </Field>

                      <Field
                        name="vehicle_id"
                        label="Vehicle *"
                        errors={{}}
                      >
                        <Select2
                          name="vehicle_id"
                          endpoint="/rental_package_vehicles"
                          placeholder="Search vehicle number, brand or model..."
                          disabled={busy}
                          rules={{ required: "Please select a vehicle." }}
                        />
                      </Field>

                      <Field
                        name="billing_unit"
                        label="Billing unit *"
                        errors={errors}
                      >
                        <select
                          id="billing_unit"
                          className={selectClass}
                          {...register("billing_unit")}
                        >
                          <option value="day">Day (24 hours)</option>
                          <option value="week">Week (7 days)</option>
                          <option value="month">Month (30 days)</option>
                        </select>
                      </Field>

                      <Field
                        name="minimum_units"
                        label="Minimum rental units *"
                        errors={errors}
                      >
                        <Input
                          id="minimum_units"
                          type="number"
                          min="1"
                          max="365"
                          step="1"
                          className="custom-input-sm"
                          aria-invalid={!!errors.minimum_units}
                          {...register(
                            "minimum_units",
                            integerRules("Minimum rental units", 1, 365),
                          )}
                        />
                      </Field>
                    </Section>

                    <Section title="Rates and mileage">
                      <Field
                        name="rate_per_unit"
                        label="Rate per unit (LKR) *"
                        errors={errors}
                      >
                        <Input
                          id="rate_per_unit"
                          inputMode="decimal"
                          placeholder="8000.00"
                          className="custom-input-sm"
                          aria-invalid={!!errors.rate_per_unit}
                          {...register(
                            "rate_per_unit",
                            moneyRules("Rate per unit", true),
                          )}
                        />
                      </Field>

                      <Field
                        name="security_deposit"
                        label="Refundable security deposit (LKR) *"
                        errors={errors}
                      >
                        <Input
                          id="security_deposit"
                          inputMode="decimal"
                          className="custom-input-sm"
                          aria-invalid={!!errors.security_deposit}
                          {...register(
                            "security_deposit",
                            moneyRules("Security deposit"),
                          )}
                        />
                      </Field>

                      <Field
                        name="included_km_per_unit"
                        label="Included kilometres per unit"
                        errors={errors}
                        hint="Leave blank for unlimited mileage. Enter 0 to charge from the first kilometre."
                      >
                        <Input
                          id="included_km_per_unit"
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Unlimited"
                          className="custom-input-sm"
                          aria-invalid={!!errors.included_km_per_unit}
                          {...register(
                            "included_km_per_unit",
                            integerRules("Included kilometres", 0, 1000000, true),
                          )}
                        />
                      </Field>

                      <Field
                        name="extra_km_charge"
                        label="Extra kilometre charge (LKR)"
                        errors={errors}
                      >
                        {unlimited ? (
                          <Input
                            id="extra_km_charge"
                            value="0.00"
                            readOnly
                            className="custom-input-sm"
                          />
                        ) : (
                          <Input
                            id="extra_km_charge"
                            inputMode="decimal"
                            className="custom-input-sm"
                            aria-invalid={!!errors.extra_km_charge}
                            {...register("extra_km_charge", {
                              validate: (value, allValues) =>
                                allValues.included_km_per_unit === "" ||
                                MONEY_PATTERN.test(String(value ?? "")) ||
                                "Enter a valid extra kilometre charge, such as 75.00.",
                            })}
                          />
                        )}
                      </Field>
                    </Section>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                      <div>
                        <label
                          htmlFor="package_status"
                          className="text-sm font-semibold"
                        >
                          Active status
                        </label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {active
                            ? "Available for new bookings."
                            : "Inactive for new bookings."}
                        </p>
                        <FieldError errors={errors} name="status" />
                      </div>

                      <label className="relative inline-flex cursor-pointer items-center">
                        <input
                          id="package_status"
                          type="checkbox"
                          className="peer sr-only"
                          {...register("status")}
                        />
                        <span
                          aria-hidden="true"
                          className="h-6 w-11 rounded-full bg-secondary transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                        />
                        <span
                          aria-hidden="true"
                          className="absolute left-1 top-1 h-4 w-4 rounded-full bg-card shadow-sm transition-transform peer-checked:translate-x-5"
                        />
                      </label>
                    </div>

                    {open && <PricePreview control={control} />}
                  </fieldset>
                </form>
              </FormProvider>
            </CustomDrawer>

            <div className="xl:col-span-12">
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between gap-4 border-b px-6 py-5">
                  <div>
                    <h2 className="text-base font-semibold">
                      Rental Package List
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Find packages by vehicle, name or billing unit.
                    </p>
                  </div>
                  <span className="rounded-full bg-[var(--info-soft)] px-3 py-1 text-sm font-medium text-primary">
                    Packages
                  </span>
                </div>
                <div
                  id="rental-package-tb"
                  className="relative p-6"
                  aria-busy={loadingTable}
                >
                  <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[['status', 'Package status', [['1', 'Active'], ['0', 'Inactive']]], ['billing_unit', 'Billing unit', Object.entries(UNIT_LABELS)]].map(([name, label, options]) => (
                      <select key={name} aria-label={label} className="custom-input-sm" defaultValue="" onChange={(event) => {
                        listFilters.current[name] = event.target.value;
                        void loadTable();
                      }}>
                        <option value="">{name === 'status' ? 'All package statuses' : 'All billing units'}</option>
                        {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                      </select>
                    ))}
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
        </div>
      </div>

      <CarLoader
        targetId="rental-package-tb"
        show={loadingTable}
        text="Loading Rental Packages"
      />
    </>
  );
}
