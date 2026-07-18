import { Link } from "react-router-dom";
import { useGroupDetailContext } from "../context/GroupDetailContext";
import { inferCategoryKey, getScheduleTypeOption } from "../../../shared/app-domain";

// Replicate the formatting helpers from original file if they are local helpers
function formatItineraryMetaForDisplay(meta: string): string {
  const segments = meta
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return "";
  }

  const [firstSegment, ...restSegments] = segments;
  // Replicate formatScheduleTime inline or import
  const formatScheduleTimeLocal = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return "";
    if (
      trimmed.toLowerCase().includes("wib") ||
      trimmed.toLowerCase().includes("wita") ||
      trimmed.toLowerCase().includes("wit")
    ) {
      return trimmed;
    }
    const cleanTime = trimmed.replace(/[^0-9:]/g, "");
    if (/^\d{2}:\d{2}$/.test(cleanTime)) {
      return `${cleanTime} LT`;
    }
    return trimmed;
  };
  const normalizedFirstSegment = formatScheduleTimeLocal(firstSegment);
  return [normalizedFirstSegment, ...restSegments].join(" | ");
}

function formatItineraryActivityHeading(item: any, categoryKey: string, fallbackLabel: string): string {
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

function formatItineraryCompactSummary(item: any, categoryKey: string): string {
  const metaDisplay = formatItineraryMetaForDisplay(item.meta);
  if (categoryKey === "transfer") {
    return `${item.from} ke ${item.to} | ${metaDisplay}`;
  }

  if (categoryKey === "flight") {
    return `${item.from} ke ${item.to} dengan ${item.flightNumber} | ${metaDisplay}`;
  }

  if (categoryKey === "arrival" || categoryKey === "departure") {
    const hotelLabel = item.hotelName?.trim() ? `Check-in ${item.hotelName}` : "Check-in Hotel";
    return `${hotelLabel} di ${item.to} | ${metaDisplay}`;
  }

  if (categoryKey === "city-tour") {
    return `Ziarah / City Tour ${item.cityTourCity || item.to} | ${metaDisplay}`;
  }

  return item.description?.trim() || item.title;
}

function formatItinerarySupportMeta(item: any, categoryKey: string): string {
  if (categoryKey === "transfer") {
    const segments = [];
    if (item.transferByTrain) {
      segments.push("Kereta Cepat");
      if (item.trainDepartureTime?.trim()) {
        segments.push(`Dep: ${item.trainDepartureTime.trim()}`);
      }
      if (item.destinationPickupTime?.trim()) {
        segments.push(`Pickup Dest: ${item.destinationPickupTime.trim()}`);
      }
    } else if (item.requiresBus) {
      segments.push("Bus Sektor / Ziarah");
    }
    return segments.join(" | ");
  }

  if (categoryKey === "departure") {
    const segments = [];
    if (item.hotelPickupRequestTime?.trim()) {
      segments.push(`Hotel Pickup: ${item.hotelPickupRequestTime.trim()}`);
    }
    if (item.time?.trim()) {
      segments.push(`Flight Dep: ${item.time.trim()}`);
    }
    return segments.join(" | ");
  }

  return "";
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
        <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800 flex items-center gap-3 shadow-xs">
          <span className="material-symbols-outlined text-base text-sky-700" aria-hidden="true">
            info
          </span>
          <div>
            <strong>Data Itinerary Terhubung</strong>
            <p className="mt-0.5 text-[11px] text-sky-600 font-medium">
              Grup ini mewarisi itinerary bersama dari Group Utama (
              {groups.find((g) => g.id === group.parentGroupId || g.code === group.parentGroupId)?.code}). Edit
              itinerary di halaman Group Utama tersebut.
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {itineraryItems.map((item, index) => {
          const categoryKey = inferCategoryKey(item);
          const typeOption = getScheduleTypeOption(categoryKey);
          const activityHeading = formatItineraryActivityHeading(item, categoryKey, typeOption.cardLabel);
          const compactSummary = formatItineraryCompactSummary(item, categoryKey);
          const supportMeta = formatItinerarySupportMeta(item, categoryKey);

          return (
            <article
              key={`${group.code}-${index}-${item.date}`}
              className={`rounded-2xl border bg-surface-container-lowest p-4 ${
                item.highlighted ? "border-brand-primary/40" : "border-outline-variant/45"
              }`}
            >
              <div className="md:hidden">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex min-w-[74px] flex-col rounded-xl bg-surface-container-high/60 px-2.5 py-2 text-center">
                      <strong className="text-base font-bold leading-tight text-brand-primary">{item.date}</strong>
                      <span className="text-[11px] font-medium text-on-surface-variant/80">{item.year}</span>
                    </div>

                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/12 text-brand-primary">
                      <span className="material-symbols-outlined" aria-hidden="true">
                        {typeOption.icon}
                      </span>
                    </div>
                  </div>

                  {!readOnly && !group.parentGroupId && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/80 transition hover:bg-brand-primary/10 hover:text-brand-primary"
                        aria-label={`Edit ${item.title}`}
                        onClick={() => handleOpenEditModal(index)}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          edit
                        </span>
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/80 transition hover:bg-brand-tertiary/12 hover:text-brand-tertiary"
                        aria-label={`Delete ${item.title}`}
                        onClick={() => handleOpenDeleteModal(index)}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          delete
                        </span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-3 min-w-0">
                  <h4 className="text-[1.2rem] font-semibold leading-tight text-on-surface">{activityHeading}</h4>
                  <p className="mt-1 text-sm text-on-surface-variant">{compactSummary}</p>
                  {supportMeta ? (
                    <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{supportMeta}</span>
                  ) : null}
                </div>
              </div>

              <div className="hidden gap-3 md:grid md:grid-cols-[78px_42px_1fr_auto] md:items-center">
                <div className="flex flex-col px-1 text-center">
                  <strong className="text-lg font-bold leading-tight text-brand-primary">{item.date}</strong>
                  <span className="text-[11px] font-medium text-on-surface-variant/80">{item.year}</span>
                </div>

                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/12 text-brand-primary">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {typeOption.icon}
                  </span>
                </div>

                <div className="min-w-0">
                  <h4 className="text-[1.18rem] font-semibold leading-tight text-on-surface">{activityHeading}</h4>
                  <p className="mt-1 text-sm text-on-surface-variant">{compactSummary}</p>
                  {supportMeta ? (
                    <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{supportMeta}</span>
                  ) : null}
                </div>

                {!readOnly && !group.parentGroupId && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/80 transition hover:bg-brand-primary/10 hover:text-brand-primary"
                      aria-label={`Edit ${item.title}`}
                      onClick={() => handleOpenEditModal(index)}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        edit
                      </span>
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/80 transition hover:bg-brand-tertiary/12 hover:text-brand-tertiary"
                      aria-label={`Delete ${item.title}`}
                      onClick={() => handleOpenDeleteModal(index)}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        delete
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {!readOnly && !group.parentGroupId && (
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
        )}
      </div>
    </section>
  );
}
