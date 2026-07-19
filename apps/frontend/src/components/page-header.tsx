import type { ReactNode } from "react";

export function PageHeader({
  variant = "hero",
  eyebrow,
  title,
  description,
  toolbar,
  actions,
  className = "",
}: {
  variant?: "hero" | "compact" | "detail";
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  toolbar?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const compact = variant === "compact";
  const detail = variant === "detail";
  return (
    <>
      {toolbar ? <div className="serene-page-toolbar pr-14">{toolbar}</div> : null}
      <header
        className={`${compact ? "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" : "serene-section flex flex-col gap-4 sm:p-6 md:flex-row md:items-start md:justify-between"} ${className}`.trim()}
      >
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary/85">{eyebrow}</p>
          ) : null}
          <h1
            className={`${compact ? "mt-1" : eyebrow ? "mt-2" : ""} font-display text-[1.875rem] font-extrabold leading-tight tracking-tight text-on-surface sm:text-4xl ${detail ? "sm:text-[2rem]" : ""}`.trim()}
          >
            {title}
          </h1>
          {description ? (
            <div className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">{actions}</div>
        ) : null}
      </header>
    </>
  );
}
