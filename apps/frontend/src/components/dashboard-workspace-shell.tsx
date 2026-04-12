import { useEffect, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppMainContent } from "./app-main-content";
import { MobileNav } from "./mobile-nav";
import { MobileQuickActionsSheet } from "./mobile-quick-actions-sheet";
import { ThemeToggleButton } from "./theme-toggle-button";
import { useAppController } from "../hooks/use-app-controller";
import type { AuthSession } from "../shared/auth-session";

export function DashboardWorkspaceShell({
  onLogout,
  sessionUser,
}: {
  onLogout: () => void;
  sessionUser: AuthSession["user"];
}) {
  const controller = useAppController(sessionUser.accessTier);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
  const shouldShowFloatingThemeToggle = !(
    controller.activeNav === "overview" ||
    controller.activeNav === "checklist" ||
    (controller.activeNav === "visa" && !controller.selectedVisaRow) ||
    controller.activeNav === "invoice" ||
    controller.activeNav === "raudhah-reminder" ||
    controller.activeNav === "new-group" ||
    controller.activeNav === "input" ||
    (controller.activeNav === "user-management" && controller.sessionAccessTier === "super-admin") ||
    (controller.activeNav === "master-data" && controller.sessionAccessTier === "super-admin")
  );
  const syncFeedback = controller.syncFeedback;
  const syncFeedbackToneClassMap = {
    success: "bg-primary text-on-primary",
    error: "bg-error-container text-on-error-container",
    info: "bg-secondary text-on-primary",
  } as const;
  const syncFeedbackIconMap = {
    success: "check_circle",
    error: "error",
    info: "info",
  } as const;

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const appRoot = document.getElementById("app");

    html.style.setProperty("margin", "0", "important");
    html.style.setProperty("padding", "0", "important");
    body.style.setProperty("margin", "0", "important");
    body.style.setProperty("padding", "0", "important");
    body.style.setProperty("background-color", "rgb(var(--serene-app-background))", "important");

    if (appRoot) {
      appRoot.style.setProperty("margin", "0", "important");
      appRoot.style.setProperty("padding", "0", "important");
      appRoot.style.setProperty("min-height", "100vh", "important");
      appRoot.style.setProperty("background-color", "rgb(var(--serene-app-background))", "important");
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-surface-container-low">
      <AppSidebar
        activeNav={controller.activeNav}
        sessionAccessTier={controller.sessionAccessTier}
        sessionUserName={sessionUser.name}
        isCollapsed={controller.isSidebarCollapsed}
        onNavigate={controller.handleNavigate}
        onOpenNewGroup={controller.handleOpenNewGroup}
        onToggleCollapse={controller.toggleSidebarCollapse}
        onLogout={onLogout}
      />

      {shouldShowFloatingThemeToggle ? (
        <div className="pointer-events-none fixed right-6 top-4 z-[120] sm:right-8 sm:top-5 lg:right-10">
          <ThemeToggleButton className="pointer-events-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-lowest/90 text-on-surface-variant shadow-ambient backdrop-blur-serene transition hover:-translate-y-0.5 hover:text-primary" />
        </div>
      ) : null}

      <main
        className={`relative px-4 pb-28 pt-0 transition-[margin] duration-200 sm:px-5 lg:px-8 lg:pb-8 lg:pt-0 ${
          controller.isSidebarCollapsed ? "lg:ml-[104px]" : "lg:ml-[280px]"
        }`}
      >
        <AppMainContent controller={controller} />
      </main>

      <MobileNav
        activeNav={controller.activeNav}
        isActionsOpen={isMobileActionsOpen}
        onNavigate={controller.handleNavigate}
        onToggleActions={() => setIsMobileActionsOpen((current) => !current)}
      />

      <MobileQuickActionsSheet
        activeNav={controller.activeNav}
        sessionAccessTier={controller.sessionAccessTier}
        open={isMobileActionsOpen}
        onClose={() => setIsMobileActionsOpen(false)}
        onSelectAction={(navId) => {
          setIsMobileActionsOpen(false);
          controller.handleNavigate(navId);
        }}
      />

      {syncFeedback ? (
        <div className="fixed bottom-24 left-4 right-4 z-[90] lg:bottom-6 lg:left-auto lg:right-6 lg:w-full lg:max-w-sm">
          <div
            className={`flex items-start gap-3 rounded-2xl px-4 py-3 shadow-float backdrop-blur-serene ${syncFeedbackToneClassMap[syncFeedback.tone]}`}
            role="status"
            aria-live="polite"
          >
            <span className="material-symbols-outlined mt-0.5" aria-hidden="true">
              {syncFeedbackIconMap[syncFeedback.tone]}
            </span>
            <p className="flex-1 text-sm font-medium leading-relaxed">{syncFeedback.message}</p>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant transition hover:bg-surface-container-high"
              onClick={controller.dismissSyncFeedback}
              aria-label="Close sync message"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
