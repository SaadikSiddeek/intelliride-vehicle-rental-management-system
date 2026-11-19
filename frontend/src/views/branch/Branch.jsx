import { useCallback, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Input, Textarea } from "@/components/ui/input";
import FieldError from "@/components/ErrorField";
import FormSection from "@/components/forms/FormSection";
import PageHeader from "@/components/PageHeader";
import usePermissions from "@/hooks/usePermissions";
import axiosClient from "@/axios-client";

const fields = [["branch_name", "Branch Name", 100, true], ["branch_code", "Branch Code", 50, true], ["contact_number", "Contact Number", 20], ["manager_name", "Manager Name", 200]];
export default function Branch() {
  const methods = useForm({ defaultValues: { status: true } });
  const { register, reset, handleSubmit, setError, formState: { errors, isSubmitting } } = methods;
  const { can } = usePermissions();
  const [record, setRecord] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setPageError] = useState("");
  const load = useCallback(async () => {
    try {
      const { data } = await axiosClient.post("/get_branches");
      const row = data.data?.[0];
      if (!row) throw new Error("Branch initialization is required. Contact the installation owner.");
      setRecord(row);
      reset({ ...row, status: Boolean(Number(row.status)) });
    } catch (failure) { setPageError(failure.response?.data?.message || failure.message); }
  }, [reset]);
  useEffect(() => {
    const request = new AbortController();
    axiosClient.post("/get_branches", {}, { signal: request.signal }).then(({ data }) => {
      if (request.signal.aborted) return;
      const row = data.data?.[0];
      if (!row) throw new Error("Branch initialization is required. Contact the installation owner.");
      setRecord(row); reset({ ...row, status: Boolean(Number(row.status)) });
    }).catch(failure => { if (!request.signal.aborted) setPageError(failure.response?.data?.message || failure.message); });
    return () => request.abort();
  }, [reset]);
  const save = async values => {
    setPageError(""); setMessage("");
    try {
      await axiosClient.post("/save_branch", { ...values, upd_id: record.id });
      await load(); setMessage("Branch Settings updated.");
    } catch (failure) {
      Object.entries(failure.response?.data?.errors || {}).forEach(([key, messages]) => setError(key, { message: messages[0] }));
      setPageError(failure.response?.data?.message || "Unable to update Branch Settings.");
    }
  };
  return <><PageHeader title="Branch Settings" sub_text="One branch per installation. Historical branch references are preserved." />
    <div className="intro-y box mt-6 p-6">
      {error && <p role="alert" className="mb-4 text-danger">{error}</p>}
      {message && <p role="status" className="mb-4 text-success">{message}</p>}
      {record && <FormProvider {...methods}><form onSubmit={handleSubmit(save)}>
        <FormSection title="Installation branch" description="Update the branch details used by this installation.">
          <fieldset disabled={isSubmitting || !can("branches.edit")} className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {fields.map(([name, label, maxLength, required]) => <div key={name}><label htmlFor={name} className="mb-2 block text-sm font-semibold">{label}{required ? " *" : ""}</label><Input id={name} maxLength={maxLength} {...register(name, { required: required ? `${label} is required.` : false, maxLength })}/><FieldError errors={errors} name={name} /></div>)}
            <div className="md:col-span-2"><label htmlFor="address" className="mb-2 block text-sm font-semibold">Address</label><Textarea id="address" {...register("address", { maxLength: 5000 })}/><FieldError errors={errors} name="address"/></div>
            <label className="flex items-center gap-2"><input type="checkbox" {...register("status")}/>Active</label>
          </fieldset>
        </FormSection>
        {can("branches.edit") && <button className="btn btn-primary mt-6" disabled={isSubmitting} type="submit">{isSubmitting ? "Updating…" : "Update"}</button>}
      </form></FormProvider>}
    </div></>;
}
