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
    .map((leg) => {
      const rawFlight = leg.flightNumber.trim().toUpperCase();
      const rawCarrier = leg.carrierCode.trim().toUpperCase();
      const flightCodeMatch = /^([A-Z]{2}|\d[A-Z]|[A-Z]\d)[\s-]*(\d{1,4}[A-Z]?)$/.exec(rawFlight);
      const normalizedFlightNumber = flightCodeMatch ? `${flightCodeMatch[1]}-${flightCodeMatch[2]}` : rawFlight;
      const normalizedCarrierCode = rawCarrier || (flightCodeMatch ? flightCodeMatch[1]! : "");

      const departureDate = leg.departureDate.trim();
      const departureTime = leg.departureTime.trim();
      const arrivalTime = leg.arrivalTime.trim();
      let arrivalDate = leg.arrivalDate.trim();

      if (!arrivalDate && /^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
        const isOvernight =
          /^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime) &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(arrivalTime) &&
          arrivalTime < departureTime;
        if (isOvernight) {
          const nextDay = new Date(`${departureDate}T12:00:00.000Z`);
          nextDay.setUTCDate(nextDay.getUTCDate() + 1);
          arrivalDate = nextDay.toISOString().slice(0, 10);
        } else {
          arrivalDate = departureDate;
        }
      }

      return {
        ...leg,
        sortOrder: directionCounts[leg.direction]++,
        departureAirportCode: leg.departureAirportCode.trim().toUpperCase(),
        arrivalAirportCode: leg.arrivalAirportCode.trim().toUpperCase(),
        departureDate,
        departureTime,
        arrivalDate,
        arrivalTime,
        carrierCode: normalizedCarrierCode,
        flightNumber: normalizedFlightNumber,
        remarks: leg.remarks.trim(),
      };
    });
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
