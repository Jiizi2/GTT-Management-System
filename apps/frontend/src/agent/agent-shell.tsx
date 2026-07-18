import { useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { PERMISSIONS, can, createAgentPrincipal, type Permission } from "../access/permissions";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import type { AgentSession } from "./auth/agent-session";
import { useAgentLogout } from "./auth/use-agent-auth";
import { ChecklistPage } from "./pages/checklist-page";
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

function AgreementReadOnlyPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-5 py-6">
      <section className="serene-hero">
        <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Read-only</p>
        <h1 className="mt-2 text-3xl font-extrabold">Agreement</h1>
        <p className="mt-2 text-on-surface-variant">
          Status agreement hotel ditampilkan per group. Buka My Groups untuk melihat agreement Makkah dan Madinah pada
          detail group.
        </p>
      </section>
    </div>
  );
}

export function AgentShell({ session }: { session: AgentSession }) {
  const [collapsed, setCollapsed] = useState(false);
  const logout = useAgentLogout();
  const principal = createAgentPrincipal(session.user);
  const nav = navigation.filter((item) => can(principal, item.permission));
  const principalId = session.user.portalUserId;

  return (
    <div className="min-h-screen bg-surface-container-low text-on-surface">
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-surface-container-lowest p-4 shadow-ambient transition-[width] xl:flex ${collapsed ? "w-24" : "w-72"}`}
        aria-label="Navigasi Agent"
      >
        <div className="mb-8 flex items-center justify-between gap-2">
          <div className={collapsed ? "hidden" : "block"}>
            <p className="text-2xl font-black text-primary">GTT</p>
            <p className="text-xs font-bold text-on-surface-variant">Agent Workspace</p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
          >
            <span className="material-symbols-outlined">{collapsed ? "chevron_right" : "chevron_left"}</span>
          </button>
        </div>
        <nav className="grid gap-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 font-bold transition ${isActive ? "bg-primary-fixed text-primary" : "text-on-surface-variant hover:bg-surface-container-low"}`
              }
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              {collapsed ? null : <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <div className={`mb-3 rounded-xl bg-surface-container-low p-3 ${collapsed ? "text-center" : ""}`}>
            <strong>{session.user.displayName.slice(0, 1).toUpperCase()}</strong>
            {collapsed ? null : (
              <>
                <p className="truncate text-sm font-bold">{session.user.displayName}</p>
                <p className="truncate text-xs text-on-surface-variant">{session.user.agentName}</p>
              </>
            )}
          </div>
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-on-surface-variant hover:bg-error-container"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <span className="material-symbols-outlined">logout</span>
            {collapsed ? null : "Keluar"}
          </button>
        </div>
      </aside>

      <div className="fixed right-5 top-4 z-50">
        <ThemeToggleButton variant="floating" />
      </div>
      <main
        id="main-content"
        className={`px-4 pb-28 transition-[margin] sm:px-6 xl:pb-8 ${collapsed ? "xl:ml-24" : "xl:ml-72"}`}
      >
        <Routes>
          <Route index element={<Navigate to="/agent/overview" replace />} />
          <Route path="overview" element={<DashboardPage principalId={principalId} />} />
          <Route path="groups" element={<GroupsPage principalId={principalId} />} />
          <Route path="groups/:identity" element={<GroupDetailPage principalId={principalId} />} />
          <Route path="visa-process" element={<VisaApplicationsPage principalId={principalId} />} />
          <Route path="agreements" element={<AgreementReadOnlyPage />} />
          <Route path="invoices" element={<InvoicesPage principalId={principalId} />} />
          <Route path="invoices/:id" element={<InvoiceDetailPage principalId={principalId} />} />
          <Route path="checklist" element={<ChecklistPage principalId={principalId} />} />
          <Route path="profile" element={<ProfilePage principalId={principalId} />} />
          <Route path="*" element={<Navigate to="/agent/overview" replace />} />
        </Routes>
      </main>

      <nav
        className="fixed bottom-3 left-3 right-3 z-40 flex gap-1 overflow-x-auto rounded-2xl bg-surface-container-lowest p-2 shadow-float xl:hidden"
        aria-label="Navigasi Agent mobile"
      >
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex min-w-20 flex-1 flex-col items-center rounded-xl px-2 py-2 text-[.65rem] font-bold ${isActive ? "bg-primary-fixed text-primary" : "text-on-surface-variant"}`
            }
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
