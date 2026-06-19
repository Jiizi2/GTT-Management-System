import {
  formatScheduleDate,
  formatScheduleTime,
  getItineraryIsoDate,
  getLocalIsoDateWithOffset,
  resolveCurrentGroupTone,
  getStatusByTone,
  musyrifAvatar,
  parseTimeForInput,
  resolveTotalBusCount,
} from "../shared/app-domain";
import type {
  GroupChecklistAssignment,
  GroupAgreementHotel,
  GroupData,
  GroupRaudhahAppointment,
  GroupVisaSetup,
  VisaHotelEditFormState,
} from "../shared/app-domain";
import { fetchBackendParsed } from "../shared/api-client";
import { formatBackendRequestError } from "../shared/api-error";
import {
  mapAgreementStatusToBackend,
  mapBackendAgreementStatus,
  mapBackendBusStatus,
  mapBackendChecklistStatus,
  mapBackendLifecycleStatusToLabel,
  mapBackendPaymentStatus,
  mapBackendRaudhahStatus,
  mapBackendVisaStatus,
} from "../shared/backend-enums";
import {
  mapGroupToBackendPayload,
  mapToneToBackend,
  resolveGroupTravelDates,
} from "./groups-backend-payload";
import {
  parseBackendGroupRecord,
  parseBackendGroupRecordArray,
  type BackendGroupRecord,
} from "./groups-contract";
export {
  getVisaAgreementValidationError,
  sortHotelsByStayStart,
} from "./visa-agreement-validation";

export type GroupFetchProjection = "summary" | "detail";

export type GroupIdentityDraftPayload = {
  groupCode: string;
  groupName?: string;
  packageName?: string;
  pax?: number;
  totalBuses?: number;
  arrivalDate?: string;
  returnDate?: string;
  durationDays?: number;
  musyrifName?: string;
  musyrifPhone?: string;
  busStatus?: "Visa+" | "Visa Only";
};

function isIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
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

function readNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return fallback;
}

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function mapBackendToneToFrontend(tone: string | undefined, status: string | undefined): GroupData["tone"] {
  const normalizedTone = tone?.trim().toLowerCase() ?? "";
  if (normalizedTone === "active") {
    return "active";
  }

  if (normalizedTone === "inactive") {
    return "inactive";
  }

  const normalizedStatus = status?.trim().toLowerCase() ?? "";
  if (normalizedStatus.includes("inactive")) {
    return "inactive";
  }

  if (normalizedStatus.includes("active")) {
    return "active";
  }

  return "active";
}

function inferHotelNameFromItineraryRecord(record: {
  category?: string;
  categoryKey?: string | null;
  hotelName?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
}): string {
  const explicitHotelName = readString(record.hotelName ?? "", "");
  if (explicitHotelName) {
    return explicitHotelName;
  }

  const normalizedCategoryKey = readString(record.categoryKey ?? "", "").toLowerCase();
  const normalizedCategory = readString(record.category ?? "", "").toLowerCase();
  const resolvedCategoryKey = normalizedCategoryKey || normalizedCategory;
  const fromLocation = readString(record.fromLocation ?? "", "");
  const toLocation = readString(record.toLocation ?? "", "");

  if (resolvedCategoryKey.includes("departure") || resolvedCategoryKey.includes("city-tour")) {
    return /hotel/i.test(fromLocation) ? fromLocation : "";
  }

  if (resolvedCategoryKey.includes("arrival") || resolvedCategoryKey.includes("transfer")) {
    return /hotel/i.test(toLocation) ? toLocation : "";
  }

  return "";
}

function resolveBusStatusFromNotes(notes: string[]): GroupVisaSetup["busStatus"] {
  const marker = notes.find((note) => /^bus status\s*:/i.test(note));
  if (!marker) {
    return undefined;
  }

  // Backward compatibility: legacy notes used "Bus Internal/Bus Luar".
  if (/bus\s*(internal|luar)/i.test(marker)) {
    return "Visa+";
  }

  if (/visa\s*\+/i.test(marker) || /visa\s*plus/i.test(marker)) {
    return "Visa+";
  }

  return undefined;
}

