import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { FilterField, FilterPanel, FixedValueField } from "../../components/filter-panel";
import { ReadOnlyIndicator } from "../../components/read-only-indicator";
import { StatePanel } from "../../components/state-panel";
import { PaginationControls } from "../../components/pagination-controls";
import { SereneSelect } from "../../components/serene-select";
import {
  InvoiceCardList,
  InvoiceSummaryBadges,
  InvoiceTable,
} from "../../pages/invoice/components/InvoiceListComponents";
import type { InvoiceRow } from "../../pages/invoice/helpers/invoice-page-shared";
import { useThemeMode } from "../../theme/theme-provider";
import { ErrorState, LoadingState } from "../components/data-state";
import type { InvoiceStatus, InvoiceSummary, Page } from "../data/contracts";
import { buildInvoiceListPath } from "../data/invoice-query";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";

const PAGE_SIZE = 20;

const statusMap: Record<InvoiceStatus, InvoiceRow["status"]> = {
  PAID: "Paid",
  PARTIALLY_PAID: "Partially Paid",
  PENDING: "Pending",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

function mapInvoice(invoice: InvoiceSummary, agentId: string, agentName: string): InvoiceRow {
  const clientName = invoice.group?.name ?? "General Invoice";
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    clientId: invoice.group?.id ?? invoice.id,
    agentId,
    agentName,
    clientName,
    clientLabel: clientName,
    clientInitials: clientName.slice(0, 2).toUpperCase(),
    groupCode: invoice.group?.code,
    groupName: invoice.group?.name,
    issuedDateIso: invoice.issuedDate.slice(0, 10),
    dueDateIso: invoice.dueDate.slice(0, 10),
    amount: 0,
    downPaymentIdr: 0,
    status: statusMap[invoice.status],
    monthKey: invoice.dueDate.slice(0, 7),
    description: invoice.group ? `Group ${invoice.group.code}` : "Invoice",
  };
}

export function InvoicesPage({
  principalId,
  agentId,
  agentName,
}: {
  principalId: string;
  agentId: string;
  agentName: string;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { theme } = useThemeMode();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const page = Math.max(1, Number(params.get("page")) || 1);
  const status = params.get("status") ?? "";
  const filters = { status, page, pageSize: PAGE_SIZE };
  const query = useQuery({
    queryKey: agentQueryKeys.invoices(principalId, filters),
    queryFn: () => portalGet<Page<InvoiceSummary>>(client, buildInvoiceListPath(filters)),
    staleTime: 60_000,
  });
  const rows = useMemo(
    () =>
      (query.data?.items ?? [])
        .map((invoice) => mapInvoice(invoice, agentId, agentName))
        .filter((row) =>
          [row.invoiceNumber, row.clientName, row.groupCode ?? ""].some((value) =>
            value.toLowerCase().includes(search.trim().toLowerCase()),
          ),
        ),
    [agentId, agentName, query.data?.items, search],
  );
  const counts = (value: InvoiceRow["status"]) => rows.filter((row) => row.status === value).length;
  const setStatus = (value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      value ? next.set("status", value) : next.delete("status");
      next.set("page", "1");
      return next;
    });
  };
  const goToInvoice = (row: InvoiceRow) => navigate(`/agent/invoices/${encodeURIComponent(row.id)}`);

  return (
    <PageLayout width="wide">
      <PageHeader
        eyebrow="Invoice Workspace"
        title="Invoice List"
        description="Pantau seluruh invoice yang telah diterbitkan untuk group Anda."
        actions={<ReadOnlyIndicator />}
        toolbar={
          <div className="flex min-w-0 flex-1 max-w-xl items-center gap-3">
            <label className="serene-page-search" aria-label="Search invoices">
              <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
                search
              </span>
              <input
                type="text"
                className="serene-page-search-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search invoices or clients..."
              />
            </label>
          </div>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <FilterPanel>
          <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <FixedValueField label="Agent" value={agentName} icon="business" />
            <FilterField label="Status">
              <SereneSelect
                className="serene-select rounded-xl bg-surface-container-lowest text-sm font-medium"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PENDING">Pending</option>
                <option value="OVERDUE">Overdue</option>
                <option value="CANCELLED">Cancelled</option>
              </SereneSelect>
            </FilterField>
            <FixedValueField label="Akses" value="Read-only" icon="visibility" />
          </div>
          <InvoiceSummaryBadges
            paidCount={counts("Paid")}
            partiallyPaidCount={counts("Partially Paid")}
            pendingCount={counts("Pending")}
            overdueCount={counts("Overdue")}
            cancelledCount={counts("Cancelled")}
            isDarkMode={theme === "dark"}
          />
        </FilterPanel>

        <article className="serene-accent-card bg-primary text-on-primary">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-primary/85">Financial Visibility</p>
          <strong className="mt-2 block text-3xl font-extrabold leading-tight">Restricted</strong>
          <p className="mt-3 text-xs text-on-primary/85">Nominal dan line item tidak ditampilkan pada portal Agent.</p>
          <span
            className="material-symbols-outlined absolute -bottom-4 -right-3 text-8xl text-on-primary/15"
            aria-hidden="true"
          >
            pentagon
          </span>
        </article>
      </section>

      {query.isPending ? <LoadingState label="Memuat invoices..." /> : null}
      {query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
      {!query.isPending && !query.isError && rows.length === 0 ? (
        <StatePanel
          state="empty"
          icon="receipt_long"
          title="Belum ada invoice"
          description="Invoice akan muncul setelah diterbitkan oleh tim Ops."
        />
      ) : null}
      {rows.length ? (
        <>
          <InvoiceCardList
            rows={rows}
            isDarkMode={theme === "dark"}
            isInvoiceBackendAvailable={false}
            onViewPdf={goToInvoice}
            onEditInvoice={() => undefined}
            onDeleteInvoice={() => undefined}
            readOnly
            hideAmounts
          />
          <InvoiceTable
            rows={rows}
            isDarkMode={theme === "dark"}
            isInvoiceBackendAvailable={false}
            onViewPdf={goToInvoice}
            onEditInvoice={() => undefined}
            onDeleteInvoice={() => undefined}
            readOnly
            hideAmounts
          />
        </>
      ) : null}
      <PaginationControls
        currentPage={page}
        totalPages={Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE_SIZE))}
        totalItems={query.data?.total ?? 0}
        rangeStart={(page - 1) * PAGE_SIZE + (rows.length ? 1 : 0)}
        rangeEnd={(page - 1) * PAGE_SIZE + rows.length}
        itemLabel="invoices"
        onPageChange={(nextPage) =>
          setParams((current) => {
            const next = new URLSearchParams(current);
            next.set("page", String(nextPage));
            return next;
          })
        }
      />
    </PageLayout>
  );
}
