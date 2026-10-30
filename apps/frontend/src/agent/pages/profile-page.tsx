import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DetailItem, DetailList } from "../../components/detail-list";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { ReadOnlyIndicator } from "../../components/read-only-indicator";
import type { Profile } from "../data/contracts";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";
import { DataBoundary } from "../../components/data-boundary";
import { DetailSkeleton } from "../../components/skeleton";

export function ProfilePage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: agentQueryKeys.profile(principalId),
    queryFn: ({ signal }) => portalGet<Profile>(client, "/profile", signal),
    staleTime: 60_000,
  });
  return (
    <PageLayout width="standard">
      <PageHeader
        variant="compact"
        title="Profile"
        description="Informasi akun dan identitas Partner yang terhubung dengan portal Agent."
        actions={<ReadOnlyIndicator label="Hanya lihat" />}
      />
      <DataBoundary query={query} skeleton={<DetailSkeleton kind="profile" label="Memuat profil…" />}>
      {query.data ? (
        <section className="serene-section">
          <DetailList>
            <DetailItem label="Nama pengguna" value={query.data.account.displayName} />
            <DetailItem label="Kode Partner" value={query.data.agent.code} />
            <DetailItem label="Nama Partner" value={query.data.agent.name} />
          </DetailList>
          <p className="mt-5 rounded-2xl bg-primary/8 p-4 text-sm leading-relaxed text-on-surface-variant">
            Perubahan data dilakukan melalui administrator GTT.
          </p>
        </section>
      ) : null}
      </DataBoundary>
    </PageLayout>
  );
}
