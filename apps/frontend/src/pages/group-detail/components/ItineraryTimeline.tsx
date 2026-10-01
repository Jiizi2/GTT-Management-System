import type { ReactNode } from "react";
import type { ItineraryItem } from "../../../shared/app-domain";
import { getScheduleTypeOption, inferCategoryKey, resolveItineraryIcon } from "../../../shared/app-domain";
import { buildItineraryFacts, buildItinerarySummary } from "./group-itinerary-display";

function TimelineGlyph({ name }: { name: string }) {
  let glyph: ReactNode;

  switch (name) {
    case "flight":
    case "flight_land":
    case "flight_takeoff":
      glyph = (
        <path d="m17.8 19.2-1.8-8.2 3.5-3.5a2.1 2.1 0 0 0-3-3L13 8l-8.2-1.8a.5.5 0 0 0-.6.6L6 15l-3.3 3.4a2.1 2.1 0 0 0 3 3L9 18l8.2 1.8a.5.5 0 0 0 .6-.6Z" />
      );
      break;
    case "directions_bus":
    case "airport_shuttle":
      glyph = (
        <>
          <rect x="4" y="3" width="16" height="17" rx="3" />
          <path d="M4 11h16M8 3v8m8-8v8M7 15h.01M17 15h.01M7 20v2m10-2v2" />
        </>
      );
      break;
    case "train":
      glyph = (
        <>
          <rect x="5" y="2.5" width="14" height="17" rx="5" />
          <path d="M8 7h8M8 11h8M8 15h.01M16 15h.01M8 19l-2.5 2.5M16 19l2.5 2.5" />
        </>
      );
      break;
    case "tour":
      glyph = (
        <>
          <path d="M19 10.2c0 5-7 10.8-7 10.8S5 15.2 5 10.2a7 7 0 1 1 14 0Z" />
          <circle cx="12" cy="10" r="2.2" />
        </>
      );
      break;
    case "block":
      glyph = (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m5.6 5.6 12.8 12.8" />
        </>
      );
      break;
    default:
      glyph = (
        <>
          <circle cx="5" cy="6" r="2" />
          <circle cx="19" cy="18" r="2" />
          <path d="M7 6h5a4 4 0 0 1 4 4v4a4 4 0 0 0 4 4" />
        </>
      );
  }

  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph}
    </svg>
  );
}

function formatItineraryActivityHeading(item: ItineraryItem, categoryKey: string, fallbackLabel: string): string {
  if (categoryKey !== "transfer") {
    return fallbackLabel;
  }

  const normalizedCategory = item.category.toLowerCase();
  if (normalizedCategory.includes("train departure")) {
    return "Transfer (Train Departure)";
  }
  if (normalizedCategory.includes("train arrival")) {
    return "Transfer (Train Arrival)";
  }
  if (normalizedCategory.includes("station pickup")) {
    return "Transfer (Station Pickup)";
  }

  return fallbackLabel;
}

export function ItineraryTimeline({
  items,
  renderActions,
}: {
  items: ItineraryItem[];
  renderActions?: (item: ItineraryItem, index: number) => ReactNode;
}) {
  return (
    <ol className="mt-5">
      {items.map((item, index) => {
        const categoryKey = inferCategoryKey(item);
        const typeOption = getScheduleTypeOption(categoryKey);
        const activityHeading = formatItineraryActivityHeading(item, categoryKey, typeOption.cardLabel);
        const itinerarySummary = buildItinerarySummary(item, categoryKey);
        const itineraryFacts = buildItineraryFacts(item, categoryKey);
        const itineraryIcon = resolveItineraryIcon(item);

        return (
          <li
            key={`${item.isoDate || item.date}-${index}`}
            className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0 md:grid-cols-[78px_minmax(0,1fr)] md:gap-x-4"
          >
            <div className="relative flex flex-col items-center">
              <time className="text-center" dateTime={item.isoDate || undefined}>
                <strong className="block text-sm font-bold leading-tight text-brand-primary md:text-base">
                  {item.date}
                </strong>
                <span className="mt-0.5 block text-[10px] font-medium text-on-surface-variant md:text-[11px]">
                  {item.year}
                </span>
              </time>
              {index < items.length - 1 ? (
                <span
                  className="absolute bottom-[-1.25rem] left-1/2 top-[3.75rem] w-px -translate-x-1/2 bg-outline-variant/55"
                  aria-hidden="true"
                />
              ) : null}
              <span className="relative z-10 mt-2 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/15 bg-primary-fixed text-primary shadow-sm shadow-primary/10">
                <TimelineGlyph name={itineraryIcon} />
              </span>
            </div>

            <article
              className={`min-w-0 rounded-2xl border bg-surface-container-lowest px-4 py-3.5 ${
                item.highlighted ? "border-brand-primary/45 shadow-sm" : "border-outline-variant/45"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="text-lg font-semibold leading-tight text-on-surface md:text-[1.18rem]">
                    {activityHeading}
                  </h4>
                  <p className="mt-1 text-sm font-medium text-on-surface-variant">{itinerarySummary}</p>
                </div>

                {renderActions?.(item, index)}
              </div>

              <dl className="mt-3 grid gap-x-5 gap-y-3 border-t border-outline-variant/35 pt-3 sm:grid-cols-2 xl:grid-cols-3">
                {itineraryFacts.map((fact) => (
                  <div key={`${fact.label}-${fact.value}`} className="flex min-w-0 items-start gap-2">
                    <span
                      className="material-symbols-outlined mt-0.5 shrink-0 text-[17px] text-brand-primary"
                      aria-hidden="true"
                    >
                      {fact.icon}
                    </span>
                    <div className="min-w-0">
                      <dt className="text-[9px] font-bold uppercase leading-tight tracking-[0.08em] text-on-surface-variant">
                        {fact.label}
                      </dt>
                      <dd
                        className={`mt-0.5 break-words text-sm font-semibold leading-snug ${
                          fact.value === "Not set" ? "text-on-surface-variant" : "text-on-surface"
                        }`}
                      >
                        {fact.value}
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>

              {item.notes?.trim() ? (
                <p className="mt-3 border-t border-outline-variant/25 pt-2.5 text-xs leading-relaxed text-on-surface-variant">
                  {item.notes.trim()}
                </p>
              ) : null}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
