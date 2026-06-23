import type { GroupAgreementHotel, GroupData, VisaTrackingRow } from "./app-domain.js";
import type { HotelAgreementDraft } from "./app-domain-types.js";

function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  if (!isoDate) {
    return "";
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  parsedDate.setDate(parsedDate.getDate() + days);
  return formatLocalIsoDate(parsedDate);
}

export function formatVisaShortDate(isoDate: string): string {
  if (!isoDate) {
    return "-";
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatVisaLongDate(isoDate: string): string {
  if (!isoDate) {
    return "-";
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  return parsedDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatVisaDateWithYear(isoDate: string): string {
  if (!isoDate) {
    return "-";
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function buildVisaAgreementNumber(groupCode: string, city: "makkah" | "madinah"): string {
  const digits = groupCode
    .replace(/[^0-9]/g, "")
    .slice(-6)
    .padStart(6, "0");
  const citySuffix = city === "makkah" ? "65865716" : "77824519";
  const yearPrefix = new Date().getFullYear().toString();
  return `${yearPrefix}${digits}${citySuffix}`;
}

export function isIsoDateValue(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getGroupAgreementHotelsByCity(
  group: GroupData | undefined,
  city: "makkah" | "madinah",
): GroupAgreementHotel[] {
  if (!group?.visaSetup) {
    return [];
  }

  return city === "makkah" ? group.visaSetup.makkahHotels : group.visaSetup.madinahHotels;
}

export function resolveVisaAgreementNumber(
  _row: Pick<VisaTrackingRow, "groupCode">,
  group: GroupData | undefined,
  city: "makkah" | "madinah",
): string {
  const primaryAgreement = getGroupAgreementHotelsByCity(group, city)[0];
  const customAgreementNumber = primaryAgreement?.agreementNumber?.trim();

  if (customAgreementNumber) {
    return customAgreementNumber;
  }

  return "Agreement pending";
}

export function resolveVisaAgreementDateRange(
  row: Pick<VisaTrackingRow, "departureIso" | "returnIso">,
  durationDays: number,
  group?: GroupData,
): {
  makkahStartIso: string;
  makkahEndIso: string;
  madinahStartIso: string;
  madinahEndIso: string;
} {
  const normalizedDurationDays = Math.max(1, durationDays || 1);
  const fallbackMakkahStartIso = row.departureIso;
  const fallbackMadinahEndIso =
    row.returnIso && row.returnIso >= fallbackMakkahStartIso
      ? row.returnIso
      : shiftIsoDate(fallbackMakkahStartIso, Math.max(6, normalizedDurationDays - 1));
  const fallbackMakkahStayDays = Math.max(1, Math.min(3, Math.floor(normalizedDurationDays * 0.4)));
  const fallbackMakkahEndCandidate = shiftIsoDate(fallbackMakkahStartIso, fallbackMakkahStayDays);
  const fallbackMakkahEndIso =
    fallbackMakkahEndCandidate > fallbackMadinahEndIso ? fallbackMadinahEndIso : fallbackMakkahEndCandidate;
  const fallbackMadinahStartCandidate = shiftIsoDate(fallbackMakkahEndIso, 1);
  const fallbackMadinahStartIso =
    fallbackMadinahStartCandidate > fallbackMadinahEndIso ? fallbackMadinahEndIso : fallbackMadinahStartCandidate;

  const makkahHotels = getGroupAgreementHotelsByCity(group, "makkah");
  const madinahHotels = getGroupAgreementHotelsByCity(group, "madinah");
  const makkahStartCandidates = makkahHotels
    .map((hotel) => hotel.stayStartIso.trim())
    .filter((isoDate) => isIsoDateValue(isoDate));
  const makkahEndCandidates = makkahHotels
    .map((hotel) => hotel.stayEndIso.trim())
    .filter((isoDate) => isIsoDateValue(isoDate));
  const madinahStartCandidates = madinahHotels
    .map((hotel) => hotel.stayStartIso.trim())
    .filter((isoDate) => isIsoDateValue(isoDate));
  const madinahEndCandidates = madinahHotels
    .map((hotel) => hotel.stayEndIso.trim())
    .filter((isoDate) => isIsoDateValue(isoDate));

  const hasCustomAgreementDates =
    makkahStartCandidates.length > 0 ||
    makkahEndCandidates.length > 0 ||
    madinahStartCandidates.length > 0 ||
    madinahEndCandidates.length > 0;

  if (!hasCustomAgreementDates) {
    return {
      makkahStartIso: fallbackMakkahStartIso,
      makkahEndIso: fallbackMakkahEndIso,
      madinahStartIso: fallbackMadinahStartIso,
      madinahEndIso: fallbackMadinahEndIso,
    };
  }

  const customMakkahStartIso =
    [...makkahStartCandidates, ...madinahStartCandidates].sort()[0] ?? fallbackMakkahStartIso;
  const customMakkahEndIso = [...makkahEndCandidates].sort().at(-1) ?? fallbackMakkahEndIso;
  const customMadinahStartIso = [...madinahStartCandidates].sort()[0] ?? shiftIsoDate(customMakkahEndIso, 1);
  const customMadinahEndIso = [...madinahEndCandidates, ...makkahEndCandidates].sort().at(-1) ?? fallbackMadinahEndIso;

  const normalizedMakkahEndIso = customMakkahEndIso < customMakkahStartIso ? customMakkahStartIso : customMakkahEndIso;
  const normalizedMadinahStartIso =
    customMadinahStartIso < normalizedMakkahEndIso ? normalizedMakkahEndIso : customMadinahStartIso;
  const normalizedMadinahEndIso =
    customMadinahEndIso < normalizedMadinahStartIso ? normalizedMadinahStartIso : customMadinahEndIso;

  return {
    makkahStartIso: customMakkahStartIso,
    makkahEndIso: normalizedMakkahEndIso,
    madinahStartIso: normalizedMadinahStartIso,
    madinahEndIso: normalizedMadinahEndIso,
  };
}

export function resolveVisaProvider(packageName: string): string {
  const normalizedPackage = packageName.trim().toLowerCase();

  if (normalizedPackage.includes("vip") || normalizedPackage.includes("premium")) {
    return "Al-Tayyar";
  }

  if (normalizedPackage.includes("silver")) {
    return "Rawaf Mina";
  }

  return "Nusuk Services";
}

export function hasMissingHotelAllocation(row: VisaTrackingRow): boolean {
  return row.makkahVerified < row.pax || row.madinahVerified < row.pax;
}

export function isVisaRowActionRequired(row: VisaTrackingRow): boolean {
  return row.visaStatus !== "Issued";
}

export function generateWhatsappCopyText(
  group: GroupData | undefined,
  familyGroups?: GroupData[],
): string {
  if (!group) return "";

  const visaType = group.visaSetup?.busStatus === "Visa+" ? "VISA+" : "VISA ONLY";
  const combinedPax = familyGroups && familyGroups.length > 1
    ? familyGroups.reduce((acc, g) => acc + g.pax, 0)
    : (group.pax || 0);
  const paxCount = String(combinedPax).padStart(2, "0");
  const lines: string[] = [];
  lines.push(`*NEED MOFA ${visaType} GROUP CODE*`);

  if (familyGroups && familyGroups.length > 1) {
    familyGroups.forEach((g, i) => {
      const prefix = i === familyGroups.length - 1 ? "└─" : "├─";
      lines.push(`${prefix} ${g.code || "[GROUP_CODE]"} (${g.pax || 0} PAX)`);
    });
    lines.push(`*TOTAL: ${paxCount} PAX*`);
  } else {
    lines.push(`${group.code || "[GROUP_CODE]"} *( ${paxCount} PAX )*`);
  }
  lines.push("");

  lines.push("✈️ *ARRIVAL*");
  const flightItems = (group.itinerary || []).filter(
    (item) => item.category?.toLowerCase() === "arrival" || item.category?.toLowerCase() === "departure"
  );

  const formatFlightDate = (isoDateStr?: string, dateStr?: string, yearStr?: string) => {
    if (isoDateStr) {
      const d = new Date(`${isoDateStr.trim()}T12:00:00`);
      if (!isNaN(d.getTime())) {
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const day = String(d.getDate()).padStart(2, "0");
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day} ${month} ${year}`;
      }
    }
    if (dateStr && yearStr) {
      return `${dateStr.trim()} ${yearStr.trim()}`.toUpperCase();
    }
    return "[FLIGHT_DATE]";
  };

  const formatFlightLine = (item: any) => {
    const from = item.from?.trim() || "[DEP]";
    const to = item.to?.trim() || "[ARR]";
    const flightNo = item.flightNumber?.trim() || "[FLIGHT_NO]";
    const time = item.time?.trim() ? item.time.trim().replace(/:/g, ".") : "[FLIGHT_TIME]";
    const dateFormatted = formatFlightDate(item.isoDate, item.date, item.year);
    return `${from} - ${to} / ${flightNo} / ${time} / ${dateFormatted}`;
  };

  if (flightItems.length > 0) {
    flightItems.forEach((item) => {
      lines.push(formatFlightLine(item));
    });
  } else {
    lines.push("[DEP] - [ARR] / [FLIGHT_NO] / [FLIGHT_TIME] / [FLIGHT_DATE]");
    lines.push("[DEP] - [ARR] / [FLIGHT_NO] / [FLIGHT_TIME] / [FLIGHT_DATE]");
  }
  lines.push("");

  const formatBrnDate = (isoDateStr?: string) => {
    if (!isoDateStr) return "[DATE]";
    const trimmed = isoDateStr.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return trimmed || "[DATE]";
  };

  type HotelEntry = {
    groupCode: string;
    hotelName: string;
    stayStartIso?: string;
    stayEndIso?: string;
    agreementNumber: string;
    pax: number;
  };

  const allGroups = familyGroups && familyGroups.length > 0 ? familyGroups : [group];

  const makkahHotels: HotelEntry[] = [];
  const madinahHotels: HotelEntry[] = [];

  allGroups.forEach((g) => {
    g.visaSetup?.makkahHotels.forEach((h) => {
      makkahHotels.push({
        groupCode: g.code,
        hotelName: h.hotelName,
        stayStartIso: h.stayStartIso,
        stayEndIso: h.stayEndIso,
        agreementNumber: h.agreementNumber,
        pax: h.pax,
      });
    });
    g.visaSetup?.madinahHotels.forEach((h) => {
      madinahHotels.push({
        groupCode: g.code,
        hotelName: h.hotelName,
        stayStartIso: h.stayStartIso,
        stayEndIso: h.stayEndIso,
        agreementNumber: h.agreementNumber,
        pax: h.pax,
      });
    });
  });

  const printHotels = (hotels: HotelEntry[], defaultName: string) => {
    if (hotels.length === 0) {
      lines.push(`*${defaultName}*`);
      lines.push("📅 [START_DATE] - [END_DATE]");
      lines.push("└─ [GROUP_CODE]: [BRN_CODE] ([PAX] PAX)");
      return;
    }

    const grouped = new Map<string, HotelEntry[]>();
    for (const h of hotels) {
      const key = `${h.hotelName.trim()}|${h.stayStartIso || ""}|${h.stayEndIso || ""}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(h);
    }

    let isFirstGroup = true;
    for (const entries of grouped.values()) {
      if (!isFirstGroup) {
        lines.push("");
      }
      isFirstGroup = false;

      const first = entries[0];
      lines.push(`*${first.hotelName?.trim() || defaultName}*`);
      const start = formatBrnDate(first.stayStartIso);
      const end = formatBrnDate(first.stayEndIso);
      lines.push(`📅 ${start} - ${end}`);
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const brnCode = e.agreementNumber?.trim() || "[BRN_CODE]";
        const prefix = i === entries.length - 1 ? "└─" : "├─";
        lines.push(`${prefix} ${e.groupCode}: ${brnCode} (${e.pax} PAX)`);
      }
    }
  };

  lines.push("🏨 *BRN MAKKAH*");
  printHotels(makkahHotels, "[HOTEL MAKKAH NAME]");
  lines.push("");

  lines.push("🏨 *BRN MADINAH*");
  printHotels(madinahHotels, "[HOTEL MADINAH NAME]");

  return lines.join("\n");
}

export function filterAgreementDrafts(
  drafts: HotelAgreementDraft[],
  params: {
    groupArrivalDate?: string;
    groupReturnDate?: string;
    rowDepartureIso?: string;
    rowReturnIso?: string;
    totalPax: number;
    connectedAgreementKeys: Set<string>;
    existingAgreements?: Array<{ stayStartIso: string; stayEndIso: string }>;
  },
): { makkah: HotelAgreementDraft[]; madinah: HotelAgreementDraft[] } {
  const availableDrafts: Record<"makkah" | "madinah", HotelAgreementDraft[]> = {
    makkah: [],
    madinah: [],
  };

  const groupArrival = (params.groupArrivalDate ?? "").trim() || (params.rowDepartureIso ?? "").trim();
  const groupReturn = (params.groupReturnDate ?? "").trim() || (params.rowReturnIso ?? "").trim();

  const getStayNights = (startIso: string, endIso: string): string[] => {
    const nights: string[] = [];
    const startMs = Date.parse(startIso);
    const endMs = Date.parse(endIso);
    if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
      return [];
    }
    const oneDayMs = 24 * 60 * 60 * 1000;
    for (let currentMs = startMs; currentMs < endMs; currentMs += oneDayMs) {
      nights.push(new Date(currentMs).toISOString().slice(0, 10));
    }
    return nights;
  };

  const groupNights = isIsoDateValue(groupArrival) && isIsoDateValue(groupReturn)
    ? getStayNights(groupArrival, groupReturn)
    : [];

  const coveredNights = new Set<string>();
  if (params.existingAgreements) {
    for (const agreement of params.existingAgreements) {
      const aggStart = (agreement.stayStartIso ?? "").trim();
      const aggEnd = (agreement.stayEndIso ?? "").trim();
      if (isIsoDateValue(aggStart) && isIsoDateValue(aggEnd)) {
        const aggNights = getStayNights(aggStart, aggEnd);
        for (const night of aggNights) {
          coveredNights.add(night);
        }
      }
    }
  }

  const uncoveredNights = groupNights.length > 0
    ? groupNights.filter((night) => !coveredNights.has(night))
    : [];

  for (const draft of drafts) {
    if (draft.assignmentStatus === "Assigned") {
      continue;
    }

    const draftKey = `${draft.city}:${draft.agreementNumber.trim().toUpperCase()}`;
    if (params.connectedAgreementKeys.has(draftKey)) {
      continue;
    }

    const draftStart = (draft.stayStartIso ?? "").trim();
    const draftEnd = (draft.stayEndIso ?? "").trim();

    // 1. Group Travel Period Filtering (Option A: Fully Contained -> replaced with Coverage-Centric Overlap)
    if (isIsoDateValue(groupArrival) && isIsoDateValue(groupReturn)) {
      if (isIsoDateValue(draftStart) && isIsoDateValue(draftEnd)) {
        const groupStartMs = Date.parse(groupArrival);
        const groupEndMs = Date.parse(groupReturn);
        const draftStartMs = Date.parse(draftStart);
        const draftEndMs = Date.parse(draftEnd);
        const overlapsWithGroup = Math.max(groupStartMs, draftStartMs) < Math.min(groupEndMs, draftEndMs);
        if (!overlapsWithGroup) {
          continue;
        }
      }
    }

    let targetNights = uncoveredNights.length > 0 ? uncoveredNights : groupNights;
    if (targetNights.length > 0 && isIsoDateValue(draftStart) && isIsoDateValue(draftEnd)) {
      targetNights = targetNights.filter((night) => night >= draftStart && night < draftEnd);
      if (targetNights.length === 0) {
        continue;
      }
    }

    // 2. Pax Sufficiency Filtering
    if (targetNights.length > 0) {
      const assignedGroups = draft.assignedGroups ?? [];
      let minRemaining = assignedGroups.length > 0
        ? draft.pax
        : (draft.remainingPax !== undefined ? draft.remainingPax : draft.pax);
      for (const night of targetNights) {
        const occupiedOnNight = assignedGroups
          .filter((g: any) => {
            const gStart = g.stayStart ?? g.stayStartIso;
            const gEnd = g.stayEnd ?? g.stayEndIso;
            if (gStart && gEnd) {
              return night >= gStart && night < gEnd;
            }
            return true;
          })
          .reduce((sum: number, g: any) => sum + g.pax, 0);
        const remainingOnNight = Math.max(0, draft.pax - occupiedOnNight);
        if (remainingOnNight < minRemaining) {
          minRemaining = remainingOnNight;
        }
      }
      if (minRemaining < params.totalPax) {
        continue;
      }
    } else {
      const availablePax = draft.remainingPax !== undefined ? draft.remainingPax : draft.pax;
      if (availablePax < params.totalPax) {
        continue;
      }
    }

    availableDrafts[draft.city].push(draft);
  }

  return {
    makkah: availableDrafts.makkah.sort((left, right) =>
      `${left.stayStartIso}-${left.hotelName}`.localeCompare(`${right.stayStartIso}-${right.hotelName}`),
    ),
    madinah: availableDrafts.madinah.sort((left, right) =>
      `${left.stayStartIso}-${left.hotelName}`.localeCompare(`${right.stayStartIso}-${right.hotelName}`),
    ),
  };
}

export function getInclusiveDays(startIso: string, endIso: string): number {
  if (!startIso || !endIso) return 0;
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  const diffTime = end.getTime() - start.getTime();
  if (diffTime < 0) return 0;
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}


