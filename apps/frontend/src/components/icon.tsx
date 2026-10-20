export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined shrink-0 ${className}`.trim()} aria-hidden="true">
      {name}
    </span>
  );
}
