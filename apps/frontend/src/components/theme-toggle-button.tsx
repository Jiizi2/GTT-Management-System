import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "serene-ui-theme";

type ThemeMode = "light" | "dark";

type ThemeToggleButtonProps = {
  className?: string;
};

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

function resolveSystemTheme(): ThemeMode {
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
    // Ignore storage access errors and fall back to system preference.
  }

  return resolveSystemTheme();
}

export function applyThemeMode(theme: ThemeMode): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
}

function persistThemeMode(theme: ThemeMode): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage access errors.
  }
}

export function initializeThemeMode(): ThemeMode {
  const initialTheme = resolveInitialThemeMode();
  applyThemeMode(initialTheme);
  return initialTheme;
}

export function ThemeToggleButton({ className }: ThemeToggleButtonProps) {
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialThemeMode());

  useEffect(() => {
    applyThemeMode(theme);
    persistThemeMode(theme);
  }, [theme]);

  const isDarkMode = theme === "dark";
  const nextThemeLabel = isDarkMode ? "light" : "dark";
  const buttonClassName =
    className?.trim() ||
    "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-lowest hover:text-primary";

  return (
    <button
      type="button"
      className={buttonClassName}
      aria-label={`Switch to ${nextThemeLabel} mode`}
      title={`Switch to ${nextThemeLabel} mode`}
      onClick={() => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"))}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {isDarkMode ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
