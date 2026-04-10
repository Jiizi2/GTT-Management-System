import { createPortal } from "react-dom";
import { useEffect, type ReactNode } from "react";
import type { NavId } from "../shared/app-domain";

type QuickAction = {
  id: NavId;
  label: string;
  description: string;
  icon: string;
};

const quickActions: QuickAction[] = [
  {
    id: "new-group",
    label: "Tambah Group",
    description: "Buat group baru dan isi itinerary dalam satu alur.",
    icon: "add_circle",
  },
  {
    id: "invoice",
    label: "Invoice",
    description: "Halaman invoice masih disiapkan.",
    icon: "request_quote",
  },
  {
    id: "raudhah-reminder",
    label: "Raudhah Reminder",
    description: "Buka daftar reminder Raudhah dan template copy cepat.",
    icon: "notifications_active",
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
  open,
  onClose,
  onSelectAction,
}: {
  activeNav: NavId;
  open: boolean;
  onClose: () => void;
  onSelectAction: (navId: NavId) => void;
}) {
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
        className="serene-modal-overlay z-[100] flex items-end justify-center px-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-[2px]"
        onClick={onClose}
      >
        <section
          className="flex w-full max-w-md flex-col overflow-hidden rounded-t-[2rem] border border-outline-variant/70 bg-surface-container-lowest shadow-float"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-quick-actions-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="px-5 pt-4">
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-surface-container-high" />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary/80">
                  Quick Actions
                </p>
                <h2 id="mobile-quick-actions-title" className="mt-1 text-2xl font-bold tracking-tight text-on-surface">
                  Choose an action
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                  Buka flow yang sering dipakai tanpa memenuhi bottom bar.
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

          <div className="space-y-3 overflow-y-auto px-5 pb-5 pt-4">
            {quickActions.map((action) => {
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
