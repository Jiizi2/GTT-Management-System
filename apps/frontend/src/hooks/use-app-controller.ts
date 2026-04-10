import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  buildVisaTrackingRowsFromGroups,
  formatLocalIsoDate,
  groups,
  normalizeGroupStatus,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  resolveVisaProvider,
  scrollToTop,
} from "../shared/app-domain";
import type {
  AgreementApprovalStatus,
  GroupAgreementHotel,
  GroupData,
  GroupRaudhahAppointment,
  GroupVisaSetup,
  NavId,
  SessionAccessTier,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaRaudhahEditFormState,
  VisaStatus,
  VisaTrackingRow,
} from "../shared/app-domain";
import {
  createGroupInBackend,
  deleteGroupInBackend,
  fetchGroupsFromBackend,
  getVisaAgreementValidationError,
  replaceGroupInBackend,
  sortHotelsByStayStart,
} from "./use-app-controller-backend";
import {
  buildDashboardPath,
  buildGroupDetailPath,
  buildVisaDetailPath,
  resolveDashboardRouteFromPathname,
} from "../shared/app-route";

export type OverviewStatCard = {
  label: string;
  value: string;
  subtitle?: string;
  icon: string;
  tone: "primary" | "secondary" | "tertiary";
};

export type SyncFeedback = {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
};

export type AppController = {
  groupRecords: GroupData[];
  sessionAccessTier: SessionAccessTier;
  activeNav: NavId;
  query: string;
  isActiveOnly: boolean;
  selectedGroupCode: string | null;
  selectedGroup: GroupData | null;
  selectedVisaGroupCode: string | null;
  selectedVisaRow: VisaTrackingRow | null;
  isSidebarCollapsed: boolean;
  filteredGroups: GroupData[];
  statCards: OverviewStatCard[];
  summaryMessage: string;
  syncFeedback: SyncFeedback | null;
  handleNavigate: (navId: NavId) => void;
  handleOpenDetail: (groupCode: string) => void;
  handleBackToOverview: () => void;
  handleDeleteGroup: (groupCode: string) => void;
  handleOpenVisaDetail: (row: VisaTrackingRow) => void;
  handleUpdateAgreementStatus: (
    groupCode: string,
    city: "makkah" | "madinah",
    status: AgreementApprovalStatus,
  ) => void;
  handleUpdateVisaStatus: (groupCode: string, visaStatus: VisaStatus) => void;
  handleUpdatePaymentStatus: (groupCode: string, paymentStatus: VisaPaymentStatus) => void;
  handleUpdateSyarikah: (groupCode: string, syarikah: string) => void;
  handleUpdateVisaHotel: (
    groupCode: string,
    city: "makkah" | "madinah",
    hotel: VisaHotelEditFormState,
    hotelId?: string,
  ) => void;
  handleDeleteVisaHotel: (
    groupCode: string,
    city: "makkah" | "madinah",
    hotelId: string,
  ) => void;
  handleUpdateRaudhahAppointment: (
    groupCode: string,
    appointment: VisaRaudhahEditFormState,
  ) => void;
  handleSetRaudhahTasrehPrinted: (
    groupCode: string,
    appointmentId: string,
    tasrehPrinted: boolean,
  ) => void;
  handleClearRaudhahAppointment: (groupCode: string) => void;
  handleBackToVisaTracking: () => void;
  handleOpenNewGroup: () => void;
  handleSaveInputGroup: (group: GroupData) => void;
  handleSaveGroupDetail: (
    group: GroupData,
    sourceGroupCode?: string,
  ) => { ok: true } | { ok: false; message: string };
  dismissSyncFeedback: () => void;
  handleQueryChange: (value: string) => void;
  handleToggleActiveOnly: (value: boolean) => void;
  toggleSidebarCollapse: () => void;
};

