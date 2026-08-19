import type {
  EditScheduleFormState,
  InputItineraryItem,
  ItineraryItem,
  TransferTrainFields,
  TransferTrainSegment,
  TransportMode,
} from "./app-domain-types";

export const scheduleTypeOptions = [
  { value: "arrival", cardLabel: "Arrival", modalLabel: "Arrival", icon: "flight_land" },
  { value: "city-tour", cardLabel: "City Tour", modalLabel: "City Tour", icon: "tour" },
  { value: "transfer", cardLabel: "Transfer", modalLabel: "Transfer", icon: "airport_shuttle" },
  { value: "departure", cardLabel: "Departure", modalLabel: "Departure", icon: "flight_takeoff" },
] as const;

/** Display metadata (label + Material Symbol icon) for each transport mode. */
export const TRANSPORT_MODE_META: Record<TransportMode, { label: string; icon: string }> = {
  flight: { label: "Flight", icon: "flight" },
  bus: { label: "Bus", icon: "directions_bus" },
  train: { label: "Train", icon: "train" },
};

/**
 * Transport modes selectable for a given activity category. Empty for
 * categories where transport is not a primary choice (e.g. city-tour).
 */
export function getAllowedTransportModes(category: string): TransportMode[] {
  const normalizedCategory = category.toLowerCase();
  if (normalizedCategory === "arrival" || normalizedCategory === "departure") {
    return ["flight", "bus"];
  }
  if (normalizedCategory === "transfer") {
    return ["bus", "train"];
  }
  return [];
}

/** Default transport mode when a category is first selected. */
export function getDefaultTransportMode(category: string): TransportMode {
  const normalizedCategory = category.toLowerCase();
  if (normalizedCategory === "arrival" || normalizedCategory === "departure") {
    return "flight";
  }
  return "bus";
}

/**
 * Resolve the authoritative transport mode for an itinerary item. Uses the
 * explicit `transportMode` when present, otherwise infers it for legacy data
 * from category + the old `transferByTrain` flag so existing groups keep the
 * correct icons and labels.
 */
export function resolveTransportMode(item: ItineraryItem): TransportMode {
  if (item.transportMode) {
    return item.transportMode;
  }

  const categoryKey = inferCategoryKey(item);
  if (categoryKey === "arrival" || categoryKey === "departure") {
    return "flight";
  }
  if (categoryKey === "transfer") {
    if (item.transferByTrain) {
      return "train";
    }
    // Legacy train transfers get split into segments whose `transferByTrain`
    // flag is cleared; recover the mode from the segment's category label.
    const normalizedCategory = item.category.toLowerCase();
    if (normalizedCategory.includes("train") || normalizedCategory.includes("station pickup")) {
      return "train";
    }
    return "bus";
  }

  return "bus";
}

/** Material Symbol icon for a transport mode within a category context. */
export function getTransportModeIcon(mode: TransportMode, category: string): string {
  if (mode === "flight") {
    const normalizedCategory = category.toLowerCase();
    if (normalizedCategory === "arrival") {
      return "flight_land";
    }
    if (normalizedCategory === "departure") {
      return "flight_takeoff";
    }
    return "flight";
  }

  return TRANSPORT_MODE_META[mode].icon;
}

/** Resolve the timeline node icon for an itinerary item based on its mode. */
export function resolveItineraryIcon(item: ItineraryItem): string {
  const categoryKey = inferCategoryKey(item);
  if (categoryKey === "city-tour") {
    return "tour";
  }

  return getTransportModeIcon(resolveTransportMode(item), categoryKey);
}

/** Whether a transfer's transport fields represent a high-speed train trip. */
function isTrainTransferFields(fields: TransferTrainFields): boolean {
  if (!isTransferActivityType(fields.category)) {
    return false;
  }
  if (fields.transportMode) {
    return fields.transportMode === "train";
  }
  return fields.transferByTrain;
}

export const saudiCityOptions = [
  "Makkah",
  "Madinah",
  "Jeddah",
  "Riyadh",
  "Taif",
  "Abha",
  "Tabuk",
  "Dammam",
  "Khobar",
  "Buraidah",
  "AlUla",
  "Yanbu",
  "Hail",
  "Jubail",
  "Najran",
  "Jazan",
  "Al Ahsa",
  "Qassim",
] as const;

const SAUDI_CITY_OPTIONS_STORAGE_KEY = "gtt-master-saudi-city-options-v1";

