import type { ReactNode } from "react";

type ModalFooterProps = {
  children?: ReactNode;
};

export function ModalFooter({ children }: ModalFooterProps) {
  return <div className="serene-dialog-footer-bar">{children}</div>;
}

type ModalFooterButtonProps = {
  onClick?: () => void;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "danger-brand";
  disabled?: boolean;
  type?: "button" | "submit";
  isLoading?: boolean;
};

export function ModalFooterButton({
  onClick,
  children,
  variant = "secondary",
  disabled = false,
  type = "button",
  isLoading = false,
}: ModalFooterButtonProps) {
  const baseClass = "rounded-xl px-4 py-2 text-sm font-semibold";

  const variantClasses = {
    primary: `serene-btn-primary ${baseClass} disabled:cursor-not-allowed disabled:opacity-45`,
    secondary: `serene-btn-secondary ${baseClass}`,
    danger: `serene-btn-danger ${baseClass}`,
    "danger-brand":
      "inline-flex items-center gap-1.5 rounded-xl bg-brand-tertiary px-4 py-2 text-sm font-semibold text-brand-neutral transition hover:bg-brand-tertiary/90 disabled:cursor-not-allowed disabled:opacity-45",
  };

  return (
    <button
      type={type}
      className={variantClasses[variant]}
      onClick={onClick}
      disabled={disabled || isLoading}
    >
      {isLoading ? "Saving..." : children}
    </button>
  );
}
