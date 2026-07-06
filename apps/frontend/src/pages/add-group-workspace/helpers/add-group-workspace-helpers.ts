import type {
  InputItineraryFormState,
  InputItineraryItem,
  ItineraryPrefill,
  ItineraryItem,
  NewGroupItineraryDraft,
  NextActivity,
  TimelineItem,
} from "../../../shared/app-domain.js";
import {
  buildTransferTrainSummary,
  formatRouteSummary,
  formatScheduleDate,
  formatScheduleTime,
  getMinimumBusCountForPax,
  hasIncompleteTransferTrainFields,
  isCityTourActivityType,
  isFlightActivityType,
  isTransferActivityType,
  normalizeAgreementCityKey,
  shiftIsoDate,
} from "../../../shared/app-domain.js";

export type BaseTripDraft = InputItineraryFormState & {
  id: string;
  title: string;
  description: string;
  isEnabled: boolean;
};

export type ItinerarySectionMode = "full" | "identity-only" | "schedule-only";

export type EffectiveGroupIdentityState = {
  isIdentityOnlyMode: boolean;
  isScheduleOnlyMode: boolean;
  effectiveGroupCode: string;
  effectiveGroupName: string;
  effectivePackageType: string;
  effectivePaxCountValue: string;
  effectiveTotalBusRequiredValue: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  effectiveMusyrifName: string;
  effectiveMusyrifPhone: string;
  effectiveBusStatus: "Visa Only" | "Visa+";
};

export type InputItineraryValidationState = {
  hasInvalidDateRange: boolean;
  parsedTotalBusRequired: number;
  safePaxForBusRule: number;
  minimumBusCount: number;
  isTotalBusRequiredValid: boolean;
  isTotalBusBelowMinimum: boolean;
  isGroupInformationComplete: boolean;
  isGroupReadyForItinerary: boolean;
  showFlightNumberField: boolean;
  showHotelNameField: boolean;
  showTransferTrainFields: boolean;
  showDeparturePickupField: boolean;
  showCityTourCityField: boolean;
  isFormDisabled: boolean;
};

export const BASE_TRIP_BLUEPRINTS = [
  {
    id: "base-arrival",
    title: "1. Arrival",
    description: "Bandara kedatangan menuju kota pertama.",
    defaultEnabled: true,
    category: "arrival",
    from: "Jeddah",
    to: "Makkah",
    cityTourCity: "",
    flightNumber: "SV-827",
  },
  {
    id: "base-city-tour-first",
    title: "2. City Tour Kota Pertama",
    description: "Kegiatan city tour di kota pertama.",
    defaultEnabled: false,
    category: "city-tour",
    from: "Makkah Hotel",
    to: "Masjidil Haram",
    cityTourCity: "Makkah",
    flightNumber: "",
  },
  {
    id: "base-transfer",
    title: "3. Perjalanan Antar Kota",
    description: "Perjalanan dari kota pertama ke kota kedua.",
    defaultEnabled: false,
    category: "transfer",
    from: "Makkah",
    to: "Madinah",
    cityTourCity: "",
    flightNumber: "",
  },
  {
    id: "base-city-tour-second",
    title: "4. City Tour Kota Kedua",
    description: "Kegiatan city tour di kota kedua.",
    defaultEnabled: false,
    category: "city-tour",
    from: "Madinah Hotel",
    to: "Masjid Nabawi",
    cityTourCity: "Madinah",
    flightNumber: "",
  },
  {
    id: "base-departure",
    title: "5. Departure",
    description: "Kota kedua menuju bandara kepulangan (isi jam pickup hotel dan jam flight).",
    defaultEnabled: true,
    category: "departure",
    from: "Madinah",
    to: "Madinah Airport",
    cityTourCity: "",
    flightNumber: "SV-828",
  },
] as const;

function clampDateRange(isoDate: string, startDate: string, endDate: string): string {
  if (!isoDate) {
    return startDate;
  }

  if (!startDate || !endDate) {
    return isoDate;
  }

  if (isoDate < startDate) {
    return startDate;
  }

  if (isoDate > endDate) {
    return endDate;
  }

  return isoDate;
}

