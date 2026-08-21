import { describe, expect, it } from "vitest";
import type { GroupAgreementHotel } from "../shared/app-domain-types";
import { buildItineraryFromVisaData } from "../shared/visa-itinerary-generator";

function agreement(overrides: Partial<GroupAgreementHotel> = {}): GroupAgreementHotel {
  return {
    id: overrides.id ?? "agr",
    hotelName: overrides.hotelName ?? "Hotel",
    agreementNumber: overrides.agreementNumber ?? "0000",
    pax: overrides.pax ?? 16,
    status: overrides.status ?? "Waiting",
    stayStartIso: overrides.stayStartIso ?? "2026-08-30",
    stayEndIso: overrides.stayEndIso ?? "2026-09-04",
    ...overrides,
  };
}

describe("buildItineraryFromVisaData", () => {
  it("builds a Madinah-first structure ordered by agreement stay dates", () => {
    const items = buildItineraryFromVisaData({
      arrivalDateIso: "2026-08-30",
      returnDateIso: "2026-09-09",
      madinahAgreements: [
        agreement({ id: "m", hotelName: "Three Point Alameen", stayStartIso: "2026-08-30", stayEndIso: "2026-09-04" }),
      ],
      makkahAgreements: [
        agreement({ id: "k", hotelName: "Sunrise Ajyad", stayStartIso: "2026-09-04", stayEndIso: "2026-09-09" }),
      ],
      flight: {
        arrivalFlightNumber: "JT-104",
        arrivalTime: "19:30",
        departureFlightNumber: "JT-105",
        departureTime: "21:00",
      },
    });

    expect(items.map((item) => [item.categoryKey, item.date, item.from, item.to])).toEqual([
      ["arrival", "2026-08-30", "", "Madinah"],
      ["transfer", "2026-09-04", "Madinah", "Makkah"],
      ["departure", "2026-09-09", "Makkah", ""],
    ]);

    const arrival = items[0];
    expect(arrival.flightNumber).toBe("JT-104");
    expect(arrival.time).toBe("19:30");
    expect(arrival.transportMode).toBe("flight");
    expect(arrival.hotelName).toBe("Three Point Alameen");

    const transfer = items[1];
    expect(transfer.transportMode).toBe("bus");
    expect(transfer.requiresBus).toBe(true);
    expect(transfer.hotelName).toBe("Sunrise Ajyad");
    expect(transfer.fromHotelName).toBe("Three Point Alameen");

    const departure = items[2];
    expect(departure.flightNumber).toBe("JT-105");
    expect(departure.time).toBe("21:00");
    expect(departure.hotelName).toBe("Sunrise Ajyad");
  });

  it("omits the transfer when only one city has an agreement", () => {
    const items = buildItineraryFromVisaData({
      arrivalDateIso: "2026-08-30",
      returnDateIso: "2026-09-04",
      makkahAgreements: [
        agreement({ id: "k", hotelName: "Sunrise Ajyad", stayStartIso: "2026-08-30", stayEndIso: "2026-09-04" }),
      ],
      madinahAgreements: [],
    });

    expect(items.map((item) => item.categoryKey)).toEqual(["arrival", "departure"]);
    expect(items[0].to).toBe("Makkah");
    expect(items[1].from).toBe("Makkah");
  });

  it("coalesces multiple agreements in the same city into a single stay", () => {
    const items = buildItineraryFromVisaData({
      arrivalDateIso: "2026-08-30",
      returnDateIso: "2026-09-09",
      makkahAgreements: [
        agreement({ id: "k1", hotelName: "Makkah Hotel A", stayStartIso: "2026-09-04", stayEndIso: "2026-09-06" }),
        agreement({ id: "k2", hotelName: "Makkah Hotel B", stayStartIso: "2026-09-06", stayEndIso: "2026-09-09" }),
      ],
      madinahAgreements: [
        agreement({ id: "m", hotelName: "Madinah Hotel", stayStartIso: "2026-08-30", stayEndIso: "2026-09-04" }),
      ],
    });

    // Only one Madinah -> Makkah transfer despite two Makkah agreements.
    expect(items.map((item) => item.categoryKey)).toEqual(["arrival", "transfer", "departure"]);
    const transfer = items[1];
    expect(transfer.from).toBe("Madinah");
    expect(transfer.to).toBe("Makkah");
    // Keeps the earliest Makkah hotel as the destination stay hotel.
    expect(transfer.hotelName).toBe("Makkah Hotel A");
  });

  it("falls back to agreement dates when arrival/return dates are missing", () => {
    const items = buildItineraryFromVisaData({
      makkahAgreements: [
        agreement({ id: "k", hotelName: "Sunrise Ajyad", stayStartIso: "2026-09-04", stayEndIso: "2026-09-09" }),
      ],
      madinahAgreements: [
        agreement({ id: "m", hotelName: "Three Point", stayStartIso: "2026-08-30", stayEndIso: "2026-09-04" }),
      ],
    });

    expect(items[0].date).toBe("2026-08-30");
    expect(items[items.length - 1].date).toBe("2026-09-09");
  });

  it("returns nothing when there is no usable data", () => {
    expect(
      buildItineraryFromVisaData({ makkahAgreements: [], madinahAgreements: [] }),
    ).toEqual([]);
  });
});
