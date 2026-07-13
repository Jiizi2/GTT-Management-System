import { Badge } from "../../../components/badge";
import { SereneSelect } from "../../../components/serene-select";
import {
  formatDateLabel,
  getAvatarToneByStatus,
  getInvoiceStatusDisplayLabel,
  resolveInvoiceDisplayTotals,
  formatCurrencyLabel,
  type InvoiceRow,
} from "../helpers/invoice-page-shared";

export type DueMonthOption = {
  value: string;
  label: string;
};

// ==========================================
// 1. INVOICE SUMMARY BADGES
// ==========================================

export function InvoiceSummaryBadges({
  paidCount,
  partiallyPaidCount,
  pendingCount,
  overdueCount,
  cancelledCount,
  isDarkMode,
}: {
  paidCount: number;
  partiallyPaidCount: number;
  pendingCount: number;
  overdueCount: number;
  cancelledCount: number;
  isDarkMode: boolean;
}) {
  const paidSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-primary/35 bg-primary/16 px-3 py-1 text-xs font-bold leading-none text-primary"
    : "inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold leading-none text-emerald-700";

  const pendingSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-warning/35 bg-warning/16 px-3 py-1 text-xs font-bold leading-none text-warning"
    : "inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold leading-none text-amber-700";

  const overdueSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-tertiary/35 bg-tertiary/16 px-3 py-1 text-xs font-bold leading-none text-tertiary"
    : "inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold leading-none text-rose-700";

  const partiallyPaidSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-sky-500/35 bg-sky-500/16 px-3 py-1 text-xs font-bold leading-none text-sky-400"
    : "inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold leading-none text-sky-700";

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <span className={paidSummaryBadgeClassName}>
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          task_alt
        </span>
        <span>Paid {paidCount}</span>
      </span>
      <span className={partiallyPaidSummaryBadgeClassName}>
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          payments
        </span>
        <span>Partially Paid {partiallyPaidCount}</span>
      </span>
      <span className={pendingSummaryBadgeClassName}>
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          hourglass_top
        </span>
        <span>Pending {pendingCount}</span>
      </span>
      <span className={overdueSummaryBadgeClassName}>
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          warning
        </span>
        <span>Overdue {overdueCount}</span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-bold leading-none text-slate-700">
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          block
        </span>
        <span>Cancelled {cancelledCount}</span>
      </span>
    </div>
  );
}

// ==========================================
// 2. INVOICE LIST FILTERS
// ==========================================

export function InvoiceListFilters({
  statusFilter,
  setStatusFilter,
  dueMonthFilter,
  setDueMonthFilter,
  dueMonthOptions,
}: {
  statusFilter: "all" | "paid" | "partially-paid" | "pending" | "overdue" | "cancelled";
  setStatusFilter: (value: "all" | "paid" | "partially-paid" | "pending" | "overdue" | "cancelled") => void;
  dueMonthFilter: string;
  setDueMonthFilter: (value: string) => void;
  dueMonthOptions: DueMonthOption[];
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_0.9fr_auto] md:items-end">
      <label className="space-y-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/80">
          Status
        </span>
        <SereneSelect
          className="serene-select rounded-xl bg-surface-container-lowest text-sm font-medium text-on-surface-variant"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as any)
          }
        >
          <option value="all">All Statuses</option>
          <option value="paid">Paid</option>
          <option value="partially-paid">Partially Paid</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </SereneSelect>
      </label>

      <label className="space-y-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/80">
          Due Month
        </span>
        <SereneSelect
          className="serene-select rounded-xl bg-surface-container-lowest text-sm font-medium text-on-surface-variant"
          value={dueMonthFilter}
          onChange={(event) => setDueMonthFilter(event.target.value)}
        >
          <option value="all">All Months</option>
          {dueMonthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SereneSelect>
      </label>
    </div>
  );
}

// ==========================================
// 3. INVOICE CARD LIST (MOBILE VIEW)
// ==========================================

