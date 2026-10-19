import { APPEARANCE_KEY, defaultAppearance, appearanceChoices } from "./appearance-config.js";
export function sanitizeAppearance(saved) {
  const result = { ...defaultAppearance };
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return result;
  for (const [key, fallback] of Object.entries(defaultAppearance)) {
    const value = saved[key];
    if (typeof value !== typeof fallback) continue;
    if (appearanceChoices[key] && !appearanceChoices[key].includes(value)) continue;
    if (key === "customAccent" && !/^$|^#[0-9a-fA-F]{6}$/.test(value)) continue;
    result[key] = value;
  }
  return result;
}
export function readAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "null");
    if (saved) return sanitizeAppearance(saved);
    return sanitizeAppearance({ appearance: localStorage.getItem("rental-ui-theme") === "dark" ? "dark" : "light" });
  } catch { return { ...defaultAppearance }; }
}
const channels = hex => hex.replace("#", "").match(/../g).map(c => parseInt(c, 16));
const luminance = hex => channels(hex).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
export const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
export const accentForeground = hex => contrast(hex, "#FFFFFF") >= contrast(hex, "#081426") ? "#FFFFFF" : "#081426";
export function accessibleAccent(hex, background) {
  if (contrast(hex, background) >= 4.5) return hex;
  const target = luminance(background) < .2 ? 255 : 0;
  const rgb = channels(hex);
  for (let step = 1; step <= 20; step++) {
    const adjusted = "#" + rgb.map(c => Math.round(c + (target - c) * step / 20).toString(16).padStart(2, "0")).join("");
    if (contrast(adjusted, background) >= 4.5) return adjusted;
  }
  return target ? "#FFFFFF" : "#000000";
}
