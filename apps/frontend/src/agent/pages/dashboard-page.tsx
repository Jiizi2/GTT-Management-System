import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { Dashboard, GroupSummary } from "../data/contracts";
import { agentQueryKeys } from "../query/agent-query-boundary";
import { portalGet } from "../data/portal-query";
import { getAllAgentGroups } from "../data/all-groups-query";
import { ErrorState, LoadingState } from "../components/data-state";
import { formatDate } from "../data/format";

export function DashboardPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: agentQueryKeys.dashboard(principalId),
    queryFn: async () => ({
      dashboard: await portalGet<Dashboard>(client, "/dashboard"),
      groups: await getAllAgentGroups(client, "asc"),
    }),
    staleTime: 30_000,
  });
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [month, setMonth] = useState("all");
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data?.groups ?? []).filter(
      (group) =>
        (!term || `${group.code} ${group.name}`.toLowerCase().includes(term)) &&
        (!activeOnly || group.lifecycleStatus === "ACTIVE") &&
        (month === "all" || group.arrivalDate.slice(0, 7) === month),
    );
  }, [query.data?.groups, search, activeOnly, month]);
  const months = useMemo(
    () => [...new Set((query.data?.groups ?? []).map((group) => group.arrivalDate.slice(0, 7)))].sort(),
    [query.data?.groups],
  );
  if (query.isPending) return <LoadingState label="Memuat overview..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;
  const data = query.data.dashboard;
  const cards = [
    {
      label: "Active Groups",
      value: data.groups.active,
      subtitle: "Currently managed",
      icon: "travel_explore",
      tone: "bg-primary",
    },
    {
      label: "Total Jamaah",
      value: data.groups.totalPax,
      subtitle: "Across your groups",
      icon: "groups",
      tone: "bg-secondary",
    },
    {
      label: "Need Attention",
      value: data.attention.visaGroups + data.attention.hotelGroups,
      subtitle: "Visa or agreement",
      icon: "notifications_active",
      tone: "bg-tertiary",
    },
  ];
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-0 pb-20 pt-4 sm:px-2 lg:px-4">
      <header className="serene-page-toolbar pr-14">
        <label className="serene-page-search max-w-xl">
          <span className="material-symbols-outlined text-on-surface-variant/70">search</span>
          <input
            className="serene-page-search-input"
            placeholder="Search groups..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </header>
      <section className="serene-hero">
        <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Operations Overview</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">Itinerary Overview</h1>
        <p className="mt-2 text-on-surface-variant">
          Manage your ongoing Umrah groups and track live itinerary status in real-time.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-[.95fr_1fr_1fr_1fr]">
        <article className="serene-card flex min-h-48 flex-col rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined">quick_reference</span>
            </span>
            <h2 className="font-display text-3xl font-extrabold leading-none text-primary">
              Weekly
              <br />
              Summary
            </h2>
          </div>
          <p className="mt-3 text-sm text-on-surface-variant">Ringkasan itinerary milik agent Anda.</p>
          <button className="serene-btn-primary mt-auto" onClick={() => window.print()}>
            <span className="material-symbols-outlined">download</span>Export Report
          </button>
        </article>
        {cards.map((card) => (
          <article
            key={card.label}
            className={`relative min-h-48 overflow-hidden rounded-2xl p-6 text-on-primary shadow-ambient ${card.tone}`}
          >
            <span className="text-xs font-bold uppercase tracking-[.14em] opacity-80">{card.label}</span>
            <strong className="mt-4 block text-5xl font-extrabold">{card.value}</strong>
            <span className="mt-3 block text-sm font-semibold opacity-80">{card.subtitle}</span>
            <span className="material-symbols-outlined absolute -bottom-1 right-2 text-7xl opacity-20">
              {card.icon}
            </span>
          </article>
        ))}
      </section>
      <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-ambient sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-end gap-2">
          <strong className="text-2xl">{filtered.length}</strong>
          <span className="text-sm text-on-surface-variant">groups displayed</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="overview-select" value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="all">All Months</option>
            {months.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <button
            className={`rounded-xl px-3 py-2 text-sm font-bold ${activeOnly ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant"}`}
            onClick={() => setActiveOnly((value) => !value)}
          >
            <span className="material-symbols-outlined mr-1 align-middle text-base">filter_alt</span>
            Active only
          </button>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.length ? (
          filtered.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onOpenDetail={() => navigate(`/agent/groups/${encodeURIComponent(group.code)}`)}
            />
          ))
        ) : (
          <div className="serene-empty-state col-span-full">
            <span className="material-symbols-outlined text-4xl">search_off</span>
            <h2 className="mt-3 text-xl font-bold">No groups found</h2>
            <p className="mt-2 text-sm">Try another keyword or filter.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function GroupCard({ group, onOpenDetail }: { group: GroupSummary; onOpenDetail: () => void }) {
  const inSaudi = group.lifecycleStatus === "ACTIVE";
  const itinerary = [...group.itinerary].sort((left, right) => {
    const leftKey = `${left.isoDate ?? "9999-12-31"}T${left.time ?? "00:00"}`;
    const rightKey = `${right.isoDate ?? "9999-12-31"}T${right.time ?? "00:00"}`;
    return leftKey.localeCompare(rightKey);
  });
  const now = Date.now();
  const nextIndex = itinerary.findIndex((item) => {
    const timestamp = Date.parse(`${item.isoDate?.slice(0, 10) ?? ""}T${item.time ?? "00:00"}`);
    return Number.isFinite(timestamp) && timestamp >= now;
  });
  const start = Math.max(0, (nextIndex < 0 ? itinerary.length : nextIndex) - 1);
  const preview = itinerary.slice(start, start + 3);
  return (
    <article className="serene-card flex h-full flex-col rounded-3xl px-5 py-6">
      <div className="mx-1 py-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="break-words font-display text-3xl font-extrabold leading-none tracking-tighter text-primary">
              {group.code}
            </p>
            <h2 className="mt-2 truncate text-lg font-bold text-on-surface-variant">{group.name}</h2>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[.68rem] font-black ${inSaudi ? "bg-primary-fixed text-primary" : "bg-surface-container-high text-on-surface-variant"}`}
          >
            {group.lifecycleStatus.replaceAll("_", " ")}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-outline-variant/20 pt-4 text-xs font-semibold text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">groups</span>
            <span>{group.pax} Pax</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">inventory_2</span>
            <span className="truncate">{group.packageName || "Package belum diisi"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">calendar_month</span>
            <span>{formatDate(group.arrivalDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">directions_bus</span>
            <span>{group.totalBuses ?? 0} Bus</span>
          </div>
        </div>
      </div>
      <div className="flex-grow" />
      <section className="mx-1 mb-7 mt-7" aria-label="Itinerary preview">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary/80">Itinerary Preview</p>
          <span className="text-[10px] text-on-surface-variant/60">{group.itinerary.length} trips</span>
        </div>
        {preview.length ? (
          <ol className="space-y-2.5">
            {preview.map((item, index) => {
              const isNext = nextIndex >= 0 && itinerary.indexOf(item) === nextIndex;
              return (
                <li key={item.id} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-3">
                  <div className="relative flex justify-center">
                    {index < preview.length - 1 ? (
                      <span className="absolute top-3 h-[calc(100%+.625rem)] w-px bg-outline-variant/30" />
                    ) : null}
                    <span
                      className={`relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full ${isNext ? "bg-primary" : "bg-primary/45"}`}
                    />
                  </div>
                  <div className={isNext ? "rounded-lg bg-surface-container-high px-2.5 py-1.5" : "px-2.5 py-1.5"}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{item.title}</p>
                      {isNext ? (
                        <span className="rounded-lg bg-primary/15 px-2 py-0.5 text-[9px] font-bold uppercase text-primary">
                          Next
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-on-surface-variant">
                      {item.dateLabel}
                      {item.time ? ` · ${item.time}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-xl bg-surface-container-low p-3 text-sm text-on-surface-variant">Belum ada trip.</p>
        )}
      </section>
      <button type="button" className="serene-btn-secondary mx-1 py-3.5" onClick={onOpenDetail}>
        View Detail
      </button>
    </article>
  );
}
