import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const element = document.getElementById("root");
if (!element) throw new Error("DayFlow root element not found");

createRoot(element).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline shell contains only public static assets. Authenticated API responses
// and all personal data are intentionally never handled by the service worker.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // PWA is progressive enhancement; do not mask an authenticated app failure.
    });
  });
}
