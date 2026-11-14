import usePermissions from "@/hooks/usePermissions";
import PermissionGate from "@/components/PermissionGate";
import DateRange from "@/components/forms/DateRange";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { TabulatorFull as Tabulator } from "tabulator-tables";
import "tabulator-tables/dist/css/tabulator.min.css";
import axiosClient from "@/axios-client";
import PageHeader from "@/components/PageHeader";
import FormSection from "@/components/forms/FormSection";
import Select2 from "@/components/Select2";
import CarLoader from "@/components/CarLoader";
import { Input, NativeSelect } from "@/components/ui/input";

function ReportScreen({ type }) {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const methods = useForm({ defaultValues: { from: "", to: "", customer_id: "", vehicle_id: "", branch_id: "", staff_id: "", status: "", include_identity: false, q: "", overdue_only: false, per_page: 50 } });
  const includeIdentity = useWatch({ control: methods.control, name: "include_identity" });
  const { register, handleSubmit, getValues, setError, clearErrors } = methods;
  const [types, setTypes] = useState({}), [canIdentity, setCanIdentity] = useState(false), [meta, setMeta] = useState(null), [totals, setTotals] = useState({});
  const [loading, setLoading] = useState(false), [exporting, setExporting] = useState(false), [error, setErrorMessage] = useState("");
  const tableElement = useRef(null), table = useRef(null), requestRef = useRef(null), appliedFilters = useRef(null);
  const [page, setPage] = useState(1);
  const noCustomer = ["vehicle_utilization", "maintenance_history", "document_expiry"].includes(type);
  const statuses = ["booking_history", "cancellations"].includes(type) ? ["Draft", "Confirmed", "Converted to Rental", "Cancelled", "No-show"] : type === "maintenance_history" ? ["Scheduled", "Active", "Completed", "Cancelled"] : type === "document_expiry" ? ["Current", "Expired", "Superseded"] : ["rental_history", "staff_handover", "customer_history", "monthly_rentals", "yearly_rentals"].includes(type) ? ["Active", "Completed"] : [];
  const showErrors = useCallback((e) => {
    const data = e.response?.data;
    if (e.response?.status === 422 && data?.errors) {
      Object.entries(data.errors).forEach(([name, messages]) => setError(name, { type: "server", message: Array.isArray(messages) ? messages[0] : String(messages) }));
      setErrorMessage(Object.values(data.errors).flat().join(" "));
    } else setErrorMessage(data?.message || e.message || "Unable to load report.");
  }, [setError]);
  const load = useCallback(async (nextPage = 1) => {
    requestRef.current?.abort(); const request = new AbortController(); requestRef.current = request; setLoading(true); setErrorMessage(""); clearErrors();
    try {
      const { data } = await axiosClient.post("/get_report", { ...getValues(), type, page: nextPage }, { signal: request.signal });
      if (request.signal.aborted) return;
      table.current?.setColumns(data.columns.map((column) => ({ title: column, field: column, minWidth: 150, hozAlign: /Revenue|Total|Tax|Discount|Charge|Received|Applied|Refunded|Paid|Balance|Held/.test(column) ? "right" : "left", formatter: /Revenue|Total|Tax|Discount|Charge|Received|Applied|Refunded|Paid|Balance|Held/.test(column) ? cell => Number(cell.getValue() || 0).toLocaleString("en-LK", {minimumFractionDigits:2,maximumFractionDigits:2}) : "plaintext" })));
      await table.current?.setData(data.data.map((row, index) => ({ id: index, ...row })));
      appliedFilters.current = data.meta.filters; setMeta(data.meta); setTotals(data.totals); setPage(nextPage);
    } catch (e) { if (!request.signal.aborted) showErrors(e); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, [type, clearErrors, getValues, showErrors]);
  useEffect(() => {
    const request = new AbortController();
    axiosClient.post("/report_options", {}, { signal: request.signal }).then(({ data }) => { if (!request.signal.aborted) { setTypes(data.data.types); setCanIdentity(data.data.can_include_identity); } }).catch((e) => { if (!request.signal.aborted) showErrors(e); });
    const instance = new Tabulator(tableElement.current, { index: "id", layout: "fitColumns", maxHeight: "550px", placeholder: "No records match the selected filters.", columns: [] });
    table.current = instance; const onBuilt = () => { if (type !== "customer_history") void load(); }; instance.on("tableBuilt", onBuilt);
    return () => { request.abort(); requestRef.current?.abort(); instance.off("tableBuilt", onBuilt); instance.destroy(); table.current = null; };
  }, [load, showErrors, type]);
  async function exportReport(format) {
    setExporting(true); setErrorMessage("");
    const printWindow = format === "html" ? window.open("", "_blank") : null;
    try {
      const { data } = await axiosClient.post("/export_report", { ...appliedFilters.current, type, format }, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      if (printWindow) printWindow.location.href = url;
      else { const link = document.createElement("a"); link.href = url; link.download = `intelliride-${type}.${format}`; link.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      printWindow?.close();
      if (e.response?.data instanceof Blob) { try { e.response.data = JSON.parse(await e.response.data.text()); } catch { /* Keep the transport error when the response is not JSON. */ } }
      showErrors(e);
    } finally { setExporting(false); }
  }
  const title = types[type] || "Reports";
  return <>
    <PageHeader title={title} sub_text="Backend-filtered business reports with consistent print and export permissions." breadcrumbs={[{ label: "Reports" }, { label: title }]} />
    <div className="management-page"><div className="page-container">
      {error && <div role="alert" className="form-alert mb-5">{error}</div>}
      <FormProvider {...methods}><form noValidate className="mb-6" onSubmit={(event) => handleSubmit(() => load(1))(event)}><FormSection title="Report filters"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div><label htmlFor="report_type" className="mb-2 block text-sm font-semibold">Report</label><NativeSelect id="report_type" value={type} onChange={(event) => navigate(`/reports/${event.target.value}`)}>{Object.entries(types).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></div>
        <div className="min-w-0"><label htmlFor="report_period" className="mb-2 block text-sm font-semibold">Date range</label><DateRange id="report_period" aria-label="Report date range" /></div>
        {!noCustomer && <div><label htmlFor="customer_id" className="mb-2 block text-sm font-semibold">Customer{type === "customer_history" ? " *" : ""}</label><Select2 name="customer_id" endpoint="/report_customer_filter" rules={type === "customer_history" ? { required: "Select a customer." } : undefined} /></div>}
        <div><label htmlFor="vehicle_id" className="mb-2 block text-sm font-semibold">Vehicle</label><Select2 name="vehicle_id" endpoint="/rental_package_vehicles" /></div>
        <div><label htmlFor="report_search" className="mb-2 block text-sm font-semibold">Search report</label><Input id="report_search" placeholder="Search visible report fields" {...register("q")} /></div>
        <div><label htmlFor="branch_id" className="mb-2 block text-sm font-semibold">Branch</label><Select2 name="branch_id" endpoint="/branch_filter" /></div>
        {type !== "vehicle_utilization" && <div><label htmlFor="staff_id" className="mb-2 block text-sm font-semibold">Staff employee</label><Select2 name="staff_id" endpoint="/staff_filter" /></div>}
        {statuses.length > 0 && <div><label htmlFor="report_status" className="mb-2 block text-sm font-semibold">Status</label><NativeSelect id="report_status" {...register("status")}><option value="">All applicable statuses</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</NativeSelect></div>}
        <div><label htmlFor="report_size" className="mb-2 block text-sm font-semibold">Rows per page</label><NativeSelect id="report_size" {...register("per_page")}>{[10, 50, 100, 200].map((size) => <option key={size} value={size}>{size}</option>)}</NativeSelect></div>
      </div><div className="mt-4 flex flex-wrap items-center gap-4"><button type="submit" className="btn-primary" disabled={loading}>Apply Filters</button>{["rental_history","staff_handover","customer_history"].includes(type) && <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("overdue_only")} />Only currently overdue active rentals</label>}
        {canIdentity && ["rental_history", "staff_handover", "customer_history"].includes(type) && <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register("include_identity")} />Include authorized NIC/passport details</label>}<p className="text-xs text-muted-foreground">Blank dates use the current month. Identity details require separate configured export permission.</p></div></FormSection></form></FormProvider>
      <div className="mb-5 flex flex-wrap gap-3">{[["html", "Print Report"], ["xlsx", "Export Excel (.xlsx)"], ["csv", "Export CSV (.csv)"], ["pdf", "Download PDF"]].map(([format, label]) => <PermissionGate key={format} permission={format === "html" ? "reports.print" : "reports.export"}><button key={format} type="button" className="btn-primary" disabled={loading || exporting || !meta || (!!includeIdentity && !can("reports.identity.export"))} onClick={() => void exportReport(format)}>{exporting ? "Preparing..." : label}</button></PermissionGate>)}</div>
      {meta && <p className="mb-4 text-sm text-muted-foreground">{meta.total} filtered records · {meta.filters.from} to {meta.filters.to} · Generated {meta.generated_at} Asia/Colombo. Exports use the currently displayed report filters across all pages; Apply Filters updates both.</p>}
      <div id="report-tb" className="relative overflow-hidden rounded-xl border border-border bg-card p-5" aria-busy={loading}><div ref={tableElement} className="overflow-hidden rounded-xl border border-border" /></div>
      {meta && <div className="mt-4 flex items-center justify-between gap-4"><button type="button" className="btn-primary" disabled={loading || page <= 1} onClick={() => void load(page - 1)}>Previous</button><p className="text-sm">Page {page} of {meta.last_page}</p><button type="button" className="btn-primary" disabled={loading || page >= meta.last_page} onClick={() => void load(page + 1)}>Next</button></div>}
      {Object.keys(totals).length > 0 && <details className="mt-5 rounded-xl border border-border bg-card p-5"><summary className="cursor-pointer text-sm font-semibold">Filtered totals across all pages</summary><dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">{Object.entries(totals).map(([label, amount]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-semibold">{new Intl.NumberFormat("en-LK", { maximumFractionDigits: 3 }).format(amount)}</dd></div>)}</dl></details>}
      <p className="mt-4 text-xs text-muted-foreground">Issued invoice amounts, cash receipts and deposit movements are distinct. Outstanding balances are current balances; utilization shows recorded usage/downtime and leaves unsupported idle time unclassified.</p>
    </div></div><CarLoader targetId="report-tb" show={loading} text="Loading Report" />
  </>;
}
export default function Reports() {
 const { type = "rental_history" } = useParams(); return <ReportScreen key={type} type={type} />; }
