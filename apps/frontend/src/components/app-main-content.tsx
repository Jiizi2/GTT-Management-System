import { Suspense, lazy, useMemo } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { buildVisaTrackingRowsFromGroups } from "../shared/app-domain";
import { buildDashboardPath } from "../shared/app-route";
import type { AppController } from "../hooks/use-app-controller";
import { DetailDataState } from "./detail-data-state";
import { PageSkeleton } from "./skeleton";

const LazyAddGroupWorkspaceScreen = lazy(async () => ({
  default: (await import("../pages/new-group-screen")).AddGroupWorkspaceScreen,
}));
const LazyChecklistScreen = lazy(async () => ({
  default: (await import("../pages/checklist-page")).ChecklistScreen,
}));
const LazyAgreementInboxScreen = lazy(async () => ({
  default: (await import("../pages/agreement-inbox-page")).AgreementInboxScreen,
}));
const LazyInvoiceScreen = lazy(async () => ({
  default: (await import("../pages/invoice-list-page")).InvoiceScreen,
}));
const LazyGroupDetail = lazy(async () => ({
  default: (await import("../pages/group-detail-page")).GroupDetail,
}));
const LazyGroupItineraryBuilderPage = lazy(async () => ({
  default: (await import("../pages/group-itinerary-builder-page")).GroupItineraryBuilderPage,
}));
const LazyOverviewScreen = lazy(async () => ({
  default: (await import("../pages/overview-page")).OverviewScreen,
}));
const LazyStatisticsScreen = lazy(async () => ({
  default: (await import("../pages/statistics/statistics-page")).StatisticsScreen,
}));
const LazyUserManagementScreen = lazy(async () => ({
  default: (await import("../pages/manage-role-page")).UserManagementScreen,
}));
const LazyPlaceholderScreen = lazy(async () => ({
  default: (await import("../pages/placeholder-page")).PlaceholderScreen,
}));
const LazyProfileScreen = lazy(async () => ({
  default: (await import("../pages/profile-page")).ProfileScreen,
}));
const LazyMasterDataScreen = lazy(async () => ({
  default: (await import("../pages/master-data-page")).MasterDataScreen,
}));
const LazyVisaTrackingDetailScreen = lazy(async () => ({
  default: (await import("../pages/visa-detail-page")).VisaTrackingDetailScreen,
}));
const LazyVisaTrackingScreen = lazy(async () => ({
  default: (await import("../pages/visa-tracking-page")).VisaTrackingScreen,
}));

