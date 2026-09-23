import type { AgreementApprovalStatus } from "./app-domain";

export type ParsedAgreementTextItem = {
  city: "" | "makkah" | "madinah";
  hotelName: string;
  agreementNumber: string;
  status: "" | AgreementApprovalStatus;
  stayStartIso: string;
  stayEndIso: string;
};

export type ParsedAgreementText = {
  items: ParsedAgreementTextItem[];
  warnings: string[];
};

const STATUS_BY_KEY: Record<string, AgreementApprovalStatus> = {
  "waiting for approval": "Waiting for Approval",
  waiting: "Waiting for Approval",
  approved: "Approved",
  rejected: "Rejected",
};

function normalizeStatus(value: string): AgreementApprovalStatus | null {
  const key = value.trim().toLowerCase().replace(/\s+/g, " ");
  return STATUS_BY_KEY[key] ?? null;
}

function toIsoDate(dayValue: string, monthValue: string, yearValue: string): string | null {
  const day = Number.parseInt(dayValue, 10);
  const month = Number.parseInt(monthValue, 10);
  const year = Number.parseInt(yearValue, 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function parseDateRange(line: string): { start: string; end: string } | null {
  const match = line.match(
    /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\s*(?:-|–|—|to|s\/?d)\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/i,
  );
  if (!match) return null;

  const start = toIsoDate(match[1], match[2], match[3]);
  const end = toIsoDate(match[4], match[5], match[6]);
  return start && end ? { start, end } : null;
}

function isAgreementNumber(line: string): boolean {
  if (parseDateRange(line) || normalizeStatus(line)) return false;
  return /^(?=.*\d)[A-Z0-9][A-Z0-9./-]{5,}$/i.test(line);
}

function cleanHotelName(line: string): string {
  return line.replace(/^agreement\s*[:\-]?\s*/i, "").trim();
}

function cityFromHotelName(hotelName: string): "makkah" | "madinah" | null {
  const normalized = hotelName.toLowerCase();
  if (/\b(madinah|medina)\b/.test(normalized)) return "madinah";
  if (/\b(makkah|mecca)\b/.test(normalized)) return "makkah";
  return null;
}

export function parseAgreementText(input: string): ParsedAgreementText {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const warnings: string[] = [];
  const seenNumbers = new Set<string>();

  const candidates = lines.flatMap((line, index) => {
    if (!isAgreementNumber(line) || seenNumbers.has(line.toLowerCase())) return [];

    let hotelLineIndex = -1;
    for (let candidateIndex = index - 1; candidateIndex >= 0; candidateIndex -= 1) {
      const candidate = lines[candidateIndex];
      if (!isAgreementNumber(candidate) && !normalizeStatus(candidate) && !parseDateRange(candidate)) {
        hotelLineIndex = candidateIndex;
        break;
      }
    }
    const hotelName = hotelLineIndex >= 0 ? cleanHotelName(lines[hotelLineIndex]) : "";
    if (!hotelName) return [];

    seenNumbers.add(line.toLowerCase());
    return [{ agreementNumber: line, hotelName, hotelLineIndex, numberLineIndex: index }];
  });

  const items = candidates.map((candidate, index): ParsedAgreementTextItem => {
    const nextHotelLineIndex = candidates[index + 1]?.hotelLineIndex ?? lines.length;
    const recordLines = lines.slice(candidate.numberLineIndex + 1, nextHotelLineIndex);
    const dateRange = recordLines.map(parseDateRange).find((value) => value !== null) ?? null;
    const status = recordLines.map(normalizeStatus).find((value) => value !== null) ?? "";
    const explicitCity = cityFromHotelName(candidate.hotelName);

    return {
      city: explicitCity ?? "",
      hotelName: candidate.hotelName,
      agreementNumber: candidate.agreementNumber,
      status,
      stayStartIso: dateRange?.start ?? "",
      stayEndIso: dateRange?.end ?? "",
    };
  });

  if (items.length === 0) warnings.push("Belum menemukan pasangan nama hotel dan nomor agreement.");
  items.forEach((item, index) => {
    const label = items.length > 1 ? `Agreement ${index + 1}` : "Agreement";
    if (!item.status) warnings.push(`${label}: status belum ditemukan.`);
    if (!item.stayStartIso || !item.stayEndIso) warnings.push(`${label}: periode menginap belum ditemukan.`);
    if (!item.city) warnings.push(`${label}: kota belum ditemukan.`);
  });

  return { items, warnings };
}
