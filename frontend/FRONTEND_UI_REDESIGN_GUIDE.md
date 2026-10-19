# IntelliRide frontend redesign guide

This package updates the existing React frontend. It preserves the supplied Laravel contracts, authentication behavior, data sources, and navigation paths. It adds the official IntelliRide artwork, a navy design system, a redesigned public site, consistent forms, and working browser appearance preferences.

## 1. Start the project

Extract the ZIP and open the inner `frontend` directory containing `package.json`.

Use Node.js 22.12 or newer (verification used Node.js 24.19.0). The supplied Vite engine also permits Node 20.19, but a supported newer Node installation is preferable.

```bash
npm ci
npm run dev
```

Open the address Vite prints, normally `http://localhost:3000`. Keep your Laravel backend running for sign-in and API-backed management screens. The existing `.env` and `.env.example` are unchanged.

On Windows PowerShell, use `npm.cmd ci` and `npm.cmd run dev` if PowerShell blocks `npm.ps1`. You can also use Command Prompt. Install dependencies locally; the ZIP excludes the uploaded Windows `node_modules`, generated build output, and local verification tools.

For a production build:

```bash
npm run build
npm run preview
```

A production host must serve `index.html` for client-side routes such as `/dashboard` and `/login`. No deployment or hosting configuration was introduced.

## 2. Design objectives and scope

The design uses navy identity, restrained blue accents, readable slate surfaces, compact controls, consistent spacing, clear data status, and subtle transitions. It uses the project's existing React, Vite, Tailwind, Base UI/shadcn-style controls, Lucide, React Hook Form, Recharts, and Tabulator dependencies.

No new runtime dependencies were added. No backend files, API endpoints, permission rules, subscription services, or AI services were added.

All 13 existing management screens use the shared enterprise styles. The dashboard retains its original illustrative figures and records. Existing AI pages retain their explicit disconnected states.

## 3. Official logo integration and palette

The seven supplied PNG originals are retained in `public/brand/originals/`. They were not recolored, stretched, or overwritten.

| Use | Optimized asset |
| --- | --- |
| Light surface wordmark | `public/brand/wordmark-color.webp` |
| Dark surface wordmark | `public/brand/wordmark-white.webp` |
| Compact light icon | `public/brand/mark-color.webp` |
| Compact dark icon | `public/brand/mark-white.webp` |
| Browser favicon | `public/brand/favicon.png` |

Transparent padding was cropped and assets were resized proportionally. The favicon uses a square transparent canvas around the proportionally resized mark.

The most frequent opaque navy pixel in the supplied color wordmark was RGB(7, 42, 86), or **#072A56**. The most frequent background color in the supplied white-on-navy logo was RGB(10, 28, 54), or **#0A1C36**. These determine the default brand.

| Token | Value | Purpose |
| --- | --- | --- |
| Brand navy | `#072A56` | Default light-mode primary |
| Deep navy | `#0A1C36` | Marketing hero and navigation rail |
| Interactive blue | `#245CFA` | Designed accent variant inspired by the brighter logo details |
| Light background | `#F5F7FB` | Signature workspace background |
| Light foreground | `#17243B` | Main text |
| Dark foreground | `#EAF0FA` | Main text on dark surfaces |

Dark presets use lighter blue interactive colors so text and controls remain legible. Green remains a semantic success color and an optional Emerald preset.

`src/components/layout/Brand.jsx` selects full or compact artwork and an automatic, white, or color presentation. CSS selects the appropriate artwork for dark mode, solid navy sidebars, adaptive sidebars, authentication, and settings. No inversion filters are used.

## 4. Theme tokens and configuration

Edit `src/contexts/appearance-config.js` for brand constants, preset names/colors, and default preferences. Run the generator after editing it:

```bash
node scripts/generate-appearance.mjs
```

It writes:

- `src/styles/appearance-tokens.css`: complete semantic tokens for each preset and mode.
- `public/appearance-init.js`: the early page-paint initializer using the same defaults, validation, and contrast helpers.

