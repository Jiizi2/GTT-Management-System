import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import * as Domain from "../shared/app-domain";
import type { GroupData } from "../shared/app-domain";
import { PageHeroSection } from "../components/page-hero-section";
import { PaginationControls } from "../components/pagination-controls";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { InvoiceDeleteConfirmModal } from "../components/group-detail-modals/InvoiceDeleteConfirmModal";
import { useInvoiceDashboardQuery, useDeleteInvoiceMutation } from "../hooks/use-invoice-query";
import { useMasterDataOptionsQuery } from "../hooks/use-master-data-query";
import { useThemeMode } from "../theme/theme-provider";
import { Button } from "../components/button";
import {
  InvoiceSummaryBadges,
  InvoiceListFilters,
  InvoiceCardList,
  InvoiceTable,
} from "./invoice/components/InvoiceListComponents";
import {
  createInvoiceWorkspaceInitialData,
  defaultBankDisbursementOptions,
  defaultInvoiceStatusOptions,
  defaultIssuingOfficeOptions,
  formatDateLabel,
  formatIdr,
  formatMonthLabel,
  getAvatarToneByStatus,
  getInvoiceStatusDisplayLabel,
  getStatusClasses,
  getStatusValue,
  mapMasterDataToClientSuggestions,
  mapMasterDataToInvoiceStatusOptions,
  mapMasterDataToSelectOptions,
  mergeInvoiceClientsWithMasterData,
  resolveDateRangeLabel,
  shiftMonthKey,
  viewInvoicePdfFromRow,
  resolveInvoiceDisplayTotals,
  formatCurrencyLabel,
  type InvoiceClientOption,
  type InvoiceRow,
  type InvoiceWorkspaceInitialData,
} from "./invoice/helpers/invoice-page-shared";

const LazyCreateInvoiceWorkspace = lazy(async () => ({
  default: (await import("./invoice-page")).CreateInvoiceWorkspace,
}));

const INVOICE_PAGE_SIZE = 8;

type DueMonthOption = {
  value: string;
  label: string;
};

function InvoiceWorkspaceFallback() {
  return (
    <div className="mx-auto max-w-[88rem] space-y-4 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <section
        className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800 shadow-ambient"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 text-base" aria-hidden="true">
            sync
          </span>
          <p className="text-sm font-semibold">Loading invoice workspace...</p>
        </div>
      </section>
    </div>
  );
}



