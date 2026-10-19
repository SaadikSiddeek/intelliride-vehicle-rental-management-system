import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import "./index.css";
import "flatpickr/dist/flatpickr.min.css";

import router from "./router";
import { ContextProvider } from "./contexts/ContextProvider";
import { ThemeProvider } from "./contexts/ThemeProvider";

import AppToaster from "@/components/AppToaster";
import Brand from "./components/layout/Brand";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <ContextProvider>
        <Suspense
          fallback={
            <div className="app-opening" role="status">
              <Brand compact />
              <p>Opening your workspace…</p>
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>

        <AppToaster />
      </ContextProvider>
    </ThemeProvider>
  </StrictMode>,
);
