import {
  buildVisaAgreementNumber,
  formatVisaDateWithYear,
  formatVisaLongDate,
  formatVisaShortDate,
  generateWhatsappCopyText,
  getGroupAgreementHotelsByCity,
  hasMissingHotelAllocation,
  isIsoDateValue,
  isVisaRowActionRequired,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  resolveVisaProvider,
  shiftIsoDate,
} from "./visa-domain.js";

import {
  getStatusByTone,
  resolveCurrentGroupTone,
  resolveGroupToneByItinerary,
} from "./group-status-domain";

import {
  buildChecklistActivityLabel as buildChecklistActivityLabelDomain,
  buildChecklistItemsFromGroups as buildChecklistItemsFromGroupsDomain,
  formatChecklistCopyDate as formatChecklistCopyDateDomain,
  getChecklistDayLabel as getChecklistDayLabelDomain,
  getChecklistRangeDates as getChecklistRangeDatesDomain,
} from "./checklist-domain";

import {
  createBaseGroupsFixture,
  overviewDummySeeds,
} from "./app-domain-fixtures";

import type {
  NavId,
  NavItem,
  SessionAccessTier,
  StatusTone,
  GroupLifecycleStatus,
  TimelineItem,
  NextActivity,
  ItineraryItem,
  NoteItem,
  Musyrif,
  AgreementApprovalStatus,
  GroupRaudhahStatus,
  BusStatus,
  GroupAgreementHotel,
  GroupRaudhahAppointment,
  GroupVisaSetup,
  GroupData,
  GroupCompletenessIssueKey,
  GroupCompletenessIssue,
  GroupCompletenessState,
  GroupCompletenessSummary,
  ScheduleFormState,
  EditScheduleFormState,
  NoteFormState,
  MusyrifFormState,
  ChecklistItem,
  ChecklistDriverProfile,
  ChecklistAssignmentStatus,
  GroupChecklistAssignment,
  ChecklistDriverDraft,
  ChecklistDriverAssignment,
  VisaFilterId,
  VisaStatus,
  VisaPaymentStatus,
  VisaRaudhahTone,
  AgreementDraftAssignmentStatus,
  HotelAgreementDraft,
  HotelAgreementDraftFormState,
  VisaTrackingRow,
  InputItineraryItem,
  InputItineraryFormState,
  NewGroupItineraryDraft,
  ItineraryPrefillTrip,
  ItineraryPrefill,
  NewGroupAgreementFormState,
  NewGroupRaudhahFormState,
  VisaHotelEditFormState,
  VisaRaudhahEditFormState,
  TransferTrainFields,
  TransferTrainSegment,
  DummyGroupSeed,
} from "./app-domain-types";
export {
  getStatusByTone,
  includesKnownKeyword,
  nonSaudiLocationKeywords,
  resolveCurrentGroupTone,
  resolveGroupToneByItinerary,
  saudiLocationKeywords,
} from "./group-status-domain";
export {
  groups,
  overviewDummySeeds,
} from "./app-domain-fixtures";

export type {
  NavId,
  NavItem,
  SessionAccessTier,
  StatusTone,
  GroupLifecycleStatus,
  TimelineItem,
  NextActivity,
  ItineraryItem,
  NoteItem,
  Musyrif,
  AgreementApprovalStatus,
  GroupRaudhahStatus,
  BusStatus,
  GroupAgreementHotel,
  GroupRaudhahAppointment,
  GroupVisaSetup,
  GroupData,
  GroupCompletenessIssueKey,
  GroupCompletenessIssue,
  GroupCompletenessState,
  GroupCompletenessSummary,
  ScheduleFormState,
  EditScheduleFormState,
  NoteFormState,
  MusyrifFormState,
  ChecklistItem,
  ChecklistDriverProfile,
  ChecklistAssignmentStatus,
  GroupChecklistAssignment,
  ChecklistDriverDraft,
  ChecklistDriverAssignment,
  VisaFilterId,
  VisaStatus,
  VisaPaymentStatus,
  VisaRaudhahTone,
  AgreementDraftAssignmentStatus,
  HotelAgreementDraft,
  HotelAgreementDraftFormState,
  VisaTrackingRow,
  InputItineraryItem,
  InputItineraryFormState,
  NewGroupItineraryDraft,
  ItineraryPrefillTrip,
  ItineraryPrefill,
  NewGroupAgreementFormState,
  NewGroupRaudhahFormState,
  VisaHotelEditFormState,
  VisaRaudhahEditFormState,
  TransferTrainFields,
  TransferTrainSegment,
  DummyGroupSeed,
} from "./app-domain-types";
export {
  buildVisaAgreementNumber,
  formatVisaDateWithYear,
  formatVisaLongDate,
  formatVisaShortDate,
  generateWhatsappCopyText,
  getGroupAgreementHotelsByCity,
  hasMissingHotelAllocation,
  isIsoDateValue,
  isVisaRowActionRequired,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  resolveVisaProvider,
  shiftIsoDate,
};

