import { MetricCard } from "../../../components/metric-card";
import type { IssuedVisaStatistics } from "../../../shared/group-visa-domain";

export function VisaTrackingStats({
  actionRequiredCount,
  visaRowsCount,
  issuedStatistics,
  selectedMonthLabel,
  unpaidCount,
}: {
  actionRequiredCount: number;
  visaRowsCount: number;
  issuedStatistics: IssuedVisaStatistics;
  selectedMonthLabel: string;
  unpaidCount: number;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Visa tracking summary">
      <MetricCard icon="group" label="Total Groups" value={visaRowsCount} tone="primary" />
      <MetricCard
        icon="task_alt"
        label="Visa Issued"
        value={issuedStatistics.selectedMonthPax}
        supportingText={selectedMonthLabel}
        tone="primary"
      />
      <MetricCard icon="warning" label="Action Required" value={actionRequiredCount} tone="primary" />
      <MetricCard icon="payments" label="Payment Attention" value={unpaidCount} tone="primary" />
    </section>
  );
}
