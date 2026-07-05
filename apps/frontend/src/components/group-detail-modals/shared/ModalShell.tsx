import type { ReactNode } from "react";
import { useModalFocusTrap } from "../../use-modal-focus-trap";

type ModalShellProps = {
  onClose: () => void;
  children: ReactNode;
  ariaLabelledBy: string;
  size?: "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";
};

export function ModalShell({
  onClose,
  children,
  ariaLabelledBy,
  size = "2xl",
}: ModalShellProps) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });

  const sizeClasses = {
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
  };

  return (
    <div
      className="serene-modal-overlay z-[120] flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={`serene-modal-shell w-full ${sizeClasses[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
