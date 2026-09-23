import { describe, expect, it } from "vitest";
import { createEmptyFlightLeg, deriveLegacyFlightSummary, normalizeFlightLegs } from "../shared/flight-plan";

describe("flight plan", () => {
  it("normalizes airport codes and renumbers each direction independently", () => {
    const legs = normalizeFlightLegs([
      { ...createEmptyFlightLeg("ONWARD", 7), departureAirportCode: "cgk", arrivalAirportCode: "doh" },
      { ...createEmptyFlightLeg("ONWARD", 9), departureAirportCode: "doh", arrivalAirportCode: "jed" },
      { ...createEmptyFlightLeg("RETURN", 4), departureAirportCode: "jed", arrivalAirportCode: "cgk" },
    ]);
    expect(legs.map((leg) => [leg.direction, leg.sortOrder, leg.departureAirportCode, leg.arrivalAirportCode])).toEqual([
      ["ONWARD", 0, "CGK", "DOH"],
      ["ONWARD", 1, "DOH", "JED"],
      ["RETURN", 0, "JED", "CGK"],
    ]);
  });

  it("derives compatibility fields from the final onward and first return legs", () => {
    const summary = deriveLegacyFlightSummary([
      { ...createEmptyFlightLeg("ONWARD", 0), departureAirportCode: "CGK", arrivalAirportCode: "DOH", flightNumber: "QR-955" },
      {
        ...createEmptyFlightLeg("ONWARD", 1), departureAirportCode: "DOH", arrivalAirportCode: "JED",
        arrivalDate: "2026-09-21", arrivalTime: "16:30", flightNumber: "QR-1188",
      },
      {
        ...createEmptyFlightLeg("RETURN", 0), departureAirportCode: "JED", arrivalAirportCode: "CGK",
        departureDate: "2026-09-30", departureTime: "07:50", flightNumber: "GA-981",
      },
    ]);

    expect(summary).toEqual({
      arrivalFlightNumber: "QR-1188", arrivalFlightDate: "2026-09-21", arrivalTime: "16:30",
      departureFlightNumber: "GA-981", departureFlightDate: "2026-09-30", departureTime: "07:50",
    });
  });
});