export function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalIsoDateWithOffset(days: number): string {
  const nextDate = new Date();
  nextDate.setHours(12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + days);
  return formatLocalIsoDate(nextDate);
}

export function resolveValidRaudhahAppointments(group: GroupData | undefined): GroupRaudhahAppointment[] {
  const fallbackGroupCode = group?.code?.trim() || "group";

  return (group?.visaSetup?.raudhahAppointments ?? [])
    .map((appointment, index) => ({
      id: appointment.id?.trim() || `${fallbackGroupCode}-raudhah-${index + 1}`,
      dateIso: appointment.dateIso.trim(),
      status: appointment.status,
      tasrehPrinted: Boolean(appointment.tasrehPrinted),
    }))
    .filter((appointment) => isIsoDateValue(appointment.dateIso))
    .sort((left, right) => {
      const dateOrder = left.dateIso.localeCompare(right.dateIso);
      if (dateOrder !== 0) {
        return dateOrder;
      }

      return left.id.localeCompare(right.id);
    });
}

export const operatorAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDYxTyP2luvJIjGFQzfh0xRh0AHPBDoS_l-3WNItTegB4jnCMIfkjN_571ulocggZTAS6voqaMm4EoSA-kfN3SxNgXwoxo3NzlaWM8-b3HQoMbNFooz3nsVQqL3smWPEyp8UBTeqYDJEr1qfnNB68B9-4XfLzbyS06bFPL9b8w1TnJJnp2O_s6gH8MLguE3BOtb8uac28oSHRl62ewwxmQRLXyku6cbSP2nh2BszE7hmDB40X8HQtKF-kOCZ_UOJwRQ4i28LoZ6mys";

export const musyrifAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDh2QYe9f16M9LsFkFiiV-OWeoRQURwjlEBJp3y0F89mrcICkRZYBeBkUm_v0qJ-0yBwSt9K_oWvo7_ckbWvElV1I9mW0eNQp13OqJr51wrBQWMtG-BTce2SZQmPAB4D-vi6dN4r1WOZwOLU_Is3wpMQtnpUX0Q6ADcQpch-DsiK9LqNdTe66t4O5_thVoBNA5vZTfaC5uZWCis1rIXwkpdy8jYpB95SGSj2_tepJPL9kV9YNSbfHtNGlUneW0vOtsh7v8XP-XTxvk";

export const sidebarItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "checklist", label: "H-1 Checklist", icon: "fact_check" },
  { id: "visa", label: "Visa Tracking", icon: "fact_check" },
  { id: "agreement-inbox", label: "Agreement Inbox", icon: "inventory_2" },
  { id: "invoice", label: "Invoice", icon: "request_quote" },
  { id: "raudhah-reminder", label: "Raudhah Reminder", icon: "notifications_active" },
];

export const sidebarAccountItem: NavItem = {
  id: "profile",
  label: "Profile",
  icon: "account_circle",
};

export const mobileItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "checklist", label: "Checklist", icon: "fact_check" },
  { id: "visa", label: "Visa", icon: "fact_check" },
  { id: "profile", label: "Profile", icon: "account_circle" },
];

export const baseGroups: GroupData[] = createBaseGroupsFixture({
  musyrifAvatar,
  getLocalIsoDateWithOffset,
  formatScheduleDate,
});
export function formatAprilIsoDate(day: number): string {
  return `2026-04-${String(Math.min(Math.max(day, 1), 30)).padStart(2, "0")}`;
}

