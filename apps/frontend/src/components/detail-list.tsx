import type { ReactNode } from "react";

export function DetailList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <dl className={`divide-y divide-outline-variant/25 ${className}`.trim()}>{children}</dl>;
}

export function DetailItem({ label, value, stacked = false }: { label: string; value: ReactNode; stacked?: boolean }) {
  return (
    <div className={`${stacked ? "space-y-1" : "flex items-start justify-between gap-4"} py-3 first:pt-0 last:pb-0`}>
      <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
      <dd className={`${stacked ? "" : "max-w-[68%] text-right"} text-sm font-extrabold text-on-surface`}>{value}</dd>
    </div>
  );
}
