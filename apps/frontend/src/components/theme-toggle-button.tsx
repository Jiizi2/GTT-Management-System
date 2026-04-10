import { useThemeMode } from "../theme/theme-provider";

type ThemeToggleButtonProps = {
  className?: string;
};

export function ThemeToggleButton({ className }: ThemeToggleButtonProps) {
  const { theme, toggleTheme } = useThemeMode();

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
      onClick={toggleTheme}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {isDarkMode ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
