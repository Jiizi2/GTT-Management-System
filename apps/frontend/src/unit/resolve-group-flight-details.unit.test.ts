import { describe, expect, it } from "vitest";
import type { GroupData, ItineraryItem } from "../shared/app-domain";
import { resolveGroupFlightDetails } from "../pages/visa-detail/visa-detail-helpers";

function itineraryItem(overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    date: "30 Aug",
    year: "2026",
    category: "Arrival",
    title: "Arrival",
    meta: "",
    icon: "flight_land",
    ...overrides,
  } as ItineraryItem;
}

function group(overrides: Partial<GroupData>): GroupData {
  return { itinerary: [], ...overrides } as GroupData;
}

describe("resolveGroupFlightDetails", () => {
  it("prefers explicit VisaSetup flight columns", () => {
    const result = resolveGroupFlightDetails(
      group({
        visaSetup: {
          arrivalFlightNumber: "JT-104",
          arrivalTime: "19:30",
          departureFlightNumber: "JT-105",
          departureTime: "21:00",
        } as GroupData["visaSetup"],
        itinerary: [itineraryItem({ categoryKey: "arrival", flightNumber: "SV-999", time: "01:00" })],
      }),
    );

    expect(result).toEqual({
      arrivalFlightNumber: "JT-104",
      arrivalTime: "19:30",
      departureFlightNumber: "JT-105",
      departureTime: "21:00",
    });
  });

  it("falls back to the itinerary arrival/departure legs when VisaSetup is empty", () => {
    const result = resolveGroupFlightDetails(
      group({
        visaSetup: undefined,
        itinerary: [
          itineraryItem({ categoryKey: "arrival", flightNumber: "GA-980", time: "08:15" }),
          itineraryItem({ categoryKey: "departure", flightNumber: "GA-981", time: "22:40", category: "Departure" }),
        ],
      }),
    );

    expect(result).toEqual({
      arrivalFlightNumber: "GA-980",
      arrivalTime: "08:15",
      departureFlightNumber: "GA-981",
      departureTime: "22:40",
    });
  });

  it("mixes sources per field, preferring VisaSetup where present", () => {
    const result = resolveGroupFlightDetails(
      group({
        visaSetup: { arrivalFlightNumber: "JT-104", arrivalTime: "19:30" } as GroupData["visaSetup"],
        itinerary: [itineraryItem({ categoryKey: "departure", flightNumber: "GA-981", time: "22:40" })],
      }),
    );

    expect(result.arrivalFlightNumber).toBe("JT-104");
    expect(result.departureFlightNumber).toBe("GA-981");
    expect(result.departureTime).toBe("22:40");
  });

  it("returns empty strings when nothing is available", () => {
    expect(resolveGroupFlightDetails(null)).toEqual({
      arrivalFlightNumber: "",
      arrivalTime: "",
      departureFlightNumber: "",
      departureTime: "",
    });
  });
});
