import { useVisaDetailContext } from "../context/VisaDetailContext";
import { getToneClasses, getIconButtonClasses } from "../visa-detail-helpers";

export function VisaStatusSection() {
  const {
    row,
    group,
    paymentStatus,
    visaTone,
    paymentTone,
    raudhahTone,
    raudhahStatusText,
    draftAssignFeedback,
    openVisaStatusModal,
    openVisaTypeModal,
    openPaymentStatusModal,
    openRaudhahModal,
  } = useVisaDetailContext();

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Quick status">
        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visa Status</p>
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses(
                visaTone
              )}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{row.visaStatus}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit visa status"
            onClick={openVisaStatusModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>

        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visa Type</p>
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses(
                "success"
              )}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{group?.visaSetup?.busStatus ?? "Visa Only"}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit visa type"
            onClick={openVisaTypeModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>

        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Status</p>
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses(
                paymentTone
              )}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{paymentStatus}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit payment status"
            onClick={openPaymentStatusModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>

        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="sm:hidden">Raudhah</span>
              <span className="hidden sm:inline">Raudhah Appointment</span>
            </p>
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses(
                raudhahTone
              )}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{raudhahStatusText}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit Raudhah appointment"
            onClick={openRaudhahModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>
      </section>

      {draftAssignFeedback ? (
        <section
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            draftAssignFeedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined mt-0.5 text-base" aria-hidden="true">
            {draftAssignFeedback.tone === "success" ? "check_circle" : "warning"}
          </span>
          <p className="font-semibold">{draftAssignFeedback.message}</p>
        </section>
      ) : null}
    </div>
  );
}
