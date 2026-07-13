import type { ReminderItem, ReminderSlot, PendingTasrehAction } from "../hooks/use-raudhah-reminder";
import {
  reminderSectionConfig,
  getReminderCardStatusClass,
  formatReminderCardStatusLabel,
  countSlotStatuses,
  shouldShowSlotStatusBadge,
  getSlotStatusBadgeClasses,
  formatSlotStatusCompactLabel,
  getRaudhahStatusBadgeClasses,
  getTasrehPrintButtonClasses,
} from "../hooks/use-raudhah-reminder";
import { formatVisaDateWithYear } from "../../../shared/app-domain";

export function RaudhahReminderCard({
  item,
  slot,
  copiedItemId,
  isDarkMode,
  onCopyTemplate,
  onOpenVisaDetail,
  onInitiateTasrehAction,
}: {
  item: ReminderItem;
  slot: ReminderSlot;
  copiedItemId: string | null;
  isDarkMode: boolean;
  onCopyTemplate: (item: ReminderItem) => void;
  onOpenVisaDetail: (groupCode: string) => void;
  onInitiateTasrehAction: (action: PendingTasrehAction) => void;
}) {
  const config = reminderSectionConfig[slot];
  const isCopied = copiedItemId === item.id;
  const sortedAppointments = [...item.appointments].sort((left, right) => {
    const bookingOrder = left.bookingDateIso.localeCompare(right.bookingDateIso);
    if (bookingOrder !== 0) {
      return bookingOrder;
    }
    return left.targetDateIso.localeCompare(right.targetDateIso);
  });
  const cardSummary = countSlotStatuses(item.appointments);

  return (
    <article
      className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-ambient ${config.cardClassName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <strong className="text-lg font-extrabold tracking-wide text-slate-800">{item.groupCode}</strong>
        <span
          className={`text-[11px] font-extrabold uppercase tracking-[0.12em] ${getReminderCardStatusClass(cardSummary, isDarkMode)}`}
        >
          {formatReminderCardStatusLabel(cardSummary)}
        </span>
      </div>

      <h4 className="mt-3 truncate text-base font-bold text-on-surface">{item.groupName}</h4>
      <p className="mt-1 text-xs text-on-surface-variant">{item.pax} Pilgrims</p>

      <div className="mt-4 border-t border-outline-variant/35 pt-3">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/75">
            {sortedAppointments.length > 1 ? "Target Dates" : "Target Date"}
          </span>
          {sortedAppointments.length > 1 ? (
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/70">
              {sortedAppointments.length} entries
            </span>
          ) : null}
        </div>

        <div className="mt-2 space-y-2.5">
          {sortedAppointments.map((appointment) => (
            <div key={appointment.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                    Target Date
                  </span>
                  <strong className="mt-0.5 block text-base font-extrabold leading-tight text-slate-800">
                    {formatVisaDateWithYear(appointment.targetDateIso)}
                  </strong>
                </div>
                {shouldShowSlotStatusBadge(appointment.slotStatus) ? (
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap ${getSlotStatusBadgeClasses(
                      appointment.slotStatus,
                    )}`}
                  >
                    {formatSlotStatusCompactLabel(appointment.slotStatus, appointment.daysUntilBooking)}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="min-w-0 text-xs font-semibold text-slate-600">
                  Booking Date:{" "}
                  <span className="font-bold text-slate-800">
                    {formatVisaDateWithYear(appointment.bookingDateIso)}
                  </span>
                </p>
                <span
                  className={`inline-flex items-center rounded-md border font-bold leading-none whitespace-nowrap ${
                    appointment.status === "After" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"
                  } ${getRaudhahStatusBadgeClasses(appointment.status)}`}
                >
                  {appointment.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-surface-container-lowest/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Tasreh Print</p>
        </div>
        <div className="mt-2 space-y-2">
          {sortedAppointments.map((appointment) => (
            <div key={`${appointment.id}-tasreh`} className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                {formatVisaDateWithYear(appointment.targetDateIso)}
              </span>
              <button
                type="button"
                aria-pressed={appointment.tasrehPrinted}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-bold leading-none transition ${getTasrehPrintButtonClasses(
                  appointment.tasrehPrinted,
                )}`}
                onClick={() =>
                  onInitiateTasrehAction({
                    groupCode: item.groupCode,
                    appointmentId: appointment.originalAppointmentId,
                    targetDateIso: appointment.targetDateIso,
                    nextTasrehPrinted: !appointment.tasrehPrinted,
                  })
                }
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  {appointment.tasrehPrinted ? "check_circle" : "print"}
                </span>
                <span>{appointment.tasrehPrinted ? "Printed" : "Not Printed"}</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/35 pt-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-800"
          onClick={() => onOpenVisaDetail(item.groupCode)}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            visibility
          </span>
          <span>View Details</span>
        </button>

        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
            isCopied
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-outline-variant/35 dark:bg-surface-container-low dark:text-slate-200 dark:hover:bg-surface-container-high"
          }`}
          onClick={() => onCopyTemplate(item)}
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            {isCopied ? "check" : "content_copy"}
          </span>
          <span>{isCopied ? "Copied" : "Copy WA Text"}</span>
        </button>
      </div>
    </article>
  );
}
