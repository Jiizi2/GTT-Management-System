import type { ReactNode } from "react";

export function FilterPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`serene-filter-panel ${className}`.trim()}>{children}</section>;
}

export function FilterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`space-y-1.5 ${className}`.trim()}>
      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/80">
        {label}
      </span>
      {children}
    </label>
  );
}

export function FixedValueField({ label, value, icon }: { label: string; value: ReactNode; icon?: string }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/80">
        {label}
      </span>
      <span className="flex min-h-11 items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 text-sm font-bold text-on-surface">
        {icon ? (
          <span className="material-symbols-outlined text-base text-on-surface-variant" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {value}
      </span>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="grid min-h-11 rounded-xl bg-surface-container-high/65 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`min-h-9 rounded-lg px-2 text-xs font-extrabold transition ${value === option.value ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
