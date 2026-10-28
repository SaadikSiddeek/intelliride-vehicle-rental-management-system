import { useState } from "react";
import {
  Check,
  RotateCcw,
  Monitor,
  Moon,
  Sun,
  Palette,
  PanelLeft,
  SlidersHorizontal,
  Sparkles,
  MousePointer2,
  CircleHelp,
  LayoutGrid,
} from "lucide-react";
import { useTheme } from "../contexts/theme-context";
import { presets } from "../contexts/appearance-config";
import { accentForeground } from "../contexts/appearance-utils";
import Brand from "../components/layout/Brand";
import { Badge } from "../components/ui/badge";
import PageHeader from "../components/PageHeader";

const accents = [
  "",
  "#072A56",
  "#245CFA",
  "#5C43A8",
  "#08734F",
  "#875832",
  "#A32565",
  "#3F4A56",
];
const menus = [
  ["appearance", "Appearance", Palette],
  ["navigation", "Navigation", PanelLeft],
  ["display", "Display & motion", SlidersHorizontal],
];
const Field = ({ label, hint, children }) => (
  <div className="setting-field">
    <div>
      <strong>{label}</strong>
      {hint && <p>{hint}</p>}
    </div>
    <div className="setting-control">{children}</div>
  </div>
);
function Choice({ value, onChange, options, label }) {
  return (
    <select
      aria-label={label}
      className="setting-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map(([id, name]) => (
        <option key={id} value={id}>
          {name}
        </option>
      ))}
    </select>
  );
}
function Toggle({ checked, onChange, label }) {
  return (
    <label className="setting-toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span aria-hidden="true" />
    </label>
  );
}
const appearanceOptions = [
  ["light", "Light", Sun],
  ["dark", "Dark", Moon],
  ["system", "System", Monitor],
];
export default function Settings() {
  const {
    theme,
    appearance,
    activePreset,
    preferences: p,
    setTheme,
    setPreference,
    resetAppearance,
  } = useTheme();
  const [section, setSection] = useState("appearance");
  const change = (key) => (value) => setPreference(key, value);
  const presetKey = theme === "dark" ? "darkPreset" : "lightPreset";
  return (
    <div className="settings-page">
      <PageHeader
        title="Make it yours."
        sub_text="Shape your IntelliRide workspace around the way you work."
        breadcrumbs={[{ label: "Settings" }, { label: "Personalization" }]}
      />
      <div className="settings-brand-preview">
        <Brand />
        <p>
          Official IntelliRide identity · your preferences preview instantly.
        </p>
      </div>
      <div className="settings-shell">
        <aside className="settings-rail" aria-label="Settings categories">
          <div className="settings-rail-heading">PREFERENCES</div>
          {menus.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`settings-rail-link ${section === id ? "active" : ""}`}
              onClick={() => setSection(id)}
              aria-current={section === id ? "page" : undefined}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
          <div className="settings-rail-tip">
            <Sparkles size={18} />
            <strong>Your workspace, your way.</strong>
            <p>Changes preview instantly and stay saved in this browser.</p>
          </div>
        </aside>
        <div className="settings-panels">
          {section === "appearance" && (
            <>
              <div className="settings-heading">
                <span className="settings-heading-icon">
                  <Palette size={20} />
                </span>
                <div>
                  <h2>Appearance</h2>
                  <p>Choose a look that feels right, day or night.</p>
                </div>
              </div>
              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Color mode</h3>
                    <p>
                      Switch modes instantly, or match your device's
                      preferences.
                    </p>
                  </div>
                </div>
                <div className="mode-picker">
                  {appearanceOptions.map(([id, label, Icon]) => (
                    <button
                      key={id}
                      aria-pressed={appearance === id}
                      onClick={() => setTheme(id)}
                      className={`mode-option ${appearance === id ? "selected" : ""}`}
                    >
                      <Icon size={19} />
                      <span>{label}</span>
                      {appearance === id && <Check size={15} />}
                    </button>
                  ))}
                </div>
              </section>
              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Theme gallery</h3>
                    <p>
                      Nine complete palettes, each tuned for light and dark.
                      Editing the {theme} preset.
                    </p>
                  </div>
                  <span className="settings-subtle-pill">
                    {theme === "dark" ? "Dark" : "Light"} collection
                  </span>
                </div>
                <div className="preset-gallery">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={activePreset === preset.id}
                      className={`preset-tile ${activePreset === preset.id ? "selected" : ""}`}
                      onClick={() => change(presetKey)(preset.id)}
                    >
                      <div
                        className="preset-swatch"
                        style={{
                          "--swatch-bg": preset[theme][0],
                          "--swatch-surface": preset[theme][1],
                          "--swatch-accent": preset[theme][2],
                          "--swatch-foreground": accentForeground(
                            preset[theme][2],
                          ),
                        }}
                      >
                        <div className="swatch-side" />
                        <div className="swatch-content">
                          <span />
                          <i />
                          <i />
                          <div>
                            <b />
                            <b />
                          </div>
                        </div>
                        {activePreset === preset.id && (
                          <span className="swatch-selected">
                            <Check size={13} />
                          </span>
                        )}
                      </div>
                      <strong>{preset.name}</strong>
                      <small>{preset.description}</small>
                    </button>
                  ))}
                </div>
              </section>
              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Accent color</h3>
                    <p>
                      Use your preset's accent or choose a custom highlight for
                      buttons and focus rings.
                    </p>
                  </div>
                </div>
                <div className="accent-list">
                  {accents.map((color) => (
                    <button
                      key={color || "default"}
                      type="button"
                      onClick={() => change("customAccent")(color)}
                      aria-label={
                        color
                          ? `Use ${color} accent`
                          : "Use theme default accent"
                      }
                      aria-pressed={p.customAccent === color}
                      title={color || "Theme default"}
                      className={`accent-chip ${p.customAccent === color ? "selected" : ""}`}
                      style={{
                        background: color || "#072A56",
                        color: accentForeground(color || "#072A56"),
                      }}
                    >
                      {p.customAccent === color && <Check size={15} />}
                    </button>
                  ))}
                </div>
                <div className="settings-live-preview">
                  <strong>Live preview</strong>
                  <button
                    className="btn-primary"
                    type="button"
                    onClick={() => setSection("display")}
                  >
                    Try display settings
                  </button>
                  <Badge tone="success">Available</Badge>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={() => change("customAccent")("")}
                  >
                    Use preset accent
                  </button>
                </div>
              </section>
              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Quick switching</h3>
                    <p>
                      Keep one-click Light/Dark in the top bar while choosing
                      its favorite presets.
                    </p>
                  </div>
                </div>
                <Field
                  label="Light mode favorite"
                  hint="Used when switching to light mode."
                >
                  <Choice
                    label="Light mode preset"
                    value={p.lightPreset}
                    onChange={change("lightPreset")}
                    options={presets.map((x) => [x.id, x.name])}
                  />
                </Field>
                <Field
                  label="Dark mode favorite"
                  hint="Used when switching to dark mode."
                >
                  <Choice
                    label="Dark mode preset"
                    value={p.darkPreset}
                    onChange={change("darkPreset")}
                    options={presets.map((x) => [x.id, x.name])}
                  />
                </Field>
                <Field
                  label="Header preset selector"
                  hint="Show a second, optional theme selector near the sun/moon icon."
                >
                  <Toggle
                    label="Show header preset selector"
                    checked={p.quickPreset}
                    onChange={change("quickPreset")}
                  />
                </Field>
              </section>
            </>
          )}
          {section === "navigation" && (
            <>
              <div className="settings-heading">
                <span className="settings-heading-icon">
                  <PanelLeft size={20} />
                </span>
                <div>
                  <h2>Navigation</h2>
                  <p>Fine-tune your workspace navigation.</p>
                </div>
              </div>
              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Sidebar preferences</h3>
                    <p>Keep the tools you use most in easy reach.</p>
                  </div>
                </div>
                <Field
                  label="Compact sidebar"
                  hint="Show only navigation icons on desktop. You can still toggle it from the sidebar."
                >
                  <Toggle
                    label="Compact desktop sidebar"
                    checked={p.sidebarCompact}
                    onChange={change("sidebarCompact")}
                  />
                </Field>
                <Field
                  label="Sidebar finish"
                  hint="Choose a rich, dark rail or a surface that matches the workspace."
                >
                  <Choice
                    label="Sidebar finish"
                    value={p.sidebarStyle}
                    onChange={change("sidebarStyle")}
                    options={[
                      ["solid", "Deep navy"],
                      ["adaptive", "Adaptive surface"],
                    ]}
                  />
                </Field>
                <Field
                  label="Sidebar density"
                  hint="Adjust the spacing between navigation items."
                >
                  <Choice
                    label="Sidebar density"
                    value={p.sidebarDensity}
                    onChange={change("sidebarDensity")}
                    options={[
                      ["compact", "Compact"],
                      ["comfortable", "Comfortable"],
                    ]}
                  />
                </Field>
                <Field
                  label="Quick preset access"
                  hint="Add the theme preset selector to your header."
                >
                  <Toggle
                    label="Quick theme access in header"
                    checked={p.quickPreset}
                    onChange={change("quickPreset")}
                  />
                </Field>
              </section>
            </>
          )}
          {section === "display" && (
            <>
              <div className="settings-heading">
                <span className="settings-heading-icon">
                  <LayoutGrid size={20} />
                </span>
                <div>
                  <h2>Display & motion</h2>
                  <p>A comfortable interface in the details.</p>
                </div>
              </div>
              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Interface proportions</h3>
                    <p>
                      Changes apply across existing pages, forms, and tables.
                    </p>
                  </div>
                </div>
                <Field
                  label="Interface spacing"
                  hint="Control spacing between cards and fields."
                >
                  <Choice
                    label="Interface spacing"
                    value={p.density}
                    onChange={change("density")}
                    options={[
                      ["compact", "Compact"],
                      ["comfortable", "Comfortable"],
                      ["spacious", "Spacious"],
                    ]}
                  />
                </Field>
                <Field
                  label="Table density"
                  hint="Adjust the size of data rows."
                >
                  <Choice
                    label="Table density"
                    value={p.tableDensity}
                    onChange={change("tableDensity")}
                    options={[
                      ["compact", "Compact"],
                      ["comfortable", "Comfortable"],
                      ["spacious", "Spacious"],
                    ]}
                  />
                </Field>
                <Field
                  label="Corner radius"
                  hint="From angular to softly rounded surfaces."
                >
                  <Choice
                    label="Corner radius"
                    value={p.radius}
                    onChange={change("radius")}
                    options={[
                      ["small", "Subtle"],
                      ["medium", "Balanced"],
                      ["large", "Soft"],
                    ]}
                  />
                </Field>
                <Field
                  label="Interface scale"
                  hint="Scale text and controls together."
                >
                  <Choice
                    label="Interface scale"
                    value={p.fontScale}
                    onChange={change("fontScale")}
                    options={[
                      ["small", "90%"],
                      ["normal", "100%"],
                      ["large", "110%"],
                    ]}
                  />
                </Field>
                <Field
                  label="Card treatment"
                  hint="Choose subtle shadows or a border-first look."
                >
                  <Choice
                    label="Card treatment"
                    value={p.cardStyle}
                    onChange={change("cardStyle")}
                    options={[
                      ["elevated", "Soft elevation"],
                      ["flat", "Minimal borders"],
                    ]}
                  />
                </Field>
                <Field
                  label="Workspace background"
                  hint="Choose a clean surface or a subtle tint from your active accent."
                >
                  <Choice
                    label="Workspace background"
                    value={p.surfaceStyle}
                    onChange={change("surfaceStyle")}
                    options={[
                      ["plain", "Clean surface"],
                      ["tinted", "Soft accent tint"],
                    ]}
                  />
                </Field>
              </section>
              <section className="settings-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Motion preferences</h3>
                    <p>
                      Animations automatically respect your operating system's
                      reduced-motion setting.
                    </p>
                  </div>
                </div>
                <Field
                  label="Interface motion"
                  hint="Choose polished transitions or reduce non-essential animation."
                >
                  <Choice
                    label="Interface motion"
                    value={p.motion}
                    onChange={change("motion")}
                    options={[
                      ["full", "Balanced animation"],
                      ["reduced", "Reduced motion"],
                    ]}
                  />
                </Field>
                <Field
                  label="Animation intensity"
                  hint="Adjust transition timing, or pause all decorative motion."
                >
                  <Choice
                    label="Animation intensity"
                    value={p.animationIntensity}
                    onChange={change("animationIntensity")}
                    options={[
                      ["subtle", "Subtle"],
                      ["balanced", "Balanced"],
                      ["none", "No animation"],
                    ]}
                  />
                </Field>
              </section>
            </>
          )}
          <div className="settings-reset">
            <div>
              <CircleHelp size={18} />
              <span>
                Want to start fresh? Your account and business data will not
                change.
              </span>
            </div>
            <button
              className="settings-reset-button"
              type="button"
              onClick={resetAppearance}
            >
              <RotateCcw size={16} /> Restore defaults
            </button>
          </div>
          <div className="settings-saved">
            <MousePointer2 size={14} /> All appearance settings save
            automatically to this browser.
          </div>
        </div>
      </div>
    </div>
  );
}
