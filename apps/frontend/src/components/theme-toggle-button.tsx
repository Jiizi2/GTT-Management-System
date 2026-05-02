import { useThemeMode } from "../theme/theme-provider";

type ThemeToggleButtonProps = {
  className?: string;
  variant?: "page" | "floating";
};

function joinClasses(...values: Array<string | undefined>): string {
  return values.filter((value) => typeof value === "string" && value.trim().length > 0).join(" ");
}

export function ThemeToggleButton({ className, variant = "page" }: ThemeToggleButtonProps) {
  const { theme, toggleTheme } = useThemeMode();

  const isDarkMode = theme === "dark";
  const nextThemeLabel = isDarkMode ? "light" : "dark";
  const buttonClassName = joinClasses(
    variant === "floating" ? "serene-theme-toggle-floating" : "serene-theme-toggle-shell",
    className,
  );

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
