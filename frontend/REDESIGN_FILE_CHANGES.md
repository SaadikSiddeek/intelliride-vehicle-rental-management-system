# IntelliRide redesign file inventory

This inventory lists files added or updated relative to the supplied frontend ZIP. Runtime dependencies, environment files, Axios, authentication context/layout, navigation definitions, dashboard sample data and table-search behavior are preserved.

| File | State | Change |
| --- | --- | --- |
| `FRONTEND_UI_REDESIGN_GUIDE.md` | Updated | Complete implementation and customization guide with accurate limitations. |
| `README-START-HERE.md` | Updated | Current startup commands and Windows npm.cmd alternative. |
| `README.md` | Updated | Current startup commands, delivered scope and guide links. |
| `eslint.config.js` | Updated | Narrowly allow the original mixed auth-context export without editing auth source. |
| `index.html` | Updated | Official favicon and shared pre-paint appearance initialization. |
| `public/appearance-init.js` | Added | Generated early appearance initialization using presentation storage only. |
| `public/brand/favicon.png` | Added | Optimized official artwork, proportionally resized without recoloring. |
| `public/brand/mark-color.webp` | Added | Optimized official artwork, proportionally resized without recoloring. |
| `public/brand/mark-white.webp` | Added | Optimized official artwork, proportionally resized without recoloring. |
| `public/brand/originals/Clean-white-IntelliRide-logo-4.png` | Added | Unchanged copy of supplied official logo artwork. |
| `public/brand/originals/IntelliRide-IR-road-monogram-icon-3.png` | Added | Unchanged copy of supplied official logo artwork. |
| `public/brand/originals/IntelliRide-White-Logo-on-Navy-6.png` | Added | Unchanged copy of supplied official logo artwork. |
| `public/brand/originals/IntelliRide-monochrome-white-logo-2.png` | Added | Unchanged copy of supplied official logo artwork. |
| `public/brand/originals/IntelliRide-route-monogram-logo-1.png` | Added | Unchanged copy of supplied official logo artwork. |
| `public/brand/originals/White-iR-Road-Monogram-5.png` | Added | Unchanged copy of supplied official logo artwork. |
| `public/brand/originals/White-iR-roadway-monogram-7.png` | Added | Unchanged copy of supplied official logo artwork. |
| `public/brand/wordmark-color.webp` | Added | Optimized official artwork, proportionally resized without recoloring. |
| `public/brand/wordmark-white.webp` | Added | Optimized official artwork, proportionally resized without recoloring. |
| `public/touring-sedan-original.png` | Added | Original generated vehicle artwork retained for maintenance. |
| `public/touring-sedan.webp` | Added | Optimized transparent realistic vehicle asset used by driving scenes. |
| `public/vehicle-placeholder.svg` | Added | Neutral local fallback for unavailable remote sample logos. |
| `scripts/generate-appearance.mjs` | Added | Generate complete theme tokens and pre-paint code from shared configuration. |
| `src/components/CarLoader.jsx` | Updated | Preserve the portal loading contract with restrained official-brand feedback. |
| `src/components/ErrorField.jsx` | Updated | Shared accessible presentation for existing server/client field errors. |
| `src/components/GuestLayout.jsx` | Updated | Official branding and automotive authentication presentation; same guest redirect. |
| `src/components/Header.jsx` | Updated | Guided tour, keyboard page-search shortcut and refined appearance controls. |
| `src/components/TableLoading.jsx` | Updated | Add skeleton loading rows. |
| `src/components/dashboard/Charts.jsx` | Updated | Calculate the same donut segments without outer-variable mutation; provide stable initial chart dimensions. |
| `src/components/layout/Brand.jsx` | Updated | Render official full and compact logo variants with theme-aware selection. |
| `src/components/layout/ProductTour.jsx` | Added | Five-step tour with existing module links and accessible dialog behavior. |
| `src/components/marketing/DrivingScene.jsx` | Added | Photorealistic sedan, seamless road/horizon loop and pause control. |
| `src/components/marketing/FloatingAssistant.jsx` | Added | Disconnected chat panel and optional real-service adapter interface. |
| `src/components/marketing/PricingSection.jsx` | Added | Three compact illustrative USD concepts and expandable comparison. |
| `src/components/marketing/ProductExplorer.jsx` | Added | Load actual dashboard, vehicle and settings previews near the viewport. |
| `src/components/ui/button.jsx` | Updated | Document the existing shared shadcn export for lint. |
| `src/components/ui/input.jsx` | Updated | Add optional inline errors and accessible associations to native controls. |
| `src/contexts/ThemeProvider.jsx` | Updated | Apply validated appearance, system mode, quick-switch favorites and persistence. |
| `src/contexts/appearance-config.js` | Updated | Official brand constants, nine presets and functional preference defaults. |
| `src/contexts/appearance-utils.js` | Added | Validate stored preferences and calculate accessible accent colors. |
| `src/index.css` | Updated | Import the generated navy palettes and new shared presentation styles. |
| `src/main.jsx` | Updated | Show a theme-aware branded loading fallback around lazy screens. |
| `src/router.jsx` | Updated | Load existing screens lazily while preserving route paths and order. |
| `src/styles/appearance-tokens.css` | Added | Generated semantic colors for nine presets in both modes. |
| `src/styles/enterprise.css` | Added | Application-wide shell, forms, tables, dashboard, settings, logos, and responsive presentation. |
| `src/styles/marketing.css` | Added | Responsive public site, compact pricing, driving scene and assistant presentation. |
| `src/styles/premium.css` | Updated | Retain useful app/settings refinements; remove the previous teal themes and obsolete marketing layer. |
| `src/views/Landing.jsx` | Updated | Complete navy public product site with transparent capabilities and authenticated workspace links. |
| `src/views/Login.jsx` | Updated | Use RHF values and inline validation with the same login request/response behavior. |
| `src/views/Settings.jsx` | Updated | Official brand preview, nine presets, and working additional appearance controls. |
| `src/views/Signup.jsx` | Updated | Use RHF values and confirmation validation with the same signup contract. |
| `src/views/branch/Branch.jsx` | Updated | Migrate the existing preview form to RHF; preserve payload keys, sample records and original nonpersistent behavior. |
| `src/views/department/Department.jsx` | Updated | Preserve handlers; share errors, expose loading state and improve empty-state copy. |
| `src/views/designation/Designation.jsx` | Updated | Preserve handlers; expose edit loading and defer submit wrappers to events. |
| `src/views/designation/DesignationForm.jsx` | Updated | Share accessible error presentation without changing registration rules. |
| `src/views/features/Features.jsx` | Updated | Migrate the existing preview form to RHF; preserve payload keys, sample records and original nonpersistent behavior. |
| `src/views/fuelType/FuelType.jsx` | Updated | Migrate the existing preview form to RHF; preserve payload keys, sample records and original nonpersistent behavior. |
| `src/views/registerVehicle/RegisterVehicle.jsx` | Updated | Migrate the existing preview form to RHF; preserve payload keys, sample records and original nonpersistent behavior. |
| `src/views/role/Role.jsx` | Updated | Preserve save handler and sample table; use the registered status subscription for presentation. |
| `src/views/staff/Staff.jsx` | Updated | Preserve the original top-level save payload; share accessible errors and loading feedback. |
| `src/views/transmission/TransmissionType.jsx` | Updated | Migrate the existing preview form to RHF; preserve payload keys, sample records and original nonpersistent behavior. |
| `src/views/users/Users.jsx` | Updated | Preserve handlers and validation; share accessible errors and edit-loading feedback. |
| `src/views/vehicleBrand/VehicleBrand.jsx` | Updated | Migrate the existing preview form to RHF; preserve payload keys, sample records and original nonpersistent behavior. |
| `src/views/vehicleCategory/VehicleCategory.jsx` | Updated | Migrate the existing preview form to RHF; preserve payload keys, sample records and original nonpersistent behavior. |
| `src/views/vehicleModel/VehicleModel.jsx` | Updated | Migrate the existing preview form to RHF; preserve payload keys, sample records and original nonpersistent behavior. |
| `tests/browser-regression.mjs` | Added | Repeatable controlled browser checks; all API traffic is intercepted. |
| `verify-preservation.mjs` | Updated | Compare original API calls, handlers, tables, routes, core files and multipart keys. |
| `verify-redesign.mjs` | Updated | Source/import, RHF coverage, palette contrast and pre-paint preference checks. |
| `verify-ui.mjs` | Updated | Render smoke checks for 21 views in both modes without a live backend. |
| `vite.config.js` | Updated | Equivalent path alias using an ES-module-safe config directory. |

| `QA_RESULTS.md` | Added | Actual build, lint, source-preservation, render and browser verification results and limits. |
| `REDESIGN_FILE_CHANGES.md` | Added | Detailed file-by-file redesign inventory. |

The uploaded `node_modules` and generated `dist` are omitted from the deliverable. Run `npm ci` to install platform-appropriate dependencies.
