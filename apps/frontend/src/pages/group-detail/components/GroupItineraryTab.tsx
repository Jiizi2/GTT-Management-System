import type { ReactNode } from "react";
import type { ItineraryItem } from "../../../shared/app-domain";
import { getScheduleTypeOption, inferCategoryKey, resolveItineraryIcon } from "../../../shared/app-domain";
import { useGroupDetailContext } from "../context/GroupDetailContext";
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

export function GroupItineraryTab() {
  const {
    group,
    groups,
    itineraryItems,
    handleOpenEditModal,
    handleOpenDeleteModal,
    handleOpenScheduleModal,
    readOnly,
  } = useGroupDetailContext();

  const canEditItinerary = !readOnly && !group.parentGroupId;

  return (
    <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-on-surface sm:text-2xl">Full Itinerary</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            <span className="sm:hidden">Timeline and key milestones.</span>
            <span className="hidden sm:inline">Journey timeline and key milestones</span>
          </p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg px-1 text-sm font-bold leading-none text-brand-primary transition hover:text-brand-primary/80"
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            expand_more
          </span>
          <span className="sm:hidden">All Days</span>
          <span className="hidden sm:inline">View All Days</span>
        </button>
      </div>

      {group.parentGroupId && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800 shadow-xs">
          <span className="material-symbols-outlined text-base text-sky-700" aria-hidden="true">
            info
          </span>
          <div>
            <strong>Data Itinerary Terhubung</strong>
            <p className="mt-0.5 text-[11px] font-medium text-sky-600">
              Grup ini mewarisi itinerary bersama dari Group Utama (
              {
                groups.find(
                  (candidateGroup) =>
                    candidateGroup.id === group.parentGroupId || candidateGroup.code === group.parentGroupId,
                )?.code
              }
              ). Edit itinerary di halaman Group Utama tersebut.
            </p>
          </div>
        </div>
      )}

      <ol className="mt-5">
        {itineraryItems.map((item, index) => {
          const categoryKey = inferCategoryKey(item);
          const typeOption = getScheduleTypeOption(categoryKey);
          const activityHeading = formatItineraryActivityHeading(item, categoryKey, typeOption.cardLabel);
          const itinerarySummary = buildItinerarySummary(item, categoryKey);
          const itineraryFacts = buildItineraryFacts(item, categoryKey);
          const itineraryIcon = resolveItineraryIcon(item);

          return (
            <li
              key={`${group.code}-${index}-${item.date}`}
              className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0 md:grid-cols-[78px_minmax(0,1fr)] md:gap-x-4"
            >
              <div className="relative flex flex-col items-center">
                <time className="text-center" dateTime={item.isoDate || undefined}>
                  <strong className="block text-sm font-bold leading-tight text-brand-primary md:text-base">
                    {item.date}
                  </strong>
                  <span className="mt-0.5 block text-[10px] font-medium text-on-surface-variant/70 md:text-[11px]">
                    {item.year}
                  </span>
                </time>
                {index < itineraryItems.length - 1 ? (
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

                  {canEditItinerary ? (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant/80 transition hover:bg-brand-primary/10 hover:text-brand-primary xl:h-8 xl:w-8"
                        aria-label={`Edit ${item.title}`}
                        onClick={() => handleOpenEditModal(index)}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          edit
                        </span>
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant/80 transition hover:bg-brand-tertiary/12 hover:text-brand-tertiary xl:h-8 xl:w-8"
                        aria-label={`Delete ${item.title}`}
                        onClick={() => handleOpenDeleteModal(index)}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          delete
                        </span>
                      </button>
                    </div>
                  ) : null}
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
                        <dt className="text-[9px] font-bold uppercase leading-tight tracking-[0.08em] text-on-surface-variant/65">
                          {fact.label}
                        </dt>
                        <dd
                          className={`mt-0.5 break-words text-sm font-semibold leading-snug ${
                            fact.value === "Not set" ? "text-on-surface-variant/60" : "text-on-surface"
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

      {canEditItinerary && (
        <div className="mt-4">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-primary/35 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10 md:text-base"
            onClick={handleOpenScheduleModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              add_circle
            </span>
            <span>Add Schedule</span>
          </button>
        </div>
      )}
    </section>
  );
}
