import type { FlightDirection, GroupFlightLeg } from "./app-domain-types";
import { createEmptyFlightLeg, getFlightLegsByDirection, hasFlightLegContent, normalizeFlightLegs } from "./flight-plan";
import { findSaudiAirport } from "./saudi-airports";

const MONTH_MAP: Record<string, string> = {
  JAN: "01",
  JANUARI: "01",
  JANUARY: "01",
  FEB: "02",
  FEBRUARI: "02",
  FEBRUARY: "02",
  MAR: "03",
  MARET: "03",
  MARCH: "03",
  APR: "04",
  APRIL: "04",
  MAY: "05",
  MEI: "05",
  JUN: "06",
  JUNI: "06",
  JUNE: "06",
  JUL: "07",
  JULI: "07",
  JULY: "07",
  AUG: "08",
  AGT: "08",
  AGU: "08",
  AGUSTUS: "08",
  AUGUST: "08",
  SEP: "09",
  SEPT: "09",
  SEPTEMBER: "09",
  OCT: "10",
  OKT: "10",
  OKTOBER: "10",
  OCTOBER: "10",
  NOV: "11",
  NOVEMBER: "11",
  DEC: "12",
  DES: "12",
  DESEMBER: "12",
  DECEMBER: "12",
};

const NON_AIRPORT_Three_LETTER_TOKENS = new Set([
  "JAN", "FEB", "MAR", "APR", "MAY", "MEI", "JUN", "JUL", "AUG", "AGT", "AGU", "SEP", "OCT", "OKT", "NOV", "DEC", "DES",
  "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN", "SEN", "SEL", "RAB", "KAM", "JUM", "SAB", "MIN",
  "ETD", "ETA", "VIA", "DAN", "AND", "THE", "FOR", "PAX", "VIP", "BUS", "WIB", "WITA", "WIT", "KSA",
]);

const KNOWN_ORIGIN_AND_TRANSIT_AIRPORTS = new Set([
  "CGK", "SUB", "KNO", "UPG", "SOC", "BTH", "PLM", "BPN", "BDJ", "LOP", "PDG", "PKU", "YIA", "JOG", "SRG", "DPS", "BDO", "MDC", "PNK",
  "DOH", "DXB", "AUH", "SHJ", "MCT", "BAH", "KWI", "AMM", "CAI", "IST", "SAW",
  "SIN", "KUL", "PEN", "BKK", "DMK", "CMB", "MLE", "DAC", "DEL", "BOM", "MAA", "HYD", "BLR", "COK", "KHI", "LHE", "ISB", "MNL", "CAN", "HKG", "TPE", "ICN", "NRT", "HND", "ADD", "CMN",
]);

function isKnownAirportCode(code: string): boolean {
  const upper = code.trim().toUpperCase();
  return Boolean(findSaudiAirport(upper)) || KNOWN_ORIGIN_AND_TRANSIT_AIRPORTS.has(upper);
}