`src/index.css` imports the existing shared styles, the generated tokens, `enterprise.css`, and `marketing.css`. The existing base tokens remain as a fallback.

Semantic variables include `--background`, `--foreground`, `--card`, `--primary`, `--primary-foreground`, `--border`, `--input`, `--ring`, sidebar variables, chart colors, and success/warning/error surfaces.

## 5. Appearance presets

Every preset supports both light and dark mode:

| Preset | ID | Character |
| --- | --- | --- |
| IntelliRide Signature | `signature` | Official navy identity |
| Executive Blue | `executive` | Corporate blue and slate |
| Midnight Navy | `midnight` | Deep navy surfaces |
| Ocean Blue | `ocean` | Clear blue accents |
| Arctic Light | `arctic` | Minimal light surfaces |
| Graphite Professional | `graphite` | Neutral charcoal |
| Royal Indigo | `indigo` | Refined indigo |
| Emerald Alternative | `emerald` | Optional green |
| Warm Neutral | `warm` | Retained warm alternative |

Default light preset: Signature. Default dark preset: Midnight. Existing valid saved choices are retained rather than erased.

## 6. Persistence, system mode, and quick switching

Preferences use the existing presentation-only `intelliride-appearance-v1` key. The legacy `rental-ui-theme` presentation key is maintained. No authentication keys are read or written by the appearance system.

The early initializer runs before React to apply saved mode, preset, density, radius, scale, and other visual settings. React's ThemeProvider applies subsequent changes before layout paint. System mode listens for operating-system color-scheme changes and cleans up its listener.

The existing header sun/moon control remains one click. It switches between the user's preferred light and dark presets. An optional header preset dropdown is available in Settings and appears on screens with room for it. On narrow screens, the quick sun/moon control remains available and full presets stay in Settings.

`appearance-utils.js` validates stored types and allowed values. Invalid values fall back to defaults. Custom accents are adjusted when necessary for readable text on the selected surface, and button foreground colors are selected for contrast.

## 7. Working appearance controls

| Setting | Effect |
| --- | --- |
| Light/dark/system | Applies mode and system preference listener |
| Light/dark favorite | Chooses the preset used by the quick switch |
| Accent color | Updates primary controls, accents and focus rings |
| Interface spacing | Changes workspace and form spacing |
| Table density | Changes Tabulator and dashboard table padding |
| Font scale | 90%, 100%, or 110% root sizing, including rem-based UI |
| Corner radius | Changes shared cards, fields, and panels |
| Card treatment | Soft elevation or flat borders |
| Sidebar finish | Solid navy or adaptive surface |
| Sidebar compact mode | Desktop icon-only navigation |
| Sidebar density | Changes navigation row spacing |
| Workspace background | Plain or subtly tinted workspace |
| Motion preference | Balanced or reduced motion |
| Animation intensity | Subtle timing, balanced timing, or no animation |
| Restore defaults | Restores appearance preferences only |

No account, billing, or security settings were invented. The existing profile menu and sign-out controls remain available.

## 8. Shared application shell

`DefaultLayout.jsx` remains byte-identical to the supplied project, including its `/user` request, authentication boundary, logout request, and token behavior.

The existing Sidebar component consumes the same routes and collapse state. Shared CSS changes its proportions, navy surfaces, active states, compact layout, and mobile presentation. All supplied navigation paths remain intact.

The header keeps breadcrumbs, the account menu, appearance shortcut, and theme switch. It adds a guided-tour launcher and Ctrl/Cmd+K page search with proper listener cleanup. Search continues to navigate to existing routes.

Screens load through React.lazy and a shared Suspense fallback. Route paths and authentication boundaries are unchanged. The loading fallback uses the official theme-aware mark.

## 9. Public landing page

The root route `/` contains:

