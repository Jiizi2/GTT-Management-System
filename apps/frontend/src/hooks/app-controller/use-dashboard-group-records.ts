import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  buildVisaTrackingRowsFromGroups,
  formatLocalIsoDate,
  formatScheduleDate,
  getItineraryIsoDate,
  getMinimumBusCountForPax,
  groups,
  musyrifAvatar,
  normalizeGroupStatus,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  shiftIsoDate,
} from "../../shared/app-domain";
import type {
  AgreementApprovalStatus,
  GroupAgreementHotel,
  GroupData,
  NavId,
  GroupRaudhahAppointment,
  GroupVisaSetup,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaRaudhahEditFormState,
  VisaStatus,
  VisaTrackingRow,
} from "../../shared/app-domain";
import { agreementDraftQueryKeys, groupQueryKeys } from "../../shared/query-keys";
import { useGroupsQuery, useGroupsSearchQuery } from "../use-groups-query";
import {
  createGroupInBackend,
  createGroupIdentityInBackend,
  deleteGroupInBackend,
  deleteVisaHotelAgreementInBackend,
  fetchGroupsFromBackend,
  getVisaAgreementValidationError,
  replaceGroupInBackend,
  saveVisaHotelAgreementInBackend,
  sortHotelsByStayStart,
  type GroupFetchProjection,
  type GroupIdentityDraftPayload,
} from "../use-app-controller-backend";
import type { OverviewMonthOption, OverviewStatCard, SyncFeedback } from "./types";

type UseDashboardGroupRecordsOptions = {
  activeNav: NavId;
  query: string;
  isActiveOnly: boolean;
  overviewMonthFilter: string;
  selectedGroupCode: string | null;
  selectedVisaGroupCode: string | null;
  allowLocalFallback: boolean;
  showSyncFeedback: (tone: SyncFeedback["tone"], message: string) => void;
  clearQuery: () => void;
  navigateToOverview: (options?: { replace?: boolean }) => void;
  navigateToGroupDetail: (groupCode: string, options?: { replace?: boolean }) => void;
  navigateToVisaTracking: (options?: { replace?: boolean }) => void;
  navigateToVisaDetail: (groupCode: string, options?: { replace?: boolean }) => void;
};

type GroupRecordsSnapshot = {
  groupRecords: GroupData[];
  projection: GroupFetchProjection;
  activeOnly: boolean;
};

type SyncFailureMessage = string | ((error: unknown) => string);

function getCurrentWeekIsoRange(referenceDate = new Date()): {
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

function isIsoDateInRange(isoDate: string | undefined, startIso: string, endIso: string): boolean {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return false;
  }

  return isoDate >= startIso && isoDate <= endIso;
}

function isArrivalCategory(item: { categoryKey?: string; category: string }): boolean {
  const normalizedKey = item.categoryKey?.trim().toLowerCase() ?? "";
  if (normalizedKey === "arrival") {
    return true;
  }

  return item.category.trim().toLowerCase() === "arrival";
}

function formatPeakTripDayLabel(isoDate: string): string {
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

function getCurrentMonthKey(referenceDate = new Date()): string {
  return formatLocalIsoDate(referenceDate).slice(0, 7);
}

function getMillisecondsUntilNextLocalDay(referenceDate = new Date()): number {
  const nextDay = new Date(referenceDate);
  nextDay.setHours(24, 0, 0, 0);
  return Math.max(1_000, nextDay.getTime() - referenceDate.getTime());
}

function resolveDashboardSyncFailureMessage(error: unknown, fallbackMessage: string): string {
  const normalizedMessage = error instanceof Error ? error.message.toLowerCase() : "";
  if (normalizedMessage.includes("group code") && normalizedMessage.includes("already exists")) {
    return "Group number sudah dipakai oleh group lain.";
  }

  return fallbackMessage;
}

function useCurrentDashboardDate(): Date {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      const referenceDate = new Date();
      timeoutHandle = setTimeout(() => {
        setCurrentDate(new Date());
        scheduleRefresh();
      }, getMillisecondsUntilNextLocalDay(referenceDate));
    };

    scheduleRefresh();

    return () => {
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
      }
    };
  }, []);

  return currentDate;
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

