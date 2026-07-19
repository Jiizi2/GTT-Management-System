import type { ReactNode } from "react";

const tones = {
  neutral: "bg-surface-container-high text-on-surface-variant",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
} as const;

export function MetricCard({
  icon,
  label,
  value,
  supportingText,
  tone = "neutral",
}: {
  icon: string;
  label: string;
  value: ReactNode;
  supportingText?: ReactNode;
  tone?: keyof typeof tones;
}) {
  return (
    <article className="serene-card flex min-h-[6.5rem] items-center gap-3 rounded-2xl p-4 sm:min-h-[7rem] sm:p-5">
      <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <span className="material-symbols-outlined text-xl" aria-hidden="true">
          {icon}
        </span>
      </span>
      <div className="min-w-0">
        <strong className="block text-2xl font-extrabold leading-none text-on-surface sm:text-3xl">{value}</strong>
        <span className="mt-1 block text-[10px] font-extrabold uppercase leading-tight tracking-[0.1em] text-on-surface-variant sm:text-xs">
          {label}
        </span>
        {supportingText ? <span className="mt-1 block text-xs text-on-surface-variant">{supportingText}</span> : null}
      </div>
    </article>
  );
}
