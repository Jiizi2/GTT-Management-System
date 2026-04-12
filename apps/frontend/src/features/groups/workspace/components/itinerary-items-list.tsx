import type { InputItineraryItem } from "../../../../shared/app-domain.js";
import { formatRouteSummary, formatScheduleDate, formatScheduleTime } from "../../domain.js";

const itineraryTagClassMap: Record<string, string> = {
  arrival: "border-emerald-200 bg-emerald-50 text-emerald-700",
  transfer: "border-slate-200 bg-slate-50 text-slate-700",
  "city-tour": "border-amber-200 bg-amber-50 text-amber-700",
  departure: "border-rose-200 bg-rose-50 text-rose-700",
};

const itineraryCardClassMap: Record<string, string> = {
  arrival: "border-emerald-200 bg-emerald-50/60",
  transfer: "border-slate-200 bg-slate-50/70",
  "city-tour": "border-amber-200 bg-amber-50/60",
  departure: "border-rose-200 bg-rose-50/60",
};

export function ItineraryItemsList({
  itineraryItems,
  isGroupReadyForItinerary,
  onEditItem,
  onDeleteItem,
}: {
  itineraryItems: InputItineraryItem[];
  isGroupReadyForItinerary: boolean;
  onEditItem: (item: InputItineraryItem) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  return itineraryItems.map((item, index) => {
    const displayDate = formatScheduleDate(item.date);
    const routeSummary = formatRouteSummary(
      item.categoryKey,
      item.from,
      item.to,
      item.cityTourCity,
    );
    const fallbackMetaLine = `${item.transferByTrain
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-brand-neutral"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined text-base">{item.icon}</span>
          </span>
          {index < itineraryItems.length - 1 ? (
            <span className="mt-2 h-full min-h-[54px] w-px bg-slate-200" aria-hidden="true" />
          ) : null}
        </div>

        <article
          className={`rounded-2xl border p-4 shadow-sm ${
            itineraryCardClassMap[item.categoryKey] ?? "border-slate-200 bg-surface-container-lowest"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                {displayDate.date} {displayDate.year}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${
                    itineraryTagClassMap[item.categoryKey] ??
                    "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.category}
                </span>
                <p className="text-sm font-semibold text-slate-700">{routeSummary}</p>
              </div>
              <p className="mt-2 text-sm italic text-slate-600">{item.notes || fallbackMetaLine}</p>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-brand-primary/10 hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={`Edit ${item.category} itinerary`}
                onClick={() => onEditItem(item)}
                disabled={!isGroupReadyForItinerary}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  edit
                </span>
              </button>

              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-brand-tertiary/12 hover:text-brand-tertiary disabled:cursor-not-allowed disabled:opacity-45"
                aria-label={`Delete ${item.category} itinerary`}
                onClick={() => onDeleteItem(item.id)}
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
  });
}
