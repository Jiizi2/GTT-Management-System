import type { ItineraryItem } from "../../../shared/app-domain";
import {
  formatScheduleTime,
  getTransportModeIcon,
  resolveTransportMode,
  TRANSPORT_MODE_META,
} from "../../../shared/app-domain";

export type ItineraryFact = {
  icon: string;
  label: string;
  value: string;
};

function valueOrNotSet(value?: string): string {
  return value?.trim() || "Not set";
}

function formatLocalTime(value?: string): string {
  const trimmedValue = value?.trim() ?? "";
  if (!trimmedValue) {
    return "Not set";
  }

  const normalizedValue = trimmedValue.toLowerCase();
  if (
    normalizedValue.includes("wib") ||
    normalizedValue.includes("wita") ||
    normalizedValue.includes("wit") ||
    /\blt\b/.test(normalizedValue)
  ) {
    return trimmedValue;
  }

  const formattedTime = formatScheduleTime(trimmedValue);
  return formattedTime === "TBD" ? "Not set" : `${formattedTime} LT`;
}

function buildRoute(item: ItineraryItem): string {
  const route = [item.from?.trim(), item.to?.trim()].filter(Boolean).join(" → ");
  return route || item.title.trim();
}

export function buildItinerarySummary(item: ItineraryItem, categoryKey: string): string {
  if (categoryKey === "city-tour") {
    const route = [item.from?.trim(), item.to?.trim()].filter(Boolean).join(" → ");
    if (route) {
      return route;
    }

    const destination = item.cityTourCity?.trim() || item.to?.trim() || item.from?.trim();
    return destination ? `City Tour · ${destination}` : item.title;
  }

  return buildRoute(item);
}

export function buildItineraryFacts(item: ItineraryItem, categoryKey: string): ItineraryFact[] {
  const transportMode = resolveTransportMode(item);
  const transportFact: ItineraryFact = {
    icon: getTransportModeIcon(transportMode, categoryKey),
    label: "Transportation",
    value: TRANSPORT_MODE_META[transportMode].label,
  };

  if (categoryKey === "arrival") {
    return [
      transportMode === "flight"
        ? { icon: "confirmation_number", label: "Flight Number", value: valueOrNotSet(item.flightNumber) }
        : transportFact,
      { icon: "schedule", label: "Arrival Time", value: formatLocalTime(item.time) },
      { icon: "hotel", label: "Destination Hotel", value: valueOrNotSet(item.hotelName) },
    ];
  }

  if (categoryKey === "departure") {
    const facts: ItineraryFact[] = [
      transportMode === "flight"
        ? { icon: "confirmation_number", label: "Flight Number", value: valueOrNotSet(item.flightNumber) }
        : transportFact,
      { icon: "schedule", label: "Departure Time", value: formatLocalTime(item.time) },
      { icon: "hotel", label: "Origin Hotel", value: valueOrNotSet(item.hotelName) },
    ];

    if (item.hotelPickupRequestTime?.trim()) {
      facts.push({
        icon: "airport_shuttle",
        label: "Hotel Pickup",
        value: formatLocalTime(item.hotelPickupRequestTime),
      });
    }

    return facts;
  }

  if (categoryKey === "transfer") {
    const normalizedCategory = item.category.toLowerCase();
    const isDestinationPickupSegment =
      normalizedCategory.includes("station pickup") || normalizedCategory.includes("train arrival");
    const isTrain = transportMode === "train";
    const facts: ItineraryFact[] = [
      {
        icon: getTransportModeIcon(transportMode, categoryKey),
        label: "Transportation",
        value: isTrain ? "High-speed train" : "Bus",
      },
      {
        icon: "schedule",
        label: isDestinationPickupSegment ? "Station Pickup" : isTrain ? "Train Departure" : "Departure Time",
        value: formatLocalTime(
          isDestinationPickupSegment ? item.time || item.destinationPickupTime : item.trainDepartureTime || item.time,
        ),
      },
    ];

    if (!isDestinationPickupSegment && item.destinationPickupTime?.trim()) {
      facts.push({
        icon: "location_on",
        label: "Destination Pickup",
        value: formatLocalTime(item.destinationPickupTime),
      });
    }

    if (item.hotelName?.trim()) {
      facts.push({ icon: "hotel", label: "Destination Hotel", value: item.hotelName.trim() });
    }

    return facts;
  }

  const facts: ItineraryFact[] = [
    { icon: "schedule", label: "Start Time", value: formatLocalTime(item.time) },
    {
      icon: "location_on",
      label: categoryKey === "city-tour" ? "Tour Area" : "Destination",
      value: valueOrNotSet(item.cityTourCity || item.to || item.from),
    },
  ];

  if (item.hotelName?.trim()) {
    facts.push({ icon: "hotel", label: "Pickup Hotel", value: item.hotelName.trim() });
  }

  if (item.requiresBus) {
    facts.push({ icon: "directions_bus", label: "Transportation", value: "Bus" });
  }

  return facts;
}
