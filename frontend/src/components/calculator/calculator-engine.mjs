export const initialCalculator = () => ({ display: "0", stored: null, operator: null, replace: false, last: null });
const format = (n) => Number.isFinite(n) && Math.abs(n) < 1e15 ? String(Number(n.toPrecision(12))) : "Error";
const calculate = (a, op, b) => op === "+" ? a + b : op === "−" ? a - b : op === "×" ? a * b : b === 0 ? NaN : a / b;
export function calculatorReducer(state, key) {
  if (key === "AC") return initialCalculator();
  let s = state.display === "Error" ? initialCalculator() : { ...state };
  if (/^\d$/.test(key)) return { ...s, display: s.replace || s.display === "0" ? key : s.display.length < 15 ? s.display + key : s.display, replace: false };
  if (key === ".") return { ...s, display: s.replace ? "0." : s.display.includes(".") ? s.display : s.display + ".", replace: false };
  if (key === "⌫") return { ...s, display: s.replace ? "0" : s.display.length > 1 ? s.display.slice(0, -1) === "-" ? "0" : s.display.slice(0, -1) : "0", replace: false };
  if (key === "±") return { ...s, display: format(-Number(s.display)) };
  if (key === "%") return { ...s, display: format(s.operator && ["+", "−"].includes(s.operator) ? s.stored * Number(s.display) / 100 : Number(s.display) / 100) };
  if (["+", "−", "×", "÷"].includes(key)) {
    const result = s.operator && !s.replace ? calculate(s.stored, s.operator, Number(s.display)) : Number(s.display);
    return { display: format(result), stored: result, operator: key, replace: true, last: null };
  }
  if (key === "=") {
    const op = s.operator || s.last?.operator;
    if (!op) return s;
    const operand = s.operator ? Number(s.display) : s.last.operand;
    return { display: format(calculate(s.operator ? s.stored : Number(s.display), op, operand)), stored: null, operator: null, replace: true, last: { operator: op, operand } };
  }
  return s;
}