export function formatAprilDisplayDate(day: number): string {
  return `${Math.min(Math.max(day, 1), 30)} Apr`;
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
    : (earliestIsoDate ?? getLocalIsoDateWithOffset(0));
  const fallbackReturnDate = latestIsoDate ?? shiftIsoDate(normalizedArrivalDate, Math.max(1, group.durationDays - 1));
  const normalizedReturnDateCandidate = isIsoDateValue(currentReturnDate) ? currentReturnDate : fallbackReturnDate;
  const normalizedReturnDate =
    normalizedReturnDateCandidate >= normalizedArrivalDate ? normalizedReturnDateCandidate : normalizedArrivalDate;
  const tone =
    normalizedItinerary.length === 0
      ? group.tone
      : resolveCurrentGroupTone(resolveGroupToneByItinerary(normalizedItinerary), normalizedItinerary);
  const overviewSnapshot = buildOverviewSnapshotFromItinerary(normalizedItinerary, group);
  return {
    ...group,
    arrivalDate: normalizedArrivalDate,
    returnDate: normalizedReturnDate,
    itinerary: normalizedItinerary,
    timeline: overviewSnapshot.timeline,
    nextActivity: overviewSnapshot.nextActivity,
    tone,
    status: normalizedItinerary.length === 0 && group.status.trim() ? group.status : getStatusByTone(tone),
    totalBuses: resolveTotalBusCount(group.pax, group.totalBuses),
  };
}

export function createDummyOverviewGroups(): GroupData[] {
  return overviewDummySeeds.map((seed, index) => {
    const departureDay = seed.startDay;
    const arrivalDay = Math.min(seed.startDay + 1, 30);
    const operationDay = Math.min(seed.startDay + 2, 30);
    const departureTime = `${String(5 + (index % 6)).padStart(2, "0")}:${index % 2 === 0 ? "30" : "45"}`;
    const arrivalTime = `${String(9 + (index % 5)).padStart(2, "0")}:${index % 2 === 0 ? "10" : "25"}`;
    const operationTime = `${String(7 + (index % 6)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "15"}`;
    const flightNumber = `SV-${840 + index}`;
    const isCityTour = index % 2 === 0;
    const operationCategory = isCityTour ? "City Tour" : "Transfer";
    const operationCategoryKey = isCityTour ? "city-tour" : "transfer";
    const operationIcon = isCityTour ? "tour" : "airport_shuttle";
    const operationFrom = isCityTour ? "Makkah Hotel" : "Makkah";
    const operationTo = isCityTour ? "Jabal Rahmah" : "Madinah";
    const operationTitle = isCityTour ? "Makkah City Ziyarah" : "Transfer from Makkah to Madinah";
    const operationMeta = isCityTour
      ? `${formatScheduleTime(operationTime)} | Bus ${String((index % 9) + 1).padStart(2, "0")} | Gate A`
      : `${formatScheduleTime(operationTime)} | Highway Route 40`;

    return {
      code: seed.code,
      name: seed.name,
      status: getStatusByTone(seed.tone),
      tone: seed.tone,
      pax: seed.pax,
      totalBuses: resolveTotalBusCount(seed.pax),
      packageName: seed.packageName,
      durationDays: seed.durationDays,
      timeline: [
        { date: formatAprilDisplayDate(departureDay), title: "Departure from Jakarta" },
        {
          date: formatAprilDisplayDate(operationDay),
          title: operationTitle,
          isCurrent: true,
          nextActivity: `${operationCategory} (${formatScheduleTime(operationTime)})`,
        },
      ],
      nextActivity: {
        title: operationTitle,
        date: formatAprilDisplayDate(operationDay),
        time: operationTime,
        icon: operationIcon,
      },
      itinerary: [
        {
          date: formatAprilDisplayDate(departureDay),
          year: "2026",
          category: "Departure",
          categoryKey: "departure",
          title: "Depart from Jakarta to CGK Airport",
          meta: `${formatScheduleTime(departureTime)} | ${flightNumber} | Terminal 3`,
          icon: "flight_takeoff",
          flightNumber,
          isoDate: formatAprilIsoDate(departureDay),
          time: departureTime,
          hotelPickupRequestTime: departureTime,
          from: "Jakarta",
          to: "CGK Airport",
        },
        {
          date: formatAprilDisplayDate(arrivalDay),
          year: "2026",
          category: "Arrival",
          categoryKey: "arrival",
          title: "Landing at JED Airport and heading to Makkah",
          meta: `${formatScheduleTime(arrivalTime)} | Hajj Terminal | Group Bus`,
          icon: "flight_land",
          isoDate: formatAprilIsoDate(arrivalDay),
          time: arrivalTime,
          from: "JED Airport",
          to: "Makkah",
        },
        {
          date: formatAprilDisplayDate(operationDay),
          year: "2026",
          category: operationCategory,
          categoryKey: operationCategoryKey,
          title: operationTitle,
          meta: operationMeta,
          icon: operationIcon,
          highlighted: true,
          isoDate: formatAprilIsoDate(operationDay),
          time: operationTime,
          from: operationFrom,
          to: operationTo,
          cityTourCity: isCityTour ? operationFrom : "",
          requiresBus: true,
        },
      ],
      notes: [
        "Driver coordination needs reconfirmation 24 hours before schedule.",
        "Rooming and baggage list already shared with ground handling team.",
      ],
      musyrif: {
        name: seed.musyrifName,
        phone: seed.musyrifPhone,
        avatar: musyrifAvatar,
      },
    };
  });
}

