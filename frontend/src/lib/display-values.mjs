const currency = new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" });
const decimal = new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-LK", { maximumFractionDigits: 3 });

function formatNumeric(value, formatter) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return "—";
  if (typeof value !== "number" && typeof value !== "string") return "Unavailable";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatter.format(parsed) : "Unavailable";
}

export const formatMoney = value => formatNumeric(value, currency);
export const formatDecimal = value => formatNumeric(value, decimal);
export const formatNumber = value => formatNumeric(value, number);
