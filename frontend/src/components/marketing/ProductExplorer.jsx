import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { LayoutDashboard, CarFront, Palette, ArrowUpRight, Compass, PanelLeft } from "lucide-react";
const Overview = lazy(() => import("../../views/Dashboard"));
const Vehicles = lazy(() => import("../../views/registerVehicle/RegisterVehicle"));
const Appearance = lazy(() => import("../../views/Settings"));
const tabs = [
  { id: "overview", title: "Overview", icon: LayoutDashboard, component: Overview, caption: "The actual IntelliRide dashboard, using the original sample records." },
  { id: "vehicles", title: "Vehicle register", icon: CarFront, component: Vehicles, caption: "Explore the actual vehicle registration screen. Records are illustrative and are not saved." },
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
    <div className="explorer-caption"><Compass size={16}/><p aria-live="polite">{current.caption}</p><span>Actual product components</span></div>
  </div>;
}
