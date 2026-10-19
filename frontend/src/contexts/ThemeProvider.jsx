import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { ThemeContext } from "./theme-context";
import { APPEARANCE_KEY, presets, defaultAppearance } from "./appearance-config";
import { readAppearance, sanitizeAppearance, accessibleAccent, accentForeground } from "./appearance-utils";
export function ThemeProvider({ children }) {
  const [preferences, setPreferences] = useState(readAppearance);
  const [systemDark, setSystemDark] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = preferences.appearance === "system" ? (systemDark ? "dark" : "light") : preferences.appearance;
  const activePreset = theme === "dark" ? preferences.darkPreset : preferences.lightPreset;
  const setPreference = useCallback((key, value) => {
    if (!(key in defaultAppearance)) return;
    setPreferences(prev => sanitizeAppearance({ ...prev, [key]: typeof value === "function" ? value(prev[key]) : value }));
  }, []);
  const setTheme = useCallback(next => setPreference("appearance", next), [setPreference]);
  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);
  const resetAppearance = useCallback(() => setPreferences({ ...defaultAppearance }), []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    Object.assign(root.dataset, {
      mode: theme, preset: activePreset, density: preferences.density, tableDensity: preferences.tableDensity,
      radius: preferences.radius, scale: preferences.fontScale, motion: preferences.motion,
      intensity: preferences.animationIntensity, sidebarStyle: preferences.sidebarStyle,
      sidebarDensity: preferences.sidebarDensity, cardStyle: preferences.cardStyle, surface: preferences.surfaceStyle,
    });
    const preset = presets.find(p => p.id === activePreset);
    if (preferences.customAccent) {
      const accent = accessibleAccent(preferences.customAccent, preset[theme][1]);
      for (const prop of ["--primary", "--ring", "--sidebar-primary"]) root.style.setProperty(prop, accent);
      root.style.setProperty("--primary-foreground", accentForeground(accent));
    } else {
      for (const prop of ["--primary", "--ring", "--sidebar-primary", "--primary-foreground"]) root.style.removeProperty(prop);
    }
    try {
      localStorage.setItem(APPEARANCE_KEY, JSON.stringify(preferences));
      localStorage.setItem("rental-ui-theme", theme);
    } catch { /* Browser preferences are optional when storage is disabled. */ }
  }, [preferences, theme, activePreset]);
  const value = useMemo(() => ({ theme, appearance: preferences.appearance, preferences, activePreset, presets,
    setTheme, toggleTheme, setPreference, resetAppearance,
  }), [preferences, theme, activePreset, setTheme, toggleTheme, setPreference, resetAppearance]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
