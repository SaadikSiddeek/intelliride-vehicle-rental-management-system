import { useState } from "react";
import { Pause, Play, Route } from "lucide-react";

export default function DrivingScene({ compact = false }) {
  const [paused, setPaused] = useState(false);
  return <div className={`driving-scene ${paused ? "scene-paused" : ""} ${compact ? "scene-compact" : ""}`}>
    <div className="scene-caption"><Route size={15} /><span>A clearer road ahead.</span></div>
    <div className="scene-landscape" aria-hidden="true"><div className="scene-ridge ridge-far"/><div className="scene-ridge ridge-near"/><div className="scene-horizon"/></div>
    <div className="scene-road" aria-hidden="true"><div className="road-edge"/><div className="road-markings"/><div className="road-foreground"/></div>
    <img className="scene-car" src="/touring-sedan.webp" alt="Silver touring sedan travelling along a coastal road" width="1600" height="666" fetchPriority={compact ? "auto" : "high"} />
    <div className="scene-bottom"><span>DESIGNED TO KEEP YOU MOVING</span><button type="button" onClick={() => setPaused(value => !value)} aria-label={paused ? "Play driving animation" : "Pause driving animation"} aria-pressed={paused}>{paused ? <Play size={14}/> : <Pause size={14}/>}</button></div>
  </div>;
}