1. Official logo, responsive navigation, theme switch, sign-in, and start/workspace links.
2. Split automotive hero using the requested headline and description.
3. Platform introduction and actual component explorer.
4. Six compact feature cards with accurate availability labels.
5. Operation-type selection that highlights relevant feature cards.
6. Four-step workflow and optional guided tour.
7. AI roadmap with an explicit planned/not-connected status.
8. Three compact illustrative pricing cards and expandable comparison.
9. Accessible native FAQ disclosures.
10. Final CTA, administrator contact guidance, and legitimate footer links.
11. Fixed floating assistant interface.

There are no fabricated customers, testimonials, certifications, operating statistics, or working rental/AI claims. The original dashboard sample figures are labeled.

Existing guest redirects are preserved: authenticated visitors to `/login` or `/signup` still return to `/`. The public page now offers authenticated visitors an **Open workspace** link to `/dashboard`; no login redirect logic was changed.

## 10. Realistic driving scene

`src/components/marketing/DrivingScene.jsx` uses a photorealistic transparent silver sedan in `public/touring-sedan.webp`. A stable car and contact shadow sit over a side-on road. Road markings repeat over exactly 160px and the horizon repeats over 55px so motion loops without a boundary jump.

CSS animates only lightweight road/horizon motion. The car does not bob, float, or rotate in 3D. The photographed wheels are not independently animated. The scene has a pause/play control, mobile proportions, and reduced-motion/no-animation fallbacks. A compact variant appears on authentication screens.

The original generated image is `public/touring-sedan-original.png`; the optimized WebP is about 140 KB. Both are project assets. The built-in image-generation tool created this new asset; the official logos were preserved separately.

Generation prompt:

> Use case: product-mockup. Asset type: photorealistic cutout for a premium vehicle rental software website's animated driving scene. Create a single realistic elegant silver-gray luxury touring sedan facing RIGHT, exact side profile, both wheels visible and circular, camera level at car body height, long low wheelbase with naturally proportioned body. Full car completely in frame with 8 percent clear margin each side. Subtle navy reflections on paint, charcoal glass, tasteful polished multi-spoke wheels, gentle dark tire contact shadow immediately below tires only. Extremely realistic automotive commercial product photography with soft overcast daylight. Genuine transparent background, no scenery, no floor plane except faint contact shadow, no text, no labels, no brand badges, no watermarks. Wide landscape composition with car filling most of width. This cutout will be placed on a flat side-on road moving horizontally; keep car fully side-on and tires resting on the same horizontal baseline.

The vehicle is illustrative marketing artwork, not a claim that this particular vehicle is in the business's fleet.

## 11. Product explorer and guided tour

`ProductExplorer.jsx` reuses the actual Dashboard, VehicleRegistration, and Settings components. It does not create a fabricated second dashboard. The dashboard and vehicle screens continue using their supplied sample data. Appearance controls really work.

An IntersectionObserver defers preview loading until the section approaches the viewport and disconnects afterward. The preview has its own scroll region and does not cause document overflow.

`ProductTour.jsx` provides five steps covering organization, people, vehicle reference data, registration, and appearance. It includes step selection, previous/next, skip, finish, keyboard dismissal, and focus management through Base UI Dialog. Public visitors are directed to sign-in; authenticated visitors can open the existing module.

The operation-type selector changes presentation only and stores no personal data.

## 12. Pricing

Edit `src/components/marketing/PricingSection.jsx` to change displayed concepts:

| Plan | Illustrative monthly price |
| --- | --- |
| Starter | $29 USD |
| Professional | $79 USD |
| Enterprise | $199 USD |

Cards have equal-height layouts with compact typography, a restrained recommendation treatment, and concise concept summaries. The section and comparison table explicitly say prices and package scope are illustrative. Buttons explore account creation; they do not select or purchase a plan.

No yearly discounts, billing APIs, checkout flows, subscriptions, or entitlements were added.

## 13. Floating assistant

`FloatingAssistant.jsx` is reusable and accepts an optional adapter:

