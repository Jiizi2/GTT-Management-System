-- Add an explicit transport mode (flight | bus | train) to itinerary items so
-- transportation is no longer implied by the activity category. Nullable so
-- existing rows keep working; the app derives a mode for legacy data.
ALTER TABLE "ItineraryItem" ADD COLUMN "transportMode" TEXT;
