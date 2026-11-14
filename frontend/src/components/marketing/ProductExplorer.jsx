import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LayoutDashboard, CarFront, Palette, ArrowUpRight, Compass, PanelLeft } from "lucide-react";
function Overview() { return <div className="space-y-5 p-6"><span className="eyebrow">OPERATIONS OVERVIEW</span><h2 className="text-2xl font-semibold">Your business, in motion.</h2><p className="text-sm text-muted-foreground">Sign in with an authorized account to see your live operational and financial data.</p><div className="grid gap-4 sm:grid-cols-2">{["Active rentals", "Available vehicles", "Upcoming returns", "Revenue & collections"].map(label => <div key={label} className="rounded-xl border border-border bg-card p-5"><LayoutDashboard className="mb-3 text-primary" size={19}/><h3 className="font-semibold">{label}</h3><p className="mt-2 text-sm text-muted-foreground">Available in your authorized workspace</p></div>)}</div></div>; }
function Vehicles() { return <div className="space-y-5 p-6"><span className="eyebrow">VEHICLE REGISTER</span><h2 className="text-2xl font-semibold">A place for every vehicle.</h2><p className="text-sm text-muted-foreground">Keep vehicle identity, specifications, rates and operational status together in your authorized workspace.</p><div className="overflow-x-auto rounded-xl border border-border bg-card"><table className="w-full text-left text-sm"><thead><tr>{["Registration", "Vehicle", "Branch", "Status"].map(label => <th className="p-4" key={label}>{label}</th>)}</tr></thead><tbody><tr><td colSpan={4} className="border-t border-border p-8 text-center text-muted-foreground">Your records appear after sign-in. This preview does not load or save business data.</td></tr></tbody></table></div></div>; }
const Appearance = lazy(() => import("../../views/Settings"));
const tabs = [
  { id: "overview", title: "Overview", icon: LayoutDashboard, component: Overview, caption: "A preview of the operational workspace. Live records are available only after authorized sign-in." },
  { id: "vehicles", title: "Vehicle register", icon: CarFront, component: Vehicles, caption: "Preview vehicle organization without loading or saving business records." },
  { id: "appearance", title: "Appearance", icon: Palette, component: Appearance, caption: "Try real appearance controls. Your choices apply immediately and save in this browser." },
];
export default function ProductExplorer({ onTour }) {
  const [selected, setSelected] = useState("overview");
  const [ready, setReady] = useState(false);
  const container = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); }
    }, { rootMargin: "200px" });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const current = tabs.find(tab => tab.id === selected);
  const Preview = current.component;
  return <div className="product-explorer" ref={container}>
    <div className="explorer-toolbar"><div role="group" aria-label="Product preview screens">{tabs.map(({id,title,icon:Icon}) => <button key={id} aria-pressed={selected === id} onClick={() => setSelected(id)}><Icon size={15}/>{title}</button>)}</div><button className="explorer-tour" onClick={onTour}>Guided tour <ArrowUpRight size={15}/></button></div>
    <div className="product-frame"><aside className="product-frame-rail" aria-hidden="true"><PanelLeft size={17}/>{tabs.map(({id,title,icon:Icon}) => <div key={id} className={selected === id ? "active" : ""}><Icon size={16}/>{title}</div>)}<small>INTERACTIVE PREVIEW</small></aside><div className="product-frame-main"><div className="preview-window-bar"><span>IntelliRide <span>/ {current.title}</span></span><span className="preview-mode-label">Sample workspace</span></div><div className="product-demo" role="region" aria-label={current.title + " interactive preview"} tabIndex={0}>{ready ? <Suspense fallback={<div className="preview-loading" role="status">Opening preview…</div>}><Preview/></Suspense> : <div className="preview-loading">Explore the actual IntelliRide interface.</div>}</div></div></div>
    <div className="explorer-caption"><Compass size={16}/><p aria-live="polite">{current.caption}</p><span>Workspace preview</span></div>
  </div>;
}
