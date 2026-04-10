import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { operatorAvatar, sidebarAccountItem, sidebarItems } from "../shared/app-domain";
import type { NavId, SessionAccessTier } from "../shared/app-domain";

function SidebarModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

export function AppSidebar({
  activeNav,
  sessionAccessTier,
  isCollapsed,
  onNavigate,
  onOpenNewGroup,
  onToggleCollapse,
  onLogout,
}: {
  activeNav: NavId;
  sessionAccessTier: SessionAccessTier;
  isCollapsed: boolean;
  onNavigate: (navId: NavId) => void;
  onOpenNewGroup: () => void;
  onToggleCollapse: () => void;
  onLogout: () => void;
}) {
  const primaryNavItems = sidebarItems.filter(
    (item) => item.id === "overview" || item.id === "checklist" || item.id === "visa",
  );
  const utilityNavItems = sidebarItems.filter(
    (item) => item.id === "invoice" || item.id === "raudhah-reminder",
  );
  const desktopOnlyAdminItems: Array<{ id: NavId; label: string; icon: string }> =
    sessionAccessTier === "super-admin"
      ? [{ id: "user-management", label: "User Management", icon: "admin_panel_settings" }]
      : [];
  const toolsNavItems = [...utilityNavItems, ...desktopOnlyAdminItems];

  const sectionLabelClass =
    "px-2 text-[0.68rem] font-black uppercase tracking-[0.18em] text-on-surface-variant/55";
  const sectionDividerClass = isCollapsed
    ? "mx-auto h-px w-8 bg-surface-container-high/75"
    : "mx-2 h-px bg-surface-container-high/75";
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  useEffect(() => {
    if (!isLogoutModalOpen || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLogoutModalOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLogoutModalOpen]);

  const closeLogoutModal = () => setIsLogoutModalOpen(false);
  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false);
    onLogout();
  };

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-10 hidden flex-col border-r border-outline-variant/40 bg-surface-container-low pb-7 pt-4 transition-[width,padding] duration-200 lg:flex ${
          isCollapsed ? "w-[104px] px-3.5" : "w-[280px] pl-6 pr-5"
        }`}
      >
        <div
          className={`mb-9 flex gap-3 ${
            isCollapsed ? "flex-col items-center" : "items-start justify-between"
          }`}
        >
          <div className={`min-w-0 ${isCollapsed ? "p-0 text-center" : "px-2"}`}>
            <h2
              className="m-0 text-[1.55rem] font-bold tracking-[0.02em] text-primary"
              style={{ fontFamily: "\"Noto Naskh Arabic\", serif" }}
            >
              GTT
            </h2>
            {!isCollapsed ? (
              <p className="mt-1.5 text-xs font-bold text-on-surface-variant/75" style={{ fontFamily: "\"Noto Naskh Arabic\", serif" }}>
                Ghaniya Tour and Travel
              </p>
            ) : null}
          </div>

          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:-translate-y-0.5 hover:text-primary"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={isCollapsed}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {isCollapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </div>

        <nav className={`grid gap-2 ${isCollapsed ? "justify-items-center" : ""}`} aria-label="Primary navigation">
          {!isCollapsed ? <p className={sectionLabelClass}>Main</p> : null}

          {primaryNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`group flex items-center gap-3.5 rounded-full text-on-surface-variant transition ${
                isCollapsed ? "h-14 w-14 justify-center px-0" : "px-4 py-3.5"
              } ${
                activeNav === item.id
                  ? "bg-surface-container-lowest text-primary shadow-[0_18px_40px_-28px_rgba(27,28,26,0.35)]"
                  : "text-on-surface-variant hover:translate-x-1 hover:bg-surface-container-lowest hover:text-primary"
              }`}
              onClick={() => onNavigate(item.id)}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              {!isCollapsed ? <span className="text-[0.98rem] font-bold">{item.label}</span> : null}
            </button>
          ))}

          <div className={sectionDividerClass} aria-hidden="true" />

          {!isCollapsed ? <p className={sectionLabelClass}>Tools</p> : null}

          {toolsNavItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`group flex items-center gap-3.5 rounded-full text-on-surface-variant transition ${
                isCollapsed ? "h-14 w-14 justify-center px-0" : "px-4 py-3.5"
              } ${
                activeNav === item.id
                  ? "bg-surface-container-lowest text-primary shadow-[0_18px_40px_-28px_rgba(27,28,26,0.35)]"
                  : "text-on-surface-variant hover:translate-x-1 hover:bg-surface-container-lowest hover:text-primary"
              }`}
              onClick={() => onNavigate(item.id)}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                {item.icon}
              </span>
              {!isCollapsed ? <span className="text-[0.98rem] font-bold">{item.label}</span> : null}
            </button>
          ))}

          <div className={sectionDividerClass} aria-hidden="true" />
        </nav>

        <div className={`mt-auto grid gap-3 ${isCollapsed ? "justify-items-center" : ""}`}>
          <button
            type="button"
            className={`inline-flex min-h-12 items-center justify-center gap-2 bg-primary text-[0.82rem] font-extrabold uppercase tracking-[0.08em] text-white shadow-cta-soft transition hover:-translate-y-0.5 hover:bg-primary-container ${
              isCollapsed ? "h-14 w-14 rounded-[18px] p-0" : "w-full rounded-md px-4"
            } ${activeNav === "new-group" ? "ring-2 ring-primary/20 ring-offset-2 ring-offset-transparent" : ""}`}
            onClick={onOpenNewGroup}
            title={isCollapsed ? "Add New Group" : undefined}
            aria-label="Add New Group"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
            {!isCollapsed ? <span>Add New Group</span> : null}
          </button>
        </div>

        <div className={`mt-4 border-t border-surface-container-high/70 pt-3 ${isCollapsed ? "px-0" : ""}`}>
          <button
            type="button"
            className={`group flex items-center gap-3 rounded-[1rem] transition ${
              isCollapsed ? "h-14 w-14 justify-center p-0" : "w-full px-2.5 py-2.5 text-left hover:bg-surface-container-lowest/75"
            } ${
              activeNav === sidebarAccountItem.id
                ? "bg-surface-container-lowest/85 text-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
            onClick={() => onNavigate(sidebarAccountItem.id)}
            title={isCollapsed ? sidebarAccountItem.label : undefined}
            aria-label="Open Profile"
          >
            <div className="h-10 w-10 overflow-hidden rounded-full bg-surface-container-high ring-1 ring-slate-200/80">
              <img src={operatorAvatar} alt="Operator Admin" className="h-full w-full object-cover" />
            </div>

            {!isCollapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-[0.92rem] font-semibold leading-tight text-on-surface">
                    Operator Admin
                  </strong>
                  <span className="mt-0.5 block truncate text-[0.72rem] font-medium text-on-surface-variant/75">
                    Full Access
                  </span>
                </div>

                <span className="material-symbols-outlined text-on-surface-variant/35 transition group-hover:text-on-surface-variant/70" aria-hidden="true">
                  chevron_right
                </span>
              </>
            ) : null}
          </button>

          <button
            type="button"
            className={`mt-1 flex items-center gap-3 rounded-[1rem] transition ${
              isCollapsed
                ? "h-14 w-14 justify-center p-0"
                : "w-full px-2.5 py-2.5 text-left text-on-surface-variant hover:bg-surface-container-lowest/65 hover:text-on-surface"
            }`}
            title={isCollapsed ? "Logout" : undefined}
            aria-label="Logout"
            onClick={() => setIsLogoutModalOpen(true)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              logout
            </span>
            {!isCollapsed ? <span className="text-[0.92rem] font-medium">Logout</span> : null}
          </button>
        </div>
      </aside>

      {isLogoutModalOpen ? (
        <SidebarModalPortal>
          <div
            className="serene-modal-overlay fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-4"
            onClick={closeLogoutModal}
            aria-hidden="true"
          >
            <section
              className="serene-modal-shell w-full max-w-md p-5 sm:p-6"
              role="dialog"
              aria-modal="true"
              aria-label="Logout confirmation"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-error-container text-on-error-container">
                <span className="material-symbols-outlined" aria-hidden="true">
                  logout
                </span>
              </div>

              <h3 className="mt-4 font-display text-2xl font-bold tracking-tight text-on-surface">Logout dari sesi?</h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                Kamu akan keluar dari dashboard dan kembali ke halaman login.
              </p>

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="serene-btn-secondary" onClick={closeLogoutModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-error-container px-4 py-2 text-sm font-semibold text-on-error-container transition hover:brightness-95"
                  onClick={handleConfirmLogout}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    logout
                  </span>
                  Logout
                </button>
              </div>
            </section>
          </div>
        </SidebarModalPortal>
      ) : null}
    </>
  );
}
