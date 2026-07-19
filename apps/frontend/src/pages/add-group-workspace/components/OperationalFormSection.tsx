import type { ReactNode } from "react";

export function OperationalFormSection({
  step,
  icon,
  title,
  description,
  children,
  className = "",
}: {
  step: number;
  icon: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`border-b border-outline-variant/35 pb-5 last:border-b-0 last:pb-0 ${className}`.trim()}
      aria-labelledby={`itinerary-form-section-${step}`}
    >
      <header className="flex items-start gap-3 pb-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            {icon}
          </span>
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">Section {step}</span>
          </div>
          <h3 id={`itinerary-form-section-${step}`} className="mt-1 text-base font-bold text-on-surface">
            {title}
          </h3>
          <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">{description}</p>
        </div>
      </header>

      <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">{children}</div>
    </section>
  );
}
