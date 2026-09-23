import { BadRequestException } from "@nestjs/common";
import { FlightDirection } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { CreateGroupDto } from "../dto/create-group.dto";
import { validateFlightLegRules } from "./groups.flight-leg-validation";

function payload(flightLegs: NonNullable<NonNullable<CreateGroupDto["visaSetup"]>["flightLegs"]>): CreateGroupDto {
  return { visaSetup: { flightLegs } } as CreateGroupDto;
}

describe("validateFlightLegRules", () => {
  it("accepts a connected transit route and an overnight leg", () => {
    expect(() => validateFlightLegRules(payload([
      {
        direction: FlightDirection.ONWARD,
        sortOrder: 0,
        departureAirportCode: "CGK",
        arrivalAirportCode: "DOH",
        departureDate: "2026-09-20",
        departureTime: "18:00",
        arrivalDate: "2026-09-20",
        arrivalTime: "23:00",
      },
      {
        direction: FlightDirection.ONWARD,
        sortOrder: 1,
        departureAirportCode: "DOH",
        arrivalAirportCode: "JED",
        departureDate: "2026-09-21",
        departureTime: "01:00",
        arrivalDate: "2026-09-21",
        arrivalTime: "03:30",
      },
    ]))).not.toThrow();
  });

  it("rejects disconnected transit routes", () => {
    expect(() => validateFlightLegRules(payload([
      { direction: FlightDirection.ONWARD, sortOrder: 0, departureAirportCode: "CGK", arrivalAirportCode: "DOH" },
      { direction: FlightDirection.ONWARD, sortOrder: 1, departureAirportCode: "DXB", arrivalAirportCode: "JED" },
    ]))).toThrow(BadRequestException);
  });

  it("rejects invalid IATA airport codes", () => {
    expect(() => validateFlightLegRules(payload([
      { direction: FlightDirection.RETURN, sortOrder: 0, departureAirportCode: "JEDDAH", arrivalAirportCode: "CGK" },
    ]))).toThrow("3-letter IATA code");
  });
});
