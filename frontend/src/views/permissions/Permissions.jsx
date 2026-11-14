import { useEffect, useMemo, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { ChevronDown, LockKeyhole, RotateCcw, Save, Search, ShieldCheck } from "lucide-react";
import { Link, useBlocker } from "react-router-dom";
import axiosClient from "@/axios-client";
import PageHeader from "@/components/PageHeader";
import Select2 from "@/components/Select2";
import FormSection from "@/components/forms/FormSection";
import { Input, NativeSelect } from "@/components/ui/input";
import usePermissions from "@/hooks/usePermissions";

const EMPTY = { kind: "user", target_id: "", allow: [], deny: [], access: [], delegable: [], reason: "" };
const stateOf = values => JSON.stringify([values.allow || [], values.deny || [], values.access || [], values.delegable || []]);
const management = ["users.view", "users.create", "users.edit", "users.deactivate", "roles.manage", "permissions.assign", "authorization_audit.view", "company_settings.view", "company_settings.update"];

export default function Permissions() {
  const { isSuperAdmin } = usePermissions();
  const methods = useForm({ defaultValues: EMPTY });
  const { register, reset, setValue, getValues, handleSubmit } = methods;
  const values = useWatch({ control: methods.control });
  const [catalog, setCatalog] = useState([]), [scope, setScope] = useState([]);
  const [target, setTarget] = useState(null), [saved, setSaved] = useState(null);
  const [query, setQuery] = useState(""), [collapsed, setCollapsed] = useState({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [audit, setAudit] = useState(null);
  const [setup, setSetup] = useState([]);
  const dirty = saved !== null && stateOf(values) !== stateOf(saved);
  const blocker = useBlocker(dirty);
  useEffect(() => {
    const request = new AbortController();
    axiosClient.post("/permission_catalog", {}, { signal: request.signal }).then(({ data }) => { setCatalog(data.data.permissions); setScope(data.data.delegable); }).catch(e => { if (!request.signal.aborted) setError(e.response?.data?.message || "Unable to load permission definitions."); });
    return () => request.abort();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (!isSuperAdmin) return;
    const request = new AbortController();
    axiosClient.post('/authorization_setup', {}, {signal: request.signal}).then(({data}) => { if (!request.signal.aborted) setSetup(data.data); }).catch(e => { if (!request.signal.aborted) setError(e.response?.data?.message || 'Unable to load setup checklist.'); });
    return () => request.abort();
  }, [isSuperAdmin]);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Discard unsaved permission changes?')) blocker.proceed(); else blocker.reset();
  }, [blocker]);
  const groups = useMemo(() => Object.groupBy(catalog.filter(p => `${p.module_name} ${p.action_name} ${p.group_name}`.toLowerCase().includes(query.toLowerCase())), p => p.group_name), [catalog, query]);
  const editable = p => Boolean(target && target.user_type !== "super_admin" && scope.includes(p.code) && (target.kind === "role" || target.user_type === "admin" || !management.includes(p.code)));
  const toggle = (field, code, checked) => {
    const next = new Set(getValues(field));
    if (checked) next.add(code); else next.delete(code);
    setValue(field, [...next], { shouldDirty: true });
    if ((field === "allow" || field === "deny") && checked) {
      const opposite = field === "allow" ? "deny" : "allow";
      setValue(opposite, getValues(opposite).filter(value => value !== code), { shouldDirty: true });
    }
    if (field === "access" && !checked) setValue("delegable", getValues("delegable").filter(value => value !== code), { shouldDirty: true });
  };
  const loadTarget = async () => {
    if (!getValues("target_id")) { setError("Select an account or role template first."); return; }
    if (dirty && !window.confirm("Discard unsaved permission changes?")) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const kind = getValues("kind"), id = getValues("target_id");
      const { data } = await axiosClient.post("/permission_target", { kind, id });
      const next = { ...EMPTY, kind, target_id: id, ...Object.fromEntries(["allow", "deny", "access", "delegable"].map(key => [key, data.data[key] || []])) };
      setTarget({ ...data.data, kind, id }); reset(next); setSaved(next);
    } catch (e) { setError(e.response?.data?.message || "Unable to load this permission assignment."); }
    finally { setBusy(false); }
  };
  const save = async fields => {
    if (!target) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      const payload = { kind: target.kind, id: target.id, reason: fields.reason };
      for (const key of ["allow", "deny", "access", "delegable"]) payload[key] = fields[key].filter(code => isSuperAdmin || scope.includes(code));
      await axiosClient.post("/save_permissions", payload);
      setSaved(fields); setSuccess("Permissions saved. The server applies the new access on subsequent requests.");
      try {
        const { data } = await axiosClient.post('/permission_target', {kind: target.kind, id: target.id});
        setTarget(previous => ({...previous, ...data.data}));
      } catch { setError('Permissions were saved, but current access could not be refreshed. Reload the assignment.'); }
    } catch (e) { setError(Object.values(e.response?.data?.errors || {}).flat().join(" ") || e.response?.data?.message || "Unable to save permissions."); }
    finally { setBusy(false); }
  };
  const loadAudit = async (page = 1) => {
    try { const {data} = await axiosClient.post('/authorization_audit', {}, {params: {page}}); setAudit(data.data); }
    catch { setError('Unable to load authorization history.'); }
  };
  return <div>
    <PageHeader title="Roles & permissions" sub_text="Control access by business role and employee. Restrictions always take priority." breadcrumbs={[{ label: "Administration" }, { label: "Permissions" }]} />
    {isSuperAdmin && <div role="status" className="mb-6 rounded-xl border border-border bg-card p-5"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} />Full System Access — Super Admin</h2><p className="mt-2 text-sm text-muted-foreground">Your active account automatically receives every registered application permission, including future additions. No individual permission assignment is needed. Use this screen to manage other accounts and role templates.</p></div>}
    {setup.some(step => !step.complete) && <section className="mb-6 rounded-xl border border-border bg-card p-5"><h2 className="mb-3 font-semibold">Installation checklist</h2><div className="flex flex-wrap gap-3">{setup.map(step => <Link key={step.label} to={step.path} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"><ShieldCheck size={15} className={step.complete ? 'text-primary' : 'text-muted-foreground'} />{step.label}<span className="text-xs text-muted-foreground">{step.complete ? 'Complete' : 'To review'}</span></Link>)}</div><p className="mt-3 text-xs text-muted-foreground">Checklist items guide setup and do not block authorized work. Employee linking uses the private installation console.</p></section>}
    <FormProvider {...methods}><form onSubmit={handleSubmit(save)} className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <FormSection title="Choose an assignment" description="Role templates provide defaults. Each account can inherit, allow or explicitly deny an action.">
          <div className="grid min-w-0 gap-4 sm:grid-cols-[160px_minmax(0,1fr)_auto]">
            <div><label className="mb-2 block text-sm font-semibold" htmlFor="permission_kind">Assignment</label><NativeSelect id="permission_kind" {...register("kind")} onChange={event => { setValue("kind", event.target.value); setValue("target_id", null); }} disabled={busy}><option value="user">User account</option>{isSuperAdmin && <option value="role">Role template</option>}</NativeSelect></div>
            <div className="min-w-0"><label className="mb-2 block text-sm font-semibold" htmlFor="target_id">{values.kind === "role" ? "Role template" : "User account"}</label><Select2 key={values.kind} name="target_id" endpoint={`/permission_targets?kind=${values.kind}`} placeholder="Search by name" disabled={busy} /></div>
            <button type="button" className="btn-primary self-end" disabled={busy} onClick={() => void loadTarget()}>Load permissions</button>
          </div>
        </FormSection>
      </div>
      {error && <div role="alert" className="form-alert p-4">{error}</div>}
      {success && <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm">{success}</p>}
      {!target && <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground"><ShieldCheck className="mx-auto mb-3" /><p>Select an account or role to inspect its access.</p></div>}
      {target && <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-busy={busy}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-5"><div><h2 className="text-lg font-semibold">{target.name}</h2><p className="text-sm text-muted-foreground">{target.kind === "role" ? "Reusable business permission template" : `${target.user_type.replaceAll("_", " ")} · account-specific access`}</p></div>{target.user_type !== "super_admin" && <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" onClick={() => setCollapsed(Object.fromEntries(Object.keys(groups).map(g => [g, false])))}>Expand all</button><button type="button" className="btn-secondary" onClick={() => setCollapsed(Object.fromEntries(Object.keys(groups).map(g => [g, true])))}>Collapse all</button></div>}</div>
        {target.user_type === "super_admin" ? <div className="p-5"><h3 className="font-semibold">Full System Access — Super Admin</h3><p className="mt-2 text-sm text-muted-foreground">All registered permissions are automatic. This account has no editable permission overrides.</p></div> : <>
        <div className="p-5"><label className="mb-2 flex items-center gap-2 text-sm font-semibold" htmlFor="permission_search"><Search size={15} />Search permissions</label><Input id="permission_search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a module or action…" /><p className="mt-3 text-sm text-muted-foreground">Saved access is the current server result; unsaved changes take effect after saving. Inherited access comes from the role. Deny overrides allow. Locked actions are outside your delegated scope. An Admin needs both a grant and an access ceiling.</p></div>
        {Object.entries(groups).map(([group, rows]) => <section key={group} className="border-t border-border">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-5 py-3"><button type="button" className="flex items-center gap-2 text-sm font-semibold" aria-expanded={!collapsed[group]} onClick={() => setCollapsed(previous => ({ ...previous, [group]: !previous[group] }))}><ChevronDown size={16} className={collapsed[group] ? "-rotate-90" : ""} />{group}<span className="text-xs font-normal text-muted-foreground">{rows.length} actions</span></button><button type="button" className="text-xs font-semibold text-primary" disabled={busy || target.user_type === "super_admin"} onClick={() => rows.filter(editable).forEach(p => toggle("allow", p.code, true))}>Allow applicable actions</button></div>
          {!collapsed[group] && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="px-5 py-3">Module / action</th>{target.kind === "user" && <th className="px-3 py-3">Inherited / saved access</th>}<th className="px-3 py-3">Allow</th>{target.kind === "user" && <th className="px-3 py-3">Deny</th>}{target.user_type === "admin" && isSuperAdmin && <><th className="px-3 py-3">Access ceiling</th><th className="px-3 py-3">May delegate</th></>}</tr></thead><tbody>{rows.map(p => { const locked = !editable(p); return <tr key={p.code} className="border-t border-border/60 hover:bg-muted/30"><td className="px-5 py-3"><span className="flex items-center gap-2 font-medium">{locked && <LockKeyhole size={13} className="text-muted-foreground" />}{p.module_name}</span><span className="text-xs text-muted-foreground">{p.action_name}</span></td>{target.kind === "user" && <td className="px-3 py-3 text-xs text-muted-foreground">{target.inherited?.includes(p.code) ? "Role grant" : "—"}<span className="mt-1 block">{target.effective?.includes(p.code) ? "Allowed" : "Denied"}</span></td>}{["allow", ...(target.kind === "user" ? ["deny"] : []), ...(target.user_type === "admin" && isSuperAdmin ? ["access", "delegable"] : [])].map(field => <td key={field} className="px-3 py-3"><input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" aria-label={`${p.module_name} ${p.action_name}: ${field}`} checked={values[field]?.includes(p.code) || false} disabled={busy || locked || (field === "delegable" && !values.access?.includes(p.code))} onChange={e => toggle(field, p.code, e.target.checked)} /></td>)}</tr>; })}</tbody></table></div>}
        </section>)}
        {!Object.keys(groups).length && <p className="p-8 text-center text-muted-foreground">No matching permissions.</p>}
        </>}
        {target.user_type !== "super_admin" && <div className="space-y-4 border-t border-border p-5"><div><label htmlFor="permission_reason" className="mb-2 block text-sm font-semibold">Reason for this change *</label><Input id="permission_reason" maxLength={500} {...register("reason", { required: "Enter a reason for the audit trail." })} aria-invalid={!!methods.formState.errors.reason} /><p className="mt-1 text-xs text-destructive">{methods.formState.errors.reason?.message}</p></div><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">{dirty ? "Unsaved changes" : "No unsaved permission changes"}</span><div className="flex gap-3"><button type="button" className="btn-secondary flex items-center gap-2" disabled={busy} onClick={() => reset(saved)}><RotateCcw size={15} />Reset</button><button type="submit" className="btn-primary flex items-center gap-2" disabled={busy || !dirty}><Save size={15} />{busy ? "Saving…" : "Save permissions"}</button></div></div></div>}
      </section>}
    </form></FormProvider>
    {isSuperAdmin && <section className="mt-6 rounded-xl border border-border bg-card p-5"><button type="button" className="btn-secondary" onClick={() => void loadAudit()}>View authorization audit history</button>{audit && <><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["When", "Actor", "Target", "Action", "Reason", "Changes"].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{audit.data.map(row => <tr key={row.ID} className="border-t border-border"><td className="p-2">{row.created_at}</td><td className="p-2">{row.actor_user_id ?? "Installation console"}</td><td className="p-2">{row.target_user_id ?? "Role template"}</td><td className="p-2">{row.action.replaceAll("_", " ")}</td><td className="p-2">{row.reason}</td><td className="p-2"><details><summary className="cursor-pointer text-primary">View changes</summary><pre className="mt-2 max-w-lg whitespace-pre-wrap break-words rounded-lg bg-muted p-3 text-xs">{JSON.stringify({before: JSON.parse(row.before_state), after: JSON.parse(row.after_state)}, null, 2)}</pre></details></td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-muted-foreground">Page {audit.current_page} of {audit.last_page} · {audit.total} events. Audit records cannot be edited here.</p><div className="mt-3 flex gap-3"><button className="btn-secondary" type="button" disabled={audit.current_page <= 1} onClick={() => void loadAudit(audit.current_page - 1)}>Previous</button><button className="btn-secondary" type="button" disabled={audit.current_page >= audit.last_page} onClick={() => void loadAudit(audit.current_page + 1)}>Next</button></div></>}</section>}
  </div>;
}
