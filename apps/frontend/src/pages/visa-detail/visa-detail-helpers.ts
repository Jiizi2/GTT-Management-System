import * as Domain from "../../shared/app-domain";
import type { GroupAgreementHotel, GroupData, HotelAgreementDraft, VisaFlightDetailsInput } from "../../shared/app-domain";

export type Tone = "success" | "warning" | "muted" | "info" | "error";

const { formatVisaDateWithYear, isIsoDateValue, inferCategoryKey } = Domain;

/**
 * Resolve the flight details to show/seed in Visa Detail. Prefers the explicit
 * VisaSetup columns, but falls back to the arrival/departure legs of the group's
 * existing itinerary so groups whose flight was entered in Group Detail (before
 * the VisaSetup flight fields existed) still display it — keeping the two views a
 * single source instead of drifting apart.
 */
export function resolveGroupFlightDetails(group: GroupData | null | undefined): VisaFlightDetailsInput {
  const visaSetup = group?.visaSetup;
  const itinerary = group?.itinerary ?? [];
  const arrivalItem = itinerary.find((item) => inferCategoryKey(item) === "arrival");
  const departureItem = itinerary.find((item) => inferCategoryKey(item) === "departure");

  return {
    arrivalFlightNumber: visaSetup?.arrivalFlightNumber?.trim() || arrivalItem?.flightNumber?.trim() || "",
    arrivalTime: visaSetup?.arrivalTime?.trim() || arrivalItem?.time?.trim() || "",
    departureFlightNumber: visaSetup?.departureFlightNumber?.trim() || departureItem?.flightNumber?.trim() || "",
    departureTime: visaSetup?.departureTime?.trim() || departureItem?.time?.trim() || "",
  };
}

export function getToneClasses(tone: Tone): string {
  if (tone === "success") {
    return "border-primary/35 bg-primary-fixed/12 text-primary";
  }
  if (tone === "warning") {
    return "border-secondary/35 bg-secondary/12 text-secondary";
  }
  return "border-outline-variant/45 bg-surface-container-high text-on-surface-variant";
}

export function getToneTextClass(tone: Tone): string {
  if (tone === "success") {
    return "text-primary";
  }
  if (tone === "warning") {
    return "text-secondary";
  }
  return "text-on-surface-variant";
}

export function getIconButtonClasses(isDanger = false): string {
  if (isDanger) {
    return "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-error/10 text-error transition hover:bg-error hover:text-on-error disabled:cursor-not-allowed disabled:opacity-45";
  }
  return "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary transition hover:bg-brand-primary hover:text-brand-neutral disabled:cursor-not-allowed disabled:opacity-45";
}

export function getCitySummaryClasses(hasMissing: boolean): string {
  if (hasMissing) {
    return "flex items-start gap-3 rounded-2xl border border-secondary/35 bg-secondary/12 p-3 text-secondary";
  }
  return "flex items-start gap-3 rounded-2xl border border-primary/35 bg-primary-fixed/12 p-3 text-primary";
}

export function getAgreementStatusClasses(isApproved: boolean): string {
  if (isApproved) {
    return "inline-flex items-center gap-1.5 rounded-lg border border-primary/35 bg-primary-fixed/12 px-2.5 py-1 text-xs font-bold leading-none text-primary";
  }
  return "inline-flex items-center gap-1.5 rounded-lg border border-secondary/35 bg-secondary/12 px-2.5 py-1 text-xs font-bold leading-none text-secondary";
}

export function getAgreementStatusLabel(
  status: GroupAgreementHotel["status"]
): "Approved" | "Waiting for Approval" {
  if (status === "Approved") {
    return "Approved";
  }
  return "Waiting for Approval";
}

export function formatAgreementStayRange(agreement: GroupAgreementHotel): string {
  const start = agreement.stayStartIso?.trim();
  const end = agreement.stayEndIso?.trim();

  if (start && end) {
    return `${formatVisaDateWithYear(start)} - ${formatVisaDateWithYear(end)}`;
  }
  if (start) {
    return `Start ${formatVisaDateWithYear(start)}`;
  }
  if (end) {
    return `End ${formatVisaDateWithYear(end)}`;
  }
  return "Stay dates pending";
}

