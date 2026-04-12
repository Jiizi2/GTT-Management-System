import { useEffect, useState } from "react";
import { formatLocalIsoDate } from "../shared/app-domain";
import type { GroupData, SessionAccessTier, VisaTrackingRow } from "../shared/app-domain";
import type { AppController } from "./app-controller/types";
import { useDashboardGroupRecords } from "./app-controller/use-dashboard-group-records";
import { useDashboardRouteState } from "./app-controller/use-dashboard-route-state";
import { useDashboardSyncFeedback } from "./app-controller/use-dashboard-sync-feedback";

export type { AppController, OverviewStatCard, SyncFeedback } from "./app-controller/types";

function getCurrentMonthKey(referenceDate = new Date()): string {
  return formatLocalIsoDate(referenceDate).slice(0, 7);
}

function resolveDocumentTitle({
  activeNav,
  selectedGroup,
  selectedVisaRow,
}: {
  activeNav: AppController["activeNav"];
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

function isLocalDevelopmentHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const hostname = window.location.hostname.trim().toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1";
}

export function useAppController(sessionAccessTier: SessionAccessTier): AppController {
  const [query, setQuery] = useState("");
  const [isActiveOnly, setIsActiveOnly] = useState(true);
  const [overviewMonthFilter, setOverviewMonthFilter] = useState(() => getCurrentMonthKey());
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const allowLocalFallback = isLocalDevelopmentHost();

  const { syncFeedback, showSyncFeedback, dismissSyncFeedback } = useDashboardSyncFeedback();
  const routeState = useDashboardRouteState(sessionAccessTier);
  const groupRecordsState = useDashboardGroupRecords({
    activeNav: routeState.activeNav,
    query,
    isActiveOnly,
    overviewMonthFilter,
    selectedGroupCode: routeState.selectedGroupCode,
    selectedVisaGroupCode: routeState.selectedVisaGroupCode,
    allowLocalFallback,
    showSyncFeedback,
    clearQuery: () => setQuery(""),
    navigateToOverview: routeState.navigateToOverview,
    navigateToGroupDetail: routeState.navigateToGroupDetail,
  });

  useEffect(() => {
    document.title = resolveDocumentTitle({
      activeNav: routeState.activeNav,
      selectedGroup: groupRecordsState.selectedGroup,
      selectedVisaRow: groupRecordsState.selectedVisaRow,
    });
  }, [groupRecordsState.selectedGroup, groupRecordsState.selectedVisaRow, routeState.activeNav]);

  return {
    groupRecords: groupRecordsState.groupRecords,
    isGroupRecordsLoading: groupRecordsState.isGroupRecordsLoading,
    sessionAccessTier,
    activeNav: routeState.activeNav,
    query,
    isActiveOnly,
    overviewMonthFilter,
    overviewMonthOptions: groupRecordsState.overviewMonthOptions,
    selectedGroupCode: routeState.selectedGroupCode,
    selectedGroup: groupRecordsState.selectedGroup,
    selectedVisaGroupCode: routeState.selectedVisaGroupCode,
    selectedVisaRow: groupRecordsState.selectedVisaRow,
    isSidebarCollapsed,
    filteredGroups: groupRecordsState.filteredGroups,
    statCards: groupRecordsState.statCards,
    summaryMessage: groupRecordsState.summaryMessage,
    syncFeedback,
    handleNavigate: routeState.handleNavigate,
    handleOpenDetail: routeState.handleOpenDetail,
    handleBackToOverview: routeState.handleBackToOverview,
    handleDeleteGroup: groupRecordsState.handleDeleteGroup,
    handleOpenVisaDetail: routeState.handleOpenVisaDetail,
    handleUpdateAgreementStatus: groupRecordsState.handleUpdateAgreementStatus,
    handleUpdateVisaStatus: groupRecordsState.handleUpdateVisaStatus,
    handleUpdatePaymentStatus: groupRecordsState.handleUpdatePaymentStatus,
    handleUpdateSyarikah: groupRecordsState.handleUpdateSyarikah,
    handleUpdateVisaHotel: groupRecordsState.handleUpdateVisaHotel,
    handleDeleteVisaHotel: groupRecordsState.handleDeleteVisaHotel,
    handleUpdateRaudhahAppointment: groupRecordsState.handleUpdateRaudhahAppointment,
    handleSetRaudhahTasrehPrinted: groupRecordsState.handleSetRaudhahTasrehPrinted,
    handleClearRaudhahAppointment: groupRecordsState.handleClearRaudhahAppointment,
    handleBackToVisaTracking: routeState.handleBackToVisaTracking,
    handleOpenNewGroup: routeState.handleOpenNewGroup,
    handleSaveInputGroup: groupRecordsState.handleSaveInputGroup,
    handleSaveGroupDetail: groupRecordsState.handleSaveGroupDetail,
    dismissSyncFeedback,
    handleQueryChange: setQuery,
    handleToggleActiveOnly: setIsActiveOnly,
    handleOverviewMonthFilterChange: setOverviewMonthFilter,
    toggleSidebarCollapse: () => setIsSidebarCollapsed((current) => !current),
  };
}
