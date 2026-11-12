import { Analytics } from "@vercel/analytics/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { env } from "../config/env";
import { App } from "./App";
import { AppProviders } from "./app-providers";
import "@fontsource-variable/inter/wght.css";
import "./global.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    {env.VITE_VERCEL_ANALYTICS_MODE ? <Analytics mode={env.VITE_VERCEL_ANALYTICS_MODE} /> : null}
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
