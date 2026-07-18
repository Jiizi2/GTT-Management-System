import { FormEvent, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState, StatusChip } from "../components/data-state";
import type { GroupSummary, LifecycleStatus, Page } from "../data/contracts";
import { formatDate } from "../data/format";
import { buildGroupListPath } from "../data/group-query";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";

export function GroupsPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const q = params.get("q") ?? "";
  const lifecycle = params.get("lifecycle") ?? "";
  const [draft, setDraft] = useState(q);
  const filters = { q, lifecycle, page, pageSize: 20 };
  const query = useQuery({
    queryKey: agentQueryKeys.groups(principalId, filters),
    queryFn: () => portalGet<Page<GroupSummary>>(client, buildGroupListPath(filters)),
    staleTime: 60_000,
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setParams((current) => {
      const next = new URLSearchParams(current);
      draft.trim() ? next.set("q", draft.trim()) : next.delete("q");
      next.set("page", "1");
      return next;
    });
  };
  const setLifecycle = (value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      value ? next.set("lifecycle", value) : next.delete("lifecycle");
      next.set("page", "1");
      return next;
    });
  return (
    <div className="page-stack">
      <section className="page-heading">
        <p className="eyebrow">Operasional perjalanan</p>
        <h1>Groups</h1>
        <p className="muted">Cari berdasarkan kode atau nama group.</p>
      </section>
      <form className="filter-bar" onSubmit={submit} role="search">
        <label>
          <span className="sr-only">Cari group</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Kode atau nama group"
            maxLength={100}
          />
        </label>
        <select aria-label="Status lifecycle" value={lifecycle} onChange={(event) => setLifecycle(event.target.value)}>
          <option value="">Semua status</option>
          {(["ENTRY_ONLY", "ACTIVE", "INACTIVE", "COMPLETED", "ARCHIVED"] satisfies LifecycleStatus[]).map((value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <button className="primary-button" type="submit">
          Cari
        </button>
      </form>
      {query.isPending ? (
        <LoadingState label="Memuat groups..." />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState title={q || lifecycle ? "Tidak ada hasil yang sesuai" : "Belum ada group"}>
          Ubah filter atau coba kembali nanti.
        </EmptyState>
      ) : (
        <>
          <p className="result-count" aria-live="polite">
            {query.data.total} group ditemukan
          </p>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Group</th>
                  <th>Perjalanan</th>
                  <th>Pax</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((group) => (
                  <tr key={group.id}>
                    <td>
                      <Link to={`/agent/groups/${encodeURIComponent(group.code)}`}>
                        <strong>{group.name}</strong>
                        <span>{group.code}</span>
                      </Link>
                    </td>
                    <td>
                      {formatDate(group.arrivalDate)} – {formatDate(group.returnDate)}
                    </td>
                    <td>{group.pax}</td>
                    <td>
                      <StatusChip value={group.lifecycleStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="card-list mobile-only">
            {query.data.items.map((group) => (
              <Link className="list-card" key={group.id} to={`/agent/groups/${encodeURIComponent(group.code)}`}>
                <div>
                  <strong>{group.name}</strong>
                  <span>
                    {group.code} · {formatDate(group.arrivalDate)} · {group.pax} pax
                  </span>
                </div>
                <StatusChip value={group.lifecycleStatus} />
              </Link>
            ))}
          </div>
          <nav className="pagination" aria-label="Pagination group">
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
