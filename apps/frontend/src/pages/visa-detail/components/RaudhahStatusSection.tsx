import { useVisaDetailContext } from "../context/VisaDetailContext";
import { getToneTextClass, getRaudhahStatusBadgeClasses } from "../visa-detail-helpers";

export function RaudhahStatusSection() {
  const {
    row,
    raudhahTone,
    paymentTone,
    raudhahAppointments,
    hasRaudhahDates,
    raudhahStatusText,
    raudhahSecondaryText,
    raudhahSecondaryTextMobile,
    providerName,
    paymentStatus,
    setPaymentStatus,
    isRaudhahTemplateCopied,
    openRaudhahModal,
    setIsClearRaudhahConfirmOpen,
    openSyarikahModal,
    onUpdatePaymentStatus,
    handleCopyRaudhahReminder,
  } = useVisaDetailContext();

  return (
    <section className="grid gap-4 lg:grid-cols-3">
      <article className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
              calendar_today
            </span>
            <h3 className="text-lg font-bold text-slate-900">Raudhah</h3>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-1.5 text-xs font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
            onClick={handleCopyRaudhahReminder}
            aria-label={`Copy Raudhah reminder template for ${row.groupCode}`}
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              {isRaudhahTemplateCopied ? "check" : "content_copy"}
            </span>
            <span>{isRaudhahTemplateCopied ? "Copied" : "Copy"}</span>
          </button>
          {isRaudhahTemplateCopied ? (
            <p className="sr-only" role="status" aria-live="polite">
              Raudhah reminder copied.
            </p>
          ) : null}
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Raudhah Dates</p>
          {hasRaudhahDates ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {raudhahAppointments.map((appointment, index) => (
                <div
                  key={`${appointment.dateLabel}-${appointment.status}-${index}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
                >
                  <span className="font-semibold text-slate-700">{appointment.dateLabel}</span>
                  <span
                    className={`inline-flex rounded-lg border px-1.5 py-0.5 text-[10px] font-bold leading-none ${getRaudhahStatusBadgeClasses(
                      appointment.status
                    )}`}
                  >
                    {appointment.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <strong className={`block text-base font-semibold ${getToneTextClass(raudhahTone)}`}>
              Not Set
            </strong>
          )}
          <small className="mt-2 block text-xs text-slate-500">
            <span className="sm:hidden">
              Status: {raudhahStatusText} - {raudhahSecondaryTextMobile}
            </span>
            <span className="hidden sm:inline">
              Status: {raudhahStatusText} - {raudhahSecondaryText}
            </span>
          </small>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-xs font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15"
            onClick={openRaudhahModal}
          >
            Edit
          </button>
          <button
            type="button"
            className="inline-flex rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-1.5 text-xs font-bold leading-none text-slate-700 transition hover:border-slate-400"
            onClick={() => setIsClearRaudhahConfirmOpen(true)}
          >
            Clear
          </button>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
            business
          </span>
          <h3 className="text-lg font-bold text-slate-900">Syarikah</h3>
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider Agency</p>
          <strong className="block text-base font-semibold text-slate-900">{providerName}</strong>
          <small className="text-xs text-slate-500">
            <span className="sm:hidden">Package: {row.packageName}</span>
            <span className="hidden sm:inline">Assigned for {row.packageName} package</span>
          </small>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-xs font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15"
          onClick={openSyarikahModal}
        >
          <span className="sm:hidden">Edit</span>
          <span className="hidden sm:inline">Edit Syarikah</span>
        </button>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
            payments
          </span>
          <h3 className="text-lg font-bold text-slate-900">Payment</h3>
        </div>

        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <strong className={`block text-base font-semibold ${getToneTextClass(paymentTone)}`}>
            {paymentStatus}
          </strong>
          <small className="text-xs text-slate-500">
            <span className="sm:hidden">
              {paymentStatus === "Paid" ? "Payment complete" : "Need follow-up"}
            </span>
            <span className="hidden sm:inline">
              {paymentStatus === "Paid" ? "Payment is complete" : "Payment still requires follow-up"}
            </span>
          </small>
        </div>

        <button
          type="button"
          className="mt-4 inline-flex rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold leading-none text-on-primary transition hover:bg-primary-container"
          onClick={() => {
            const nextStatus = paymentStatus === "Paid" ? "Unpaid" : "Paid";
            setPaymentStatus(nextStatus);
            onUpdatePaymentStatus(row.groupCode, nextStatus);
          }}
        >
          <span className="sm:hidden">{paymentStatus === "Paid" ? "Mark Unpaid" : "Mark Paid"}</span>
          <span className="hidden sm:inline">
            {paymentStatus === "Paid" ? "Mark as Unpaid" : "Toggle to Paid"}
          </span>
        </button>
      </article>
    </section>
  );
}
