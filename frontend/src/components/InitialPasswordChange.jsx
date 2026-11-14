import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { LockKeyhole } from "lucide-react";
import axiosClient from "@/axios-client";
import { useStateContext } from "@/contexts/ContextProvider";
import FormSection from "@/components/forms/FormSection";
import { Input } from "@/components/ui/input";

export default function InitialPasswordChange({ onLogout }) {
  const { setUser } = useStateContext();
  const methods = useForm({ defaultValues: { current_password: "", password: "", password_confirmation: "" } });
  const { register, handleSubmit, setError, reset, formState: { errors, isSubmitting } } = methods;
  const [failure, setFailure] = useState("");
  const save = async fields => {
    setFailure("");
    try {
      const { data } = await axiosClient.post("/auth/password", fields);
      reset();
      setUser(data.user);
    } catch (error) {
      const validation = error.response?.data?.errors;
      if (validation) Object.entries(validation).forEach(([key, messages]) => setError(key, { message: messages[0] }));
      else setFailure(error.response?.data?.message || "Unable to change the installation password. Try again.");
    }
  };
  return <main className="mx-auto flex min-h-screen w-full max-w-xl items-center p-5">
    <FormProvider {...methods}><form onSubmit={handleSubmit(save)} className="w-full rounded-xl border border-border bg-card p-6 shadow-sm">
      <LockKeyhole className="mb-4 text-primary" size={24} />
      <h1 className="text-xl font-semibold">Secure your installation</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">Change the setup password before opening your workspace. Your new password must be different and contain at least 12 characters.</p>
      <FormSection title="First-login password change">
        {failure && <p role="alert" className="form-alert mb-4 p-3">{failure}</p>}
        <div className="space-y-4">{[["current_password", "Current setup password", "current-password"], ["password", "New password", "new-password"], ["password_confirmation", "Confirm new password", "new-password"]].map(([name, label, autoComplete]) => <div key={name}>
          <label htmlFor={name} className="mb-2 block text-sm font-semibold">{label} *</label>
          <Input id={name} type="password" autoComplete={autoComplete} disabled={isSubmitting} error={errors[name]?.message} {...register(name, { required: `${label} is required.`, ...(name === "password" ? { minLength: { value: 12, message: "Use at least 12 characters." } } : {}) })} />
        </div>)}</div>
      </FormSection>
      <div className="mt-6 flex flex-wrap gap-3"><button className="btn-primary" disabled={isSubmitting} type="submit">{isSubmitting ? "Saving…" : "Change password"}</button><button type="button" className="btn-secondary" disabled={isSubmitting} onClick={onLogout}>Sign out</button></div>
    </form></FormProvider>
  </main>;
}
