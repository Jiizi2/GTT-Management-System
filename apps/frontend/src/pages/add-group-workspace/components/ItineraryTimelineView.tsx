import { formatRouteSummary, formatScheduleDate, formatScheduleTime } from "../../../shared/app-domain";
import type { InputItineraryItem } from "../../../shared/app-domain";

interface ItineraryTimelineViewProps {
  itineraryItems: InputItineraryItem[];
  handleEditItem: (item: InputItineraryItem) => void;
  handleDeleteItem: (itemId: string) => void;
  isGroupReadyForItinerary: boolean;
}

export function ItineraryTimelineView({
  itineraryItems,
  handleEditItem,
  handleDeleteItem,
  isGroupReadyForItinerary,
}: ItineraryTimelineViewProps) {
  if (itineraryItems.length === 0) {
    return null;
  }

  const activityTypeIconClassMap: Record<string, string> = {
    arrival: "bg-primary-fixed/75 text-primary",
    transfer: "bg-secondary/18 text-secondary",
    "city-tour": "bg-tertiary-fixed/18 text-on-tertiary-fixed-variant",
    departure: "bg-error-container/18 text-on-error-container",
  };

  const activityTypeAccentLineClassMap: Record<string, string> = {
    arrival: "bg-primary/80",
    transfer: "bg-secondary/80",
    "city-tour": "bg-tertiary-fixed/90",
    departure: "bg-error-container/90",
  };

  const itineraryTagClassMap: Record<string, string> = {
    arrival: "border-primary/35 bg-primary-fixed/12 text-primary",
    transfer: "border-secondary/35 bg-secondary/12 text-secondary",
    "city-tour": "border-tertiary-fixed/45 bg-tertiary-fixed/12 text-on-tertiary-fixed-variant",
    departure: "border-error-container/45 bg-error-container/12 text-on-error-container",
  };

  const neutralItinerarySectionClass = "border-outline-variant/45 bg-surface-container-high/70";
  const itineraryCardClassMap: Record<string, string> = {
    arrival: neutralItinerarySectionClass,
    transfer: neutralItinerarySectionClass,
    "city-tour": neutralItinerarySectionClass,
    departure: neutralItinerarySectionClass,
  };

  return (
    <div className="space-y-3">
      {itineraryItems.map((item, index) => {
        const displayDate = formatScheduleDate(item.date);
        const routeSummary = formatRouteSummary(item.categoryKey, item.from, item.to, item.cityTourCity);
        const fallbackMetaLine = `${
          item.transferByTrain
            ? `Train ${formatScheduleTime(item.trainDepartureTime || item.time)} | Station Pickup ${formatScheduleTime(item.destinationPickupTime)}`
            : formatScheduleTime(item.time)
        }${item.flightNumber ? ` | Flight ${item.flightNumber}` : ""}${
          item.hotelPickupRequestTime
            ? ` | Hotel Pickup Request ${formatScheduleTime(item.hotelPickupRequestTime)}`
            : ""
        }${item.requiresBus ? " | Requires Bus" : ""}`;

        return (
          <div key={item.id} className="grid grid-cols-[44px_1fr] gap-3">
            <div className="flex flex-col items-center pt-0.5">
              <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${
                  activityTypeIconClassMap[item.categoryKey] ?? "bg-primary-fixed text-primary"
                }`}
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-base">{item.icon}</span>
              </span>
              {index < itineraryItems.length - 1 ? (
                <span className="mt-2 h-full min-h-[54px] w-px bg-outline-variant/35" aria-hidden="true" />
              ) : null}
            </div>

            <article
              className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm ${
                itineraryCardClassMap[item.categoryKey] ??
                "border-outline-variant/45 bg-surface-container-lowest"
              }`}
            >
              <span
                className={`absolute inset-x-0 top-0 h-0.5 ${
                  activityTypeAccentLineClassMap[item.categoryKey] ?? "bg-primary/80"
                }`}
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-bold tracking-tight text-on-surface sm:text-2xl">
                    {displayDate.date} {displayDate.year}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${
                        itineraryTagClassMap[item.categoryKey] ??
                        "border-outline-variant/45 bg-surface-container-high text-on-surface"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                        {item.icon}
                      </span>
                      {item.category}
                    </span>
                    <p className="text-sm font-semibold text-on-surface">{routeSummary}</p>
                  </div>
                  <p className="mt-2 text-sm italic text-on-surface-variant">
                    {item.notes || fallbackMetaLine}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-primary-fixed hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={`Edit ${item.category} itinerary`}
                    onClick={() => handleEditItem(item)}
                    disabled={!isGroupReadyForItinerary}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      edit
                    </span>
                  </button>

                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-error-container/75 hover:text-on-error-container disabled:cursor-not-allowed disabled:opacity-45"
                    aria-label={`Delete ${item.category} itinerary`}
                    onClick={() => handleDeleteItem(item.id)}
                    disabled={!isGroupReadyForItinerary}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            </article>
          </div>
        );
      })}
    </div>
  );
}