export function InvoiceCardList({
  rows,
  isDarkMode,
  isInvoiceBackendAvailable,
  onViewPdf,
  onEditInvoice,
  onDeleteInvoice,
}: {
  rows: InvoiceRow[];
  isDarkMode: boolean;
  isInvoiceBackendAvailable: boolean;
  onViewPdf: (row: InvoiceRow) => void;
  onEditInvoice: (row: InvoiceRow) => void;
  onDeleteInvoice: (row: InvoiceRow) => void;
}) {
  return (
    <section className="space-y-3 lg:hidden" aria-label="Invoice cards">
      {rows.map((row) => (
        <article
          key={row.id}
          className={`rounded-2xl border p-4 shadow-sm ${
            row.status === "Paid"
              ? isDarkMode
                ? "border-primary/45 bg-primary/10 shadow-ambient"
                : "border-emerald-300 bg-emerald-50/80 shadow-[0_16px_34px_rgba(5,150,105,0.14)]"
              : "border-slate-200 bg-surface-container-lowest"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                Invoice ID
              </p>
              <p className="truncate text-sm font-bold text-primary">{row.invoiceNumber}</p>
            </div>
            <Badge
              status={row.status === "Paid" ? "success" : row.status === "Pending" ? "warning" : "error"}
              className="px-2.5 py-1 text-[11px] font-bold border-none"
            >
              {getInvoiceStatusDisplayLabel(row.status)}
            </Badge>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <div
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${getAvatarToneByStatus(
                row.status,
                isDarkMode,
              )}`}
            >
              {row.clientInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="truncate text-sm font-semibold text-on-surface">{row.clientName}</p>
                {row.description && (
                  <span className="shrink-0 inline-flex items-center rounded-md bg-surface-container-high px-1.5 py-0.5 text-[9px] font-semibold text-on-surface-variant/80">
                    {row.description}
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-on-surface-variant mt-0.5">
                {row.groupCode ? `Group ${row.groupCode}` : "No group"}
              </p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-surface-container-low px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/70">
                Due Date
              </p>
              <p className="mt-1 font-semibold text-on-surface">{formatDateLabel(row.dueDateIso)}</p>
            </div>
            <div className="rounded-xl bg-surface-container-low px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/70">
                Amount
              </p>
              {(() => {
                const displayTotals = resolveInvoiceDisplayTotals(row);
                return (
                  <>
                    <p className="mt-1 font-extrabold text-on-surface">
                      {formatCurrencyLabel(displayTotals.remainingBalance, displayTotals.currency)}
                    </p>
                    {displayTotals.downPayment > 0 && (
                      <p className="text-[9px] text-on-surface-variant font-semibold mt-0.5">
                        Total: {formatCurrencyLabel(displayTotals.subtotal, displayTotals.currency)} | Terbayar: {formatCurrencyLabel(displayTotals.downPayment, displayTotals.currency)}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
              aria-label={`Open PDF for ${row.invoiceNumber}`}
              onClick={() => onViewPdf(row)}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                picture_as_pdf
              </span>
            </button>

            <button
              type="button"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary ${
                isInvoiceBackendAvailable
                  ? "bg-surface-container-low"
                  : "cursor-not-allowed bg-surface-container-high"
              }`}
              aria-label={`Edit ${row.invoiceNumber}`}
              onClick={() => onEditInvoice(row)}
              disabled={!isInvoiceBackendAvailable}
              title={
                isInvoiceBackendAvailable
                  ? "Edit"
                  : "Backend invoice/database belum terhubung, edit invoice dinonaktifkan."
              }
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                edit
              </span>
            </button>

            {isInvoiceBackendAvailable && (
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant transition hover:bg-rose-50 hover:text-rose-600"
                aria-label={`Delete ${row.invoiceNumber}`}
                onClick={() => onDeleteInvoice(row)}
                title="Delete"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  delete
                </span>
              </button>
            )}
          </div>
        </article>
      ))}
    </section>
  );
}

// ==========================================
// 4. INVOICE TABLE (DESKTOP VIEW)
// ==========================================

export function InvoiceTable({
  rows,
  isDarkMode,
  isInvoiceBackendAvailable,
  onViewPdf,
  onEditInvoice,
  onDeleteInvoice,
}: {
  rows: InvoiceRow[];
  isDarkMode: boolean;
  isInvoiceBackendAvailable: boolean;
  onViewPdf: (row: InvoiceRow) => void;
  onEditInvoice: (row: InvoiceRow) => void;
  onDeleteInvoice: (row: InvoiceRow) => void;
}) {
  return (
    <section className="serene-table-shell hidden lg:block" aria-label="Invoice list table">
      <div className="overflow-x-auto">
        <div className="min-w-full">
          <div
            className="grid gap-2 border-b border-slate-200 bg-surface-container-low px-5 py-3 text-xs font-semibold uppercase tracking-[0.11em] text-on-surface-variant/80"
            style={{ gridTemplateColumns: "1.2fr 1.05fr 1fr 0.7fr 0.85fr 0.65fr 0.85fr" }}
          >
            <div>Invoice ID</div>
            <div>Client Name</div>
            <div>Keterangan</div>
            <div>Due Date</div>
            <div>Amount</div>
            <div>Status</div>
            <div className="text-right">Actions</div>
          </div>

          <div className="divide-y divide-slate-100">
            {rows.map((row) => (
              <article
                key={row.id}
                className="grid gap-2 items-center px-5 py-3.5 hover:bg-slate-50 transition-colors"
                style={{ gridTemplateColumns: "1.2fr 1.05fr 1fr 0.7fr 0.85fr 0.65fr 0.85fr" }}
              >
                <div className="min-w-0">
                  <p className="font-bold text-primary truncate leading-normal" title={row.invoiceNumber}>
                    {row.invoiceNumber}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`shrink-0 flex h-7.5 w-7.5 items-center justify-center rounded-full text-[11px] font-bold ${getAvatarToneByStatus(
                      row.status,
                      isDarkMode,
                    )}`}
                  >
                    {row.clientInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-on-surface text-sm truncate leading-normal" title={row.clientName}>
                      {row.clientName}
                    </p>
                    <p className="text-[10px] text-on-surface-variant truncate leading-none mt-0.5">
                      {row.groupCode ? `Group ${row.groupCode}` : "No group"}
                    </p>
                  </div>
                </div>

                <div className="min-w-0 text-sm text-on-surface font-medium whitespace-normal break-words" title={row.description || ""}>
                  {row.description || "-"}
                </div>

                <div className="text-sm font-medium text-on-surface">
                  {formatDateLabel(row.dueDateIso)}
                </div>

                <div className="text-sm leading-normal">
                  {(() => {
                    const displayTotals = resolveInvoiceDisplayTotals(row);
                    return (
                      <>
                        <p className="font-extrabold text-on-surface">
                          {formatCurrencyLabel(displayTotals.remainingBalance, displayTotals.currency)}
                        </p>
                        {displayTotals.downPayment > 0 && (
                          <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                            Total: {formatCurrencyLabel(displayTotals.subtotal, displayTotals.currency)} (DP: {formatCurrencyLabel(displayTotals.downPayment, displayTotals.currency)})
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <Badge
                    status={row.status === "Paid" ? "success" : row.status === "Pending" ? "warning" : "error"}
                    className="px-2 py-0.5 text-[10px] font-bold border-none"
                  >
                    {getInvoiceStatusDisplayLabel(row.status)}
                  </Badge>
                </div>

                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-slate-100 hover:text-primary"
                    aria-label={`Open PDF for ${row.invoiceNumber}`}
                    onClick={() => onViewPdf(row)}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      picture_as_pdf
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition ${
                      isInvoiceBackendAvailable
                        ? "hover:bg-slate-100 hover:text-primary"
                        : "cursor-not-allowed text-on-surface-variant/40"
                    }`}
                    aria-label={`Edit ${row.invoiceNumber}`}
                    onClick={() => onEditInvoice(row)}
                    disabled={!isInvoiceBackendAvailable}
                    title={
                      isInvoiceBackendAvailable
                        ? "Edit"
                        : "Backend invoice/database belum terhubung, edit invoice dinonaktifkan."
                    }
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      edit
                    </span>
                  </button>

                  {isInvoiceBackendAvailable && (
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Delete ${row.invoiceNumber}`}
                      onClick={() => onDeleteInvoice(row)}
                      title="Delete"
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        delete
                      </span>
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
