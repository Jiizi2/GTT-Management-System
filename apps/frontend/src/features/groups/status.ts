import { getItineraryIsoDate, getLocalIsoDateWithOffset, parseTimeForInput, resolveItineraryBoundaryIsoDates } from "../../shared/app-domain-core.js";
import type { GroupData, ItineraryItem, NextActivity, StatusTone, TimelineItem } from "../../shared/app-domain-types.js";
import { isIsoDateValue, shiftIsoDate } from "../visa/domain.js";
import { resolveTotalBusCount } from "./options.js";
import {
  expandTransferTrainItineraryItems,
  formatRouteSummary,
  formatScheduleDate,
  formatScheduleTime,
  getScheduleTypeOption,
  inferCategoryKey,
} from "./itinerary.js";

export function getStatusByTone(tone: StatusTone): string {
  if (tone === "active") {
    return "Active";
  }

  return "In Active";
}

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

export function includesKnownKeyword(value: string, keywords: string[]): boolean {
  const normalizedValue = value.toLowerCase();
  return keywords.some((keyword) => normalizedValue.includes(keyword));
}

export function resolveGroupToneByItinerary(itinerary: ItineraryItem[]): StatusTone {
  if (itinerary.length === 0) {
    return "inactive";
  }

  const latestItem = [...itinerary].sort((left, right) => {
    const leftDate = left.isoDate ?? getItineraryIsoDate(left);
    const rightDate = right.isoDate ?? getItineraryIsoDate(right);
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

function sortItineraryForOverview(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((left, right) => {
    const leftDate = getItineraryIsoDate(left) || "9999-12-31";
    const rightDate = getItineraryIsoDate(right) || "9999-12-31";
    const leftMetaTime = parseTimeForInput(left.meta.split(" | ")[0] ?? "");
    const rightMetaTime = parseTimeForInput(right.meta.split(" | ")[0] ?? "");
    const leftTime = left.time?.trim() || leftMetaTime || "00:00";
    const rightTime = right.time?.trim() || rightMetaTime || "00:00";
    const leftKey = `${leftDate}T${leftTime}`;
    const rightKey = `${rightDate}T${rightTime}`;
    return leftKey.localeCompare(rightKey);
  });
}

function resolveItineraryOverviewDate(item: ItineraryItem): string {
  const isoDate = getItineraryIsoDate(item);
  if (!isoDate) {
    return item.date || "-";
  }

  return formatScheduleDate(isoDate).date;
}

function resolveItineraryOverviewTime(item: ItineraryItem): string {
  const fallbackMetaTime = parseTimeForInput(item.meta.split(" | ")[0] ?? "");
  const rawTime = item.time?.trim() || fallbackMetaTime;
  if (!rawTime) {
    return "";
  }

  const normalizedTime = formatScheduleTime(rawTime);
  return normalizedTime === "TBD" ? "" : normalizedTime;
}

function resolveItineraryOverviewSummary(item: ItineraryItem): string {
  const from = item.from?.trim() ?? "";
  const to = item.to?.trim() ?? "";
  if (from && to) {
    return formatRouteSummary(inferCategoryKey(item), from, to, item.cityTourCity ?? "");
  }

  return item.title.trim() || "Activity detail pending";
}

function buildOverviewSnapshotFromItinerary(
  itinerary: ItineraryItem[],
  currentGroup: GroupData,
): { timeline: [TimelineItem, TimelineItem]; nextActivity: NextActivity } {
  const sortedItems = sortItineraryForOverview(itinerary);
  const firstItem = sortedItems[0];

  if (!firstItem) {
    return {
      timeline: currentGroup.timeline,
      nextActivity: currentGroup.nextActivity,
    };
  }

  const secondItem = sortedItems[1];
  const firstTypeOption = getScheduleTypeOption(inferCategoryKey(firstItem));
  const firstDateLabel = resolveItineraryOverviewDate(firstItem);
  const firstSummary = resolveItineraryOverviewSummary(firstItem);
  const firstTime = resolveItineraryOverviewTime(firstItem);

  const timelineFirst: TimelineItem = {
    date: firstDateLabel,
    title: `${firstTypeOption.cardLabel} | ${firstSummary}`,
  };

  const timelineSecond: TimelineItem = secondItem
    ? (() => {
        const secondTypeOption = getScheduleTypeOption(inferCategoryKey(secondItem));
        const secondDateLabel = resolveItineraryOverviewDate(secondItem);
        const secondSummary = resolveItineraryOverviewSummary(secondItem);
        const secondTime = resolveItineraryOverviewTime(secondItem);
        const secondTimelineActivity =
          secondTime && secondTime.length > 0
            ? `${secondTime}${secondItem.requiresBus ? " | Requires Bus" : ""}`
            : "Awaiting operator update";

        return {
          date: secondDateLabel,
          title: `${secondTypeOption.cardLabel} | ${secondSummary}`,
          isCurrent: true,
          nextActivity: secondTimelineActivity,
        };
      })()
    : {
        date: firstDateLabel,
        title: "Next activity to be confirmed",
        isCurrent: true,
        nextActivity: "Awaiting operator update",
      };

  return {
    timeline: [timelineFirst, timelineSecond],
    nextActivity: {
      title: `${firstTypeOption.cardLabel}: ${firstSummary}`,
      date: firstDateLabel,
      time: firstTime,
      icon: firstItem.icon?.trim() || firstTypeOption.icon,
    },
  };
}

export function normalizeGroupStatus(group: GroupData): GroupData {
  const normalizedItinerary = expandTransferTrainItineraryItems(group.itinerary);
  const { earliestIsoDate, latestIsoDate } = resolveItineraryBoundaryIsoDates(normalizedItinerary);
  const currentArrivalDate = group.arrivalDate?.trim() ?? "";
  const currentReturnDate = group.returnDate?.trim() ?? "";
  const normalizedArrivalDate = isIsoDateValue(currentArrivalDate)
    ? currentArrivalDate
    : earliestIsoDate ?? getLocalIsoDateWithOffset(0);
  const fallbackReturnDate =
    latestIsoDate ?? shiftIsoDate(normalizedArrivalDate, Math.max(1, group.durationDays - 1));
  const normalizedReturnDateCandidate = isIsoDateValue(currentReturnDate)
    ? currentReturnDate
    : fallbackReturnDate;
  const normalizedReturnDate =
    normalizedReturnDateCandidate >= normalizedArrivalDate
      ? normalizedReturnDateCandidate
      : normalizedArrivalDate;
  const tone = resolveGroupToneByItinerary(normalizedItinerary);
  const overviewSnapshot = buildOverviewSnapshotFromItinerary(normalizedItinerary, group);
  return {
    ...group,
    arrivalDate: normalizedArrivalDate,
    returnDate: normalizedReturnDate,
    itinerary: normalizedItinerary,
    timeline: overviewSnapshot.timeline,
    nextActivity: overviewSnapshot.nextActivity,
    tone,
    status: getStatusByTone(tone),
    totalBuses: resolveTotalBusCount(group.pax, group.totalBuses),
  };
}