function resolveCityHotelNameFromPrefill(prefill: ItineraryPrefill | null | undefined, cityInput: string): string {
  const cityKey = normalizeAgreementCityKey(cityInput);
  if (!cityKey) {
    return "";
  }

  const mappedHotelName = prefill?.cityHotelNames?.[cityKey]?.trim() ?? "";
  return mappedHotelName;
}

function resolveHotelNameFromRouteValues(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
      continue;
    }

    if (/hotel/i.test(trimmed)) {
      return trimmed;
    }
  }

  return "";
}

function resolveFallbackCityHotelName(cityInput: string): string {
  const cityKey = normalizeAgreementCityKey(cityInput);
  if (cityKey === "makkah") {
    return "Makkah Hotel";
  }

  if (cityKey === "madinah") {
    return "Madinah Hotel";
  }

  return "";
}

function resolveTripHotelName(
  category: string,
  from: string,
  to: string,
  cityTourCity: string,
  prefill: ItineraryPrefill | null | undefined,
): string {
  if (category === "city-tour") {
    return (
      resolveCityHotelNameFromPrefill(prefill, cityTourCity) ||
      resolveHotelNameFromRouteValues(from, to) ||
      resolveFallbackCityHotelName(cityTourCity)
    );
  }

  if (category === "departure") {
    return (
      resolveCityHotelNameFromPrefill(prefill, from) ||
      resolveHotelNameFromRouteValues(from, to) ||
      resolveFallbackCityHotelName(from)
    );
  }

  if (category === "arrival" || category === "transfer") {
    return (
      resolveCityHotelNameFromPrefill(prefill, to) ||
      resolveHotelNameFromRouteValues(to, from) ||
      resolveFallbackCityHotelName(to)
    );
  }

  return resolveHotelNameFromRouteValues(from, to);
}

export function createBaseTripDrafts(
  startDate: string,
  endDate: string,
  prefill?: ItineraryPrefill | null,
): BaseTripDraft[] {
  const safeStartDate = startDate || "";
  const safeEndDate = endDate && (!safeStartDate || endDate >= safeStartDate) ? endDate : safeStartDate;
  const dayOffsets = [0, 1, 2, -1, 0];

  return BASE_TRIP_BLUEPRINTS.map((blueprint, index) => {
    const initialDate = safeStartDate
      ? clampDateRange(
          dayOffsets[index] === 0
            ? index === BASE_TRIP_BLUEPRINTS.length - 1
              ? safeEndDate || safeStartDate
              : safeStartDate
            : shiftIsoDate(dayOffsets[index] > 0 ? safeStartDate : safeEndDate || safeStartDate, dayOffsets[index]),
          safeStartDate,
          safeEndDate || safeStartDate,
        )
      : "";

    const prefillTrip = prefill?.trips?.[blueprint.id];
    const nextFrom = prefillTrip?.from?.trim() || blueprint.from;
    const nextTo = prefillTrip?.to?.trim() || blueprint.to;
    const nextCityTourCity = prefillTrip?.cityTourCity?.trim() || blueprint.cityTourCity;
    const nextHotelName =
      prefillTrip?.hotelName?.trim() ||
      resolveTripHotelName(blueprint.category, nextFrom, nextTo, nextCityTourCity, prefill);

    return {
      id: blueprint.id,
      title: blueprint.title,
      description: blueprint.description,
      isEnabled: blueprint.defaultEnabled,
      date: prefillTrip?.date?.trim() || initialDate,
      time: "",
      category: blueprint.category,
      hotelName: nextHotelName,
      from: nextFrom,
      to: nextTo,
      cityTourCity: nextCityTourCity,
      flightNumber: prefillTrip?.flightNumber?.trim() || blueprint.flightNumber,
      requiresBus: true,
      notes: "",
      transferByTrain: false,
      trainDepartureTime: "",
      destinationPickupTime: "",
      hotelPickupRequestTime: prefillTrip?.hotelPickupRequestTime?.trim() || "",
    };
  });
}

