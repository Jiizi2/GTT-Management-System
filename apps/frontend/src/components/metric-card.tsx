import type { ReactNode } from "react";
import { Icon } from "./icon";

const tones = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-sky-100 text-sky-700",
} as const;

export function MetricCard({
  icon,
  label,
  value,
  supportingText,
  tone = "neutral",
  variant = "card",
  className = "",
}: {
  icon: string;
  label: string;
  value: ReactNode;
  supportingText?: ReactNode;
  tone?: keyof typeof tones;
  variant?: "card" | "compact";
  className?: string;
}) {
  const Container = variant === "compact" ? "div" : "article";
  return (
    <Container
      className={`flex min-w-0 items-center gap-3 ${variant === "card" ? "serene-card min-h-[6.5rem] rounded-2xl p-4 sm:min-h-[7rem] sm:p-5" : ""} ${className}`.trim()}
    >
      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon name={icon} className="text-xl" />
      </span>
      <div className="min-w-0">
        <strong
          key={typeof value === "string" || typeof value === "number" ? String(value) : undefined}
          className="serene-metric-value block text-2xl font-extrabold leading-none text-on-surface sm:text-3xl"
        >
          {value}
        </strong>
        <span className="mt-1 block text-[10px] font-extrabold uppercase leading-tight tracking-[0.1em] text-on-surface-variant sm:text-xs">
          {label}
        </span>
        {supportingText ? <span className="mt-1 block text-xs text-on-surface-variant">{supportingText}</span> : null}
      </div>
    </Container>
  );
}
