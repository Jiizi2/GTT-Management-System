import { Icon } from "./icon";

export function ReadOnlyIndicator({ label = "Read-only", className = "" }: { label?: string; className?: string }) {
  return (
    <span
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-xs font-extrabold text-primary ${className}`.trim()}
    >
      <Icon name="visibility" className="text-base" />
      {label}
    </span>
  );
}
