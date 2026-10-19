export const APPEARANCE_KEY = "intelliride-appearance-v1";
export const BRAND = Object.freeze({ navy: "#072A56", deepNavy: "#0A1C36", blue: "#245CFA" });
export const presets = [
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
export const defaultAppearance = Object.freeze({
  appearance: "light", lightPreset: "signature", darkPreset: "midnight", customAccent: "",
  density: "comfortable", tableDensity: "comfortable", radius: "medium",
  fontScale: "normal", motion: "full", animationIntensity: "subtle", sidebarCompact: false,
  sidebarStyle: "solid", sidebarDensity: "comfortable", cardStyle: "elevated", surfaceStyle: "plain", quickPreset: false,
});
export const appearanceChoices = {
  appearance: ["light", "dark", "system"], lightPreset: presets.map(p => p.id), darkPreset: presets.map(p => p.id),
  density: ["compact", "comfortable", "spacious"], tableDensity: ["compact", "comfortable", "spacious"],
  radius: ["small", "medium", "large"], fontScale: ["small", "normal", "large"], motion: ["full", "reduced"],
  animationIntensity: ["subtle", "balanced", "none"], sidebarStyle: ["solid", "adaptive"],
  sidebarDensity: ["compact", "comfortable"], cardStyle: ["elevated", "flat"], surfaceStyle: ["plain", "tinted"],
};
