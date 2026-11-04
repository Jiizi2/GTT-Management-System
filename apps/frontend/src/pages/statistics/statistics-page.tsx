import { DataBoundary } from "../../components/data-boundary";
import { ChartSkeleton, ListSkeleton, MetricSkeleton, SkeletonRegion } from "../../components/skeleton";
import { useState, type ReactNode } from "react";
import { PageHeroSection } from "../../components/page-hero-section";
import { ThemeToggleButton } from "../../components/theme-toggle-button";
import { MetricCard } from "../../components/metric-card";
import { AgentFilterSelect } from "../../components/agent-filter-select";
import { SereneSelect } from "../../components/serene-select";
import {
  useAgentAnalyticsQuery,
  useOperationalAnalyticsQuery,
  useVisaAnalyticsQuery,
} from "../../hooks/use-analytics-backend";
import { useMuassasahQuery } from "../../hooks/use-directory-backend";
import { ANALYTICS_MONTH_WINDOWS, type AnalyticsMonthWindow } from "../../shared/analytics-types";
import {
  MuassasahIssuedChart,
  OperationalTrendChart,
  VisaFunnelChart,
  VisaTrendChart,
  VisaTypeChart,
} from "./components/analytics-charts";

type StatisticsCategoryTab = "all" | "visa" | "operational" | "agents";

const CATEGORY_TABS: Array<{
  key: StatisticsCategoryTab;
  label: string;
  icon: string;
}> = [
  {
    key: "all",
    label: "Semua Statistik",
    icon: "insights",
  },
  {
    key: "visa",
    label: "Visa & Muassasah",
    icon: "verified",
  },
  {
    key: "operational",
    label: "Tren Keberangkatan",
    icon: "flight_takeoff",
  },
  {
    key: "agents",
    label: "Performa Agent",
    icon: "business",
  },
];

function SectionCard({
  title,
  subtitle,
  icon,
  headerAction,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="serene-card p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-xl" aria-hidden="true">
              {icon}
            </span>
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-extrabold tracking-tight text-on-surface">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs font-medium text-on-surface-variant">{subtitle}</p> : null}
          </div>
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </header>
      {children}
    </section>
  );
}

