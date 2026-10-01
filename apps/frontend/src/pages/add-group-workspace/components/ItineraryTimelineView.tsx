import type { InputItineraryItem } from "../../../shared/app-domain";
import { buildItineraryFromInputItems } from "../helpers/add-group-workspace-helpers";
import { ItineraryTimeline } from "../../group-detail/components/ItineraryTimeline";

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
  if (itineraryItems.length === 0) return null;

  return (
    <ItineraryTimeline
      items={buildItineraryFromInputItems(itineraryItems)}
      renderActions={(_, index) => {
        const item = itineraryItems[index];
        return (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="serene-focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={`Edit ${item.category} itinerary`}
              onClick={() => handleEditItem(item)}
              disabled={!isGroupReadyForItinerary}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                edit
              </span>
            </button>
            <button
              type="button"
              className="serene-focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-error-container hover:text-on-error-container disabled:cursor-not-allowed disabled:opacity-45"
              aria-label={`Delete ${item.category} itinerary`}
              onClick={() => handleDeleteItem(item.id)}
              disabled={!isGroupReadyForItinerary}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                delete
              </span>
            </button>
          </div>
        );
      }}
    />
  );
}
