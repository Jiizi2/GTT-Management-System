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

  const earliestMakkahStart = makkahStartCandidates.length > 0 ? [...makkahStartCandidates].sort()[0] : null;
  const earliestMadinahStart = madinahStartCandidates.length > 0 ? [...madinahStartCandidates].sort()[0] : null;

  const isMadinahFirst =
    earliestMadinahStart !== null && (earliestMakkahStart === null || earliestMadinahStart < earliestMakkahStart);

  if (isMadinahFirst) {
    const customMadinahStartIso = earliestMadinahStart ?? fallbackMakkahStartIso;
    const customMadinahEndIso = [...madinahEndCandidates].sort().at(-1) ?? fallbackMakkahEndIso;
    const customMakkahStartIso = [...makkahStartCandidates].sort()[0] ?? shiftIsoDate(customMadinahEndIso, 1);
    const customMakkahEndIso = [...makkahEndCandidates, ...madinahEndCandidates].sort().at(-1) ?? fallbackMadinahEndIso;

    const normalizedMadinahEndIso =
      customMadinahEndIso < customMadinahStartIso ? customMadinahStartIso : customMadinahEndIso;
    const normalizedMakkahStartIso =
      customMakkahStartIso < normalizedMadinahEndIso ? normalizedMadinahEndIso : customMakkahStartIso;
    const normalizedMakkahEndIso =
      customMakkahEndIso < normalizedMakkahStartIso ? normalizedMakkahStartIso : customMakkahEndIso;

    return {
      makkahStartIso: normalizedMakkahStartIso,
      makkahEndIso: normalizedMakkahEndIso,
      madinahStartIso: customMadinahStartIso,
      madinahEndIso: normalizedMadinahEndIso,
    };
  } else {
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
  const makkahShort = !row.makkahHotelWaived && row.makkahVerified < row.pax;
  const madinahShort = !row.madinahHotelWaived && row.madinahVerified < row.pax;
  return makkahShort || madinahShort;
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

  lines.push("✈️ *Flight Detail*");
  const flightItems = (group.itinerary || []).filter((item) => {
    const category = item.category?.toLowerCase();
    const isArrivalOrDeparture = category === "arrival" || category === "departure";
    if (!isArrivalOrDeparture) {
      return false;
    }
    // Arrivals/departures can now be by land (bus) instead of flight. Only real
    // flights belong in the flight manifest; legacy items without a mode default
    // to flight for backward compatibility.
    return item.transportMode ? item.transportMode === "flight" : true;
  });

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
    const mapCityToAirport = (val: string): string => {
      const lower = val.trim().toLowerCase();
      if (lower === "madinah") return "MED";
      if (lower === "jeddah") return "JED";
      if (lower === "makkah") return "JED";
      return val;
    };

    const category = (item.category || "").toLowerCase();
    let rawAirport = "";
    if (category === "arrival") {
      rawAirport = item.from?.trim() || "[DEP]";
    } else if (category === "departure") {
      rawAirport = item.to?.trim() || "[ARR]";
    } else {
      rawAirport = item.from?.trim() || "[DEP]";
    }

    const airport = mapCityToAirport(rawAirport);
    const flightNo = item.flightNumber?.trim() || "[FLIGHT_NO]";
    const time = item.time?.trim() ? item.time.trim().replace(/:/g, ".") : "[FLIGHT_TIME]";
    const dateFormatted = formatFlightDate(item.isoDate, item.date, item.year);
    return `${airport} / ${flightNo} / ${time} / ${dateFormatted}`;
  };

  if (flightItems.length > 0) {
    flightItems.forEach((item) => {
      lines.push(formatFlightLine(item));
    });
  } else {
    lines.push("[AIRPORT] / [FLIGHT_NO] / [FLIGHT_TIME] / [FLIGHT_DATE]");
    lines.push("[AIRPORT] / [FLIGHT_NO] / [FLIGHT_TIME] / [FLIGHT_DATE]");
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

  const toEntries = (
    g: GroupData,
    list: NonNullable<GroupData["visaSetup"]>["makkahHotels"] | undefined,
  ): HotelEntry[] =>
    (list ?? []).map((h) => ({
      groupCode: g.code,
      hotelName: h.hotelName,
      stayStartIso: h.stayStartIso,
      stayEndIso: h.stayEndIso,
      agreementNumber: h.agreementNumber,
      pax: h.pax,
    }));

  const printCityHotels = (hotels: HotelEntry[], defaultName: string, showGroupCode: boolean) => {
    if (hotels.length === 0) {
      lines.push(`*${defaultName}*`);
      lines.push("📅 [START_DATE] - [END_DATE]");
      lines.push(showGroupCode ? "└─ [GROUP_CODE]: [BRN_CODE] ([PAX] PAX)" : "└─ [BRN_CODE] ([PAX] PAX)");
      return;
    }

    const grouped = new Map<string, HotelEntry[]>();
    for (const h of hotels) {
      const key = `${h.hotelName.trim()}|${h.stayStartIso || ""}|${h.stayEndIso || ""}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(h);
    }

    let isFirstHotel = true;
    for (const entries of grouped.values()) {
      if (!isFirstHotel) {
        lines.push("");
      }
      isFirstHotel = false;

      const first = entries[0];
      lines.push(`*${first.hotelName?.trim() || defaultName}*`);
      const start = formatBrnDate(first.stayStartIso);
      const end = formatBrnDate(first.stayEndIso);
      lines.push(`📅 ${start} - ${end}`);
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        const brnCode = e.agreementNumber?.trim() || "[BRN_CODE]";
        const prefix = i === entries.length - 1 ? "└─" : "├─";
        lines.push(
          showGroupCode
            ? `${prefix} ${e.groupCode}: ${brnCode} (${e.pax} PAX)`
            : `${prefix} ${brnCode} (${e.pax} PAX)`,
        );
      }
    }
  };

  // Earliest stay-start ISO among a set of hotels; empty sorts last so a city
  // with no dates is listed after one that has them.
  const earliestStart = (hotels: HotelEntry[]): string =>
    hotels
      .map((h) => (h.stayStartIso || "").trim())
      .filter(Boolean)
      .sort()[0] ?? "";

  // Multiple groups → each group becomes its own block (code as the header) with
  // its own Makkah/Madinah hotels; single group keeps the flat layout with the
  // code inline on the BRN line.
  const isMultiGroup = allGroups.length > 1;

  allGroups.forEach((g, gi) => {
    const makkahHotels = toEntries(g, g.visaSetup?.makkahHotels);
    const madinahHotels = toEntries(g, g.visaSetup?.madinahHotels);

    // Order the two city sections by whichever stay starts first (chronological).
    const cities = [
      { label: "🏨 *BRN MAKKAH*", hotels: makkahHotels, defaultName: "[HOTEL MAKKAH NAME]", start: earliestStart(makkahHotels) },
      { label: "🏨 *BRN MADINAH*", hotels: madinahHotels, defaultName: "[HOTEL MADINAH NAME]", start: earliestStart(madinahHotels) },
    ].sort((a, b) => {
      if (a.start && b.start) return a.start < b.start ? -1 : a.start > b.start ? 1 : 0;
      if (a.start) return -1;
      if (b.start) return 1;
      return 0;
    });

    if (isMultiGroup) {
      if (gi > 0) {
        lines.push("");
      }
      lines.push(`*${g.code || "[GROUP_CODE]"} (${g.pax || 0} PAX)*`);
    }

    cities.forEach((city, ci) => {
      if (ci > 0) {
        lines.push("");
      }
      lines.push(city.label);
      printCityHotels(city.hotels, city.defaultName, !isMultiGroup);
    });
  });

  return lines.join("\n");
}

function formatHijaziDate(isoDate?: string, date?: string, year?: string): string {
  const trimmedIso = isoDate?.trim() ?? "";
  const isoMatch = trimmedIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  const fallback = [date?.trim(), year?.trim()].filter(Boolean).join(" ");
  const namedMonthMatch = fallback.match(/^(\d{1,2})\s+([a-z]{3,})\s+(\d{4})$/i);
  if (namedMonthMatch) {
    const months: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    const month = months[namedMonthMatch[2].slice(0, 3).toLowerCase()];
    if (month) return `${namedMonthMatch[1].padStart(2, "0")}/${month}/${namedMonthMatch[3]}`;
  }

  const direct = fallback || trimmedIso;
  return direct || "[DATE]";
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => Boolean(value?.trim()))?.trim() ?? "";
}

function formatHijaziTime(time?: string): string {
  return time?.trim().replace(/:/g, ".") || "[TIME]";
}

/** Builds the Muassasah Hijazi WhatsApp manifest from the selected group's data. */
export function generateMuassasahHijaziWhatsappCopyText(
  group: GroupData | undefined,
  familyGroups?: GroupData[],
): string {
  if (!group) return "";

  const allGroups = familyGroups && familyGroups.length > 0 ? familyGroups : [group];
  const groupNumbers = allGroups.map((item) => item.code.trim()).filter(Boolean);
  const combinedPax = allGroups.reduce((total, item) => total + (item.pax || 0), 0);
  const lines = [
    `GROUP NUMBER : ${groupNumbers.join(", ") || "[GROUP NUMBER]"}`,
    `NO OF PAX : ${combinedPax}`,
    "NATIONALITY : INDONESIA",
    "",
  ];

  const printHotels = (label: string, hotelsByGroup: GroupAgreementHotel[][]) => {
    const hotels = hotelsByGroup.flat();
    const entries = hotels.length > 0 ? hotels : [undefined];
    entries.forEach((hotel, index) => {
      if (index > 0) lines.push("");
      lines.push(`HOTEL NAME ${label} : ${hotel?.hotelName?.trim() || "[HOTEL NAME]"}`);
      lines.push(`Check in : ${formatHijaziDate(hotel?.stayStartIso)}`);
      lines.push(`Check out: ${formatHijaziDate(hotel?.stayEndIso)}`);
      lines.push(`agreements number: ${hotel?.agreementNumber?.trim() || "[AGREEMENT NUMBER]"}`);
    });
  };

  printHotels("MAKKAH", allGroups.map((item) => item.visaSetup?.makkahHotels ?? []));
  lines.push("");
  printHotels("MADEENA", allGroups.map((item) => item.visaSetup?.madinahHotels ?? []));
  lines.push("");

  const arrivalItinerary = allGroups
    .flatMap((item) => item.itinerary ?? [])
    .find((item) => item.category?.toLowerCase() === "arrival" && (!item.transportMode || item.transportMode === "flight"));
  const departureItinerary = allGroups
    .flatMap((item) => item.itinerary ?? [])
    .find((item) => item.category?.toLowerCase() === "departure" && (!item.transportMode || item.transportMode === "flight"));

  const onwardLeg = allGroups
    .flatMap((item) => item.visaSetup?.flightLegs ?? [])
    .find((leg) => leg.direction === "ONWARD");
  const returnLeg = allGroups
    .flatMap((item) => item.visaSetup?.flightLegs ?? [])
    .find((leg) => leg.direction === "RETURN");

  const visaSetups = allGroups.map((item) => item.visaSetup);
  const arrivalNumber = firstNonEmpty(
    ...visaSetups.map((setup) => setup?.arrivalFlightNumber),
    onwardLeg?.flightNumber,
    arrivalItinerary?.flightNumber,
  );
  const departureNumber = firstNonEmpty(
    ...visaSetups.map((setup) => setup?.departureFlightNumber),
    returnLeg?.flightNumber,
    departureItinerary?.flightNumber,
  );
  const arrivalDate = formatHijaziDate(
    firstNonEmpty(...visaSetups.map((setup) => setup?.arrivalFlightDate), onwardLeg?.arrivalDate, onwardLeg?.departureDate, arrivalItinerary?.isoDate, group.arrivalDate),
    arrivalItinerary?.date,
    arrivalItinerary?.year,
  );
  const departureDate = formatHijaziDate(
    firstNonEmpty(...visaSetups.map((setup) => setup?.departureFlightDate), returnLeg?.departureDate, returnLeg?.arrivalDate, departureItinerary?.isoDate, group.returnDate),
    departureItinerary?.date,
    departureItinerary?.year,
  );
  const arrivalTime = firstNonEmpty(
    ...visaSetups.map((setup) => setup?.arrivalTime),
    onwardLeg?.arrivalTime,
    onwardLeg?.departureTime,
    arrivalItinerary?.time,
  );
  const departureTime = firstNonEmpty(
    ...visaSetups.map((setup) => setup?.departureTime),
    returnLeg?.departureTime,
    returnLeg?.arrivalTime,
    departureItinerary?.time,
  );

  lines.push(`ENTRY DATE WITH FLIGHT NO : ${arrivalNumber || "[FLIGHT NO]"}`);
  lines.push(`Date: ${arrivalDate} (${formatHijaziTime(arrivalTime)})`);
  lines.push("");
  lines.push(`EXIT DATE WITH FLIGHT NO : ${departureNumber || "[FLIGHT NO]"}`);
  lines.push(`Date: ${departureDate} (${formatHijaziTime(departureTime)})`);

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
  },
): { makkah: HotelAgreementDraft[]; madinah: HotelAgreementDraft[] } {
  const availableDrafts: Record<"makkah" | "madinah", HotelAgreementDraft[]> = {
    makkah: [],
    madinah: [],
  };

  const groupArrival = (params.groupArrivalDate ?? "").trim() || (params.rowDepartureIso ?? "").trim();
  const groupReturn = (params.groupReturnDate ?? "").trim() || (params.rowReturnIso ?? "").trim();

  for (const draft of drafts) {
    if (draft.assignmentStatus === "Assigned") {
      continue;
    }

    const draftKey = `${draft.city}:${draft.agreementNumber.trim().toUpperCase()}`;
    if (params.connectedAgreementKeys.has(draftKey)) {
      continue;
    }

    // 1. Group Travel Period Filtering (Option A: Fully Contained)
    if (isIsoDateValue(groupArrival) && isIsoDateValue(groupReturn)) {
      const draftStart = (draft.stayStartIso ?? "").trim();
      const draftEnd = (draft.stayEndIso ?? "").trim();
      if (isIsoDateValue(draftStart) && isIsoDateValue(draftEnd)) {
        if (draftStart < groupArrival || draftEnd > groupReturn) {
          continue;
        }
      }
    }

    // 2. Pax Sufficiency Filtering
    const availablePax = draft.remainingPax !== undefined ? draft.remainingPax : draft.pax;
    if (availablePax < params.totalPax) {
      continue;
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


