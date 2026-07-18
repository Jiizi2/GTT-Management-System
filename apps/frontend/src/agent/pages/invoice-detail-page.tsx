import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { DetailItem, DetailList } from "../../components/detail-list";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { ReadOnlyIndicator } from "../../components/read-only-indicator";
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
  return (
    <PageLayout width="standard">
      <Link className="serene-btn-secondary w-fit" to="/agent/invoices">
        <span className="material-symbols-outlined text-base">arrow_back</span>Kembali
      </Link>
      {query.isPending ? <LoadingState label="Memuat invoice…" /> : null}
      {query.isError ? <ResourceErrorState error={query.error} retry={() => void query.refetch()} /> : null}
      {query.data ? (
        <>
          <PageHeader
            variant="detail"
            eyebrow="Invoice"
            title={query.data.invoiceNumber}
            actions={
              <>
                <StatusChip value={query.data.status} />
                <ReadOnlyIndicator />
              </>
            }
          />
          <section className="serene-section">
            <DetailList>
              <DetailItem label="Tanggal terbit" value={formatDate(query.data.issuedDate)} />
              <DetailItem label="Jatuh tempo" value={formatDate(query.data.dueDate)} />
              <DetailItem
                label="Group"
                value={
                  query.data.group ? (
                    <Link className="text-primary" to={`/agent/groups/${encodeURIComponent(query.data.group.code)}`}>
                      {query.data.group.code} — {query.data.group.name}
                    </Link>
                  ) : (
                    "Tidak terkait group"
                  )
                }
              />
            </DetailList>
            <aside className="mt-5 rounded-2xl bg-primary/8 p-4 text-sm leading-relaxed text-on-surface-variant">
              Nominal, rincian item, dan dokumen approval tidak ditampilkan sesuai kebijakan keamanan portal.
            </aside>
          </section>
        </>
      ) : null}
    </PageLayout>
  );
}