export function addIsoDaysToDate(isoDate: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const date = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function diffIsoDays(startIso: string, endIso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) return null;
  const startMs = Date.parse(`${startIso}T12:00:00.000Z`);
  const endMs = Date.parse(`${endIso}T12:00:00.000Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return null;
  return Math.round((endMs - startMs) / 86_400_000);
}

export function computeAutoArrivalDate(
  departureDate: string,
  departureTime: string,
  arrivalTime: string,
): string {
  const trimmedDate = departureDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) return "";
  const validDepTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime.trim());
  const validArrTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(arrivalTime.trim());
  if (validDepTime && validArrTime && arrivalTime.trim() < departureTime.trim()) {
    return addIsoDaysToDate(trimmedDate, 1);
  }
  return trimmedDate;
}

export function extractCarrierAndFlightNumber(
  rawFlightNumber: string,
  existingCarrier = "",
): { carrierCode: string; flightNumber: string } {
  const cleaned = rawFlightNumber.trim().toUpperCase();
  if (!cleaned) {
    return { carrierCode: existingCarrier.trim().toUpperCase(), flightNumber: "" };
  }
  const match = /^([A-Z0-9]{2,3})[\s-]*(\d{1,4}[A-Z]?)$/.exec(cleaned);
  if (match) {
    const carrier = match[1]!;
    const number = match[2]!;
    return {
      carrierCode: carrier,
      flightNumber: `${carrier}-${number}`,
    };
  }
  const prefixMatch = /^([A-Z]{2,3})-/.exec(cleaned);
  return {
    carrierCode: prefixMatch?.[1] ?? existingCarrier.trim().toUpperCase(),
    flightNumber: cleaned,
  };
}

export function buildMirroredReturnLegs(
  allLegs: GroupFlightLeg[],
  defaultReturnDate = "",
): GroupFlightLeg[] {
  const onward = getFlightLegsByDirection(allLegs, "ONWARD").filter(hasFlightLegContent);
  if (onward.length === 0) return [];
  return [...onward]
    .reverse()
    .map((leg, index) => {
      const { carrierCode } = extractCarrierAndFlightNumber(leg.flightNumber, leg.carrierCode);
      const depDate = index === 0 ? defaultReturnDate : "";
      return {
        ...createEmptyFlightLeg("RETURN", index),
        departureAirportCode: leg.arrivalAirportCode.trim().toUpperCase(),
        arrivalAirportCode: leg.departureAirportCode.trim().toUpperCase(),
        departureDate: depDate,
        arrivalDate: depDate,
        carrierCode,
      };
    });
}

function normalizeTimeToken(raw: string): { time: string; plusDays: number } | null {
  const match = /^([01]\d|2[0-3])[:.]?([0-5]\d)(?:\+(\d))?$/.exec(raw.trim());
  if (!match) return null;
  return {
    time: `${match[1]}:${match[2]}`,
    plusDays: match[3] ? Number.parseInt(match[3], 10) : 0,
  };
}

function extractDateFromLine(line: string, referenceYear: number): string {
  const isoMatch = /\b(20\d{2})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])\b/.exec(line);
  if (isoMatch) return isoMatch[0]!;

  const slashMatch = /\b(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])[/-](20\d{2})\b/.exec(line);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2]!.padStart(2, "0")}-${slashMatch[1]!.padStart(2, "0")}`;
  }

  const dayMonthYearMatch = /\b(0?[1-9]|[12]\d|3[01])[\s-]*([A-Za-z]{3,9})(?:[\s,-]+(20\d{2}))?\b/.exec(line);
  if (dayMonthYearMatch) {
    const month = MONTH_MAP[dayMonthYearMatch[2]!.toUpperCase()];
    if (month) {
      const year = dayMonthYearMatch[3] ?? String(referenceYear);
      const day = dayMonthYearMatch[1]!.padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  return "";
}

export interface ParseFlightScheduleOptions {
  referenceYear?: number;
  defaultOnwardDate?: string;
  defaultReturnDate?: string;
}

export function parseFlightScheduleText(
  rawText: string,
  options: ParseFlightScheduleOptions = {},
): GroupFlightLeg[] {
  const fallbackYear =
    options.referenceYear ??
    (Number.parseInt((options.defaultOnwardDate || options.defaultReturnDate || "").slice(0, 4), 10) ||
      new Date().getFullYear());

  const lines = rawText
    .split(/\r?\n|(?=\b\d\s+[A-Z0-9]{2}\s*\d{2,4}\b)/)
    .map((line) => line.trim())
    .filter(Boolean);

  type RawSegment = {
    from: string;
    to: string;
    saudiOnlyCityCode: string;
    carrierCode: string;
    flightNumber: string;
    date: string;
    depTime: string;
    arrTime: string;
    plusDays: number;
    explicitDirection?: FlightDirection;
  };

  const segments: RawSegment[] = [];
  let currentDirectionHint: FlightDirection | undefined;

  for (const rawLine of lines) {
    const upper = rawLine.toUpperCase();
    if (/^(?:✈️\s*)?\*?(?:FLIGHT|DETAIL|JADWAL)\b/.test(upper) && !/\d/.test(upper)) {
      continue;
    }
    if (/^(?:ONWARD|BERANGKAT|DEPARTURE|KEBERANGKATAN)\s*:?$/.test(upper)) {
      currentDirectionHint = "ONWARD";
      continue;
    }
    if (/^(?:RETURN|PULANG|KEPULANGAN)\s*:?$/.test(upper)) {
      currentDirectionHint = "RETURN";
      continue;
    }

    let lineDirection: FlightDirection | undefined = currentDirectionHint;
    if (/\b(?:ONWARD|BERANGKAT|ENTRY DATE)\b/.test(upper)) lineDirection = "ONWARD";
    if (/\b(?:RETURN|PULANG|EXIT DATE)\b/.test(upper)) lineDirection = "RETURN";

    const date = extractDateFromLine(upper, fallbackYear);

    // Strip matched date strings before looking for flight numbers and times
    const withoutDates = upper
      .replace(/\b20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g, " ")
      .replace(/\b(?:0?[1-9]|[12]\d|3[01])[/-](?:0?[1-9]|1[0-2])[/-]20\d{2}\b/g, " ")
      .replace(/\b(?:0?[1-9]|[12]\d|3[01])[\s-]*(?:JAN|FEB|MAR|APR|MAY|MEI|JUN|JUL|AUG|AGT|AGU|SEP|SEPT|OCT|OKT|NOV|DEC|DES)[A-Z]*(?:[\s,-]+20\d{2})?\b/g, " ");

    // Extract flight number (e.g., GA-980, GA 980, SV817, QR 1188)
    let carrierCode = "";
    let flightNumber = "";
    const flightRegex = /\b([A-Z]{2}|\d[A-Z]|[A-Z]\d)[\s-]?(\d{2,4}[A-Z]?)\b/g;
    for (const match of withoutDates.matchAll(flightRegex)) {
      const candidateCarrier = match[1]!;
      const candidateNum = match[2]!;
      // Skip GDS booking status/seat count tokens like HK45, TK30, DK20
      if (["HK", "TK", "DK", "SS", "NN", "KK", "KL", "UC", "UN", "HX", "WL"].includes(candidateCarrier)) {
        continue;
      }
      carrierCode = candidateCarrier;
      flightNumber = `${candidateCarrier}-${candidateNum}`;
      break;
    }

    // Extract time tokens (HH:mm, HH.mm, or 4-digit HHmm in GDS)
    const withoutFlight = flightNumber
      ? withoutDates.replace(new RegExp(`\\b${carrierCode}[\\s-]?${flightNumber.split("-")[1]}\\b`), " ")
      : withoutDates;

    const times: Array<{ time: string; plusDays: number }> = [];
    const colonTimeRegex = /\b([01]\d|2[0-3])[:.]([0-5]\d)(?:\+(\d))?\b/g;
    for (const match of withoutFlight.matchAll(colonTimeRegex)) {
      const parsed = normalizeTimeToken(match[0]!);
      if (parsed) times.push(parsed);
    }
    if (times.length === 0) {
      const gdsTimeRegex = /\b([01]\d|2[0-3])([0-5]\d)(?:\+(\d))?\b/g;
      for (const match of withoutFlight.matchAll(gdsTimeRegex)) {
        const parsed = normalizeTimeToken(match[0]!);
        if (parsed) times.push(parsed);
      }
    }

    // Extract airport pair (e.g., CGKJED, CGK-JED, CGK -> JED, CGK / JED)
    let from = "";
    let to = "";
    const explicitPairMatch = /\b([A-Z]{3})\s*(?:->|→|-|\/)\s*([A-Z]{3})\b/.exec(withoutFlight);
    const sixLetterMatch = Array.from(withoutFlight.matchAll(/\b([A-Z]{3})([A-Z]{3})\b/g)).find(
      (m) =>
        !findSaudiAirport(m[0]!) &&
        !MONTH_MAP[m[0]!] &&
        m[1] !== m[2] &&
        !NON_AIRPORT_Three_LETTER_TOKENS.has(m[1]!) &&
        !NON_AIRPORT_Three_LETTER_TOKENS.has(m[2]!) &&
        isKnownAirportCode(m[1]!) &&
        isKnownAirportCode(m[2]!),
    );

    if (
      explicitPairMatch &&
      !NON_AIRPORT_Three_LETTER_TOKENS.has(explicitPairMatch[1]!) &&
      !NON_AIRPORT_Three_LETTER_TOKENS.has(explicitPairMatch[2]!)
    ) {
      from = explicitPairMatch[1]!;
      to = explicitPairMatch[2]!;
    } else if (sixLetterMatch) {
      from = sixLetterMatch[1]!;
      to = sixLetterMatch[2]!;
    } else {
      const iataCandidates = Array.from(withoutFlight.matchAll(/\b([A-Z]{3})\b/g))
        .map((m) => m[1]!)
        .filter((token) => !NON_AIRPORT_Three_LETTER_TOKENS.has(token) && token !== carrierCode);
      if (iataCandidates.length >= 2) {
        from = iataCandidates[0]!;
        to = iataCandidates[1]!;
      }
    }

    // Check if the line mentions a Saudi city name (like WhatsApp format: "MADINAH / GA-980 / 17.40 / 13 OCT 2026")
    let saudiOnlyCityCode = "";
    if (!from && !to) {
      const candidates = [
        ...upper.split(/[/|,]+/).map((part) => part.trim()),
        ...upper.split(/[\s/|,-]+/),
      ].filter(Boolean);
      for (const word of candidates) {
        const saudi = findSaudiAirport(word);
        if (saudi) {
          saudiOnlyCityCode = saudi.code;
          break;
        }
      }
    }

    if (!from && !to && !saudiOnlyCityCode && !flightNumber) {
      const prev = segments.at(-1);
      if (prev && !prev.date && (date || times.length > 0)) {
        if (date) prev.date = date;
        if (!prev.depTime && times[0]?.time) prev.depTime = times[0].time;
        if (!prev.arrTime && times[1]?.time) prev.arrTime = times[1].time;
      }
      continue;
    }

    segments.push({
      from,
      to,
      saudiOnlyCityCode,
      carrierCode,
      flightNumber,
      date,
      depTime: times[0]?.time ?? "",
      arrTime: times[1]?.time ?? "",
      plusDays: times[1]?.plusDays ?? times[0]?.plusDays ?? 0,
      explicitDirection: lineDirection,
    });
  }

  if (segments.length === 0) return [];

  // Determine ONWARD vs RETURN for each segment
  let hasReachedSaudi = false;
  const resolvedLegs: GroupFlightLeg[] = [];

  segments.forEach((seg, idx) => {
    let direction: FlightDirection = seg.explicitDirection ?? "ONWARD";
    const fromIsSaudi = Boolean(seg.from && findSaudiAirport(seg.from));
    const toIsSaudi = Boolean(seg.to && findSaudiAirport(seg.to));

    if (!seg.explicitDirection) {
      if (seg.saudiOnlyCityCode) {
        direction = idx === 0 ? "ONWARD" : "RETURN";
      } else if (fromIsSaudi && !toIsSaudi) {
        direction = "RETURN";
        hasReachedSaudi = true;
      } else if (toIsSaudi && !fromIsSaudi) {
        direction = "ONWARD";
        hasReachedSaudi = true;
      } else if (hasReachedSaudi) {
        direction = "RETURN";
      }
    }

    const fallbackDate = direction === "ONWARD" ? (options.defaultOnwardDate ?? "") : (options.defaultReturnDate ?? "");
    const effectiveDate = seg.date || fallbackDate;

    if (seg.saudiOnlyCityCode || (!seg.from && !seg.to && !seg.arrTime)) {
      // Single-endpoint summary line (e.g. MADINAH / GA-980 / 17.40 / 13 OCT 2026)
      if (direction === "ONWARD") {
        resolvedLegs.push({
          ...createEmptyFlightLeg("ONWARD", idx),
          arrivalAirportCode: seg.saudiOnlyCityCode,
          departureDate: effectiveDate,
          arrivalDate: effectiveDate,
          arrivalTime: seg.depTime || seg.arrTime,
          carrierCode: seg.carrierCode,
          flightNumber: seg.flightNumber,
        });
      } else {
        resolvedLegs.push({
          ...createEmptyFlightLeg("RETURN", idx),
          departureAirportCode: seg.saudiOnlyCityCode,
          departureDate: effectiveDate,
          arrivalDate: effectiveDate,
          departureTime: seg.depTime || seg.arrTime,
          carrierCode: seg.carrierCode,
          flightNumber: seg.flightNumber,
        });
      }
      return;
    }

    const arrivalDate =
      seg.plusDays > 0 && effectiveDate
        ? addIsoDaysToDate(effectiveDate, seg.plusDays)
        : computeAutoArrivalDate(effectiveDate, seg.depTime, seg.arrTime);

    resolvedLegs.push({
      ...createEmptyFlightLeg(direction, idx),
      departureAirportCode: seg.from,
      arrivalAirportCode: seg.to,
      departureDate: effectiveDate,
      departureTime: seg.depTime,
      arrivalDate: arrivalDate || effectiveDate,
      arrivalTime: seg.arrTime,
      carrierCode: seg.carrierCode,
      flightNumber: seg.flightNumber,
    });
  });

  return normalizeFlightLegs(resolvedLegs);
}
