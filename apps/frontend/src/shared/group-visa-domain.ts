import type {
  GroupAgreementHotel,
  GroupCompletenessIssue,
  GroupCompletenessState,
  GroupCompletenessSummary,
  GroupData,
  GroupRaudhahAppointment,
  ItineraryItem,
  VisaPaymentStatus,
  VisaRaudhahTone,
  VisaStatus,
  VisaTrackingRow,
} from "./app-domain-types";
import {
  formatVisaShortDate,
  getGroupAgreementHotelsByCity,
  isIsoDateValue,
  resolveVisaAgreementDateRange,
  shiftIsoDate,
} from "./visa-domain.js";

export type GroupVisaDomainDependencies = {
  getItineraryIsoDate: (item: ItineraryItem) => string;
  parseTimeForInput: (value: string) => string;
  getLocalIsoDateWithOffset: (days: number) => string;
  resolveValidRaudhahAppointments: (group: GroupData | undefined) => GroupRaudhahAppointment[];
};

function resolveItineraryBoundaryIsoDates(
  itinerary: ItineraryItem[],
  dependencies: Pick<GroupVisaDomainDependencies, "getItineraryIsoDate" | "parseTimeForInput">,
): {
  earliestIsoDate: string | null;
  latestIsoDate: string | null;
} {
  let earliestKey: string | null = null;
  let latestKey: string | null = null;
  let earliestIsoDate: string | null = null;
  let latestIsoDate: string | null = null;

  for (const item of itinerary) {
    const itineraryIsoDate = dependencies.getItineraryIsoDate(item);
    const metaTime = dependencies.parseTimeForInput(item.meta.split(" | ")[0] ?? "");
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


export function getStayPeriods(hotels: GroupAgreementHotel[]): Array<{ startIso: string; endIso: string }> {
  const parsed = hotels
    .map((hotel) => {
      const startIso = hotel.stayStartIso.trim();
      const endIso = hotel.stayEndIso.trim();
      if (!isIsoDateValue(startIso) || !isIsoDateValue(endIso)) {
        return null;
      }
      return { startIso, endIso, startMs: Date.parse(startIso), endMs: Date.parse(endIso) };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((left, right) => left.startMs - right.startMs);

  if (parsed.length === 0) {
    return [];
  }

  const merged: Array<{ startIso: string; endIso: string; startMs: number; endMs: number }> = [];
  let current = { ...parsed[0] };

  for (let index = 1; index < parsed.length; index += 1) {
    const next = parsed[index];
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

  return merged.map((item) => ({ startIso: item.startIso, endIso: item.endIso }));
}

function getDistinctNightTimes(hotels: GroupAgreementHotel[]): number[] {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const nights = new Set<number>();

  for (const hotel of hotels) {
    const startIso = hotel.stayStartIso.trim();
    const endIso = hotel.stayEndIso.trim();
    if (!isIsoDateValue(startIso) || !isIsoDateValue(endIso)) {
      continue;
    }
    const startMs = Date.parse(startIso);
    const endMs = Date.parse(endIso);

    for (let currentMs = startMs; currentMs < endMs; currentMs += oneDayMs) {
      nights.add(currentMs);
    }
  }

  return Array.from(nights).sort((left, right) => left - right);
}

function calculateVerifiedPax(hotels: GroupAgreementHotel[], groupPax: number): number {
  if (hotels.length === 0) {
    return 0;
  }

  const nightTimes = getDistinctNightTimes(hotels);
  if (nightTimes.length === 0) {
    return 0;
  }

  let minSum = Infinity;

  for (const nightMs of nightTimes) {
    const nightHotels = hotels.filter((hotel) => {
      const hotelStart = hotel.stayStartIso.trim();
      const hotelEnd = hotel.stayEndIso.trim();
      if (!isIsoDateValue(hotelStart) || !isIsoDateValue(hotelEnd)) {
        return false;
      }
      const startMs = Date.parse(hotelStart);
      const endMs = Date.parse(hotelEnd);
      return nightMs >= startMs && nightMs < endMs;
    });

    const sum = nightHotels.reduce((total, hotel) => total + Math.max(0, hotel.pax || 0), 0);
    if (sum < minSum) {
      minSum = sum;
    }
  }

  return Math.min(groupPax, minSum);
}

function hasAgreementPaxMismatch(group: GroupData): boolean {
  const makkahHotels = getGroupAgreementHotelsByCity(group, "makkah");
  const madinahHotels = getGroupAgreementHotelsByCity(group, "madinah");
  const groupPax = Math.max(1, group.pax);

  if (makkahHotels.length > 0 && calculateVerifiedPax(makkahHotels, groupPax) < groupPax) {
    return true;
  }

  if (madinahHotels.length > 0 && calculateVerifiedPax(madinahHotels, groupPax) < groupPax) {
    return true;
  }

  return false;
}

function getDayDiff(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
    return Infinity;
  }
  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function resolveGroupCompleteness(
  group: GroupData,
  dependencies: Pick<GroupVisaDomainDependencies, "getItineraryIsoDate" | "parseTimeForInput">,
): GroupCompletenessSummary {
  const issues: GroupCompletenessIssue[] = [];
  const hasIdentity = Boolean(group.code.trim() && group.name.trim() && group.pax > 0);
  const makkahAgreements = getGroupAgreementHotelsByCity(group, "makkah");
  const madinahAgreements = getGroupAgreementHotelsByCity(group, "madinah");
  const hasMakkahAgreement = makkahAgreements.length > 0;
  const hasMadinahAgreement = madinahAgreements.length > 0;
  const hasAnyAgreement = hasMakkahAgreement || hasMadinahAgreement;
  const hasItinerary = group.itinerary.length > 0;
  const { earliestIsoDate, latestIsoDate } = resolveItineraryBoundaryIsoDates(group.itinerary, dependencies);

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

  const startDiff = (earliestIsoDate && periods[0]) ? getDayDiff(periods[0].startIso, earliestIsoDate) : Infinity;
  const endDiff = (latestIsoDate && periods[0]) ? getDayDiff(periods[0].endIso, latestIsoDate) : Infinity;
  const coversItinerary =
    isContinuous && startDiff <= 1 && endDiff <= 1;

  if (hasAnyAgreement && !isContinuous) {
    issues.push({
      key: "date-mismatch",
      severity: "warning",
      label: "Dates",
      message: "Terdapat tanggal kosong (gap) antar agreement hotel.",
    });
  } else if (hasAnyAgreement && hasItinerary && earliestIsoDate && latestIsoDate && !coversItinerary) {
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

export function buildVisaTrackingRowsFromGroups(
  groups: GroupData[],
  dependencies: GroupVisaDomainDependencies,
): VisaTrackingRow[] {
  return groups.map((group, index) => {
    const visaSetup = group.visaSetup;
    const { earliestIsoDate, latestIsoDate } = resolveItineraryBoundaryIsoDates(group.itinerary, dependencies);
    const configuredArrivalIso = group.arrivalDate?.trim() ?? "";
    const configuredReturnIso = group.returnDate?.trim() ?? "";
    const groupArrivalIso = isIsoDateValue(configuredArrivalIso) ? configuredArrivalIso : "";
    const groupReturnIso = isIsoDateValue(configuredReturnIso) ? configuredReturnIso : "";
    const fallbackDeparture = dependencies.getLocalIsoDateWithOffset(index % 4);
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
    const verifiedMakkahPax = calculateVerifiedPax(getGroupAgreementHotelsByCity(group, "makkah"), pax);
    const verifiedMadinahPax = calculateVerifiedPax(getGroupAgreementHotelsByCity(group, "madinah"), pax);
    const makkahVerified = verifiedMakkahPax;
    const madinahVerified = verifiedMadinahPax;

    const validRaudhahAppointments = dependencies.resolveValidRaudhahAppointments(group);
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
      parentGroupId: group.parentGroupId,
    };
  });
}
