import {
  formatScheduleTime,
  getItineraryIsoDate,
  getLocalIsoDateWithOffset,
  parseTimeForInput,
} from "../shared/app-domain";
import type { GroupData, VisaHotelEditFormState } from "../shared/app-domain";
import {
  mapAgreementStatusToBackend,
  mapBusStatusToBackend,
  mapChecklistStatusToBackend,
  mapPaymentStatusToBackend,
  mapRaudhahStatusToBackend,
  mapVisaStatusToBackend,
  type BackendAgreementApprovalStatus,
  type BackendChecklistAssignmentStatus,
  type BackendRaudhahStatus,
  type BackendVisaBusStatus,
  type BackendVisaPaymentStatus,
  type BackendVisaStatus,
} from "../shared/backend-enums";

type BackendCreateGroupPayload = {
  code: string;
  name: string;
  status: string;
  arrivalDate: string;
  returnDate: string;
  tone: "ACTIVE" | "INACTIVE";
  pax: number;
  totalBuses?: number;
  packageName: string;
  durationDays: number;
  parentGroupId?: string | null;
  musyrif?: {
    name: string;
    phone: string;
    avatar: string;
  };
  nextActivity?: {
    title: string;
    dateLabel: string;
    timeLabel: string;
    icon: string;
  };
  timeline?: Array<{
    sortOrder: number;
    dateLabel: string;
    title: string;
    isCurrent?: boolean;
    nextActivity?: string;
  }>;
  itinerary?: Array<{
    sortOrder: number;
    dateLabel: string;
    yearLabel: string;
    category: string;
    categoryKey?: string;
    title: string;
    meta: string;
    icon: string;
    highlighted?: boolean;
    isoDate?: string;
    time?: string;
    flightNumber?: string;
    hotelName?: string;
    fromHotelName?: string;
    fromLocation?: string;
    toLocation?: string;
    cityTourCity?: string;
    requiresBus?: boolean;
    notes?: string;
    transferByTrain?: boolean;
    trainDepartureTime?: string;
    destinationPickupTime?: string;
    hotelPickupRequestTime?: string;
  }>;
  notes?: Array<{
    sortOrder: number;
    text: string;
    pinned?: boolean;
  }>;
  visaSetup?: {
    visaStatus?: BackendVisaStatus;
    issuedDate?: string;
    syarikah: string;
    busStatus?: BackendVisaBusStatus;
    paymentStatus?: BackendVisaPaymentStatus;
    outstandingAmount?: number;
    hotelAgreements?: Array<{
      city: "MAKKAH" | "MADINAH";
      sourceDraftId?: string;
      hotelName: string;
      agreementNumber: string;
      pax: number;
      status?: BackendAgreementApprovalStatus;
      stayStart: string;
      stayEnd: string;
    }>;
    raudhahAppointments?: Array<{
      date: string;
      status?: BackendRaudhahStatus;
      tasrehPrinted?: boolean;
    }>;
  };
  checklistAssignments?: Array<{
    itineraryItemId?: string;
    tripDate: string;
    activity: string;
    tripLabel: string;
    requiredBusCount: number;
    scheduledTime: string;
    transferByTrain?: boolean;
    trainDepartureTime?: string;
    stationPickupTime?: string;
    status?: BackendChecklistAssignmentStatus;
    drivers?: Array<{
      slotNumber?: number;
      name: string;
      phone: string;
      plateNumber: string;
      isVerified?: boolean;
    }>;
  }>;
};

export function mapToneToBackend(tone: GroupData["tone"]): "ACTIVE" | "INACTIVE" {
  return tone === "active" ? "ACTIVE" : "INACTIVE";
}

export function mapVisaHotelEditFormToBackendPayload(city: "makkah" | "madinah", hotel: VisaHotelEditFormState) {
  const parsedPax = Number.parseInt(hotel.pax, 10);
  return {
    city: city === "madinah" ? ("MADINAH" as const) : ("MAKKAH" as const),
    hotelName: hotel.hotelName.trim(),
    agreementNumber: hotel.agreementNumber.trim(),
    pax: Number.isFinite(parsedPax) ? parsedPax : 1,
    status: mapAgreementStatusToBackend(hotel.status),
    stayStart: hotel.stayStartIso.trim(),
    stayEnd: hotel.stayEndIso.trim(),
  };
}

function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeStoredTimeLabel(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  const normalized = formatScheduleTime(trimmedValue);
  return normalized === "TBD" ? "" : normalized;
}

function normalizeTimePrefixInPipeSeparatedText(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  const segments = trimmedValue
    .split("|")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return "";
  }

  const [firstSegment, ...remainingSegments] = segments;
  const normalizedFirstSegment = normalizeStoredTimeLabel(firstSegment) || firstSegment;
  return [normalizedFirstSegment, ...remainingSegments].join(" | ");
}

