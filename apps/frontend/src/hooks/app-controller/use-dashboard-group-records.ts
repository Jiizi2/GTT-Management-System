import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  buildVisaTrackingRowsFromGroups,
  formatLocalIsoDate,
  groups,
  normalizeGroupStatus,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  resolveVisaProvider,
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
import { groupQueryKeys } from "../../shared/query-keys";
import { useGroupsQuery, useGroupsSearchQuery } from "../use-groups-query";
import {
  createGroupInBackend,
  deleteGroupInBackend,
  fetchGroupsFromBackend,
  getVisaAgreementValidationError,
  replaceGroupInBackend,
  sortHotelsByStayStart,
  type GroupFetchProjection,
} from "../use-app-controller-backend";
import type { OverviewStatCard, SyncFeedback } from "./types";

type UseDashboardGroupRecordsOptions = {
  activeNav: NavId;
  query: string;
  isActiveOnly: boolean;
  selectedGroupCode: string | null;
  selectedVisaGroupCode: string | null;
  allowLocalFallback: boolean;
  showSyncFeedback: (tone: SyncFeedback["tone"], message: string) => void;
  clearQuery: () => void;
  navigateToOverview: (options?: { replace?: boolean }) => void;
  navigateToGroupDetail: (groupCode: string, options?: { replace?: boolean }) => void;
};

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

