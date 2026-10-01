import { useGroupDetailContext } from "../context/GroupDetailContext";
import { ItineraryTimeline } from "./ItineraryTimeline";

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

      <ItineraryTimeline
        items={itineraryItems}
        renderActions={
          canEditItinerary
            ? (item, index) => (
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
              )
            : undefined
        }
      />

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