export function formatAgreementStayDate(value: string | undefined): string {
  if (!value?.trim()) return "-";
  return formatVisaDateWithYear(value);
}

export function formatAgreementDraftStayRange(draft: HotelAgreementDraft): string {
  const stayStart = draft.stayStartIso.trim();
  const stayEnd = draft.stayEndIso.trim();

  if (stayStart && stayEnd) {
    return `${formatVisaDateWithYear(stayStart)} - ${formatVisaDateWithYear(stayEnd)}`;
  }

  if (stayStart) {
    return `Start ${formatVisaDateWithYear(stayStart)}`;
  }

  if (stayEnd) {
    return `End ${formatVisaDateWithYear(stayEnd)}`;
  }

  return "Stay dates pending";
}

export function normalizeAgreementMatchValue(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function doesAgreementMatchAssignedDraft({
  draft,
  agreement,
  city,
  groupCode,
}: {
  draft: HotelAgreementDraft;
  agreement: GroupAgreementHotel;
  city: "makkah" | "madinah";
  groupCode: string;
}): boolean {
  if (agreement.sourceDraftId && agreement.sourceDraftId === draft.id) {
    return true;
  }

  const isAssignedToGroup = draft.assignedGroups?.some(
    (g) => normalizeAgreementMatchValue(g.groupCode) === normalizeAgreementMatchValue(groupCode)
  ) ?? false;

  return (
    isAssignedToGroup &&
    draft.city === city &&
    normalizeAgreementMatchValue(draft.agreementNumber) === normalizeAgreementMatchValue(agreement.agreementNumber)
  );
}

export function formatVisaMutationError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback;
}

export function getRaudhahStatusBadgeClasses(status: any): string {
  if (status === "After") {
    return "border-brand-primary/25 bg-brand-primary/12 text-brand-primary";
  }

  if (status === "Before") {
    return "border-brand-tertiary/30 bg-brand-tertiary/12 text-brand-tertiary";
  }

  return "border-brand-secondary/30 bg-brand-secondary/12 text-brand-secondary";
}

export function getUncoveredPeriod(
  city: "makkah" | "madinah",
  groupArrival: string,
  groupReturn: string,
  existingAgreements: GroupAgreementHotel[]
): { start: string; end: string } {
  if (!isIsoDateValue(groupArrival) || !isIsoDateValue(groupReturn)) {
    return { start: "", end: "" };
  }
  const nights: string[] = [];
  const startMs = Date.parse(groupArrival);
  const endMs = Date.parse(groupReturn);
  if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
    return { start: "", end: "" };
  }
  const oneDayMs = 24 * 60 * 60 * 1000;
  for (let currentMs = startMs; currentMs < endMs; currentMs += oneDayMs) {
    nights.push(new Date(currentMs).toISOString().slice(0, 10));
  }

  const covered = new Set<string>();
  for (const agg of existingAgreements) {
    const aggStart = (agg.stayStartIso ?? "").trim();
    const aggEnd = (agg.stayEndIso ?? "").trim();
    if (isIsoDateValue(aggStart) && isIsoDateValue(aggEnd)) {
      const startValMs = Date.parse(aggStart);
      const endValMs = Date.parse(aggEnd);
      for (let currMs = startValMs; currMs < endValMs; currMs += oneDayMs) {
        covered.add(new Date(currMs).toISOString().slice(0, 10));
      }
    }
  }

  const uncovered = nights.filter((n) => !covered.has(n));
  if (uncovered.length === 0) {
    return { start: groupArrival, end: groupReturn };
  }

  const sorted = uncovered.sort();
  const first = sorted[0];
  let last = first;
  for (let i = 1; i < sorted.length; i++) {
    const currentMs = Date.parse(sorted[i]);
    const prevMs = Date.parse(sorted[i - 1]);
    if (currentMs - prevMs === oneDayMs) {
      last = sorted[i];
    } else {
      break;
    }
  }
  const nextDay = new Date(Date.parse(last) + oneDayMs).toISOString().slice(0, 10);
  return { start: first, end: nextDay };
}
