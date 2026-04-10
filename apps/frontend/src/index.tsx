import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { initializeThemeMode } from "./components/theme-toggle-button";

const container = document.getElementById("app");

if (!container) {
  throw new Error("Missing #app container.");
}

initializeThemeMode();

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
