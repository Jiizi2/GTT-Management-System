import type { HTMLAttributes, ReactNode } from "react";

export type BadgeStatus = "success" | "warning" | "error" | "info" | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status?: BadgeStatus;
  children: ReactNode;
}

export function Badge({
  status = "neutral",
  children,
  className = "",
  ...props
}: BadgeProps) {
  // Base classes mapping to GTT chip system
  const baseClass = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold select-none border border-transparent";

  // Status mapping to GTT serene chips or custom styles
  const statusClasses: Record<BadgeStatus, string> = {
    success: "serene-chip-complete",
    warning: "serene-chip-warning",
    error: "serene-chip-alert",
    info: "bg-sky-100/90 text-sky-800 border-sky-200/60",
    neutral: "bg-slate-100/90 text-slate-800 border-slate-200/60 dark:bg-slate-800/40 dark:text-slate-200 dark:border-slate-700/40",
  };

  const resolvedClass = `${baseClass} ${statusClasses[status]} ${className}`.trim();

  return (
    <span className={resolvedClass} {...props}>
      {children}
    </span>
  );
}
