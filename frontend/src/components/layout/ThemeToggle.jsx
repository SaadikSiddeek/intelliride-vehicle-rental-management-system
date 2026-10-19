import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../contexts/theme-context";
import { presets } from "../../contexts/appearance-config";
import { Button } from "../ui/button";
export default function ThemeToggle() {
  const { theme, toggleTheme, activePreset, preferences, setPreference } = useTheme();
  return <div className="header-theme-actions">
    {preferences.quickPreset && <select className="quick-preset-select" value={activePreset} aria-label="Quick theme preset" onChange={(event) => setPreference(theme === "dark" ? "darkPreset" : "lightPreset", event.target.value)}>
      {presets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}
    </select>}
    <Button variant="ghost" size="icon" className="header-theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      {theme === "dark" ? <Sun size={18}/> : <Moon size={18}/>}
    </Button>
  </div>;
}
