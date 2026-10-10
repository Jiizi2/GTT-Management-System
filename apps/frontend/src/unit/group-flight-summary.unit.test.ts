import { describe, expect, it } from "vitest";
import type { GroupData, GroupFlightLeg, GroupVisaSetup, ItineraryItem } from "../shared/app-domain-types";
import { createEmptyFlightLeg, deriveLegacyFlightSummary } from "../shared/flight-plan";
import {
  resolveGroupFlightSummary,
  selectGroupForFlightCopy,
  synchronizeItineraryFlightCities,
} from "../shared/group-flight-summary";
import { generateMuassasahHijaziWhatsappCopyText, generateWhatsappCopyText } from "../shared/visa-domain";
import { buildVisaItineraryPatch } from "../hooks/app-controller/use-visa-mutations";
import { findSaudiAirport } from "../shared/saudi-airports";
import { mapGroupToBackendPayload } from "../hooks/groups-backend-payload";
import { mapBackendGroupToFrontend } from "../hooks/groups-backend-mapper";
import type { BackendGroupRecord } from "../hooks/groups-contract";

function flightLegs(): GroupFlightLeg[] {
  return [
    {
      ...createEmptyFlightLeg("ONWARD"),
      departureAirportCode: "CGK",
      arrivalAirportCode: "MED",
      flightNumber: "GA-980",
      arrivalDate: "2026-10-13",
      arrivalTime: "17:40",
    },
    {
      ...createEmptyFlightLeg("RETURN"),
      departureAirportCode: "JED",
      arrivalAirportCode: "CGK",
      flightNumber: "GA-981",
      departureDate: "2026-10-20",
      departureTime: "19:40",
    },
  ];
}

function visaSetup(overrides: Partial<GroupVisaSetup> = {}): GroupVisaSetup {
  return {
    visaStatus: "Pending",
    syarikah: "-",
    busStatus: "Visa Only",
    paymentStatus: "Unpaid",
    makkahHotels: [],
    madinahHotels: [],
    raudhahAppointments: [],
    flightLegs: flightLegs(),
    ...overrides,
  };
}

function itinerary(): ItineraryItem[] {
  return [
    {
      date: "13 Oct",
      year: "2026",
      isoDate: "2026-10-13",
      category: "Arrival",
      categoryKey: "arrival",
      title: "Arrival",
      meta: "",
      icon: "flight_land",
      from: "Jeddah",
      to: "Makkah",
      flightNumber: "OLD-ARR",
      time: "08:00",
      transportMode: "flight",
      notes: "Arrival note",
      busCount: 2,
      requiresBus: true,
    },
    {
      date: "20 Oct",
      year: "2026",
      isoDate: "2026-10-20",
      category: "Departure",
      categoryKey: "departure",
      title: "Departure",
      meta: "",
      icon: "flight_takeoff",
      from: "Madinah",
      to: "Madinah",
      flightNumber: "OLD-DEP",
      time: "09:00",
      transportMode: "flight",
      hotelPickupRequestTime: "15:30",
      notes: "Pickup note",
      busCount: 1,
      requiresBus: true,
    },
  ];
}

function group(overrides: Partial<GroupData> = {}): GroupData {
  return {
    code: "TEST",
    name: "Test",
    status: "Active",
    tone: "active",
    pax: 45,
    packageName: "Standard",
    durationDays: 8,
    arrivalDate: "2026-10-13",
    returnDate: "2026-10-20",
    itinerary: itinerary(),
    visaSetup: visaSetup(),
    notes: [],
    timeline: [
      { date: "13 Oct", title: "Arrival" },
      { date: "20 Oct", title: "Departure" },
    ],
    nextActivity: { title: "Arrival", date: "13 Oct", time: "17:40", icon: "flight_land" },
    musyrif: { name: "", phone: "", avatar: "" },
    ...overrides,
  };
}

function flightSection(value: GroupData): string {
  return (
    generateWhatsappCopyText(value)
      .split("\n\n")
      .find((section) => section.startsWith("✈️")) ?? ""
  );
}

const expectedSection =
  "✈️ *Flight Detail*\nMADINAH / GA-980 / 17.40 / 13 OCT 2026\nJEDDAH / GA-981 / 19.40 / 20 OCT 2026";

