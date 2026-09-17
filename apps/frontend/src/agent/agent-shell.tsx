import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PERMISSIONS, can, createAgentPrincipal, type Permission } from "../access/permissions";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import type { AgentSession } from "./auth/agent-session";
import { useAgentLogout } from "./auth/use-agent-auth";
import { ChecklistPage } from "./pages/checklist-page";
import { GroupDetailPage } from "./pages/group-detail-page";
import { ProfilePage } from "./pages/profile-page";
import { AgentVisaDetailPage } from "./pages/visa-detail-page";
import { AgentVisaTrackingPage } from "./pages/visa-tracking-page";
import { LoadingState } from "./components/data-state";

const DashboardPage = lazy(() =>
  import("./pages/dashboard-page").then(({ DashboardPage: Page }) => ({ default: Page })),
);
const TripsPage = lazy(() => import("./pages/trips-page").then(({ TripsPage: Page }) => ({ default: Page })));

const navigation: ReadonlyArray<{
  to: string;
  label: string;
  icon: string;
  permission: Permission;
}> = [
  { to: "/agent/overview", label: "Dashboard", icon: "dashboard", permission: PERMISSIONS.overviewRead },
  {
    to: "/agent/visa",
    label: "Visa Tracking",
    icon: "monitoring",
    permission: PERMISSIONS.visaTrackingRead,
  },
  { to: "/agent/groups", label: "Perjalanan", icon: "luggage", permission: PERMISSIONS.groupsRead },
];

