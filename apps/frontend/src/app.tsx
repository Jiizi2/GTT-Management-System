import { useCallback, useEffect, useState } from "react";
import { AppSidebar } from "./components/app-sidebar";
import { AppMainContent } from "./components/app-main-content";
import { MobileNav } from "./components/mobile-nav";
import { MobileQuickActionsSheet } from "./components/mobile-quick-actions-sheet";
import { ThemeToggleButton } from "./components/theme-toggle-button";
import { loginWithBackend } from "./hooks/use-auth-backend";
import { ACTIVE_NAV_STORAGE_KEY, useAppController } from "./hooks/use-app-controller";
import { type DevelopmentLoginAccountHint, LoginScreen, type LoginCredentials } from "./pages/login-page";
import {
  AUTH_STATE_CHANGED_EVENT,
  clearAuthSession,
  persistAuthSession,
  readPersistedAuthSession,
  type AuthSession,
} from "./shared/auth-session";

function shouldRenderStandaloneLoginScreen(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const normalizedPath = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  if (normalizedPath === "/login" || normalizedPath === "/auth/login") {
    return true;
  }

  const screenSearchParam = new URLSearchParams(window.location.search).get("screen");
  return screenSearchParam?.trim().toLowerCase() === "login";
}

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

function DashboardWorkspaceShell({ onLogout }: { onLogout: () => void }) {
  const controller = useAppController();
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
    // Force-reset root spacing to prevent any unexpected top gap injected by external styles.
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
  const [authSession, setAuthSession] = useState<AuthSession | null>(() => readPersistedAuthSession());
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [loginErrorMessage, setLoginErrorMessage] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncSessionFromStorage = () => {
      setAuthSession(readPersistedAuthSession());
    };

    window.addEventListener(AUTH_STATE_CHANGED_EVENT, syncSessionFromStorage);
    window.addEventListener("storage", syncSessionFromStorage);

    return () => {
      window.removeEventListener(AUTH_STATE_CHANGED_EVENT, syncSessionFromStorage);
      window.removeEventListener("storage", syncSessionFromStorage);
    };
  }, []);

  const handleLoginSubmit = useCallback(async (credentials: LoginCredentials) => {
    const identifier = credentials.identifier.trim();
    if (!identifier || !credentials.password) {
      setLoginErrorMessage("Username/email dan password wajib diisi.");
      return;
    }

    setIsSigningIn(true);
    setLoginErrorMessage("");

    try {
      const nextSession = await loginWithBackend(credentials);
      persistAuthSession(nextSession);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(ACTIVE_NAV_STORAGE_KEY, "overview");
        } catch {
          // No-op if storage is blocked or full.
        }
      }
      setAuthSession(nextSession);

      if (typeof window !== "undefined" && shouldRenderStandaloneLoginScreen()) {
        window.history.replaceState(null, "", "/");
      }
    } catch (error: unknown) {
      setLoginErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : "Login gagal. Silakan coba lagi.",
      );
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearAuthSession();
    setAuthSession(null);
  }, []);

  if (shouldRenderStandaloneLoginScreen() || !authSession) {
    return (
      <LoginScreen
        onSubmit={handleLoginSubmit}
        isSubmitting={isSigningIn}
        errorMessage={loginErrorMessage}
        developmentAccounts={shouldExposeDevelopmentLoginHints() ? DEVELOPMENT_LOGIN_ACCOUNTS : []}
      />
    );
  }

  return <DashboardWorkspaceShell onLogout={handleLogout} />;
}

