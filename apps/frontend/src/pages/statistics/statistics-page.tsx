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
import { ANALYTICS_MONTH_WINDOWS, type AnalyticsMonthWindow } from "../../shared/analytics-types";
import { OperationalTrendChart, VisaFunnelChart, VisaTrendChart } from "./components/analytics-charts";

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section className="serene-card p-4 sm:p-5">
      <header className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-xl" aria-hidden="true">
            {icon}
          </span>
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-on-surface">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs font-medium text-on-surface-variant">{subtitle}</p> : null}
        </div>
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
  const filters = { months, agentId };

  const operational = useOperationalAnalyticsQuery(filters);
  const visa = useVisaAnalyticsQuery(filters);
  const agents = useAgentAnalyticsQuery(filters);

  const totals = operational.data?.totals;
  const visaTotals = visa.data?.totals;

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
            <AgentFilterSelect value={agentId} onChange={setAgentId} variant="pill" className="w-full sm:w-auto" />
          </div>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Ringkasan metrik">
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
      </section>

      <SectionCard
        title="Tren Keberangkatan"
        subtitle="Jumlah jamaah (bar) dan grup (garis) per bulan keberangkatan"
        icon="insights"
      >
        {operational.isPending ? (
          <StatePanel icon="hourglass_top" message="Memuat data operasional…" />
        ) : operational.isError ? (
          <StatePanel icon="error" message="Gagal memuat data operasional." />
        ) : operational.data && operational.data.totals.groups > 0 ? (
          <OperationalTrendChart data={operational.data.monthly} />
        ) : (
          <StatePanel icon="bar_chart" message="Belum ada grup pada rentang ini." />
        )}
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Tren Visa Terbit" subtitle="Jumlah jamaah yang visanya terbit per bulan (tanggal terbit)" icon="description">
          {visa.isPending ? (
            <StatePanel icon="hourglass_top" message="Memuat data visa…" />
          ) : visa.isError ? (
            <StatePanel icon="error" message="Gagal memuat data visa." />
          ) : visa.data && visa.data.totals.totalPax > 0 ? (
            <>
              <VisaTrendChart data={visa.data.monthly} />
              {visa.data.totals.missingIssuedDatePax > 0 ? (
                <p className="mt-2 text-xs text-on-surface-variant">
                  {formatNumber(visa.data.totals.missingIssuedDatePax)} jamaah visanya terbit tapi belum ada tanggal
                  terbit, jadi tidak masuk grafik bulanan.
                </p>
              ) : null}
            </>
          ) : (
            <StatePanel icon="bar_chart" message="Belum ada data visa pada rentang ini." />
          )}
        </SectionCard>

        <SectionCard title="Status Visa" subtitle="Sebaran jamaah berdasarkan status visa" icon="filter_alt">
          {visa.isPending ? (
            <StatePanel icon="hourglass_top" message="Memuat status visa…" />
          ) : visa.isError ? (
            <StatePanel icon="error" message="Gagal memuat status visa." />
          ) : visa.data && visa.data.totals.totalPax > 0 ? (
            <VisaFunnelChart data={visa.data.funnel} />
          ) : (
            <StatePanel icon="bar_chart" message="Belum ada data visa pada rentang ini." />
          )}
        </SectionCard>
      </div>

      <SectionCard title="Performa Agent" subtitle="Kontribusi grup, jamaah, dan penerbitan visa per agent" icon="business">
        {agents.isPending ? (
          <StatePanel icon="hourglass_top" message="Memuat performa agent…" />
        ) : agents.isError ? (
          <StatePanel icon="error" message="Gagal memuat performa agent." />
        ) : agents.data && agents.data.agents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-outline-variant/40 text-left text-xs font-bold uppercase tracking-wide text-on-surface-variant">
                  <th className="py-2.5 pr-3">Agent</th>
                  <th className="py-2.5 pr-3 text-right">Grup</th>
                  <th className="py-2.5 pr-3 text-right">Jamaah</th>
                  <th className="py-2.5 pr-3 text-right">Visa Terbit</th>
                  <th className="py-2.5 text-right">% Terbit</th>
                  {/* Visa Terbit & % Terbit measured in pilgrims (pax) */}
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
      </SectionCard>
    </div>
  );
}