function normalizeSaudiCityOptionsList(options: readonly string[]): string[] {
  return Array.from(new Set(options.map((city) => city.trim()).filter((city) => city.length > 0)));
}

function readPersistedSaudiCityOptions(): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  const runtimeOptions = (window as { __GTT_SAUDI_CITY_OPTIONS__?: unknown }).__GTT_SAUDI_CITY_OPTIONS__;
  if (Array.isArray(runtimeOptions)) {
    const normalizedRuntime = normalizeSaudiCityOptionsList(
      runtimeOptions.filter((entry): entry is string => typeof entry === "string"),
    );
    if (normalizedRuntime.length > 0) {
      return normalizedRuntime;
    }
  }

  try {
    const rawStorageValue = window.localStorage.getItem(SAUDI_CITY_OPTIONS_STORAGE_KEY);
    if (!rawStorageValue) {
      return null;
    }

    const parsed = JSON.parse(rawStorageValue) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const normalizedStored = normalizeSaudiCityOptionsList(
      parsed.filter((entry): entry is string => typeof entry === "string"),
    );
    return normalizedStored.length > 0 ? normalizedStored : null;
  } catch {
    return null;
  }
}

export function getSaudiCityOptions(): string[] {
  return readPersistedSaudiCityOptions() ?? [...saudiCityOptions];
}