type BackendHotelAgreementRecord = NonNullable<NonNullable<BackendGroupRecord["visaSetup"]>["hotelAgreements"]>[number];

function mapBackendHotelsByCity({
  hotelAgreements,
  groupCode,
  defaultPax,
}: {
  hotelAgreements: BackendHotelAgreementRecord[] | null | undefined;
  groupCode: string;
  defaultPax: number;
}): { makkahHotels: GroupAgreementHotel[]; madinahHotels: GroupAgreementHotel[] } {
  const fallbackStayStartIso = getLocalIsoDateWithOffset(0);
  const fallbackStayEndIso = getLocalIsoDateWithOffset(1);
  const mappedHotels: { makkahHotels: GroupAgreementHotel[]; madinahHotels: GroupAgreementHotel[] } = {
    makkahHotels: [],
    madinahHotels: [],
  };

  for (const item of hotelAgreements ?? []) {
    const city = readString(item.city).toUpperCase();
    if (city !== "MAKKAH" && city !== "MADINAH") {
      continue;
    }

    const bucket = city === "MAKKAH" ? mappedHotels.makkahHotels : mappedHotels.madinahHotels;
    const citySuffix = city === "MAKKAH" ? "makkah" : "madinah";
    const fallbackIndex = bucket.length + 1;

    bucket.push({
      id: readString(item.id, `${groupCode}-${citySuffix}-${fallbackIndex}`),
      sourceDraftId: readString(item.sourceDraftId ?? "", "") || undefined,
      hotelName: readString(item.hotelName, city === "MAKKAH" ? "Makkah Hotel" : "Madinah Hotel"),
      agreementNumber: readString(item.agreementNumber),
      pax: Math.max(0, readNumber(item.pax, defaultPax)),
      status: mapBackendAgreementStatus(item.status),
      stayStartIso: toIsoDate(item.stayStart) ?? fallbackStayStartIso,
      stayEndIso: toIsoDate(item.stayEnd) ?? fallbackStayEndIso,
    });
  }

  return mappedHotels;
}

