import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  buildVisaTrackingRowsFromGroups,
  groups,
  normalizeGroupStatus,
} from "../../shared/app-domain";
import type {
  GroupData,
  NavId,
  GroupVisaSetup,
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
  replaceGroupInBackend,
  replaceGroupItineraryInBackend,
  saveVisaHotelAgreementInBackend,
  updateGroupInBackend,
  type GroupFetchProjection,
  type GroupIdentityDraftPayload,
} from "../use-app-controller-backend";
import type { OverviewMonthOption, OverviewStatCard, SyncFeedback } from "./types";
import {
  collectGroupMonthKeys,
  doesGroupMatchOverviewMonth,
  filterOverviewGroups,
  formatOverviewMonthLabel,
  formatPeakTripDayLabel,
  getCurrentMonthKey,
  getCurrentWeekIsoRange,
  getMillisecondsUntilNextLocalDay,
  isArrivalCategory,
  isIsoDateInRange,
  resolveGroupDetailRecord,
  resolveRequestedGroupProjection,
  routeUsesGroupRecords,
  shouldUseRemoteGroupSearch,
} from "./group-record-selectors";
import { useRaudhahMutations } from "./use-raudhah-mutations";
import { useVisaMutations } from "./use-visa-mutations";
import { useGroupLifecycleMutations } from "./use-group-lifecycle-mutations";

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
  const backendSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const currentDashboardDate = useCurrentDashboardDate();
  const currentOverviewMonthKey = useMemo(() => getCurrentMonthKey(currentDashboardDate), [currentDashboardDate]);
  const shouldFilterOverviewByMonth = activeNav === "overview" && overviewMonthFilter !== "all";
  const shouldUseRemoteSearch = shouldUseRemoteGroupSearch({
    activeNav,
    usesGroupRecords,
    requestedProjection,
  });

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
  const replaceGroupItineraryMutation = useMutation({
    mutationFn: ({ groupCode, group }: { groupCode: string; group: GroupData }) =>
      replaceGroupItineraryInBackend(groupCode, group),
    retry: false,
  });
  const updateGroupMutation = useMutation({
    mutationFn: ({ groupCode, group }: { groupCode: string; group: GroupData }) => updateGroupInBackend(groupCode, group),
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
        queryClient.setQueryData(groupQueryKeys.list("detail", shouldUseRemoteOverviewActiveOnly), next);
        queryClient.setQueryData(groupQueryKeys.list("summary", shouldUseRemoteOverviewActiveOnly), next);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: groupQueryKeys.searchRoot });
    },
    [queryClient, requestedProjection, shouldUseRemoteOverviewActiveOnly],
  );

  useEffect(() => {
    groupRecordsRef.current = groupRecords;
  }, [groupRecords]);

  // Reads the freshest group list straight from the query cache. After an
  // agreement assign/unassign the caller awaits the refetch, which updates the
  // cache synchronously but only reaches `groupRecordsRef` on the next render.
  const getLatestGroups = useCallback((): GroupData[] => {
    const cached = queryClient.getQueryData<GroupData[]>(
      groupQueryKeys.list(requestedProjectionRef.current, shouldUseRemoteOverviewActiveOnlyRef.current),
    );
    return cached ?? groupRecordsRef.current;
  }, [queryClient]);

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
    async (rollbackSnapshot?: GroupRecordsSnapshot) => {
      const projection = requestedProjectionRef.current;
      const activeOnly = shouldUseRemoteOverviewActiveOnlyRef.current;

      try {
        const backendGroups = await fetchGroupsFromBackend({
          projection,
          activeOnly,
        });
        syncGroupRecords(backendGroups, projection, activeOnly);
      } catch (error: unknown) {
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
      task: () => Promise<void>;
      successMessage: string;
      failureMessage: SyncFailureMessage;
      rollbackSnapshot?: GroupRecordsSnapshot;
      showSuccess?: boolean;
    }) => {
      const queuedTask = backendSyncQueueRef.current
        .catch(() => undefined)
        .then(task);
      backendSyncQueueRef.current = queuedTask.then(() => undefined, () => undefined);

      void queuedTask
        .then(() => {
          if (showSuccess) {
            showSyncFeedback("success", successMessage);
          }
        })
        .catch(async (error: unknown) => {
          if (!allowLocalFallback) {
            await syncGroupsFromBackendOrRestore(rollbackSnapshot);
          }

          const resolvedFailureMessage = typeof failureMessage === "function" ? failureMessage(error) : failureMessage;
          showSyncFeedback("error", resolvedFailureMessage);
          if (allowLocalFallback) {
            console.warn(resolvedFailureMessage, error);
          }
        })
        .finally(() => {
          void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all });
          void queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all });
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

    return filterOverviewGroups({
      sourceGroups,
      allGroups: visibleGroupRecords,
      normalizedQuery,
      isActiveOnly,
      shouldFilterByMonth: shouldFilterOverviewByMonth,
      overviewMonthFilter,
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

  const selectedGroup = useMemo(() => {
    if (!selectedGroupCode) {
      return null;
    }

    const selectedRecord =
      visibleGroupRecords.find((group) => group.code.trim().toUpperCase() === selectedGroupCode.trim().toUpperCase()) ??
      null;
    return resolveGroupDetailRecord(selectedRecord, visibleGroupRecords);
  }, [selectedGroupCode, visibleGroupRecords]);

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
        task: () => replaceGroupMutation.mutateAsync({ groupCode, group: nextGroup }),
        successMessage: syncMessages?.successMessage ?? "Perubahan visa berhasil disimpan.",
        failureMessage: syncMessages?.failureMessage ?? "Perubahan visa belum berhasil disimpan ke backend.",
        rollbackSnapshot,
        showSuccess: true,
      });
    },
    [captureGroupRecordsSnapshot, commitGroupRecords, createDefaultVisaSetup, replaceGroupMutation, runBackendSync],
  );


  const {
    handleDeleteVisaGroup,
    handleUpdateAgreementStatus,
    handleUpdateVisaStatus,
    handleUpdateVisaType,
    handleUpdatePaymentStatus,
    handleToggleHotelWaiver,
    handleUpdateSyarikah,
    handleUpdateFlightDetails,
    handleUpdateVisaHotel,
    handleDeleteVisaHotel,
    handleSyncVisaItinerary,
  } = useVisaMutations({
    groupRecordsRef,
    getLatestGroups,
    updateVisaSetupForGroupAndSync,
    createDefaultVisaSetup,
    commitGroupRecords,
    captureGroupRecordsSnapshot,
    runBackendSync,
    showSyncFeedback,
    navigateToVisaTracking,
    saveVisaHotelMutation,
    deleteVisaHotelMutation,
    deleteGroupMutation,
    replaceGroupMutation,
    replaceGroupItineraryMutation,
  });


  const {
    handleUpdateRaudhahAppointment,
    handleSetRaudhahTasrehPrinted,
    handleClearRaudhahAppointment,
  } = useRaudhahMutations(updateVisaSetupForGroupAndSync);

  const {
    handleDeleteGroup,
    handleSaveInputGroup,
    handleSaveGroupIdentity,
    handleSaveGroupDetail,
    handleSaveGroupItinerary,
    handlePatchGroupDetail,
    handleSaveVisaGroupDetail,
  } = useGroupLifecycleMutations({
    groupRecordsRef,
    commitGroupRecords,
    captureGroupRecordsSnapshot,
    runBackendSync,
    showSyncFeedback,
    clearQuery,
    navigateToOverview,
    navigateToGroupDetail,
    navigateToVisaDetail,
    createGroupMutation,
    createGroupIdentityMutation,
    replaceGroupMutation,
    replaceGroupItineraryMutation,
    updateGroupMutation,
    deleteGroupMutation,
  });

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
    handleToggleHotelWaiver,
    handleUpdateSyarikah,
    handleUpdateFlightDetails,
    handleUpdateVisaHotel,
    handleDeleteVisaHotel,
    handleSyncVisaItinerary,
    handleUpdateRaudhahAppointment,
    handleSetRaudhahTasrehPrinted,
    handleClearRaudhahAppointment,
    handleSaveInputGroup,
    handleSaveGroupIdentity,
    handleSaveGroupDetail,
    handleSaveGroupItinerary,
    handlePatchGroupDetail,
    handleSaveVisaGroupDetail,
  };
}