function resolveDocumentTitle({
  activeNav,
  selectedGroup,
  selectedVisaRow,
}: {
  activeNav: NavId;
  selectedGroup: GroupData | null;
  selectedVisaRow: VisaTrackingRow | null;
}): string {
  if (selectedGroup) {
    return `${selectedGroup.code} | Group Detail`;
  }

  if (selectedVisaRow) {
    return `${selectedVisaRow.groupCode} | Visa Detail`;
  }

  if (activeNav === "checklist") {
    return "GTT | H-1 Checklist";
  }

  if (activeNav === "visa") {
    return "GTT | Visa Tracking";
  }

  if (activeNav === "new-group" || activeNav === "input") {
    return "GTT | Add New Group";
  }

  if (activeNav === "invoice") {
    return "GTT | Invoice List";
  }

  if (activeNav === "raudhah-reminder") {
    return "GTT | Raudhah Reminder";
  }

  if (activeNav === "user-management") {
    return "GTT | User Management";
  }

  if (activeNav === "master-data") {
    return "GTT | Master Data";
  }

  if (activeNav === "profile") {
    return "GTT | Operator Profile";
  }

  return "GTT | Itinerary Overview";
}

const SESSION_ACCESS_TIER_STORAGE_KEY = "gtt-session-access-tier-v1";