```jsx
const assistantAdapter = {
  async sendMessage(text, { signal }) {
    // Call your real service here, using your own existing authenticated client.
    // Resolve to { content: "The real service response" }.
  },
};

<FloatingAssistant adapter={assistantAdapter} />
```

Without an adapter, the panel is clearly **Not connected**, the composer is disabled, and no messages or network requests are created. There are no simulated responses or invented endpoint URLs.

The component owns open/close state, draft text, displayed messages, sending state, and request errors. It uses AbortController for pending adapter work and aborts when unmounted. Base UI handles dialog semantics and keyboard dismissal. The launcher is fixed with safe-area offsets, and the panel fits the mobile viewport.

To connect a real assistant, provide a real `sendMessage` function, pass the abort signal through your service request, and return a content string. Keep business authorization and tool execution on the real service. The component itself has no access to rental APIs or operational actions.

## 14. Forms: all 15 containers use React Hook Form

The existing API-backed department, designation, user, staff, and role forms keep their handler bodies and rules. The remaining eight management forms plus Login and Signup now use React Hook Form.

The child `DesignationForm.jsx` receives its parent's register/errors/submit props. It is part of the same form architecture rather than a separate state owner.

Form DOM refs were removed. Tabulator element/instance refs remain because they serve the table integration.

| Area | State and payload treatment |
| --- | --- |
| Department/designation/staff | Existing status-to-1/0 conversion retained |
| Users | Existing `{ form_data }` body, edit ID, password rules and reset mapping retained |
| Roles | Existing save body and boolean status retained |
| Other reference forms | Original top-level payload keys and console-only submissions retained |
| Vehicle registration | Original FormData field names/order and repeated `images[]` retained |
| Login | Original `{ email, password }` body, response branches and token effects retained |
| Signup | Original four field names, endpoint and token effects retained |

Numeric and date inputs retain their original string values. No number coercion or schema library was added. Zod was not introduced because the existing project did not need a new dependency for these validations.

Required identity fields show inline RHF messages. Signup adds client-side password confirmation feedback. Existing live form validation rules and server `setError` processing remain intact.

File inputs are registered through RHF and compose preview handlers through register's onChange option. Object URLs are revoked when previews change or the view unmounts.

## 15. Create/edit/reset/error behavior

Existing live forms retain their one-shot reset mappings when loading an edit record. Their save payloads still include `upd_id` only in update mode.

Drawer save controls use the existing saving state and now also reflect the existing edit-loading state. This prevents submission while edit data is being displayed. Submit wrappers run on the event rather than being evaluated during render.

Demo create actions reset their RHF defaults safely before opening the drawer. This removes the old first-open DOM-ref timing problem. Validated demo submissions show an honest message that no record was saved.

`ErrorField.jsx` centralizes the existing live-field error presentation. Inputs reference these messages with aria-describedby and aria-invalid. Shared native Input, Textarea, and NativeSelect also support an error prop, used by the migrated forms.

Backend response handling, error field names, success actions, and request methods were not rewritten.

## 16. Dashboard and tables

The dashboard retains its original KPI values, sample bookings, chart data, currency, and schedules. The welcome panel, cards, chart colors, tables, and quick links use the new navy presentation. Sample notices remain visible.

The fleet donut calculates segment offsets without mutating an outer render variable. Its data and displayed segments are unchanged.

Tabulator data, columns, sorting, pagination, existing actions, and request behavior remain intact. Shared CSS provides refined headings, row density, semantic status colors, responsive horizontal scrolling, pagination controls, and helpful empty states.

TableSearch remains byte-identical. It filters only the records already supplied to the table. No server-side export/filter feature was invented.

Existing loading overlays keep the same targetId/show/text contract, with the official mark and a restrained progress indicator. A standalone TableLoading component also provides skeleton rows.

External sample vehicle-brand images receive a local neutral car fallback if their supplied remote URL fails.

## 17. Shared component architecture