function formatOverviewMonthLabel(monthKey: string): string {
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

function collectGroupMonthKeys(group: GroupData): string[] {
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

function doesGroupMatchOverviewMonth(group: GroupData, monthKey: string): boolean {
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

function routeUsesGroupRecords({
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

function resolveRequestedGroupProjection({
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

function buildLocalIdentityGroup(identity: GroupIdentityDraftPayload): GroupData {
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
    checklistAssignments: [],
  };
}

export function useDashboardGroupRecords({
  activeNav,
  query,
  isActiveOnly,
  overviewMonthFilter,
  selectedGroupCode,
  selectedVisaGroupCode,
  allowLocalFallback,
  showSyncFeedback,
  clearQuery,
  navigateToOverview,
  navigateToGroupDetail,
  navigateToVisaTracking,
  navigateToVisaDetail,
}: UseDashboardGroupRecordsOptions) {
  const queryClient = useQueryClient();
  const [groupRecords, setGroupRecords] = useState<GroupData[]>(groups);
  const [groupRecordsProjection, setGroupRecordsProjection] = useState<GroupFetchProjection>("detail");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const groupRecordsRef = useRef(groupRecords);
  const groupRecordsProjectionRef = useRef(groupRecordsProjection);
  const handledGroupsQueryErrorRef = useRef(0);
  const handledSearchQueryErrorRef = useRef(0);
  const usesGroupRecords = routeUsesGroupRecords({
    activeNav,
    selectedGroupCode,
    selectedVisaGroupCode,
  });
  const requestedProjection = resolveRequestedGroupProjection({
    activeNav,
    selectedGroupCode,
    selectedVisaGroupCode,
  });
  const requestedProjectionRef = useRef(requestedProjection);
  // Keep the combined overview controls independent: month selection is based on
  // all overview rows, while Active only is applied as a local filter.
  const shouldUseRemoteOverviewActiveOnly = false;
  const shouldUseRemoteOverviewActiveOnlyRef = useRef(shouldUseRemoteOverviewActiveOnly);
  const backendSyncRequestIdRef = useRef(0);
  const currentDashboardDate = useCurrentDashboardDate();
  const currentOverviewMonthKey = useMemo(() => getCurrentMonthKey(currentDashboardDate), [currentDashboardDate]);
  const shouldFilterOverviewByMonth = activeNav === "overview" && overviewMonthFilter !== "all";
  const shouldUseRemoteSearch = usesGroupRecords && requestedProjection === "summary";

  const groupsQuery = useGroupsQuery(requestedProjection, usesGroupRecords, shouldUseRemoteOverviewActiveOnly);
  const searchQuery = useGroupsSearchQuery(
    normalizedQuery,
    "summary",
    shouldUseRemoteSearch,
    shouldUseRemoteOverviewActiveOnly,
  );
  const createGroupMutation = useMutation({
    mutationFn: (group: GroupData) => createGroupInBackend(group),
    retry: false,
  });
  const createGroupIdentityMutation = useMutation({
    mutationFn: (identity: GroupIdentityDraftPayload) => createGroupIdentityInBackend(identity),
    retry: false,
  });
  const replaceGroupMutation = useMutation({
    mutationFn: ({ groupCode, group }: { groupCode: string; group: GroupData }) =>
      replaceGroupInBackend(groupCode, group),
    retry: false,
  });
  const deleteGroupMutation = useMutation({
    mutationFn: (groupCode: string) => deleteGroupInBackend(groupCode),
    retry: false,
  });
  const saveVisaHotelMutation = useMutation({
    mutationFn: saveVisaHotelAgreementInBackend,
    retry: false,
  });
  const deleteVisaHotelMutation = useMutation({
    mutationFn: deleteVisaHotelAgreementInBackend,
    retry: false,
  });

  const syncGroupRecords = useCallback(
    (
      nextGroupRecords: GroupData[],
      projection: GroupFetchProjection,
      activeOnly = shouldUseRemoteOverviewActiveOnly,
    ) => {
      groupRecordsRef.current = nextGroupRecords;
      groupRecordsProjectionRef.current = projection;
      setGroupRecords(nextGroupRecords);
      setGroupRecordsProjection(projection);
      queryClient.setQueryData(groupQueryKeys.list(projection, activeOnly), nextGroupRecords);
    },
    [queryClient, shouldUseRemoteOverviewActiveOnly],
  );

  const commitGroupRecords = useCallback(
    (updater: (current: GroupData[]) => GroupData[]) => {
      setGroupRecords((current) => {
        const next = updater(current);
        groupRecordsRef.current = next;
        groupRecordsProjectionRef.current = requestedProjection;
        queryClient.setQueryData(groupQueryKeys.list(requestedProjection, shouldUseRemoteOverviewActiveOnly), next);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: groupQueryKeys.searchRoot });
    },
    [queryClient, requestedProjection, shouldUseRemoteOverviewActiveOnly],
  );

  useEffect(() => {
    groupRecordsRef.current = groupRecords;
  }, [groupRecords]);

  useEffect(() => {
    groupRecordsProjectionRef.current = groupRecordsProjection;
  }, [groupRecordsProjection]);

  useEffect(() => {
    requestedProjectionRef.current = requestedProjection;
  }, [requestedProjection]);

  useEffect(() => {
    shouldUseRemoteOverviewActiveOnlyRef.current = shouldUseRemoteOverviewActiveOnly;
  }, [shouldUseRemoteOverviewActiveOnly]);

  useEffect(() => {
    if (groupsQuery.data === undefined) {
      return;
    }

    syncGroupRecords(groupsQuery.data, requestedProjection);
  }, [groupsQuery.data, requestedProjection, syncGroupRecords]);

  useEffect(() => {
    if (!usesGroupRecords) {
      return;
    }

    if (
      !groupsQuery.isError ||
      groupsQuery.errorUpdatedAt === 0 ||
      handledGroupsQueryErrorRef.current === groupsQuery.errorUpdatedAt
    ) {
      return;
    }

    handledGroupsQueryErrorRef.current = groupsQuery.errorUpdatedAt;

    if (allowLocalFallback) {
      showSyncFeedback("info", "Mode lokal aktif. Backend belum terhubung, data disimpan sementara di browser.");
      console.warn("Backend group fetch skipped. App will continue with local state.", groupsQuery.error);
      return;
    }

    syncGroupRecords([], requestedProjection);
    showSyncFeedback("error", "Backend tidak terhubung. Data tidak bisa dimuat dari database.");
  }, [
    allowLocalFallback,
    groupsQuery.error,
    groupsQuery.errorUpdatedAt,
    groupsQuery.isError,
    requestedProjection,
    showSyncFeedback,
    syncGroupRecords,
    usesGroupRecords,
  ]);

  useEffect(() => {
    if (!shouldUseRemoteSearch) {
      return;
    }

    if (
      !searchQuery.isError ||
      searchQuery.errorUpdatedAt === 0 ||
      handledSearchQueryErrorRef.current === searchQuery.errorUpdatedAt
    ) {
      return;
    }

    handledSearchQueryErrorRef.current = searchQuery.errorUpdatedAt;

    if (allowLocalFallback) {
      console.warn("Backend search skipped. Using local search filter as fallback.", searchQuery.error);
    }
  }, [allowLocalFallback, searchQuery.error, searchQuery.errorUpdatedAt, searchQuery.isError, shouldUseRemoteSearch]);

  const captureGroupRecordsSnapshot = useCallback(
    (): GroupRecordsSnapshot => ({
      groupRecords: groupRecordsRef.current,
      projection: groupRecordsProjectionRef.current,
      activeOnly: shouldUseRemoteOverviewActiveOnlyRef.current,
    }),
    [],
  );

  const syncGroupsFromBackendOrRestore = useCallback(
    async (requestId: number, rollbackSnapshot?: GroupRecordsSnapshot) => {
      const projection = requestedProjectionRef.current;
      const activeOnly = shouldUseRemoteOverviewActiveOnlyRef.current;

      try {
        const backendGroups = await fetchGroupsFromBackend({
          projection,
          activeOnly,
        });
        if (requestId !== backendSyncRequestIdRef.current) {
          return;
        }

        syncGroupRecords(backendGroups, projection, activeOnly);
      } catch (error: unknown) {
        if (requestId !== backendSyncRequestIdRef.current) {
          return;
        }

        if (rollbackSnapshot) {
          syncGroupRecords(rollbackSnapshot.groupRecords, rollbackSnapshot.projection, rollbackSnapshot.activeOnly);
        }

        console.warn("Failed to restore group state from backend.", error);
      }
    },
    [syncGroupRecords],
  );

  const runBackendSync = useCallback(
    ({
      task,
      successMessage,
      failureMessage,
      rollbackSnapshot,
      showSuccess = true,
    }: {
      task: Promise<void>;
      successMessage: string;
      failureMessage: SyncFailureMessage;
      rollbackSnapshot?: GroupRecordsSnapshot;
      showSuccess?: boolean;
    }) => {
      const requestId = backendSyncRequestIdRef.current + 1;
      backendSyncRequestIdRef.current = requestId;

      void task
        .then(() => {
          if (requestId !== backendSyncRequestIdRef.current) {
            return;
          }

          void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all });
          void queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all });
          if (showSuccess) {
            showSyncFeedback("success", successMessage);
          }
        })
        .catch(async (error: unknown) => {
          if (requestId !== backendSyncRequestIdRef.current) {
            console.warn("Skipped stale backend sync failure.", error);
            return;
          }

          if (!allowLocalFallback) {
            await syncGroupsFromBackendOrRestore(requestId, rollbackSnapshot);
          }

          const resolvedFailureMessage = typeof failureMessage === "function" ? failureMessage(error) : failureMessage;
          showSyncFeedback("error", resolvedFailureMessage);
          if (allowLocalFallback) {
            console.warn(resolvedFailureMessage, error);
          }
        });
    },
    [allowLocalFallback, queryClient, showSyncFeedback, syncGroupsFromBackendOrRestore],
  );

  const isWaitingForDetailedRecords =
    usesGroupRecords && requestedProjection === "detail" && groupRecordsProjection !== "detail";
  const visibleGroupRecords = useMemo(
    () => (isWaitingForDetailedRecords ? [] : groupRecords),
    [groupRecords, isWaitingForDetailedRecords],
  );
  const remoteSearchMatches = normalizedQuery && shouldUseRemoteSearch ? (searchQuery.data ?? null) : null;

  const groupRecordsByCode = useMemo(
    () => new Map(visibleGroupRecords.map((group) => [group.code.toUpperCase(), group])),
    [visibleGroupRecords],
  );

  const overviewMonthOptions = useMemo<OverviewMonthOption[]>(() => {
    const monthKeySet = new Set<string>();
    monthKeySet.add(currentOverviewMonthKey);
    if (overviewMonthFilter !== "all") {
      monthKeySet.add(overviewMonthFilter);
    }

    visibleGroupRecords.forEach((group) => {
      collectGroupMonthKeys(group).forEach((monthKey) => {
        monthKeySet.add(monthKey);
      });
    });

    return [
      { value: "all", label: "All Months" },
      ...Array.from(monthKeySet)
        .sort((left, right) => right.localeCompare(left))
        .map((monthKey) => ({
          value: monthKey,
          label: formatOverviewMonthLabel(monthKey),
        })),
    ];
  }, [currentOverviewMonthKey, overviewMonthFilter, visibleGroupRecords]);

  const selectedOverviewMonthLabel = useMemo(() => {
    if (overviewMonthFilter === "all") {
      return "All Months";
    }

    return (
      overviewMonthOptions.find((option) => option.value === overviewMonthFilter)?.label ??
      formatOverviewMonthLabel(overviewMonthFilter)
    );
  }, [overviewMonthFilter, overviewMonthOptions]);

  const filteredGroups = useMemo(() => {
    const sourceGroups = normalizedQuery
      ? (remoteSearchMatches ?? visibleGroupRecords).map((group) => {
          const localVersion = groupRecordsByCode.get(group.code.toUpperCase());
          return localVersion ?? group;
        })
      : visibleGroupRecords;

    return sourceGroups.filter((group) => {
      // Exclude child/follower groups from overview
      if (group.parentGroupId) {
        return false;
      }

      if (shouldFilterOverviewByMonth && !doesGroupMatchOverviewMonth(group, overviewMonthFilter)) {
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

      // Check if any child group matches the query
      const children = visibleGroupRecords.filter(
        (g) => g.parentGroupId && (g.parentGroupId === group.id || g.parentGroupId === group.code) && g.code !== group.code
      );
      return children.some((child) =>
        [child.code, child.name, child.packageName, child.status].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ),
      );
    });
  }, [
    groupRecordsByCode,
    isActiveOnly,
    normalizedQuery,
    overviewMonthFilter,
    remoteSearchMatches,
    shouldFilterOverviewByMonth,
    visibleGroupRecords,
  ]);

  const visaTrackingRows = useMemo(() => buildVisaTrackingRowsFromGroups(visibleGroupRecords), [visibleGroupRecords]);

  const selectedVisaRow = useMemo(() => {
    if (!selectedVisaGroupCode) {
      return null;
    }

    const normalizedSelectedVisaGroupCode = selectedVisaGroupCode.trim().toUpperCase();
    return (
      visaTrackingRows.find((row) => row.groupCode.trim().toUpperCase() === normalizedSelectedVisaGroupCode) ?? null
    );
  }, [selectedVisaGroupCode, visaTrackingRows]);

  const selectedGroup = useMemo(
    () =>
      selectedGroupCode
        ? (visibleGroupRecords.find(
            (group) => group.code.trim().toUpperCase() === selectedGroupCode.trim().toUpperCase(),
          ) ?? null)
        : null,
    [selectedGroupCode, visibleGroupRecords],
  );

  const { weekStartIso, weekEndIso } = useMemo(
    () => getCurrentWeekIsoRange(currentDashboardDate),
    [currentDashboardDate],
  );
  const overviewMetricSourceGroups = useMemo(
    () => {
      const baseGroups = shouldFilterOverviewByMonth
        ? visibleGroupRecords.filter((group) => doesGroupMatchOverviewMonth(group, overviewMonthFilter))
        : visibleGroupRecords;
      // Exclude child groups from overview metrics to avoid itinerary double-counting
      return baseGroups.filter((group) => !group.parentGroupId);
    },
    [overviewMonthFilter, shouldFilterOverviewByMonth, visibleGroupRecords],
  );

  const overviewMetrics = useMemo(() => {
    const activeGroups = overviewMetricSourceGroups.filter((group) => group.tone === "active");
    const activePilgrims = activeGroups.reduce((total, group) => {
      // Find all child groups of this parent group in visibleGroupRecords
      const children = visibleGroupRecords.filter(
        (g) => g.parentGroupId && (g.parentGroupId === group.id || g.parentGroupId === group.code) && g.code !== group.code
      );
      const activeChildren = children.filter((c) => c.tone === "active");
      const groupTotal = group.pax + activeChildren.reduce((sum, child) => sum + child.pax, 0);
      return total + groupTotal;
    }, 0);
    let totalTripsThisWeek = 0;
    let groupsArrivingThisWeek = 0;
    const tripCountByIsoDate = new Map<string, number>();

    for (const group of activeGroups) {
      let hasArrivalThisWeek = false;

      for (const item of group.itinerary) {
        const itineraryIsoDate = item.isoDate?.trim();
        if (!itineraryIsoDate || !isIsoDateInRange(itineraryIsoDate, weekStartIso, weekEndIso)) {
          continue;
        }

        totalTripsThisWeek += 1;
        tripCountByIsoDate.set(itineraryIsoDate, (tripCountByIsoDate.get(itineraryIsoDate) ?? 0) + 1);
        if (!hasArrivalThisWeek && isArrivalCategory(item)) {
          hasArrivalThisWeek = true;
        }
      }

      if (hasArrivalThisWeek) {
        groupsArrivingThisWeek += 1;
      }
    }

    let peakTripDateIso = "";
    let peakTripCount = 0;
    for (const [tripDateIso, tripCount] of tripCountByIsoDate.entries()) {
      if (
        tripCount > peakTripCount ||
        (tripCount === peakTripCount && peakTripDateIso.length > 0 && tripDateIso.localeCompare(peakTripDateIso) < 0)
      ) {
        peakTripCount = tripCount;
        peakTripDateIso = tripDateIso;
      } else if (peakTripDateIso.length === 0) {
        peakTripCount = tripCount;
        peakTripDateIso = tripDateIso;
      }
    }

    return {
      activePilgrims,
      totalTripsThisWeek,
      groupsArrivingThisWeek,
      peakTripCount,
      peakTripDateIso,
      peakTripDateLabel: formatPeakTripDayLabel(peakTripDateIso),
      peakTripSummary:
        peakTripCount > 0
          ? `Peak day: ${formatPeakTripDayLabel(peakTripDateIso)} (${peakTripCount} trips).`
          : "No trips scheduled this week.",
    };
  }, [overviewMetricSourceGroups, visibleGroupRecords, weekEndIso, weekStartIso]);

  const statCards = useMemo<OverviewStatCard[]>(
    () => [
      {
        label: "Active Pilgrims",
        value: overviewMetrics.activePilgrims.toString(),
        subtitle: "Pilgrims in active groups",
        icon: "groups",
        tone: "primary",
      },
      {
        label: "Trips This Week",
        value: overviewMetrics.totalTripsThisWeek.toString(),
        subtitle: `${weekStartIso} - ${weekEndIso}`,
        icon: "route",
        tone: "secondary",
      },
      {
        label: "Peak Trip Day",
        value: overviewMetrics.peakTripCount > 0 ? overviewMetrics.peakTripDateLabel : "-",
        subtitle: overviewMetrics.peakTripCount > 0 ? `${overviewMetrics.peakTripCount} trips` : "No trips this week",
        icon: "event_available",
        tone: "tertiary",
      },
    ],
    [overviewMetrics, weekEndIso, weekStartIso],
  );

  const summaryMessage = useMemo(() => {
    const monthMessage = overviewMonthFilter === "all" ? "across all months" : `for ${selectedOverviewMonthLabel}`;

    if (normalizedQuery) {
      return `${filteredGroups.length} groups match your search${isActiveOnly ? " (active only)" : ""} ${monthMessage}. ${overviewMetrics.totalTripsThisWeek} trips are scheduled this week (${weekStartIso} - ${weekEndIso}). ${overviewMetrics.peakTripSummary}`;
    }

    if (isActiveOnly) {
      return `${filteredGroups.length} active groups shown ${monthMessage}. ${overviewMetrics.totalTripsThisWeek} trips this week (${weekStartIso} - ${weekEndIso}). ${overviewMetrics.peakTripSummary}`;
    }

    return `${overviewMetrics.groupsArrivingThisWeek} groups arriving ${monthMessage} with ${overviewMetrics.totalTripsThisWeek} total trips this week (${weekStartIso} - ${weekEndIso}). ${overviewMetrics.peakTripSummary}`;
  }, [
    filteredGroups.length,
    isActiveOnly,
    normalizedQuery,
    overviewMonthFilter,
    overviewMetrics.groupsArrivingThisWeek,
    overviewMetrics.peakTripSummary,
    overviewMetrics.totalTripsThisWeek,
    selectedOverviewMonthLabel,
    weekEndIso,
    weekStartIso,
  ]);

  const createDefaultVisaSetup = useCallback(
    (group: GroupData, row: VisaTrackingRow): GroupVisaSetup => ({
      visaStatus: row.visaStatus,
      issuedDate: row.issuedDateIso,
      syarikah: "Not assigned",
      busStatus: undefined,
      paymentStatus: row.paymentStatus,
      makkahHotels: [],
      madinahHotels: [],
      raudhahAppointments: [],
    }),
    [],
  );

  const updateVisaSetupForGroupAndSync = useCallback(
    (
      groupCode: string,
      updater: (args: { group: GroupData; row: VisaTrackingRow; visaSetup: GroupVisaSetup }) => GroupVisaSetup,
      syncMessages?: {
        successMessage?: string;
        failureMessage?: string;
      },
    ) => {
      const latestGroupRecords = groupRecordsRef.current;
      const currentGroup = latestGroupRecords.find((group) => group.code === groupCode);
      if (!currentGroup) {
        return;
      }

      const currentRow = buildVisaTrackingRowsFromGroups(latestGroupRecords).find((row) => row.groupCode === groupCode);
      if (!currentRow) {
        return;
      }

      const currentVisaSetup = currentGroup.visaSetup ?? createDefaultVisaSetup(currentGroup, currentRow);
      const nextVisaSetup = updater({
        group: currentGroup,
        row: currentRow,
        visaSetup: currentVisaSetup,
      });
      if (nextVisaSetup === currentVisaSetup) {
        return;
      }

      const nextGroup = normalizeGroupStatus({
        ...currentGroup,
        visaSetup: nextVisaSetup,
      });
      const rollbackSnapshot = captureGroupRecordsSnapshot();

      commitGroupRecords((current) => current.map((group) => (group.code === groupCode ? nextGroup : group)));

      runBackendSync({
        task: replaceGroupMutation.mutateAsync({ groupCode, group: nextGroup }),
        successMessage: syncMessages?.successMessage ?? "Perubahan visa berhasil disimpan.",
        failureMessage: syncMessages?.failureMessage ?? "Perubahan visa belum berhasil disimpan ke backend.",
        rollbackSnapshot,
        showSuccess: true,
      });
    },
    [captureGroupRecordsSnapshot, commitGroupRecords, createDefaultVisaSetup, replaceGroupMutation, runBackendSync],
  );

  const handleDeleteGroup = useCallback(
    (groupCode: string) => {
      const normalizedGroupCode = groupCode.trim().toUpperCase();
      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) =>
        current.filter((group) => group.code.trim().toUpperCase() !== normalizedGroupCode),
      );
      navigateToOverview({ replace: true });

      runBackendSync({
        task: deleteGroupMutation.mutateAsync(groupCode),
        successMessage: "Group berhasil dihapus.",
        failureMessage: "Penghapusan group belum berhasil disimpan ke backend.",
        rollbackSnapshot,
        showSuccess: true,
      });
    },
    [captureGroupRecordsSnapshot, commitGroupRecords, deleteGroupMutation, navigateToOverview, runBackendSync],
  );

  const handleDeleteVisaGroup = useCallback(
    (groupCode: string) => {
      const normalizedGroupCode = groupCode.trim().toUpperCase();
      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) =>
        current.filter((group) => group.code.trim().toUpperCase() !== normalizedGroupCode),
      );
      navigateToVisaTracking({ replace: true });

      runBackendSync({
        task: deleteGroupMutation.mutateAsync(groupCode),
        successMessage: "Group berhasil dihapus.",
        failureMessage: "Penghapusan group belum berhasil disimpan ke backend.",
        rollbackSnapshot,
        showSuccess: true,
      });
    },
    [captureGroupRecordsSnapshot, commitGroupRecords, deleteGroupMutation, navigateToVisaTracking, runBackendSync],
  );

  const handleUpdateAgreementStatus = useCallback(
    (groupCode: string, city: "makkah" | "madinah", status: AgreementApprovalStatus) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ group, row, visaSetup }) => {
        const cityHotelKey = city === "makkah" ? "makkahHotels" : "madinahHotels";
        const currentCityHotels = visaSetup[cityHotelKey];
        const agreementDateRange = resolveVisaAgreementDateRange(row, group.durationDays, group);

        const updatedCityHotels =
          currentCityHotels.length > 0
            ? currentCityHotels.map((hotel) => ({ ...hotel, status }))
            : [
                {
                  id: `${group.code}-${city}-auto`,
                  hotelName: city === "makkah" ? "Makkah Hotel" : "Madinah Hotel",
                  agreementNumber: resolveVisaAgreementNumber(row, group, city),
                  pax: group.pax,
                  status,
                  stayStartIso:
                    city === "makkah" ? agreementDateRange.makkahStartIso : agreementDateRange.madinahStartIso,
                  stayEndIso: city === "makkah" ? agreementDateRange.makkahEndIso : agreementDateRange.madinahEndIso,
                },
              ];

        const nextVisaSetup: GroupVisaSetup = {
          ...visaSetup,
          [cityHotelKey]: sortHotelsByStayStart(updatedCityHotels),
        };

        const validationError = getVisaAgreementValidationError(nextVisaSetup);
        if (validationError) {
          showSyncFeedback("error", validationError);
          return visaSetup;
        }

        return nextVisaSetup;
      });
    },
    [showSyncFeedback, updateVisaSetupForGroupAndSync],
  );

  const handleUpdateVisaStatus = useCallback(
    (groupCode: string, visaStatus: VisaStatus) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => {
        const normalizedExistingIssuedDate = visaSetup.issuedDate?.trim() ?? "";
        const todayIso = formatLocalIsoDate(new Date());
        const nextIssuedDate =
          visaStatus === "Issued"
            ? /^\d{4}-\d{2}-\d{2}$/.test(normalizedExistingIssuedDate)
              ? normalizedExistingIssuedDate
              : todayIso
            : "";

        return {
          ...visaSetup,
          visaStatus,
          issuedDate: nextIssuedDate,
        };
      });
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleUpdateVisaType = useCallback(
    (groupCode: string, visaType: "Visa Only" | "Visa+") => {
      updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => ({
        ...visaSetup,
        busStatus: visaType,
      }));
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleUpdatePaymentStatus = useCallback(
    (groupCode: string, paymentStatus: VisaPaymentStatus) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => ({
        ...visaSetup,
        paymentStatus,
      }));
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleUpdateSyarikah = useCallback(
    (groupCode: string, syarikah: string) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => ({
        ...visaSetup,
        syarikah: syarikah.trim() || "Not assigned",
      }));
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleUpdateVisaHotel = useCallback(
    (groupCode: string, city: "makkah" | "madinah", hotel: VisaHotelEditFormState, hotelId?: string) => {
      const latestGroupRecords = groupRecordsRef.current;
      const currentGroup = latestGroupRecords.find((group) => group.code === groupCode);
      if (!currentGroup) {
        return;
      }

      const currentRow = buildVisaTrackingRowsFromGroups(latestGroupRecords).find((row) => row.groupCode === groupCode);
      if (!currentRow) {
        return;
      }

      const visaSetup = currentGroup.visaSetup ?? createDefaultVisaSetup(currentGroup, currentRow);
      const cityKey = city === "makkah" ? "makkahHotels" : "madinahHotels";
      const currentCityHotels = visaSetup[cityKey];
      const agreementDateRange = resolveVisaAgreementDateRange(currentRow, currentGroup.durationDays, currentGroup);
      const parsedHotelPax = Number.parseInt(hotel.pax, 10);
      const existingHotel = hotelId ? currentCityHotels.find((entry) => entry.id === hotelId) : undefined;
      const fallbackEditableHotel: GroupAgreementHotel = {
        id: existingHotel?.id ?? `${currentGroup.code}-${city}-${Date.now().toString(36)}`,
        hotelName: city === "makkah" ? "Makkah Hotel" : "Madinah Hotel",
        agreementNumber: resolveVisaAgreementNumber(currentRow, currentGroup, city),
        pax: currentGroup.pax,
        status: "Waiting for Approval",
        stayStartIso: city === "makkah" ? agreementDateRange.makkahStartIso : agreementDateRange.madinahStartIso,
        stayEndIso: city === "makkah" ? agreementDateRange.makkahEndIso : agreementDateRange.madinahEndIso,
      };

      const nextPrimaryHotel: GroupAgreementHotel = {
        ...fallbackEditableHotel,
        ...(existingHotel ?? {}),
        hotelName: hotel.hotelName.trim() || fallbackEditableHotel.hotelName,
        agreementNumber: hotel.agreementNumber.trim() || fallbackEditableHotel.agreementNumber,
        pax: Number.isFinite(parsedHotelPax) && parsedHotelPax >= 0 ? parsedHotelPax : fallbackEditableHotel.pax,
        status: hotel.status,
        stayStartIso: hotel.stayStartIso,
        stayEndIso: hotel.stayEndIso,
      };

      const nextCityHotels = sortHotelsByStayStart(
        !hotelId
          ? [...currentCityHotels, nextPrimaryHotel]
          : existingHotel
            ? currentCityHotels.map((entry) => (entry.id === hotelId ? nextPrimaryHotel : entry))
            : [...currentCityHotels, nextPrimaryHotel],
      );
      const nextVisaSetup: GroupVisaSetup = {
        ...visaSetup,
        [cityKey]: nextCityHotels,
      };
      const validationError = getVisaAgreementValidationError(nextVisaSetup);
      if (validationError) {
        showSyncFeedback("error", validationError);
        return;
      }

      const nextGroup = normalizeGroupStatus({
        ...currentGroup,
        visaSetup: nextVisaSetup,
      });

      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => current.map((group) => (group.code === groupCode ? nextGroup : group)));

      runBackendSync({
        task: saveVisaHotelMutation
          .mutateAsync({
            groupCode,
            city,
            hotel,
            hotelId: existingHotel ? hotelId : undefined,
          })
          .then((backendGroup) => {
            const normalizedBackendGroup = normalizeGroupStatus(backendGroup);
            commitGroupRecords((current) =>
              current.map((group) => (group.code === groupCode ? normalizedBackendGroup : group)),
            );
          }),
        successMessage: "Agreement hotel berhasil disimpan.",
        failureMessage: "Agreement hotel belum berhasil disimpan ke backend.",
        rollbackSnapshot,
      });
    },
    [
      captureGroupRecordsSnapshot,
      commitGroupRecords,
      createDefaultVisaSetup,
      runBackendSync,
      saveVisaHotelMutation,
      showSyncFeedback,
    ],
  );

  const handleDeleteVisaHotel = useCallback(
    (groupCode: string, city: "makkah" | "madinah", hotelId: string) => {
      const latestGroupRecords = groupRecordsRef.current;
      const currentGroup = latestGroupRecords.find((group) => group.code === groupCode);
      if (!currentGroup?.visaSetup) {
        return;
      }

      const cityKey = city === "makkah" ? "makkahHotels" : "madinahHotels";
      const currentCityHotels = currentGroup.visaSetup[cityKey];
      const nextCityHotels = currentCityHotels.filter((entry) => entry.id !== hotelId);
      if (nextCityHotels.length === currentCityHotels.length) {
        return;
      }

      const nextVisaSetup: GroupVisaSetup = {
        ...currentGroup.visaSetup,
        [cityKey]: sortHotelsByStayStart(nextCityHotels),
      };
      const validationError = getVisaAgreementValidationError(nextVisaSetup);
      if (validationError) {
        showSyncFeedback("error", validationError);
        return;
      }

      const nextGroup = normalizeGroupStatus({
        ...currentGroup,
        visaSetup: nextVisaSetup,
      });
      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => current.map((group) => (group.code === groupCode ? nextGroup : group)));

      runBackendSync({
        task: deleteVisaHotelMutation
          .mutateAsync({
            groupCode,
            hotelId,
          })
          .then((backendGroup) => {
            const normalizedBackendGroup = normalizeGroupStatus(backendGroup);
            commitGroupRecords((current) =>
              current.map((group) => (group.code === groupCode ? normalizedBackendGroup : group)),
            );
          }),
        successMessage: "Agreement hotel berhasil dihapus.",
        failureMessage: "Penghapusan agreement hotel belum berhasil disimpan ke backend.",
        rollbackSnapshot,
      });
    },
    [captureGroupRecordsSnapshot, commitGroupRecords, deleteVisaHotelMutation, runBackendSync, showSyncFeedback],
  );

  const handleUpdateRaudhahAppointment = useCallback(
    (groupCode: string, appointment: VisaRaudhahEditFormState) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ group, visaSetup }) => {
        const nextAppointments: GroupRaudhahAppointment[] = appointment.appointments
          .map((entry, index) => ({
            id: entry.id?.trim() || `${group.code}-raudhah-${Date.now().toString(36)}-${index + 1}`,
            dateIso: entry.dateIso.trim(),
            status: entry.status,
            tasrehPrinted: Boolean(entry.tasrehPrinted),
          }))
          .filter((entry) => entry.dateIso.length > 0)
          .sort((left, right) => left.dateIso.localeCompare(right.dateIso));

        return {
          ...visaSetup,
          raudhahAppointments: nextAppointments,
        };
      });
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleSetRaudhahTasrehPrinted = useCallback(
    (groupCode: string, appointmentId: string, tasrehPrinted: boolean) => {
      updateVisaSetupForGroupAndSync(
        groupCode,
        ({ visaSetup }) => {
          const nextAppointments = visaSetup.raudhahAppointments.map((entry) =>
            entry.id === appointmentId
              ? {
                  ...entry,
                  tasrehPrinted,
                }
              : entry,
          );

          const hasChanged = nextAppointments.some((entry, index) => entry !== visaSetup.raudhahAppointments[index]);
          if (!hasChanged) {
            return visaSetup;
          }

          return {
            ...visaSetup,
            raudhahAppointments: nextAppointments,
          };
        },
        {
          successMessage: "Status print tasreh Raudhah berhasil diperbarui.",
          failureMessage: "Perubahan status print tasreh Raudhah belum berhasil disimpan ke backend.",
        },
      );
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleClearRaudhahAppointment = useCallback(
    (groupCode: string) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => ({
        ...visaSetup,
        raudhahAppointments: [],
      }));
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleSaveInputGroup = useCallback(
    (group: GroupData) => {
      const normalizedGroup = normalizeGroupStatus(group);
      const latestGroupRecords = groupRecordsRef.current;
      const normalizedGroupCode = normalizedGroup.code.trim().toUpperCase();
      const hasDuplicateCode = latestGroupRecords.some(
        (item) => item.code.trim().toUpperCase() === normalizedGroupCode,
      );
      if (hasDuplicateCode) {
        showSyncFeedback("error", "Group number sudah dipakai. Gunakan nomor group yang berbeda.");
        return;
      }

      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => [normalizedGroup, ...current]);
      clearQuery();
      navigateToOverview({ replace: true });

      runBackendSync({
        task: createGroupMutation.mutateAsync(normalizedGroup),
        successMessage: "Group baru berhasil disimpan.",
        failureMessage: (error: unknown) =>
          resolveDashboardSyncFailureMessage(error, "Group belum berhasil disimpan ke backend."),
        rollbackSnapshot,
      });
    },
    [
      captureGroupRecordsSnapshot,
      clearQuery,
      commitGroupRecords,
      createGroupMutation,
      navigateToOverview,
      runBackendSync,
      showSyncFeedback,
    ],
  );

  const handleSaveGroupIdentity = useCallback(
    (identity: GroupIdentityDraftPayload) => {
      const normalizedGroupCode = identity.groupCode.trim().toUpperCase();
      if (!normalizedGroupCode) {
        showSyncFeedback("error", "Group number tidak boleh kosong.");
        return;
      }

      const hasDuplicateCode = groupRecordsRef.current.some(
        (item) => item.code.trim().toUpperCase() === normalizedGroupCode,
      );
      if (hasDuplicateCode) {
        showSyncFeedback("error", "Group number sudah dipakai. Gunakan nomor group yang berbeda.");
        return;
      }

      const localIdentityGroup = normalizeGroupStatus(buildLocalIdentityGroup(identity));
      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => [localIdentityGroup, ...current]);
      clearQuery();
      navigateToGroupDetail(normalizedGroupCode, { replace: true });

      runBackendSync({
        task: createGroupIdentityMutation.mutateAsync(identity).then((backendGroup) => {
          const normalizedBackendGroup = normalizeGroupStatus(backendGroup);
          commitGroupRecords((current) =>
            current.map((group) =>
              group.code.trim().toUpperCase() === normalizedGroupCode ? normalizedBackendGroup : group,
            ),
          );
        }),
        successMessage: "Workspace group berhasil dibuat dari identity entry.",
        failureMessage: (error: unknown) =>
          resolveDashboardSyncFailureMessage(error, "Workspace group belum berhasil disimpan ke backend."),
        rollbackSnapshot,
      });
    },
    [
      captureGroupRecordsSnapshot,
      clearQuery,
      commitGroupRecords,
      createGroupIdentityMutation,
      navigateToGroupDetail,
      runBackendSync,
      showSyncFeedback,
    ],
  );

  const handleSaveGroupDetail = useCallback(
    (group: GroupData, sourceGroupCode?: string): { ok: true } | { ok: false; message: string } => {
      const normalizedGroup = normalizeGroupStatus(group);
      const normalizedSourceGroupCode = sourceGroupCode?.trim().toUpperCase();
      const normalizedNextGroupCode = normalizedGroup.code.trim().toUpperCase();
      const normalizedNextGroupName = normalizedGroup.name.trim();
      const nextGroup: GroupData = {
        ...normalizedGroup,
        code: normalizedNextGroupCode,
        name: normalizedNextGroupName,
      };
      if (!normalizedNextGroupCode) {
        return {
          ok: false,
          message: "Group number tidak boleh kosong.",
        };
      }

      if (!normalizedNextGroupName) {
        return {
          ok: false,
          message: "Group name tidak boleh kosong.",
        };
      }

      const hasDuplicateCode = groupRecordsRef.current.some(
        (item) =>
          item.code.trim().toUpperCase() === normalizedNextGroupCode &&
          item.code.trim().toUpperCase() !== normalizedSourceGroupCode,
      );
      if (hasDuplicateCode) {
        return {
          ok: false,
          message: "Group number sudah dipakai oleh group lain.",
        };
      }

      const backendTargetGroupCode = normalizedSourceGroupCode ?? normalizedNextGroupCode;
      const rollbackSnapshot = captureGroupRecordsSnapshot();

      navigateToGroupDetail(nextGroup.code, { replace: true });

      commitGroupRecords((current) => {
        const existingIndex = current.findIndex((item) => item.code === nextGroup.code);
        if (existingIndex !== -1) {
          const next = [...current];
          next[existingIndex] = nextGroup;

          if (normalizedSourceGroupCode && normalizedSourceGroupCode !== nextGroup.code) {
            const sourceIndex = next.findIndex(
              (item, index) => index !== existingIndex && item.code.trim().toUpperCase() === normalizedSourceGroupCode,
            );
            if (sourceIndex !== -1) {
              next.splice(sourceIndex, 1);
            }
          }

          return next;
        }

        if (normalizedSourceGroupCode) {
          const sourceIndex = current.findIndex((item) => item.code.trim().toUpperCase() === normalizedSourceGroupCode);
          if (sourceIndex !== -1) {
            const next = [...current];
            next[sourceIndex] = nextGroup;
            return next;
          }
        }

        return [nextGroup, ...current];
      });

      runBackendSync({
        task: replaceGroupMutation.mutateAsync({
          groupCode: backendTargetGroupCode,
          group: nextGroup,
        }),
        successMessage: "Perubahan detail group berhasil disimpan.",
        failureMessage: (error: unknown) =>
          resolveDashboardSyncFailureMessage(error, "Perubahan detail group belum berhasil disimpan ke backend."),
        rollbackSnapshot,
      });
      return { ok: true };
    },
    [captureGroupRecordsSnapshot, commitGroupRecords, navigateToGroupDetail, replaceGroupMutation, runBackendSync],
  );

  const handleSaveVisaGroupDetail = useCallback(
    (group: GroupData, sourceGroupCode?: string): { ok: true } | { ok: false; message: string } => {
      const normalizedGroup = normalizeGroupStatus(group);
      const normalizedSourceGroupCode = sourceGroupCode?.trim().toUpperCase();
      const normalizedNextGroupCode = normalizedGroup.code.trim().toUpperCase();
      const normalizedNextGroupName = normalizedGroup.name.trim();
      const nextGroup: GroupData = {
        ...normalizedGroup,
        code: normalizedNextGroupCode,
        name: normalizedNextGroupName,
      };
      if (!normalizedNextGroupCode) {
        return {
          ok: false,
          message: "Group number tidak boleh kosong.",
        };
      }

      if (!normalizedNextGroupName) {
        return {
          ok: false,
          message: "Group name tidak boleh kosong.",
        };
      }

      const hasDuplicateCode = groupRecordsRef.current.some(
        (item) =>
          item.code.trim().toUpperCase() === normalizedNextGroupCode &&
          item.code.trim().toUpperCase() !== normalizedSourceGroupCode,
      );
      if (hasDuplicateCode) {
        return {
          ok: false,
          message: "Group number sudah dipakai oleh group lain.",
        };
      }

      const backendTargetGroupCode = normalizedSourceGroupCode ?? normalizedNextGroupCode;
      const rollbackSnapshot = captureGroupRecordsSnapshot();

      navigateToVisaDetail(nextGroup.code, { replace: true });

      commitGroupRecords((current) => {
        const existingIndex = current.findIndex((item) => item.code === nextGroup.code);
        if (existingIndex !== -1) {
          const next = [...current];
          next[existingIndex] = nextGroup;

          if (normalizedSourceGroupCode && normalizedSourceGroupCode !== nextGroup.code) {
            const sourceIndex = next.findIndex(
              (item, index) => index !== existingIndex && item.code.trim().toUpperCase() === normalizedSourceGroupCode,
            );
            if (sourceIndex !== -1) {
              next.splice(sourceIndex, 1);
            }
          }

          return next;
        }

        if (normalizedSourceGroupCode) {
          const sourceIndex = current.findIndex((item) => item.code.trim().toUpperCase() === normalizedSourceGroupCode);
          if (sourceIndex !== -1) {
            const next = [...current];
            next[sourceIndex] = nextGroup;
            return next;
          }
        }

        return [nextGroup, ...current];
      });

      runBackendSync({
        task: replaceGroupMutation.mutateAsync({
          groupCode: backendTargetGroupCode,
          group: nextGroup,
        }),
        successMessage: "Perubahan detail group berhasil disimpan.",
        failureMessage: (error: unknown) =>
          resolveDashboardSyncFailureMessage(error, "Perubahan detail group belum berhasil disimpan ke backend."),
        rollbackSnapshot,
      });
      return { ok: true };
    },
    [captureGroupRecordsSnapshot, commitGroupRecords, navigateToVisaDetail, replaceGroupMutation, runBackendSync],
  );

  return {
    groupRecords: visibleGroupRecords,
    isGroupRecordsLoading: isWaitingForDetailedRecords,
    filteredGroups,
    overviewMonthOptions,
    statCards,
    summaryMessage,
    selectedGroup,
    selectedVisaRow,
    handleDeleteGroup,
    handleDeleteVisaGroup,
    handleUpdateAgreementStatus,
    handleUpdateVisaStatus,
    handleUpdateVisaType,
    handleUpdatePaymentStatus,
    handleUpdateSyarikah,
    handleUpdateVisaHotel,
    handleDeleteVisaHotel,
    handleUpdateRaudhahAppointment,
    handleSetRaudhahTasrehPrinted,
    handleClearRaudhahAppointment,
    handleSaveInputGroup,
    handleSaveGroupIdentity,
    handleSaveGroupDetail,
    handleSaveVisaGroupDetail,
  };
}
