import type { ReactNode } from "react";

const tones = {
  complete: "bg-emerald-100 text-emerald-800",
  "in-progress": "bg-sky-100 text-sky-800",
  waiting: "bg-amber-100 text-amber-800",
  attention: "bg-rose-100 text-rose-800",
  error: "bg-error-container text-on-error-container",
  neutral: "bg-surface-container-high text-on-surface-variant",
} as const;

export function StatusBadge({
  tone = "neutral",
  children,
  icon,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  icon?: string;
}) {
  return (
    <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]}`}>
      {icon ? (
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
}
