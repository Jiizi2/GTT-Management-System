import type { ChecklistItem, ChecklistDriverAssignment, GroupData } from "../../../shared/app-domain";
import { formatScheduleTime } from "../../../shared/app-domain";
import { resolveGroupServiceType, isExternalTransportGroup, CHECKLIST_NEUTRAL_BADGE_CLASS } from "../hooks/use-checklist-workspace";

export function ChecklistCompletedCard({
  item,
  assignment,
  isTwoDaysAway,
  groupRecord,
  requiredDriverCount,
  copiedItemId,
  onOpenCancelConfirm,
  onCopyDriver,
}: {
  item: ChecklistItem;
  assignment: ChecklistDriverAssignment;
  isTwoDaysAway: boolean;
  groupRecord?: GroupData;
  requiredDriverCount: number;
  copiedItemId: string | null;
  onOpenCancelConfirm: (itemId: string) => void;
  onCopyDriver: (itemId: string) => void;
}) {
  const serviceType = resolveGroupServiceType(groupRecord);
  const isExternalTransport = isExternalTransportGroup(groupRecord);
  
  const assignedDrivers = assignment.drivers.slice(0, requiredDriverCount);
  const assignedDriverNames = assignedDrivers
    .map((driver) => driver.name.trim())
    .filter((name) => name.length > 0);
    
  const scheduledPrimary = item.transferByTrain
    ? `Train ${formatScheduleTime(item.trainDepartureTime)}`
    : item.hotelPickupRequestTime
      ? `Pickup ${formatScheduleTime(item.hotelPickupRequestTime)}`
      : formatScheduleTime(item.scheduledTime || "");
      
  const scheduledSecondary = item.transferByTrain
    ? `Pickup ${formatScheduleTime(item.stationPickupTime)}`
    : item.hotelPickupRequestTime
      ? `Flight ${formatScheduleTime(item.departureFlightTime || item.scheduledTime)}`
      : "";

  const codes = item.groupCodes && item.groupCodes.length > 0 ? item.groupCodes : [item.groupCode];
  const displayCodes = codes.length > 2 ? codes.slice(0, 2) : codes;
  const codesText = displayCodes.join(" - ");
  const codesFontSizeClass = codes.length > 1
    ? "text-[1.35rem] sm:text-[1.5rem] leading-snug"
    : "text-2xl sm:text-3xl leading-none";

  return (
    <article className="checklist-complete-card rounded-2xl px-4 py-3">
      <div className="grid items-center gap-3 lg:grid-cols-[1.35fr_0.9fr_1.3fr_auto_auto]">
        <div className="min-w-0">
          <p className={`truncate font-extrabold tracking-tight text-on-surface ${codesFontSizeClass}`}>
            {codesText}
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-on-surface">{item.groupName}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 truncate text-sm font-semibold text-on-surface-variant">
            <span
              className="material-symbols-outlined text-sm text-on-surface-variant/70"
              aria-hidden="true"
            >
              {item.activityIcon}
            </span>
            <span>{item.activity}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {serviceType === "Visa Only" ? (
              <span className="checklist-reminder-inline inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]">
                Visa Only
              </span>
            ) : null}
            {isTwoDaysAway ? <span className={CHECKLIST_NEUTRAL_BADGE_CLASS}>2 Hari Lagi</span> : null}
          </div>
          {isExternalTransport ? (
            <p className="mt-1 text-[10px] font-semibold text-on-surface-variant">
              Reminder: transport vendor eksternal.
            </p>
          ) : null}
        </div>

        <div className="space-y-0.5">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.11em] text-on-surface-variant/70">
            Scheduled Time
          </span>
          <strong className="block text-xl font-extrabold leading-none text-on-surface sm:text-2xl">
            {scheduledPrimary}
          </strong>
          {scheduledSecondary ? (
            <small className="block text-[10px] text-on-surface-variant">{scheduledSecondary}</small>
          ) : null}
        </div>

        <div className="space-y-0.5">
          <span className="block text-[10px] font-semibold uppercase tracking-[0.11em] text-on-surface-variant/70">
            {requiredDriverCount > 1 ? "Assigned Drivers" : "Assigned Driver"}
          </span>
          <div className="space-y-1">
            {assignedDriverNames.length > 0 ? (
              assignedDriverNames.map((driverName, index) => (
                <div
                  key={`${item.id}-driver-${index}`}
                  className="checklist-complete-driver flex items-center gap-2 rounded-lg px-2 py-1"
                >
                  <span className="checklist-complete-driver-slot inline-flex min-w-[52px] justify-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em]">
                    Supir {index + 1}
                  </span>
                  <strong
                    className="truncate text-sm font-bold leading-tight text-on-surface"
                    title={driverName}
                  >
                    {driverName}
                  </strong>
                </div>
              ))
            ) : (
              <strong className="block truncate text-base font-bold leading-tight text-on-surface-variant">
                -
              </strong>
            )}
            <span className="checklist-complete-verified inline-flex rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.07em]">
              Verified
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            className="checklist-warning-button inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.07em] transition"
            onClick={() => onOpenCancelConfirm(item.id)}
          >
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
              cancel
            </span>
            <span>Cancel</span>
          </button>

          <button
            type="button"
            className="checklist-secondary-button inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.07em] transition"
            onClick={() => onCopyDriver(item.id)}
          >
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
              {copiedItemId === item.id ? "check" : "content_copy"}
            </span>
            <span>{copiedItemId === item.id ? "Copied" : "Copy"}</span>
          </button>
        </div>

        <span className="checklist-complete-status inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-[0.1em]">
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            check_circle
          </span>
          <span>Assigned</span>
        </span>
      </div>
    </article>
  );
}
