import type { ChecklistItem, ChecklistDriverDraft, ChecklistDriverProfile, GroupData } from "../../../shared/app-domain";
import { getChecklistDayLabel, formatScheduleTime } from "../../../shared/app-domain";
import { resolveGroupServiceType, isExternalTransportGroup, CHECKLIST_NEUTRAL_BADGE_CLASS } from "../hooks/use-checklist-workspace";
import { useMuassasahQuery } from "../../../hooks/use-directory-backend";
import { SereneSelect } from "../../../components/serene-select";

export function ChecklistNeedAttentionCard({
  item,
  draft,
  assignedDrivers,
  requiredDriverCount,
  isTwoDaysAway,
  groupRecord,
  copiedItemId,
  isConfirmDisabled,
  onCopyTripWithoutDriverName,
  onDraftChange,
  onConfirmDriver,
}: {
  item: ChecklistItem;
  draft: ChecklistDriverDraft;
  assignedDrivers: ChecklistDriverProfile[];
  requiredDriverCount: number;
  isTwoDaysAway: boolean;
  groupRecord?: GroupData;
  copiedItemId: string | null;
  isConfirmDisabled: boolean;
  onCopyTripWithoutDriverName: (itemId: string) => void;
  onDraftChange: (itemId: string, field: keyof ChecklistDriverProfile, value: string) => void;
  onConfirmDriver: (itemId: string) => void;
}) {
  const assignedProgressCount = assignedDrivers.length;
  const isComplete = assignedProgressCount >= requiredDriverCount;
  const isMultiDriver = requiredDriverCount > 1;
  const muassasahOptions = useMuassasahQuery().data ?? [];
  
  const serviceType = resolveGroupServiceType(groupRecord);
  const isExternalTransport = isExternalTransportGroup(groupRecord);
  
  const timeCopy = item.transferByTrain
    ? `Train ${formatScheduleTime(item.trainDepartureTime)}`
    : item.hotelPickupRequestTime
      ? `Pickup ${formatScheduleTime(item.hotelPickupRequestTime)}`
      : formatScheduleTime(item.scheduledTime || "");

  const codes = item.groupCodes && item.groupCodes.length > 0 ? item.groupCodes : [item.groupCode];
  const displayCodes = codes.length > 2 ? codes.slice(0, 2) : codes;
  const codesText = displayCodes.join(" - ");
  const codesFontSizeClass =
    codes.length > 1 ? "text-xl leading-snug sm:text-[1.35rem]" : "text-2xl leading-none sm:text-[2rem]";

  return (
    <article
      className="overflow-hidden rounded-3xl border-[0.5px] border-black/20 bg-surface-container-lowest shadow-sm"
    >
      <div className="grid gap-0 lg:grid-cols-[0.78fr_1.22fr]">
        <div className="border-b border-dashed border-black/45 bg-surface-container-lowest p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-900">Group No</p>
              <p className={`mt-2 font-extrabold tracking-tight text-slate-900 ${codesFontSizeClass}`}>
                {codesText}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex items-center rounded-lg bg-surface-container-lowest/90 p-1.5 text-slate-900 transition hover:bg-surface-container-lowest"
              onClick={() => onCopyTripWithoutDriverName(item.id)}
              title={copiedItemId === item.id ? "Copied" : "Copy details"}
              aria-label={copiedItemId === item.id ? "Copied" : "Copy trip details"}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                {copiedItemId === item.id ? "check" : "content_copy"}
              </span>
            </button>
          </div>

          <div className="mt-5 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Activity</p>
            <h4 className="text-lg font-bold leading-snug text-slate-900">{item.activity}</h4>
            <p className="truncate text-sm font-semibold text-slate-900">{item.groupName}</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className={CHECKLIST_NEUTRAL_BADGE_CLASS}>{serviceType}</span>
              {isTwoDaysAway ? <span className={CHECKLIST_NEUTRAL_BADGE_CLASS}>2 Hari Lagi</span> : null}
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Date</p>
              <strong className="mt-1 block text-sm font-extrabold text-slate-900 sm:text-base">
                {getChecklistDayLabel(item.tripDate)}
              </strong>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Time</p>
              <strong className="mt-1 block text-sm font-extrabold text-slate-900 sm:text-base">{timeCopy}</strong>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Total Pax</p>
              <strong className="mt-1 block text-sm font-extrabold text-slate-900 sm:text-base">{item.groupPax} Pax</strong>
            </div>
          </div>
        </div>

        <div className="checklist-need-attention-body space-y-4 p-4 sm:p-5">
          {isExternalTransport ? (
            <div className="checklist-need-attention-warning flex items-start gap-2 rounded-xl px-3 py-2 text-xs">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                warning
              </span>
              <p className="font-semibold">
                Visa Only: transport di-handle vendor eksternal. Pastikan koordinasi vendor luar sebelum konfirmasi
                assignment.
              </p>
            </div>
          ) : null}
          <div className="serene-form-actions-split">
            <span className="checklist-need-panel-title text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant/90">
              Assign Transport (Driver {assignedProgressCount}/{requiredDriverCount})
            </span>

            {isMultiDriver ? (
              <span className="checklist-need-attention-required inline-flex rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em]">
                {requiredDriverCount} Buses Required
              </span>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1.5">
              <span className="checklist-need-panel-label text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">
                Driver Name
              </span>
              <input
                type="text"
                className="serene-input h-auto rounded-xl px-3 py-2.5 text-sm font-medium"
                value={draft.name}
                onChange={(event) => onDraftChange(item.id, "name", event.target.value)}
                placeholder="Enter name..."
              />
            </label>

            <label className="space-y-1.5">
              <span className="checklist-need-panel-label text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">
                Phone
              </span>
              <input
                type="tel"
                className="serene-input h-auto rounded-xl px-3 py-2.5 text-sm font-medium"
                value={draft.phone}
                onChange={(event) => onDraftChange(item.id, "phone", event.target.value)}
                placeholder="+966..."
              />
            </label>

            <label className="space-y-1.5">
              <span className="checklist-need-panel-label text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">
                Plate
              </span>
              <input
                type="text"
                className="serene-input h-auto rounded-xl px-3 py-2.5 text-sm font-medium"
                value={draft.plateNumber}
                onChange={(event) => onDraftChange(item.id, "plateNumber", event.target.value)}
                placeholder="ABC-123"
              />
            </label>

            <label className="space-y-1.5">
              <span className="checklist-need-panel-label text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">
                Muassasah
              </span>
              <SereneSelect
                className="serene-select"
                value={draft.muassasahId ?? ""}
                onChange={(event) => onDraftChange(item.id, "muassasahId", event.target.value)}
                aria-label="Muassasah supir"
              >
                <option value="">Tanpa muassasah</option>
                {muassasahOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </SereneSelect>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.12em] text-on-primary transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-45"
              onClick={() => onConfirmDriver(item.id)}
              disabled={isConfirmDisabled}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                check_circle
              </span>
              <span>
                {isMultiDriver
                  ? `Confirm Driver ${assignedProgressCount + 1}/${requiredDriverCount}`
                  : "Confirm Assignment"}
              </span>
            </button>

            <div
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold leading-none ${
                isComplete ? "checklist-need-attention-status-complete" : "checklist-need-attention-status-pending"
              }`}
              role="status"
              aria-live="polite"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                {isComplete ? "check_circle" : "pending_actions"}
              </span>
              <span>{isComplete ? "Complete" : "Not Complete"}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
