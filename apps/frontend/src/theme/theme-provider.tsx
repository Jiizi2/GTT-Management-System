import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { THEME_STORAGE_KEY, applyThemeMode, persistThemeMode, resolveInitialThemeMode, type ThemeMode } from "./theme-mode";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: Dispatch<SetStateAction<ThemeMode>>;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>(() => resolveInitialThemeMode());

  useEffect(() => {
    applyThemeMode(theme);
    persistThemeMode(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncThemeFromStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY || event.newValue === event.oldValue) {
        return;
      }

      const nextTheme = resolveInitialThemeMode();
      setTheme(nextTheme);
    };

    window.addEventListener("storage", syncThemeFromStorage);
    return () => {
      window.removeEventListener("storage", syncThemeFromStorage);
    };
  }, []);

  const contextValue = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark")),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useThemeMode(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeProvider.");
  }

  return context;
}
