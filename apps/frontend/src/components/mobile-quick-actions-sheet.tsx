import { createPortal } from "react-dom";
import { useEffect, type ReactNode } from "react";
import type { NavId } from "../shared/app-domain";
import type { SessionAccessTier } from "../shared/app-domain";
import { useModalFocusTrap } from "./use-modal-focus-trap";

type QuickAction = {
  id: NavId;
  label: string;
  description: string;
  icon: string;
  requiresSuperAdmin?: boolean;
};

const quickActions: QuickAction[] = [
  {
    id: "new-group",
    label: "Tambah Group",
    description: "Buat group baru dan isi itinerary dalam satu alur.",
    icon: "add_circle",
  },
  {
    id: "agreement-inbox",
    label: "Agreement Inbox",
    description: "Input agreement hotel sebelum group number tersedia.",
    icon: "inventory_2",
  },
  {
    id: "invoice",
    label: "Invoice List",
    description: "Kelola daftar invoice dan status pembayarannya.",
    icon: "request_quote",
  },
  {
    id: "profile",
    label: "Profile",
    description: "Pengaturan akun dan preferensi operator.",
    icon: "account_circle",
  },
  {
    id: "master-data",
    label: "Master Data",
    description: "Atur referensi data utama untuk seluruh modul.",
    icon: "dataset",
    requiresSuperAdmin: true,
  },
  {
    id: "user-management",
    label: "User Management",
    description: "Kelola akun dan role pengguna dashboard.",
    icon: "admin_panel_settings",
    requiresSuperAdmin: true,
  },
];

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

export function MobileQuickActionsSheet({
  activeNav,
  sessionAccessTier,
  open,
  onClose,
  onSelectAction,
}: {
  activeNav: NavId;
  sessionAccessTier: SessionAccessTier;
  open: boolean;
  onClose: () => void;
  onSelectAction: (navId: NavId) => void;
}) {
  const dialogRef = useModalFocusTrap<HTMLElement>({
    isActive: open,
    onClose,
  });
  const visibleQuickActions = quickActions.filter(
    (action) => !action.requiresSuperAdmin || sessionAccessTier === "super-admin",
  );

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return (
    <ModalPortal>
      <div
        className="serene-modal-overlay z-[100] flex items-end justify-center px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3"
        onClick={onClose}
        role="presentation"
      >
        <section
          ref={dialogRef}
          className="flex max-h-[calc(100dvh-0.75rem)] w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-outline-variant/70 bg-surface-container-lowest shadow-float"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-quick-actions-title"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-5 pt-4">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-surface-container-high" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary/80">Tools</p>
                <h2 id="mobile-quick-actions-title" className="mt-1 text-2xl font-bold tracking-tight text-on-surface">
                  Pilih Halaman Tools
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                  Akses cepat ke menu operasional dari tombol tengah.
                </p>
              </div>

              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant transition hover:border-primary hover:text-primary"
                onClick={onClose}
                aria-label="Close quick actions"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  close
                </span>
              </button>
            </div>
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto px-5 pb-5 pt-4">
            {visibleQuickActions.map((action) => {
              const isCurrent = activeNav === action.id;

              return (
                <button
                  key={action.id}
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                    isCurrent
                      ? "border-primary/20 bg-primary-fixed/70 shadow-ambient"
                      : "border-outline-variant/55 bg-surface-container-lowest hover:border-primary/20 hover:bg-surface-container-low"
                  }`}
                  onClick={() => onSelectAction(action.id)}
                >
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-fixed/85 text-primary">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      {action.icon}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className="flex items-center gap-2">
                      <span className="block text-sm font-bold text-on-surface">{action.label}</span>
                      {action.requiresSuperAdmin ? (
                        <span className="inline-flex rounded-lg border border-primary/20 bg-primary-fixed px-2 py-0.5 text-[10px] font-bold uppercase leading-none tracking-[0.16em] text-primary">
                          Admin
                        </span>
                      ) : null}
                      {isCurrent ? (
                        <span className="inline-flex rounded-lg border border-primary/20 bg-primary-fixed px-2 py-0.5 text-[10px] font-bold uppercase leading-none tracking-[0.16em] text-primary">
                          Current
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                      {action.description}
                    </span>
                  </span>

                  <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
                    chevron_right
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}
