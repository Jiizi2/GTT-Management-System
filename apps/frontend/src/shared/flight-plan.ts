import type { FlightDirection, GroupFlightLeg, GroupVisaSetup } from "./app-domain-types";

export function createEmptyFlightLeg(direction: FlightDirection, sortOrder = 0): GroupFlightLeg {
  return {
    direction,
    sortOrder,
    departureAirportCode: "",
    arrivalAirportCode: "",
    departureDate: "",
    departureTime: "",
    arrivalDate: "",
    arrivalTime: "",
    carrierCode: "",
    flightNumber: "",
    remarks: "",
  };
}

export function hasFlightLegContent(leg: GroupFlightLeg): boolean {
  return Boolean(
    leg.departureAirportCode.trim() ||
      leg.arrivalAirportCode.trim() ||
      leg.departureDate.trim() ||
      leg.departureTime.trim() ||
      leg.arrivalDate.trim() ||
      leg.arrivalTime.trim() ||
      leg.carrierCode.trim() ||
      leg.flightNumber.trim() ||
      leg.remarks.trim(),
  );
}

export function normalizeFlightLegs(legs: GroupFlightLeg[]): GroupFlightLeg[] {
  const directionCounts: Record<FlightDirection, number> = { ONWARD: 0, RETURN: 0 };
  return legs
    .filter(hasFlightLegContent)
    .map((leg) => ({
      ...leg,
      sortOrder: directionCounts[leg.direction]++,
      departureAirportCode: leg.departureAirportCode.trim().toUpperCase(),
      arrivalAirportCode: leg.arrivalAirportCode.trim().toUpperCase(),
      departureDate: leg.departureDate.trim(),
      departureTime: leg.departureTime.trim(),
      arrivalDate: leg.arrivalDate.trim(),
      arrivalTime: leg.arrivalTime.trim(),
      carrierCode: leg.carrierCode.trim().toUpperCase(),
      flightNumber: leg.flightNumber.trim().toUpperCase(),
      remarks: leg.remarks.trim(),
    }));
}

export function getFlightLegsByDirection(legs: GroupFlightLeg[], direction: FlightDirection): GroupFlightLeg[] {
  return legs
    .filter((leg) => leg.direction === direction)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function deriveLegacyFlightSummary(flightLegs: GroupFlightLeg[]): Pick<
  GroupVisaSetup,
  | "arrivalFlightNumber"
  | "arrivalFlightDate"
  | "arrivalTime"
  | "departureFlightNumber"
  | "departureFlightDate"
  | "departureTime"
> {
  const onward = getFlightLegsByDirection(flightLegs, "ONWARD");
  const returning = getFlightLegsByDirection(flightLegs, "RETURN");
  const arrivalLeg = onward.at(-1);
  const departureLeg = returning[0];
  return {
    arrivalFlightNumber: arrivalLeg?.flightNumber ?? "",
    arrivalFlightDate: arrivalLeg?.arrivalDate || arrivalLeg?.departureDate || "",
    arrivalTime: arrivalLeg?.arrivalTime ?? "",
    departureFlightNumber: departureLeg?.flightNumber ?? "",
    departureFlightDate: departureLeg?.departureDate || departureLeg?.arrivalDate || "",
    departureTime: departureLeg?.departureTime ?? "",
  };
}

export function createLegacyFlightLegs(visaSetup: GroupVisaSetup | undefined): GroupFlightLeg[] {
  if (!visaSetup) return [];
  const legs: GroupFlightLeg[] = [];
  if (visaSetup.arrivalFlightNumber || visaSetup.arrivalFlightDate || visaSetup.arrivalTime) {
    legs.push({
      ...createEmptyFlightLeg("ONWARD"),
      flightNumber: visaSetup.arrivalFlightNumber ?? "",
      arrivalDate: visaSetup.arrivalFlightDate ?? "",
      arrivalTime: visaSetup.arrivalTime ?? "",
    });
  }
  if (visaSetup.departureFlightNumber || visaSetup.departureFlightDate || visaSetup.departureTime) {
    legs.push({
      ...createEmptyFlightLeg("RETURN"),
      flightNumber: visaSetup.departureFlightNumber ?? "",
      departureDate: visaSetup.departureFlightDate ?? "",
      departureTime: visaSetup.departureTime ?? "",
    });
  }
  return legs;
}