function mapBackendGroupToFrontend(group: BackendGroupRecord): GroupData | null {
  const code = readString(group.code).toUpperCase();
  const name = readString(group.name);
  if (!code || !name) {
    return null;
  }

  const mappedItinerary =
    group.itinerary
      ?.slice()
      .sort(
        (left, right) =>
          readNumber(left.sortOrder, Number.MAX_SAFE_INTEGER) - readNumber(right.sortOrder, Number.MAX_SAFE_INTEGER),
      )
      .map((item) => {
        const isoDate = toIsoDate(item.isoDate);
        const fallbackDate = isoDate ? formatScheduleDate(isoDate) : { date: "-", year: "2026" };

        return {
          date: readString(item.dateLabel, fallbackDate.date),
          year: readString(item.yearLabel, fallbackDate.year),
          category: readString(item.category, "Activity"),
          categoryKey: readString(item.categoryKey ?? "", ""),
          title: readString(item.title, "Untitled Activity"),
          meta: normalizeTimePrefixInPipeSeparatedText(readString(item.meta)),
          icon: readString(item.icon, "event"),
          highlighted: Boolean(item.highlighted),
          isoDate: isoDate ?? undefined,
          time: normalizeStoredTimeLabel(readString(item.time ?? "", "")),
          flightNumber: readString(item.flightNumber ?? "", ""),
          hotelName: inferHotelNameFromItineraryRecord(item) || undefined,
          fromHotelName: readString(item.fromHotelName ?? "", "") || undefined,
          from: readString(item.fromLocation ?? "", ""),
          to: readString(item.toLocation ?? "", ""),
          cityTourCity: readString(item.cityTourCity ?? "", ""),
          requiresBus: Boolean(item.requiresBus),
          notes: readString(item.notes ?? "", ""),
          transferByTrain: Boolean(item.transferByTrain),
          trainDepartureTime: normalizeStoredTimeLabel(readString(item.trainDepartureTime ?? "", "")),
          destinationPickupTime: normalizeStoredTimeLabel(readString(item.destinationPickupTime ?? "", "")),
          hotelPickupRequestTime: normalizeStoredTimeLabel(readString(item.hotelPickupRequestTime ?? "", "")),
        };
      }) ?? [];
  const sortedItinerary = [...mappedItinerary].sort((left, right) => {
    const leftDate = getItineraryIsoDate(left) || "9999-12-31";
    const rightDate = getItineraryIsoDate(right) || "9999-12-31";
    const leftFallbackTime = parseTimeForInput(left.meta.split("|")[0] ?? "");
    const rightFallbackTime = parseTimeForInput(right.meta.split("|")[0] ?? "");
    const leftTime = left.time?.trim() || leftFallbackTime || "00:00";
    const rightTime = right.time?.trim() || rightFallbackTime || "00:00";
    const leftKey = `${leftDate}T${leftTime}`;
    const rightKey = `${rightDate}T${rightTime}`;
    return leftKey.localeCompare(rightKey);
  });
  const itineraryBoundaryDates = resolveItineraryBoundaryIsoDates(sortedItinerary);

  const mappedTimeline =
    group.timeline
      ?.slice()
      .sort(
        (left, right) =>
          readNumber(left.sortOrder, Number.MAX_SAFE_INTEGER) - readNumber(right.sortOrder, Number.MAX_SAFE_INTEGER),
      )
      .map((item) => ({
        date: readString(item.dateLabel),
        title: readString(item.title),
        isCurrent: Boolean(item.isCurrent),
        nextActivity: normalizeTimePrefixInPipeSeparatedText(readString(item.nextActivity ?? "", "")),
      }))
      .filter((item) => item.date && item.title) ?? [];

  const fallbackTimelineFromItinerary = sortedItinerary.slice(0, 2).map((item, index) => ({
    date: item.date,
    title: item.title,
    isCurrent: index === 1,
    nextActivity: index === 1 ? item.meta : "",
  }));

  const timelineSource = fallbackTimelineFromItinerary.length > 0 ? fallbackTimelineFromItinerary : mappedTimeline;
  const firstTimeline = timelineSource[0] ?? {
    date: group.nextActivity?.dateLabel?.trim() || "-",
    title: group.nextActivity?.title?.trim() || "Initial Activity",
    isCurrent: false,
    nextActivity: "",
  };
  const secondTimeline = timelineSource[1] ?? {
    date: group.nextActivity?.dateLabel?.trim() || firstTimeline.date,
    title: group.nextActivity?.title?.trim() || firstTimeline.title,
    isCurrent: true,
    nextActivity:
      normalizeTimePrefixInPipeSeparatedText(group.nextActivity?.timeLabel?.trim() ?? "") || firstTimeline.nextActivity,
  };
  const highlightedItineraryItem = sortedItinerary.find((item) => item.highlighted) ?? sortedItinerary[0];
  const backendNextActivityTitle = readString(group.nextActivity?.title, "");
  const backendNextActivityLooksLikeVisaStatus = /^visa\b/i.test(backendNextActivityTitle);

  const nextActivity = {
    title:
      highlightedItineraryItem?.title ||
      (!backendNextActivityLooksLikeVisaStatus ? backendNextActivityTitle : "") ||
      secondTimeline.title ||
      firstTimeline.title ||
      "Upcoming Activity",
    date:
      highlightedItineraryItem?.date ||
      (!backendNextActivityLooksLikeVisaStatus ? readString(group.nextActivity?.dateLabel, "") : "") ||
      secondTimeline.date ||
      firstTimeline.date ||
      "-",
    time:
      highlightedItineraryItem?.time ||
      (!backendNextActivityLooksLikeVisaStatus
        ? normalizeStoredTimeLabel(readString(group.nextActivity?.timeLabel, ""))
        : "") ||
      "",
    icon:
      highlightedItineraryItem?.icon ||
      (!backendNextActivityLooksLikeVisaStatus ? readString(group.nextActivity?.icon, "") : "") ||
      "event",
  };

  const backendTone = mapBackendToneToFrontend(group.tone, group.status);
  const resolvedTone = resolveCurrentGroupTone(backendTone, sortedItinerary);
  const lifecycleStatusLabel = mapBackendLifecycleStatusToLabel(group.lifecycleStatus);
  const resolvedStatus =
    resolvedTone === backendTone
      ? lifecycleStatusLabel ?? readString(group.status, getStatusByTone(resolvedTone))
      : getStatusByTone(resolvedTone);
  const pax = Math.max(1, readNumber(group.pax, 1));
  const durationDays = Math.max(1, readNumber(group.durationDays, 8));
  const backendArrivalDateIso = toIsoDate(group.arrivalDate) ?? "";
  const backendReturnDateIso = toIsoDate(group.returnDate) ?? "";
  const arrivalDate = isIsoDateOnly(backendArrivalDateIso)
    ? backendArrivalDateIso
    : (itineraryBoundaryDates.earliestIsoDate ?? getLocalIsoDateWithOffset(0));
  const fallbackReturnDate =
    itineraryBoundaryDates.latestIsoDate ??
    toIsoDateWithAddedDays(arrivalDate, Math.max(1, durationDays - 1)) ??
    arrivalDate;
  const returnDateCandidate = isIsoDateOnly(backendReturnDateIso) ? backendReturnDateIso : fallbackReturnDate;
  const returnDate = returnDateCandidate >= arrivalDate ? returnDateCandidate : arrivalDate;
  const mappedNotes = (group.notes ?? [])
    .slice()
    .sort(
      (left, right) =>
        readNumber(left.sortOrder, Number.MAX_SAFE_INTEGER) - readNumber(right.sortOrder, Number.MAX_SAFE_INTEGER),
    )
    .map((item) => readString(item.text))
    .filter((item) => item.length > 0);
  const resolvedBusStatus = mapBackendBusStatus(group.visaSetup?.busStatus) ?? resolveBusStatusFromNotes(mappedNotes);
  const mappedHotelsByCity = mapBackendHotelsByCity({
    hotelAgreements: group.visaSetup?.hotelAgreements,
    groupCode: code,
    defaultPax: pax,
  });

  const mappedVisaSetup = group.visaSetup
    ? {
      visaStatus: mapBackendVisaStatus(group.visaSetup.visaStatus),
      issuedDate: toIsoDate(group.visaSetup.issuedDate) ?? "",
      syarikah: readString(group.visaSetup.syarikah, "Not assigned"),
      busStatus: resolvedBusStatus,
      paymentStatus: mapBackendPaymentStatus(group.visaSetup.paymentStatus),
      makkahHotels: mappedHotelsByCity.makkahHotels,
      madinahHotels: mappedHotelsByCity.madinahHotels,
      raudhahAppointments: (group.visaSetup.raudhahAppointments ?? [])
        .map((item, index) => {
          const parsedDateIso = toIsoDate(item.date);
          if (!parsedDateIso || !isIsoDateOnly(parsedDateIso)) {
            return null;
          }

          return {
            id: readString(item.id, `${code}-raudhah-${index + 1}`),
            dateIso: parsedDateIso,
            status: mapBackendRaudhahStatus(item.status),
            tasrehPrinted: Boolean(item.tasrehPrinted),
          };
        })
        .filter(
          (
            item,
          ): item is {
            id: string;
            dateIso: string;
            status: GroupRaudhahAppointment["status"];
            tasrehPrinted: boolean;
          } => item !== null,
        ),
    }
    : undefined;

  const mappedChecklistAssignments = (group.checklistAssignments ?? []).reduce<GroupChecklistAssignment[]>(
    (accumulator, assignment, assignmentIndex) => {
      const tripDate = toIsoDate(assignment.tripDate);
      if (!tripDate) {
        return accumulator;
      }

      const activity = readString(assignment.activity, "Activity");
      const scheduledTime =
        normalizeStoredTimeLabel(readString(assignment.scheduledTime, "")) ||
        readString(assignment.scheduledTime, "TBD");
      const mappedDrivers =
        assignment.drivers
          ?.slice()
          .sort(
            (left, right) =>
              readNumber(left.slotNumber, Number.MAX_SAFE_INTEGER) -
              readNumber(right.slotNumber, Number.MAX_SAFE_INTEGER),
          )
          .map((driver) => ({
            name: readString(driver.name, "-"),
            phone: readString(driver.phone, "-"),
            plateNumber: readString(driver.plateNumber, "-"),
            isVerified: Boolean(driver.isVerified),
          })) ?? [];

      accumulator.push({
        id: readString(assignment.id, `${code}-checklist-${assignmentIndex + 1}`),
        itineraryItemId: readString(assignment.itineraryItemId ?? "", "") || undefined,
        tripDate,
        activity,
        tripLabel: readString(assignment.tripLabel, activity),
        requiredBusCount: Math.max(1, readNumber(assignment.requiredBusCount, 1)),
        scheduledTime,
        transferByTrain: Boolean(assignment.transferByTrain),
        trainDepartureTime: normalizeStoredTimeLabel(readString(assignment.trainDepartureTime ?? "", "")),
        stationPickupTime: normalizeStoredTimeLabel(readString(assignment.stationPickupTime ?? "", "")),
        status: mapBackendChecklistStatus(assignment.status),
        drivers: mappedDrivers,
      });

      return accumulator;
    },
    [],
  );

  return {
    id: group.id,
    code,
    name,
    status: resolvedStatus,
    lifecycleStatus: group.lifecycleStatus ?? undefined,
    tone: resolvedTone,
    pax,
    totalBuses: resolveTotalBusCount(pax, readNumber(group.totalBuses, 0) || undefined),
    packageName: readString(group.packageName, "Standard"),
    durationDays,
    arrivalDate,
    returnDate,
    timeline: [firstTimeline, secondTimeline],
    nextActivity,
    itinerary: mappedItinerary,
    notes: mappedNotes,
    musyrif: {
      name: readString(group.musyrif?.name, "TBD Musyrif"),
      phone: readString(group.musyrif?.phone, "-"),
      avatar: readString(group.musyrif?.avatar, musyrifAvatar),
    },
    visaSetup: mappedVisaSetup,
    checklistAssignments: mappedChecklistAssignments,
    parentGroupId: group.parentGroupId || undefined,
  };
}

