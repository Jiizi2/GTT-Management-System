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
  filterAgreementDrafts,
  getInclusiveDays,
} from "./visa-domain.js";

import { getStatusByTone, resolveCurrentGroupTone, resolveGroupToneByItinerary } from "./group-status-domain";

import {
  buildChecklistActivityLabel as buildChecklistActivityLabelDomain,
  buildChecklistItemsFromGroups as buildChecklistItemsFromGroupsDomain,
  formatChecklistCopyDate as formatChecklistCopyDateDomain,
  getChecklistDayLabel as getChecklistDayLabelDomain,
  getChecklistRangeDates as getChecklistRangeDatesDomain,
} from "./checklist-domain";

import {
  buildVisaTrackingRowsFromGroups as buildVisaTrackingRowsFromGroupsDomain,
  getStayPeriods as getStayPeriodsDomain,
  resolveGroupCompleteness as resolveGroupCompletenessDomain,
} from "./group-visa-domain";

import {
  buildItineraryItemFromEditForm,
  buildTransferTrainSummary,
  createEditScheduleForm,
  createScheduleMeta,
  detectCityFromText,
  expandInputTransferTrainItems,
  expandTransferTrainItineraryItems,
  formatRouteSummary,
  formatScheduleDate,
  formatScheduleTime,
  getItineraryIsoDate,
  getRouteFieldConfigByCategory,
  getSaudiCityOptions,
  getScheduleTypeOption,
  getTransferTrainSegmentCategory,
  hasIncompleteTransferTrainFields,
  inferCategoryKey,
  inferCityTourCity,
  isCityTourActivityType,
  isDepartureActivityType,
  isFlightActivityType,
  isFridayDate,
  isTransferActivityType,
  normalizeAgreementCityKey,
  normalizeSaudiCityValue,
  parseDisplayDateToIso,
  parseTimeForInput,
  registerSaudiCityOptions,
  saudiCityOptions,
  scheduleTypeOptions,
  shouldShowFridayCityTourWarning,
  sortInputItineraryItems,
} from "./itinerary-domain";

import { createBaseGroupsFixture, overviewDummySeeds } from "./app-domain-fixtures";

import type {
  NavItem,
  TimelineItem,
  NextActivity,
  ItineraryItem,
  NoteItem,
  GroupAgreementHotel,
  GroupRaudhahAppointment,
  GroupData,
  GroupCompletenessSummary,
  ScheduleFormState,
  NoteFormState,
  ChecklistItem,
  ChecklistDriverProfile,
  ChecklistDriverDraft,
  VisaTrackingRow,
  InputItineraryFormState,
  NewGroupAgreementFormState,
  NewGroupRaudhahFormState,
} from "./app-domain-types";
export {
  getStatusByTone,
  includesKnownKeyword,
  nonSaudiLocationKeywords,
  resolveCurrentGroupTone,
  resolveGroupToneByItinerary,
  saudiLocationKeywords,
} from "./group-status-domain";
export { groups, overviewDummySeeds } from "./app-domain-fixtures";

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
  filterAgreementDrafts,
  getInclusiveDays,
};
export {
  buildItineraryItemFromEditForm,
  buildTransferTrainSummary,
  createEditScheduleForm,
  createScheduleMeta,
  detectCityFromText,
  expandInputTransferTrainItems,
  expandTransferTrainItineraryItems,
  formatRouteSummary,
  formatScheduleDate,
  formatScheduleTime,
  getItineraryIsoDate,
  getRouteFieldConfigByCategory,
  getSaudiCityOptions,
  getScheduleTypeOption,
  getTransferTrainSegmentCategory,
  hasIncompleteTransferTrainFields,
  inferCategoryKey,
  inferCityTourCity,
  isCityTourActivityType,
  isDepartureActivityType,
  isFlightActivityType,
  isFridayDate,
  isTransferActivityType,
  normalizeAgreementCityKey,
  normalizeSaudiCityValue,
  parseDisplayDateToIso,
  parseTimeForInput,
  registerSaudiCityOptions,
  saudiCityOptions,
  scheduleTypeOptions,
  shouldShowFridayCityTourWarning,
  sortInputItineraryItems,
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

export const OVERVIEW_PAGE_SIZE = 9;
export const CHECKLIST_PAGE_SIZE = 6;
export const VISA_PAGE_SIZE = 8;
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

export function getStayPeriods(hotels: GroupAgreementHotel[]): Array<{ startIso: string; endIso: string }> {
  return getStayPeriodsDomain(hotels);
}

export function resolveGroupCompleteness(group: GroupData): GroupCompletenessSummary {
  return resolveGroupCompletenessDomain(group, {
    getItineraryIsoDate,
    parseTimeForInput,
  });
}

export function buildVisaTrackingRowsFromGroups(groups: GroupData[]): VisaTrackingRow[] {
  return buildVisaTrackingRowsFromGroupsDomain(groups, {
    getItineraryIsoDate,
    parseTimeForInput,
    getLocalIsoDateWithOffset,
    resolveValidRaudhahAppointments,
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
