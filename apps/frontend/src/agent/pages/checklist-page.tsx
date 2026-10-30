import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { agentQueryKeys } from "../query/agent-query-boundary";
import {
  checklistDateRange,
  checklistInRange,
  checklistReady,
  getAgentChecklist,
  type ChecklistRow,
} from "../data/h1-checklist";
import { jakartaToday } from "../data/departure-calendar";
import { getAllAgentGroups } from "../data/all-groups-query";
import { formatDate } from "../data/format";
import { EmptyState } from "../components/data-state";
import { DataBoundary } from "../../components/data-boundary";
import { Skeleton, ChecklistSkeleton } from "../../components/skeleton";
import { PageLayout } from "../../components/page-layout";
import { PageHeader } from "../../components/page-header";
import { Button } from "../../components/button";
import { GroupIdentity } from "../../components/group-identity";
import { ListToolbar, ResultSummary } from "../../components/list-toolbar";
import { SearchField } from "../../components/search-field";
import { SectionHeader } from "../../components/section-header";
import { StatusBadge } from "../../components/status-badge";

export function ChecklistPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: agentQueryKeys.checklist(principalId),
    queryFn: async ({ signal }) => {
      const groups = await getAllAgentGroups(client, "asc", signal);
      return getAgentChecklist(client, groups, signal);
    },
    staleTime: 30_000,
  });
  const range = useMemo(() => checklistDateRange(jakartaToday()), []);
  const rows = useMemo(
    () =>
      (query.data ?? []).filter(
        (row) =>
          checklistInRange(row, range) &&
          (!search.trim() || `${row.group.code} ${row.group.name}`.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [query.data, range, search],
  );
  const incomplete = rows.filter((row) => !checklistReady(row));
  const complete = rows.filter(checklistReady);
  return (
    <PageLayout width="standard">
      <PageHeader
        variant="compact"
        title="H-1 Checklist"
        description="Kesiapan driver untuk perjalanan hari ini, besok, dan lusa."
      />
      <ListToolbar
        ariaLabel="Filter checklist"
        footer={
          <ResultSummary onReset={search.trim() && rows.length > 0 ? () => setSearch("") : undefined}>
            {query.data === undefined ? query.isPending ? <Skeleton className="h-4 w-6" /> : "—" : rows.length} aktivitas ditemukan
          </ResultSummary>
        }
      >
        <SearchField
          label="Cari group checklist"
          placeholder="Search group number, e.g. 901794508"
          value={search}
          onChange={setSearch}
        />
      </ListToolbar>
      <DataBoundary query={query} skeleton={<ChecklistSkeleton />}>
      {rows.length === 0 ? (
        <EmptyState
          icon={search.trim() ? "search_off" : "event_busy"}
          title={search.trim() ? "Tidak ada checklist yang sesuai" : "Tidak ada perjalanan dalam 3 hari ke depan"}
          description={
            search.trim()
              ? "Ubah kata pencarian untuk melihat checklist lainnya."
              : "Belum ada itinerary untuk hari ini, besok, atau lusa."
          }
          action={
            search.trim() ? (
              <Button variant="secondary" onClick={() => setSearch("")}>
                Reset filter
              </Button>
            ) : undefined
          }
        />
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
            <SectionHeader
              title="Need Attention"
              actions={<StatusBadge tone="attention">{incomplete.length} Actions Required</StatusBadge>}
            />
            {incomplete.map((row) => (
              <ChecklistCard key={row.id} row={row} attention />
            ))}
          </section>
          <section className="space-y-4">
            <SectionHeader
              title="Completed"
              actions={<StatusBadge tone="complete">{complete.length} Ready</StatusBadge>}
            />
            {complete.map((row) => (
              <ChecklistCard key={row.id} row={row} />
            ))}
          </section>
        </>
      )}
      </DataBoundary>
    </PageLayout>
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
          <GroupIdentity code={row.group.code} name={row.group.name} />
          <h3 className="mt-1 font-bold">
            {row.activity} · {row.tripLabel}
          </h3>
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
