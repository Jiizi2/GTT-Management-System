import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import type { Dashboard, GroupSummary } from "../data/contracts";
import { formatDate } from "../data/format";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";
import { ErrorState, LoadingState } from "../components/data-state";

const number = new Intl.NumberFormat("id-ID");

export function DashboardPage({ principalId, agentName }: { principalId: string; agentName: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: agentQueryKeys.dashboard(principalId),
    queryFn: () => portalGet<Dashboard>(client, "/dashboard"),
    staleTime: 30_000,
  });

  if (query.isPending) return <LoadingState label="Memuat dashboard..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;

  const dashboard = query.data;
  return (
    <PageLayout>
      <PageHeader
        title="Dashboard"
        description={
          <>
            Ringkasan statistik group yang ditangani oleh <strong className="text-on-surface">{agentName}</strong>.
          </>
        }
      />

      <section className="serene-section overflow-hidden" aria-labelledby="group-summary-title">
        <div className="grid lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,2.2fr)]">
          <div className="flex flex-col justify-between bg-primary px-5 py-6 text-on-primary sm:px-7">
            <div>
              <h2 id="group-summary-title" className="text-sm font-bold text-on-primary/80">
                Total group ditangani
              </h2>
              <strong className="mt-3 block text-5xl font-extrabold leading-none tabular-nums">
                {number.format(dashboard.groups.total)}
              </strong>
            </div>
            <Link
              to="/agent/groups"
              className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl bg-on-primary px-4 py-2 text-sm font-bold text-primary transition hover:bg-on-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-primary"
            >
              Buka Perjalanan
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                arrow_forward
              </span>
            </Link>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4">
            <DashboardValue label="Aktif" value={dashboard.groups.active} icon="travel_explore" />
            <DashboardValue label="Akan datang" value={dashboard.groups.upcoming} icon="event_upcoming" />
            <DashboardValue label="Selesai" value={dashboard.groups.completed} icon="task_alt" />
            <DashboardValue label="Diarsipkan" value={dashboard.groups.archived} icon="inventory_2" />
          </dl>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="serene-section min-w-0 p-5 sm:p-6" aria-labelledby="operational-summary-title">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 id="operational-summary-title" className="text-xl font-extrabold text-on-surface">
                Ringkasan operasional
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">Angka sesuai data yang tersedia saat ini.</p>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary" aria-hidden="true">
              monitoring
            </span>
          </div>

          <dl className="mt-6 divide-y divide-outline-variant/30">
            <OperationalValue label="Total jamaah" value={dashboard.groups.totalPax} />
            <OperationalValue label="Group dengan perhatian visa" value={dashboard.attention.visaGroups} />
            <OperationalValue label="Group dengan perhatian hotel" value={dashboard.attention.hotelGroups} />
          </dl>

          <Link to="/agent/visa" className="serene-btn-secondary mt-6 min-h-11 w-full justify-center">
            Lihat Visa Tracking
            <span className="material-symbols-outlined text-lg" aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        </section>

        <section className="serene-section min-w-0 p-5 sm:p-6" aria-labelledby="upcoming-groups-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 id="upcoming-groups-title" className="text-xl font-extrabold text-on-surface">
                Group mendatang
              </h2>
              <p className="mt-1 text-sm text-on-surface-variant">Jadwal terdekat dari ringkasan Dashboard.</p>
            </div>
            {dashboard.upcomingGroups.length > 0 ? (
              <Link
                className="inline-flex min-h-11 items-center text-sm font-bold text-primary underline-offset-4 hover:underline"
                to="/agent/groups"
              >
                Lihat semua
              </Link>
            ) : null}
          </div>

          {dashboard.upcomingGroups.length > 0 ? (
            <ul className="mt-5 divide-y divide-outline-variant/30">
              {dashboard.upcomingGroups.slice(0, 4).map((group) => (
                <UpcomingGroup key={group.id} group={group} />
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
              Belum ada group mendatang pada data saat ini.
            </p>
          )}
        </section>
      </div>

      <section className="serene-section p-5 sm:p-6" aria-labelledby="recent-activity-title">
        <h2 id="recent-activity-title" className="text-xl font-extrabold text-on-surface">
          Aktivitas terbaru
        </h2>
        <p className="mt-1 text-sm text-on-surface-variant">Aktivitas itinerary yang tercatat untuk group Anda.</p>

        {dashboard.recentTimeline.length > 0 ? (
          <ol className="mt-5 grid gap-x-8 gap-y-1 md:grid-cols-2">
            {dashboard.recentTimeline.slice(0, 6).map((item, index) => (
              <li
                key={`${item.group.id}-${item.dateLabel}-${index}`}
                className="flex gap-3 border-b border-outline-variant/25 py-4"
              >
                <span
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.isCurrent ? "bg-primary" : "bg-outline"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-primary">
                    {item.group.code} · {item.dateLabel}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-on-surface">{item.title}</p>
                  <p className="mt-1 truncate text-xs text-on-surface-variant">{item.group.name}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">
            Belum ada aktivitas itinerary yang dapat ditampilkan.
          </p>
        )}
      </section>
    </PageLayout>
  );
}

function DashboardValue({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="flex min-h-32 flex-col justify-between border-b border-outline-variant/30 p-4 even:border-l sm:min-h-40 sm:p-5 lg:border-b-0 lg:border-l lg:first:border-l-0">
      <span className="material-symbols-outlined text-2xl text-primary" aria-hidden="true">
        {icon}
      </span>
      <div>
        <dd className="text-3xl font-extrabold leading-none text-on-surface tabular-nums">{number.format(value)}</dd>
        <dt className="mt-2 text-xs font-bold text-on-surface-variant">{label}</dt>
      </div>
    </div>
  );
}

function OperationalValue({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-3">
      <dt className="text-sm font-semibold text-on-surface-variant">{label}</dt>
      <dd className="text-xl font-extrabold text-on-surface tabular-nums">{number.format(value)}</dd>
    </div>
  );
}

function UpcomingGroup({ group }: { group: GroupSummary }) {
  return (
    <li className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <p className="text-xs font-bold text-primary">{group.code}</p>
        <p className="mt-1 truncate text-sm font-bold text-on-surface">{group.name}</p>
        <p className="mt-1 text-xs text-on-surface-variant">
          {formatDate(group.arrivalDate)} · {number.format(group.pax)} jamaah
        </p>
      </div>
      <Link
        to={`/agent/groups/${encodeURIComponent(group.code)}`}
        state={{ from: "/agent/overview" }}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-primary transition hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label={`Buka itinerary ${group.code}`}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          arrow_forward
        </span>
      </Link>
    </li>
  );
}