export const scheduleTypeOptions = [
  { value: "arrival", cardLabel: "Arrival", modalLabel: "Arrival", icon: "flight_land" },
  { value: "city-tour", cardLabel: "City Tour", modalLabel: "City Tour", icon: "tour" },
  { value: "transfer", cardLabel: "Transfer", modalLabel: "Transfer", icon: "airport_shuttle" },
  { value: "departure", cardLabel: "Departure", modalLabel: "Departure", icon: "flight_takeoff" },
] as const;

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

export const OVERVIEW_PAGE_SIZE = 9;
export const CHECKLIST_PAGE_SIZE = 6;
export const VISA_PAGE_SIZE = 15;
export const MAX_PAX_PER_BUS = 50;

export function getMinimumBusCountForPax(pax: number): number {
  const safePax = Number.isFinite(pax) && pax > 0 ? pax : 1;
  return Math.max(1, Math.ceil(safePax / MAX_PAX_PER_BUS));
}

export function resolveTotalBusCount(pax: number, requestedTotalBuses?: number): number {
  const minimumBusCount = getMinimumBusCountForPax(pax);
  if (!Number.isFinite(requestedTotalBuses) || !requestedTotalBuses || requestedTotalBuses < 1) {
    return minimumBusCount;
  }

  return Math.max(minimumBusCount, Math.floor(requestedTotalBuses));
}

export function createInitialInputItineraryForm(): InputItineraryFormState {
  return {
    date: "",
    time: "",
    category: scheduleTypeOptions[1].value,
    hotelName: "",
    fromHotelName: "",
    from: "",
    to: "",
    cityTourCity: "",
    flightNumber: "",
    requiresBus: true,
    notes: "",
    transferByTrain: false,
    trainDepartureTime: "",
    destinationPickupTime: "",
    hotelPickupRequestTime: "",
  };
}

export function createNewGroupAgreementForm(city: "makkah" | "madinah"): NewGroupAgreementFormState {
  return {
    id: `${city}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    hotelName: "",
    agreementNumber: "",
    pax: "",
    status: "Waiting for Approval",
    stayStartIso: "",
    stayEndIso: "",
  };
}

export function createNewGroupRaudhahForm(): NewGroupRaudhahFormState {
  return {
    id: `raudhah-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dateIso: "",
    status: "Free",
    tasrehPrinted: false,
  };
}