export function useDashboardGroupRecords({
  activeNav,
  query,
  isActiveOnly,
  selectedGroupCode,
  selectedVisaGroupCode,
  allowLocalFallback,
  showSyncFeedback,
  clearQuery,
  navigateToOverview,
  navigateToGroupDetail,
}: UseDashboardGroupRecordsOptions) {
  const queryClient = useQueryClient();
  const [groupRecords, setGroupRecords] = useState<GroupData[]>(groups);
  const [groupRecordsProjection, setGroupRecordsProjection] = useState<GroupFetchProjection>("detail");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const groupRecordsRef = useRef(groupRecords);
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
  const shouldUseRemoteSearch = usesGroupRecords && requestedProjection === "summary";

  const groupsQuery = useGroupsQuery(requestedProjection, usesGroupRecords);
  const searchQuery = useGroupsSearchQuery(normalizedQuery, "summary", shouldUseRemoteSearch);
  const createGroupMutation = useMutation({
    mutationFn: (group: GroupData) => createGroupInBackend(group),
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

  const syncGroupRecords = useCallback(
    (nextGroupRecords: GroupData[], projection: GroupFetchProjection) => {
      setGroupRecords(nextGroupRecords);
      setGroupRecordsProjection(projection);
      queryClient.setQueryData(groupQueryKeys.list(projection), nextGroupRecords);
    },
    [queryClient],
  );

  const commitGroupRecords = useCallback(
    (updater: (current: GroupData[]) => GroupData[]) => {
      setGroupRecords((current) => {
        const next = updater(current);
        queryClient.setQueryData(groupQueryKeys.list(requestedProjection), next);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: groupQueryKeys.searchRoot });
    },
    [queryClient, requestedProjection],
  );

  useEffect(() => {
    groupRecordsRef.current = groupRecords;
  }, [groupRecords]);

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

  const syncGroupsFromBackendOrClear = useCallback(async () => {
    try {
      const backendGroups = await fetchGroupsFromBackend({
        projection: requestedProjection,
      });
      syncGroupRecords(backendGroups, requestedProjection);
    } catch (error: unknown) {
      syncGroupRecords([], requestedProjection);
      console.warn("Failed to restore group state from backend.", error);
    }
  }, [requestedProjection, syncGroupRecords]);

  const runBackendSync = useCallback(
    ({
      task,
      successMessage,
      failureMessage,
      showSuccess = true,
    }: {
      task: Promise<void>;
      successMessage: string;
      failureMessage: string;
      showSuccess?: boolean;
    }) => {
      void task
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: groupQueryKeys.all });
          if (showSuccess) {
            showSyncFeedback("success", successMessage);
          }
        })
        .catch((error: unknown) => {
          if (!allowLocalFallback) {
            void syncGroupsFromBackendOrClear();
          }

          showSyncFeedback("error", failureMessage);
          if (allowLocalFallback) {
            console.warn(failureMessage, error);
          }
        });
    },
    [allowLocalFallback, queryClient, showSyncFeedback, syncGroupsFromBackendOrClear],
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

  const filteredGroups = useMemo(() => {
    const sourceGroups = normalizedQuery
      ? (remoteSearchMatches ?? visibleGroupRecords).map((group) => {
          const localVersion = groupRecordsByCode.get(group.code.toUpperCase());
          return localVersion ?? group;
        })
      : visibleGroupRecords;

    return sourceGroups.filter((group) => {
      if (isActiveOnly && group.tone !== "active") {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [group.code, group.name, group.packageName, group.status].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    });
  }, [groupRecordsByCode, isActiveOnly, normalizedQuery, remoteSearchMatches, visibleGroupRecords]);

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

  const { weekStartIso, weekEndIso } = useMemo(() => getCurrentWeekIsoRange(), []);

  const overviewMetrics = useMemo(() => {
    const activeGroups = visibleGroupRecords.filter((group) => group.tone === "active");
    const activePilgrims = activeGroups.reduce((total, group) => total + group.pax, 0);
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
  }, [visibleGroupRecords, weekEndIso, weekStartIso]);

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
    if (normalizedQuery) {
      return `${filteredGroups.length} groups match your search${isActiveOnly ? " (active only)" : ""}. ${overviewMetrics.totalTripsThisWeek} trips are scheduled this week (${weekStartIso} - ${weekEndIso}). ${overviewMetrics.peakTripSummary}`;
    }

    if (isActiveOnly) {
      return `${filteredGroups.length} active groups shown. ${overviewMetrics.totalTripsThisWeek} trips this week (${weekStartIso} - ${weekEndIso}). ${overviewMetrics.peakTripSummary}`;
    }

    return `${overviewMetrics.groupsArrivingThisWeek} groups arriving with ${overviewMetrics.totalTripsThisWeek} total trips this week (${weekStartIso} - ${weekEndIso}). ${overviewMetrics.peakTripSummary}`;
  }, [
    filteredGroups.length,
    isActiveOnly,
    normalizedQuery,
    overviewMetrics.groupsArrivingThisWeek,
    overviewMetrics.peakTripSummary,
    overviewMetrics.totalTripsThisWeek,
    weekEndIso,
    weekStartIso,
  ]);

  const createDefaultVisaSetup = useCallback(
    (group: GroupData, row: VisaTrackingRow): GroupVisaSetup => ({
      visaStatus: row.visaStatus,
      issuedDate: row.issuedDateIso,
      syarikah: resolveVisaProvider(group.packageName),
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

      commitGroupRecords((current) => current.map((group) => (group.code === groupCode ? nextGroup : group)));

      runBackendSync({
        task: replaceGroupMutation.mutateAsync({ groupCode, group: nextGroup }),
        successMessage: syncMessages?.successMessage ?? "Perubahan visa berhasil disimpan.",
        failureMessage:
          syncMessages?.failureMessage ?? "Perubahan visa tersimpan lokal, tapi sinkronisasi backend gagal.",
        showSuccess: true,
      });
    },
    [commitGroupRecords, createDefaultVisaSetup, replaceGroupMutation, runBackendSync],
  );

  const handleDeleteGroup = useCallback(
    (groupCode: string) => {
      const normalizedGroupCode = groupCode.trim().toUpperCase();
      commitGroupRecords((current) =>
        current.filter((group) => group.code.trim().toUpperCase() !== normalizedGroupCode),
      );
      navigateToOverview({ replace: true });

      runBackendSync({
        task: deleteGroupMutation.mutateAsync(groupCode),
        successMessage: "Group berhasil dihapus.",
        failureMessage: "Group terhapus lokal, tapi penghapusan di backend gagal.",
        showSuccess: true,
      });
    },
    [commitGroupRecords, deleteGroupMutation, navigateToOverview, runBackendSync],
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
      updateVisaSetupForGroupAndSync(groupCode, ({ group, visaSetup }) => ({
        ...visaSetup,
        syarikah: syarikah.trim() || resolveVisaProvider(group.packageName),
      }));
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleUpdateVisaHotel = useCallback(
    (groupCode: string, city: "makkah" | "madinah", hotel: VisaHotelEditFormState, hotelId?: string) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ group, row, visaSetup }) => {
        const cityKey = city === "makkah" ? "makkahHotels" : "madinahHotels";
        const currentCityHotels = visaSetup[cityKey];
        const agreementDateRange = resolveVisaAgreementDateRange(row, group.durationDays, group);
        const parsedHotelPax = Number.parseInt(hotel.pax, 10);
        const existingHotel = hotelId ? currentCityHotels.find((entry) => entry.id === hotelId) : undefined;
        const fallbackEditableHotel: GroupAgreementHotel = {
          id: existingHotel?.id ?? `${group.code}-${city}-${Date.now().toString(36)}`,
          hotelName: city === "makkah" ? "Makkah Hotel" : "Madinah Hotel",
          agreementNumber: resolveVisaAgreementNumber(row, group, city),
          pax: group.pax,
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
          return visaSetup;
        }

        return nextVisaSetup;
      });
    },
    [showSyncFeedback, updateVisaSetupForGroupAndSync],
  );

  const handleDeleteVisaHotel = useCallback(
    (groupCode: string, city: "makkah" | "madinah", hotelId: string) => {
      updateVisaSetupForGroupAndSync(
        groupCode,
        ({ visaSetup }) => {
          const cityKey = city === "makkah" ? "makkahHotels" : "madinahHotels";
          const currentCityHotels = visaSetup[cityKey];
          const nextCityHotels = currentCityHotels.filter((entry) => entry.id !== hotelId);

          if (nextCityHotels.length === currentCityHotels.length) {
            return visaSetup;
          }

          const nextVisaSetup: GroupVisaSetup = {
            ...visaSetup,
            [cityKey]: sortHotelsByStayStart(nextCityHotels),
          };
          const validationError = getVisaAgreementValidationError(nextVisaSetup);
          if (validationError) {
            showSyncFeedback("error", validationError);
            return visaSetup;
          }

          return nextVisaSetup;
        },
        {
          successMessage: "Agreement hotel berhasil dihapus.",
          failureMessage: "Agreement hotel terhapus lokal, tapi sinkronisasi backend gagal.",
        },
      );
    },
    [showSyncFeedback, updateVisaSetupForGroupAndSync],
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
          failureMessage: "Status print tasreh Raudhah tersimpan lokal, tapi sinkronisasi backend gagal.",
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

      commitGroupRecords((current) => [normalizedGroup, ...current]);
      clearQuery();
      navigateToOverview({ replace: true });

      runBackendSync({
        task: createGroupMutation.mutateAsync(normalizedGroup),
        successMessage: "Group baru berhasil disimpan.",
        failureMessage: "Group tersimpan lokal, tapi sinkronisasi backend gagal.",
      });
    },
    [clearQuery, commitGroupRecords, createGroupMutation, navigateToOverview, runBackendSync, showSyncFeedback],
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
        failureMessage: "Perubahan detail group tersimpan lokal, tapi sinkronisasi backend gagal.",
      });
      return { ok: true };
    },
    [commitGroupRecords, navigateToGroupDetail, replaceGroupMutation, runBackendSync],
  );

  return {
    groupRecords: visibleGroupRecords,
    isGroupRecordsLoading: isWaitingForDetailedRecords,
    filteredGroups,
    statCards,
    summaryMessage,
    selectedGroup,
    selectedVisaRow,
    handleDeleteGroup,
    handleUpdateAgreementStatus,
    handleUpdateVisaStatus,
    handleUpdatePaymentStatus,
    handleUpdateSyarikah,
    handleUpdateVisaHotel,
    handleDeleteVisaHotel,
    handleUpdateRaudhahAppointment,
    handleSetRaudhahTasrehPrinted,
    handleClearRaudhahAppointment,
    handleSaveInputGroup,
    handleSaveGroupDetail,
  };
}