export function AppMainContent({ controller }: { controller: AppController }) {
  const location = useLocation();
  const routeDepth = location.pathname.split("/").filter(Boolean).length > 1 ? "detail" : "root";
  const groupDataState = controller.groupDataState ?? {
    data: controller.isGroupRecordsLoading ? undefined : controller.groupRecords,
    isPending: controller.isGroupRecordsLoading,
  };
  const freshSelectedVisaRow = useMemo(
    () =>
      controller.selectedVisaRow
        ? (buildVisaTrackingRowsFromGroups(controller.groupRecords).find(
            (row) => row.groupCode === controller.selectedVisaRow?.groupCode,
          ) ?? controller.selectedVisaRow)
        : null,
    [controller.groupRecords, controller.selectedVisaRow],
  );

  return (
    // Reset the revealed route boundary on navigation so lazy-loaded screens
    // do not keep the previous page visible while the next chunk is loading.
    <Suspense key={`${location.pathname}${location.search}`} fallback={<PageSkeleton pathname={location.pathname} />}>
      <div className="serene-route-surface" data-route-depth={routeDepth}>
        <Routes>
          <Route path="/" element={<Navigate to={buildDashboardPath("overview")} replace />} />
          <Route
            path="/overview"
            element={
              <LazyOverviewScreen
                query={controller.query}
                filteredGroups={controller.filteredGroups}
                isActiveOnly={controller.isActiveOnly}
                overviewMonthFilter={controller.overviewMonthFilter}
                overviewMonthOptions={controller.overviewMonthOptions}
                statCards={controller.statCards}
                onQueryChange={controller.handleQueryChange}
                onToggleActiveOnly={controller.handleToggleActiveOnly}
                onOverviewMonthFilterChange={controller.handleOverviewMonthFilterChange}
                onOpenDetail={controller.handleOpenDetail}
                groups={controller.groupRecords}
                dataState={groupDataState}
                searchState={controller.groupSearchState}
              />
            }
          />
          <Route
            path="/groups/:groupCode"
            element={
              controller.selectedGroup ? (
                <LazyGroupDetail
                  dataState={groupDataState}
                  group={controller.selectedGroup}
                  groups={controller.groupRecords}
                  onBack={controller.handleBackToOverview}
                  onDeleteGroup={controller.handleDeleteGroup}
                  onSaveGroup={controller.handleSaveGroupDetail}
                  onPatchGroup={controller.handlePatchGroupDetail}
                />
              ) : (
                groupDataState.data === undefined ? <DetailDataState query={groupDataState} title="Detail Group" onBack={controller.handleBackToOverview} /> : <LazyPlaceholderScreen eyebrow="Group Detail" title="Group belum ditemukan" description="Data group belum tersedia atau sudah dihapus." icon="travel_explore" />
              )
            }
          />
          <Route
            path="/itinerary-builder/:groupCode"
            element={
              controller.selectedGroup ? (
                <LazyGroupItineraryBuilderPage
                  group={controller.selectedGroup}
                  onBack={controller.handleOpenDetail}
                  onSaveGroup={controller.handleSaveGroupItinerary}
                />
              ) : (
                <LazyPlaceholderScreen
                  eyebrow="Itinerary Builder"
                  title="Group belum ditemukan"
                  description="Endpoint itinerary builder sedang dibuka, tapi data group-nya belum tersedia di browser saat ini."
                  icon="edit_note"
                />
              )
            }
          />
          <Route
            path="/new-group"
            element={
              <LazyAddGroupWorkspaceScreen
                onSaveGroup={controller.handleSaveInputGroup}
                onSaveIdentity={controller.handleSaveGroupIdentity}
                onCancel={controller.handleBackToOverview}
              />
            }
          />
          <Route path="/statistics" element={<LazyStatisticsScreen />} />
          <Route path="/input" element={<Navigate to={buildDashboardPath("new-group")} replace />} />
          <Route path="/checklist" element={<LazyChecklistScreen groups={controller.groupRecords} dataState={groupDataState} />} />
          <Route path="/agreement-inbox" element={<LazyAgreementInboxScreen />} />
          <Route path="/agents" element={<Navigate to="/master-data" replace />} />
          <Route
            path="/visa"
            element={
              <LazyVisaTrackingScreen
                dataState={groupDataState}
                groups={controller.groupRecords}
                onOpenDetail={controller.handleOpenVisaDetail}
                onUpdateAgreementStatus={controller.handleUpdateAgreementStatus}
              />
            }
          />
          <Route
            path="/visa/:groupCode"
            element={
              freshSelectedVisaRow ? (
                <LazyVisaTrackingDetailScreen
                  dataState={groupDataState}
                  row={freshSelectedVisaRow}
                  groups={controller.groupRecords}
                  onBack={controller.handleBackToVisaTracking}
                  onDeleteGroup={controller.handleDeleteVisaGroup}
                  onSaveGroup={controller.handleSaveVisaGroupDetail}
                  onUpdateVisaStatus={controller.handleUpdateVisaStatus}
                  onUpdateVisaType={controller.handleUpdateVisaType}
                  onToggleHotelWaiver={controller.handleToggleHotelWaiver}
                  onUpdatePaymentStatus={controller.handleUpdatePaymentStatus}
                  onUpdateSyarikah={controller.handleUpdateSyarikah}
                  onUpdateFlightDetails={controller.handleUpdateFlightDetails}
                  onUpdateVisaHotel={controller.handleUpdateVisaHotel}
                  onDeleteVisaHotel={controller.handleDeleteVisaHotel}
                  onSyncVisaItinerary={controller.handleSyncVisaItinerary}
                  onUpdateRaudhahAppointment={controller.handleUpdateRaudhahAppointment}
                  onClearRaudhahAppointment={controller.handleClearRaudhahAppointment}
                />
              ) : (
                groupDataState.data === undefined ? <DetailDataState query={groupDataState} kind="visa" title="Detail Visa" onBack={controller.handleBackToVisaTracking} /> : <LazyPlaceholderScreen eyebrow="Visa Detail" title="Visa detail belum ditemukan" description="Data visa group belum tersedia atau sudah dihapus." icon="fact_check" />
              )
            }
          />
          <Route
            path="/invoice"
            element={<LazyInvoiceScreen groups={controller.groupRecords} onOpenDetail={controller.handleOpenDetail} />}
          />
          <Route path="/raudhah-reminder" element={<Navigate to="/overview" replace />} />
          <Route
            path="/user-management"
            element={
              controller.sessionAccessTier === "super-admin" ? (
                <LazyUserManagementScreen />
              ) : (
                <LazyPlaceholderScreen
                  eyebrow="Restricted"
                  title="Super Admin Only"
                  description="User Management hanya tersedia untuk akun Super Admin."
                  icon="lock"
                />
              )
            }
          />
          <Route path="/manage-role" element={<Navigate to="/user-management" replace />} />
          <Route
            path="/master-data"
            element={
              controller.sessionAccessTier === "super-admin" ? (
                <LazyMasterDataScreen />
              ) : (
                <LazyPlaceholderScreen
                  eyebrow="Restricted"
                  title="Super Admin Only"
                  description="Master Data hanya tersedia untuk akun Super Admin."
                  icon="lock"
                />
              )
            }
          />
          <Route
            path="/profile"
            element={
              <LazyProfileScreen
                onNavigate={controller.handleNavigate}
                sessionAccessTier={controller.sessionAccessTier}
              />
            }
          />
          <Route
            path="*"
            element={
              <LazyPlaceholderScreen
                eyebrow="Coming Soon"
                title="Page Not Available"
                description="This module is not available yet."
                icon="dashboard_customize"
              />
            }
          />
        </Routes>
      </div>
    </Suspense>
  );
}