export function sortInputItineraryItems(items: InputItineraryItem[]): InputItineraryItem[] {
  return [...items].sort((left, right) => {
    const leftKey = `${left.date}T${left.time || "00:00"}`;
    const rightKey = `${right.date}T${right.time || "00:00"}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function createInitialScheduleForm(): ScheduleFormState {
  return {
    category: scheduleTypeOptions[1].value,
    date: "",
    time: "",
    flightNumber: "",
    hotelName: "",
    fromHotelName: "",
    from: "",
    to: "",
    cityTourCity: "",
    note: "",
    highlighted: false,
    transferByTrain: false,
    trainDepartureTime: "",
    destinationPickupTime: "",
    hotelPickupRequestTime: "",
  };
}

export function createInitialNoteForm(): NoteFormState {
  return {
    text: "",
    pinned: false,
  };
}

export function createEmptyChecklistDriverProfile(): ChecklistDriverProfile {
  return {
    name: "",
    phone: "",
    plateNumber: "",
  };
}

export function createEmptyChecklistDraft(): ChecklistDriverDraft {
  return createEmptyChecklistDriverProfile();
}

export function createNoteItems(notes: string[], groupCode: string): NoteItem[] {
  return notes.map((note, index) => ({
    id: `${groupCode}-note-${index}`,
    text: note,
    pinned: false,
  }));
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
  if (!isTransferActivityType(fields.category) || !fields.transferByTrain) {
    return false;
  }

  return !fields.trainDepartureTime.trim() || !fields.destinationPickupTime.trim();
}

export function buildTransferTrainSummary(fields: TransferTrainFields): string {
  if (!isTransferActivityType(fields.category) || !fields.transferByTrain) {
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
  const isTransferByTrain = category === "transfer" && (item.transferByTrain ?? false);
  const isDepartureActivity = isDepartureActivityType(category);
  const rawFromValue = (item.from ?? "").trim();
  const rawToValue = (item.to ?? item.title).trim();
  const fromValue = category === "transfer" ? normalizeSaudiCityValue(rawFromValue) : rawFromValue;
  const toValue = category === "arrival" || category === "transfer" ? normalizeSaudiCityValue(rawToValue) : rawToValue;

  return {
    date: item.isoDate ?? parseDisplayDateToIso(item.date, item.year),
    time: parsedTime,
    category,
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
  const nextCityTourCity = isCityTourActivityType(form.category) ? form.cityTourCity.trim() : "";
  const nextTitle =
    form.from.trim() && form.to.trim()
      ? formatRouteSummary(form.category, form.from, form.to, nextCityTourCity)
      : currentItem.title;
  const nextFlightNumber = isFlightActivityType(form.category) ? form.flightNumber.trim() : "";
  const shouldPersistHotelName =
    form.category === "arrival" || form.category === "city-tour" || form.category === "departure";
  const nextHotelName = shouldPersistHotelName ? (form.hotelName?.trim() ?? "") : "";
  const nextFromHotelName = "";
  const nextHotelPickupRequestTime = isDepartureActivityType(form.category) ? form.hotelPickupRequestTime.trim() : "";
  const isTransferByTrain = isTransferActivityType(form.category) && form.transferByTrain;
  const scheduleTime = isTransferByTrain ? form.trainDepartureTime : form.time;
  const transferTrainSummary = buildTransferTrainSummary(form);

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
    icon: typeOption.icon,
    categoryKey: typeOption.value,
    isoDate: form.date,
    time: scheduleTime,
    flightNumber: nextFlightNumber,
    hotelName: nextHotelName,
    fromHotelName: nextFromHotelName,
    from: form.from.trim(),
    to: form.to.trim(),
    cityTourCity: nextCityTourCity,
    requiresBus: isTransferByTrain ? true : form.requiresBus,
    notes: form.notes.trim(),
    transferByTrain: isTransferByTrain,
    trainDepartureTime: isTransferByTrain ? form.trainDepartureTime.trim() : "",
    destinationPickupTime: isTransferByTrain ? form.destinationPickupTime.trim() : "",
    hotelPickupRequestTime: nextHotelPickupRequestTime,
  };
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
    const transferIcon = "airport_shuttle";
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
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        flightNumber: "",
        requiresBus: true,
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
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        flightNumber: "",
        requiresBus: true,
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
    const transferIcon = "airport_shuttle";
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
        flightNumber: "",
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        requiresBus: true,
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
        flightNumber: "",
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        requiresBus: true,
        notes: "",
        transferByTrain: false,
        trainDepartureTime: "",
        destinationPickupTime: "",
        hotelPickupRequestTime: "",
      },
    ];
  });
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getChecklistRangeDates(): string[] {
  return getChecklistRangeDatesDomain(getLocalIsoDateWithOffset);
}

export function getChecklistDayLabel(tripDate: string): string {
  return getChecklistDayLabelDomain(tripDate);
}

export function formatChecklistCopyDate(tripDate: string): string {
  return formatChecklistCopyDateDomain(tripDate);
}
export function getItineraryIsoDate(item: ItineraryItem): string {
  return item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
}

function resolveItineraryBoundaryIsoDates(itinerary: ItineraryItem[]): {
  earliestIsoDate: string | null;
  latestIsoDate: string | null;
} {
  let earliestKey: string | null = null;
  let latestKey: string | null = null;
  let earliestIsoDate: string | null = null;
  let latestIsoDate: string | null = null;

  for (const item of itinerary) {
    const itineraryIsoDate = getItineraryIsoDate(item);
    const metaTime = parseTimeForInput(item.meta.split(" | ")[0] ?? "");
    const itineraryTime = item.time?.trim() || metaTime || "00:00";
    const sortKey = `${itineraryIsoDate || "9999-12-31"}T${itineraryTime}`;

    if (earliestKey === null || sortKey.localeCompare(earliestKey) < 0) {
      earliestKey = sortKey;
      earliestIsoDate = itineraryIsoDate || null;
    }

    if (latestKey === null || sortKey.localeCompare(latestKey) > 0) {
      latestKey = sortKey;
      latestIsoDate = itineraryIsoDate || null;
    }
  }

  return {
    earliestIsoDate,
    latestIsoDate,
  };
}

function collectGroupAgreementHotels(group: GroupData): GroupAgreementHotel[] {
  return [...getGroupAgreementHotelsByCity(group, "makkah"), ...getGroupAgreementHotelsByCity(group, "madinah")];
}

function resolveAgreementDateBounds(group: GroupData): {
  earliestAgreementIsoDate: string | null;
  latestAgreementIsoDate: string | null;
} {
  const dates = collectGroupAgreementHotels(group)
    .flatMap((hotel) => [hotel.stayStartIso, hotel.stayEndIso])
    .map((value) => value.trim())
    .filter(isIsoDateValue)
    .sort();

  return {
    earliestAgreementIsoDate: dates[0] ?? null,
    latestAgreementIsoDate: dates.at(-1) ?? null,
  };
}

export function getStayPeriods(hotels: GroupAgreementHotel[]): Array<{ startIso: string; endIso: string }> {
  const parsed = hotels
    .map((h) => {
      const startIso = h.stayStartIso.trim();
      const endIso = h.stayEndIso.trim();
      if (!isIsoDateValue(startIso) || !isIsoDateValue(endIso)) {
        return null;
      }
      return { startIso, endIso, startMs: Date.parse(startIso), endMs: Date.parse(endIso) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.startMs - b.startMs);

  if (parsed.length === 0) {
    return [];
  }

  const merged: Array<{ startIso: string; endIso: string; startMs: number; endMs: number }> = [];
  let current = { ...parsed[0] };

  for (let i = 1; i < parsed.length; i++) {
    const next = parsed[i];
    if (next.startMs <= current.endMs) {
      if (next.endMs > current.endMs) {
        current.endIso = next.endIso;
        current.endMs = next.endMs;
      }
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);

  return merged.map((m) => ({ startIso: m.startIso, endIso: m.endIso }));
}

function getDistinctNightTimes(hotels: GroupAgreementHotel[]): number[] {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const nights = new Set<number>();

  for (const hotel of hotels) {
    const startIso = hotel.stayStartIso.trim();
    const endIso = hotel.stayEndIso.trim();
    if (!isIsoDateValue(startIso) || !isIsoDateValue(endIso)) {
      continue;
    }
    const startMs = Date.parse(startIso);
    const endMs = Date.parse(endIso);
    
    // Iterate over each night
    for (let currentMs = startMs; currentMs < endMs; currentMs += ONE_DAY_MS) {
      nights.add(currentMs);
    }
  }

  return Array.from(nights).sort((a, b) => a - b);
}

function hasAgreementPaxMismatch(group: GroupData): boolean {
  const makkahHotels = getGroupAgreementHotelsByCity(group, "makkah");
  const madinahHotels = getGroupAgreementHotelsByCity(group, "madinah");
  const groupPax = Math.max(1, group.pax);

  if (makkahHotels.length > 0 && calculateVerifiedPaxFn(makkahHotels, groupPax) < groupPax) {
    return true;
  }
  
  if (madinahHotels.length > 0 && calculateVerifiedPaxFn(madinahHotels, groupPax) < groupPax) {
    return true;
  }

  return false;
}

function calculateVerifiedPaxFn(hotels: GroupAgreementHotel[], groupPax: number): number {
  if (hotels.length === 0) {
    return 0;
  }
  
  const nightTimes = getDistinctNightTimes(hotels);
  if (nightTimes.length === 0) {
    return 0;
  }

  let minSum = Infinity;

  for (const nightMs of nightTimes) {
    const nightHotels = hotels.filter((h) => {
      const hStart = h.stayStartIso.trim();
      const hEnd = h.stayEndIso.trim();
      if (!isIsoDateValue(hStart) || !isIsoDateValue(hEnd)) {
        return false;
      }
      const startMs = Date.parse(hStart);
      const endMs = Date.parse(hEnd);
      // Included if nightMs is within [startMs, endMs)
      return nightMs >= startMs && nightMs < endMs;
    });

    const sum = nightHotels.reduce((total, h) => total + Math.max(0, h.pax || 0), 0);
    if (sum < minSum) {
      minSum = sum;
    }
  }

  return Math.min(groupPax, minSum);
}

export function resolveGroupCompleteness(group: GroupData): GroupCompletenessSummary {
  const issues: GroupCompletenessIssue[] = [];
  const hasIdentity = Boolean(group.code.trim() && group.name.trim() && group.pax > 0);
  const makkahAgreements = getGroupAgreementHotelsByCity(group, "makkah");
  const madinahAgreements = getGroupAgreementHotelsByCity(group, "madinah");
  const hasMakkahAgreement = makkahAgreements.length > 0;
  const hasMadinahAgreement = madinahAgreements.length > 0;
  const hasAnyAgreement = hasMakkahAgreement || hasMadinahAgreement;
  const hasItinerary = group.itinerary.length > 0;
  const { earliestIsoDate, latestIsoDate } = resolveItineraryBoundaryIsoDates(group.itinerary);
  const { earliestAgreementIsoDate, latestAgreementIsoDate } = resolveAgreementDateBounds(group);

  if (!hasIdentity) {
    issues.push({
      key: "missing-identity",
      severity: "error",
      label: "Identity",
      message: "Group identity belum lengkap.",
    });
  }

  if (!hasAnyAgreement) {
    issues.push({
      key: "missing-agreement",
      severity: "warning",
      label: "Agreement",
      message: "Agreement hotel belum tersambung.",
    });
  } else {
    if (!hasMakkahAgreement) {
      issues.push({
        key: "missing-makkah-agreement",
        severity: "warning",
        label: "Makkah",
        message: "Agreement Makkah belum tersambung.",
      });
    }

    if (!hasMadinahAgreement) {
      issues.push({
        key: "missing-madinah-agreement",
        severity: "warning",
        label: "Madinah",
        message: "Agreement Madinah belum tersambung.",
      });
    }
  }

  if (!hasItinerary) {
    issues.push({
      key: "missing-itinerary",
      severity: "warning",
      label: "Itinerary",
      message: "Itinerary belum dibuat atau belum dihubungkan.",
    });
  }

  if (hasAgreementPaxMismatch(group)) {
    issues.push({
      key: "pax-mismatch",
      severity: "warning",
      label: "Pax",
      message: "Pax agreement berbeda dengan pax group.",
    });
  }


  const allHotels = collectGroupAgreementHotels(group);
  const periods = getStayPeriods(allHotels);
  const isContinuous = periods.length === 1;
  const coversItinerary =
    isContinuous && periods[0].startIso === earliestIsoDate && periods[0].endIso === latestIsoDate;

  if (hasAnyAgreement && !isContinuous) {
    issues.push({
      key: "date-mismatch",
      severity: "warning",
      label: "Dates",
      message: "Terdapat tanggal kosong (gap) antar agreement hotel.",
    });
  } else if (
    hasAnyAgreement &&
    hasItinerary &&
    earliestIsoDate &&
    latestIsoDate &&
    !coversItinerary
  ) {
    issues.push({
      key: "date-mismatch",
      severity: "warning",
      label: "Dates",
      message: "Tanggal agreement belum selaras dengan batas itinerary.",
    });
  }

  const hasError = issues.some((issue) => issue.severity === "error");
  const state: GroupCompletenessState = issues.length === 0 ? "ready" : hasError ? "action-required" : "incomplete";
  const primaryMessage = issues[0]?.message ?? "Group sudah punya identity, agreement, dan itinerary yang tersambung.";

  return {
    state,
    isReadyForOperations: state === "ready",
    issues,
    primaryMessage,
    badgeLabel: state === "ready" ? "Ready" : state === "action-required" ? "Action Required" : "Incomplete",
  };
}

export function buildVisaTrackingRowsFromGroups(groups: GroupData[]): VisaTrackingRow[] {
  return groups.map((group, index) => {
    const visaSetup = group.visaSetup;
    const { earliestIsoDate, latestIsoDate } = resolveItineraryBoundaryIsoDates(group.itinerary);
    const configuredArrivalIso = group.arrivalDate?.trim() ?? "";
    const configuredReturnIso = group.returnDate?.trim() ?? "";
    const groupArrivalIso = isIsoDateValue(configuredArrivalIso) ? configuredArrivalIso : "";
    const groupReturnIso = isIsoDateValue(configuredReturnIso) ? configuredReturnIso : "";
    const fallbackDeparture = getLocalIsoDateWithOffset(index % 4);
    const itineraryDepartureIso = groupArrivalIso || earliestIsoDate || fallbackDeparture;
    const resolvedReturnIso = groupReturnIso || latestIsoDate || "";
    const itineraryReturnIso =
      resolvedReturnIso && resolvedReturnIso >= itineraryDepartureIso
        ? resolvedReturnIso
        : shiftIsoDate(itineraryDepartureIso, Math.max(6, group.durationDays - 1));
    const customAgreementDateRange = resolveVisaAgreementDateRange(
      { departureIso: itineraryDepartureIso, returnIso: itineraryReturnIso },
      group.durationDays,
      group,
    );
    const departureIso = customAgreementDateRange.makkahStartIso;
    const returnIso = customAgreementDateRange.madinahEndIso;

    const visaStatus: VisaStatus = visaSetup?.visaStatus ?? "Draft";
    const paymentStatus: VisaPaymentStatus = visaSetup?.paymentStatus ?? "Unpaid";
    const configuredIssuedDate = visaSetup?.issuedDate?.trim() ?? "";
    const issuedDateIso =
      visaStatus === "Issued" ? (isIsoDateValue(configuredIssuedDate) ? configuredIssuedDate : departureIso) : "";

    const pax = Math.max(1, group.pax);
    const verifiedMakkahPax = calculateVerifiedPaxFn(getGroupAgreementHotelsByCity(group, "makkah"), pax);
    const verifiedMadinahPax = calculateVerifiedPaxFn(getGroupAgreementHotelsByCity(group, "madinah"), pax);
    const verifiedPax = Math.min(verifiedMakkahPax, verifiedMadinahPax);
    const makkahVerified = verifiedMakkahPax;
    const madinahVerified = verifiedMadinahPax;

    const validRaudhahAppointments = resolveValidRaudhahAppointments(group);
    const firstRaudhah =
      validRaudhahAppointments.find((appointment) => appointment.status !== "Free") ?? validRaudhahAppointments[0];
    const raudhahTone: VisaRaudhahTone =
      !firstRaudhah || firstRaudhah.status === "Free" ? "muted" : firstRaudhah.status === "Before" ? "warn" : "good";
    const raudhahLabel =
      !firstRaudhah || firstRaudhah.status === "Free"
        ? "Not Set"
        : `${formatVisaShortDate(firstRaudhah.dateIso)} ${firstRaudhah.status}`;
    const raudhahHint =
      !firstRaudhah || firstRaudhah.status === "Free"
        ? "Appointment pending"
        : firstRaudhah.status === "Before"
          ? "Before 13:00"
          : "After 13:00";

    const outstandingAmount = paymentStatus === "Unpaid" ? pax * 280 : paymentStatus === "Partial" ? pax * 120 : 0;

    return {
      id: `${group.code}-visa-${index}`,
      groupCode: group.code,
      groupName: group.name,
      pax,
      packageName: group.packageName,
      issuedDateIso,
      departureIso,
      returnIso,
      visaStatus,
      paymentStatus,
      raudhahLabel,
      raudhahHint,
      raudhahTone,
      makkahVerified,
      madinahVerified,
      outstandingAmount,
      parentGroupId: group.parentGroupId,
    };
  });
}

export function buildChecklistActivityLabel(item: ItineraryItem, categoryKey: string): string {
  return buildChecklistActivityLabelDomain(item, categoryKey, inferCityTourCity);
}

export function buildChecklistItemsFromGroups(groups: GroupData[]): ChecklistItem[] {
  return buildChecklistItemsFromGroupsDomain(groups, {
    getLocalIsoDateWithOffset,
    inferCityTourCity,
    expandTransferTrainItineraryItems,
    parseDisplayDateToIso,
    inferCategoryKey,
    getScheduleTypeOption,
    parseTimeForInput,
    formatScheduleTime,
    resolveTotalBusCount,
    formatRouteSummary,
  });
}
export function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
