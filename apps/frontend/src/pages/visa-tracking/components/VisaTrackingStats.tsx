import { MetricCard } from "../../../components/metric-card";

export function VisaTrackingStats({
  actionRequiredCount,
  visaRowsCount,
  issuedPaxCount,
  unpaidCount,
}: {
  actionRequiredCount: number;
  visaRowsCount: number;
  issuedPaxCount: number;
  unpaidCount: number;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Visa tracking summary">
      <MetricCard icon="group" label="Total Groups" value={visaRowsCount} tone="primary" />
      <MetricCard icon="task_alt" label="Visas Issued" value={issuedPaxCount} tone="success" />
      <MetricCard icon="warning" label="Action Required" value={actionRequiredCount} tone="warning" />
      <MetricCard icon="payments" label="Payment Attention" value={unpaidCount} tone="info" />
    </section>
  );
}
