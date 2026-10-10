import type { FlightDirection, GroupData, ItineraryItem } from "./app-domain-types";
import { getFlightLegsByDirection, hasFlightLegContent } from "./flight-plan";
import { formatRouteSummary, getSaudiCityOptions } from "./itinerary-domain";
import { findSaudiAirport } from "./saudi-airports";

export type ResolvedGroupFlight = {
  city: string;
  flightNumber: string;
  date: string;
  time: string;
  displayDate?: string;
  year?: string;
  source: "legs" | "legacy" | "itinerary";
};

export type FlightSummaryOptions = {
  allowItineraryFallback?: Partial<Record<FlightDirection, boolean>>;
};

export function selectGroupForFlightCopy(
  group: GroupData | null,
  operationalGroup: GroupData | null,
): GroupData | undefined {
  const setup = group?.visaSetup;
  const hasOwnFlight = Boolean(
    setup?.flightLegs?.some(hasFlightLegContent) ||
    setup?.arrivalFlightNumber ||
    setup?.departureFlightNumber ||
    setup?.arrivalFlightDate ||
    setup?.departureFlightDate ||
    setup?.arrivalTime ||
    setup?.departureTime,
  );
  return (hasOwnFlight ? group : (operationalGroup ?? group)) ?? undefined;
}

function categoryOf(item: ItineraryItem): string {
  return (item.categoryKey || item.category || "").toLowerCase();
}

function legacyAirportCity(item: ItineraryItem | undefined, direction: FlightDirection): string {
  if (!item) return "";
  const primary = direction === "ONWARD" ? item.from : item.to;
  const airport = findSaudiAirport(primary);
  if (airport) return airport.city;
  const legacyCity = getSaudiCityOptions().find((city) => city.toLowerCase() === primary?.trim().toLowerCase());
  if (legacyCity) return legacyCity;
  // Older itineraries sometimes stored the international route instead of the
  // Saudi ground route. Only use the other end when both are explicit IATA codes;
  // a hotel destination must never be used to guess the landing airport.
  const other = direction === "ONWARD" ? item.to : item.from;
  if (/^[A-Z]{3}$/i.test(primary?.trim() ?? "") && /^[A-Z]{3}$/i.test(other?.trim() ?? "")) {
    return findSaudiAirport(other)?.city ?? "";
  }
  return "";
}

export function resolveGroupFlightSummary(
  group: GroupData,
  options: FlightSummaryOptions = {},
): {
  arrival?: ResolvedGroupFlight;
  departure?: ResolvedGroupFlight;
} {
  const setup = group.visaSetup;
  const resolve = (direction: FlightDirection): ResolvedGroupFlight | undefined => {
    const category = direction === "ONWARD" ? "arrival" : "departure";
    const item =
      options.allowItineraryFallback?.[direction] === false
        ? undefined
        : group.itinerary?.find(
            (candidate) =>
              categoryOf(candidate) === category && (!candidate.transportMode || candidate.transportMode === "flight"),
          );
    const legs = getFlightLegsByDirection(setup?.flightLegs ?? [], direction).filter(hasFlightLegContent);
    const leg = direction === "ONWARD" ? legs.at(-1) : legs[0];
    if (leg) {
      const airportCode = direction === "ONWARD" ? leg.arrivalAirportCode : leg.departureAirportCode;
      const hasRoute = legs.some(
        (candidate) => candidate.departureAirportCode.trim() || candidate.arrivalAirportCode.trim(),
      );
      return {
        city: findSaudiAirport(airportCode)?.city ?? (hasRoute ? "" : legacyAirportCity(item, direction)),
        flightNumber: leg.flightNumber.trim(),
        date: (direction === "ONWARD"
          ? leg.arrivalDate || leg.departureDate
          : leg.departureDate || leg.arrivalDate
        ).trim(),
        time: (direction === "ONWARD" ? leg.arrivalTime : leg.departureTime).trim(),
        source: "legs",
      };
    }
    const number = direction === "ONWARD" ? setup?.arrivalFlightNumber : setup?.departureFlightNumber;
    const date = direction === "ONWARD" ? setup?.arrivalFlightDate : setup?.departureFlightDate;
    const time = direction === "ONWARD" ? setup?.arrivalTime : setup?.departureTime;
    if (!number && !date && !time && !item) return undefined;
    return {
      city: legacyAirportCity(item, direction),
      flightNumber: number?.trim() || item?.flightNumber?.trim() || "",
      date: date?.trim() || item?.isoDate?.trim() || "",
      time: time?.trim() || item?.time?.trim() || "",
      displayDate: item?.date,
      year: item?.year,
      source: number || date || time ? "legacy" : "itinerary",
    };
  };
  return { arrival: resolve("ONWARD"), departure: resolve("RETURN") };
}

/** Project flight-owned airport cities into the ground itinerary, including old
 * records read before they have been saved again. Do not alter land transport. */
export function synchronizeItineraryFlightCities(group: GroupData): GroupData {
  const summary = resolveGroupFlightSummary(group);
  let changed = false;
  const itinerary = group.itinerary.map((item) => {
    const category = categoryOf(item);
    if ((category !== "arrival" && category !== "departure") || (item.transportMode && item.transportMode !== "flight"))
      return item;
    const direction = category === "arrival" ? "ONWARD" : "RETURN";
    const hasRoute = (group.visaSetup?.flightLegs ?? []).some(
      (leg) => leg.direction === direction && (leg.departureAirportCode.trim() || leg.arrivalAirportCode.trim()),
    );
    if (!hasRoute) return item;
    const city = (category === "arrival" ? summary.arrival : summary.departure)?.city ?? "";
    const from = category === "arrival" ? city : (item.from ?? "");
    const to = category === "departure" ? city : (item.to ?? "");
    if (from === (item.from ?? "") && to === (item.to ?? "")) return item;
    changed = true;
    return { ...item, from, to, title: formatRouteSummary(category, from, to, item.cityTourCity ?? "") };
  });
  return changed ? { ...group, itinerary } : group;
}
