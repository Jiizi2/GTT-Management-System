import { describe, expect, it } from "vitest";
import type { GroupAgreementHotel, GroupData, GroupVisaSetup, ItineraryItem } from "../shared/app-domain";
import { buildVisaItineraryPatch } from "../hooks/app-controller/use-visa-mutations";

function agreement(overrides: Partial<GroupAgreementHotel>): GroupAgreementHotel {
  return {
    id: overrides.id ?? "agr",
    hotelName: overrides.hotelName ?? "Hotel",
    agreementNumber: overrides.agreementNumber ?? "0000",
    pax: overrides.pax ?? 20,
    status: overrides.status ?? "Approved",
    stayStartIso: overrides.stayStartIso ?? "2026-08-30",
    stayEndIso: overrides.stayEndIso ?? "2026-09-04",
    ...overrides,
  };
}

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

function visaSetup(overrides: Partial<GroupVisaSetup>): GroupVisaSetup {
  return {
    visaStatus: "Pending",
    syarikah: "-",
    busStatus: "Visa Only",
    paymentStatus: "Unpaid",
    makkahHotels: [],
    madinahHotels: [],
    raudhahAppointments: [],
    ...overrides,
  } as GroupVisaSetup;
}

describe("buildVisaItineraryPatch", () => {
  it("adds the Madinah<->Makkah transfer while preserving a manual city tour", () => {
    const group = {
      code: "TST",
      arrivalDate: "2026-08-30",
      returnDate: "2026-09-09",
      itinerary: [
        itineraryItem({ categoryKey: "arrival", isoDate: "2026-08-30" }),
        itineraryItem({
          categoryKey: "city-tour",
          category: "City Tour",
          title: "City Tour",
          isoDate: "2026-09-01",
          icon: "tour",
          cityTourCity: "Madinah",
        }),
        itineraryItem({ categoryKey: "departure", category: "Departure", title: "Departure", isoDate: "2026-09-09" }),
      ],
    } as GroupData;

    const patch = buildVisaItineraryPatch(
      group,
      visaSetup({
        arrivalFlightNumber: "JT-104",
        arrivalTime: "19:30",
        departureFlightNumber: "JT-105",
        departureTime: "21:00",
        madinahHotels: [
          agreement({ id: "m", hotelName: "Three Point", stayStartIso: "2026-08-30", stayEndIso: "2026-09-04" }),
        ],
        makkahHotels: [
          agreement({ id: "k", hotelName: "Sunrise Ajyad", stayStartIso: "2026-09-04", stayEndIso: "2026-09-09" }),
        ],
      }),
    );

    expect(patch.itinerary).toBeDefined();
    const keys = (patch.itinerary ?? []).map((item) => item.categoryKey);
    // The regenerated base legs now include the transfer...
    expect(keys).toContain("transfer");
    // ...and the manual city tour survives the regeneration.
    expect(keys).toContain("city-tour");
    expect(keys.filter((key) => key === "arrival")).toHaveLength(1);
    expect(keys.filter((key) => key === "departure")).toHaveLength(1);

    const cityTour = (patch.itinerary ?? []).find((item) => item.categoryKey === "city-tour");
    expect(cityTour?.cityTourCity).toBe("Madinah");
  });

  it("returns an empty patch when there is not enough visa data to build", () => {
    const group = { code: "TST", itinerary: [] } as unknown as GroupData;
    expect(buildVisaItineraryPatch(group, visaSetup({}))).toEqual({});
  });
});