export function InvoiceScreen({
  groups,
  onOpenDetail,
}: {
  groups: GroupData[];
  onOpenDetail: (groupCode: string) => void;
}) {
  const { theme } = useThemeMode();
  const isDarkMode = theme === "dark";
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "partially-paid" | "pending" | "overdue" | "cancelled">("all");
  const [dueMonthFilter, setDueMonthFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [workspaceMode, setWorkspaceMode] = useState<"list" | "create" | "edit">("list");
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWorkspaceInitialData | null>(null);
  const [draftSourceInvoice, setDraftSourceInvoice] = useState<InvoiceWorkspaceInitialData | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [deletingInvoice, setDeletingInvoice] = useState<InvoiceRow | null>(null);
  const invoiceDashboardQuery = useInvoiceDashboardQuery();
  const deleteMutation = useDeleteInvoiceMutation();
  const issuingOfficeOptionsQuery = useMasterDataOptionsQuery({
    categoryKey: "invoice-issuing-office",
  });
  const invoiceStatusOptionsQuery = useMasterDataOptionsQuery({
    categoryKey: "invoice-status",
  });
  const bankDisbursementOptionsQuery = useMasterDataOptionsQuery({
    categoryKey: "bank-disbursement",
  });
  const invoiceClientNameOptionsQuery = useMasterDataOptionsQuery({
    categoryKey: "invoice-client-name",
  });
  const issuingOfficeOptions = useMemo(() => {
    const resolved = mapMasterDataToSelectOptions(issuingOfficeOptionsQuery.data ?? []).map((option) => ({
      value: option.label,
      label: option.label,
    }));
    return resolved.length > 0 ? resolved : defaultIssuingOfficeOptions;
  }, [issuingOfficeOptionsQuery.data]);
  const invoiceStatusOptions = useMemo(() => {
    const resolved = mapMasterDataToInvoiceStatusOptions(invoiceStatusOptionsQuery.data ?? []);
    return resolved.length > 0 ? resolved : defaultInvoiceStatusOptions;
  }, [invoiceStatusOptionsQuery.data]);
  const bankDisbursementOptions = useMemo(() => {
    const resolved = mapMasterDataToSelectOptions(bankDisbursementOptionsQuery.data ?? []);
    return resolved.length > 0 ? resolved : defaultBankDisbursementOptions;
  }, [bankDisbursementOptionsQuery.data]);
  const manualClientNameSuggestions = useMemo(
    () => mapMasterDataToClientSuggestions(invoiceClientNameOptionsQuery.data ?? []),
    [invoiceClientNameOptionsQuery.data],
  );
  const isInvoiceBackendAvailable = invoiceDashboardQuery.data?.dataSource === "prisma";
  const isInvoiceDataLoading = invoiceDashboardQuery.isLoading;
  const invoiceClients = useMemo<InvoiceClientOption[]>(
    () =>
      isInvoiceBackendAvailable
        ? mergeInvoiceClientsWithMasterData(
            invoiceDashboardQuery.data?.clients ?? [],
            invoiceClientNameOptionsQuery.data ?? [],
          )
        : [],
    [invoiceDashboardQuery.data?.clients, invoiceClientNameOptionsQuery.data, isInvoiceBackendAvailable],
  );
  const invoiceRows = useMemo<InvoiceRow[]>(
    () => (isInvoiceBackendAvailable ? (invoiceDashboardQuery.data?.rows ?? []) : []),
    [invoiceDashboardQuery.data, isInvoiceBackendAvailable],
  );
  const lastId = (window as any)._lastEditedInvoiceId;
  const targetRow = lastId ? invoiceRows.find((r) => r.id === lastId) : null;
  console.log(`[${new Date().toISOString()}] InvoiceScreen render (workspaceMode: ${workspaceMode})`);
  if (targetRow) {
    console.log(`[${new Date().toISOString()}] Rendered target invoice:\nid=${targetRow.id}\ninvoiceNumber=${targetRow.invoiceNumber}\nstatus=${targetRow.status}\namount=${targetRow.amount}`);
  }
  const systemFeedback = useMemo(() => {
    if (invoiceDashboardQuery.error) {
      return "Backend invoice/database belum terhubung. Data invoice tidak bisa di-load dari database dan Generate Invoice dinonaktifkan.";
    }

    if (invoiceDashboardQuery.data?.dataSource && invoiceDashboardQuery.data.dataSource !== "prisma") {
      return "Backend invoice terhubung tetapi masih DATA_SOURCE=memory. Ubah ke DATA_SOURCE=prisma agar Save Draft dan Generate Invoice tersimpan ke database.";
    }

    if (isInvoiceBackendAvailable && invoiceClients.length === 0) {
      return "Backend invoice terhubung, tetapi daftar client invoice masih kosong. Jalankan seed database lalu refresh halaman.";
    }

    return null;
  }, [invoiceClients.length, invoiceDashboardQuery.data, invoiceDashboardQuery.error, isInvoiceBackendAvailable]);
  const visibleFeedback = actionFeedback ?? systemFeedback;

  const normalizedQuery = query.trim().toLowerCase();
  const searchedRows = invoiceRows.filter((row) => {
    if (!normalizedQuery) {
      return true;
    }

    return [row.invoiceNumber, row.clientLabel, row.clientName, row.groupCode ?? "", row.status].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
  });

  const dueMonthOptions = useMemo<DueMonthOption[]>(() => {
    const keySet = new Set<string>();
    invoiceRows.forEach((row) => {
      if (/^\d{4}-\d{2}$/.test(row.monthKey)) {
        keySet.add(row.monthKey);
      }
    });

    return Array.from(keySet)
      .sort((left, right) => right.localeCompare(left))
      .map((value) => ({
        value,
        label: formatMonthLabel(value),
      }));
  }, [invoiceRows]);

  const filteredRows = searchedRows
    .filter((row) => (statusFilter === "all" ? true : getStatusValue(row.status) === statusFilter))
    .filter((row) => (dueMonthFilter === "all" ? true : row.monthKey === dueMonthFilter));

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / INVOICE_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * INVOICE_PAGE_SIZE;
  const paginatedRows = filteredRows.slice(pageStartIndex, pageStartIndex + INVOICE_PAGE_SIZE);
  const rangeStart = filteredRows.length === 0 ? 0 : pageStartIndex + 1;
  const rangeEnd = filteredRows.length === 0 ? 0 : Math.min(filteredRows.length, pageStartIndex + paginatedRows.length);

  const totalRevenue = filteredRows.filter((row) => row.status !== "Cancelled").reduce((total, row) => total + row.amount, 0);
  const paidCount = filteredRows.filter((row) => row.status === "Paid").length;
  const partiallyPaidCount = filteredRows.filter((row) => row.status === "Partially Paid").length;
  const pendingCount = filteredRows.filter((row) => row.status === "Pending").length;
  const overdueCount = filteredRows.filter((row) => row.status === "Overdue").length;
  const cancelledCount = filteredRows.filter((row) => row.status === "Cancelled").length;
  const currentMonthKey = Domain.formatLocalIsoDate(new Date()).slice(0, 7);
  const previousMonthKey = shiftMonthKey(currentMonthKey, -1);
  const currentMonthRevenue = invoiceRows
    .filter((row) => row.monthKey === currentMonthKey && row.status !== "Cancelled")
    .reduce((total, row) => total + row.amount, 0);
  const previousMonthRevenue = invoiceRows
    .filter((row) => row.monthKey === previousMonthKey && row.status !== "Cancelled")
    .reduce((total, row) => total + row.amount, 0);
  const monthlyGrowth =
    previousMonthRevenue > 0
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      : currentMonthRevenue > 0
        ? 100
        : 0;
  const monthlyGrowthLabel = `${monthlyGrowth >= 0 ? "+" : ""}${monthlyGrowth.toFixed(1)}%`;
  const dueDateRangeLabel =
    dueMonthFilter === "all"
      ? resolveDateRangeLabel(invoiceRows)
      : resolveDateRangeLabel(invoiceRows.filter((row) => row.monthKey === dueMonthFilter));
  const paidSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-primary/35 bg-primary/16 px-3 py-1 text-xs font-bold leading-none text-primary"
    : "inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold leading-none text-emerald-700";
  const pendingSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-secondary/35 bg-secondary/16 px-3 py-1 text-xs font-bold leading-none text-secondary"
    : "inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold leading-none text-amber-700";
  const overdueSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-tertiary/35 bg-tertiary/16 px-3 py-1 text-xs font-bold leading-none text-tertiary"
    : "inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold leading-none text-rose-700";
  const partiallyPaidSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-sky-500/35 bg-sky-500/16 px-3 py-1 text-xs font-bold leading-none text-sky-400"
    : "inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-bold leading-none text-sky-700";

  const handleViewPdf = (row: InvoiceRow) => {
    setActionFeedback("Menyiapkan PDF...");
    void viewInvoicePdfFromRow({ row, groups, bankDisbursementOptions, issuingOfficeOptions })
      .then((exported) => {
        if (exported) {
          setActionFeedback("");
        } else {
          setActionFeedback("Gagal menyiapkan PDF invoice. Coba lagi.");
        }
      })
      .catch(() => {
        setActionFeedback("Gagal menyiapkan PDF invoice. Coba lagi.");
      });
  };

  const handleOpenEditInvoice = (row: InvoiceRow) => {
    if (!isInvoiceBackendAvailable) {
      setActionFeedback("Backend invoice/database belum terhubung. Edit invoice dinonaktifkan.");
      return;
    }

    setDraftSourceInvoice(null);
    setEditingInvoice(createInvoiceWorkspaceInitialData(row));
    setWorkspaceMode("edit");
  };

  const handleDeleteInvoice = (row: InvoiceRow) => {
    setDeletingInvoice(row);
  };


  useEffect(() => {
    if (!actionFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActionFeedback((current) => (current ? null : current));
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionFeedback]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, dueMonthFilter]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (dueMonthFilter === "all") {
      return;
    }

    const isStillAvailable = dueMonthOptions.some((option) => option.value === dueMonthFilter);
    if (!isStillAvailable) {
      setDueMonthFilter("all");
    }
  }, [dueMonthFilter, dueMonthOptions]);

  if (workspaceMode === "create") {
    return (
      <Suspense fallback={<InvoiceWorkspaceFallback />}>
        <LazyCreateInvoiceWorkspace
          key={draftSourceInvoice ? `create-${draftSourceInvoice.id}` : "create-new"}
          mode="create"
          initialInvoice={draftSourceInvoice}
          clients={invoiceClients}
          issuingOfficeOptions={issuingOfficeOptions}
          invoiceStatusOptions={invoiceStatusOptions}
          bankDisbursementOptions={bankDisbursementOptions}
          manualClientNameSuggestions={manualClientNameSuggestions}
          groups={groups}
          isBackendAvailable={isInvoiceBackendAvailable}
          existingInvoiceNumbers={invoiceRows.map((row) => row.invoiceNumber)}
          onBack={() => {
            setWorkspaceMode("list");
            setDraftSourceInvoice(null);
          }}
          onCreate={(invoice, action) => {
            setWorkspaceMode("list");
            setDraftSourceInvoice(null);
            setActionFeedback(
              action === "draft"
                ? `Draft invoice ${invoice.invoiceNumber} saved to database.`
                : `Invoice ${invoice.invoiceNumber} generated and saved to database.`,
            );
            setQuery("");
            setStatusFilter("all");
            setDueMonthFilter("all");
            setCurrentPage(1);
          }}
          onUpdate={() => {
            // no-op on create mode
          }}
        />
      </Suspense>
    );
  }

  if (workspaceMode === "edit" && editingInvoice) {
    return (
      <Suspense fallback={<InvoiceWorkspaceFallback />}>
        <LazyCreateInvoiceWorkspace
          key={`edit-${editingInvoice.id}`}
          mode="edit"
          initialInvoice={editingInvoice}
          clients={invoiceClients}
          issuingOfficeOptions={issuingOfficeOptions}
          invoiceStatusOptions={invoiceStatusOptions}
          bankDisbursementOptions={bankDisbursementOptions}
          manualClientNameSuggestions={manualClientNameSuggestions}
          groups={groups}
          isBackendAvailable={isInvoiceBackendAvailable}
          existingInvoiceNumbers={invoiceRows.map((row) => row.invoiceNumber)}
          onBack={() => {
            setWorkspaceMode("list");
            setEditingInvoice(null);
            setDraftSourceInvoice(null);
          }}
          onCreate={() => {
            // no-op on edit mode
          }}
          onUpdate={(invoice) => {
            setWorkspaceMode("list");
            setEditingInvoice(null);
            setDraftSourceInvoice(null);
            setActionFeedback(`Invoice ${invoice.invoiceNumber} berhasil diupdate.`);
          }}
        />
      </Suspense>
    );
  }

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      {deletingInvoice && (
        <InvoiceDeleteConfirmModal
          invoice={deletingInvoice}
          onClose={() => setDeletingInvoice(null)}
          onConfirm={() => {
            const invoiceNumber = deletingInvoice.invoiceNumber;
            const invoiceId = deletingInvoice.id;
            setDeletingInvoice(null);
            setActionFeedback(`Menghapus invoice ${invoiceNumber}...`);
            deleteMutation.mutate(invoiceId, {
              onSuccess: () => {
                setActionFeedback(`Invoice ${invoiceNumber} berhasil dihapus.`);
              },
              onError: (err: any) => {
                setActionFeedback(`Gagal menghapus invoice: ${err?.message || err}`);
              },
            });
          }}
        />
      )}
      {visibleFeedback ? (
        <section
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 shadow-ambient"
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined mt-0.5 text-base" aria-hidden="true">
            check_circle
          </span>
          <p className="text-sm font-semibold">{visibleFeedback}</p>
        </section>
      ) : null}
      {isInvoiceDataLoading ? (
        <section
          className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800 shadow-ambient"
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined mt-0.5 text-base" aria-hidden="true">
            sync
          </span>
          <p className="text-sm font-semibold">Loading invoice data...</p>
        </section>
      ) : null}

      <header className="serene-page-toolbar">
        <div className="flex min-w-0 flex-1 max-w-xl items-center gap-3">
          <label className="serene-page-search" aria-label="Search invoices">
            <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              className="serene-page-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search invoices or clients..."
            />
          </label>
        </div>

        <ThemeToggleButton className="sm:ml-auto sm:mr-5" />
      </header>

      <PageHeroSection
        eyebrow="Invoice Workspace"
        title="Invoice List"
        description={
          <>
            <span className="sm:hidden">Track all issued invoices.</span>
            <span className="hidden sm:inline">Manage and track all issued invoices.</span>
          </>
        }
        actions={
          <Button
            variant="primary"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
            aria-label="Create new invoice"
            disabled={!isInvoiceBackendAvailable}
            onClick={() => {
              setEditingInvoice(null);
              setDraftSourceInvoice(null);
              setWorkspaceMode("create");
            }}
            title={
              isInvoiceBackendAvailable
                ? undefined
                : "Backend invoice/database belum terhubung, invoice belum bisa disimpan."
            }
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              add
            </span>
            <span>New Invoice</span>
          </Button>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <article className="serene-filter-panel">
          <div className="grid gap-4 md:grid-cols-[1fr_0.9fr_auto] md:items-end">
            <label className="space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/80">
                Date Range
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 text-sm font-medium text-on-surface-variant">
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  calendar_today
                </span>
                <span>{dueDateRangeLabel}</span>
              </div>
            </label>

            <InvoiceListFilters
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              dueMonthFilter={dueMonthFilter}
              setDueMonthFilter={setDueMonthFilter}
              dueMonthOptions={dueMonthOptions}
            />
          </div>

          <InvoiceSummaryBadges
            paidCount={paidCount}
            partiallyPaidCount={partiallyPaidCount}
            pendingCount={pendingCount}
            overdueCount={overdueCount}
            cancelledCount={cancelledCount}
            isDarkMode={isDarkMode}
          />
        </article>

        <article className="serene-accent-card bg-primary text-on-primary">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-primary/85">
            <span className="sm:hidden">Monthly Revenue</span>
            <span className="hidden sm:inline">Total Monthly Revenue</span>
          </p>
          <strong className="mt-2 block text-3xl font-extrabold leading-tight">{formatIdr(totalRevenue)}</strong>
          <p className="mt-3 inline-flex rounded-lg bg-surface-container-lowest/20 px-2 py-1 text-xs font-bold">
            {monthlyGrowthLabel}
          </p>
          <p className="mt-1 text-xs text-on-primary/85">
            <span className="sm:hidden">vs last month</span>
            <span className="hidden sm:inline">vs previous month</span>
          </p>
          <span
            className="material-symbols-outlined absolute -right-3 -bottom-4 text-8xl text-on-primary/15"
            aria-hidden="true"
          >
            pentagon
          </span>
        </article>
      </section>

      {filteredRows.length === 0 ? (
        <article className="serene-empty-state">
          <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">
            receipt_long
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-800">No invoices found</h2>
          <p className="mt-2 text-sm text-slate-600">
            <span className="sm:hidden">Coba keyword atau filter lain.</span>
            <span className="hidden sm:inline">
              Coba ubah keyword pencarian atau filter untuk melihat invoice lainnya.
            </span>
          </p>
        </article>
      ) : (
        <>
          <InvoiceCardList
            rows={paginatedRows}
            isDarkMode={isDarkMode}
            isInvoiceBackendAvailable={isInvoiceBackendAvailable}
            onViewPdf={handleViewPdf}
            onEditInvoice={handleOpenEditInvoice}
            onDeleteInvoice={handleDeleteInvoice}
          />

          <InvoiceTable
            rows={paginatedRows}
            isDarkMode={isDarkMode}
            isInvoiceBackendAvailable={isInvoiceBackendAvailable}
            onViewPdf={handleViewPdf}
            onEditInvoice={handleOpenEditInvoice}
            onDeleteInvoice={handleDeleteInvoice}
          />
        </>
      )}

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredRows.length}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="invoices"
        onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
      />
    </div>
  );
}
