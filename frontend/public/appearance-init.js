/* Generated. Uses presentation storage only. */
(function(){
const APPEARANCE_KEY = "intelliride-appearance-v1";
const BRAND = Object.freeze({ navy: "#072A56", deepNavy: "#0A1C36", blue: "#245CFA" });
const presets = [
  { id: "signature", name: "IntelliRide Signature", description: "Official navy. Clear blue detail.", light: ["#F5F7FB", "#FFFFFF", BRAND.navy], dark: ["#0A1425", "#121F34", "#95B7FF"] },
  { id: "executive", name: "Executive Blue", description: "Composed corporate blue.", light: ["#F4F6F9", "#FFFFFF", "#244B7A"], dark: ["#101925", "#1A2637", "#A0BDDF"] },
  { id: "midnight", name: "Midnight Navy", description: "Quiet focus after dark.", light: ["#F4F6FA", "#FFFFFF", "#263F73"], dark: ["#080F1E", "#111C30", "#A5BCFF"] },
  { id: "ocean", name: "Ocean Blue", description: "Bright, open, unmistakably blue.", light: ["#F1F7FC", "#FFFFFF", "#0868AE"], dark: ["#0A1828", "#122A40", "#79C7FF"] },
  { id: "arctic", name: "Arctic Light", description: "Clean surfaces. A lighter touch.", light: ["#FAFBFD", "#FFFFFF", "#244878"], dark: ["#111A29", "#1C293B", "#AAC5EE"] },
  { id: "graphite", name: "Graphite Professional", description: "Calm charcoal and neutrals.", light: ["#F5F6F7", "#FFFFFF", "#3F4A56"], dark: ["#121619", "#22292F", "#D5DAE0"] },
  { id: "indigo", name: "Royal Indigo", description: "A considered indigo accent.", light: ["#F6F5FC", "#FFFFFF", "#5C43A8"], dark: ["#171227", "#261E3A", "#C4AEFF"] },
  { id: "emerald", name: "Emerald Alternative", description: "An optional green palette.", light: ["#F2F8F5", "#FFFFFF", "#08734F"], dark: ["#0B1B19", "#16312B", "#79D9B3"] },
  { id: "warm", name: "Warm Neutral", description: "A familiar, softer alternative.", light: ["#FAF8F4", "#FFFDF9", "#875832"], dark: ["#211C19", "#302821", "#E1B58B"] },
];
const defaultAppearance = Object.freeze({
  appearance: "light", lightPreset: "signature", darkPreset: "midnight", customAccent: "",
  density: "comfortable", tableDensity: "comfortable", radius: "medium",
  fontScale: "normal", motion: "full", animationIntensity: "subtle", sidebarCompact: false,
  sidebarStyle: "solid", sidebarDensity: "comfortable", cardStyle: "elevated", surfaceStyle: "plain", quickPreset: false,
});
const appearanceChoices = {
  appearance: ["light", "dark", "system"], lightPreset: presets.map(p => p.id), darkPreset: presets.map(p => p.id),
  density: ["compact", "comfortable", "spacious"], tableDensity: ["compact", "comfortable", "spacious"],
  radius: ["small", "medium", "large"], fontScale: ["small", "normal", "large"], motion: ["full", "reduced"],
  animationIntensity: ["subtle", "balanced", "none"], sidebarStyle: ["solid", "adaptive"],
  sidebarDensity: ["compact", "comfortable"], cardStyle: ["elevated", "flat"], surfaceStyle: ["plain", "tinted"],
};

function sanitizeAppearance(saved) {
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
function readAppearance() {
  try {
    const saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) || "null");
    if (saved) return sanitizeAppearance(saved);
    return sanitizeAppearance({ appearance: localStorage.getItem("rental-ui-theme") === "dark" ? "dark" : "light" });
  } catch { return { ...defaultAppearance }; }
}
const channels = hex => hex.replace("#", "").match(/../g).map(c => parseInt(c, 16));
const luminance = hex => channels(hex).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
const accentForeground = hex => contrast(hex, "#FFFFFF") >= contrast(hex, "#081426") ? "#FFFFFF" : "#081426";
function accessibleAccent(hex, background) {
  if (contrast(hex, background) >= 4.5) return hex;
  const target = luminance(background) < .2 ? 255 : 0;
  const rgb = channels(hex);
  for (let step = 1; step <= 20; step++) {
    const adjusted = "#" + rgb.map(c => Math.round(c + (target - c) * step / 20).toString(16).padStart(2, "0")).join("");
    if (contrast(adjusted, background) >= 4.5) return adjusted;
  }
  return target ? "#FFFFFF" : "#000000";
}

try {
  const p = readAppearance();
  const mode = p.appearance === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : p.appearance;
  const presetId = mode === 'dark' ? p.darkPreset : p.lightPreset;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  Object.assign(root.dataset, {mode, preset:presetId, density:p.density, tableDensity:p.tableDensity, radius:p.radius,
    scale:p.fontScale, motion:p.motion, intensity:p.animationIntensity, sidebarStyle:p.sidebarStyle,
    sidebarDensity:p.sidebarDensity, cardStyle:p.cardStyle, surface:p.surfaceStyle});
  if(p.customAccent) {
    const accent = accessibleAccent(p.customAccent, presets.find(x=>x.id===presetId)[mode][1]);
    root.style.setProperty('--primary',accent); root.style.setProperty('--ring',accent);
    root.style.setProperty('--sidebar-primary',accent);root.style.setProperty('--primary-foreground',accentForeground(accent));
  }
} catch { /* Storage or matchMedia may be unavailable. Use CSS defaults. */ }
})();