export function resolveEffectiveGroupIdentityState({
  sectionMode,
  identityDraft,
  itineraryPrefill,
  groupNumber,
  groupName,
  packageType,
  paxCount,
  totalBusRequired,
  startDate,
  endDate,
  musyrifName,
  musyrifPhone,
  busStatus,
}: {
  sectionMode: ItinerarySectionMode;
  identityDraft?: NewGroupItineraryDraft | null;
  itineraryPrefill?: ItineraryPrefill | null;
  groupNumber: string;
  groupName: string;
  packageType: string;
  paxCount: string;
  totalBusRequired: string;
  startDate: string;
  endDate: string;
  musyrifName: string;
  musyrifPhone: string;
  busStatus: "Visa Only" | "Visa+";
}): EffectiveGroupIdentityState {
  const isIdentityOnlyMode = sectionMode === "identity-only";
  const isScheduleOnlyMode = sectionMode === "schedule-only";

  const effectiveGroupCode = isScheduleOnlyMode ? (identityDraft?.groupCode ?? groupNumber) : groupNumber;
  const effectiveGroupName = isScheduleOnlyMode ? (identityDraft?.groupName ?? groupName) : groupName;
  const effectivePackageType = isScheduleOnlyMode ? (identityDraft?.packageName ?? packageType) : packageType;
  const effectivePaxCountValue =
    isScheduleOnlyMode && typeof identityDraft?.pax === "number" ? String(identityDraft.pax) : paxCount;
  const effectiveTotalBusRequiredValue =
    isScheduleOnlyMode && typeof identityDraft?.totalBuses === "number"
      ? String(identityDraft.totalBuses)
      : totalBusRequired;
  const effectiveStartDate = isScheduleOnlyMode
    ? (identityDraft?.startDate ?? itineraryPrefill?.startDate ?? startDate)
    : startDate;
  const effectiveEndDate = isScheduleOnlyMode
    ? (identityDraft?.endDate ?? itineraryPrefill?.endDate ?? endDate)
    : endDate;
  const effectiveMusyrifName = isScheduleOnlyMode ? (identityDraft?.musyrifName ?? musyrifName) : musyrifName;
  const effectiveMusyrifPhone = isScheduleOnlyMode ? (identityDraft?.musyrifPhone ?? musyrifPhone) : musyrifPhone;
  const effectiveBusStatus = isScheduleOnlyMode ? (identityDraft?.busStatus ?? busStatus) : busStatus;

  return {
    isIdentityOnlyMode,
    isScheduleOnlyMode,
    effectiveGroupCode,
    effectiveGroupName,
    effectivePackageType,
    effectivePaxCountValue,
    effectiveTotalBusRequiredValue,
    effectiveStartDate,
    effectiveEndDate,
    effectiveMusyrifName,
    effectiveMusyrifPhone,
    effectiveBusStatus,
  };
}

