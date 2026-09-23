import { describe, expect, it } from "vitest";
import type { GroupData } from "../shared/app-domain";
import { resolveGroupFlightDetails } from "../pages/visa-detail/visa-detail-helpers";

function group(overrides: Partial<GroupData>): GroupData {
  return { itinerary: [], ...overrides } as GroupData;
}

describe("resolveGroupFlightDetails", () => {
  it("prefers canonical ordered flight legs", () => {
    const result = resolveGroupFlightDetails(group({
      visaSetup: {
        flightLegs: [
          {
            id: "onward-1", direction: "ONWARD", sortOrder: 0,
            departureAirportCode: "CGK", arrivalAirportCode: "DOH",
            departureDate: "2026-08-30", departureTime: "08:15",
            arrivalDate: "2026-08-30", arrivalTime: "12:20",
            carrierCode: "QR", flightNumber: "QR-955", remarks: "",
          },
          {
            id: "onward-2", direction: "ONWARD", sortOrder: 1,
            departureAirportCode: "DOH", arrivalAirportCode: "JED",
            departureDate: "2026-08-30", departureTime: "14:00",
            arrivalDate: "2026-08-30", arrivalTime: "16:30",
            carrierCode: "QR", flightNumber: "QR-1188", remarks: "Transit",
          },
        ],
      } as GroupData["visaSetup"],
    }));

    expect(result.flightLegs).toHaveLength(3);
    expect(result.flightLegs[0]).toMatchObject({ departureAirportCode: "CGK", arrivalAirportCode: "DOH" });
    expect(result.flightLegs[1]).toMatchObject({ departureAirportCode: "DOH", arrivalAirportCode: "JED" });
    expect(result.flightLegs[2]).toMatchObject({ direction: "RETURN", flightNumber: "" });
  });

  it("turns legacy summaries into incomplete editable legs without guessing airports", () => {
    const result = resolveGroupFlightDetails(group({
      visaSetup: {
        arrivalFlightNumber: "JT-104", arrivalFlightDate: "2026-08-30", arrivalTime: "19:30",
        departureFlightNumber: "JT-105", departureFlightDate: "2026-09-09", departureTime: "21:00",
      } as GroupData["visaSetup"],
    }));

    expect(result.flightLegs[0]).toMatchObject({
      direction: "ONWARD", departureAirportCode: "", arrivalAirportCode: "",
      flightNumber: "JT-104", arrivalDate: "2026-08-30", arrivalTime: "19:30",
    });
    expect(result.flightLegs[1]).toMatchObject({
      direction: "RETURN", departureAirportCode: "", arrivalAirportCode: "",
      flightNumber: "JT-105", departureDate: "2026-09-09", departureTime: "21:00",
    });
  });

  it("does not infer international routes from Saudi itinerary items", () => {
    const result = resolveGroupFlightDetails(group({
      itinerary: [{
        date: "30 Aug", year: "2026", category: "Arrival", categoryKey: "arrival",
        title: "Arrival", meta: "", icon: "flight_land", from: "Jeddah", to: "Makkah", flightNumber: "GA-980",
      }],
    }));

    expect(result.flightLegs).toEqual([
      expect.objectContaining({ direction: "ONWARD", departureAirportCode: "", arrivalAirportCode: "" }),
      expect.objectContaining({ direction: "RETURN", departureAirportCode: "", arrivalAirportCode: "" }),
    ]);
  });
});
