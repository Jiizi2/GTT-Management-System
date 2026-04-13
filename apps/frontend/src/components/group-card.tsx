import * as Domain from "../shared/app-domain";
import type { GroupData } from "../shared/app-domain";

const {
  inferCategoryKey,
  getItineraryIsoDate,
  getScheduleTypeOption,
  formatScheduleTime,
  parseDisplayDateToIso,
  parseTimeForInput,
  resolveTotalBusCount,
} = Domain;

type GroupItineraryItem = GroupData["itinerary"][number];
type ItineraryPreviewState = "past" | "next" | "upcoming";
type ItineraryPreviewItem = {
  id: string;
  label: string;
  state: ItineraryPreviewState;
};
type ItineraryScheduledItem = {
  item: GroupItineraryItem;
  label: string;
  timeMs: number | null;
};

function sortItineraryBySchedule(itinerary: GroupData["itinerary"]): GroupData["itinerary"] {
  return [...itinerary].sort((left, right) => {
    const leftDate = getItineraryIsoDate(left) || "9999-12-31";
    const rightDate = getItineraryIsoDate(right) || "9999-12-31";
    const leftFallbackTime = parseTimeForInput(left.meta.split("|")[0] ?? "");
    const rightFallbackTime = parseTimeForInput(right.meta.split("|")[0] ?? "");
    const leftTime = left.time?.trim() || leftFallbackTime || "00:00";
    const rightTime = right.time?.trim() || rightFallbackTime || "00:00";
    const leftKey = `${leftDate}T${leftTime}`;
    const rightKey = `${rightDate}T${rightTime}`;
    return leftKey.localeCompare(rightKey);
  });
}

function toShortLabel(value: string, maxLength = 26): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const clipped = trimmed.slice(0, Math.max(0, maxLength - 3)).trimEnd();
  return `${clipped}...`;
}

function buildCompactTripLabel(item: GroupData["itinerary"][number]): string {
  const categoryKey = inferCategoryKey(item);
  const typeLabel = getScheduleTypeOption(categoryKey).cardLabel;
  const origin = item.from?.trim() ?? "";
  const destination = item.to?.trim() ?? "";
  const cityTourCity = item.cityTourCity?.trim() ?? "";

  if (categoryKey === "arrival") {
    if (origin && destination) {
      return toShortLabel(`${typeLabel} ${origin} -> ${destination}`);
    }

    if (destination) {
      return toShortLabel(`${typeLabel} ${destination}`);
    }

    if (origin) {
      return toShortLabel(`${typeLabel} ${origin}`);
    }
  }

  if (categoryKey === "city-tour" && cityTourCity) {
    return toShortLabel(`${typeLabel} ${cityTourCity}`);
  }

  if (destination) {
    return toShortLabel(`${typeLabel} ${destination}`);
  }

  return toShortLabel(typeLabel);
}

function resolveItineraryTimestampMs(item: GroupItineraryItem): number | null {
  const itineraryIsoDate = (getItineraryIsoDate(item) || parseDisplayDateToIso(item.date, item.year)).trim();
  if (!itineraryIsoDate) {
    return null;
  }

  const fallbackMetaTime = parseTimeForInput(item.meta.split("|")[0] ?? "");
  const rawTime = item.time?.trim() || fallbackMetaTime || "00:00";
  const normalizedTime = formatScheduleTime(rawTime);
  const timePart = /^\d{2}:\d{2}$/.test(normalizedTime) ? `${normalizedTime}:00` : "00:00:00";
  const parsedDateTime = Date.parse(`${itineraryIsoDate}T${timePart}`);
  if (Number.isFinite(parsedDateTime)) {
    return parsedDateTime;
  }

  const parsedDateOnly = Date.parse(`${itineraryIsoDate}T00:00:00`);
  if (Number.isFinite(parsedDateOnly)) {
    return parsedDateOnly;
  }

  return null;
}

function resolveNextItineraryIndex(group: GroupData, scheduledItems: ItineraryScheduledItem[]): number {
  const nowMs = Date.now();
  const nextByTimeIndex = scheduledItems.findIndex((entry) => entry.timeMs !== null && entry.timeMs >= nowMs);
  if (nextByTimeIndex >= 0) {
    return nextByTimeIndex;
  }

  const hasUnknownSchedule = scheduledItems.some((entry) => entry.timeMs === null);
  if (!hasUnknownSchedule) {
    return -1;
  }

  const normalizedNextActivityTitle = group.nextActivity.title.trim().toLowerCase();
  const titleMatchedIndex = scheduledItems.findIndex((entry) => {
    const normalizedTitle = entry.item.title.trim().toLowerCase();
    return (
      normalizedTitle === normalizedNextActivityTitle ||
      normalizedTitle.includes(normalizedNextActivityTitle) ||
      normalizedNextActivityTitle.includes(normalizedTitle)
    );
  });
  if (titleMatchedIndex >= 0) {
    return titleMatchedIndex;
  }

  const highlightedIndex = scheduledItems.findIndex((entry) => entry.item.highlighted);
  if (highlightedIndex >= 0) {
    return highlightedIndex;
  }

  return 0;
}

