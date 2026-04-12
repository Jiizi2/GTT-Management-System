import { Suspense, lazy, useCallback } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuthSessionQuery, useLoginMutation, useLogoutMutation } from "./hooks/use-auth-session-query";
import { type DevelopmentLoginAccountHint, LoginScreen, type LoginCredentials } from "./pages/login-page";
import { buildDashboardPath, buildLoginPath, isLoginRoute } from "./shared/app-route";

const LazyDashboardWorkspaceShell = lazy(async () => ({
  default: (await import("./components/dashboard-workspace-shell")).DashboardWorkspaceShell,
}));

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

export function App() {
  const location = useLocation();
  const authSessionQuery = useAuthSessionQuery();
  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();
  const authSession = authSessionQuery.data ?? null;
  const isRestoringSession =
    authSessionQuery.isPending || (authSessionQuery.isFetching && !authSessionQuery.isFetchedAfterMount);

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
            <Suspense fallback={<RestoringSessionScreen />}>
              <LazyDashboardWorkspaceShell onLogout={handleLogout} sessionUser={authSession.user} />
            </Suspense>
          ) : (
            <Navigate to={buildLoginPath()} replace />
          )
        }
      />
    </Routes>
  );
}
