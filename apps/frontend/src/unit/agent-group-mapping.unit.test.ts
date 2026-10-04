import { describe, expect, it } from "vitest";
import { mapAgentGroup } from "../agent/data/map-agent-group";
import type { GroupSummary } from "../agent/data/contracts";

describe("Agent itinerary mapping", () => {
  it("preserves an explicit no-transport choice for shared itinerary preview and PDF", () => {
    const group: GroupSummary = {
      id: "child",
      parentGroupId: "parent",
      code: "CHILD",
      name: "Child group",
      lifecycleStatus: "ACTIVE",
      arrivalDate: "2026-10-05",
      returnDate: "2026-10-08",
      pax: 10,
      packageName: "Umrah",
      totalBuses: null,
      musyrif: null,
      notes: [],
      itinerary: [
        {
          id: "shared-transfer",
          sortOrder: 0,
          category: "Transfer",
          title: "Own transport",
          dateLabel: "5 Okt",
          yearLabel: "2026",
          isoDate: "2026-10-05",
          time: "09:00",
          transportMode: "none",
          requiresBus: false,
          busCount: 0,
          transferByTrain: false,
          flightNumber: null,
          hotelName: null,
          fromHotelName: null,
          fromLocation: "Makkah",
          toLocation: "Madinah",
          cityTourCity: null,
          trainDepartureTime: null,
          destinationPickupTime: null,
          hotelPickupRequestTime: null,
        },
      ],
    };
    expect(mapAgentGroup(group, "agent-own", "Agent").itinerary[0]).toMatchObject({
      transportMode: "none",
      requiresBus: false,
      busCount: 0,
    });
  });
});