export async function fetchGroupsFromBackend({
  signal,
  query,
  projection = "detail",
  activeOnly = false,
}: {
  signal?: AbortSignal;
  query?: string;
  projection?: GroupFetchProjection;
  activeOnly?: boolean;
} = {}): Promise<GroupData[]> {
  const searchParams = new URLSearchParams();
  const normalizedQuery = query?.trim() ?? "";
  if (normalizedQuery.length > 0) {
    searchParams.set("q", normalizedQuery);
  }
  if (projection) {
    searchParams.set("projection", projection);
  }
  if (activeOnly) {
    searchParams.set("activeOnly", "true");
  }
  const endpoint = searchParams.size > 0 ? `/groups?${searchParams.toString()}` : "/groups";
  const { response, payload, responseText } = await fetchBackendParsed(endpoint, {
    method: "GET",
    signal,
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, payload, responseText, "Backend fetch failed"));
  }

  const records = parseBackendGroupRecordArray(payload, "Backend fetch failed");
  const mappedGroups = records
    .map((item) => mapBackendGroupToFrontend(item))
    .filter((item): item is GroupData => item !== null);

  return mappedGroups;
}

export async function createGroupInBackend(group: GroupData): Promise<void> {
  const payload = mapGroupToBackendPayload(group);
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed("/groups", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, responsePayload, responseText, "Backend sync failed"));
  }
}

