import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppSidebar } from "./components/app-sidebar";
import { AppMainContent } from "./components/app-main-content";
import { MobileNav } from "./components/mobile-nav";
import { MobileQuickActionsSheet } from "./components/mobile-quick-actions-sheet";
import { ThemeToggleButton } from "./components/theme-toggle-button";
import { useAppController } from "./hooks/use-app-controller";
import { useAuthSessionQuery, useLoginMutation, useLogoutMutation } from "./hooks/use-auth-session-query";
import { type DevelopmentLoginAccountHint, LoginScreen, type LoginCredentials } from "./pages/login-page";
import type { AuthSession } from "./shared/auth-session";
import { buildDashboardPath, buildLoginPath, isLoginRoute } from "./shared/app-route";

const DEVELOPMENT_LOGIN_ACCOUNTS: DevelopmentLoginAccountHint[] = [
  {
    label: "Dev Super Admin",
    identifier: "dev.superadmin",
    password: "DevSuperAdmin#2026",
    accessTier: "super-admin",
  },
  {
    label: "Dev Admin",
    identifier: "dev.admin",
    password: "DevAdmin#2026",
    accessTier: "admin",
  },
];

function shouldExposeDevelopmentLoginHints(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const host = window.location.hostname.trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1";
}

function RestoringSessionScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-container-low px-6 text-center">
      <div className="max-w-sm rounded-3xl border border-outline-variant/40 bg-surface-container-lowest px-6 py-8 shadow-ambient">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">Secure Session</p>
        <h1 className="mt-3 text-2xl font-semibold text-on-surface">Memverifikasi sesi</h1>
        <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
          Dashboard sedang memastikan sesi login Anda masih valid.
        </p>
      </div>
    </div>
  );
}

function DashboardWorkspaceShell({
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

export function App() {
  const location = useLocation();
  const authSessionQuery = useAuthSessionQuery();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();
  const authSession = authSessionQuery.data ?? null;
  const isRestoringSession =
    authSessionQuery.isPending ||
    (authSessionQuery.isFetching && !authSessionQuery.isFetchedAfterMount);

  const handleLoginSubmit = useCallback(
    async (credentials: LoginCredentials) => {
      loginMutation.reset();
      await loginMutation.mutateAsync(credentials);
    },
    [loginMutation],
  );

  const handleLogout = useCallback(() => {
    logoutMutation.mutate();
  }, [logoutMutation]);

  if (isRestoringSession) {
    return <RestoringSessionScreen />;
  }

  if (isLoginRoute(location.pathname, location.search)) {
    if (authSession) {
      return <Navigate to={buildDashboardPath("overview")} replace />;
    }

    if (location.pathname !== buildLoginPath()) {
      return <Navigate to={buildLoginPath()} replace />;
    }
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          authSession ? (
            <Navigate to={buildDashboardPath("overview")} replace />
          ) : (
            <LoginScreen
              onSubmit={handleLoginSubmit}
              isSubmitting={loginMutation.isPending}
              errorMessage={
                loginMutation.error instanceof Error && loginMutation.error.message.trim()
                  ? loginMutation.error.message.trim()
                  : ""
              }
              developmentAccounts={shouldExposeDevelopmentLoginHints() ? DEVELOPMENT_LOGIN_ACCOUNTS : []}
            />
          )
        }
      />
      <Route path="/auth/login" element={<Navigate to={buildLoginPath()} replace />} />
      <Route
        path="*"
        element={
          authSession ? (
            <DashboardWorkspaceShell
              onLogout={handleLogout}
              sessionUser={authSession.user}
            />
          ) : (
            <Navigate to={buildLoginPath()} replace />
          )
        }
      />
    </Routes>
  );
}
