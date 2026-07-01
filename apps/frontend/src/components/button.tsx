import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "tertiary" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  // Base classes mapping to GTT design system
  const baseClass = "inline-flex items-center justify-center gap-1.5 font-semibold transition active:scale-[0.99] disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-45 serene-focus-ring";

  // Variant classes utilizing existing serene styling rules
  const variantClasses: Record<ButtonVariant, string> = {
    primary: "serene-btn-primary",
    secondary: "serene-btn-secondary",
    tertiary: "serene-btn-tertiary",
    danger: "serene-btn-danger",
  };

  // Size classes aligning to Design Token Matrix
  const sizeClasses: Record<ButtonSize, string> = {
    sm: "h-8 px-3 text-xs rounded-sm",
    md: "h-11 px-4 text-sm rounded-md",
    lg: "h-12 px-6 text-base rounded-md",
  };

  const resolvedClass = `${baseClass} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim();

  return (
    <button type={type} className={resolvedClass} {...props}>
      {children}
    </button>
  );
}
