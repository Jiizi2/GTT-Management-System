import type { ReactNode } from "react";

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  icon: string;
}) {
  return (
    <section className="grid min-h-[60vh] place-items-center px-6 py-12">
      <div className="w-full max-w-xl rounded-3xl bg-surface-container-lowest p-8 text-center shadow-float backdrop-blur-serene">
        <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <span className="material-symbols-outlined" aria-hidden="true">
            {icon}
          </span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-on-surface">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-on-surface-variant">{description}</p>
      </div>
    </section>
  );
}
