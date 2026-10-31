import type { ReactNode } from "react";
import { formatScheduleTime, getChecklistDayLabel } from "../../../shared/app-domain";
import type { ChecklistItemsGroup } from "../hooks/use-checklist-workspace";

export function ChecklistGroupSection({
  group,
  expandForSearch,
  children,
}: {
  group: ChecklistItemsGroup;
  expandForSearch: boolean;
  children: ReactNode;
}) {
  const firstTrip = group.items[0];
  const codes = Array.from(new Set(group.items.flatMap((item) => item.groupCodes ?? [item.groupCode])));

  return (
    <details className="group/checklist border-b border-outline-variant/40 pb-4" open={expandForSearch || undefined}>
      <summary className="serene-focus-ring grid min-h-16 cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-surface-container-high [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h3 className="break-words text-base font-bold text-on-surface">{codes.join(" · ")}</h3>
          <p className="mt-1 break-words text-sm text-on-surface-variant">{group.groupName}</p>
          <p className="mt-1 text-xs text-on-surface-variant">{firstTrip.agentName || "GTT Direct"}</p>
        </div>
        <div className="text-sm text-on-surface-variant">
          <p className="font-semibold text-on-surface">
            {group.items.length} {group.items.length === 1 ? "trip" : "trips"}
          </p>
          <p className="mt-1">
            {getChecklistDayLabel(firstTrip.tripDate)} · {formatScheduleTime(firstTrip.scheduledTime)}
          </p>
        </div>
        <span
          className="material-symbols-outlined text-on-surface-variant transition-transform group-open/checklist:rotate-180"
          aria-hidden="true"
        >
          expand_more
        </span>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}
