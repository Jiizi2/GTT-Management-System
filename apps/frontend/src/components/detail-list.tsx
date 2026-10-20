import type { ReactNode } from "react";
import { Icon } from "./icon";

export function DetailList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <dl className={`divide-y divide-outline-variant/25 ${className}`.trim()}>{children}</dl>;
}

export function DetailItem({
  label,
  value,
  stacked = false,
  icon,
  className = "",
}: {
  label: string;
  value: ReactNode;
  stacked?: boolean;
  icon?: string;
  className?: string;
}) {
  return (
    <div
      className={`min-w-0 ${stacked ? "space-y-1" : "flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"} ${className}`.trim()}
    >
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant">
        {icon ? <Icon name={icon} className="text-base text-primary" /> : null}
        {label}
      </dt>
      <dd
        className={`${stacked ? "" : "max-w-[68%] text-right"} min-w-0 break-words text-sm font-extrabold text-on-surface`}
      >
        {value}
      </dd>
    </div>
  );
}
