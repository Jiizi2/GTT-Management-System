/**
 * Pure selectors and formatters backing the dashboard group records hook.
 *
 * Everything here is side-effect free and independent of React, so it can be
 * unit tested directly. `useDashboardGroupRecords` composes these; keep new
 * stateful logic in the hook and new derivations here.
 */
import {
  formatLocalIsoDate,
  formatScheduleDate,
  getItineraryIsoDate,
  getMinimumBusCountForPax,
  musyrifAvatar,
  shiftIsoDate,
} from "../../shared/app-domain";
import type { GroupData, NavId } from "../../shared/app-domain";
import type {
  GroupFetchProjection,
  GroupIdentityDraftPayload,
} from "../use-app-controller-backend";

export function getCurrentWeekIsoRange(referenceDate = new Date()): {
  weekStartIso: string;
  weekEndIso: string;
} {
  const baseDate = new Date(referenceDate);
  const dayOfWeek = baseDate.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const weekStart = new Date(baseDate);
  weekStart.setDate(baseDate.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  return {
    weekStartIso: formatLocalIsoDate(weekStart),
    weekEndIso: formatLocalIsoDate(weekEnd),
  };
}

export function isIsoDateInRange(isoDate: string | undefined, startIso: string, endIso: string): boolean {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return false;
  }

  return isoDate >= startIso && isoDate <= endIso;
}

export function isArrivalCategory(item: { categoryKey?: string; category: string }): boolean {
  const normalizedKey = item.categoryKey?.trim().toLowerCase() ?? "";
  if (normalizedKey === "arrival") {
    return true;
  }

  return item.category.trim().toLowerCase() === "arrival";
}

export function formatPeakTripDayLabel(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return "-";
  }

  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export function getCurrentMonthKey(referenceDate = new Date()): string {
  return formatLocalIsoDate(referenceDate).slice(0, 7);
}

export function getMillisecondsUntilNextLocalDay(referenceDate = new Date()): number {
  const nextDay = new Date(referenceDate);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(1_000, nextDay.getTime() - referenceDate.getTime());
}

export function resolveDashboardSyncFailureMessage(error: unknown, fallbackMessage: string): string {
  const errorMessage = error instanceof Error ? error.message.trim() : "";
  const normalizedMessage = errorMessage.toLowerCase();
  if (normalizedMessage.includes("group code") && normalizedMessage.includes("already exists")) {
    return "Group number sudah dipakai oleh group lain.";
  }

  return errorMessage ? `${fallbackMessage} Detail: ${errorMessage}` : fallbackMessage;
}

function isMonthKey(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

function resolveMonthKeyFromIsoDate(isoDate: string | undefined): string | null {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return null;
  }

  return isoDate.slice(0, 7);
}

export function formatOverviewMonthLabel(monthKey: string): string {
  if (!isMonthKey(monthKey)) {
    return monthKey;
  }

  const parsedDate = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return monthKey;
  }

  return parsedDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function resolveMonthIsoRange(monthKey: string): { startIso: string; endIso: string } | null {
  if (!isMonthKey(monthKey)) {
    return null;
  }

  const parsedDate = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  const monthStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1, 12);
  const monthEnd = new Date(parsedDate.getFullYear(), parsedDate.getMonth() + 1, 0, 12);
  return {
    startIso: formatLocalIsoDate(monthStart),
    endIso: formatLocalIsoDate(monthEnd),
  };
}

function resolveGroupTravelIsoRange(group: GroupData): { startIso: string; endIso: string } | null {
  const normalizedArrivalIso = group.arrivalDate?.trim() ?? "";
  const normalizedReturnIso = group.returnDate?.trim() ?? "";
  const validItineraryDates = group.itinerary
    .map((item) => getItineraryIsoDate(item).trim())
    .filter((isoDate) => /^\d{4}-\d{2}-\d{2}$/.test(isoDate))
    .sort();

  const startIso = /^\d{4}-\d{2}-\d{2}$/.test(normalizedArrivalIso)
    ? normalizedArrivalIso
    : (validItineraryDates[0] ?? "");
  const latestItineraryIso = validItineraryDates[validItineraryDates.length - 1] ?? "";
  const endIsoCandidate = /^\d{4}-\d{2}-\d{2}$/.test(normalizedReturnIso) ? normalizedReturnIso : latestItineraryIso;
  if (!startIso && !endIsoCandidate) {
    return null;
  }

  const endIso = endIsoCandidate && endIsoCandidate >= startIso ? endIsoCandidate : startIso;
  return {
    startIso: startIso || endIso,
    endIso,
  };
}