function StatePanel({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex h-60 flex-col items-center justify-center gap-2 text-on-surface-variant sm:h-72">
      <span className="material-symbols-outlined text-3xl opacity-60" aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString("id-ID");
}

export function StatisticsScreen({ showThemeToggle = true }: { showThemeToggle?: boolean }) {
  const [months, setMonths] = useState<AnalyticsMonthWindow>(12);
  const [agentId, setAgentId] = useState("all");
  const [muassasah, setMuassasah] = useState("all");
  const [activeTab, setActiveTab] = useState<StatisticsCategoryTab>("all");
  const filters = { months, agentId, muassasah };

  const muassasahQuery = useMuassasahQuery();
  const muassasahOptions = (muassasahQuery.data ?? []).filter((item) => item.isActive);

  const operational = useOperationalAnalyticsQuery(filters);
  const visa = useVisaAnalyticsQuery(filters);
  const agents = useAgentAnalyticsQuery(filters);

  const totals = operational.data?.totals;
  const visaTotals = visa.data?.totals;
  const visaByType = visa.data?.byVisaType ?? [];
  const visaByMuassasah = visa.data?.byMuassasah ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <header className="serene-page-toolbar">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-on-surface-variant">Ringkasan performa operasional, visa, dan agent.</p>
        </div>
        {showThemeToggle ? <ThemeToggleButton className="sm:ml-auto sm:mr-5" /> : null}
      </header>

      <PageHeroSection
        eyebrow="Performance Analytics"
        title="Statistik & Performa"
        description="Pantau tren keberangkatan, throughput visa, dan kontribusi tiap agent dalam satu tampilan."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-auto sm:min-w-[9rem]">
              <SereneSelect
                className="serene-select-pill h-9 w-full pl-3 pr-9 normal-case tracking-normal"
                value={String(months)}
                onChange={(event) => setMonths(Number(event.target.value) as AnalyticsMonthWindow)}
                aria-label="Rentang waktu"
              >
                {ANALYTICS_MONTH_WINDOWS.map((option) => (
                  <option key={option} value={String(option)}>
                    {option} bulan terakhir
                  </option>
                ))}
              </SereneSelect>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[11rem]">
              <SereneSelect
                className="serene-select-pill h-9 w-full pl-3 pr-9 normal-case tracking-normal"
                value={muassasah}
                onChange={(event) => setMuassasah(event.target.value)}
                aria-label="Filter Muassasah"
                searchable
                searchPlaceholder="Cari muassasah..."
              >
                <option value="all">Semua Muassasah</option>
                {muassasahOptions.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
                <option value="unassigned">Belum Ditentukan</option>
              </SereneSelect>
            </div>
            <AgentFilterSelect value={agentId} onChange={setAgentId} variant="pill" className="w-full sm:w-auto" />
          </div>
        }
      />

      <section className="serene-data-reveal grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan metrik">
        {operational.isPending && operational.data === undefined ? <SkeletonRegion label="Memuat metrik operasional..." className="contents"><div className="contents"><MetricSkeleton /><MetricSkeleton /></div></SkeletonRegion> : <>
        <MetricCard
          icon="groups"
          tone="primary"
          label="Total Jamaah"
          value={totals ? formatNumber(totals.pax) : "—"}
          supportingText={totals ? `${formatNumber(totals.groups)} grup` : undefined}
        />
        <MetricCard
          icon="flight_takeoff"
          tone="primary"
          label="Grup Aktif"
          value={totals ? formatNumber(totals.activeGroups) : "—"}
          supportingText={totals ? `${formatNumber(totals.completedGroups)} selesai` : undefined}
        />
        </>}
        {visa.isPending && visa.data === undefined ? <SkeletonRegion label="Memuat metrik visa..." className="contents"><div className="contents"><MetricSkeleton /><MetricSkeleton /></div></SkeletonRegion> : <>
        <MetricCard
          icon="verified"
          tone="primary"
          label="Jamaah Visa Terbit"
          value={visaTotals ? formatNumber(visaTotals.issuedPax) : "—"}
          supportingText={
            visaTotals ? `${visaTotals.issuedRate}% dari ${formatNumber(visaTotals.totalPax)} jamaah` : undefined
          }
        />
        <MetricCard
          icon="pending_actions"
          tone="primary"
          label="Jamaah Belum Terbit"
          value={visaTotals ? formatNumber(visaTotals.notIssuedPax) : "—"}
          supportingText={visaTotals ? `dari total ${formatNumber(visaTotals.totalPax)} jamaah` : undefined}
        />
        </>}
      </section>

      <nav
        aria-label="Kategori statistik"
        className="grid grid-cols-2 gap-1.5 rounded-xl border border-outline-variant/40 bg-surface-container-low p-1 sm:grid-cols-4"
      >
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={isActive}
              className={`serene-focus-ring inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition ${
                isActive
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-lowest/70 hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined shrink-0 text-base" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {activeTab === "all" || activeTab === "operational" ? (
        <div className="space-y-6">
          <SectionCard
            title="Tren Keberangkatan"
            subtitle="Jumlah jamaah (bar) dan grup (garis) per bulan keberangkatan"
            icon="insights"
          >
            <DataBoundary query={operational} skeleton={<ChartSkeleton />}>
              {operational.data && operational.data.totals.groups > 0 ? (
                <OperationalTrendChart data={operational.data.monthly} />
              ) : (
                <StatePanel icon="bar_chart" message="Belum ada grup pada rentang ini." />
              )}
            </DataBoundary>
          </SectionCard>

          {operational.data && operational.data.packages.length > 0 ? (
            <SectionCard
              title="Distribusi Paket Keberangkatan"
              subtitle="Paket dengan jumlah jamaah dan grup terbanyak pada rentang terpilih"
              icon="flight_takeoff"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {operational.data.packages.map((pkg) => (
                  <div
                    key={pkg.name}
                    className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest/70 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-on-surface">{pkg.name}</div>
                      <div className="text-xs font-medium text-on-surface-variant">
                        {formatNumber(pkg.groups)} grup
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-display text-lg font-extrabold tabular-nums text-primary">
                        {formatNumber(pkg.pax)}
                      </div>
                      <div className="text-[11px] font-semibold text-on-surface-variant">jamaah</div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ) : null}
        </div>
      ) : null}

      {activeTab === "all" || activeTab === "visa" ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Tren Visa Terbit"
              subtitle="Jumlah jamaah yang visanya terbit per bulan (tanggal terbit)"
              icon="description"
            >
              <DataBoundary query={visa} skeleton={<ChartSkeleton />}>
                {visa.data && visa.data.totals.totalPax > 0 ? (
                  <>
                    <VisaTrendChart data={visa.data.monthly} />
                    {visa.data.totals.missingIssuedDatePax > 0 ? (
                      <p className="mt-2 text-xs text-on-surface-variant">
                        {formatNumber(visa.data.totals.missingIssuedDatePax)} jamaah visanya terbit tapi belum ada
                        tanggal terbit, jadi tidak masuk grafik bulanan.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <StatePanel icon="bar_chart" message="Belum ada data visa pada rentang ini." />
                )}
              </DataBoundary>
            </SectionCard>

            <SectionCard title="Status Visa" subtitle="Sebaran jamaah berdasarkan status visa" icon="filter_alt">
              <DataBoundary query={visa} skeleton={<ChartSkeleton horizontal />}>
                {visa.data && visa.data.totals.totalPax > 0 ? (
                  <VisaFunnelChart data={visa.data.funnel} />
                ) : (
                  <StatePanel icon="bar_chart" message="Belum ada data visa pada rentang ini." />
                )}
              </DataBoundary>
            </SectionCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard
              title="Statistik Visa Only vs Visa+"
              subtitle="Perbandingan jumlah grup, jamaah, dan visa terbit berdasarkan tipe layanan visa"
              icon="directions_bus"
            >
              <DataBoundary query={visa} skeleton={<ChartSkeleton horizontal />}>
                {visaByType.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {visaByType.map((item) => (
                        <div
                          key={item.visaType}
                          className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest/70 p-3.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">
                              {item.label}
                            </span>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                              {item.issuedRate}% Terbit
                            </span>
                          </div>
                          <p className="mt-1.5 font-display text-2xl font-extrabold tabular-nums text-on-surface">
                            {formatNumber(item.issuedPax)}{" "}
                            <span className="text-xs font-semibold text-on-surface-variant">
                              / {formatNumber(item.totalPax)} jamaah terbit
                            </span>
                          </p>
                          <p className="mt-1 text-xs font-medium text-on-surface-variant">
                            {formatNumber(item.issuedGroups)} dari {formatNumber(item.groups)} grup terbit ·{" "}
                            {formatNumber(item.notIssuedPax)} jamaah belum terbit
                          </p>
                        </div>
                      ))}
                    </div>
                    <VisaTypeChart data={visaByType} />
                  </div>
                ) : (
                  <StatePanel icon="directions_bus" message="Belum ada data Visa Only / Visa+ pada rentang ini." />
                )}
              </DataBoundary>
            </SectionCard>

            <SectionCard
              title="Grafik Visa Terbit per Muassasah"
              subtitle="Perbandingan jamaah terbit (Issued) dan belum terbit pada setiap Muassasah"
              icon="apartment"
            >
              <DataBoundary query={visa} skeleton={<ChartSkeleton />}>
                {visaByMuassasah.length > 0 ? (
                  <MuassasahIssuedChart data={visaByMuassasah} />
                ) : (
                  <StatePanel icon="apartment" message="Belum ada data Muassasah pada rentang ini." />
                )}
              </DataBoundary>
            </SectionCard>
          </div>

          <SectionCard
            title="Rincian Visa Terbit per Muassasah"
            subtitle="Total grup, jamaah, dan visa yang sudah Issued pada Muassasah A, Muassasah B, dan seterusnya"
            icon="apartment"
          >
            <DataBoundary query={visa} skeleton={<ListSkeleton columns={6} label="Memuat statistik muassasah..." />}>
              {visaByMuassasah.length > 0 ? (
                <div
                  className="overflow-x-auto"
                  role="region"
                  aria-label="Tabel rincian visa per muassasah"
                  tabIndex={0}
                >
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/40 text-left text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                        <th className="py-2.5 pr-3">Muassasah</th>
                        <th className="py-2.5 pr-3 text-right">Grup</th>
                        <th className="py-2.5 pr-3 text-right">Total Jamaah</th>
                        <th className="py-2.5 pr-3 text-right">Visa Terbit (Issued)</th>
                        <th className="py-2.5 pr-3 text-right">Belum Terbit</th>
                        <th className="w-40 py-2.5 text-right">% Terbit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visaByMuassasah.map((item) => (
                        <tr
                          key={item.muassasahId ?? item.name}
                          className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-lowest/60"
                        >
                          <td className="py-2.5 pr-3">
                            <div className="font-semibold text-on-surface">{item.name}</div>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-on-surface">
                            {formatNumber(item.groups)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-on-surface">
                            {formatNumber(item.totalPax)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums font-semibold text-primary">
                            {formatNumber(item.issuedPax)}{" "}
                            <span className="text-xs font-normal text-on-surface-variant">
                              ({formatNumber(item.issuedGroups)} grup)
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-on-surface-variant">
                            {formatNumber(item.notIssuedPax)}
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-container-high sm:block">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${Math.min(100, Math.max(0, item.issuedRate))}%` }}
                                />
                              </div>
                              <span className="w-12 tabular-nums font-semibold text-primary">
                                {item.issuedRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <StatePanel icon="apartment" message="Belum ada data Muassasah." />
              )}
            </DataBoundary>
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "all" || activeTab === "agents" ? (
        <SectionCard title="Performa Agent" subtitle="Kontribusi grup, jamaah, dan penerbitan visa per agent" icon="business">
          <DataBoundary query={agents} skeleton={<ListSkeleton columns={5} label="Memuat performa agent..." />}>
            {agents.data && agents.data.agents.length > 0 ? (
              <div
                className="overflow-x-auto"
                role="region"
                aria-label="Tabel performa agent"
                tabIndex={0}
              >
                <p className="mb-2 text-xs font-medium text-on-surface-variant sm:hidden">
                  Geser tabel ke samping untuk melihat semua kolom.
                </p>
                <table className="w-full min-w-[640px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-outline-variant/40 text-left text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                      <th className="py-2.5 pr-3">Agent</th>
                      <th className="py-2.5 pr-3 text-right">Grup</th>
                      <th className="py-2.5 pr-3 text-right">Jamaah</th>
                      <th className="py-2.5 pr-3 text-right">Visa Terbit</th>
                      <th className="py-2.5 text-right">% Terbit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.data.agents.map((agent) => (
                      <tr
                        key={agent.agentId}
                        className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-lowest/60"
                      >
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold text-on-surface">{agent.name}</div>
                        </td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-on-surface">{formatNumber(agent.groups)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-on-surface">{formatNumber(agent.pax)}</td>
                        <td className="py-2.5 pr-3 text-right tabular-nums text-on-surface-variant">
                          {formatNumber(agent.visaIssuedPax)}
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-primary">
                          {agent.visaIssuedRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <StatePanel icon="business" message="Belum ada data agent." />
            )}
          </DataBoundary>
        </SectionCard>
      ) : null}
    </div>
  );
}
