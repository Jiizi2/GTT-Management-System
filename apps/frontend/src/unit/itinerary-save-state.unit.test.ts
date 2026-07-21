import assert from "node:assert/strict";
import { describe } from "vitest";
import { shouldDisableItinerarySave } from "../pages/add-group-workspace/helpers/add-group-workspace-helpers.js";
import {
  createBaseTripDrafts,
  isBaseTripDraftInvalid,
} from "../pages/add-group-workspace/helpers/add-group-workspace-helpers.js";
import { runCase } from "../test/run-case.js";

describe("itinerary save state", () => {
  runCase("schedule-only editing does not require the hidden agent field", () => {
    assert.equal(
      shouldDisableItinerarySave({
        isGroupReadyForItinerary: true,
        isScheduleOnlyMode: true,
        effectiveAgentId: "",
        itineraryItemCount: 1,
      }),
      false,
    );
  });

  runCase("new group creation still requires an agent", () => {
    assert.equal(
      shouldDisableItinerarySave({
        isGroupReadyForItinerary: true,
        isScheduleOnlyMode: false,
        effectiveAgentId: "",
        itineraryItemCount: 1,
      }),
      true,
    );
  });

  runCase("an itinerary item and valid group data remain required", () => {
    assert.equal(
      shouldDisableItinerarySave({
        isGroupReadyForItinerary: true,
        isScheduleOnlyMode: true,
        effectiveAgentId: "",
        itineraryItemCount: 0,
      }),
      true,
    );
    assert.equal(
      shouldDisableItinerarySave({
        isGroupReadyForItinerary: false,
        isScheduleOnlyMode: true,
        effectiveAgentId: "agent-1",
        itineraryItemCount: 1,
      }),
      true,
    );
  });

  runCase("all five base trips can be validated and saved together", () => {
    const drafts = createBaseTripDrafts("2026-08-01", "2026-08-10").map((draft) => ({
      ...draft,
      isEnabled: true,
    }));
    const departure = drafts.find((draft) => draft.category === "departure");
    assert.ok(departure);
    departure.time = "20:00";
    departure.hotelPickupRequestTime = "16:00";

    assert.equal(drafts.length, 5);
    assert.deepEqual(
      drafts.filter((draft) => isBaseTripDraftInvalid(draft)).map((draft) => draft.id),
      [],
    );
  });
});
