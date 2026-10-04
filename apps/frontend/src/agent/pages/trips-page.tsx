import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { PaginationControls } from "../../components/pagination-controls";
import { SereneSelect } from "../../components/serene-select";
import type { GroupSummary, LifecycleStatus } from "../data/contracts";
import { formatDate } from "../data/format";
import { getAllAgentGroups } from "../data/all-groups-query";
import { agentQueryKeys } from "../query/agent-query-boundary";
import { ErrorState, LoadingState } from "../components/data-state";

import { groupAgentFamilies } from "../data/group-families";

const PAGE_SIZE = 6;
const departureDay = new Intl.DateTimeFormat("id-ID", { day: "2-digit", timeZone: "Asia/Jakarta" });
const departureMonth = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "Asia/Jakarta" });

const lifecycleLabels: Record<LifecycleStatus, string> = {
  ENTRY_ONLY: "Data awal",
  ACTIVE: "Aktif",
  INACTIVE: "Tidak aktif",
  COMPLETED: "Selesai",
  ARCHIVED: "Diarsipkan",
};

function monthLabel(value: string): string {
  const parsed = new Date(`${value}-01T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(parsed);
}

export function TripsPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [currentPage, setCurrentPage] = useState(1);
  const search = params.get("q") ?? "";
  const activeOnly = params.get("active") === "1";
  const month = params.get("month") ?? "all";

  const query = useQuery({
    queryKey: agentQueryKeys.groups(principalId, "trip-index"),
    queryFn: () => getAllAgentGroups(client, "asc"),
    staleTime: 30_000,
  });

  const groups = useMemo(() => query.data ?? [], [query.data]);
  const monthOptions = useMemo(
    () => [
      { value: "all", label: "Semua bulan" },
      ...[...new Set(groups.map((group) => group.arrivalDate.slice(0, 7)).filter(Boolean))]
        .sort()
        .map((value) => ({ value, label: monthLabel(value) })),
    ],
    [groups],
  );
  const families = useMemo(() => groupAgentFamilies(groups), [groups]);
  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return families.filter((family) =>
      family.members.some(
        (group) =>
          (!term || `${group.code} ${group.name} ${group.packageName}`.toLowerCase().includes(term)) &&
          (!activeOnly || group.lifecycleStatus === "ACTIVE") &&
          (month === "all" || group.arrivalDate.slice(0, 7) === month),
      ),
    );
  }, [activeOnly, families, month, search]);
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const visibleGroups = filteredGroups.slice(pageStart, pageStart + PAGE_SIZE);
  const hasFilters = Boolean(search.trim()) || activeOnly || month !== "all";

  useEffect(() => setCurrentPage(1), [activeOnly, month, search]);
  useEffect(() => setCurrentPage((page) => Math.min(page, totalPages)), [totalPages]);

  const updateFilter = (key: "q" | "active" | "month", value: string | null) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all" || (key === "active" && value !== "1")) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const resetFilters = () => setParams({}, { replace: true });
  const openDetail = (groupCode: string) => {
    navigate(`/agent/groups/${encodeURIComponent(groupCode)}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
  };

  if (query.isPending) return <LoadingState label="Memuat perjalanan..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;

  const activeGroupCount = families.filter((family) =>
    family.members.some((group) => group.lifecycleStatus === "ACTIVE"),
  ).length;
  const totalPax = groups.reduce((total, group) => total + group.pax, 0);

  return (
    <PageLayout className="agent-page-layout">
      <PageHeader
        variant="compact"
        title="Perjalanan"
        description="Temukan group yang ditugaskan dan buka itinerary perjalanannya."
        actions={
          <TripHeaderSummary total={families.length} groups={groups.length} active={activeGroupCount} pax={totalPax} />
        }
      />

      <section className="serene-section p-4 sm:p-5" aria-label="Filter perjalanan">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-on-surface">Cari perjalanan</span>
            <span className="serene-page-search min-h-11">
              <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
                search
              </span>
              <input
                type="search"
                className="serene-page-search-input h-full"
                placeholder="Kode atau nama group"
                value={search}
                onChange={(event) => updateFilter("q", event.target.value)}
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-on-surface">Bulan keberangkatan</span>
            <SereneSelect
              className="h-11 w-full rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface"
              value={month}
              onChange={(event) => updateFilter("month", event.target.value)}
              aria-label="Filter bulan keberangkatan"
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SereneSelect>
          </label>

          <button
            type="button"
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition ${
              activeOnly
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary"
            }`}
            aria-pressed={activeOnly}
            onClick={() => updateFilter("active", activeOnly ? null : "1")}
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              filter_alt
            </span>
            Hanya aktif
          </button>
        </div>

        <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-4">
          <p className="text-sm text-on-surface-variant" aria-live="polite">
            <strong className="text-on-surface tabular-nums">{filteredGroups.length}</strong> perjalanan ditemukan
          </p>
          {hasFilters ? (
            <button type="button" className="serene-btn-secondary min-h-11" onClick={resetFilters}>
              Reset filter
            </button>
          ) : null}
        </div>
      </section>

      {groups.length === 0 ? (
        <EmptyTrips
          icon="luggage"
          title="Belum ada perjalanan yang ditugaskan"
          description="Group yang ditugaskan kepada akun Agent ini akan muncul di halaman Perjalanan."
        />
      ) : filteredGroups.length === 0 ? (
        <EmptyTrips
          icon="search_off"
          title="Tidak ada perjalanan yang sesuai"
          description="Ubah kata pencarian atau filter untuk melihat perjalanan lainnya."
          action={
            <button type="button" className="serene-btn-secondary min-h-11" onClick={resetFilters}>
              Reset filter
            </button>
          }
        />
      ) : (
        <>
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Daftar perjalanan">
            {visibleGroups.map(({ root, members }) => (
              <TripCard
                key={root.id}
                group={root}
                members={members}
                expandFamily={hasFilters}
                onOpen={() => openDetail(root.code)}
                onOpenMember={openDetail}
              />
            ))}
          </section>
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredGroups.length}
            rangeStart={pageStart + 1}
            rangeEnd={Math.min(pageStart + visibleGroups.length, filteredGroups.length)}
            itemLabel="perjalanan"
            onPageChange={setCurrentPage}
            touchSafe
          />
        </>
      )}
    </PageLayout>
  );
}

function TripCard({
  group,
  members,
  expandFamily,
  onOpen,
  onOpenMember,
}: {
  group: GroupSummary;
  members: GroupSummary[];
  expandFamily: boolean;
  onOpen: () => void;
  onOpenMember: (code: string) => void;
}) {
  const preview = group.itinerary.slice(0, 3);
  const parsedDeparture = new Date(group.arrivalDate);
  const departure = Number.isNaN(parsedDeparture.getTime())
    ? { day: "--", month: "-" }
    : {
        day: departureDay.format(parsedDeparture),
        month: departureMonth.format(parsedDeparture).replace(".", ""),
      };
  return (
    <article className="serene-card flex h-full flex-col overflow-hidden p-0">
      <div className="relative overflow-hidden bg-surface-container-high p-5">
        <span
          className="material-symbols-outlined pointer-events-none absolute -bottom-7 -right-4 rotate-[-10deg] text-[7rem] leading-none text-primary/10"
          aria-hidden="true"
        >
          route
        </span>
        <div className="relative flex items-start gap-4">
          <div className="flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center rounded-2xl bg-primary text-on-primary shadow-sm">
            <strong className="text-2xl font-extrabold leading-none tabular-nums">{departure.day}</strong>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-[0.08em]">{departure.month}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold text-primary">{group.code}</p>
              <span className="shrink-0 rounded-lg bg-surface-container-lowest/80 px-2.5 py-1 text-xs font-bold text-primary">
                {lifecycleLabels[group.lifecycleStatus]}
              </span>
            </div>
            <h2 className="mt-2 line-clamp-2 text-lg font-extrabold leading-snug text-on-surface">{group.name}</h2>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-outline-variant/30 pb-4 text-sm">
          <TripValue label="Kembali" value={formatDate(group.returnDate)} />
          <TripValue
            label={members.length > 1 ? "Total jamaah" : "Jamaah"}
            value={`${members.reduce((total, member) => total + member.pax, 0)} pax`}
          />
          <TripValue label="Paket" value={group.packageName || "Belum tersedia"} />
          <TripValue label="Armada" value={group.totalBuses ? `${group.totalBuses} bus` : "Belum tersedia"} />
        </dl>

        {members.length > 1 ? (
          <details
            className="agent-family mt-4 border-b border-outline-variant/30 pb-3"
            open={expandFamily || undefined}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-primary">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  groups
                </span>
                {members.length} group terhubung
              </span>
              <span className="agent-disclosure-icon material-symbols-outlined text-lg" aria-hidden="true">
                expand_more
              </span>
            </summary>
            <ul className="mt-2 divide-y divide-outline-variant/30">
              {members.map((member) => (
                <li key={member.id}>
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-surface-container-low"
                    onClick={() => onOpenMember(member.code)}
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <strong className="break-all text-sm text-primary">{member.code}</strong>
                      </span>
                      <span className="mt-1 block break-words text-xs text-on-surface-variant">{member.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-on-surface tabular-nums">
                      {member.pax} pax
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <section className="mt-5 flex-1" aria-label={`Ringkasan itinerary ${group.code}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold text-on-surface">Itinerary terdekat</h3>
            <span className="text-xs font-semibold text-on-surface-variant">{formatDate(group.arrivalDate)}</span>
          </div>
          {preview.length > 0 ? (
            <ol className="mt-3 space-y-3">
              {preview.map((item, index) => (
                <li key={item.id} className="relative grid grid-cols-[0.75rem_minmax(0,1fr)] gap-3 pb-1">
                  {index < preview.length - 1 ? (
                    <span
                      className="absolute bottom-[-0.75rem] left-[0.34rem] top-3 w-px bg-outline-variant/70"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className="relative mt-1.5 h-3 w-3 rounded-full border-[3px] border-primary/20 bg-primary"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">{item.title}</p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {item.dateLabel}
                      {item.time ? ` · ${item.time}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="mt-3 flex min-h-24 items-center gap-3 rounded-xl bg-surface-container-low p-4">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary">
                <span className="material-symbols-outlined text-xl" aria-hidden="true">
                  route
                </span>
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface">Itinerary belum dicatat</p>
                <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">
                  Detail perjalanan akan muncul setelah itinerary tersedia.
                </p>
              </div>
            </div>
          )}
        </section>

        <div className="mt-5 flex items-center gap-3 border-t border-outline-variant/30 pt-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              person
            </span>
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-on-surface-variant">Musyrif</p>
            <p className="truncate text-sm font-bold text-on-surface">{group.musyrif?.name || "Belum ditugaskan"}</p>
          </div>
        </div>

        <button type="button" className="serene-btn-secondary mt-5 min-h-11 w-full justify-center" onClick={onOpen}>
          Lihat itinerary
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            arrow_forward
          </span>
        </button>
      </div>
    </article>
  );
}

function TripHeaderSummary({
  total,
  groups,
  active,
  pax,
}: {
  total: number;
  groups: number;
  active: number;
  pax: number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3" aria-label={`${total} perjalanan, ${active} aktif, ${pax} jamaah`}>
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary">
        <span className="material-symbols-outlined text-2xl" aria-hidden="true">
          luggage
        </span>
      </span>
      <div className="min-w-0">
        <p className="text-sm font-extrabold text-on-surface">
          {total} perjalanan <span className="font-medium text-on-surface-variant">· {groups} group</span>
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">
          <strong className="text-primary tabular-nums">{active}</strong> aktif · {pax} jamaah
        </p>
      </div>
    </div>
  );
}

function TripValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
      <dd className="mt-1 truncate font-bold text-on-surface" title={value}>
        {value}
      </dd>
    </div>
  );
}

function EmptyTrips({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="serene-empty-state" aria-labelledby="empty-trips-title">
      <span className="material-symbols-outlined text-4xl text-on-surface-variant/60" aria-hidden="true">
        {icon}
      </span>
      <h2 id="empty-trips-title" className="mt-3 text-xl font-bold text-on-surface">
        {title}
      </h2>
      <p className="mt-2 max-w-xl text-sm text-on-surface-variant">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}
