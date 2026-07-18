import type { ReactNode } from "react";

const defaults = {
  loading: { icon: "sync", title: "Memuat data", tone: "text-sky-700" },
  empty: { icon: "inventory_2", title: "Belum ada data", tone: "text-on-surface-variant" },
  error: { icon: "error", title: "Data belum dapat dimuat", tone: "text-rose-700" },
  "not-found": { icon: "search_off", title: "Data tidak ditemukan", tone: "text-on-surface-variant" },
  restricted: { icon: "lock", title: "Akses terbatas", tone: "text-amber-700" },
} as const;

export function StatePanel({
  state,
  title,
  description,
  icon,
  action,
  compact = false,
}: {
  state: keyof typeof defaults;
  title?: ReactNode;
  description?: ReactNode;
  icon?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const preset = defaults[state];
  return (
    <section
      className={`serene-empty-state ${compact ? "p-6" : "p-8 sm:p-10"}`}
      role={state === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <span
        className={`material-symbols-outlined text-4xl ${preset.tone} ${state === "loading" ? "animate-spin" : ""}`}
        aria-hidden="true"
      >
        {icon ?? preset.icon}
      </span>
      <h2 className="mt-3 text-xl font-extrabold text-on-surface">{title ?? preset.title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-on-surface-variant">{description}</p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </section>
  );
}
