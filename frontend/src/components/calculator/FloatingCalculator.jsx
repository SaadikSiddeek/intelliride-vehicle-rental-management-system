import { useEffect, useReducer, useRef, useState } from "react";
import { Calculator, GripHorizontal, X } from "lucide-react";
import { calculatorReducer, initialCalculator } from "./calculator-engine.mjs";
import "./calculator.css";
const keys = ["AC", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "⌫", "0", ".", "="];
const bounds = (p) => ({ x: Math.max(8, Math.min(p.x, window.innerWidth - Math.min(288, window.innerWidth - 16) - 8)), y: Math.max(8, Math.min(p.y, window.innerHeight - Math.min(480, window.innerHeight - 16) - 8)) });
const saved = () => { try { return JSON.parse(localStorage.getItem("intelliride.calculator") || "null") || {}; } catch { return {}; } };
export default function FloatingCalculator() {
  const [open, setOpen] = useState(() => !!saved().open);
  const [position, setPosition] = useState(() => bounds((Number.isFinite(saved().position?.x) && Number.isFinite(saved().position?.y) ? saved().position : null) || { x: window.innerWidth - 312, y: window.innerHeight - 500 }));
  const [state, dispatch] = useReducer(calculatorReducer, undefined, initialCalculator);
  const drag = useRef(null);
  const panel = useRef(null);
  useEffect(() => { try { localStorage.setItem("intelliride.calculator", JSON.stringify({ open, position })); } catch { /* Storage may be disabled. */ } }, [open, position]);
  useEffect(() => { const resize = () => setPosition(p => bounds(p)); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize); }, []);
  const keyboard = (e) => { const key = ({ Enter: "=", Escape: "close", Backspace: "⌫", Delete: "AC", "-": "−", "*": "×", "/": "÷" })[e.key] || e.key; if (key === "close") { e.preventDefault(); setOpen(false); } else if (keys.includes(key)) { e.preventDefault(); e.stopPropagation(); dispatch(key); } };
  return <><button className="calculator-launcher" type="button" aria-label={open ? "Close calculator" : "Open calculator"} aria-expanded={open} onClick={() => setOpen(!open)}><Calculator size={23} /></button>
    {open && <section ref={panel} role="dialog" aria-modal="false" aria-label="Floating calculator" tabIndex={-1} className="floating-calculator" style={{ left: position.x, top: position.y }} onKeyDown={keyboard}>
      <div className="calculator-drag" onPointerDown={e => { if (e.target.closest("button")) return; drag.current = { x: e.clientX - position.x, y: e.clientY - position.y }; e.currentTarget.setPointerCapture(e.pointerId); panel.current?.focus(); }} onPointerMove={e => { if (drag.current) setPosition(bounds({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y })); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}><span><GripHorizontal size={16} /> Calculator</span><button type="button" aria-label="Close calculator panel" onClick={() => setOpen(false)}><X size={17} /></button></div>
      <div className="calculator-expression">{state.stored != null ? `${state.stored} ${state.operator}` : "Keyboard supported · drag header to move"}</div><output className="calculator-display" aria-live="polite">{state.display}</output>
      <div className="calculator-keys">{keys.map(key => <button type="button" key={key} aria-label={({ "⌫": "Backspace", "±": "Toggle sign", "AC": "Clear", "=": "Equals" })[key] || key} className={"calculator-key " + (["÷", "×", "−", "+", "="].includes(key) ? "calculator-operator" : ["AC", "±", "%"].includes(key) ? "calculator-utility" : "")} onClick={() => dispatch(key)}>{key}</button>)}</div>
    </section>}</>;
}
