export function VisaTrackingStats({
  isDarkMode,
  actionRequiredCount,
  visaRowsCount,
  issuedPaxCount,
  unpaidCount,
}: {
  isDarkMode: boolean;
  actionRequiredCount: number;
  visaRowsCount: number;
  issuedPaxCount: number;
  unpaidCount: number;
}) {
  const summaryIconClassName = isDarkMode
    ? "material-symbols-outlined text-primary"
    : "material-symbols-outlined text-emerald-700";

  const actionRequiredSummaryCardClassName = isDarkMode
    ? "serene-accent-card flex items-center gap-3 bg-primary p-4 text-on-primary"
    : "serene-stat-card border-amber-200 bg-amber-50";

  const actionRequiredIconClassName = isDarkMode
    ? "material-symbols-outlined text-on-primary"
    : "material-symbols-outlined text-amber-700";

  const actionRequiredLabelClassName = isDarkMode
    ? "text-xs font-bold uppercase tracking-[0.14em] text-on-primary/75"
    : "text-xs font-semibold uppercase tracking-wide text-amber-700";

  const actionRequiredValueClassName = isDarkMode
    ? "text-xl font-extrabold text-on-primary"
    : "text-xl font-bold text-amber-900";

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Visa tracking summary">
      <article className="serene-stat-card">
        <span className={summaryIconClassName} aria-hidden="true">
          group
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span className="sm:hidden">Groups</span>
            <span className="hidden sm:inline">Total Groups</span>
          </p>
          <strong className="text-xl font-bold text-slate-900">{visaRowsCount}</strong>
        </div>
      </article>

      <article className="serene-stat-card">
        <span className={summaryIconClassName} aria-hidden="true">
          task_alt
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span className="sm:hidden">Issued</span>
            <span className="hidden sm:inline">Visas Issued</span>
          </p>
          <strong className="text-xl font-bold text-slate-900">{issuedPaxCount}</strong>
        </div>
      </article>

      <article className={actionRequiredSummaryCardClassName}>
        <span className={actionRequiredIconClassName} aria-hidden="true">
          warning
        </span>
        <div>
          <p className={actionRequiredLabelClassName}>
            <span className="sm:hidden">Need Action</span>
            <span className="hidden sm:inline">Action Required</span>
          </p>
          <strong className={actionRequiredValueClassName}>{actionRequiredCount}</strong>
        </div>
      </article>

      <article className="serene-stat-card">
        <span className={summaryIconClassName} aria-hidden="true">
          payments
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span className="sm:hidden">Payment</span>
            <span className="hidden sm:inline">Payment Attention</span>
          </p>
          <strong className="text-xl font-bold text-slate-900">{unpaidCount}</strong>
        </div>
      </article>
    </section>
  );
}
