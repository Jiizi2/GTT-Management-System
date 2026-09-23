import { BadRequestException } from "@nestjs/common";
import { FlightDirection } from "@prisma/client";
import { CreateGroupDto } from "../dto/create-group.dto";

function normalizedCode(value?: string): string {
  return value?.trim().toUpperCase() ?? "";
}

function timestamp(date?: string, time?: string): number | null {
  const normalizedDate = date?.trim() ?? "";
  const normalizedTime = time?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime)) {
    return null;
  }
  const parsed = Date.parse(`${normalizedDate}T${normalizedTime}:00Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

export function validateFlightLegRules(payload: CreateGroupDto): void {
  const legs = payload.visaSetup?.flightLegs ?? [];
  for (const leg of legs) {
    const from = normalizedCode(leg.departureAirportCode);
    const to = normalizedCode(leg.arrivalAirportCode);
    if (from && !/^[A-Z]{3}$/.test(from)) {
      throw new BadRequestException("Flight departure airport must use a 3-letter IATA code.");
    }
    if (to && !/^[A-Z]{3}$/.test(to)) {
      throw new BadRequestException("Flight arrival airport must use a 3-letter IATA code.");
    }
    if (from && to && from === to) {
      throw new BadRequestException("Flight departure and arrival airports must be different.");
    }

    const departureAt = timestamp(leg.departureDate, leg.departureTime);
    const arrivalAt = timestamp(leg.arrivalDate, leg.arrivalTime);
    if (departureAt !== null && arrivalAt !== null && arrivalAt < departureAt) {
      throw new BadRequestException("Flight arrival cannot be earlier than its departure.");
    }
  }

  for (const direction of [FlightDirection.ONWARD, FlightDirection.RETURN]) {
    const directionLegs = legs
      .filter((leg) => leg.direction === direction)
      .sort((left, right) => left.sortOrder - right.sortOrder);
    const seenOrders = new Set<number>();
    directionLegs.forEach((leg, index) => {
      if (seenOrders.has(leg.sortOrder)) {
        throw new BadRequestException(`Flight ${direction.toLowerCase()} leg order must be unique.`);
      }
      seenOrders.add(leg.sortOrder);

      const next = directionLegs[index + 1];
      const destination = normalizedCode(leg.arrivalAirportCode);
      const nextOrigin = normalizedCode(next?.departureAirportCode);
      if (next && destination && nextOrigin && destination !== nextOrigin) {
        throw new BadRequestException(
          `Flight ${direction.toLowerCase()} route is disconnected between ${destination} and ${nextOrigin}.`,
        );
      }
    });
  }
}
