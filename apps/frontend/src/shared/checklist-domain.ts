import type { ChecklistItem, GroupData, ItineraryItem, TransportMode } from "./app-domain-types";

export type ChecklistDomainDependencies = {
  getLocalIsoDateWithOffset: (days: number) => string;
  inferCityTourCity: (item: ItineraryItem) => string;
  expandTransferTrainItineraryItems: (items: ItineraryItem[]) => ItineraryItem[];
  parseDisplayDateToIso: (date: string, year: string) => string;
  inferCategoryKey: (item: ItineraryItem) => string;
  getScheduleTypeOption: (category: string) => { icon: string };
  resolveItineraryIcon: (item: ItineraryItem) => string;
  resolveTransportMode: (item: ItineraryItem) => TransportMode;
  parseTimeForInput: (value: string) => string;
  formatScheduleTime: (value: string) => string;
  resolveTotalBusCount: (pax: number, requestedTotalBuses?: number) => number;
  formatRouteSummary: (category: string, from: string, to: string, cityTourCity?: string) => string;
};

export function getChecklistRangeDates(getLocalIsoDateWithOffset: (days: number) => string): string[] {
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((dateStart.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDiff === 0) {
    return "Today";
  }

  if (dayDiff === 1) {
    return "Tomorrow";
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

export function buildChecklistActivityLabel(
  item: ItineraryItem,
  categoryKey: string,
  inferCityTourCity: (item: ItineraryItem) => string,
): string {
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

export function buildChecklistItemsFromGroups(
  groups: GroupData[],
  dependencies: ChecklistDomainDependencies,
): ChecklistItem[] {
  const allowedDateSet = new Set(getChecklistRangeDates(dependencies.getLocalIsoDateWithOffset));
  const rawItems: ChecklistItem[] = [];

  const getRootGroup = (group: GroupData): GroupData => {
    const visited = new Set<string>([group.code.trim().toUpperCase()]);
    let current = group;
    while (current.parentGroupId) {
      const parent = groups.find((g) => g.id === current.parentGroupId || g.code === current.parentGroupId);
      if (!parent) {
        break;
      }
      const parentCode = parent.code.trim().toUpperCase();
      if (visited.has(parentCode)) {
        break;
      }
      visited.add(parentCode);
      current = parent;
    }
    return current;
  };

  groups.forEach((group) => {
    let itineraryToUse = group.itinerary;
    if (group.parentGroupId) {
      const parent = groups.find((candidate) => candidate.id === group.parentGroupId || candidate.code === group.parentGroupId);
      if (parent) {
        itineraryToUse = parent.itinerary;
      }
    }

    const normalizedItinerary = dependencies.expandTransferTrainItineraryItems(itineraryToUse);

    normalizedItinerary.forEach((item, index) => {
      const tripDate = item.isoDate ?? dependencies.parseDisplayDateToIso(item.date, item.year);
      if (!tripDate || !allowedDateSet.has(tripDate)) {
        return;
      }

      const categoryKey = dependencies.inferCategoryKey(item);
      const transportMode = dependencies.resolveTransportMode(item);
      const activityIcon = dependencies.resolveItineraryIcon(item);
      const parsedTime = item.time ?? dependencies.parseTimeForInput(item.meta.split(" | ")[0] ?? "");
      const normalizedTime = parsedTime ? dependencies.formatScheduleTime(parsedTime) : "TBD";
      // Use the raw flag (not the resolved mode) for scheduling: by the time the
      // itinerary reaches here it is already split into flat segments whose
      // `transferByTrain` is cleared, so each carries its own plain `time`.
      const transferByTrain = categoryKey === "transfer" && (item.transferByTrain ?? false);
      const isDepartureActivity = categoryKey === "departure";
      const requiredBusCount = dependencies.resolveTotalBusCount(group.pax, group.totalBuses);
      const trainDepartureSource = item.trainDepartureTime ?? (transferByTrain ? parsedTime : "");
      const stationPickupSource = item.destinationPickupTime ?? "";
      const hotelPickupRequestSource = isDepartureActivity ? (item.hotelPickupRequestTime ?? "") : "";
      const trainDepartureTime = trainDepartureSource ? dependencies.formatScheduleTime(trainDepartureSource) : "TBD";
      const stationPickupTime = stationPickupSource ? dependencies.formatScheduleTime(stationPickupSource) : "TBD";
      const hotelPickupRequestTime = hotelPickupRequestSource ? dependencies.formatScheduleTime(hotelPickupRequestSource) : "";
      const departureFlightTime = isDepartureActivity ? normalizedTime : "";
      const scheduledTime = transferByTrain ? trainDepartureTime : hotelPickupRequestTime || normalizedTime;

      rawItems.push({
        id: `${group.code}-${tripDate}-${index}-${categoryKey}`,
        groupCode: group.code,
        groupName: group.name,
        groupPax: group.pax,
        agentId: group.agentId,
        agentName: group.agent?.name ?? "GTT Direct",
        tripDate,
        activity: buildChecklistActivityLabel(item, categoryKey, dependencies.inferCityTourCity),
        trip:
          item.from && item.to
            ? dependencies.formatRouteSummary(categoryKey, item.from, item.to, item.cityTourCity)
            : item.title,
        activityIcon,
        transportMode,
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

  const mergedMap = new Map<string, ChecklistItem[]>();
  rawItems.forEach((item) => {
    const groupRecord = groups.find((group) => group.code === item.groupCode);
    const rootGroup = groupRecord ? getRootGroup(groupRecord) : groupRecord;
    const rootCode = rootGroup ? rootGroup.code : item.groupCode;
    const key = `${rootCode}|${item.tripDate}|${item.scheduledTime}|${item.activity}|${item.trip}`;
    if (!mergedMap.has(key)) {
      mergedMap.set(key, []);
    }
    mergedMap.get(key)!.push(item);
  });

  const result: ChecklistItem[] = [];
  mergedMap.forEach((items) => {
    const firstItem = items[0];
    const groupRecord = groups.find((group) => group.code === firstItem.groupCode);
    const rootGroup = groupRecord ? getRootGroup(groupRecord) : groupRecord;
    const parentCode = rootGroup ? rootGroup.code : firstItem.groupCode;
    const parentName = rootGroup ? rootGroup.name : firstItem.groupName;
    const parentTotalBuses = rootGroup?.totalBuses;

    const totalPax = items.reduce((sum, item) => sum + item.groupPax, 0);
    const requiredBusCount = dependencies.resolveTotalBusCount(totalPax, parentTotalBuses);

    const uniqueCodes = Array.from(new Set(items.map((item) => item.groupCode)));
    const otherCodes = uniqueCodes.filter((code) => code !== parentCode).sort();
    const groupCodes = uniqueCodes.includes(parentCode) ? [parentCode, ...otherCodes] : otherCodes;

    const primaryItem = items.find((item) => item.groupCode === parentCode) || firstItem;

    result.push({
      ...primaryItem,
      groupCode: parentCode,
      groupName: parentName,
      groupPax: totalPax,
      requiredBusCount,
      groupCodes,
    });
  });

  return result.sort((left, right) => {
    const leftKey = `${left.tripDate} ${left.scheduledTime}`;
    const rightKey = `${right.tripDate} ${right.scheduledTime}`;
    return leftKey.localeCompare(rightKey);
  });
}
