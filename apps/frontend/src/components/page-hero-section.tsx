import type { ReactNode } from "react";

type PageHeroSectionProps = {
  eyebrow: string;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeroSection({ eyebrow, title, description, actions, className = "" }: PageHeroSectionProps) {
  return (
    <section
      className={`serene-section flex flex-col gap-4 sm:p-6 md:flex-row md:items-start md:justify-between ${className}`.trim()}
    >
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary/85">{eyebrow}</p>
        <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        <div className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant sm:text-base">{description}</div>
      </div>

      {actions ? <div className="flex w-full items-end justify-end md:w-auto md:self-start">{actions}</div> : null}
    </section>
  );
}