const loadPersistedSessionAccessTier = (): SessionAccessTier => {
  if (typeof window === "undefined") {
    return "super-admin";
  }

  try {
    const persistedAccessTier = window.localStorage
      .getItem(SESSION_ACCESS_TIER_STORAGE_KEY)
      ?.trim()
      .toLowerCase();
    return persistedAccessTier === "admin" || persistedAccessTier === "super-admin"
      ? persistedAccessTier
      : "super-admin";
  } catch {
    return "super-admin";
  }
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

function isIsoDateInRange(
  isoDate: string | undefined,
  startIso: string,
  endIso: string,
): boolean {
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

function isLocalDevelopmentHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname.trim().toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function useAppController(): AppController {
  const [groupRecords, setGroupRecords] = useState<GroupData[]>(groups);
  const [sessionAccessTier] = useState<SessionAccessTier>(() => loadPersistedSessionAccessTier());
  const initialDashboardRouteRef = useRef(
    typeof window === "undefined"
      ? resolveDashboardRouteFromPathname("/overview")
      : resolveDashboardRouteFromPathname(window.location.pathname),
  );
  const [activeNav, setActiveNav] = useState<NavId>(initialDashboardRouteRef.current.activeNav);
  const [query, setQuery] = useState("");
  const [isActiveOnly, setIsActiveOnly] = useState(false);
  const [selectedGroupCode, setSelectedGroupCode] = useState<string | null>(
    initialDashboardRouteRef.current.selectedGroupCode,
  );
  const [selectedVisaGroupCode, setSelectedVisaGroupCode] = useState<string | null>(
    initialDashboardRouteRef.current.selectedVisaGroupCode,
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<SyncFeedback | null>(null);
  const [remoteSearchMatches, setRemoteSearchMatches] = useState<GroupData[] | null>(null);
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const groupRecordsRef = useRef(groupRecords);
  const allowLocalFallback = isLocalDevelopmentHost();
  const visaTrackingRows = useMemo(() => buildVisaTrackingRowsFromGroups(groupRecords), [groupRecords]);
  const selectedVisaRow = useMemo(() => {
    if (!selectedVisaGroupCode) {
      return null;
    }

    const normalizedSelectedVisaGroupCode = selectedVisaGroupCode.trim().toUpperCase();
    return (
      visaTrackingRows.find((row) => row.groupCode.trim().toUpperCase() === normalizedSelectedVisaGroupCode) ??
      null
    );
  }, [selectedVisaGroupCode, visaTrackingRows]);

  useEffect(() => {
    groupRecordsRef.current = groupRecords;
  }, [groupRecords]);

  const showSyncFeedback = (
    tone: SyncFeedback["tone"],
    message: string,
  ) => {
    setSyncFeedback({
      id: Date.now(),
      tone,
      message,
    });
  };

  const syncGroupsFromBackendOrClear = () => {
    void fetchGroupsFromBackend()
      .then((backendGroups) => {
        setGroupRecords(backendGroups);
      })
      .catch((error: unknown) => {
        setGroupRecords([]);
        setRemoteSearchMatches(null);
        setSelectedGroupCode(null);
        setSelectedVisaGroupCode(null);
        console.warn("Failed to restore group state from backend.", error);
      });
  };

  const runBackendSync = ({
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
        if (showSuccess) {
          showSyncFeedback("success", successMessage);
        }
      })
      .catch((error: unknown) => {
        if (!allowLocalFallback) {
          syncGroupsFromBackendOrClear();
        }

        showSyncFeedback("error", failureMessage);
        if (allowLocalFallback) {
          console.warn(failureMessage, error);
        }
      });
  };

  useEffect(() => {
    if (!syncFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSyncFeedback((current) => (current?.id === syncFeedback.id ? null : current));
    }, 3200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [syncFeedback]);

  useEffect(() => {
    const controller = new AbortController();

    void fetchGroupsFromBackend({ signal: controller.signal })
      .then((backendGroups) => {
        setGroupRecords(backendGroups);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        if (allowLocalFallback) {
          showSyncFeedback(
            "info",
            "Mode lokal aktif. Backend belum terhubung, data disimpan sementara di browser.",
          );
          console.warn("Backend group fetch skipped. App will continue with local state.", error);
          return;
        }

        setGroupRecords([]);
        setRemoteSearchMatches(null);
        setSelectedGroupCode(null);
        setSelectedVisaGroupCode(null);
        showSyncFeedback(
          "error",
          "Backend tidak terhubung. Data tidak bisa dimuat dari database.",
        );
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!normalizedQuery) {
      setRemoteSearchMatches(null);
      return undefined;
    }

    const controller = new AbortController();
    void fetchGroupsFromBackend({
      signal: controller.signal,
      query: normalizedQuery,
    })
      .then((matchedGroups) => {
        setRemoteSearchMatches(matchedGroups);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setRemoteSearchMatches(null);
        if (allowLocalFallback) {
          console.warn(
            "Backend search skipped. Using local search filter as fallback.",
            error,
          );
        }
      });

    return () => {
      controller.abort();
    };
  }, [allowLocalFallback, normalizedQuery]);

  const groupRecordsByCode = useMemo(
    () =>
      new Map(
        groupRecords.map((group) => [
          group.code.toUpperCase(),
          group,
        ]),
      ),
    [groupRecords],
  );

  const filteredGroups = useMemo(
    () => {
      const sourceGroups = normalizedQuery
        ? (remoteSearchMatches ?? groupRecords).map((group) => {
            const localVersion = groupRecordsByCode.get(group.code.toUpperCase());
            return localVersion ?? group;
          })
        : groupRecords;

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
    },
    [groupRecords, groupRecordsByCode, remoteSearchMatches, isActiveOnly, normalizedQuery],
  );

  const { weekStartIso, weekEndIso } = useMemo(() => getCurrentWeekIsoRange(), []);

  const overviewMetrics = useMemo(
    () => {
      const activeGroups = groupRecords.filter((group) => group.tone === "active");
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
          tripCountByIsoDate.set(
            itineraryIsoDate,
            (tripCountByIsoDate.get(itineraryIsoDate) ?? 0) + 1,
          );
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
          (tripCount === peakTripCount &&
            peakTripDateIso.length > 0 &&
            tripDateIso.localeCompare(peakTripDateIso) < 0)
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
    },
    [groupRecords, weekEndIso, weekStartIso],
  );

  const selectedGroup = useMemo(
    () =>
      selectedGroupCode
        ? groupRecords.find(
            (group) => group.code.trim().toUpperCase() === selectedGroupCode.trim().toUpperCase(),
          ) ?? null
        : null,
    [groupRecords, selectedGroupCode],
  );

  const createDefaultVisaSetup = (
    group: GroupData,
    row: VisaTrackingRow,
  ): GroupVisaSetup => ({
    visaStatus: row.visaStatus,
    issuedDate: row.issuedDateIso,
    syarikah: resolveVisaProvider(group.packageName),
    busStatus: undefined,
    paymentStatus: row.paymentStatus,
    makkahHotels: [],
    madinahHotels: [],
    raudhahAppointments: [],
  });

  const updateVisaSetupForGroupAndSync = (
    groupCode: string,
    updater: (args: {
      group: GroupData;
      row: VisaTrackingRow;
      visaSetup: GroupVisaSetup;
    }) => GroupVisaSetup,
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

    const currentRow = buildVisaTrackingRowsFromGroups(latestGroupRecords).find(
      (row) => row.groupCode === groupCode,
    );
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

    setGroupRecords((current) =>
      current.map((group) => (group.code === groupCode ? nextGroup : group)),
    );

    runBackendSync({
      task: replaceGroupInBackend(groupCode, nextGroup),
      successMessage: syncMessages?.successMessage ?? "Perubahan visa berhasil disimpan.",
      failureMessage:
        syncMessages?.failureMessage ??
        "Perubahan visa tersimpan lokal, tapi sinkronisasi backend gagal.",
      showSuccess: true,
    });
  };

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
        subtitle:
          overviewMetrics.peakTripCount > 0
            ? `${overviewMetrics.peakTripCount} trips`
            : "No trips this week",
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
    overviewMetrics.peakTripCount,
    overviewMetrics.peakTripSummary,
    overviewMetrics.totalTripsThisWeek,
    weekEndIso,
    weekStartIso,
  ]);

  useEffect(() => {
    document.title = resolveDocumentTitle({
      activeNav,
      selectedGroup,
      selectedVisaRow,
    });
  }, [activeNav, selectedGroup, selectedVisaRow]);

  useEffect(() => {
    if (activeNav !== "user-management" && activeNav !== "master-data") {
      return;
    }

    if (sessionAccessTier !== "super-admin") {
      setActiveNav("overview");
      setSelectedGroupCode(null);
      setSelectedVisaGroupCode(null);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", buildDashboardPath("overview"));
      }
      scrollToTop();
    }
  }, [activeNav, sessionAccessTier]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const canonicalPath = initialDashboardRouteRef.current.canonicalPath;
    if (window.location.pathname.replace(/\/+$/, "") !== canonicalPath) {
      window.history.replaceState(null, "", canonicalPath);
    }

    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handlePopState = () => {
      const nextRoute = resolveDashboardRouteFromPathname(window.location.pathname);
      setActiveNav(nextRoute.activeNav);
      setSelectedGroupCode(nextRoute.selectedGroupCode);
      setSelectedVisaGroupCode(nextRoute.selectedVisaGroupCode);
      scrollToTop();
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const updateBrowserPath = (pathname: string, { replace = false }: { replace?: boolean } = {}) => {
    if (typeof window === "undefined") {
      return;
    }

    const normalizedPathname = pathname.trim() || "/";
    const normalizedCurrentPath = window.location.pathname.replace(/\/+$/, "") || "/";
    const normalizedNextPath = normalizedPathname.replace(/\/+$/, "") || "/";
    if (normalizedCurrentPath === normalizedNextPath) {
      return;
    }

    if (replace) {
      window.history.replaceState(null, "", normalizedNextPath);
      return;
    }

    window.history.pushState(null, "", normalizedNextPath);
  };

  const handleNavigate = (navId: NavId) => {
    const normalizedNavId = navId === "input" ? "new-group" : navId;
    if (normalizedNavId === "user-management" || normalizedNavId === "master-data") {
      if (sessionAccessTier !== "super-admin") {
        return;
      }
    }

    setActiveNav(normalizedNavId);
    setSelectedGroupCode(null);
    setSelectedVisaGroupCode(null);
    updateBrowserPath(buildDashboardPath(normalizedNavId));
    scrollToTop();
  };

  const handleOpenDetail = (groupCode: string) => {
    const normalizedGroupCode = groupCode.trim();
    setActiveNav("overview");
    setSelectedGroupCode(normalizedGroupCode);
    setSelectedVisaGroupCode(null);
    updateBrowserPath(buildGroupDetailPath(normalizedGroupCode));
    scrollToTop();
  };

  const handleBackToOverview = () => {
    setActiveNav("overview");
    setSelectedGroupCode(null);
    setSelectedVisaGroupCode(null);
    updateBrowserPath(buildDashboardPath("overview"), { replace: true });
    scrollToTop();
  };

  const handleDeleteGroup = (groupCode: string) => {
    const normalizedGroupCode = groupCode.trim().toUpperCase();
    setGroupRecords((current) =>
      current.filter((group) => group.code.trim().toUpperCase() !== normalizedGroupCode),
    );
    setSelectedGroupCode((current) =>
      current?.trim().toUpperCase() === normalizedGroupCode ? null : current,
    );
    setSelectedVisaGroupCode((current) =>
      current?.trim().toUpperCase() === normalizedGroupCode ? null : current,
    );
    setActiveNav("overview");
    updateBrowserPath(buildDashboardPath("overview"), { replace: true });
    scrollToTop();

    runBackendSync({
      task: deleteGroupInBackend(groupCode),
      successMessage: "Group berhasil dihapus.",
      failureMessage: "Group terhapus lokal, tapi penghapusan di backend gagal.",
      showSuccess: true,
    });
  };

  const handleOpenVisaDetail = (row: VisaTrackingRow) => {
    const normalizedGroupCode = row.groupCode.trim();
    setActiveNav("visa");
    setSelectedGroupCode(null);
    setSelectedVisaGroupCode(normalizedGroupCode);
    updateBrowserPath(buildVisaDetailPath(normalizedGroupCode));
    scrollToTop();
  };

  const handleUpdateAgreementStatus = (
    groupCode: string,
    city: "makkah" | "madinah",
    status: AgreementApprovalStatus,
  ) => {
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
                  city === "makkah"
                    ? agreementDateRange.makkahStartIso
                    : agreementDateRange.madinahStartIso,
                stayEndIso:
                  city === "makkah"
                    ? agreementDateRange.makkahEndIso
                    : agreementDateRange.madinahEndIso,
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
  };

  const handleUpdateVisaStatus = (groupCode: string, visaStatus: VisaStatus) => {
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
  };

  const handleUpdatePaymentStatus = (groupCode: string, paymentStatus: VisaPaymentStatus) => {
    updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => ({
      ...visaSetup,
      paymentStatus,
    }));
  };

  const handleUpdateSyarikah = (groupCode: string, syarikah: string) => {
    updateVisaSetupForGroupAndSync(groupCode, ({ group, visaSetup }) => ({
      ...visaSetup,
      syarikah: syarikah.trim() || resolveVisaProvider(group.packageName),
    }));
  };

  const handleUpdateVisaHotel = (
    groupCode: string,
    city: "makkah" | "madinah",
    hotel: VisaHotelEditFormState,
    hotelId?: string,
  ) => {
    updateVisaSetupForGroupAndSync(groupCode, ({ group, row, visaSetup }) => {
      const cityKey = city === "makkah" ? "makkahHotels" : "madinahHotels";
      const currentCityHotels = visaSetup[cityKey];
      const agreementDateRange = resolveVisaAgreementDateRange(row, group.durationDays, group);
      const parsedHotelPax = Number.parseInt(hotel.pax, 10);
      const existingHotel = hotelId
        ? currentCityHotels.find((entry) => entry.id === hotelId)
        : undefined;
      const fallbackEditableHotel: GroupAgreementHotel = {
        id: existingHotel?.id ?? `${group.code}-${city}-${Date.now().toString(36)}`,
        hotelName: city === "makkah" ? "Makkah Hotel" : "Madinah Hotel",
        agreementNumber: resolveVisaAgreementNumber(row, group, city),
        pax: group.pax,
        status: "Waiting for Approval",
        stayStartIso:
          city === "makkah" ? agreementDateRange.makkahStartIso : agreementDateRange.madinahStartIso,
        stayEndIso:
          city === "makkah" ? agreementDateRange.makkahEndIso : agreementDateRange.madinahEndIso,
      };

      const nextPrimaryHotel: GroupAgreementHotel = {
        ...fallbackEditableHotel,
        ...(existingHotel ?? {}),
        hotelName: hotel.hotelName.trim() || fallbackEditableHotel.hotelName,
        agreementNumber: hotel.agreementNumber.trim() || fallbackEditableHotel.agreementNumber,
        pax:
          Number.isFinite(parsedHotelPax) && parsedHotelPax >= 0
            ? parsedHotelPax
            : fallbackEditableHotel.pax,
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
  };

  const handleDeleteVisaHotel = (
    groupCode: string,
    city: "makkah" | "madinah",
    hotelId: string,
  ) => {
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
        failureMessage:
          "Agreement hotel terhapus lokal, tapi sinkronisasi backend gagal.",
      },
    );
  };

  const handleUpdateRaudhahAppointment = (
    groupCode: string,
    appointment: VisaRaudhahEditFormState,
  ) => {
    updateVisaSetupForGroupAndSync(groupCode, ({ group, visaSetup }) => {
      const nextAppointments: GroupRaudhahAppointment[] = appointment.appointments
        .map((entry, index) => ({
          id:
            entry.id?.trim() ||
            `${group.code}-raudhah-${Date.now().toString(36)}-${index + 1}`,
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
  };

  const handleSetRaudhahTasrehPrinted = (
    groupCode: string,
    appointmentId: string,
    tasrehPrinted: boolean,
  ) => {
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

        const hasChanged = nextAppointments.some(
          (entry, index) => entry !== visaSetup.raudhahAppointments[index],
        );
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
        failureMessage:
          "Status print tasreh Raudhah tersimpan lokal, tapi sinkronisasi backend gagal.",
      },
    );
  };

  const handleClearRaudhahAppointment = (groupCode: string) => {
    updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => {
      return {
        ...visaSetup,
        raudhahAppointments: [],
      };
    });
  };

  const handleBackToVisaTracking = () => {
    setActiveNav("visa");
    setSelectedVisaGroupCode(null);
    updateBrowserPath(buildDashboardPath("visa"), { replace: true });
    scrollToTop();
  };

  const handleOpenNewGroup = () => {
    setActiveNav("new-group");
    setSelectedGroupCode(null);
    setSelectedVisaGroupCode(null);
    updateBrowserPath(buildDashboardPath("new-group"));
    scrollToTop();
  };

  const handleSaveInputGroup = (group: GroupData) => {
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

    setGroupRecords((current) => {
      return [normalizedGroup, ...current];
    });

    setQuery("");
    setSelectedGroupCode(null);
    setSelectedVisaGroupCode(null);
    setActiveNav("overview");
    updateBrowserPath(buildDashboardPath("overview"), { replace: true });
    scrollToTop();

    runBackendSync({
      task: createGroupInBackend(normalizedGroup),
      successMessage: "Group baru berhasil disimpan.",
      failureMessage: "Group tersimpan lokal, tapi sinkronisasi backend gagal.",
    });
  };

  const handleSaveGroupDetail = (
    group: GroupData,
    sourceGroupCode?: string,
  ): { ok: true } | { ok: false; message: string } => {
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

    const hasDuplicateCode = groupRecords.some(
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

    updateBrowserPath(buildGroupDetailPath(nextGroup.code), { replace: true });

    setSelectedGroupCode(nextGroup.code);
    setSelectedVisaGroupCode(null);

    setGroupRecords((current) => {
      const existingIndex = current.findIndex((item) => item.code === nextGroup.code);
      if (existingIndex !== -1) {
        const next = [...current];
        next[existingIndex] = nextGroup;

        if (normalizedSourceGroupCode && normalizedSourceGroupCode !== nextGroup.code) {
          const sourceIndex = next.findIndex(
            (item, index) =>
              index !== existingIndex &&
              item.code.trim().toUpperCase() === normalizedSourceGroupCode,
          );
          if (sourceIndex !== -1) {
            next.splice(sourceIndex, 1);
          }
        }

        return next;
      }

      if (normalizedSourceGroupCode) {
        const sourceIndex = current.findIndex(
          (item) => item.code.trim().toUpperCase() === normalizedSourceGroupCode,
        );
        if (sourceIndex !== -1) {
          const next = [...current];
          next[sourceIndex] = nextGroup;
          return next;
        }
      }

      return [nextGroup, ...current];
    });

    runBackendSync({
      task: replaceGroupInBackend(backendTargetGroupCode, nextGroup),
      successMessage: "Perubahan detail group berhasil disimpan.",
      failureMessage: "Perubahan detail group tersimpan lokal, tapi sinkronisasi backend gagal.",
    });
    return { ok: true };
  };

  return {
    groupRecords,
    sessionAccessTier,
    activeNav,
    query,
    isActiveOnly,
    selectedGroupCode,
    selectedGroup,
    selectedVisaGroupCode,
    selectedVisaRow,
    isSidebarCollapsed,
    filteredGroups,
    statCards,
    summaryMessage,
    syncFeedback,
    handleNavigate,
    handleOpenDetail,
    handleBackToOverview,
    handleDeleteGroup,
    handleOpenVisaDetail,
    handleUpdateAgreementStatus,
    handleUpdateVisaStatus,
    handleUpdatePaymentStatus,
    handleUpdateSyarikah,
    handleUpdateVisaHotel,
    handleDeleteVisaHotel,
    handleUpdateRaudhahAppointment,
    handleSetRaudhahTasrehPrinted,
    handleClearRaudhahAppointment,
    handleBackToVisaTracking,
    handleOpenNewGroup,
    handleSaveInputGroup,
    handleSaveGroupDetail,
    dismissSyncFeedback: () => setSyncFeedback(null),
    handleQueryChange: setQuery,
    handleToggleActiveOnly: setIsActiveOnly,
    toggleSidebarCollapse: () => setIsSidebarCollapsed((current) => !current),
  };
}
