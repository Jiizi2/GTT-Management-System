export function ReadOnlyIndicator({ label = "Read-only" }: { label?: string }) {
  return (
    <span className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-xs font-extrabold text-primary">
      <span className="material-symbols-outlined text-base" aria-hidden="true">
        visibility
      </span>
      {label}
    </span>
  );
}
