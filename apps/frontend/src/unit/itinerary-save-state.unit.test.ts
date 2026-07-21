import assert from "node:assert/strict";
import { describe } from "vitest";
import { shouldDisableItinerarySave } from "../pages/add-group-workspace/helpers/add-group-workspace-helpers.js";
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
});
