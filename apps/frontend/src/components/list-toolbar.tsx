import type { ReactNode } from "react";
import { Button } from "./button";
import { FilterPanel } from "./filter-panel";

export function ListToolbar({
  ariaLabel,
  children,
  footer,
  className = "",
  controlsClassName = "",
}: {
  ariaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  controlsClassName?: string;
}) {
  return (
    <FilterPanel ariaLabel={ariaLabel} className={`serene-list-toolbar ${className}`.trim()}>
      <div className={`min-w-0 ${controlsClassName}`.trim()}>{children}</div>
      {footer ? <div className="mt-4 border-t border-outline-variant/30 pt-3">{footer}</div> : null}
    </FilterPanel>
  );
}

export function ResultSummary({
  children,
  onReset,
  resetLabel = "Reset filter",
  actions,
}: {
  children: ReactNode;
  onReset?: () => void;
  resetLabel?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-on-surface-variant" aria-live="polite" aria-atomic="true">
        {children}
      </p>
      {onReset || actions ? (
        <div className="flex flex-wrap items-center gap-2">
          {onReset ? (
            <Button variant="secondary" onClick={onReset}>
              {resetLabel}
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}
