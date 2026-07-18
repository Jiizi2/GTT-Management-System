import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState, StatusChip } from "../components/data-state";
import type { InvoiceStatus, InvoiceSummary, Page } from "../data/contracts";
import { formatDate } from "../data/format";
import { buildInvoiceListPath } from "../data/invoice-query";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";

export function InvoicesPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const status = params.get("status") ?? "";
  const filters = { status, page, pageSize: 20 };
  const query = useQuery({
    queryKey: agentQueryKeys.invoices(principalId, filters),
    queryFn: () => portalGet<Page<InvoiceSummary>>(client, buildInvoiceListPath(filters)),
    staleTime: 60_000,
  });
  const setStatus = (value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      value ? next.set("status", value) : next.delete("status");
      next.set("page", "1");
      return next;
    });
  return (
    <div className="page-stack">
      <section className="page-heading">
        <p className="eyebrow">Dokumen tagihan</p>
        <h1>Invoices</h1>
        <p className="muted">Nominal dan line item belum ditampilkan pada portal.</p>
      </section>
      <div className="filter-bar">
        <label>
          Status invoice
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Semua status</option>
            {(["PAID", "PARTIALLY_PAID", "PENDING", "OVERDUE", "CANCELLED"] satisfies InvoiceStatus[]).map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      {query.isPending ? (
        <LoadingState label="Memuat invoices..." />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState title={status ? "Tidak ada invoice dengan status ini" : "Belum ada invoice"} />
      ) : (
        <>
          <p className="result-count" aria-live="polite">
            {query.data.total} invoice ditemukan
          </p>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Nomor invoice</th>
                  <th>Group</th>
                  <th>Terbit</th>
                  <th>Jatuh tempo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>
                      <Link to={`/agent/invoices/${encodeURIComponent(invoice.id)}`}>
                        <strong>{invoice.invoiceNumber}</strong>
                      </Link>
                    </td>
                    <td>
                      {invoice.group ? (
                        <Link to={`/agent/groups/${encodeURIComponent(invoice.group.code)}`}>{invoice.group.code}</Link>
                      ) : (
                        "Tidak terkait group"
                      )}
                    </td>
                    <td>{formatDate(invoice.issuedDate)}</td>
                    <td>{formatDate(invoice.dueDate)}</td>
                    <td>
                      <StatusChip value={invoice.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-list mobile-only">
            {query.data.items.map((invoice) => (
              <Link className="list-card" key={invoice.id} to={`/agent/invoices/${encodeURIComponent(invoice.id)}`}>
                <div>
                  <strong>{invoice.invoiceNumber}</strong>
                  <span>
                    {invoice.group?.code ?? "Tanpa group"} · jatuh tempo {formatDate(invoice.dueDate)}
                  </span>
                </div>
                <StatusChip value={invoice.status} />
              </Link>
            ))}
          </div>
          <nav className="pagination" aria-label="Pagination invoice">
            <button
              className="secondary-button"
              disabled={page <= 1}
              onClick={() =>
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("page", String(page - 1));
                  return next;
                })
              }
            >
              Sebelumnya
            </button>
            <span>Halaman {page}</span>
            <button
              className="secondary-button"
              disabled={page * query.data.pageSize >= query.data.total}
              onClick={() =>
                setParams((current) => {
                  const next = new URLSearchParams(current);
                  next.set("page", String(page + 1));
                  return next;
                })
              }
            >
              Berikutnya
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