export function buildInputItineraryValidationState({
  effectiveGroupCode,
  effectiveGroupName,
  effectivePackageType,
  effectivePaxCountValue,
  effectiveTotalBusRequiredValue,
  effectiveStartDate,
  effectiveEndDate,
  effectiveMusyrifName,
  effectiveMusyrifPhone,
  form,
}: {
  effectiveGroupCode: string;
  effectiveGroupName: string;
  effectivePackageType: string;
  effectivePaxCountValue: string;
  effectiveTotalBusRequiredValue: string;
  effectiveStartDate: string;
  effectiveEndDate: string;
  effectiveMusyrifName: string;
  effectiveMusyrifPhone: string;
  form: InputItineraryFormState;
}): InputItineraryValidationState {
  const hasInvalidDateRange = !!effectiveStartDate && !!effectiveEndDate && effectiveEndDate < effectiveStartDate;
  const parsedPaxCount = Number.parseInt(effectivePaxCountValue, 10);
  const safePaxForBusRule = Number.isFinite(parsedPaxCount) && parsedPaxCount > 0 ? parsedPaxCount : 1;
  const minimumBusCount = getMinimumBusCountForPax(safePaxForBusRule);
  const parsedTotalBusRequired = Number.parseInt(effectiveTotalBusRequiredValue, 10);
  const isTotalBusRequiredValid = Number.isFinite(parsedTotalBusRequired) && parsedTotalBusRequired > 0;
  const isTotalBusBelowMinimum = isTotalBusRequiredValid && parsedTotalBusRequired < minimumBusCount;

  const isGroupInformationComplete =
    !!effectiveGroupCode.trim() &&
    !!effectiveGroupName.trim() &&
    !!effectivePackageType.trim() &&
    !!effectivePaxCountValue.trim() &&
    isTotalBusRequiredValid &&
    !!effectiveStartDate &&
    !!effectiveEndDate &&
    !!effectiveMusyrifName.trim() &&
    !!effectiveMusyrifPhone.trim();
  const isGroupReadyForItinerary = isGroupInformationComplete && !hasInvalidDateRange && !isTotalBusBelowMinimum;

  const showFlightNumberField = isFlightActivityType(form.category);
  const showHotelNameField = form.category === "arrival" || form.category === "departure";
  const showTransferTrainFields = isTransferActivityType(form.category) && form.transferByTrain;
  const showDeparturePickupField = form.category === "departure";
  const showCityTourCityField = isCityTourActivityType(form.category);
  const isFlightNumberMissing = showFlightNumberField && !form.flightNumber.trim();
  const isHotelNameMissing = showHotelNameField && !(form.hotelName?.trim() ?? "");
  const isDepartureFlightTimeMissing = form.category === "departure" && !form.time.trim();
  const isDeparturePickupTimeMissing = showDeparturePickupField && !form.hotelPickupRequestTime.trim();
  const isCityTourCityMissing = showCityTourCityField && !form.cityTourCity.trim();
  const hasTransferTrainFieldsMissing = hasIncompleteTransferTrainFields(form);
  const isFormDisabled =
    !isGroupReadyForItinerary ||
    !form.date ||
    !form.from.trim() ||
    !form.to.trim() ||
    isFlightNumberMissing ||
    isHotelNameMissing ||
    isDepartureFlightTimeMissing ||
    isDeparturePickupTimeMissing ||
    isCityTourCityMissing ||
    hasTransferTrainFieldsMissing;

  return {
    hasInvalidDateRange,
    parsedTotalBusRequired,
    safePaxForBusRule,
    minimumBusCount,
    isTotalBusRequiredValid,
    isTotalBusBelowMinimum,
    isGroupInformationComplete,
    isGroupReadyForItinerary,
    showFlightNumberField,
    showHotelNameField,
    showTransferTrainFields,
    showDeparturePickupField,
    showCityTourCityField,
    isFormDisabled,
  };
}

export function shouldUseSaudiCityDropdown(category: string, field: "from" | "to"): boolean {
  if (category === "arrival" || category === "transfer") {
    return true;
  }

  if (category === "departure" && (field === "from" || field === "to")) {
    return true;
  }

  return false;
}

export function isBaseTripDraftInvalid(item: BaseTripDraft): boolean {
  if (!item.isEnabled) {
    return false;
  }

  const isFlightNumberRequired = isFlightActivityType(item.category) && !item.flightNumber.trim();
  const isHotelNameRequired = item.category === "arrival" || item.category === "departure";
  const isHotelNameMissing = isHotelNameRequired && !(item.hotelName?.trim() ?? "");
  const isDepartureFlightTimeRequired = item.category === "departure" && !item.time.trim();
  const isDeparturePickupTimeRequired = item.category === "departure" && !item.hotelPickupRequestTime.trim();
  const isCityTourCityRequired = isCityTourActivityType(item.category) && !item.cityTourCity.trim();

  return (
    !item.date ||
    !item.from.trim() ||
    !item.to.trim() ||
    isFlightNumberRequired ||
    isHotelNameMissing ||
    isDepartureFlightTimeRequired ||
    isDeparturePickupTimeRequired ||
    isCityTourCityRequired ||
    hasIncompleteTransferTrainFields(item)
  );
}

