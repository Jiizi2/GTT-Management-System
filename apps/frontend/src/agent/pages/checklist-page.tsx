import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { agentQueryKeys } from "../query/agent-query-boundary";
import { portalGet } from "../data/portal-query";
import type { GroupSummary, TransportationItem } from "../data/contracts";
import { getAllAgentGroups } from "../data/all-groups-query";
import { formatDate } from "../data/format";
import { ErrorState, LoadingState } from "../components/data-state";

type ChecklistRow = TransportationItem & { group: GroupSummary };
const jakartaDate = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export function ChecklistPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: agentQueryKeys.checklist(principalId),
    queryFn: async () => {
      const groups = await getAllAgentGroups(client, "asc");
      const rows = await Promise.all(
        groups.map(async (group) =>
          (
            await portalGet<TransportationItem[]>(client, `/groups/${encodeURIComponent(group.code)}/transportation`)
          ).map((item) => ({ ...item, group })),
        ),
      );
      return rows.flat().sort((a, b) => String(a.tripDate).localeCompare(String(b.tripDate)));
    },
    staleTime: 30_000,
  });
  const range = useMemo(() => new Set([jakartaDate(0), jakartaDate(1), jakartaDate(2)]), []);
  const rows = useMemo(
    () =>
      (query.data ?? []).filter(
        (row) =>
          row.tripDate &&
          range.has(row.tripDate.slice(0, 10)) &&
          (!search.trim() || `${row.group.code} ${row.group.name}`.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [query.data, range, search],
  );
  const incomplete = rows.filter((row) => row.status !== "ASSIGNED" || row.verifiedDriverCount < row.requiredBusCount);
  const complete = rows.filter((row) => !incomplete.includes(row));
  if (query.isPending) return <LoadingState label="Memuat checklist H-1..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-0 pb-20 pt-4 sm:px-2 lg:px-4">
      <header className="serene-page-toolbar pr-14">
        <label className="serene-page-search max-w-xl">
          <span className="material-symbols-outlined text-on-surface-variant/70">search</span>
          <input
            className="serene-page-search-input"
            placeholder="Search group number, e.g. 901794508"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </header>
      <header className="serene-card rounded-3xl p-5">
        <h1 className="text-3xl font-bold tracking-tight">H-1 Checklist</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          Driver readiness for trips scheduled today, tomorrow, and the day after tomorrow.
        </p>
      </header>
      {rows.length === 0 ? (
        <article className="serene-empty-state">
          <span className="material-symbols-outlined text-4xl">event_busy</span>
          <h2 className="mt-3 text-xl font-bold">No upcoming trips in the next 3 days</h2>
          <p className="mt-2 text-sm">No itinerary is scheduled for today, tomorrow, and the day after tomorrow.</p>
        </article>
      ) : (
        <>
          {incomplete.length === 0 ? (
            <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
              <span className="material-symbols-outlined">check_circle</span>
              <div>
                <h2 className="font-bold">Clear</h2>
                <p className="mt-1 text-sm">All trips already have verified drivers.</p>
              </div>
            </section>
          ) : null}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-extrabold uppercase tracking-[.16em] text-rose-700">Need Attention</h2>
              <span className="rounded-lg bg-rose-100 px-3 py-1 text-xs font-bold text-rose-700">
                {incomplete.length} Actions Required
              </span>
              <span className="h-px flex-1 bg-outline-variant/30" />
            </div>
            {incomplete.map((row) => (
              <ChecklistCard key={row.id} row={row} attention />
            ))}
          </section>
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-extrabold uppercase tracking-[.16em] text-emerald-700">Completed</h2>
              <span className="rounded-lg bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                {complete.length} Ready
              </span>
              <span className="h-px flex-1 bg-outline-variant/30" />
            </div>
            {complete.map((row) => (
              <ChecklistCard key={row.id} row={row} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

function ChecklistCard({ row, attention = false }: { row: ChecklistRow; attention?: boolean }) {
  return (
    <article
      className={`rounded-3xl border p-5 shadow-ambient ${attention ? "border-rose-200 bg-rose-50/70" : "border-emerald-200 bg-emerald-50/60"}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-2xl ${attention ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
        >
          <span className="material-symbols-outlined">{attention ? "pending_actions" : "check_circle"}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wider text-primary">{row.group.code}</p>
          <h3 className="mt-1 font-bold">
            {row.activity} · {row.tripLabel}
          </h3>
          <p className="mt-1 text-sm text-on-surface-variant">{row.group.name}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs sm:min-w-64">
          <span className="rounded-xl bg-surface-container-lowest p-3">
            <b>{formatDate(row.tripDate)}</b>
            <br />
            {row.scheduledTime}
          </span>
          <span className="rounded-xl bg-surface-container-lowest p-3">
            <b>
              {row.verifiedDriverCount}/{row.requiredBusCount}
            </b>
            <br />
            verified driver
          </span>
        </div>
      </div>
    </article>
  );
}