export async function createGroupIdentityInBackend(identity: GroupIdentityDraftPayload): Promise<GroupData> {
  const body = {
    code: identity.groupCode.trim().toUpperCase(),
    name: identity.groupName?.trim() || undefined,
    packageName: identity.packageName?.trim() || undefined,
    pax: identity.pax,
    totalBuses: identity.totalBuses,
    arrivalDate: identity.arrivalDate?.trim() || undefined,
    returnDate: identity.returnDate?.trim() || undefined,
    durationDays: identity.durationDays,
    musyrif:
      identity.musyrifName?.trim() || identity.musyrifPhone?.trim()
        ? {
          name: identity.musyrifName?.trim() || "Unassigned Musyrif",
          phone: identity.musyrifPhone?.trim() || "-",
          avatar: musyrifAvatar,
        }
        : undefined,
    busStatus: identity.busStatus,
  };
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed("/groups/identity", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, responsePayload, responseText, "Identity create failed"),
    );
  }

  const mappedGroup = mapBackendGroupToFrontend(parseBackendGroupRecord(responsePayload, "Identity create failed"));
  if (!mappedGroup) {
    throw new Error("Identity create failed: response is not a group record.");
  }

  return mappedGroup;
}

export async function updateGroupInBackend(groupCode: string, group: GroupData): Promise<void> {
  const { arrivalDate, returnDate } = resolveGroupTravelDates(group);
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/groups/${encodeURIComponent(groupCode)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
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
      parentGroupId: group.parentGroupId || null,
    }),
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, responsePayload, responseText, "Backend update failed"));
  }
}

