import { useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { PERMISSIONS, can, createAgentPrincipal, type Permission } from "../access/permissions";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import type { AgentSession } from "./auth/agent-session";
import { useAgentLogout } from "./auth/use-agent-auth";
import { ChecklistPage } from "./pages/checklist-page";
import { AgreementsPage } from "./pages/agreements-page";
import { DashboardPage } from "./pages/dashboard-page";
import { GroupDetailPage } from "./pages/group-detail-page";
import { GroupsPage } from "./pages/groups-page";
import { InvoiceDetailPage } from "./pages/invoice-detail-page";
import { InvoicesPage } from "./pages/invoices-page";
import { ProfilePage } from "./pages/profile-page";
import { VisaApplicationsPage } from "./pages/visa-applications-page";

const navigation: ReadonlyArray<{
  to: string;
  label: string;
  icon: string;
  permission: Permission;
}> = [
  { to: "/agent/overview", label: "Overview", icon: "dashboard", permission: PERMISSIONS.overviewRead },
  { to: "/agent/groups", label: "My Groups", icon: "groups", permission: PERMISSIONS.groupsRead },
  {
    to: "/agent/visa-process",
    label: "Visa Process Tracker",
    icon: "monitoring",
    permission: PERMISSIONS.visaProcessRead,
  },
  { to: "/agent/agreements", label: "Agreement", icon: "hotel", permission: PERMISSIONS.agreementsRead },
  { to: "/agent/invoices", label: "Invoice", icon: "receipt_long", permission: PERMISSIONS.invoicesRead },
  { to: "/agent/checklist", label: "Checklist", icon: "fact_check", permission: PERMISSIONS.checklistRead },
  { to: "/agent/profile", label: "Profile", icon: "person", permission: PERMISSIONS.profileRead },
];

export function AgentShell({ session }: { session: AgentSession }) {
  const [collapsed, setCollapsed] = useState(false);
  const logout = useAgentLogout();
  const principal = createAgentPrincipal(session.user);
  const nav = navigation.filter((item) => can(principal, item.permission));
  const principalId = session.user.portalUserId;
  const location = useLocation();
  const pageOwnsThemeToggle = location.pathname === "/agent/overview" || location.pathname.startsWith("/agent/groups");
  const primaryNav = nav.slice(0, 3);
  const toolNav = nav.slice(3, -1);
  const profileNav = nav.at(-1);
  const mobileNav = nav.filter((item) =>
    ["/agent/overview", "/agent/groups", "/agent/visa-process", "/agent/checklist", "/agent/profile"].includes(item.to),
  );
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
      <aside
        className={`fixed inset-y-0 left-0 z-10 hidden flex-col bg-surface-container-low pb-7 pt-4 shadow-ambient transition-[width,padding] duration-200 xl:flex ${
          collapsed ? "w-[104px] px-3.5" : "w-[280px] pl-6 pr-5"
        }`}
        aria-label="Navigasi Agent"
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
              <p
                className="mt-1.5 text-xs font-bold text-on-surface-variant/75"
                style={{ fontFamily: '"Noto Naskh Arabic", serif' }}
              >
                Ghaniya Tour and Travel
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:-translate-y-0.5 hover:text-primary"
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
          {primaryNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {collapsed ? null : <span className="text-[0.98rem] font-bold">{item.label}</span>}
            </NavLink>
          ))}
          <div
            className={
              collapsed ? "mx-auto h-px w-8 bg-surface-container-high/75" : "mx-2 h-px bg-surface-container-high/75"
            }
          />
          {!collapsed ? (
            <p className="px-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-on-surface-variant/55">
              Tools
            </p>
          ) : null}
          {toolNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {collapsed ? null : <span className="text-[0.98rem] font-bold">{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto pt-3">
          {profileNav ? (
            <NavLink
              to={profileNav.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-[1rem] transition ${
                  collapsed
                    ? "h-14 w-14 justify-center p-0"
                    : "w-full px-2.5 py-2.5 text-left hover:bg-surface-container-lowest/75"
                } ${isActive ? "bg-surface-container-lowest/85 text-primary" : "text-on-surface-variant hover:text-on-surface"}`
              }
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant/70">
                <span className="material-symbols-outlined text-[1.7rem] leading-none">account_circle</span>
              </div>
              {collapsed ? null : (
                <>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[0.92rem] font-semibold leading-tight text-on-surface">
                      {session.user.displayName}
                    </strong>
                    <span className="mt-0.5 block truncate text-[0.72rem] font-medium text-on-surface-variant/75">
                      Agent
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
                : "w-full px-2.5 py-2.5 text-left text-on-surface-variant hover:bg-surface-container-lowest/65 hover:text-on-surface"
            }`}
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <span className="material-symbols-outlined">logout</span>
            {collapsed ? null : <span className="text-[0.92rem] font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {!pageOwnsThemeToggle ? (
        <div className="pointer-events-none fixed right-6 top-4 z-[120] sm:right-8 sm:top-5 lg:right-10">
          <ThemeToggleButton variant="floating" className="pointer-events-auto" />
        </div>
      ) : null}
      <main
        id="main-content"
        className={`relative px-0 pb-28 pt-0 transition-[margin] duration-200 xl:pb-8 xl:pt-0 ${
          collapsed ? "xl:ml-[104px]" : "xl:ml-[280px]"
        }`}
      >
        <Routes>
          <Route index element={<Navigate to="/agent/overview" replace />} />
          <Route
            path="overview"
            element={
              <DashboardPage
                principalId={principalId}
                agentId={session.user.agentId}
                agentName={session.user.agentName}
              />
            }
          />
          <Route
            path="groups"
            element={
              <GroupsPage principalId={principalId} agentId={session.user.agentId} agentName={session.user.agentName} />
            }
          />
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
          <Route path="visa-process" element={<VisaApplicationsPage principalId={principalId} />} />
          <Route
            path="agreements"
            element={
              <AgreementsPage
                principalId={principalId}
                agentId={session.user.agentId}
                agentName={session.user.agentName}
              />
            }
          />
          <Route
            path="invoices"
            element={
              <InvoicesPage
                principalId={principalId}
                agentId={session.user.agentId}
                agentName={session.user.agentName}
              />
            }
          />
          <Route path="invoices/:id" element={<InvoiceDetailPage principalId={principalId} />} />
          <Route path="checklist" element={<ChecklistPage principalId={principalId} />} />
          <Route path="profile" element={<ProfilePage principalId={principalId} />} />
          <Route path="*" element={<Navigate to="/agent/overview" replace />} />
        </Routes>
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(10px+env(safe-area-inset-bottom,0px))] pt-2 xl:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto grid max-w-md grid-cols-5 items-end rounded-[1.7rem] bg-surface-container-lowest/95 px-3 pb-2 pt-3 shadow-ambient backdrop-blur-serene">
          {mobileNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex min-w-0 flex-col items-center justify-end gap-0.5 rounded-xl px-1.5 py-2 text-center transition active:scale-[0.98]"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`material-symbols-outlined text-[1.32rem] leading-none transition ${
                      isActive ? "text-primary" : "text-on-surface-variant"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span
                    className={`min-h-[0.7rem] text-[0.61rem] font-semibold leading-none transition ${
                      isActive ? "text-primary opacity-100" : "text-on-surface-variant opacity-0"
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