export function registerSaudiCityOptions(options: readonly string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeSaudiCityOptionsList(options);
  if (normalized.length === 0) {
    return;
  }

  (window as { __GTT_SAUDI_CITY_OPTIONS__?: string[] }).__GTT_SAUDI_CITY_OPTIONS__ = normalized;
  try {
    window.localStorage.setItem(SAUDI_CITY_OPTIONS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage write errors.
  }
}

export function sortInputItineraryItems(items: InputItineraryItem[]): InputItineraryItem[] {
  return [...items].sort((left, right) => {
    const leftKey = `${left.date}T${left.time || "00:00"}`;
    const rightKey = `${right.date}T${right.time || "00:00"}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function getScheduleTypeOption(category: string) {
  return scheduleTypeOptions.find((option) => option.value === category) ?? scheduleTypeOptions[1];
}

export function isFlightActivityType(category: string): boolean {
  const normalizedCategory = category.toLowerCase();
  return normalizedCategory === "arrival" || normalizedCategory === "departure";
}

export function isTransferActivityType(category: string): boolean {
  return category.toLowerCase() === "transfer";
}

export function isCityTourActivityType(category: string): boolean {
  return category.toLowerCase() === "city-tour";
}

export function isDepartureActivityType(category: string): boolean {
  return category.toLowerCase() === "departure";
}

export function hasIncompleteTransferTrainFields(fields: TransferTrainFields): boolean {
  if (!isTrainTransferFields(fields)) {
    return false;
  }

  return !fields.trainDepartureTime.trim() || !fields.destinationPickupTime.trim();
}

export function buildTransferTrainSummary(fields: TransferTrainFields): string {
  if (!isTrainTransferFields(fields)) {
    return "";
  }

  return [
    "HHR Transfer",
    `Train departure: ${formatScheduleTime(fields.trainDepartureTime.trim())}`,
    `Station pickup: ${formatScheduleTime(fields.destinationPickupTime.trim())}`,
  ].join(" | ");
}

export function inferCategoryKey(item: ItineraryItem): string {
  if (item.categoryKey) {
    return item.categoryKey;
  }

  const normalizedCategory = item.category.toLowerCase();

  if (normalizedCategory.includes("arrival")) {
    return "arrival";
  }

  if (normalizedCategory.includes("city tour") || normalizedCategory.includes("tour")) {
    return "city-tour";
  }

  if (normalizedCategory.includes("transfer")) {
    return "transfer";
  }

  if (normalizedCategory.includes("departure")) {
    return "departure";
  }

  if (item.icon === "flight_land") {
    return "arrival";
  }

  if (item.icon === "airport_shuttle") {
    return "transfer";
  }

  if (item.icon === "flight_takeoff") {
    return "departure";
  }

  return "city-tour";
}

export function formatScheduleDate(isoDate: string): { date: string; year: string } {
  const [year, month, day] = isoDate.split("-");
  const monthIndex = Number(month) - 1;
  const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return {
    date: `${Number(day)} ${shortMonths[monthIndex] ?? "Jan"}`,
    year,
  };
}

export function formatScheduleTime(value: string): string {
  if (!value) {
    return "TBD";
  }

  const trimmedValue = value.trim();
  const parsedFromMeridiem = parseTimeForInput(trimmedValue);
  if (parsedFromMeridiem) {
    return parsedFromMeridiem;
  }

  const twentyFourHourMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})$/);
  if (!twentyFourHourMatch) {
    return trimmedValue;
  }

  const [, rawHour, rawMinute] = twentyFourHourMatch;
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return trimmedValue;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return trimmedValue;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseDisplayDateToIso(date: string, year: string): string {
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

export function parseTimeForInput(value: string): string {
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

export function createScheduleMeta({
  category,
  time,
  flightNumber,
  hotelName,
  fromHotelName,
  hotelPickupRequestTime,
  from,
  to,
  cityTourCity,
  note,
  transferTrainSummary,
}: {
  category?: string;
  time: string;
  flightNumber?: string;
  hotelName?: string;
  fromHotelName?: string;
  hotelPickupRequestTime?: string;
  from?: string;
  to?: string;
  cityTourCity?: string;
  note?: string;
  transferTrainSummary?: string;
}): string {
  const trimmedFrom = from?.trim() ?? "";
  const trimmedTo = to?.trim() ?? "";
  const route =
    trimmedFrom && trimmedTo
      ? formatRouteSummary(category ?? "", trimmedFrom, trimmedTo, cityTourCity)
      : [trimmedFrom, trimmedTo].filter(Boolean).join(" -> ");
  const trimmedFlightNumber = flightNumber?.trim() ?? "";
  const trimmedHotelName = hotelName?.trim() ?? "";
  const trimmedFromHotelName = fromHotelName?.trim() ?? "";
  const normalizedCategory = category?.trim().toLowerCase() ?? "";
  const hotelNameSummary =
    normalizedCategory === "transfer"
      ? trimmedFromHotelName && trimmedHotelName
        ? `Hotel ${trimmedFromHotelName} -> ${trimmedHotelName}`
        : trimmedHotelName
          ? `Hotel ${trimmedHotelName}`
          : trimmedFromHotelName
            ? `Hotel ${trimmedFromHotelName}`
            : ""
      : trimmedHotelName
        ? `Hotel ${trimmedHotelName}`
        : "";
  const trimmedHotelPickupRequestTime = hotelPickupRequestTime?.trim() ?? "";
  const hotelPickupRequestSummary = trimmedHotelPickupRequestTime
    ? `Hotel pickup request ${formatScheduleTime(trimmedHotelPickupRequestTime)}`
    : "";
  const trimmedNote = note?.trim() ?? "";
  const trimmedTransferTrainSummary = transferTrainSummary?.trim() ?? "";
  const compactNote = trimmedNote.length > 42 ? `${trimmedNote.slice(0, 39).trimEnd()}...` : trimmedNote;

  return (
    [
      formatScheduleTime(time),
      trimmedFlightNumber,
      hotelNameSummary,
      hotelPickupRequestSummary,
      route,
      trimmedTransferTrainSummary,
      compactNote,
    ]
      .filter(Boolean)
      .join(" | ") || "Schedule details pending confirmation"
  );
}

export function detectCityFromText(rawValue: string): string {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  const foundCity = getSaudiCityOptions().find((city) => normalized.includes(city.toLowerCase()));
  return foundCity ?? "";
}

export function normalizeAgreementCityKey(rawValue: string): "makkah" | "madinah" | "" {
  const detectedCity = detectCityFromText(rawValue);
  if (!detectedCity) {
    return "";
  }

  const normalizedCity = detectedCity.trim().toLowerCase();
  if (normalizedCity === "makkah") {
    return "makkah";
  }

  if (normalizedCity === "madinah") {
    return "madinah";
  }

  return "";
}

export function normalizeSaudiCityValue(rawValue: string): string {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return "";
  }

  const matchedCity = getSaudiCityOptions().find((city) => city.toLowerCase() === trimmedValue.toLowerCase());
  return matchedCity ?? "";
}

export function inferCityTourCity(item: ItineraryItem): string {
  if (item.cityTourCity?.trim()) {
    return item.cityTourCity.trim();
  }

  return (
    detectCityFromText(item.from ?? "") ||
    detectCityFromText(item.to ?? "") ||
    detectCityFromText(item.title ?? "") ||
    detectCityFromText(item.notes ?? "")
  );
}

export function createEditScheduleForm(item: ItineraryItem): EditScheduleFormState {
  const category = inferCategoryKey(item);
  const parsedTime = item.time ?? parseTimeForInput(item.meta.split(" | ")[0] ?? "");
  const transportMode = resolveTransportMode(item);
  const isTransferByTrain = category === "transfer" && transportMode === "train";
  const isDepartureActivity = isDepartureActivityType(category);
  const rawFromValue = (item.from ?? "").trim();
  const rawToValue = (item.to ?? item.title).trim();
  const fromValue = category === "transfer" ? normalizeSaudiCityValue(rawFromValue) : rawFromValue;
  const toValue = category === "arrival" || category === "transfer" ? normalizeSaudiCityValue(rawToValue) : rawToValue;

  return {
    date: item.isoDate ?? parseDisplayDateToIso(item.date, item.year),
    time: parsedTime,
    category,
    transportMode,
    flightNumber: item.flightNumber ?? "",
    hotelName: item.hotelName ?? "",
    fromHotelName: category === "transfer" ? (item.fromHotelName ?? "") : "",
    from: fromValue,
    to: toValue,
    cityTourCity: category === "city-tour" ? inferCityTourCity(item) : "",
    requiresBus: item.requiresBus ?? /bus/i.test(item.meta),
    notes: item.notes ?? "",
    transferByTrain: isTransferByTrain,
    trainDepartureTime: item.trainDepartureTime ?? (isTransferByTrain ? parsedTime : ""),
    destinationPickupTime: item.destinationPickupTime ?? "",
    hotelPickupRequestTime: isDepartureActivity ? (item.hotelPickupRequestTime ?? "") : "",
  };
}

export function buildItineraryItemFromEditForm(currentItem: ItineraryItem, form: EditScheduleFormState): ItineraryItem {
  const typeOption = getScheduleTypeOption(form.category);
  const formattedDate = formatScheduleDate(form.date);
  // Fall back to the legacy `transferByTrain` flag when a caller supplies a form
  // without an explicit transport mode (older payloads / tests).
  const requestedMode =
    form.transportMode ?? (isTransferActivityType(form.category) && form.transferByTrain ? "train" : undefined);
  const transportMode = resolveFormTransportMode(form.category, requestedMode);
  const nextCityTourCity = isCityTourActivityType(form.category) ? form.cityTourCity.trim() : "";
  const nextTitle =
    form.from.trim() && form.to.trim()
      ? formatRouteSummary(form.category, form.from, form.to, nextCityTourCity)
      : currentItem.title;
  const nextFlightNumber = transportMode === "flight" && isFlightActivityType(form.category) ? form.flightNumber.trim() : "";
  const shouldPersistHotelName =
    form.category === "arrival" || form.category === "city-tour" || form.category === "departure";
  const nextHotelName = shouldPersistHotelName ? (form.hotelName?.trim() ?? "") : "";
  const nextFromHotelName = "";
  const nextHotelPickupRequestTime = isDepartureActivityType(form.category) ? form.hotelPickupRequestTime.trim() : "";
  const isTransferByTrain = isTransferActivityType(form.category) && transportMode === "train";
  const scheduleTime = isTransferByTrain ? form.trainDepartureTime : form.time;
  const transferTrainSummary = buildTransferTrainSummary({ ...form, transportMode });
  const nextRequiresBus = isCityTourActivityType(form.category) ? form.requiresBus : transportMode === "bus";
  const nextIcon = form.category === "city-tour" ? "tour" : getTransportModeIcon(transportMode, form.category);

  return {
    ...currentItem,
    date: formattedDate.date,
    year: formattedDate.year,
    category: typeOption.cardLabel,
    title: nextTitle,
    meta: createScheduleMeta({
      category: form.category,
      time: scheduleTime,
      flightNumber: nextFlightNumber,
      hotelName: nextHotelName,
      fromHotelName: nextFromHotelName,
      hotelPickupRequestTime: nextHotelPickupRequestTime,
      from: form.from,
      to: form.to,
      cityTourCity: nextCityTourCity,
      note: form.notes,
      transferTrainSummary,
    }),
    icon: nextIcon,
    categoryKey: typeOption.value,
    isoDate: form.date,
    time: scheduleTime,
    transportMode,
    flightNumber: nextFlightNumber,
    hotelName: nextHotelName,
    fromHotelName: nextFromHotelName,
    from: form.from.trim(),
    to: form.to.trim(),
    cityTourCity: nextCityTourCity,
    requiresBus: nextRequiresBus,
    notes: form.notes.trim(),
    transferByTrain: isTransferByTrain,
    trainDepartureTime: isTransferByTrain ? form.trainDepartureTime.trim() : "",
    destinationPickupTime: isTransferByTrain ? form.destinationPickupTime.trim() : "",
    hotelPickupRequestTime: nextHotelPickupRequestTime,
  };
}

/**
 * Normalize a form's transport mode to one valid for its category. Falls back to
 * the category default when the stored mode is not allowed (e.g. after switching
 * category), keeping persisted items consistent.
 */
export function resolveFormTransportMode(category: string, mode: TransportMode | undefined): TransportMode {
  const allowed = getAllowedTransportModes(category);
  if (allowed.length === 0) {
    return mode ?? getDefaultTransportMode(category);
  }
  if (mode && allowed.includes(mode)) {
    return mode;
  }
  return getDefaultTransportMode(category);
}

export function isFridayDate(value: string): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.getDay() === 5;
}

export function shouldShowFridayCityTourWarning(category: string, date: string): boolean {
  return category === "city-tour" && isFridayDate(date);
}

export function getRouteFieldConfigByCategory(category: string): {
  fromLabel: string;
  toLabel: string;
  fromPlaceholder: string;
  toPlaceholder: string;
  helperText: string;
} {
  if (category === "arrival") {
    return {
      fromLabel: "Landing Airport City",
      toLabel: "To City",
      fromPlaceholder: "e.g. Jeddah",
      toPlaceholder: "e.g. Makkah",
      helperText: "Enter the landing airport city and select the destination city.",
    };
  }

  if (category === "transfer") {
    return {
      fromLabel: "From City",
      toLabel: "To City",
      fromPlaceholder: "e.g. Makkah",
      toPlaceholder: "e.g. Madinah",
      helperText: "Enter the origin city and select the destination city.",
    };
  }

  if (category === "departure") {
    return {
      fromLabel: "Departure City",
      toLabel: "Destination Airport City",
      fromPlaceholder: "e.g. Madinah",
      toPlaceholder: "e.g. Jeddah",
      helperText:
        "Select the departure city and airport city in Saudi, then fill flight return time and hotel pickup request time.",
    };
  }

  if (category === "city-tour") {
    return {
      fromLabel: "Meeting Point",
      toLabel: "Tour Destination",
      fromPlaceholder: "e.g. Madinah Hotel Lobby",
      toPlaceholder: "e.g. Masjid Quba",
      helperText: "Select the city tour city, then fill in the meeting point and ziyarah destination.",
    };
  }

  return {
    fromLabel: "From Location",
    toLabel: "To Location",
    fromPlaceholder: "e.g. Makkah Hotel",
    toPlaceholder: "e.g. Jabal Rahmah",
    helperText: "",
  };
}

export function formatRouteSummary(category: string, from: string, to: string, cityTourCity = ""): string {
  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();
  const trimmedCityTourCity = cityTourCity.trim();

  if (!trimmedFrom || !trimmedTo) {
    return [trimmedFrom, trimmedTo].filter(Boolean).join(" -> ");
  }

  if (category === "arrival") {
    return `Landing at ${trimmedFrom} and heading to ${trimmedTo}`;
  }

  if (category === "transfer") {
    return `Transfer from ${trimmedFrom} to ${trimmedTo}`;
  }

  if (category === "departure") {
    return `Depart from ${trimmedFrom} to ${trimmedTo}`;
  }

  if (category === "city-tour") {
    if (!trimmedCityTourCity) {
      return `${trimmedFrom} -> ${trimmedTo}`;
    }

    return `City Tour in ${trimmedCityTourCity}: ${trimmedFrom} -> ${trimmedTo}`;
  }

  return `${trimmedFrom} -> ${trimmedTo}`;
}

export function getTransferTrainSegmentCategory(segment: TransferTrainSegment): string {
  return segment === "train-departure" ? "Transfer - Train Departure" : "Transfer - Arrival Station Pickup";
}

export function expandInputTransferTrainItems(items: InputItineraryItem[]): InputItineraryItem[] {
  return items.flatMap((item) => {
    const isTransferByTrain = isTransferActivityType(item.categoryKey) && item.transferByTrain;
    if (!isTransferByTrain) {
      return [item];
    }

    const transferCategoryKey = "transfer";
    const transferIcon = TRANSPORT_MODE_META.train.icon;
    const departureTime = item.trainDepartureTime.trim() || item.time.trim();
    const pickupTime = item.destinationPickupTime.trim() || departureTime;
    const trimmedFrom = item.from.trim();
    const trimmedTo = item.to.trim();
    const trimmedHotelName = item.hotelName?.trim() ?? "";
    const trimmedFromHotelName = item.fromHotelName?.trim() ?? "";
    const trimmedNotes = item.notes.trim();

    return [
      {
        id: `${item.id}-train-departure`,
        date: item.date,
        time: departureTime,
        category: getTransferTrainSegmentCategory("train-departure"),
        categoryKey: transferCategoryKey,
        transportMode: "train",
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        flightNumber: "",
        requiresBus: false,
        notes: trimmedNotes,
        icon: transferIcon,
        transferByTrain: false,
        trainDepartureTime: "",
        destinationPickupTime: "",
        hotelPickupRequestTime: "",
      },
      {
        id: `${item.id}-station-pickup`,
        date: item.date,
        time: pickupTime,
        category: getTransferTrainSegmentCategory("station-pickup"),
        categoryKey: transferCategoryKey,
        transportMode: "train",
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        flightNumber: "",
        requiresBus: false,
        notes: "",
        icon: transferIcon,
        transferByTrain: false,
        trainDepartureTime: "",
        destinationPickupTime: "",
        hotelPickupRequestTime: "",
      },
    ];
  });
}

export function expandTransferTrainItineraryItems(items: ItineraryItem[]): ItineraryItem[] {
  return items.flatMap((item) => {
    const categoryKey = inferCategoryKey(item);
    const isTransferByTrain = categoryKey === "transfer" && (item.transferByTrain ?? false);
    if (!isTransferByTrain) {
      return [item];
    }

    const fallbackMetaTime = parseTimeForInput(item.meta.split(" | ")[0] ?? "");
    const departureTime = (item.trainDepartureTime ?? "").trim() || (item.time ?? "").trim() || fallbackMetaTime;
    const pickupTime = (item.destinationPickupTime ?? "").trim() || departureTime;
    const isoDate = item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
    const formattedDate = isoDate ? formatScheduleDate(isoDate) : { date: item.date, year: item.year };
    const transferCategoryKey = "transfer";
    const transferIcon = TRANSPORT_MODE_META.train.icon;
    const trimmedFrom = item.from?.trim() ?? "";
    const trimmedTo = item.to?.trim() ?? "";
    const trimmedHotelName = item.hotelName?.trim() ?? "";
    const trimmedFromHotelName = item.fromHotelName?.trim() ?? "";
    const trimmedNotes = item.notes?.trim() ?? "";
    const routeTitle =
      trimmedFrom && trimmedTo
        ? formatRouteSummary("transfer", trimmedFrom, trimmedTo, item.cityTourCity ?? "")
        : item.title;

    return [
      {
        ...item,
        date: formattedDate.date,
        year: formattedDate.year,
        category: getTransferTrainSegmentCategory("train-departure"),
        title: routeTitle,
        meta: createScheduleMeta({
          category: "transfer",
          time: departureTime,
          hotelName: trimmedHotelName,
          fromHotelName: trimmedFromHotelName,
          from: trimmedFrom,
          to: trimmedTo,
          note: trimmedNotes,
        }),
        icon: transferIcon,
        categoryKey: transferCategoryKey,
        isoDate: isoDate ?? item.isoDate,
        time: departureTime,
        transportMode: "train",
        flightNumber: "",
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        requiresBus: false,
        notes: trimmedNotes,
        transferByTrain: false,
        trainDepartureTime: "",
        destinationPickupTime: "",
        hotelPickupRequestTime: "",
      },
      {
        ...item,
        date: formattedDate.date,
        year: formattedDate.year,
        category: getTransferTrainSegmentCategory("station-pickup"),
        title: routeTitle,
        meta: createScheduleMeta({
          category: "transfer",
          time: pickupTime,
          hotelName: trimmedHotelName,
          fromHotelName: trimmedFromHotelName,
          from: trimmedFrom,
          to: trimmedTo,
        }),
        icon: transferIcon,
        highlighted: false,
        categoryKey: transferCategoryKey,
        isoDate: isoDate ?? item.isoDate,
        time: pickupTime,
        transportMode: "train",
        flightNumber: "",
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        requiresBus: false,
        notes: "",
        transferByTrain: false,
        trainDepartureTime: "",
        destinationPickupTime: "",
        hotelPickupRequestTime: "",
      },
    ];
  });
}

export function getItineraryIsoDate(item: ItineraryItem): string {
  return item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
}
