import useRecordLink from "@/hooks/useRecordLink";
import { tableAction } from "@/lib/table-actions";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Plus } from "lucide-react";
import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import axiosClient from "@/axios-client";
import PageHeader from "@/components/PageHeader";
import CustomDrawer from "@/components/Drawer";
import FormSection from "@/components/forms/FormSection";
import Select2 from "@/components/Select2";
import FieldError from "@/components/ErrorField";
import TableSearch from "@/components/TableSearch";
import CarLoader from "@/components/CarLoader";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";

const EMPTY = { rental_id: "", actual_return_at: "", ending_odometer: "", return_fuel_litres: "", condition_notes: "", new_damage: "", damage_estimate: "0.00", damage_charge: "0.00", damage_reason: "", vehicle_after_return: "Inspection Required", apply_deposit: false, status: "Draft Assessment" };
const REVIEW = { review_notes: "", review_approved: false, damage_approved: false, deposit_deduction_approved: false, vehicle_release_approved: false };
const money = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" });

function Settlement({ calculation: c }) {
  if (!c) return <p className="text-sm text-muted-foreground">Save the assessment, then open it to review the backend calculation before finalizing.</p>;
  return <div className="space-y-4">
    {c.blockers?.length > 0 && <div role="alert" className="form-alert"><p className="font-semibold">Finalization is blocked</p>{c.blockers.map((reason) => <p key={reason}>{reason}</p>)}</div>}
    <dl className="space-y-2 rounded-lg bg-secondary/40 p-4 text-sm">
      {[
        ["Actual duration", `${c.duration_minutes} minutes`], ["Distance", `${c.actual_distance_km} km`], ["Included kilometres", c.included_km == null ? "Unlimited" : `${c.included_km} km`],
        [`Excess ${c.extra_km} km × ${money.format(c.extra_km_rate)}`, money.format(c.extra_km_charge)],
        ["Late duration / grace", `${c.late_minutes} / ${c.grace_minutes ?? "Unconfigured"} minutes`],
        ["Chargeable started hours", c.chargeable_late_hours], ["Hourly late rate / 24-hour cap", `${c.late_hourly_rate == null ? "Not configured / not required" : money.format(c.late_hourly_rate)} / ${c.late_24h_cap == null ? "Not configured / not required" : money.format(c.late_24h_cap)}`],
        ["Late charge", money.format(c.late_charge)], ["Fuel shortage", `${c.missing_fuel_litres} litres`], ["Fuel price per litre", c.fuel_price_per_litre == null ? "Not configured / not required" : money.format(c.fuel_price_per_litre)], ["Fuel charge", money.format(c.fuel_charge)],
        ["Damage estimate", money.format(c.damage_estimate)], ["Damage charge requiring approval", money.format(c.damage_charge)],
        ["Confirmed rental total", money.format(c.base_rental_total)], ["Additional charges", money.format(c.additional_charges)], ["Additional tax", money.format(c.additional_tax)], ["Invoice total", money.format(c.total)],
        ["Original booking advances", money.format(c.booking_advance_amount)], ["Deposit received", money.format(c.deposit_received)], ["Deposit currently held", money.format(c.deposit_held)], ["Proposed deposit deduction", money.format(c.deposit_to_apply)], ["Refundable deposit — no automatic refund", money.format(c.refundable_deposit)], ["Customer outstanding", money.format(c.outstanding)],
      ].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>)}
    </dl>
    <p className="text-xs text-muted-foreground">Within grace there is no late charge. Beyond grace, started hours run from scheduled return, capped in each 24-hour period. Deposits remain separate from revenue.</p>
  </div>;
}

