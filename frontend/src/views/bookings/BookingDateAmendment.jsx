import { formatMoney as money } from "@/lib/display-values.mjs";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import axiosClient from "@/axios-client";
import CustomDrawer from "@/components/Drawer";
import FormSection from "@/components/forms/FormSection";
import { Input, Textarea } from "@/components/ui/input";

export default function BookingDateAmendment({ bookingId, onClose, onSaved }) {
  const methods = useForm();
  const {register, reset, handleSubmit, formState: {errors}} = methods;
  const [record, setRecord] = useState(null), [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const request = useRef(false), quoted = useRef("");
  useEffect(() => {
    const abort = new AbortController();
    axiosClient.post("/fetch_booking_data", {upd_id:bookingId}, {signal:abort.signal}).then(({data}) => {
      if (abort.signal.aborted) return;
      setRecord(data.data);
      reset({pickup_at:data.data.pickup_at.slice(0,16).replace(" ","T"), expected_return_at:data.data.expected_return_at.slice(0,16).replace(" ","T"), reason:""});
    }).catch(e => {if (!abort.signal.aborted) setError(e.response?.data?.message || "Unable to load booking.");});
    return () => abort.abort();
  }, [bookingId, reset]);
  async function save(values, preview) {
    if (request.current || !record) return;
    if (!preview && quoted.current !== JSON.stringify(values)) {setError("Preview the updated charges before saving.");return;}
    request.current = true; setBusy(true); setError("");
    try {
      const {data} = await axiosClient.post("/amend_booking_dates", {...values, upd_id:bookingId, original_pickup_at:record.pickup_at, original_expected_return_at:record.expected_return_at, preview});
      if (!data.status) throw new Error(data.message);
      if (preview) {setQuote(data.data);quoted.current=JSON.stringify(values);} else onSaved(data.message);
    } catch(e) {setError(Object.values(e.response?.data?.errors || {}).flat().join(" ") || e.response?.data?.message || e.message);}
    finally {request.current=false;setBusy(false);}
  }
  return <CustomDrawer open setOpen={value => {if (!value && !request.current) onClose();}} title="Amend confirmed booking dates" description="Asia/Colombo · same vehicle, customer and agreed pricing terms" saving={busy} submitDisabled={!record || !quote} submitText="Save date amendment" onSubmit={event=>handleSubmit(v=>save(v,false))(event)}>
    {error && <p role="alert" className="form-alert mb-4">{error}</p>}
    <FormProvider {...methods}><form onSubmit={event=>event.preventDefault()} onChange={()=>setQuote(null)}>
      <FormSection title="Reservation period"><p className="mb-4 text-sm text-muted-foreground">Only confirmed bookings that have not been handed over can be amended. Availability is rechecked on save. Older bookings without minimum-unit snapshots support date shifts of unchanged duration only.</p>
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
      <div><label htmlFor="amend-pickup" className="mb-2 block text-sm font-semibold">Pickup date and time *</label><Input id="amend-pickup" type="datetime-local" disabled={busy} {...register("pickup_at",{required:"Pickup is required."})} error={errors.pickup_at?.message}/></div>
      <div><label htmlFor="amend-return" className="mb-2 block text-sm font-semibold">Expected return *</label><Input id="amend-return" type="datetime-local" disabled={busy} {...register("expected_return_at",{required:"Return is required.",validate:value=>value>methods.getValues("pickup_at") || "Return must be after pickup."})} error={errors.expected_return_at?.message}/></div>
      </div><label htmlFor="amend-reason" className="mb-2 mt-4 block text-sm font-semibold">Reason for correction *</label><Textarea id="amend-reason" disabled={busy} {...register("reason",{required:"A reason is required.",minLength:{value:5,message:"Enter at least five characters."},maxLength:500})} error={errors.reason?.message}/>
      <button type="button" className="btn-primary mt-4" disabled={busy || !record} onClick={event=>handleSubmit(v=>save(v,true))(event)}>Preview updated charges</button>
      {quote && <dl className="mt-4 rounded-lg bg-secondary p-4 text-sm"><dt>Rental units</dt><dd>{quote.units} {quote.billing_unit}</dd><dt>Included kilometres</dt><dd>{quote.included_km ?? "Unlimited"}</dd><dt>Previous total</dt><dd>{money(record.total)}</dd><dt>Updated total</dt><dd className="font-semibold">{money(quote.total)}</dd><p className="mt-2">Deposit remains separate. Recorded payments are retained.</p></dl>}
      </FormSection></form></FormProvider>
  </CustomDrawer>;
}