| Component | Purpose |
| --- | --- |
| Brand | Official full/compact, theme-aware artwork |
| ThemeToggle | Existing sun/moon and optional preset selector |
| PageHeader / PageCard | Existing shared screen structure |
| Input / Textarea / NativeSelect | Native form semantics, RHF registration, optional inline errors |
| ErrorField | Shared live-form error rendering |
| FormSection | Consistent form groups |
| CustomDrawer | Existing create/edit drawer and save controls |
| TableSearch | Preserved client-side record filter |
| CarLoader / TableLoading | Consistent loading feedback |
| ProductTour | Frontend-only guided exploration |
| DrivingScene | Lightweight realistic automotive animation |
| ProductExplorer | Actual component previews |
| PricingSection | Clearly illustrative compact plans |
| FloatingAssistant | Disconnected shell and future adapter interface |

## 18. Responsive behavior and accessibility

The public site was checked at widths 1440, 1024, 768, 390, and 320px. Existing application screens use mobile navigation and contained table scrolling. Forms use responsive columns and scrollable drawers.

Improvements include visible focus states, accessible control names, field-error associations, dialog semantics, keyboard close/return behavior, native FAQ disclosures, comparison table headers, safe-area chat placement, and a global reduced-motion override.

Static contrast checks cover each preset's primary text and button foreground plus several custom accent extremes. This is targeted verification, not a complete WCAG certification or exhaustive assistive-technology audit.

## 19. Performance

No 3D engine, animation framework, icon font, or additional runtime package was added.

Major screens load on demand. The initial JavaScript chunk decreased from approximately 1,446 KB in the supplied build to approximately 420 KB in this environment. Chart and table code remain substantial separate chunks from the existing libraries.

Fonts are bundled locally through the existing Inter dependency. WebP logo and vehicle assets keep the display payload smaller while originals remain available for maintenance.

## 20. Protected behavior

The preservation check confirms these files remain byte-identical:

- Axios configuration and interceptors.
- ContextProvider and its ACCESS_TOKEN handling.
- DefaultLayout authentication, user fetch, logout, and protected boundary.
- TableSearch.
- Navigation definitions and destinations.
- Original dashboard sample-data source.
- .env and .env.example.
- package.json and package-lock.json.

All original route paths/order, API call syntax, five live CRUD handler sets, and vehicle multipart field order are verified. Table comparison excludes presentation-only placeholder copy and HTML styling.

No permission restrictions were added or removed. No missing backend feature was silently implemented.

## 21. File-by-file changes

`REDESIGN_FILE_CHANGES.md` contains the detailed inventory. The main files are:

| Files | Change |
| --- | --- |
| appearance-config.js / appearance-utils.js / ThemeProvider.jsx | Nine presets, validated preferences, accessible accents and persistence |
| scripts/generate-appearance.mjs / appearance-tokens.css / appearance-init.js | Shared generation for theme CSS and first paint |
| enterprise.css / marketing.css / premium.css / index.css | Navy styles, responsive screens, compact controls and settings |
| Brand.jsx / public/brand/ | Official artwork and optimized variants |
| Landing.jsx / marketing components | Complete public experience and connected preview architecture |
| GuestLayout.jsx / Login.jsx / Signup.jsx | Authentication presentation and safe RHF migration |
| All existing management view files | Shared presentation, accessible errors, safe form-state migrations |
| Header.jsx / ProductTour.jsx | Guided help and keyboard page search |
| ErrorField.jsx / ui/input.jsx | Consistent accessible field error presentation |
| CarLoader.jsx / TableLoading.jsx | Restrained branded loading feedback |
| dashboard/Charts.jsx | Equivalent non-mutating segment offset calculation |
| router.jsx / main.jsx | Lazy screens and theme-aware loading fallback, same routes |
| index.html | Official favicon and shared early appearance initialization |
| vite.config.js | Equivalent ES-module-safe alias directory calculation |
| eslint.config.js | Narrow exception for the original mixed auth context export |
| verify-*.mjs / tests/browser-regression.mjs | Static preservation, render and controlled browser checks |