export default function Return() {
  const methods = useForm({ defaultValues: EMPTY });
  const review = useForm({ defaultValues: REVIEW });
  const { register, reset, setError, clearErrors, handleSubmit, formState: { errors, isDirty } } = methods;
  const [open, setOpen] = useState(false), [record, setRecord] = useState(null), [rental, setRental] = useState(null), [photos, setPhotos] = useState([]);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [pageError, setPageError] = useState(""), [formError, setFormError] = useState(""), [success, setSuccess] = useState("");
  const tableElement = useRef(null), table = useRef(null), listRequest = useRef(null), formRequest = useRef(null), contextRequest = useRef(null), statusFilter = useRef("");
  const readonly = record?.status === "Finalized";
  const loadTable = useCallback(async () => {
    listRequest.current?.abort(); const request = new AbortController(); listRequest.current = request; setLoading(true); setPageError("");
    try { const { data } = await axiosClient.post("/get_returns", { status: statusFilter.current }, { signal: request.signal }); if (!request.signal.aborted) await table.current?.setData(data.data || []); }
    catch (error) { if (!request.signal.aborted) setPageError(error.response?.data?.message || error.message); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, []);
  const openForm = useCallback(async (id = null) => {
    if (formRequest.current) return;
    contextRequest.current?.abort(); reset({ ...EMPTY }); review.reset({ ...REVIEW }); setRecord(null); setRental(null); setPhotos([]); setFormError(""); setOpen(true);
    if (!id) return;
    const request = new AbortController(); formRequest.current = request; setBusy(true);
    try {
      const { data } = await axiosClient.post("/fetch_return_data", { upd_id: id }, { signal: request.signal });
      if (!request.signal.aborted) {
        const row = data.data; setRecord(row); setRental(row.rental);
        reset(Object.fromEntries(Object.keys(EMPTY).map((key) => [key, key === "actual_return_at" ? row[key].slice(0, 16).replace(" ", "T") : key === "apply_deposit" ? !!Number(row[key]) : row[key] ?? EMPTY[key]])));
      }
    } catch (error) { if (!request.signal.aborted) { setOpen(false); setPageError(error.response?.data?.message || error.message); } }
    finally { if (formRequest.current === request) formRequest.current = null; if (!request.signal.aborted) setBusy(false); }
  }, [reset, review]);
  useEffect(() => {
    const instance = new Tabulator(tableElement.current, { index: "id", layout: "fitColumns", maxHeight: "550px", placeholder: "No return assessments found.",
      columns: [...[["Rental", "rental_number"], ["Customer", "customer_name"], ["Vehicle", "vehicle_number"], ["Actual return", "actual_return_at"], ["Ending km", "ending_odometer"], ["Received by", "receiving_staff_name"], ["Status", "status"]].map(([title, field]) => ({ title, field, minWidth: 140, formatter: "plaintext" })),
        { title: "Actions", field: "id", minWidth: 90, headerSort: false, formatter: () => tableAction("review", "Review return", ""), cellClick: (event, cell) => { if (event.target.closest("button")) void openForm(cell.getValue()); } }] });
    table.current = instance; instance.on("tableBuilt", loadTable);
  return () => { listRequest.current?.abort(); formRequest.current?.abort(); contextRequest.current?.abort(); instance.off("tableBuilt", loadTable); instance.destroy(); table.current = null; };
  }, [loadTable, openForm]);

  useRecordLink(openForm);
  async function selectRental(id) {
    contextRequest.current?.abort(); setRental(null); if (!id) return;
    const request = new AbortController(); contextRequest.current = request;
    try { const { data } = await axiosClient.post("/fetch_rental_data", { upd_id: id }, { signal: request.signal }); if (!request.signal.aborted) setRental(data.data); }
    catch (error) { if (!request.signal.aborted) setFormError(error.response?.data?.message || "Unable to load rental."); }
  }
  function showErrors(error) {
    if (error.response?.status === 422) {
      const messages = [];
      Object.entries(error.response.data.errors || {}).forEach(([key, value]) => {
        const message = Array.isArray(value) ? value.join(" ") : String(value);
        if (Object.hasOwn(EMPTY, key)) setError(key, { type: "server", message }); else if (Object.hasOwn(REVIEW, key)) review.setError(key, { type: "server", message });
        messages.push(message);
      }); setFormError(messages.join(" ") || "Please check the submitted values.");
    } else setFormError(error.response?.data?.message || error.message);
  }
  async function save(values) {
    if (formRequest.current || readonly) return;
    const request = new AbortController(); formRequest.current = request; setBusy(true); setFormError(""); clearErrors();
    const payload = new FormData(); Object.keys(EMPTY).forEach((key) => payload.append(key, typeof values[key] === "boolean" ? (values[key] ? "1" : "0") : String(values[key] ?? "").trim()));
    if (record) payload.append("revision", String(record.revision)); photos.forEach((file) => payload.append("photos[]", file));
    try { const { data } = await axiosClient.post("/save_return_assessment", payload, { signal: request.signal }); if (!request.signal.aborted) { setOpen(false); setSuccess(data.message); await loadTable(); } }
    catch (error) { if (!request.signal.aborted) showErrors(error); }
    finally { if (formRequest.current === request) formRequest.current = null; if (!request.signal.aborted) setBusy(false); }
  }
  async function finalize(values) {
    if (formRequest.current || isDirty || !record || readonly) return;
    const request = new AbortController(); formRequest.current = request; setBusy(true); setFormError(""); review.clearErrors();
    try {
      const { data } = await axiosClient.post("/finalize_return", { ...values, upd_id: record.ID, revision: record.revision, review_hash: record.calculation.review_hash }, { signal: request.signal });
      if (!request.signal.aborted) { setOpen(false); setSuccess(`${data.message} Invoice INV-${String(data.data.invoice_id).padStart(6, "0")}.`); await loadTable(); }
    } catch (error) { if (!request.signal.aborted) showErrors(error); }
    finally { if (formRequest.current === request) formRequest.current = null; if (!request.signal.aborted) setBusy(false); }
  }
  const required = (label) => ({ required: `${label} is required.` });
  const amount = { required: "Enter an amount or zero.", pattern: { value: /^\d{1,10}(\.\d{1,2})?$/, message: "Enter a valid amount with up to two decimal places." } };
  const field = (name, label, children) => <div className="min-w-0"><label htmlFor={name} className="mb-2 block text-sm font-semibold">{label}</label>{children}<FieldError name={name} errors={errors} /></div>;

  return <>
    <PageHeader title="Vehicle Returns" sub_text="Assess the return, review the charges and approve final settlement." breadcrumbs={[{ label: "Rental Operations" }, { label: "Returns" }]} />
    <div className="management-page"><div className="page-container">
      {pageError && <div role="alert" className="form-alert mb-5">{pageError} <button type="button" onClick={loadTable} className="underline">Reload returns</button></div>}
      {success && <div role="status" className="mb-5 rounded-lg border border-border bg-[var(--info-soft)] px-4 py-3 text-sm text-primary">{success}</div>}
      <button type="button" className="btn-primary management-add mb-6" disabled={busy} onClick={() => void openForm()}><Plus size={16} className="mr-2" />New Return Assessment</button>
      <CustomDrawer open={open} setOpen={(next) => { if (!formRequest.current) setOpen(next); }} saving={busy} title={record ? `Return Assessment ${record.ID}` : "Return Assessment"} description="All amounts are calculated on the backend. The receiving account and review history are preserved." submitText={readonly ? "Close" : busy ? "Saving..." : "Save Assessment"} onSubmit={(event) => readonly ? setOpen(false) : handleSubmit(save)(event)} size="max-w-3xl">
        {formError && <div role="alert" className="form-alert mb-4">{formError}</div>}
        {busy && <p role="status" className="mb-4 text-sm">Processing return assessment...</p>}
        <FormProvider {...methods}><form noValidate onSubmit={(event) => handleSubmit(save)(event)}><fieldset disabled={busy || readonly} className="m-0 min-w-0 space-y-5 border-0 p-0">
          <FormSection title="Rental and pickup condition">
            {!record && <><label htmlFor="rental_id" className="mb-2 block text-sm font-semibold">Active rental *</label><Select2 name="rental_id" endpoint="/return_rental_filter" rules={required("Rental")} onValueChange={(id) => void selectRental(id)} /></>}
            {rental && <div className="mt-3 rounded-lg bg-secondary/40 p-4 text-sm"><p className="font-semibold">RNT-{String(rental.ID).padStart(6, "0")} · {rental.rental_snapshot.customer.name} · {rental.rental_snapshot.vehicle.number}</p><p>Pickup: {rental.actual_pickup_at} · Expected return: {rental.rental_snapshot.expected_return_at}</p><p>Starting odometer: {rental.starting_odometer} km · Pickup fuel: {rental.pickup_fuel_litres} litres</p><p>Pickup condition: {rental.condition_notes}</p><p>Existing damage: {rental.existing_damage || "None recorded"}</p></div>}
          </FormSection>
          <FormSection title="Return inspection"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("actual_return_at", "Actual return date and time *", <Input id="actual_return_at" type="datetime-local" {...register("actual_return_at", required("Actual return time"))} />)}
            {field("ending_odometer", "Ending odometer (km) *", <Input id="ending_odometer" type="number" min={rental?.starting_odometer || 0} step="1" {...register("ending_odometer", required("Ending odometer"))} />)}
            {field("return_fuel_litres", "Measured return fuel (litres) *", <Input id="return_fuel_litres" type="number" min="0" step="0.001" {...register("return_fuel_litres", required("Return fuel"))} />)}
            {field("condition_notes", "Return condition report *", <Textarea id="condition_notes" rows={3} maxLength={4000} {...register("condition_notes", required("Return condition report"))} />)}
            {field("vehicle_after_return", "Vehicle operational status *", <NativeSelect id="vehicle_after_return" {...register("vehicle_after_return")}>{["Inspection Required", "Cleaning", "Maintenance", "Out of Service", "Available"].map((value) => <option key={value} value={value}>{value}</option>)}</NativeSelect>)}
          </div></FormSection>
          <FormSection title="Damage assessment and evidence"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("new_damage", "New damage description", <Textarea id="new_damage" rows={3} maxLength={4000} {...register("new_damage")} />)}
            {field("damage_estimate", "Estimated repair cost (LKR)", <Input id="damage_estimate" inputMode="decimal" {...register("damage_estimate", amount)} />)}
            {field("damage_charge", "Proposed approved damage charge (LKR)", <Input id="damage_charge" inputMode="decimal" {...register("damage_charge", amount)} />)}
            {field("damage_reason", "Reason for applying damage charge", <Textarea id="damage_reason" rows={3} maxLength={2000} {...register("damage_reason")} />)}
          </div><p className="mt-2 text-xs text-muted-foreground">An estimate alone never charges the customer. Applying a damage charge requires explicit approval at finalization.</p>
          {!readonly && <div className="mt-4"><label htmlFor="return_photos" className="mb-2 block text-sm font-semibold">New condition photos</label><input id="return_photos" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ""; if (files.length > 10 || files.some((file) => file.size > 2097152 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setFormError("Choose up to ten JPG, PNG or WebP photos, at most 2 MB each."); return; } setPhotos(files); }} /><p className="mt-2 text-xs text-muted-foreground">{photos.length} new photos selected; existing evidence is retained.</p></div>}
          </FormSection>
          <FormSection title="Assessment status and deposit"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("status", "Assessment status", <NativeSelect id="status" {...register("status")}>{(readonly ? ["Finalized"] : ["Draft Assessment", "Pending Review"]).map((value) => <option key={value} value={value}>{value}</option>)}</NativeSelect>)}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" {...register("apply_deposit")} />Propose applying available deposit to eligible unpaid approved invoice charges.</label>
          </div></FormSection>
        </fieldset></form></FormProvider>
        <div className="mt-5 space-y-5"><FormSection title="Backend settlement calculation"><Settlement calculation={record?.calculation} />{isDirty && <p role="status" className="mt-3 text-sm text-destructive">Save changes and reopen this assessment to refresh the calculation before approving it.</p>}</FormSection>
          {record?.status === "Pending Review" && <FormProvider {...review}><form noValidate onSubmit={(event) => review.handleSubmit(finalize)(event)}><FormSection title="Staff review and approval"><div className="space-y-4">
            <div><label htmlFor="review_notes" className="mb-2 block text-sm font-semibold">Review and settlement reason *</label><Textarea id="review_notes" rows={3} {...review.register("review_notes", required("Review notes"))} /><FieldError name="review_notes" errors={review.formState.errors} /></div>
            {[["review_approved", "I reviewed the rental, evidence, calculations and original payment records."], ["damage_approved", "I approve the documented damage charge, if proposed."], ["deposit_deduction_approved", "I authorize the proposed deposit deduction, if any."], ["vehicle_release_approved", "I inspected and approve making the vehicle Available, if selected."]].map(([name, label]) => <div key={name}><label className="flex items-start gap-2 text-sm"><input type="checkbox" {...review.register(name, name === "review_approved" ? required("Staff review") : {})} />{label}</label><FieldError name={name} errors={review.formState.errors} /></div>)}
            <button type="submit" className="btn-primary" disabled={busy || isDirty || photos.length > 0 || !!record.calculation.blockers?.length}>Finalize Reviewed Return</button>
          </div></FormSection></form></FormProvider>}
          {record?.photos?.length > 0 && <FormSection title="Pickup and return photo evidence"><div className="flex flex-wrap gap-3">{record.photos.map((photo) => <button type="button" key={photo.ID} className="btn-primary" onClick={async () => {
            try { const { data } = await axiosClient.get(`/rental_photos/${photo.ID}`, { responseType: "blob" }); const url = URL.createObjectURL(data), link = document.createElement("a"); link.href = url; link.download = `condition-${photo.ID}.${data.type.split("/")[1] || "jpg"}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); } catch { setFormError("Unable to download the condition photo."); }
          }}>{photo.stage} photo {photo.ID}</button>)}</div></FormSection>}
          {record?.audit?.length > 0 && <FormSection title="Assessment audit trail">{record.audit.map((entry) => <p key={entry.ID} className="text-sm">Revision {entry.revision} · {entry.action} · Account {entry.recorded_by} · {entry.created_at}</p>)}</FormSection>}
        </div>
      </CustomDrawer>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="border-b px-6 py-5"><h2 className="text-base font-semibold">Return Assessments</h2></div><div id="return-tb" className="relative p-6" aria-busy={loading}><NativeSelect aria-label="Return status filter" defaultValue="" onChange={(event) => { statusFilter.current = event.target.value; void loadTable(); }}><option value="">All assessment statuses</option>{["Draft Assessment", "Pending Review", "Finalized"].map((status) => <option key={status} value={status}>{status}</option>)}</NativeSelect><TableSearch table={table} /><div ref={tableElement} className="overflow-hidden rounded-xl border border-border" /></div></div>
    </div></div><CarLoader targetId="return-tb" show={loading} text="Loading Return Assessments" />
  </>;
}
