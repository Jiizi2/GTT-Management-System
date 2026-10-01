import type { ReactNode } from "react";

export function OperationalFormSection({
  step,
  title,
  description,
  children,
  className = "",
  gridClassName = "grid gap-x-5 gap-y-4 md:grid-cols-2",
  compactMobile = false,
}: {
  step: number;
  icon: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  gridClassName?: string;
  compactMobile?: boolean;
}) {
  return (
    <section className={`min-w-0 ${className}`.trim()} aria-labelledby={`itinerary-form-section-${step}`}>
      <header className={`pb-3 ${compactMobile ? "max-sm:pb-2" : ""}`}>
        <div className="min-w-0 flex-1">
          <h3 id={`itinerary-form-section-${step}`} className="text-base font-semibold tracking-tight text-on-surface">
            {title}
          </h3>
          <p className={`mt-1 text-xs leading-relaxed text-on-surface-variant ${compactMobile ? "sr-only" : ""}`}>
            {description}
          </p>
        </div>
      </header>

      <div className={gridClassName}>{children}</div>
    </section>
  );
}