## 22. Verification commands

```bash
npm run build
npm run lint
node verify-redesign.mjs
node verify-ui.mjs
node verify-preservation.mjs /path/to/original/frontend
```

The preservation command needs an extracted copy of the original uploaded frontend. It does not compare against a different historical project.

The optional browser suites expect Playwright available to the test runner and a local Vite server. To install verification tooling without changing the shipped manifests, run `npm install --no-save --package-lock=false playwright` and `npx playwright install chromium`. Keep `npm run dev` running in a separate terminal, then run:

```bash
node tests/browser-regression.mjs
node tests/theme-matrix.mjs
```

Its API fixtures intercept every /api/ request. It never tests against or writes to the real Laravel server. Screenshots generated by this optional suite are local QA output; they are not part of the shipped project.

The theme matrix measures representative form, select, table and button contrast and opens charts and the assistant in all 18 preset/mode combinations.

`QA_RESULTS.md` records the actual completed checks and limitations for this delivery.

## 23. Known limitations inherited from the supplied frontend

| Area | Actual state |
| --- | --- |
| Real authentication/backend | Requires the user's running Laravel service; no backend credentials were supplied here |
| Users, staff, departments, designations | Existing list/save/edit API integrations remain |
| Roles | Sample listing and original save endpoint; existing edit stub is not a new implemented edit workflow |
| Branch and vehicle reference screens | Original sample lists; form submissions remain frontend-only |
| Vehicle registration | Original multipart preparation/logging only; no save endpoint was supplied |
| Dashboard and rental reporting | Original sample metrics and schedules, not live reporting |
| User/staff selection options | Original option sources retained, including existing hard-coded options |
| AI agent/chatbot | Not connected; a real adapter/service is future work |
| Pricing | Illustrative concepts only, no confirmed package limits or commercial billing |
| Lint | Five original effect-dependency warnings are retained to avoid changing request timing or auth behavior |
| Chart measurement | A stable initial chart size is provided before responsive measurement; browser containers are verified separately |

Those original limitations are disclosed in the interface where relevant. The redesign does not make their backend functionality complete.

## 24. Where to make common changes

| What to update | File |
| --- | --- |
| Official primary color/default presets | src/contexts/appearance-config.js, then run the generator |
| All palette tokens | scripts/generate-appearance.mjs |
| Logo selection/presentation | src/components/layout/Brand.jsx and src/styles/enterprise.css |
| Original/optimized artwork | public/brand/ |
| Light/dark preference behavior | src/contexts/ThemeProvider.jsx and appearance-utils.js |
| Settings controls | src/views/Settings.jsx |
| Navigation destinations | src/components/layout/navigation.js and src/router.jsx |
| Landing copy and sections | src/views/Landing.jsx |
| Driving scene and vehicle asset | DrivingScene.jsx, marketing.css, public/touring-sedan.webp |
| Pricing concepts | PricingSection.jsx |
| Real assistant adapter | FloatingAssistant.jsx prop at its Landing.jsx call site |
| Shared form styling/errors | enterprise.css, ui/input.jsx, ErrorField.jsx |
| Guided tour steps | src/components/layout/ProductTour.jsx |

## 25. Future improvements

Connect the existing preview-only modules to confirmed backend contracts in a separate functional change. Add real rental data/reporting only when supported by the service. Supply final subscription terms before implementing billing. Connect and validate a real AI adapter before enabling message input.

A separate accessibility review can cover full keyboard journeys, screen readers, additional browser engines, and every text/background combination. A real backend end-to-end pass should cover production authentication, authorization, database persistence, and server-side validation.

## 26. Dependency and infrastructure policy

The supplied dependency manifests are unchanged. Linux-native build bindings and a headless browser were obtained only as local verification tooling in this environment. They are not included in the deliverable or added to package.json.

The frontend stays on the existing framework and build system. No site was published, no remote repository was modified, and no backend configuration was changed.
