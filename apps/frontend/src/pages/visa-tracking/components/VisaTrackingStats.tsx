import { MetricCard } from "../../../components/metric-card";
import type { IssuedVisaStatistics } from "../../../shared/group-visa-domain";

export function VisaTrackingStats({
  actionRequiredCount,
  visaRowsCount,
  issuedStatistics,
  selectedMonthLabel,
  unpaidCount,
  dataUnavailable = false,
}: {
  actionRequiredCount: number;
  visaRowsCount: number;
  issuedStatistics: IssuedVisaStatistics;
  selectedMonthLabel: string;
  unpaidCount: number;
  dataUnavailable?: boolean;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Visa tracking summary">
      <MetricCard icon="group" label="Total Groups" value={dataUnavailable ? "—" : visaRowsCount} tone="primary" />
      <MetricCard
        icon="task_alt"
        label="Visa Issued"
        value={dataUnavailable ? "—" : issuedStatistics.selectedMonthPax}
        supportingText={selectedMonthLabel}
        tone="primary"
      />
      <MetricCard icon="warning" label="Action Required" value={dataUnavailable ? "—" : actionRequiredCount} tone="primary" />
      <MetricCard icon="payments" label="Payment Attention" value={dataUnavailable ? "—" : unpaidCount} tone="primary" />
    </section>
  );
}
