# IntelliRide — navy enterprise frontend

Open `frontend` in your editor, install dependencies, and start the existing app:

```bash
npm ci
npm run dev
```

Use Node.js 22.12+; verification used Node.js 24.19.0. On Windows PowerShell, use `npm.cmd ci` / `npm.cmd run dev` if npm.ps1 is blocked.

Open Vite's printed address, normally http://localhost:3000. Keep your existing Laravel backend running for authentication and API-backed screens. Your original environment files and API contracts are preserved.

The update includes official IntelliRide logos, a navy design system, nine light/dark presets, working appearance preferences, redesigned enterprise screens, React Hook Form across all 15 form containers, a realistic road scene, compact illustrative pricing, real product previews, a guided tour, and a disconnected floating assistant shell.

The existing sample-only branch/vehicle modules and sample dashboard remain clearly labeled. AI and billing services are not connected. Backend-connected behavior was checked with controlled browser responses; a real Laravel/database verification still requires your environment.

Read **FRONTEND_UI_REDESIGN_GUIDE.md** for implementation, customization, and chatbot integration. See **QA_RESULTS.md** for verification and **REDESIGN_FILE_CHANGES.md** for the exact change inventory.

`node_modules`, build output, and verification tools are excluded from this ZIP. Run npm ci on your computer before npm run dev.
