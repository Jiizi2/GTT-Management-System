import type { ItineraryItem, StatusTone } from "./app-domain-types";
import { isIsoDateValue } from "./visa-domain.js";

export const saudiLocationKeywords = [
  "saudi",
  "makkah",
  "madinah",
  "jeddah",
  "jed",
  "med",
  "haram",
  "rawdah",
  "jabal",
];

export const nonSaudiLocationKeywords = [
  "jakarta",
  "surabaya",
  "bandung",
  "medan",
  "indonesia",
  "cgk",
  "soekarno",
  "soetta",
  "terminal 3",
];

export function getStatusByTone(tone: StatusTone): string {
  if (tone === "active") {
    return "Active";
  }

  return "In Active";
}

export function includesKnownKeyword(value: string, keywords: string[]): boolean {
  const normalizedValue = value.toLowerCase();
  return keywords.some((keyword) => normalizedValue.includes(keyword));
}

function parseDisplayDateToIsoForStatus(date: string, year: string): string {
  if (!date || !year) {
    return "";
  }

  const [day, monthLabel] = date.split(" ");
  const monthMap: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const month = monthMap[monthLabel];
  if (!month) {
    return "";
  }

  return `${year}-${month}-${String(Number(day)).padStart(2, "0")}`;
}

function parseTimeForStatus(value: string): string {
  if (!value) {
    return "";
  }

  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return "";
  }

  const [, rawHour, minute, rawSuffix] = match;
  let hour = Number(rawHour);
  const suffix = rawSuffix.toUpperCase();

  if (suffix === "PM" && hour !== 12) {
    hour += 12;
  }

  if (suffix === "AM" && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function getItineraryIsoDateForStatus(item: ItineraryItem): string {
  return item.isoDate ?? parseDisplayDateToIsoForStatus(item.date, item.year);
}

export function resolveGroupToneByItinerary(itinerary: ItineraryItem[]): StatusTone {
  if (itinerary.length === 0) {
    return "inactive";
  }

  const latestItem = [...itinerary].sort((left, right) => {
    const leftDate = left.isoDate ?? parseDisplayDateToIsoForStatus(left.date, left.year);
    const rightDate = right.isoDate ?? parseDisplayDateToIsoForStatus(right.date, right.year);
    const leftKey = `${leftDate}T${left.time ?? "00:00"}`;
    const rightKey = `${rightDate}T${right.time ?? "00:00"}`;
    return leftKey.localeCompare(rightKey);
  })[itinerary.length - 1];

  if (!latestItem) {
    return "inactive";
  }

  const routeHint = [latestItem.to, latestItem.from, latestItem.title, latestItem.meta]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasSaudiKeyword = includesKnownKeyword(routeHint, saudiLocationKeywords);
  const hasNonSaudiKeyword = includesKnownKeyword(routeHint, nonSaudiLocationKeywords);

  if (hasSaudiKeyword) {
    return "active";
  }

  if (hasNonSaudiKeyword) {
    return "inactive";
  }

  return "inactive";
}

function hasCurrentOrUpcomingItinerary(itinerary: ItineraryItem[], now: Date): boolean | null {
  const nowMs = now.getTime();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStartMs = today.getTime();
  let hasComparableItem = false;

  for (const item of itinerary) {
    const itineraryIsoDate = getItineraryIsoDateForStatus(item).trim();
    if (!isIsoDateValue(itineraryIsoDate)) {
      continue;
    }

    hasComparableItem = true;

    const normalizedTime =
      parseTimeForStatus(item.time?.trim() ?? "") || parseTimeForStatus(item.meta.split(" | ")[0] ?? "");
    if (normalizedTime) {
      const parsedDateTime = Date.parse(`${itineraryIsoDate}T${normalizedTime}:00`);
      if (Number.isFinite(parsedDateTime) && parsedDateTime >= nowMs) {
        return true;
      }

      continue;
    }

    const parsedDateOnly = Date.parse(`${itineraryIsoDate}T00:00:00`);
    if (Number.isFinite(parsedDateOnly) && parsedDateOnly >= todayStartMs) {
      return true;
    }
  }

  return hasComparableItem ? false : null;
}

export function resolveCurrentGroupTone(
  fallbackTone: StatusTone,
  itinerary: ItineraryItem[],
  now: Date = new Date(),
): StatusTone {
  return hasCurrentOrUpcomingItinerary(itinerary, now) === false ? "inactive" : fallbackTone;
}
