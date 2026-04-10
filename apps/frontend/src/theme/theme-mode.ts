export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "serene-ui-theme";
const THEME_ATTRIBUTE = "data-theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

function resolveSystemThemeMode(): ThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(savedTheme)) {
      return savedTheme;
    }
  } catch {
    // Ignore storage access failures and fall back to system preference.
  }

  return resolveSystemThemeMode();
}

export function applyThemeMode(theme: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.setAttribute(THEME_ATTRIBUTE, theme);
  root.style.colorScheme = theme;
}

export function persistThemeMode(theme: ThemeMode): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage access failures.
  }
}

export function initializeThemeMode(): ThemeMode {
  const initialThemeMode = resolveInitialThemeMode();
  applyThemeMode(initialThemeMode);
  return initialThemeMode;
}

