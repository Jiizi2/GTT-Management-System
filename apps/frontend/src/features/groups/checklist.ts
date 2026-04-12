import { getLocalIsoDateWithOffset, parseDisplayDateToIso, parseTimeForInput } from "../../shared/app-domain-core.js";
import type { ChecklistItem, GroupData, ItineraryItem } from "../../shared/app-domain-types.js";
import { resolveTotalBusCount } from "./options.js";
import {
  expandTransferTrainItineraryItems,
  formatRouteSummary,
  formatScheduleTime,
  getScheduleTypeOption,
  inferCategoryKey,
  inferCityTourCity,
} from "./itinerary.js";

export function getChecklistRangeDates(): string[] {
  return [getLocalIsoDateWithOffset(0), getLocalIsoDateWithOffset(1), getLocalIsoDateWithOffset(2)];
}

export function getChecklistDayLabel(tripDate: string): string {
  if (!tripDate) {
    return "-";
  }

  const date = new Date(`${tripDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return tripDate;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatChecklistCopyDate(tripDate: string): string {
  if (!tripDate) {
    return "-";
  }

  const date = new Date(`${tripDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return tripDate.toUpperCase();
  }

  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

export function buildChecklistActivityLabel(item: ItineraryItem, categoryKey: string): string {
  const baseCategory = item.category?.trim() || "Activity";
  if (categoryKey !== "city-tour") {
    return baseCategory;
  }

  const cityTourCity = inferCityTourCity(item);
  if (!cityTourCity) {
    return baseCategory;
  }

  return baseCategory.toLowerCase().includes(cityTourCity.toLowerCase())
    ? baseCategory
    : `${baseCategory} ${cityTourCity}`;
}

export function buildChecklistItemsFromGroups(groups: GroupData[]): ChecklistItem[] {
  const allowedDateSet = new Set(getChecklistRangeDates());
  const result: ChecklistItem[] = [];

  groups.forEach((group) => {
    const normalizedItinerary = expandTransferTrainItineraryItems(group.itinerary);

    normalizedItinerary.forEach((item, index) => {
      const tripDate = item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
      if (!tripDate || !allowedDateSet.has(tripDate)) {
        return;
      }

      const categoryKey = inferCategoryKey(item);
      const typeOption = getScheduleTypeOption(categoryKey);
      const parsedTime = item.time ?? parseTimeForInput(item.meta.split(" | ")[0] ?? "");
      const normalizedTime = parsedTime ? formatScheduleTime(parsedTime) : "TBD";
      const transferByTrain = categoryKey === "transfer" && (item.transferByTrain ?? false);
      const isDepartureActivity = categoryKey === "departure";
      const requiredBusCount = resolveTotalBusCount(group.pax, group.totalBuses);
      const trainDepartureSource = item.trainDepartureTime ?? (transferByTrain ? parsedTime : "");
      const stationPickupSource = item.destinationPickupTime ?? "";
      const hotelPickupRequestSource = isDepartureActivity ? item.hotelPickupRequestTime ?? "" : "";
      const trainDepartureTime = trainDepartureSource
        ? formatScheduleTime(trainDepartureSource)
        : "TBD";
      const stationPickupTime = stationPickupSource ? formatScheduleTime(stationPickupSource) : "TBD";
      const hotelPickupRequestTime = hotelPickupRequestSource
        ? formatScheduleTime(hotelPickupRequestSource)
        : "";
      const departureFlightTime = isDepartureActivity ? normalizedTime : "";
      const scheduledTime = transferByTrain
        ? trainDepartureTime
        : hotelPickupRequestTime || normalizedTime;

      result.push({
        id: `${group.code}-${tripDate}-${index}-${categoryKey}`,
        groupCode: group.code,
        groupName: group.name,
        groupPax: group.pax,
        tripDate,
        activity: buildChecklistActivityLabel(item, categoryKey),
        trip:
          item.from && item.to
            ? formatRouteSummary(categoryKey, item.from, item.to, item.cityTourCity)
            : item.title,
        activityIcon: typeOption.icon,
        requiredBusCount,
        scheduledTime,
        transferByTrain,
        trainDepartureTime: transferByTrain ? trainDepartureTime : "",
        stationPickupTime: transferByTrain ? stationPickupTime : "",
        hotelPickupRequestTime,
        departureFlightTime,
      });
    });
  });

  return result.sort((left, right) => {
    const leftKey = `${left.tripDate} ${left.scheduledTime}`;
    const rightKey = `${right.tripDate} ${right.scheduledTime}`;
    return leftKey.localeCompare(rightKey);
  });
}