describe("shared flight city resolution", () => {
  it("copies saved flights immediately without any Overview itinerary or compatibility columns", () => {
    expect(flightSection(group({ itinerary: [] }))).toBe(expectedSection);
    expect(flightSection(group())).toBe(expectedSection);
  });

  it("keeps the same airport cities after serializing a save and reading the backend record", () => {
    const value = group();
    const patch = buildVisaItineraryPatch(value, value.visaSetup!);
    const payload = mapGroupToBackendPayload({ ...value, ...patch });
    expect(payload.visaSetup?.flightLegs?.[0]?.arrivalAirportCode).toBe("MED");
    expect(payload.visaSetup?.flightLegs?.[1]?.departureAirportCode).toBe("JED");
    const reloaded = mapBackendGroupToFrontend({ ...payload, id: "persisted-group" } as unknown as BackendGroupRecord);
    expect(reloaded?.itinerary[0]?.from).toBe("Madinah");
    expect(reloaded?.itinerary[1]?.to).toBe("Jeddah");
    expect(flightSection(reloaded!)).toBe(expectedSection);
  });

  it("uses the ordered Saudi arrival and departure legs, excluding international transit segments", () => {
    const direct = flightLegs();
    direct[0] = { ...direct[0]!, sortOrder: 1, departureAirportCode: "DOH" };
    direct[1] = { ...direct[1]!, arrivalAirportCode: "DXB" };
    const legs = [
      {
        ...createEmptyFlightLeg("RETURN", 1),
        departureAirportCode: "DXB",
        arrivalAirportCode: "CGK",
        flightNumber: "TRANSIT-RETURN",
        departureDate: "2026-10-21",
        departureTime: "02:00",
      },
      direct[0]!,
      {
        ...createEmptyFlightLeg("ONWARD", 0),
        departureAirportCode: "CGK",
        arrivalAirportCode: "DOH",
        flightNumber: "TRANSIT-ONWARD",
        arrivalDate: "2026-10-12",
        arrivalTime: "06:00",
      },
      direct[1]!,
    ];
    const value = group({
      itinerary: itinerary().reverse(),
      visaSetup: visaSetup({ flightLegs: legs, arrivalFlightNumber: "STALE" }),
    });
    expect(flightSection(value)).toBe(expectedSection);
    const hijazi = generateMuassasahHijaziWhatsappCopyText(value);
    expect(hijazi).toContain("ENTRY DATE WITH FLIGHT NO : GA-980");
    expect(hijazi).toContain("EXIT DATE WITH FLIGHT NO : GA-981");
    expect(hijazi).not.toContain("TRANSIT-");
  });

  it("synchronizes airport edits into Overview and keeps ground destinations and arrangements", () => {
    const value = group();
    const projected = synchronizeItineraryFlightCities(value);
    expect(projected.itinerary[0]).toMatchObject({ from: "Madinah", to: "Makkah", busCount: 2, notes: "Arrival note" });
    expect(projected.itinerary[1]).toMatchObject({ from: "Madinah", to: "Jeddah", hotelPickupRequestTime: "15:30" });
    const changedLegs = flightLegs();
    changedLegs[0]!.arrivalAirportCode = "JED";
    changedLegs[1]!.departureAirportCode = "MED";
    const changed = group({ itinerary: projected.itinerary, visaSetup: visaSetup({ flightLegs: changedLegs }) });
    const patch = buildVisaItineraryPatch(changed, changed.visaSetup!);
    expect(patch.itinerary?.[0]).toMatchObject({
      from: "Jeddah",
      to: "Makkah",
      flightNumber: "GA-980",
      busCount: 2,
      notes: "Arrival note",
    });
    expect(patch.itinerary?.[1]).toMatchObject({
      from: "Madinah",
      to: "Madinah",
      flightNumber: "GA-981",
      hotelPickupRequestTime: "15:30",
      notes: "Pickup note",
    });
    expect(flightSection({ ...changed, ...patch })).toContain("JEDDAH / GA-980");
    expect(flightSection({ ...changed, ...patch })).toContain("MADINAH / GA-981");
  });

  it("does not reuse stale Saudi cities when a saved route contains only international transit", () => {
    const legs = flightLegs();
    legs[0]!.arrivalAirportCode = "DOH";
    legs[1]!.departureAirportCode = "AUH";
    const value = group({ visaSetup: visaSetup({ flightLegs: legs }) });
    expect(resolveGroupFlightSummary(value).arrival?.city).toBe("");
    expect(resolveGroupFlightSummary(value).departure?.city).toBe("");
    const text = flightSection(value);
    expect(text).not.toMatch(/DOH|AUH|MADINAH|JEDDAH/);
    expect(synchronizeItineraryFlightCities(value).itinerary[0]?.from).toBe("");
    expect(synchronizeItineraryFlightCities(value).itinerary[1]?.to).toBe("");
  });

  it("keeps an existing train transfer when flight changes regenerate the itinerary", () => {
    const value = group();
    const stay = { id: "stay", hotelName: "Hotel", agreementNumber: "BRN", pax: 45, status: "Approved" as const };
    value.visaSetup!.madinahHotels = [{ ...stay, stayStartIso: "2026-10-13", stayEndIso: "2026-10-16" }];
    value.visaSetup!.makkahHotels = [{ ...stay, stayStartIso: "2026-10-16", stayEndIso: "2026-10-20" }];
    value.itinerary.splice(1, 0, {
      date: "16 Oct",
      year: "2026",
      isoDate: "2026-10-16",
      category: "Transfer",
      categoryKey: "transfer",
      title: "Train transfer",
      meta: "",
      icon: "train",
      from: "Madinah",
      to: "Makkah",
      time: "10:30",
      transportMode: "train",
      transferByTrain: true,
      trainDepartureTime: "10:30",
      destinationPickupTime: "11:30",
      busCount: 0,
      requiresBus: false,
      notes: "Train arrangement",
    });
    const patch = buildVisaItineraryPatch(value, value.visaSetup!);
    expect(patch.itinerary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transportMode: "train",
          trainDepartureTime: "10:30",
          destinationPickupTime: "11:30",
          notes: "Train arrangement",
        }),
      ]),
    );
    expect(flightSection({ ...value, ...patch })).toBe(expectedSection);
  });

  it("retains legacy flight summaries and manually entered airport cities across regeneration", () => {
    const value = group({
      visaSetup: visaSetup({ flightLegs: undefined, ...deriveLegacyFlightSummary(flightLegs()) }),
    });
    value.itinerary[0]!.from = "med airport";
    value.itinerary[1]!.to = "JED";
    expect(flightSection(value)).toBe(expectedSection);
    const patch = buildVisaItineraryPatch(value, value.visaSetup!);
    expect(patch.itinerary?.[0]?.from).toBe("Madinah");
    expect(patch.itinerary?.[1]?.to).toBe("Jeddah");
    expect(flightSection({ ...value, ...patch })).toBe(expectedSection);
  });

  it("supports old international-route itineraries without treating DOH or CGK as Saudi cities", () => {
    const value = group({ visaSetup: undefined });
    value.itinerary[0] = { ...value.itinerary[0]!, from: "DOH", to: "MED" };
    value.itinerary[1] = { ...value.itinerary[1]!, from: "JED", to: "CGK" };
    expect(resolveGroupFlightSummary(value).arrival?.city).toBe("Madinah");
    expect(resolveGroupFlightSummary(value).departure?.city).toBe("Jeddah");
    const land = group({
      visaSetup: undefined,
      itinerary: value.itinerary.map((item) => ({ ...item, transportMode: "bus" })),
    });
    expect(resolveGroupFlightSummary(land)).toEqual({ arrival: undefined, departure: undefined });
  });

  it("clears removed flight information without resurrecting the old Overview values", () => {
    const value = group();
    const cleared = visaSetup({ flightLegs: [], ...deriveLegacyFlightSummary([]) });
    const patch = buildVisaItineraryPatch(value, cleared, { allowItineraryFallback: { ONWARD: false, RETURN: false } });
    expect(patch.itinerary?.[0]).toMatchObject({ from: "", to: "Makkah", flightNumber: "" });
    expect(patch.itinerary?.[1]).toMatchObject({ from: "Madinah", to: "", flightNumber: "" });
  });

  it("uses the active child's own flight, while retaining parent fallback for children without flights", () => {
    const parent = group({ code: "PARENT" });
    const child = group({ code: "CHILD", parentGroupId: "PARENT" });
    expect(selectGroupForFlightCopy(child, parent)).toBe(child);
    const childWithoutFlight = group({ code: "CHILD", parentGroupId: "PARENT", visaSetup: undefined });
    expect(selectGroupForFlightCopy(childWithoutFlight, parent)).toBe(parent);
  });

  it("normalizes known codes and aliases, without inferring an airport from a hotel city", () => {
    expect(findSaudiAirport(" med ")?.city).toBe("Madinah");
    expect(findSaudiAirport("Medina")?.code).toBe("MED");
    expect(findSaudiAirport("Jeddah International Airport")?.code).toBe("JED");
    expect(findSaudiAirport("DOH")).toBeUndefined();
    expect(findSaudiAirport("Makkah")).toBeUndefined();
  });
});
