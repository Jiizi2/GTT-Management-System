import { describe, expect, it } from "vitest";
import { createEmptyFlightLeg, deriveLegacyFlightSummary, normalizeFlightLegs } from "../shared/flight-plan";
import {
  buildMirroredReturnLegs,
  computeAutoArrivalDate,
  extractCarrierAndFlightNumber,
  parseFlightScheduleText,
} from "../shared/flight-smart-paste";

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

  it("auto-extracts carrierCode and normalizes flightNumber and arrivalDate when saving", () => {
    const legs = normalizeFlightLegs([
      {
        ...createEmptyFlightLeg("ONWARD", 0),
        departureAirportCode: "CGK",
        arrivalAirportCode: "JED",
        departureDate: "2026-11-12",
        departureTime: "19:00",
        arrivalTime: "00:50",
        flightNumber: "sv 817",
      },
    ]);
    expect(legs[0]).toMatchObject({
      carrierCode: "SV",
      flightNumber: "SV-817",
      departureDate: "2026-11-12",
      arrivalDate: "2026-11-13",
    });
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

  it("parses GDS/PNR, ticket lines, and WhatsApp flight schedules into ONWARD and RETURN legs", () => {
    const gdsParsed = parseFlightScheduleText(
      [
        "1 QR 957 Y 12NOV 4 CGKDOH HK45 1830 2300",
        "2 QR 1188 Y 13NOV 5 DOHJED HK45 0130 0400",
        "3 QR 1189 Y 20NOV 5 JEDDOH HK45 1900 2130",
        "4 QR 956 Y 21NOV 6 DOHCGK HK45 0230 1510",
      ].join("\n"),
      { referenceYear: 2026 },
    );

    expect(gdsParsed).toHaveLength(4);
    expect(gdsParsed[0]).toMatchObject({
      direction: "ONWARD",
      sortOrder: 0,
      departureAirportCode: "CGK",
      arrivalAirportCode: "DOH",
      carrierCode: "QR",
      flightNumber: "QR-957",
      departureDate: "2026-11-12",
      departureTime: "18:30",
      arrivalDate: "2026-11-12",
      arrivalTime: "23:00",
    });
    expect(gdsParsed[1]).toMatchObject({
      direction: "ONWARD",
      sortOrder: 1,
      departureAirportCode: "DOH",
      arrivalAirportCode: "JED",
      flightNumber: "QR-1188",
      departureDate: "2026-11-13",
    });
    expect(gdsParsed[2]).toMatchObject({
      direction: "RETURN",
      sortOrder: 0,
      departureAirportCode: "JED",
      arrivalAirportCode: "DOH",
      flightNumber: "QR-1189",
      departureDate: "2026-11-20",
    });
    expect(gdsParsed[3]).toMatchObject({
      direction: "RETURN",
      sortOrder: 1,
      departureAirportCode: "DOH",
      arrivalAirportCode: "CGK",
      flightNumber: "QR-956",
      departureDate: "2026-11-21",
    });

    const waParsed = parseFlightScheduleText(
      "✈️ *Flight Detail*\nMADINAH / GA-980 / 17.40 / 13 OCT 2026\nJEDDAH / GA-981 / 19.40 / 20 OCT 2026",
    );
    expect(waParsed).toHaveLength(2);
    expect(waParsed[0]).toMatchObject({
      direction: "ONWARD",
      arrivalAirportCode: "MED",
      flightNumber: "GA-980",
      arrivalDate: "2026-10-13",
      arrivalTime: "17:40",
    });
    expect(waParsed[1]).toMatchObject({
      direction: "RETURN",
      departureAirportCode: "JED",
      flightNumber: "GA-981",
      departureDate: "2026-10-20",
      departureTime: "19:40",
    });
  });

  it("mirrors onward transit routes into return legs and calculates overnight arrival dates", () => {
    expect(computeAutoArrivalDate("2026-11-12", "19:30", "01:15")).toBe("2026-11-13");
    expect(computeAutoArrivalDate("2026-11-12", "11:50", "17:40")).toBe("2026-11-12");
    expect(extractCarrierAndFlightNumber("sv 817")).toEqual({ carrierCode: "SV", flightNumber: "SV-817" });

    const mirrored = buildMirroredReturnLegs(
      [
        {
          ...createEmptyFlightLeg("ONWARD", 0),
          departureAirportCode: "CGK",
          arrivalAirportCode: "DOH",
          flightNumber: "QR-957",
        },
        {
          ...createEmptyFlightLeg("ONWARD", 1),
          departureAirportCode: "DOH",
          arrivalAirportCode: "JED",
          flightNumber: "QR-1188",
        },
      ],
      "2026-11-20",
    );

    expect(mirrored).toHaveLength(2);
    expect(mirrored[0]).toMatchObject({
      direction: "RETURN",
      sortOrder: 0,
      departureAirportCode: "JED",
      arrivalAirportCode: "DOH",
      carrierCode: "QR",
      departureDate: "2026-11-20",
    });
    expect(mirrored[1]).toMatchObject({
      direction: "RETURN",
      sortOrder: 1,
      departureAirportCode: "DOH",
      arrivalAirportCode: "CGK",
      carrierCode: "QR",
    });
  });
});