export function AgentShell({ session }: { session: AgentSession }) {
  const [collapsed, setCollapsed] = useState(false);
  const logout = useAgentLogout();
  const principal = createAgentPrincipal(session.user);
  const nav = navigation.filter((item) => can(principal, item.permission));
  const principalId = session.user.portalUserId;
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const initialRoute = useRef(true);
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (initialRoute.current) {
      initialRoute.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);
  const profileAllowed = can(principal, PERMISSIONS.profileRead);
  const navLinkClass = (isActive: boolean) =>
    `group flex items-center gap-3.5 rounded-full text-on-surface-variant transition ${
      collapsed ? "h-14 w-14 justify-center px-0" : "px-4 py-3.5"
    } ${
      isActive
        ? "bg-surface-container-lowest text-primary shadow-ambient"
        : "text-on-surface-variant hover:translate-x-1 hover:bg-surface-container-lowest hover:text-primary"
    }`;

  return (
    <div className="relative min-h-screen bg-surface-container-low text-on-surface">
      <a
        href="#main-content"
        className="fixed left-4 top-3 z-[200] -translate-y-20 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-on-primary shadow-ambient transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Langsung ke konten utama
      </a>
      <div
        className="pointer-events-none fixed inset-y-0 right-0 z-0 hidden w-[30rem] overflow-hidden xl:block"
        aria-hidden="true"
      >
        <span className="material-symbols-outlined absolute -right-28 top-[18%] text-[25rem] leading-none text-primary opacity-[0.035]">
          map
        </span>
        <span className="absolute -right-12 top-[38%] h-64 w-64 rounded-full border border-dashed border-primary/10" />
        <span className="material-symbols-outlined absolute right-20 top-[38%] -rotate-12 text-3xl text-primary/15">
          flight_takeoff
        </span>
      </div>
      <aside
        className={`fixed inset-y-0 left-0 z-10 hidden flex-col bg-surface-container-low pb-7 pt-4 shadow-ambient transition-[width,padding] duration-200 xl:flex ${
          collapsed ? "w-[104px] px-3.5" : "w-[280px] pl-6 pr-5"
        }`}
        aria-label="Navigasi Portal Agent"
      >
        <div className={`mb-9 flex gap-3 ${collapsed ? "flex-col items-center" : "items-start justify-between"}`}>
          <div className={`min-w-0 ${collapsed ? "p-0 text-center" : "px-2"}`}>
            <h2
              className="m-0 text-[1.55rem] font-bold tracking-[0.02em] text-primary"
              style={{ fontFamily: '"Noto Naskh Arabic", serif' }}
            >
              GTT
            </h2>
            {!collapsed ? (
              <div className="mt-1.5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Portal Agent</p>
                <p className="mt-0.5 text-[11px] font-bold text-on-surface-variant/75">Ghaniya Tour and Travel</p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:-translate-y-0.5 hover:text-primary"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="material-symbols-outlined">{collapsed ? "chevron_right" : "chevron_left"}</span>
          </button>
        </div>
        <nav className={`grid gap-2 ${collapsed ? "justify-items-center" : ""}`} aria-label="Primary navigation">
          {!collapsed ? (
            <p className="px-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-on-surface-variant/55">
              Main
            </p>
          ) : null}
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              {collapsed ? null : <span className="text-[0.98rem] font-bold">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        {!collapsed ? (
          <section
            className="relative mt-8 overflow-hidden rounded-2xl bg-primary p-4 text-on-primary shadow-ambient"
            aria-label={`Ruang kerja ${session.user.agentName}`}
          >
            <span
              className="material-symbols-outlined pointer-events-none absolute -bottom-8 -right-5 rotate-[-12deg] text-[7.5rem] leading-none text-on-primary/10"
              aria-hidden="true"
            >
              map
            </span>
            <div className="relative">
              <div className="flex items-center gap-2 text-on-primary/75">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  route
                </span>
                <span className="text-xs font-bold">Ruang kerja Agent</span>
              </div>
              <strong className="mt-3 block truncate text-base font-extrabold">{session.user.agentName}</strong>
              <span className="mt-1 inline-flex rounded-lg bg-on-primary/15 px-2 py-1 text-[11px] font-bold tracking-[0.08em]">
                {session.user.agentCode}
              </span>
              <p className="mt-3 max-w-[12rem] text-xs leading-relaxed text-on-primary/75">
                Dashboard, visa, dan perjalanan dalam satu ruang kerja.
              </p>
            </div>
          </section>
        ) : null}
        <div className="mt-auto pt-3">
          {profileAllowed ? (
            <NavLink
              to="/agent/profile"
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-[1rem] transition ${
                  collapsed
                    ? "h-14 w-14 justify-center p-0"
                    : "w-full px-2.5 py-2.5 text-left hover:bg-surface-container-lowest/75"
                } ${isActive ? "bg-surface-container-lowest/85 text-primary" : "text-on-surface-variant hover:text-on-surface"}`
              }
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant/70">
                <span className="material-symbols-outlined text-[1.7rem] leading-none" aria-hidden="true">
                  account_circle
                </span>
              </div>
              {collapsed ? null : (
                <>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[0.92rem] font-semibold leading-tight text-on-surface">
                      {session.user.displayName}
                    </strong>
                    <span className="mt-0.5 block truncate text-[0.72rem] font-medium text-on-surface-variant/75">
                      Portal Agent
                    </span>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/35">chevron_right</span>
                </>
              )}
            </NavLink>
          ) : null}
          <button
            type="button"
            className={`mt-1 flex items-center gap-3 rounded-[1rem] transition ${
              collapsed
                ? "h-14 w-14 justify-center p-0"
                : "min-h-11 w-full px-2.5 py-2.5 text-left text-on-surface-variant hover:bg-surface-container-lowest/65 hover:text-on-surface"
            }`}
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <span className="material-symbols-outlined">logout</span>
            {collapsed ? null : <span className="text-[0.92rem] font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex items-center gap-2 sm:right-8 sm:top-5 lg:right-10">
        {profileAllowed ? (
          <NavLink
            to="/agent/profile"
            className={({ isActive }) =>
              `pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full shadow-ambient transition xl:hidden ${
                isActive
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-lowest text-on-surface-variant hover:text-primary"
              }`
            }
            aria-label="Buka profil"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              account_circle
            </span>
          </NavLink>
        ) : null}
        <ThemeToggleButton variant="floating" className="pointer-events-auto" />
      </div>
      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        aria-label="Konten utama"
        className={`relative z-[1] px-0 pb-28 pt-0 transition-[margin] duration-200 xl:pb-8 xl:pt-0 ${
          collapsed ? "xl:ml-[104px]" : "xl:ml-[280px]"
        }`}
      >
        <Suspense fallback={<LoadingState label="Memuat halaman..." />}>
          <Routes>
            <Route index element={<Navigate to="/agent/overview" replace />} />
            <Route
              path="overview"
              element={<DashboardPage principalId={principalId} agentName={session.user.agentName} />}
            />
            <Route path="groups" element={<TripsPage principalId={principalId} />} />
            <Route
              path="groups/:identity"
              element={
                <GroupDetailPage
                  principalId={principalId}
                  agentId={session.user.agentId}
                  agentName={session.user.agentName}
                />
              }
            />
            <Route
              path="visa"
              element={
                <AgentVisaTrackingPage
                  principalId={principalId}
                  agentId={session.user.agentId}
                  agentName={session.user.agentName}
                />
              }
            />
            <Route
              path="visa/:identity"
              element={
                <AgentVisaDetailPage
                  principalId={principalId}
                  agentId={session.user.agentId}
                  agentName={session.user.agentName}
                />
              }
            />
            <Route path="checklist" element={<ChecklistPage principalId={principalId} />} />
            <Route path="profile" element={<ProfilePage principalId={principalId} />} />
            <Route path="*" element={<Navigate to="/agent/overview" replace />} />
          </Routes>
        </Suspense>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(10px+env(safe-area-inset-bottom,0px))] pt-2 xl:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-3 items-end rounded-[1.7rem] bg-surface-container-lowest/95 px-3 pb-2 pt-3 shadow-ambient backdrop-blur-serene">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex min-w-0 flex-col items-center justify-end gap-0.5 rounded-xl px-1.5 py-2 text-center transition active:scale-[0.98]"
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`material-symbols-outlined text-[1.32rem] leading-none transition ${
                      isActive ? "text-primary" : "text-on-surface-variant"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={`min-h-[0.7rem] text-[0.61rem] font-semibold leading-none transition ${
                      isActive ? "text-primary" : "text-on-surface-variant"
                    }`}
                  >
                    {item.label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
