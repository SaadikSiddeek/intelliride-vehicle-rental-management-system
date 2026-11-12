import { DatePicker } from "@/components/DateInput";
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

const EMPTY = { invoice_id: "", amount: "", method: "cash", reference: "", paid_on: "", reason: "", approved: false };
const TITLES = { invoices: "Invoices", payments: "Payments", refunds: "Deposit Refunds" };
const ENDPOINTS = { invoices: "/get_invoices", payments: "/get_payments", refunds: "/get_refunds" };
const money = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" });

export function InvoiceSummary({ invoice }) {
  const s = invoice?.summary;
  if (!s) return null;
  return <dl className="space-y-2 rounded-lg bg-secondary/40 p-4 text-sm">{[["Invoice", s.invoice_number], ["Payment status", s.payment_status], ["Invoice total", money.format(s.total)], ["Original booking advances", money.format(s.booking_advances)], ["Additional rental payments", money.format(s.additional_payments)], ["Cash received — excluding deposits", money.format(s.cash_received)], ["Deposit applied to approved charges", money.format(s.deposit_applied)], ["Invoice outstanding", money.format(s.balance)], ["Deposit received", money.format(s.deposit_received)], ["Deposit refunded", money.format(s.deposit_refunded)], ["Deposit still held", money.format(s.deposit_held)]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-semibold tabular-nums">{value}</dd></div>)}</dl>;
}

export default function FinancePage({ mode }) {
  const methods = useForm({ defaultValues: EMPTY });
  const { register, handleSubmit, reset, setError, clearErrors, formState: { errors } } = methods;
  const [open, setOpen] = useState(false), [invoice, setInvoice] = useState(null), [entry, setEntry] = useState(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [pageError, setPageError] = useState(""), [formError, setFormError] = useState(""), [success, setSuccess] = useState("");
  const tableElement = useRef(null), table = useRef(null), listRequest = useRef(null), formRequest = useRef(null), contextRequest = useRef(null), requestKey = useRef(null);
  const [dateRange, setDateRange] = useState([]);
  const filters = useRef({ from: "", to: "", payment_status: "", method: "" });
  const title = TITLES[mode], readOnly = mode === "invoices" || !!entry;
  const loadTable = useCallback(async () => {
    listRequest.current?.abort(); const request = new AbortController(); listRequest.current = request; setLoading(true); setPageError("");
    try { const { data } = await axiosClient.post(ENDPOINTS[mode], filters.current, { signal: request.signal }); if (!request.signal.aborted) await table.current?.setData(data.data || []); }
    catch (error) { if (!request.signal.aborted) setPageError(error.response?.data?.message || error.message); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, [mode]);
  const openForm = useCallback(async (row = null) => {
    if (formRequest.current) return;
    contextRequest.current?.abort(); reset({ ...EMPTY }); requestKey.current = crypto.randomUUID(); setInvoice(null); setEntry(mode === "invoices" ? null : row); setFormError(""); setOpen(true);
    const id = mode === "invoices" ? row?.id : row?.invoice_id;
    if (!id) return;
    const request = new AbortController(); formRequest.current = request; setBusy(true);
    try { const { data } = await axiosClient.post("/fetch_invoice_data", { upd_id: id }, { signal: request.signal }); if (!request.signal.aborted) setInvoice(data.data); }
    catch (error) { if (!request.signal.aborted) setFormError(error.response?.data?.message || error.message); }
    finally { if (formRequest.current === request) formRequest.current = null; if (!request.signal.aborted) setBusy(false); }
  }, [mode, reset]);
  const openLinkedInvoice = useCallback(id => { if (mode === "invoices") void openForm({ id }); }, [mode, openForm]);
  useRecordLink(openLinkedInvoice);
  useEffect(() => {
    const fields = mode === "invoices" ? [["Invoice", "invoice_number"], ["Issued", "issued_on"], ["Customer", "customer_name"], ["Vehicle", "vehicle_number"], ["Rental", "rental_number"], ["Payment status", "payment_status"], ["Total", "total"], ["Outstanding", "balance"]] : mode === "payments" ? [["Receipt", "id"], ["Source", "source"], ["Invoice ID", "invoice_id"], ["Booking ID", "booking_id"], ["Date", "paid_on"], ["Amount", "amount"], ["Method", "method"], ["Reference", "reference"], ["Recorded by", "recorded_by"]] : [["Refund", "id"], ["Invoice ID", "invoice_id"], ["Rental ID", "rental_id"], ["Amount", "amount"], ["Method", "method"], ["Reference", "reference"], ["Recorded by", "recorded_by"], ["Recorded at", "created_at"]];
    const instance = new Tabulator(tableElement.current, { index: "id", layout: "fitColumns", maxHeight: "550px", placeholder: `No ${TITLES[mode].toLowerCase()} found.`, columns: [
      ...fields.map(([title, field]) => ({ title, field, minWidth: 135, formatter: ["amount", "total", "balance"].includes(field) ? (cell) => money.format(cell.getValue()) : "plaintext" })),
      { title: "Actions", minWidth: 85, headerSort: false, formatter: () => tableAction("view", "View finance record", ""), cellClick: (event, cell) => { if (event.target.closest("button")) void openForm(cell.getRow().getData()); } },
    ] }); table.current = instance; instance.on("tableBuilt", loadTable);
    return () => { listRequest.current?.abort(); formRequest.current?.abort(); contextRequest.current?.abort(); instance.off("tableBuilt", loadTable); instance.destroy(); table.current = null; };
  }, [mode, loadTable, openForm]);
  async function selectInvoice(id) {
    contextRequest.current?.abort(); setInvoice(null); if (!id) return;
    const request = new AbortController(); contextRequest.current = request;
    try { const { data } = await axiosClient.post("/fetch_invoice_data", { upd_id: id }, { signal: request.signal }); if (!request.signal.aborted) setInvoice(data.data); }
    catch (error) { if (!request.signal.aborted) setFormError(error.response?.data?.message || "Unable to load invoice settlement."); }
  }
  async function save(values) {
    if (formRequest.current || readOnly || !invoice) return;
    const request = new AbortController(); formRequest.current = request; setBusy(true); setFormError(""); clearErrors();
    try {
      const { data } = await axiosClient.post(mode === "payments" ? "/save_invoice_payment" : "/save_deposit_refund", { ...values, request_id: requestKey.current }, { signal: request.signal });
      if (!request.signal.aborted) { setOpen(false); setSuccess(data.message); await loadTable(); }
    } catch (error) {
      if (request.signal.aborted) return;
      if (error.response?.status === 422) {
        const all = []; Object.entries(error.response.data.errors || {}).forEach(([key, messages]) => { const message = Array.isArray(messages) ? messages[0] : String(messages); if (Object.hasOwn(EMPTY, key)) setError(key, { type: "server", message }); all.push(message); }); setFormError(all.join(" ") || "Please check the submitted values.");
      } else setFormError(error.response?.data?.message || error.message);
    } finally { if (formRequest.current === request) formRequest.current = null; if (!request.signal.aborted) setBusy(false); }
  }
  async function outputInvoice(format) {
    if (!invoice) return;
    const printWindow = format === "html" ? window.open("", "_blank") : null;
    try { const { data } = await axiosClient.post("/invoice_output", { invoice_id: invoice.ID, format }, { responseType: "blob" }); const url = URL.createObjectURL(data); if (printWindow) printWindow.location.href = url; else { const link = document.createElement("a"); link.href = url; link.download = `${invoice.summary.invoice_number}.${format === "html" ? "html" : "pdf"}`; link.click(); } setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch { printWindow?.close(); setFormError("Unable to prepare the invoice output."); }
  }
  const field = (name, label, children) => <div className="min-w-0"><label htmlFor={name} className="mb-2 block text-sm font-semibold">{label}</label>{children}<FieldError name={name} errors={errors} /></div>;
  const snapshot = invoice?.snapshot;
  const setFilter = (key, value) => { filters.current[key] = value; void loadTable(); };
  return <>
    <PageHeader title={title} sub_text={mode === "invoices" ? "Issued rental invoices with historical charge snapshots and current settlement balances." : mode === "payments" ? "Booking advances and additional invoice receipts, recorded once." : "Authorized refunds of remaining security deposits, separate from rental income."} breadcrumbs={[{ label: "Finance" }, { label: title }]} />
    <div className="management-page"><div className="page-container">
      {pageError && <div role="alert" className="form-alert mb-5">{pageError} <button type="button" className="underline" onClick={loadTable}>Reload</button></div>}
      {success && <div role="status" className="mb-5 rounded-lg border border-border bg-[var(--info-soft)] px-4 py-3 text-sm text-primary">{success}</div>}
      {mode !== "invoices" && <button type="button" className="btn-primary management-add mb-6" disabled={busy} onClick={() => void openForm()}><Plus size={16} className="mr-2" />{mode === "payments" ? "Record Payment" : "Record Deposit Refund"}</button>}
      <CustomDrawer open={open} setOpen={(next) => { if (!formRequest.current) setOpen(next); }} saving={busy} title={mode === "invoices" ? invoice?.summary.invoice_number || "Invoice Details" : entry ? "Recorded Financial Entry" : mode === "payments" ? "Record Invoice Payment" : "Record Deposit Refund"} description="Issued charges and receipt history are preserved. Security deposits are tracked separately." submitText={readOnly ? "Close" : busy ? "Saving..." : "Record Authorized Entry"} onSubmit={(event) => readOnly ? setOpen(false) : handleSubmit(save)(event)} size="max-w-3xl">
        {formError && <div role="alert" className="form-alert mb-4">{formError}</div>}
        {busy && <p role="status" className="mb-4 text-sm">Loading finance details...</p>}
        {!readOnly && <FormProvider {...methods}><form noValidate onSubmit={(event) => handleSubmit(save)(event)}><fieldset disabled={busy} className="m-0 min-w-0 space-y-5 border-0 p-0">
          <FormSection title="Invoice and authorized action"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="invoice_id" className="mb-2 block text-sm font-semibold">Issued invoice *</label><Select2 name="invoice_id" endpoint={mode === "refunds" ? "/invoice_filter?refunds_only=1" : "/invoice_filter"} disabled={busy} rules={{ required: "Select an issued invoice." }} onValueChange={(id) => void selectInvoice(id)} /></div>
            {field("amount", "Amount (LKR) *", <Input id="amount" inputMode="decimal" {...register("amount", { required: "Amount is required.", pattern: { value: /^\d{1,10}(\.\d{1,2})?$/, message: "Enter a valid amount with up to two decimal places." }, validate: (value) => Number(value) > 0 || "Amount must be greater than zero." })} />)}
            {field("method", "Method *", <NativeSelect id="method" {...register("method")}><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option></NativeSelect>)}
            {mode === "payments" && field("paid_on", "Payment date *", <Input id="paid_on" type="date" {...register("paid_on", { required: "Payment date is required." })} />)}
            {field("reference", "Reference", <Input id="reference" maxLength={150} {...register("reference")} />)}
            {mode === "refunds" && field("reason", "Refund approval reason *", <Textarea id="reason" rows={3} maxLength={2000} {...register("reason", { required: "Refund reason is required." })} />)}
            <div className="sm:col-span-2"><label className="flex items-start gap-2 text-sm"><input type="checkbox" {...register("approved", { required: "Explicit approval is required." })} />I verified and authorize recording this {mode === "refunds" ? "deposit refund" : "payment receipt"}.</label><FieldError name="approved" errors={errors} /></div>
          </div><p className="mt-3 text-xs text-muted-foreground">{mode === "refunds" ? "Only settled, completed rentals with a remaining deposit can be refunded. This records an authorized refund; no bank transfer is initiated." : "Original booking advances are already credited and must not be entered again."}</p></FormSection>
        </fieldset></form></FormProvider>}
        {entry && <FormSection title="Immutable receipt record"><dl className="space-y-2 text-sm">{Object.entries(entry).filter(([, value]) => value != null).map(([key, value]) => <div key={key} className="flex justify-between gap-4"><dt className="text-muted-foreground">{key.replaceAll("_", " ")}</dt><dd className="text-right">{String(value)}</dd></div>)}</dl></FormSection>}
        {invoice && <div className="mt-5 space-y-5">
          {snapshot && <FormSection title="Historical rental details"><p className="font-semibold">{snapshot.rental.rental_snapshot.customer.name} · {snapshot.rental.rental_snapshot.vehicle.number}</p><p className="mt-1 text-sm">BKG-{String(invoice.booking_id).padStart(6, "0")} · RNT-{String(invoice.rental_id).padStart(6, "0")} · Issued {invoice.issued_on}</p><p className="mt-1 text-sm">Handed over by {snapshot.rental.handover_staff_name}; received by {snapshot.return.receiving_staff_name}.</p><p className="mt-1 text-sm">Package: {snapshot.pricing.package_name}; agreed rate {money.format(snapshot.pricing.agreed_rate)} / {snapshot.pricing.billing_unit}.</p></FormSection>}
          <FormSection title="Current invoice and deposit settlement"><InvoiceSummary invoice={invoice} /></FormSection>
          {mode === "invoices" && <div className="flex flex-wrap gap-3"><button type="button" className="btn-primary" onClick={() => void outputInvoice("html")}>Print Invoice / Save as PDF</button><button type="button" className="btn-primary" onClick={() => void outputInvoice("pdf")}>Download Invoice PDF</button></div>}
          {mode === "invoices" && snapshot && <FormSection title="Issued charge breakdown"><dl className="space-y-2 text-sm">{[["Rental subtotal", snapshot.pricing.subtotal], ["Discount", invoice.discount], ["Extra kilometres", snapshot.settlement.extra_km_charge], ["Late charge", snapshot.settlement.late_charge], ["Fuel charge", snapshot.settlement.fuel_charge], ["Approved damage", snapshot.settlement.damage_charge], ["Tax", invoice.tax], ["Invoice total", invoice.total]].map(([label, amount]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd>{money.format(amount)}</dd></div>)}</dl></FormSection>}
          {mode === "invoices" && <FormSection title="Receipt and deposit history">{[...invoice.booking_payments.map((r) => ({ ...r, kind: "Original booking advance" })), ...invoice.payments.map((r) => ({ ...r, kind: "Additional invoice receipt" })), ...invoice.deposits.map((r) => ({ ...r, kind: `Deposit ${r.entry_type}` }))].map((r, index) => <p key={index} className="mb-2 text-sm">{r.kind}: {money.format(r.amount)} · {r.method || "Settlement"} · {r.reference || "No reference"}</p>)}</FormSection>}
        </div>}
      </CustomDrawer>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="border-b px-6 py-5"><h2 className="text-base font-semibold">{title} Register</h2></div><div id="finance-tb" className="relative p-6" aria-busy={loading}><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><DatePicker id="finance_period" aria-label="Finance date range" range value={dateRange} onValueChange={dates => { setDateRange(dates); if (dates.length === 1) return; filters.current.from = dates[0] || ""; filters.current.to = dates[1] || ""; void loadTable(); }} />{mode === "invoices" ? <NativeSelect aria-label="Invoice payment status filter" onChange={(event) => setFilter("payment_status", event.target.value)}><option value="">All payment statuses</option>{["Unpaid", "Partially Paid", "Paid"].map((status) => <option key={status} value={status}>{status}</option>)}</NativeSelect> : <NativeSelect aria-label="Payment method filter" onChange={(event) => setFilter("method", event.target.value)}><option value="">All methods</option><option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option></NativeSelect>}</div><TableSearch table={table} /><div ref={tableElement} className="overflow-hidden rounded-xl border border-border" /></div></div>
    </div></div><CarLoader targetId="finance-tb" show={loading} text={`Loading ${title}`} />
  </>;
}
