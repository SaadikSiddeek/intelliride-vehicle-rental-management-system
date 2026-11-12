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
const DOCUMENT = { vehicle_id: "", document_type: "Insurance", document_number: "", issued_on: "", expires_on: "" };
const MAINTENANCE = { vehicle_id: "", service_type: "", starts_at: "", ends_at: "", notes: "" };

export default function FleetPage({ mode }) {
  const documents = mode === "documents", defaults = documents ? DOCUMENT : MAINTENANCE;
  const methods = useForm({ defaultValues: defaults });
  const { register, reset, setError, clearErrors, handleSubmit, formState: { errors, isDirty } } = methods;
  const [open, setOpen] = useState(false), [record, setRecord] = useState(null), [renewing, setRenewing] = useState(false), [file, setFile] = useState(null), [preview, setPreview] = useState("");
  const [release, setRelease] = useState("Inspection Required"), [releaseApproved, setReleaseApproved] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setErrorMessage] = useState(""), [formError, setFormError] = useState(""), [success, setSuccess] = useState("");
  const tableElement = useRef(null), table = useRef(null), listRequest = useRef(null), formRequest = useRef(null), listStatus = useRef("");
  const title = documents ? "Vehicle Documents" : "Maintenance";
  const readOnly = !!record && (documents ? !renewing : record.status !== "Scheduled");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const loadTable = useCallback(async () => {
    listRequest.current?.abort(); const request = new AbortController(); listRequest.current = request; setLoading(true); setErrorMessage("");
    try { const { data } = await axiosClient.post(documents ? "/get_vehicle_documents" : "/get_maintenance", { status: listStatus.current }, { signal: request.signal }); if (!request.signal.aborted) await table.current?.setData(data.data || []); }
    catch (e) { if (!request.signal.aborted) setErrorMessage(e.response?.data?.message || e.message); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }, [documents]);
  const openForm = useCallback((row = null, renew = false) => {
    if (formRequest.current) return;
    setRecord(row); setRenewing(renew); setFile(null); setPreview(""); setRelease("Inspection Required"); setReleaseApproved(false); setFormError(""); setOpen(true);
    const empty = documents ? DOCUMENT : MAINTENANCE;
    reset(row ? Object.fromEntries(Object.keys(empty).map((key) => [key, ["starts_at", "ends_at"].includes(key) ? row[key].slice(0, 16).replace(" ", "T") : renew && ["issued_on", "expires_on"].includes(key) ? "" : row[key] ?? empty[key]])) : { ...empty });
  }, [documents, reset]);
  useEffect(() => {
    const fields = documents ? [["Vehicle", "vehicle_number"], ["Document type", "document_type"], ["Number", "document_number"], ["Issue date", "issued_on"], ["Expiry date", "expires_on"], ["Status", "status"], ["Uploaded by", "uploaded_by"]] : [["Vehicle", "vehicle_number"], ["Service", "service_type"], ["Starts", "starts_at"], ["Expected end", "ends_at"], ["Status", "status"], ["Completed", "completed_at"]];
    const instance = new Tabulator(tableElement.current, { index: "id", layout: "fitColumns", maxHeight: "550px", placeholder: `No ${documents ? "vehicle documents" : "maintenance records"} found.`, columns: [
      ...fields.map(([title, field]) => ({ title, field, minWidth: 145, formatter: "plaintext" })),
      { title: "Actions", minWidth: documents ? 150 : 90, headerSort: false, formatter: cell => documents ? tableAction("view", "View document", "view") + (cell.getRow().getData().status === "Superseded" ? "" : tableAction("renew", "Renew document", "renew")) : tableAction(cell.getRow().getData().status === "Scheduled" ? "edit" : "view", cell.getRow().getData().status === "Scheduled" ? "Edit maintenance" : "View maintenance", ""), cellClick: (event, cell) => { const button = event.target.closest("button"); if (button) openForm(cell.getRow().getData(), button.dataset.action === "renew"); } },
    ] }); table.current = instance; instance.on("tableBuilt", loadTable);
    return () => { listRequest.current?.abort(); formRequest.current?.abort(); instance.off("tableBuilt", loadTable); instance.destroy(); table.current = null; };
  }, [documents, openForm, loadTable]);
  function showError(e) {
    if (e.response?.status === 422) {
      const all = []; Object.entries(e.response.data.errors || {}).forEach(([name, messages]) => { const message = Array.isArray(messages) ? messages[0] : String(messages); setError(name, { type: "server", message }); all.push(message); }); setFormError(all.join(" ") || "Please check the submitted values.");
    } else setFormError(e.response?.data?.message || e.message);
  }
  async function save(values) {
    if (formRequest.current || readOnly) return;
    if (documents && !file) { setError("file", { type: "required", message: "Select the document file." }); return; }
    const request = new AbortController(); formRequest.current = request; setBusy(true); setFormError(""); clearErrors();
    let payload = { ...values };
    if (documents) { payload = new FormData(); Object.keys(DOCUMENT).forEach((key) => payload.append(key, String(values[key] ?? ""))); payload.append("file", file); if (renewing) payload.append("renewal_of", String(record.id)); }
    else if (record) payload.upd_id = record.id;
    try { const { data } = await axiosClient.post(documents ? "/save_vehicle_document" : "/save_maintenance", payload, { signal: request.signal }); if (!request.signal.aborted) { setOpen(false); setSuccess(data.message); await loadTable(); } }
    catch (e) { if (!request.signal.aborted) showError(e); }
    finally { if (formRequest.current === request) formRequest.current = null; if (!request.signal.aborted) setBusy(false); }
  }
  async function changeStatus(status) {
    if (formRequest.current || !record || isDirty) return;
    const request = new AbortController(); formRequest.current = request; setBusy(true); setFormError("");
    try { const { data } = await axiosClient.post("/maintenance_status", { upd_id: record.id, status, release_status: release, release_approved: releaseApproved }, { signal: request.signal }); if (!request.signal.aborted) { setOpen(false); setSuccess(data.message); await loadTable(); } }
    catch (e) { if (!request.signal.aborted) showError(e); }
    finally { if (formRequest.current === request) formRequest.current = null; if (!request.signal.aborted) setBusy(false); }
  }
  async function loadDocument() {
    try { const { data } = await axiosClient.get(`/vehicle_documents/${record.id}`, { responseType: "blob" }); setPreview(URL.createObjectURL(data)); }
    catch { setFormError("Unable to open the private document."); }
  }
  const field = (name, label, children) => <div><label htmlFor={name} className="mb-2 block text-sm font-semibold">{label}</label>{children}<FieldError name={name} errors={errors} /></div>;
  const required = (label) => ({ required: `${label} is required.` });
  return <>
    <PageHeader title={title} sub_text={documents ? "Track expiry dates and securely retain document renewal history." : "Plan and track fleet downtime with reservation-safe availability blocks."} breadcrumbs={[{ label: "Fleet" }, { label: title }]} />
    <div className="management-page"><div className="page-container">
      {error && <div role="alert" className="form-alert mb-5">{error} <button type="button" className="underline" onClick={loadTable}>Reload</button></div>}{success && <div role="status" className="mb-5 rounded-lg border border-border bg-[var(--info-soft)] px-4 py-3 text-sm text-primary">{success}</div>}
      <button type="button" className="btn-primary management-add mb-6" disabled={busy} onClick={() => openForm()}><Plus size={16} className="mr-2" />{documents ? "Add Vehicle Document" : "Schedule Maintenance"}</button>
      <CustomDrawer open={open} setOpen={(next) => { if (!formRequest.current) setOpen(next); }} saving={busy} title={documents ? renewing ? "Renew Vehicle Document" : record ? "Vehicle Document" : "Add Vehicle Document" : record ? "Maintenance Details" : "Schedule Maintenance"} description={documents ? "Private uploads; superseded versions remain available for audit." : "Starting maintenance creates an open-ended block until staff complete the work."} submitText={readOnly ? "Close" : busy ? "Saving..." : "Save Record"} onSubmit={(event) => readOnly ? setOpen(false) : handleSubmit(save)(event)} size="max-w-3xl">
        {formError && <div role="alert" className="form-alert mb-4">{formError}</div>}
        <FormProvider {...methods}><form noValidate onSubmit={(event) => handleSubmit(save)(event)}><fieldset disabled={busy || readOnly} className="m-0 min-w-0 space-y-5 border-0 p-0"><FormSection title={documents ? "Document details" : "Maintenance schedule"}><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="vehicle_id" className="mb-2 block text-sm font-semibold">Vehicle *</label><Select2 name="vehicle_id" endpoint="/rental_package_vehicles" disabled={busy || !!record} rules={required("Vehicle")} /></div>
          {documents ? <>
            {field("document_type", "Document type *", <NativeSelect id="document_type" disabled={renewing} {...register("document_type")}>{["Insurance", "Registration", "Revenue Licence", "Emission Test", "Other"].map((value) => <option key={value} value={value}>{value}</option>)}</NativeSelect>)}
            {field("document_number", "Document number *", <Input id="document_number" maxLength={100} {...register("document_number", required("Document number"))} />)}
            {field("issued_on", "Issue date *", <Input id="issued_on" type="date" {...register("issued_on", required("Issue date"))} />)}
            {field("expires_on", "Expiry date", <Input id="expires_on" type="date" {...register("expires_on")} />)}
            {!readOnly && <div className="sm:col-span-2"><label htmlFor="fleet_document_file" className="mb-2 block text-sm font-semibold">Document file *</label><input id="fleet_document_file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => { const selected = event.target.files?.[0]; event.target.value = ""; if (!selected) return; if (selected.size > 5242880 || !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(selected.type)) { setError("file", { type: "manual", message: "Choose a PDF, JPG, PNG or WebP file up to 5 MB." }); return; } setFile(selected); clearErrors("file"); }} /><FieldError name="file" errors={errors} /><p className="mt-2 text-xs text-muted-foreground">{file?.name || "No new file selected"}</p></div>}
          </> : <>
            {field("service_type", "Service type *", <Input id="service_type" maxLength={100} {...register("service_type", required("Service type"))} />)}
            {field("starts_at", "Start date and time *", <Input id="starts_at" type="datetime-local" {...register("starts_at", required("Start date and time"))} />)}
            {field("ends_at", "Expected end date and time *", <Input id="ends_at" type="datetime-local" {...register("ends_at", required("Expected end date and time"))} />)}
            {field("notes", "Maintenance notes *", <Textarea id="notes" rows={3} maxLength={4000} {...register("notes", required("Maintenance notes"))} />)}
          </>}
        </div></FormSection></fieldset></form></FormProvider>
        {documents && record && <FormSection title="Saved document"><p className="mb-3 text-sm">{record.vehicle_number} · {record.document_type} · {record.status}</p><button type="button" className="btn-primary" onClick={() => void loadDocument()}>Load Private Document</button>{preview && <div className="mt-3 flex gap-4 text-sm text-primary"><a href={preview} target="_blank" rel="noreferrer">View document</a><a href={preview} download={`vehicle-document-${record.id}`}>Download document</a></div>}</FormSection>}
        {!documents && record && <FormSection title="Maintenance workflow"><p className="mb-3 text-sm">Current status: {record.status}</p>{isDirty && <p className="mb-3 text-sm text-destructive">Save schedule changes before changing status.</p>}
          {record.status === "Scheduled" && <div className="flex gap-3"><button type="button" className="btn-primary" disabled={busy || isDirty} onClick={() => void changeStatus("Active")}>Start Maintenance</button><button type="button" className="btn-primary" disabled={busy || isDirty} onClick={() => void changeStatus("Cancelled")}>Cancel Schedule</button></div>}
          {record.status === "Active" && <div className="space-y-3"><label htmlFor="maintenance_release" className="block text-sm font-semibold">Status after maintenance</label><NativeSelect id="maintenance_release" value={release} onChange={(event) => setRelease(event.target.value)}>{["Inspection Required", "Cleaning", "Available", "Out of Service"].map((value) => <option key={value} value={value}>{value}</option>)}</NativeSelect><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={releaseApproved} onChange={(event) => setReleaseApproved(event.target.checked)} />I inspected and approve releasing this vehicle if Available is selected.</label><button type="button" className="btn-primary" disabled={busy} onClick={() => void changeStatus("Completed")}>Complete Maintenance</button></div>}
        </FormSection>}
      </CustomDrawer>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"><div className="border-b px-6 py-5"><h2 className="text-base font-semibold">{title} Register</h2></div><div id="fleet-operations-tb" className="relative p-6" aria-busy={loading}><NativeSelect aria-label="Fleet record status filter" defaultValue="" onChange={(event) => { listStatus.current = event.target.value; void loadTable(); }}><option value="">{documents ? "All current document versions" : "All maintenance statuses"}</option>{(documents ? ["Current", "Expired", "Expiring", "Superseded"] : ["Scheduled", "Active", "Completed", "Cancelled"]).map((value) => <option key={value} value={value}>{value}</option>)}</NativeSelect><TableSearch table={table} /><div ref={tableElement} className="overflow-hidden rounded-xl border border-border" /></div></div>
    </div></div><CarLoader targetId="fleet-operations-tb" show={loading} text={`Loading ${title}`} />
  </>;
}