export function collectGroupMonthKeys(group: GroupData): string[] {
  const travelRange = resolveGroupTravelIsoRange(group);
  if (!travelRange) {
    return [];
  }

  const startMonthKey = resolveMonthKeyFromIsoDate(travelRange.startIso);
  const endMonthKey = resolveMonthKeyFromIsoDate(travelRange.endIso);
  if (!startMonthKey || !endMonthKey) {
    return [];
  }

  const startDate = new Date(`${startMonthKey}-01T12:00:00`);
  const endDate = new Date(`${endMonthKey}-01T12:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }

  const monthKeys: string[] = [];
  const cursor = new Date(startDate);
  while (cursor.getTime() <= endDate.getTime()) {
    monthKeys.push(formatLocalIsoDate(cursor).slice(0, 7));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return monthKeys;
}

export function doesGroupMatchOverviewMonth(group: GroupData, monthKey: string): boolean {
  if (monthKey === "all") {
    return true;
  }

  const monthRange = resolveMonthIsoRange(monthKey);
  const groupRange = resolveGroupTravelIsoRange(group);
  if (!monthRange || !groupRange) {
    return false;
  }

  return groupRange.endIso >= monthRange.startIso && groupRange.startIso <= monthRange.endIso;
}

export function routeUsesGroupRecords({
  activeNav,
  selectedGroupCode,
  selectedVisaGroupCode,
}: {
  activeNav: NavId;
  selectedGroupCode: string | null;
  selectedVisaGroupCode: string | null;
}): boolean {
  if (selectedGroupCode || selectedVisaGroupCode) {
    return true;
  }

  return (
    activeNav === "overview" ||
    activeNav === "new-group" ||
    activeNav === "checklist" ||
    activeNav === "visa" ||
    activeNav === "invoice" ||
    activeNav === "raudhah-reminder"
  );
}

export function resolveRequestedGroupProjection({
  activeNav,
  selectedGroupCode,
  selectedVisaGroupCode,
}: {
  activeNav: NavId;
  selectedGroupCode: string | null;
  selectedVisaGroupCode: string | null;
}): GroupFetchProjection {
  if (
    selectedGroupCode ||
    selectedVisaGroupCode ||
    activeNav === "checklist" ||
    activeNav === "visa" ||
    activeNav === "invoice" ||
    activeNav === "raudhah-reminder"
  ) {
    return "detail";
  }

  return "summary";
}

export function shouldUseRemoteGroupSearch({
  activeNav,
  usesGroupRecords,
  requestedProjection,
}: {
  activeNav: NavId;
  usesGroupRecords: boolean;
  requestedProjection: GroupFetchProjection;
}): boolean {
  // Overview needs the full summary list so child-group matches can resolve
  // back to the parent card before the final local filter runs.
  return usesGroupRecords && requestedProjection === "summary" && activeNav !== "overview";
}

export function filterOverviewGroups({
  sourceGroups,
  allGroups,
  normalizedQuery,
  isActiveOnly,
  shouldFilterByMonth,
  overviewMonthFilter,
}: {
  sourceGroups: GroupData[];
  allGroups: GroupData[];
  normalizedQuery: string;
  isActiveOnly: boolean;
  shouldFilterByMonth: boolean;
  overviewMonthFilter: string;
}): GroupData[] {
  return sourceGroups.filter((group) => {
    // Exclude child/follower groups from overview cards.
    if (group.parentGroupId) {
      return false;
    }

    if (shouldFilterByMonth && !doesGroupMatchOverviewMonth(group, overviewMonthFilter)) {
      return false;
    }

    if (isActiveOnly && group.tone !== "active") {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const matchesMain = [group.code, group.name, group.packageName, group.status].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
    if (matchesMain) {
      return true;
    }

    const children = allGroups.filter(
      (candidate) =>
        candidate.parentGroupId &&
        (candidate.parentGroupId === group.id || candidate.parentGroupId === group.code) &&
        candidate.code !== group.code,
    );
    return children.some((child) =>
      [child.code, child.name, child.packageName, child.status].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  });
}

export function resolveGroupDetailRecord(
  group: GroupData | null,
  allGroups: GroupData[],
): GroupData | null {
  if (!group?.parentGroupId) {
    return group;
  }

  const parent = allGroups.find(
    (candidate) => candidate.id === group.parentGroupId || candidate.code === group.parentGroupId,
  );
  if (!parent) {
    return group;
  }

  return {
    ...group,
    musyrif: parent.musyrif,
    nextActivity: parent.nextActivity,
    timeline: parent.timeline,
    itinerary: parent.itinerary,
    notes: parent.notes,
    checklistAssignments: parent.checklistAssignments,
  };
}

function isIsoDateOnly(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function resolveIdentityDurationDays(
  identity: GroupIdentityDraftPayload,
  arrivalDate: string,
  returnDate: string,
): number {
  if (identity.durationDays && identity.durationDays > 0) {
    return identity.durationDays;
  }

  const startMs = Date.parse(`${arrivalDate}T00:00:00`);
  const endMs = Date.parse(`${returnDate}T00:00:00`);
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
    return Math.max(1, Math.floor((endMs - startMs) / 86_400_000) + 1);
  }

  return 1;
}

export function buildLocalIdentityGroup(identity: GroupIdentityDraftPayload): GroupData {
  const normalizedCode = identity.groupCode.trim().toUpperCase();
  const arrivalDate = isIsoDateOnly(identity.arrivalDate)
    ? identity.arrivalDate.trim()
    : formatLocalIsoDate(new Date());
  const durationDays = Math.max(1, identity.durationDays ?? 1);
  const rawReturnDate = isIsoDateOnly(identity.returnDate)
    ? identity.returnDate.trim()
    : shiftIsoDate(arrivalDate, durationDays - 1);
  const returnDate = rawReturnDate >= arrivalDate ? rawReturnDate : arrivalDate;
  const resolvedDurationDays = resolveIdentityDurationDays(identity, arrivalDate, returnDate);
  const arrivalLabel = formatScheduleDate(arrivalDate);
  const returnLabel = formatScheduleDate(returnDate);
  const pax = Math.max(1, identity.pax ?? 1);

  return {
    agentId: identity.agentId?.trim() || "agent_gtt_direct",
    code: normalizedCode,
    name: identity.groupName?.trim() || `Group ${normalizedCode}`,
    status: "Entry Only",
    tone: "active",
    pax,
    totalBuses: identity.totalBuses ?? getMinimumBusCountForPax(pax),
    packageName: identity.packageName?.trim() || "Pending Package",
    durationDays: resolvedDurationDays,
    arrivalDate,
    returnDate,
    timeline: [
      {
        date: arrivalLabel.date,
        title: "Group identity created",
      },
      {
        date: returnLabel.date,
        title: "Agreement and itinerary pending",
        isCurrent: true,
        nextActivity: "Link agreement and create itinerary",
      },
    ],
    nextActivity: {
      title: "Complete group workspace",
      date: arrivalLabel.date,
      time: "09:00",
      icon: "pending_actions",
    },
    itinerary: [],
    notes: ["Group workspace created from identity entry. Agreement and itinerary can be linked later."],
    musyrif: {
      name: identity.musyrifName?.trim() || "Unassigned Musyrif",
      phone: identity.musyrifPhone?.trim() || "-",
      avatar: musyrifAvatar,
    },
    visaSetup: identity.busStatus
      ? {
          visaStatus: "Draft",
          issuedDate: "",
          syarikah: "Not assigned",
          busStatus: identity.busStatus,
          paymentStatus: "Unpaid",
          makkahHotels: [],
          madinahHotels: [],
          raudhahAppointments: [],
        }
      : undefined,
    checklistAssignments: [],
  };
}

