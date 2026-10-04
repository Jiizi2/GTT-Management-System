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
const AgreementInboxPage = lazy(() =>
  import("./pages/agreement-inbox-page").then(({ AgreementInboxPage: Page }) => ({ default: Page })),
);
const DashboardPage = lazy(() =>
  import("./pages/dashboard-page").then(({ DashboardPage: Page }) => ({ default: Page })),
);
const TripsPage = lazy(() => import("./pages/trips-page").then(({ TripsPage: Page }) => ({ default: Page })));
const navigation: ReadonlyArray<{
  to: string;
  label: string;
  mobileLabel?: string;
  icon: string;
  permission: Permission;
}> = [
  { to: "/agent/overview", label: "Dashboard", icon: "dashboard", permission: PERMISSIONS.overviewRead },
  { to: "/agent/visa", label: "Visa Tracking", icon: "monitoring", permission: PERMISSIONS.visaTrackingRead },
  { to: "/agent/groups", label: "Perjalanan", icon: "luggage", permission: PERMISSIONS.groupsRead },
  {
    to: "/agent/agreement-inbox",
    label: "Agreement Inbox",
    mobileLabel: "Agreement",
    icon: "description",
    permission: PERMISSIONS.agreementsRead,
  },
];
export function AgentShell({ session }: { session: AgentSession }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const logout = useAgentLogout();
  const principal = createAgentPrincipal(session.user);
  const nav = navigation.filter((item) => can(principal, item.permission));
  const principalId = session.user.portalUserId;
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
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
  useEffect(() => {
    if (!accountOpen) return;
    const outside = (event: MouseEvent) => {
      if (event.target instanceof Node && !accountRef.current?.contains(event.target)) setAccountOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        accountButtonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [accountOpen]);
  const profileAllowed = can(principal, PERMISSIONS.profileRead);
  return (
    <div className="agent-portal agent-calendar-portal min-h-screen bg-surface-container-low text-on-surface">
      <a href="#main-content" className="agent-skip-link">
        Langsung ke konten utama
      </a>
      <header className="agent-topbar">
        <div className="agent-topbar-inner">
          <div className="agent-brand">
            <span className="agent-wordmark" style={{ fontFamily: '"Noto Naskh Arabic", serif' }}>
              GTT
            </span>
            <div className="agent-brand-description">
              <strong>Portal Agent</strong>
              <span>Ghaniya Tour and Travel</span>
            </div>
          </div>
          <nav className="agent-top-navigation" aria-label="Primary navigation">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={({ isActive }) => "agent-top-link" + (isActive ? " is-active" : "")}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="agent-account" ref={accountRef}>
            <button
              type="button"
              ref={accountButtonRef}
              className="agent-account-button"
              aria-label="Buka menu akun"
              aria-expanded={accountOpen}
              aria-controls="agent-account-options"
              onClick={() => setAccountOpen((open) => !open)}
            >
              <span className="agent-avatar" aria-hidden="true">
                {session.user.agentCode.slice(0, 2)}
              </span>
              <span className="agent-account-name">
                <strong title={session.user.displayName}>{session.user.displayName}</strong>
                <span title={session.user.agentName}>{session.user.agentName}</span>
              </span>
              <span className="material-symbols-outlined agent-account-chevron" aria-hidden="true">
                expand_more
              </span>
            </button>
            {accountOpen ? (
              <div id="agent-account-options" className="agent-account-options">
                <p className="agent-account-identity">
                  <strong>{session.user.agentName}</strong>
                  <span>
                    {session.user.agentCode} · {session.user.email}
                  </span>
                </p>
                {profileAllowed ? (
                  <NavLink to="/agent/profile" onClick={() => setAccountOpen(false)} className="agent-account-action">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      account_circle
                    </span>
                    Buka profil
                  </NavLink>
                ) : null}
                <div className="agent-account-theme">
                  <span>Tema tampilan</span>
                  <ThemeToggleButton />
                </div>
                <button
                  type="button"
                  className="agent-account-action"
                  disabled={logout.isPending}
                  onClick={() => logout.mutate()}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    logout
                  </span>
                  {logout.isPending ? "Keluar…" : "Logout"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <main
        ref={mainRef}
        id="main-content"
        tabIndex={-1}
        aria-label="Konten utama"
        className="agent-main focus:outline-none"
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
            <Route path="agreement-inbox" element={<AgreementInboxPage principalId={principalId} />} />
            <Route path="checklist" element={<ChecklistPage principalId={principalId} />} />
            <Route path="profile" element={<ProfilePage principalId={principalId} />} />
            <Route path="*" element={<Navigate to="/agent/overview" replace />} />
          </Routes>
        </Suspense>
      </main>
      <nav className="agent-mobile-navigation" aria-label="Mobile navigation">
        <div style={{ gridTemplateColumns: "repeat(" + nav.length + ", minmax(0, 1fr))" }}>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={({ isActive }) => "agent-mobile-link" + (isActive ? " is-active" : "")}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.mobileLabel ?? item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
