import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Profile } from "../data/contracts";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";
import { ErrorState, LoadingState } from "../components/data-state";

export function ProfilePage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: agentQueryKeys.profile(principalId),
    queryFn: () => portalGet<Profile>(client, "/profile"),
    staleTime: 60_000,
  });
  if (query.isPending) return <LoadingState label="Memuat profil…" />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;
  return (
    <div className="page-stack">
      <section className="page-heading">
        <p className="eyebrow">Akun read-only</p>
        <h1>Profile</h1>
      </section>
      <section className="serene-section profile-card">
        <dl>
          <div>
            <dt>Nama pengguna</dt>
            <dd>{query.data.account.displayName}</dd>
          </div>
          <div>
            <dt>Kode Partner</dt>
            <dd>{query.data.agent.code}</dd>
          </div>
          <div>
            <dt>Nama Partner</dt>
            <dd>{query.data.agent.name}</dd>
          </div>
        </dl>
        <p className="muted">Perubahan data dilakukan melalui administrator GTT.</p>
      </section>
    </div>
  );
}
