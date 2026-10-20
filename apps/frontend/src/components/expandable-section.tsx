import type { DetailsHTMLAttributes, ReactNode } from "react";
import { Icon } from "./icon";

export function ExpandableSection({
  summary,
  children,
  className = "",
  ...props
}: Omit<DetailsHTMLAttributes<HTMLDetailsElement>, "children"> & { summary: ReactNode; children: ReactNode }) {
  return (
    <details className={`group ${className}`.trim()} {...props}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-primary [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">{summary}</span>
        <Icon name="expand_more" className="text-lg transition-transform group-open:rotate-180" />
      </summary>
      {children}
    </details>
  );
}
