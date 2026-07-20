import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalFocusTrap } from "./use-modal-focus-trap";

export type DialogSize = "sm" | "md" | "lg";

export interface DialogShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  size?: DialogSize;
  children: ReactNode;
}

export function DialogShell({
  isOpen,
  onClose,
  title,
  size = "md",
  children,
}: DialogShellProps) {
  // Use existing workspace modal focus trap hook for accessibility
  const dialogRef = useModalFocusTrap<HTMLDivElement>({
    isActive: isOpen,
    onClose,
  });

  if (!isOpen) {
    return null;
  }

  // Size classes mapped to GTT design tokens
  const sizeClasses: Record<DialogSize, string> = {
    sm: "max-w-md",   // 448px (alerts, confirmations)
    md: "max-w-xl",   // 576px (standard data fields)
    lg: "max-w-4xl",   // 896px (larger timelines, grids)
  };

  const overlayClass = "fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20 serene-modal-overlay";
  const shellClass = `serene-modal-shell w-full ${sizeClasses[size]}`;

  return createPortal(
    <div className={overlayClass} onClick={onClose}>
      <div
        ref={dialogRef}
        className={shellClass}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            className="serene-dialog-close-shell hover:border-primary"
            onClick={onClose}
            aria-label={`Close ${title} popup`}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
