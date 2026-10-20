import { IconButton } from "./button";

const paginationCopy = {
  en: {
    showing: "Showing",
    of: "of",
    previous: "Previous page",
    next: "Next page",
    page: (page: number) => `Go to page ${page}`,
    navigation: (label: string) => `${label} pagination`,
  },
  id: {
    showing: "Menampilkan",
    of: "dari",
    previous: "Halaman sebelumnya",
    next: "Halaman berikutnya",
    page: (page: number) => `Ke halaman ${page}`,
    navigation: (label: string) => `Navigasi halaman ${label}`,
  },
} as const;

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  rangeStart,
  rangeEnd,
  itemLabel,
  onPageChange,
  touchSafe = false,
  locale = "en",
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  rangeStart: number;
  rangeEnd: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
  touchSafe?: boolean;
  locale?: keyof typeof paginationCopy;
}) {
  if (totalItems === 0 || totalPages <= 1) {
    return null;
  }

  const maxButtons = 5;
  const copy = paginationCopy[locale];
  const halfWindow = Math.floor(maxButtons / 2);
  let startPage = Math.max(1, currentPage - halfWindow);
  const endPage = Math.min(totalPages, startPage + maxButtons - 1);
  startPage = Math.max(1, endPage - maxButtons + 1);

  const pageNumbers: number[] = [];
  for (let page = startPage; page <= endPage; page += 1) {
    pageNumbers.push(page);
  }

  return (
    <div
      className="mt-6 flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4 shadow-ambient"
      role="navigation"
      aria-label={copy.navigation(itemLabel)}
    >
      <p className="text-sm text-on-surface-variant">
        {copy.showing} <strong className="font-semibold text-on-surface">{rangeStart}</strong>-
        <strong className="font-semibold text-on-surface">{rangeEnd}</strong> {copy.of}{" "}
        <strong className="font-semibold text-on-surface">{totalItems}</strong> {itemLabel}
      </p>

      <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <IconButton
          icon="chevron_left"
          className={`inline-flex items-center justify-center rounded-md bg-surface-container-lowest text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary disabled:cursor-not-allowed disabled:opacity-45 ${touchSafe ? "h-11 w-11" : "h-9 w-9"}`}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label={copy.previous}
        />

        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={`serene-focus-ring inline-flex items-center justify-center rounded-md px-3 text-sm font-semibold transition ${touchSafe ? "h-11 w-11" : "h-9 min-w-9"} ${
              currentPage === pageNumber
                ? "bg-primary text-on-primary shadow-cta-soft"
                : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
            }`}
            onClick={() => onPageChange(pageNumber)}
            aria-current={currentPage === pageNumber ? "page" : undefined}
            aria-label={copy.page(pageNumber)}
          >
            {pageNumber}
          </button>
        ))}

        <IconButton
          icon="chevron_right"
          className={`inline-flex items-center justify-center rounded-md bg-surface-container-lowest text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary disabled:cursor-not-allowed disabled:opacity-45 ${touchSafe ? "h-11 w-11" : "h-9 w-9"}`}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label={copy.next}
        />
      </div>
    </div>
  );
}
