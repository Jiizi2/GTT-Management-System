import { Suspense, lazy, useMemo } from "react";
import { buildVisaTrackingRowsFromGroups } from "../shared/app-domain";
import type { AppController } from "../hooks/use-app-controller";

const LazyAddGroupWorkspaceScreen = lazy(async () => ({
  default: (await import("../pages/new-group-screen")).AddGroupWorkspaceScreen,
}));
const LazyChecklistScreen = lazy(async () => ({
  default: (await import("../pages/checklist-page")).ChecklistScreen,
}));
const LazyInvoiceScreen = lazy(async () => ({
  default: (await import("../pages/invoice-page")).InvoiceScreen,
}));
const LazyGroupDetail = lazy(async () => ({
  default: (await import("../pages/group-detail-page")).GroupDetail,
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

export function AppMainContent({
  controller,
}: {
  controller: AppController;
}) {
  const freshSelectedVisaRow = useMemo(
    () =>
      controller.selectedVisaRow
        ? buildVisaTrackingRowsFromGroups(controller.groupRecords).find(
            (row) => row.groupCode === controller.selectedVisaRow?.groupCode,
          ) ?? controller.selectedVisaRow
        : null,
    [controller.groupRecords, controller.selectedVisaRow],
  );

  if (controller.selectedGroup) {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LazyGroupDetail
          group={controller.selectedGroup}
          onBack={controller.handleBackToOverview}
          onDeleteGroup={controller.handleDeleteGroup}
          onSaveGroup={controller.handleSaveGroupDetail}
        />
      </Suspense>
    );
  }

  if (freshSelectedVisaRow) {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LazyVisaTrackingDetailScreen
          row={freshSelectedVisaRow}
          groups={controller.groupRecords}
          onBack={controller.handleBackToVisaTracking}
          onUpdateVisaStatus={controller.handleUpdateVisaStatus}
          onUpdatePaymentStatus={controller.handleUpdatePaymentStatus}
          onUpdateSyarikah={controller.handleUpdateSyarikah}
          onUpdateVisaHotel={controller.handleUpdateVisaHotel}
          onDeleteVisaHotel={controller.handleDeleteVisaHotel}
          onUpdateRaudhahAppointment={controller.handleUpdateRaudhahAppointment}
          onClearRaudhahAppointment={controller.handleClearRaudhahAppointment}
        />
      </Suspense>
    );
  }

  if (controller.activeNav === "overview") {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LazyOverviewScreen
          query={controller.query}
          filteredGroups={controller.filteredGroups}
          isActiveOnly={controller.isActiveOnly}
          statCards={controller.statCards}
          summaryMessage={controller.summaryMessage}
          onQueryChange={controller.handleQueryChange}
          onToggleActiveOnly={controller.handleToggleActiveOnly}
          onOpenDetail={controller.handleOpenDetail}
        />
      </Suspense>
    );
  }

  if (controller.activeNav === "input" || controller.activeNav === "new-group") {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LazyAddGroupWorkspaceScreen
          onSaveGroup={controller.handleSaveInputGroup}
          onCancel={() => controller.handleNavigate("overview")}
        />
      </Suspense>
    );
  }

  if (controller.activeNav === "checklist") {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LazyChecklistScreen groups={controller.groupRecords} />
      </Suspense>
    );
  }

  if (controller.activeNav === "visa") {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LazyVisaTrackingScreen
          groups={controller.groupRecords}
          onOpenDetail={controller.handleOpenVisaDetail}
          onUpdateAgreementStatus={controller.handleUpdateAgreementStatus}
        />
      </Suspense>
    );
  }

  if (controller.activeNav === "invoice") {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LazyInvoiceScreen groups={controller.groupRecords} onOpenDetail={controller.handleOpenDetail} />
      </Suspense>
    );
  }

  if (controller.activeNav === "raudhah-reminder") {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LazyRaudhahReminderScreen
          groups={controller.groupRecords}
          onOpenDetail={controller.handleOpenDetail}
          onOpenVisaDetail={controller.handleOpenVisaDetail}
          onSetRaudhahTasrehPrinted={controller.handleSetRaudhahTasrehPrinted}
        />
      </Suspense>
    );
  }

  if (controller.activeNav === "user-management") {
    if (controller.sessionAccessTier !== "super-admin") {
      return (
        <Suspense fallback={<ScreenLoadingFallback />}>
          <LazyPlaceholderScreen
            eyebrow="Restricted"
            title="Super Admin Only"
            description="User Management hanya tersedia untuk akun Super Admin."
            icon="lock"
          />
        </Suspense>
      );
    }

    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LazyUserManagementScreen />
      </Suspense>
    );
  }

  if (controller.activeNav === "profile") {
    return (
      <Suspense fallback={<ScreenLoadingFallback />}>
        <LazyProfileScreen
          onNavigate={controller.handleNavigate}
          sessionAccessTier={controller.sessionAccessTier}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ScreenLoadingFallback />}>
      <LazyPlaceholderScreen
        eyebrow="Coming Soon"
        title="Page Not Available"
        description="This module is not available yet."
        icon="dashboard_customize"
      />
    </Suspense>
  );
}
