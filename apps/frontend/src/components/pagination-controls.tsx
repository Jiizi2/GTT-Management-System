export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  itemLabel,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  if (totalItems === 0 || totalPages <= 1) {
    return null;
  }

  const maxButtons = 5;
  const halfWindow = Math.floor(maxButtons / 2);
  let startPage = Math.max(1, currentPage - halfWindow);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  startPage = Math.max(1, endPage - maxButtons + 1);

  const pageNumbers: number[] = [];
  for (let page = startPage; page <= endPage; page += 1) {
    pageNumbers.push(page);
  }

  return (
    <div
      className="mt-6 flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4 shadow-ambient"
      role="navigation"
      aria-label={`${itemLabel} pagination`}
    >
      <p className="text-sm text-on-surface-variant">
        Showing <strong className="font-semibold text-on-surface">{rangeStart}</strong>-
        <strong className="font-semibold text-on-surface">{rangeEnd}</strong> of{" "}
        <strong className="font-semibold text-on-surface">{totalItems}</strong> {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-container-lowest text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            chevron_left
          </span>
        </button>

        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm font-semibold transition ${
              currentPage === pageNumber
                ? "bg-primary text-white shadow-cta-soft"
                : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
            }`}
            onClick={() => onPageChange(pageNumber)}
            aria-current={currentPage === pageNumber ? "page" : undefined}
            aria-label={`Go to page ${pageNumber}`}
          >
            {pageNumber}
          </button>
        ))}

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-container-lowest text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            chevron_right
          </span>
        </button>
      </div>
    </div>
  );
}



