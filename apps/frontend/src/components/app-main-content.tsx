import { Suspense, lazy, useMemo } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { buildVisaTrackingRowsFromGroups } from "../shared/app-domain";
import { buildDashboardPath } from "../shared/app-route";
import type { AppController } from "../hooks/use-app-controller";

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
const LazyRaudhahReminderScreen = lazy(async () => ({
  default: (await import("../pages/raudhah-reminder-page")).RaudhahReminderScreen,
}));
const LazyVisaTrackingDetailScreen = lazy(async () => ({
  default: (await import("../pages/visa-detail-page")).VisaTrackingDetailScreen,
}));
const LazyVisaTrackingScreen = lazy(async () => ({
  default: (await import("../pages/visa-tracking-page")).VisaTrackingScreen,
}));

function ScreenLoadingFallback() {
  return (
    <section
      className="mx-auto flex max-w-7xl items-center gap-3 rounded-2xl bg-surface-container-lowest px-5 py-4 text-on-surface-variant shadow-ambient"
      role="status"
      aria-live="polite"
    >
      <span className="material-symbols-outlined animate-pulse text-brand-primary" aria-hidden="true">
        hourglass_top
      </span>
      <p className="text-sm font-semibold">Loading screen...</p>
    </section>
  );
}

export function AppMainContent({ controller }: { controller: AppController }) {
  const location = useLocation();
  const requiresDetailedGroupRecords =
    controller.selectedGroupCode !== null ||
    controller.selectedVisaGroupCode !== null ||
    controller.activeNav === "checklist" ||
    controller.activeNav === "visa" ||
    controller.activeNav === "invoice" ||
    controller.activeNav === "raudhah-reminder";
  const freshSelectedVisaRow = useMemo(
    () =>
      controller.selectedVisaRow
        ? (buildVisaTrackingRowsFromGroups(controller.groupRecords).find(
            (row) => row.groupCode === controller.selectedVisaRow?.groupCode,
          ) ?? controller.selectedVisaRow)
        : null,
    [controller.groupRecords, controller.selectedVisaRow],
  );

  if (controller.isGroupRecordsLoading && requiresDetailedGroupRecords) {
    return <ScreenLoadingFallback />;
  }

  return (
    // Reset the revealed route boundary on navigation so lazy-loaded screens
    // do not keep the previous page visible while the next chunk is loading.
    <Suspense key={`${location.pathname}${location.search}`} fallback={<ScreenLoadingFallback />}>
      <div className="animate-page-fade-in">
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
                summaryMessage={controller.summaryMessage}
                onQueryChange={controller.handleQueryChange}
                onToggleActiveOnly={controller.handleToggleActiveOnly}
                onOverviewMonthFilterChange={controller.handleOverviewMonthFilterChange}
                onOpenDetail={controller.handleOpenDetail}
                groups={controller.groupRecords}
              />
            }
          />
          <Route
            path="/groups/:groupCode"
            element={
              controller.selectedGroup ? (
                <LazyGroupDetail
                  group={controller.selectedGroup}
                  groups={controller.groupRecords}
                  onBack={controller.handleBackToOverview}
                  onDeleteGroup={controller.handleDeleteGroup}
                  onSaveGroup={controller.handleSaveGroupDetail}
                  onPatchGroup={controller.handlePatchGroupDetail}
                />
              ) : (
                <LazyPlaceholderScreen
                  eyebrow="Group Detail"
                  title="Group belum ditemukan"
                  description="Endpoint group detail sedang dibuka, tapi data group-nya belum tersedia di browser saat ini."
                  icon="travel_explore"
                />
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
                  onSaveGroup={controller.handleSaveGroupDetail}
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
          <Route path="/input" element={<Navigate to={buildDashboardPath("new-group")} replace />} />
          <Route path="/checklist" element={<LazyChecklistScreen groups={controller.groupRecords} />} />
          <Route path="/agreement-inbox" element={<LazyAgreementInboxScreen />} />
          <Route
            path="/visa"
            element={
              <LazyVisaTrackingScreen
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
                  row={freshSelectedVisaRow}
                  groups={controller.groupRecords}
                  onBack={controller.handleBackToVisaTracking}
                  onDeleteGroup={controller.handleDeleteVisaGroup}
                  onSaveGroup={controller.handleSaveVisaGroupDetail}
                  onUpdateVisaStatus={controller.handleUpdateVisaStatus}
                  onUpdateVisaType={controller.handleUpdateVisaType}
                  onUpdatePaymentStatus={controller.handleUpdatePaymentStatus}
                  onUpdateSyarikah={controller.handleUpdateSyarikah}
                  onUpdateVisaHotel={controller.handleUpdateVisaHotel}
                  onDeleteVisaHotel={controller.handleDeleteVisaHotel}
                  onUpdateRaudhahAppointment={controller.handleUpdateRaudhahAppointment}
                  onClearRaudhahAppointment={controller.handleClearRaudhahAppointment}
                />
              ) : (
                <LazyPlaceholderScreen
                  eyebrow="Visa Detail"
                  title="Visa detail belum ditemukan"
                  description="Endpoint visa detail sedang dibuka, tapi data visa group-nya belum tersedia di browser saat ini."
                  icon="fact_check"
                />
              )
            }
          />
          <Route
            path="/invoice"
            element={<LazyInvoiceScreen groups={controller.groupRecords} onOpenDetail={controller.handleOpenDetail} />}
          />
          <Route
            path="/raudhah-reminder"
            element={
              <LazyRaudhahReminderScreen
                groups={controller.groupRecords}
                onOpenVisaDetail={controller.handleOpenVisaDetail}
                onSetRaudhahTasrehPrinted={controller.handleSetRaudhahTasrehPrinted}
              />
            }
          />
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
