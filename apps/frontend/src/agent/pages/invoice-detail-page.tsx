import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { LoadingState, ResourceErrorState, StatusChip } from "../components/data-state";
import type { InvoiceSummary } from "../data/contracts";
import { formatDate } from "../data/format";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";

export function InvoiceDetailPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const id = useParams().id ?? "";
  const query = useQuery({
    queryKey: agentQueryKeys.invoice(principalId, id),
    queryFn: () => portalGet<InvoiceSummary>(client, `/invoices/${encodeURIComponent(id)}`),
    staleTime: 60_000,
  });
  if (query.isPending) return <LoadingState label="Memuat invoice…" />;
  if (query.isError) return <ResourceErrorState error={query.error} retry={() => void query.refetch()} />;
  const invoice = query.data;
  return (
    <div className="page-stack">
      <Link className="back-link" to="/agent/invoices">
        ← Kembali ke Invoices
      </Link>
      <section className="serene-section invoice-detail">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Invoice read-only</p>
            <h1>{invoice.invoiceNumber}</h1>
          </div>
          <StatusChip value={invoice.status} />
        </div>
        <dl>
          <div>
            <dt>Tanggal terbit</dt>
            <dd>{formatDate(invoice.issuedDate)}</dd>
          </div>
          <div>
            <dt>Jatuh tempo</dt>
            <dd>{formatDate(invoice.dueDate)}</dd>
          </div>
          <div>
            <dt>Group</dt>
            <dd>
              {invoice.group ? (
                <Link to={`/agent/groups/${encodeURIComponent(invoice.group.code)}`}>
                  {invoice.group.code} — {invoice.group.name}
                </Link>
              ) : (
                "Tidak terkait group"
              )}
            </dd>
          </div>
        </dl>
        <aside className="policy-note">
          Nominal, rincian item, dan dokumen approval belum tersedia sesuai kebijakan keamanan portal.
        </aside>
      </section>
    </div>
  );
}