export function buildItineraryFromInputItems(sortedItems: InputItineraryItem[]): ItineraryItem[] {
  return sortedItems.map((item, index) => {
    const formattedDate = formatScheduleDate(item.date);
    const transferTrainSummary = buildTransferTrainSummary(item);
    const normalizedHotelName = item.hotelName?.trim() ?? "";
    const metaSegments = [
      formatScheduleTime(item.time),
      item.flightNumber ? `Flight ${item.flightNumber}` : "",
      normalizedHotelName ? `Hotel ${normalizedHotelName}` : "",
      item.hotelPickupRequestTime ? `Hotel pickup request ${formatScheduleTime(item.hotelPickupRequestTime)}` : "",
      transferTrainSummary,
      item.requiresBus ? "Requires Bus" : "",
      item.notes ? item.notes : "",
    ].filter(Boolean);

    return {
      date: formattedDate.date,
      year: formattedDate.year,
      category: item.category,
      categoryKey: item.categoryKey,
      title: formatRouteSummary(item.categoryKey, item.from, item.to, item.cityTourCity),
      meta: metaSegments.join(" | "),
      icon: item.icon,
      highlighted: index === 0,
      isoDate: item.date,
      time: item.time,
      flightNumber: item.flightNumber,
      hotelName: normalizedHotelName || undefined,
      from: item.from,
      to: item.to,
      cityTourCity: item.cityTourCity,
      requiresBus: item.requiresBus,
      notes: item.notes,
      transferByTrain: item.transferByTrain,
      trainDepartureTime: item.trainDepartureTime,
      destinationPickupTime: item.destinationPickupTime,
      hotelPickupRequestTime: item.hotelPickupRequestTime,
    };
  });
}

export function buildTimelineAndNextActivity(
  sortedItems: InputItineraryItem[],
  fallbackSecondDateIso?: string,
): { timeline: [TimelineItem, TimelineItem]; nextActivity: NextActivity } | null {
  const firstItem = sortedItems[0];
  if (!firstItem) {
    return null;
  }

  const firstDate = formatScheduleDate(firstItem.date);
  const secondItem = sortedItems[1];
  const secondDate = secondItem
    ? formatScheduleDate(secondItem.date)
    : formatScheduleDate(fallbackSecondDateIso || firstItem.date);
  const firstRouteSummary = formatRouteSummary(
    firstItem.categoryKey,
    firstItem.from,
    firstItem.to,
    firstItem.cityTourCity,
  );
  const timelineFirst: TimelineItem = {
    date: firstDate.date,
    title: `${firstItem.category} | ${firstRouteSummary}`,
  };
  const timelineSecond: TimelineItem = secondItem
    ? {
        date: secondDate.date,
        title: `${secondItem.category} | ${formatRouteSummary(
          secondItem.categoryKey,
          secondItem.from,
          secondItem.to,
          secondItem.cityTourCity,
        )}`,
        isCurrent: true,
        nextActivity: `${formatScheduleTime(secondItem.time)}${secondItem.requiresBus ? " | Requires Bus" : ""}`,
      }
    : {
        date: secondDate.date,
        title: "Next activity to be confirmed",
        isCurrent: true,
        nextActivity: "Awaiting operator update",
      };

  return {
    timeline: [timelineFirst, timelineSecond],
    nextActivity: {
      title: `${firstItem.category}: ${firstRouteSummary}`,
      date: firstDate.date,
      time: formatScheduleTime(firstItem.time),
      icon: firstItem.icon,
    },
  };
}

export function buildDefaultItineraryNotes(sortedItems: InputItineraryItem[]): string[] {
  const notes = sortedItems
    .map((item) => item.notes.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (notes.length === 0) {
    notes.push("Itinerary drafted by operator and ready for operations review.");
  }

  return notes;
}

export function calculateItineraryDurationDays(sortedItems: InputItineraryItem[]): number {
  const itineraryStartIso = sortedItems[0]?.date;
  const itineraryEndIso = sortedItems[sortedItems.length - 1]?.date ?? itineraryStartIso;

  if (!itineraryStartIso || !itineraryEndIso) {
    return 1;
  }

  return Math.max(1, Math.floor((Date.parse(itineraryEndIso) - Date.parse(itineraryStartIso)) / 86_400_000) + 1);
}