export async function replaceGroupInBackend(groupCode: string, group: GroupData): Promise<void> {
  const payload = mapGroupToBackendPayload(group);
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/groups/${encodeURIComponent(groupCode)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, responsePayload, responseText, "Backend replace failed"),
    );
  }
}

export async function deleteGroupInBackend(groupCode: string): Promise<void> {
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/groups/${encodeURIComponent(groupCode)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(formatBackendRequestError(response.status, responsePayload, responseText, "Backend delete failed"));
  }
}

function mapVisaHotelEditFormToBackendPayload(city: "makkah" | "madinah", hotel: VisaHotelEditFormState) {
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

export async function saveVisaHotelAgreementInBackend({
  groupCode,
  city,
  hotel,
  hotelId,
}: {
  groupCode: string;
  city: "makkah" | "madinah";
  hotel: VisaHotelEditFormState;
  hotelId?: string;
}): Promise<GroupData> {
  const endpoint = hotelId
    ? `/groups/${encodeURIComponent(groupCode)}/visa/hotels/${encodeURIComponent(hotelId)}`
    : `/groups/${encodeURIComponent(groupCode)}/visa/hotels`;
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(endpoint, {
    method: hotelId ? "PATCH" : "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mapVisaHotelEditFormToBackendPayload(city, hotel)),
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, responsePayload, responseText, "Hotel agreement save failed"),
    );
  }

  const mappedGroup = mapBackendGroupToFrontend(parseBackendGroupRecord(responsePayload, "Hotel agreement save failed"));
  if (!mappedGroup) {
    throw new Error("Hotel agreement save failed: response is not a group record.");
  }

  return mappedGroup;
}

export async function deleteVisaHotelAgreementInBackend({
  groupCode,
  hotelId,
}: {
  groupCode: string;
  hotelId: string;
}): Promise<GroupData> {
  const {
    response,
    payload: responsePayload,
    responseText,
  } = await fetchBackendParsed(`/groups/${encodeURIComponent(groupCode)}/visa/hotels/${encodeURIComponent(hotelId)}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, responsePayload, responseText, "Hotel agreement delete failed"),
    );
  }

  const mappedGroup = mapBackendGroupToFrontend(parseBackendGroupRecord(responsePayload, "Hotel agreement delete failed"));
  if (!mappedGroup) {
    throw new Error("Hotel agreement delete failed: response is not a group record.");
  }

  return mappedGroup;
}