function buildItineraryPreview(group: GroupData): ItineraryPreviewItem[] {
  const sortedItinerary = sortItineraryBySchedule(group.itinerary);
  const scheduledItems = sortedItinerary.map<ItineraryScheduledItem>((item) => ({
    item,
    label: buildCompactTripLabel(item),
    timeMs: resolveItineraryTimestampMs(item),
  }));

  if (scheduledItems.length === 0) {
    return [
      {
        id: `${group.code}-empty-itinerary`,
        label: group.nextActivity.title.trim() || "No activity",
        state: "next",
      },
    ];
  }

  const nextIndex = resolveNextItineraryIndex(group, scheduledItems);
  let startIndex = nextIndex >= 0 ? Math.max(0, nextIndex - 1) : Math.max(0, scheduledItems.length - 3);
  if (startIndex + 3 > scheduledItems.length) {
    startIndex = Math.max(0, scheduledItems.length - 3);
  }

  return scheduledItems.slice(startIndex, startIndex + 3).map((entry, offset) => {
    const absoluteIndex = startIndex + offset;
    let state: ItineraryPreviewState = "upcoming";
    if (nextIndex < 0 || absoluteIndex < nextIndex) {
      state = "past";
    } else if (absoluteIndex === nextIndex) {
      state = "next";
    }

    return {
      id: `${group.code}-${absoluteIndex}-${entry.item.title}`,
      label: entry.label,
      state,
    };
  });
}

function getItineraryPreviewRowClasses(state: ItineraryPreviewState): string {
  if (state === "next") {
    return "rounded-lg bg-surface-container-high px-2.5 py-1.5";
  }

  return "px-2.5 py-1.5";
}

function getItineraryPreviewTextClasses(state: ItineraryPreviewState): string {
  if (state === "past") {
    return "text-on-surface-variant/45";
  }

  if (state === "next") {
    return "font-semibold text-on-surface";
  }

  return "text-on-surface-variant";
}

function getItineraryPreviewDotClasses(state: ItineraryPreviewState): string {
  if (state === "next") {
    return "bg-primary shadow-sm";
  }

  if (state === "past") {
    return "bg-outline-variant/70";
  }

  return "bg-primary/55";
}

function getStatusBadgeClasses(tone: GroupData["tone"]): string {
  if (tone === "active") {
    return "bg-primary-fixed/70 text-on-primary-fixed-variant";
  }

  return "bg-surface-container-high text-on-surface-variant";
}

function getStatusLabel(tone: GroupData["tone"]): string {
  return tone === "active" ? "Active" : "Inactive";
}

function getServiceTypeBadgeLabel(group: GroupData): string {
  if (group.visaSetup?.busStatus === "Visa+") {
    return "Visa+";
  }

  return "Visa Only";
}

function hasBusService(group: GroupData): boolean {
  return group.visaSetup?.busStatus === "Visa+";
}

function getRequiredBusBadgeLabel(group: GroupData): string | null {
  if (!hasBusService(group)) {
    return null;
  }

  return `${resolveTotalBusCount(group.pax, group.totalBuses)} bus`;
}

export function GroupCard({ group, onOpenDetail }: { group: GroupData; onOpenDetail: (groupCode: string) => void }) {
  const itineraryPreview = buildItineraryPreview(group);
  const busBadgeLabel = getRequiredBusBadgeLabel(group);
  const metadataBadges = [
    `${group.pax} Pax`,
    ...(busBadgeLabel ? [busBadgeLabel] : []),
    group.packageName,
    getServiceTypeBadgeLabel(group),
  ];

  return (
    <article className="serene-card flex h-full w-full flex-col px-5 py-6">
      <div className="mx-1 mb-7 py-1">
        <div className="flex flex-wrap items-start gap-x-2 gap-y-2">
          <span className="min-w-0 font-display text-2xl font-extrabold tracking-tighter text-primary sm:text-3xl xl:text-4xl">
            {group.code}
          </span>
          <span
            className={`ml-auto inline-flex shrink-0 whitespace-nowrap rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${getStatusBadgeClasses(
              group.tone,
            )}`}
          >
            {getStatusLabel(group.tone)}
          </span>
        </div>
        <h2 className="font-display text-lg font-bold text-on-surface-variant">{group.name}</h2>
      </div>

      <div className="mx-1 mb-7 flex min-h-[3.5rem] flex-wrap content-start gap-2 py-1">
        {metadataBadges.map((label, index) => (
          <span
            key={`${group.code}-${index}-${label}`}
            className={`inline-flex max-w-full items-center rounded-lg px-2.5 py-1 text-[11px] font-bold leading-none ${getStatusBadgeClasses(
              group.tone,
            )}`}
            title={label}
          >
            <span className="truncate">{label}</span>
          </span>
        ))}
      </div>

      <section className="mx-1 mb-8 pt-1" aria-label="Itinerary preview">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/80">Itinerary Preview</p>
          <span className="text-[10px] font-medium text-on-surface-variant/55">{itineraryPreview.length} stops</span>
        </div>

        <ul className="space-y-2.5">
          {itineraryPreview.map((previewItem, index) => (
            <li key={previewItem.id} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-3">
              <div className="relative flex justify-center">
                {index < itineraryPreview.length - 1 ? (
                  <span
                    className="absolute left-1/2 top-3 h-[calc(100%+0.625rem)] w-px -translate-x-1/2 bg-outline-variant/25"
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={`relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full ${getItineraryPreviewDotClasses(
                    previewItem.state,
                  )}`}
                  aria-hidden="true"
                />
              </div>
              <div className={getItineraryPreviewRowClasses(previewItem.state)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <p
                    className={`min-w-0 truncate pb-0.5 text-sm font-medium leading-snug ${getItineraryPreviewTextClasses(
                      previewItem.state,
                    )}`}
                  >
                    {previewItem.label}
                  </p>

                  {previewItem.state === "next" ? (
                    <span className="justify-self-end rounded-lg bg-primary/16 px-2 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.08em] text-primary">
                      Next
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mx-1 mt-auto">
        <button
          type="button"
          className="serene-btn-secondary w-full py-3.5 text-sm font-bold"
          onClick={() => onOpenDetail(group.code)}
        >
          View Detail
        </button>
      </div>
    </article>
  );
}
