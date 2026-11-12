import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function Signup() {
  return <div className="space-y-6">
    <div className="auth-form-heading">
      <span className="eyebrow">INTELLIRIDE WORKSPACE</span>
      <h1>Request workspace access.</h1>
      <p>Accounts are created by your organization administrator.</p>
    </div>
    <section className="rounded-xl border border-border bg-muted/30 p-5" aria-label="Account access information">
      <ShieldCheck size={24} className="mb-3 text-primary"/>
      <h2 className="font-semibold">Managed access for your team</h2>
      <p className="mt-2 text-sm text-muted-foreground">Contact your administrator to arrange the permissions you need. Public registration is unavailable.</p>
    </section>
    <Link to="/login" className="btn-primary inline-flex">Sign in with an existing account</Link>
  </div>;
}
