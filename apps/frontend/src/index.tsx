import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import { initializeThemeMode } from "./theme/theme-mode";
import { ThemeProvider } from "./theme/theme-provider";

const container = document.getElementById("app");

if (!container) {
  throw new Error("Missing #app container.");
}

initializeThemeMode();

createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
