import { describe, expect, it } from "vitest";
import type { ItineraryItem } from "../shared/app-domain";
import { buildItineraryFacts, buildItinerarySummary } from "../pages/group-detail/components/group-itinerary-display";

function createItem(overrides: Partial<ItineraryItem> = {}): ItineraryItem {
  return {
    date: "19 Jul",
    year: "2026",
    category: "Arrival",
    title: "Arrival in Jeddah",
    meta: "",
    icon: "flight_land",
    from: "JED Airport",
    to: "Makkah",
    ...overrides,
  };
}

describe("group itinerary display", () => {
  it("shows flight, arrival time, and destination hotel as arrival facts", () => {
    const item = createItem({ flightNumber: "SV 827", time: "06:10", hotelName: "Swissotel Al Maqam" });

    expect(buildItinerarySummary(item, "arrival")).toBe("JED Airport → Makkah");
    expect(buildItineraryFacts(item, "arrival")).toEqual([
      { icon: "confirmation_number", label: "Flight Number", value: "SV 827" },
      { icon: "schedule", label: "Arrival Time", value: "06:10 LT" },
      { icon: "hotel", label: "Destination Hotel", value: "Swissotel Al Maqam" },
    ]);
  });

  it("keeps required departure facts visible and adds hotel pickup when available", () => {
    const item = createItem({
      category: "Departure",
      flightNumber: "",
      time: "20:00",
      hotelName: "Pullman Zamzam",
      hotelPickupRequestTime: "17:00",
    });

    expect(buildItineraryFacts(item, "departure")).toEqual([
      { icon: "confirmation_number", label: "Flight Number", value: "Not set" },
      { icon: "schedule", label: "Departure Time", value: "20:00 LT" },
      { icon: "hotel", label: "Origin Hotel", value: "Pullman Zamzam" },
      { icon: "airport_shuttle", label: "Hotel Pickup", value: "17:00 LT" },
    ]);
  });

  it("builds a city tour fact grid with its area, pickup hotel, and transport", () => {
    const item = createItem({
      category: "City Tour",
      time: "07:00",
      cityTourCity: "Madinah",
      hotelName: "Jiwar Al Saha",
      requiresBus: true,
      from: "Jiwar Al Saha",
      to: "Masjid Quba",
    });

    expect(buildItinerarySummary(item, "city-tour")).toBe("Jiwar Al Saha → Masjid Quba");
    expect(buildItineraryFacts(item, "city-tour").map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "Start Time", value: "07:00 LT" },
      { label: "Tour Area", value: "Madinah" },
      { label: "Pickup Hotel", value: "Jiwar Al Saha" },
      { label: "Transportation", value: "Bus" },
    ]);
  });

  it("shows train departure and destination pickup for rail transfers", () => {
    const item = createItem({
      category: "Transfer - Train Departure",
      transferByTrain: true,
      trainDepartureTime: "15:30",
      destinationPickupTime: "18:00",
    });

    expect(buildItineraryFacts(item, "transfer").map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "Transportation", value: "High-speed train" },
      { label: "Train Departure", value: "15:30 LT" },
      { label: "Destination Pickup", value: "18:00 LT" },
    ]);
  });

  it("does not append a second LT suffix and labels a station pickup segment correctly", () => {
    const item = createItem({
      category: "Transfer - Station Pickup",
      transferByTrain: true,
      time: "18:00 LT",
      destinationPickupTime: "18:00",
    });

    expect(buildItineraryFacts(item, "transfer").map(({ label, value }) => ({ label, value }))).toEqual([
      { label: "Transportation", value: "High-speed train" },
      { label: "Station Pickup", value: "18:00 LT" },
    ]);
  });
});