function parseIsoDateToUtcMiddayMs(isoDate: string): number | null {
  const trimmed = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const parsed = new Date(`${trimmed}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getTime();
}

function toIsoDateWithAddedDays(isoDate: string, dayOffset: number): string | null {
  const baseMs = parseIsoDateToUtcMiddayMs(isoDate);
  if (baseMs === null) {
    return null;
  }

  return new Date(baseMs + dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function resolveItineraryBoundaryIsoDates(itinerary: GroupData["itinerary"]): {
  earliestIsoDate: string | null;
  latestIsoDate: string | null;
} {
  let earliestKey: string | null = null;
  let latestKey: string | null = null;
  let earliestIsoDate: string | null = null;
  let latestIsoDate: string | null = null;

  for (const item of itinerary) {
    const itineraryIsoDate = getItineraryIsoDate(item).trim();
    if (!isIsoDateOnly(itineraryIsoDate)) {
      continue;
    }

    const metaTime = parseTimeForInput(item.meta.split(" | ")[0] ?? "");
    const itineraryTime = item.time?.trim() || metaTime || "00:00";
    const sortKey = `${itineraryIsoDate}T${itineraryTime}`;

    if (earliestKey === null || sortKey.localeCompare(earliestKey) < 0) {
      earliestKey = sortKey;
      earliestIsoDate = itineraryIsoDate;
    }

    if (latestKey === null || sortKey.localeCompare(latestKey) > 0) {
      latestKey = sortKey;
      latestIsoDate = itineraryIsoDate;
    }
  }

  return {
    earliestIsoDate,
    latestIsoDate,
  };
}

export function resolveGroupTravelDates(group: GroupData): { arrivalDate: string; returnDate: string } {
  const configuredArrivalDate = group.arrivalDate?.trim() ?? "";
  const configuredReturnDate = group.returnDate?.trim() ?? "";
  const { earliestIsoDate, latestIsoDate } = resolveItineraryBoundaryIsoDates(group.itinerary);
  const arrivalDate = isIsoDateOnly(configuredArrivalDate)
    ? configuredArrivalDate
    : (earliestIsoDate ?? getLocalIsoDateWithOffset(0));
  const fallbackReturnDate =
    latestIsoDate ?? toIsoDateWithAddedDays(arrivalDate, Math.max(1, group.durationDays - 1)) ?? arrivalDate;
  const returnDateCandidate = isIsoDateOnly(configuredReturnDate) ? configuredReturnDate : fallbackReturnDate;
  const returnDate = returnDateCandidate >= arrivalDate ? returnDateCandidate : arrivalDate;

  return {
    arrivalDate,
    returnDate,
  };
}

export function mapGroupToBackendPayload(group: GroupData): BackendCreateGroupPayload {
  const { arrivalDate, returnDate } = resolveGroupTravelDates(group);
  const normalizedNextActivityTimeLabel =
    normalizeStoredTimeLabel(group.nextActivity?.time.trim() ?? "") ||
    normalizeStoredTimeLabel(group.itinerary.find((item) => item.time?.trim())?.time?.trim() ?? "") ||
    "09:00";
  const payload: BackendCreateGroupPayload = {
    code: group.code.trim().toUpperCase(),
    name: group.name.trim(),
    status: group.status.trim(),
    arrivalDate,
    returnDate,
    tone: mapToneToBackend(group.tone),
    pax: group.pax,
    totalBuses: group.totalBuses,
    packageName: group.packageName.trim(),
    durationDays: group.durationDays,
    musyrif: group.musyrif
      ? {
        name: group.musyrif.name.trim(),
        phone: group.musyrif.phone.trim(),
        avatar: group.musyrif.avatar.trim(),
      }
      : undefined,
    nextActivity: group.nextActivity
      ? {
        title: group.nextActivity.title.trim(),
        dateLabel: group.nextActivity.date.trim(),
        timeLabel: normalizedNextActivityTimeLabel,
        icon: group.nextActivity.icon.trim(),
      }
      : undefined,
    timeline: group.timeline.map((item, index) => ({
      sortOrder: index,
      dateLabel: item.date.trim(),
      title: item.title.trim(),
      isCurrent: item.isCurrent,
      nextActivity: normalizeTimePrefixInPipeSeparatedText(item.nextActivity?.trim() ?? ""),
    })),
    itinerary: group.itinerary.map((item, index) => ({
      sortOrder: index,
      dateLabel: item.date.trim(),
      yearLabel: item.year.trim(),
      category: item.category.trim(),
      categoryKey: item.categoryKey?.trim(),
      title: item.title.trim(),
      meta: normalizeTimePrefixInPipeSeparatedText(item.meta.trim()),
      icon: item.icon.trim(),
      highlighted: item.highlighted,
      isoDate: item.isoDate?.trim(),
      time: normalizeStoredTimeLabel(item.time?.trim() ?? "") || undefined,
      flightNumber: item.flightNumber?.trim(),
      hotelName: item.hotelName?.trim(),
      fromHotelName: item.fromHotelName?.trim(),
      fromLocation: item.from?.trim(),
      toLocation: item.to?.trim(),
      cityTourCity: item.cityTourCity?.trim(),
      requiresBus: item.requiresBus,
      notes: item.notes?.trim(),
      transferByTrain: item.transferByTrain,
      trainDepartureTime: normalizeStoredTimeLabel(item.trainDepartureTime?.trim() ?? "") || undefined,
      destinationPickupTime: normalizeStoredTimeLabel(item.destinationPickupTime?.trim() ?? "") || undefined,
      hotelPickupRequestTime: normalizeStoredTimeLabel(item.hotelPickupRequestTime?.trim() ?? "") || undefined,
    })),
    notes: (() => {
      const filteredNotes = group.notes.filter((text) => !/^bus status\s*:/i.test(text));
      if (group.visaSetup?.busStatus) {
        filteredNotes.push(`Bus status: ${group.visaSetup.busStatus}`);
      }
      return filteredNotes.map((text, index) => ({
        sortOrder: index,
        text: text.trim(),
        pinned: false,
      }));
    })(),
    parentGroupId: group.parentGroupId || null,
  };

  if (group.visaSetup) {
    const normalizedIssuedDate = group.visaSetup.issuedDate?.trim() ?? "";
    const resolvedSyarikah = group.visaSetup.syarikah.trim() || "Not assigned";
    payload.visaSetup = {
      visaStatus: mapVisaStatusToBackend(group.visaSetup.visaStatus),
      issuedDate: /^\d{4}-\d{2}-\d{2}$/.test(normalizedIssuedDate) ? normalizedIssuedDate : undefined,
      syarikah: resolvedSyarikah,
      busStatus: mapBusStatusToBackend(group.visaSetup.busStatus),
      paymentStatus: mapPaymentStatusToBackend(group.visaSetup.paymentStatus),
      outstandingAmount: 0,
      hotelAgreements: [
        ...group.visaSetup.makkahHotels.map((hotel) => ({
          city: "MAKKAH" as const,
          sourceDraftId: hotel.sourceDraftId?.trim() || undefined,
          hotelName: hotel.hotelName.trim(),
          agreementNumber: hotel.agreementNumber.trim(),
          pax: hotel.pax,
          status: mapAgreementStatusToBackend(hotel.status),
          stayStart: hotel.stayStartIso,
          stayEnd: hotel.stayEndIso,
        })),
        ...group.visaSetup.madinahHotels.map((hotel) => ({
          city: "MADINAH" as const,
          sourceDraftId: hotel.sourceDraftId?.trim() || undefined,
          hotelName: hotel.hotelName.trim(),
          agreementNumber: hotel.agreementNumber.trim(),
          pax: hotel.pax,
          status: mapAgreementStatusToBackend(hotel.status),
          stayStart: hotel.stayStartIso,
          stayEnd: hotel.stayEndIso,
        })),
      ],
      raudhahAppointments: group.visaSetup.raudhahAppointments
        .map((appointment) => ({
          date: appointment.dateIso.trim(),
          status: mapRaudhahStatusToBackend(appointment.status),
          tasrehPrinted: Boolean(appointment.tasrehPrinted),
        }))
        .filter((appointment) => isIsoDateOnly(appointment.date)),
    };
  }

  if (group.checklistAssignments && group.checklistAssignments.length > 0) {
    payload.checklistAssignments = group.checklistAssignments.map((assignment) => ({
      itineraryItemId: assignment.itineraryItemId?.trim() || undefined,
      tripDate: assignment.tripDate.trim(),
      activity: assignment.activity.trim(),
      tripLabel: assignment.tripLabel.trim(),
      requiredBusCount: Math.max(1, assignment.requiredBusCount),
      scheduledTime: normalizeStoredTimeLabel(assignment.scheduledTime) || assignment.scheduledTime.trim(),
      transferByTrain: assignment.transferByTrain,
      trainDepartureTime: normalizeStoredTimeLabel(assignment.trainDepartureTime) || undefined,
      stationPickupTime: normalizeStoredTimeLabel(assignment.stationPickupTime) || undefined,
      status: mapChecklistStatusToBackend(assignment.status),
      drivers: assignment.drivers.map((driver, index) => ({
        slotNumber: index + 1,
        name: driver.name.trim(),
        phone: driver.phone.trim(),
        plateNumber: driver.plateNumber.trim(),
        isVerified: driver.isVerified ?? true,
      })),
    }));
  }

  return payload;
}
