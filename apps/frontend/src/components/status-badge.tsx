import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "./icon";

const tones = {
  complete: "bg-emerald-100 text-emerald-800",
  "in-progress": "bg-sky-100 text-sky-800",
  waiting: "bg-amber-100 text-amber-800",
  attention: "bg-rose-100 text-rose-800",
  error: "bg-error-container text-on-error-container",
  neutral: "bg-surface-container-high text-on-surface-variant",
} as const;

export type StatusTone = keyof typeof tones;

export function StatusBadge({
  tone = "neutral",
  children,
  icon,
  className = "",
  ...props
}: {
  tone?: StatusTone;
  children: ReactNode;
  icon?: string;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      {...props}
      data-tone={tone}
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]} ${className}`.trim()}
    >
      {icon ? <Icon name={icon} className="text-sm" /> : null}
      {children}
    </span>
  );
}
