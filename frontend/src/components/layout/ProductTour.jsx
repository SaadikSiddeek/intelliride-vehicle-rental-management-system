import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "@base-ui/react/dialog";
import { Building2, Users, Tags, CarFront, Palette, X, ArrowLeft, ArrowRight } from "lucide-react";
const steps = [
  { icon: Building2, title: "Start with your organization", description: "Departments and designations organize your team. The branch directory in this version contains sample records.", route: "/department-management/manage", action: "Open departments", label: "01 / ORGANIZATION" },
  { icon: Users, title: "Bring your people together", description: "Manage user accounts and staff details with the existing create and edit forms. Server validation appears beside the relevant field.", route: "/user-management/manage", action: "Open user management", label: "02 / PEOPLE" },
  { icon: Tags, title: "Give every vehicle a place", description: "Explore brands, models, fuel types and transmissions. These reference screens currently demonstrate the interface using sample records.", route: "/vehicle-brand-management/manage", action: "Explore vehicle brands", label: "03 / REFERENCE DATA" },
  { icon: CarFront, title: "Know your vehicle details", description: "The vehicle registration preview groups identity, specifications, rates and compliance dates. Saving vehicles is not connected to an API in this version.", route: "/register-vehicle-management/manage", action: "Explore vehicle register", label: "04 / VEHICLE REGISTER" },
  { icon: Palette, title: "Make the workspace comfortable", description: "Choose a light and dark preset, adjust table density, and set your preferred sidebar. Appearance settings save automatically in this browser.", route: "/settings", action: "Personalize workspace", label: "05 / YOUR WORKSPACE" },
];
export default function ProductTour({ open, onOpenChange, publicView = false }) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const Icon = current.icon;
  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal><Dialog.Backdrop className="dialog-backdrop"/><Dialog.Popup className="product-tour">
      <Dialog.Close className="tour-close" aria-label="Skip product tour"><X size={19}/></Dialog.Close>
      <span className="tour-icon"><Icon size={30}/></span><span className="eyebrow">{current.label}</span>
      <Dialog.Title>{current.title}</Dialog.Title><Dialog.Description>{current.description}</Dialog.Description>
      <div className="tour-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>{steps.map((item, index) => <button key={item.label} aria-label={`Go to step ${index + 1}`} aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)}/>)}</div>
      <Link to={publicView ? "/login" : current.route} className="tour-route" onClick={() => onOpenChange(false)}>{publicView ? "Sign in to explore this workspace" : current.action}<ArrowRight size={15}/></Link>
      <footer><button onClick={() => {setStep(0);onOpenChange(false);}}>Skip tour</button><div><button className="btn-secondary" onClick={() => setStep(step - 1)} disabled={step === 0} aria-label="Previous tour step"><ArrowLeft size={16}/></button><button className="btn-primary" onClick={() => {if (step < steps.length - 1) setStep(step + 1); else {setStep(0);onOpenChange(false);}}}>{step === steps.length - 1 ? "Finish tour" : "Next"}<ArrowRight size={16}/></button></div></footer>
    </Dialog.Popup></Dialog.Portal>
  </Dialog.Root>;
}
