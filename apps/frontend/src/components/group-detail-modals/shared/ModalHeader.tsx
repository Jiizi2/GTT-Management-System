type ModalHeaderProps = {
  title: string;
  titleId: string;
  onClose: () => void;
  centered?: boolean;
};

export function ModalHeader({
  title,
  titleId,
  onClose,
  centered = false,
}: ModalHeaderProps) {
  const headerClass = centered
    ? "flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"
    : "flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4";

  return (
    <div className={headerClass}>
      <h2
        id={titleId}
        className="text-2xl font-bold tracking-tight text-slate-900"
      >
        {title}
      </h2>

      <button
        type="button"
        className="serene-dialog-close-shell hover:border-primary"
        onClick={onClose}
        aria-label={`Close ${title.toLowerCase()} popup`}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          close
        </span>
      </button>
    </div>
  );
}
