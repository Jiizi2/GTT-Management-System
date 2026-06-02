import { mobileItems } from "../shared/app-domain";
import type { NavId } from "../shared/app-domain";

export function MobileNav({
  activeNav,
  isActionsOpen,
  onNavigate,
  onToggleActions,
}: {
  activeNav: NavId;
  isActionsOpen: boolean;
  onNavigate: (navId: NavId) => void;
  onToggleActions: () => void;
}) {
  const isQuickActionActive =
    isActionsOpen ||
    activeNav === "new-group" ||
    activeNav === "agreement-inbox" ||
    activeNav === "invoice" ||
    activeNav === "raudhah-reminder" ||
    activeNav === "master-data" ||
    activeNav === "user-management";

  const renderNavItem = (item: (typeof mobileItems)[number]) => {
    const isActive = activeNav === item.id;
    const iconClassName = isActive
      ? "text-primary [font-variation-settings:'FILL'_1,'wght'_500,'GRAD'_0,'opsz'_24]"
      : "text-on-surface-variant [font-variation-settings:'FILL'_0,'wght'_400,'GRAD'_0,'opsz'_24]";

    return (
      <button
        key={item.id}
        type="button"
        className="flex min-w-0 flex-col items-center justify-end gap-0.5 rounded-xl px-1.5 py-1 text-center transition active:scale-[0.98]"
        onClick={() => onNavigate(item.id)}
        aria-current={isActive ? "page" : undefined}
        aria-label={item.label}
      >
        <span
          className={`material-symbols-outlined text-[1.32rem] leading-none transition ${iconClassName}`}
          aria-hidden="true"
        >
          {item.icon}
        </span>
        <span
          className={`min-h-[0.7rem] text-[0.61rem] font-semibold leading-none transition ${
            isActive ? "text-primary opacity-100" : "text-on-surface-variant opacity-0"
          }`}
          aria-hidden={isActive ? undefined : "true"}
        >
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[calc(10px+env(safe-area-inset-bottom,0px))] pt-2 lg:hidden"
      aria-label="Mobile navigation"
    >
      <div className="mx-auto max-w-md">
        <div className="grid grid-cols-5 items-end rounded-[1.7rem] bg-surface-container-lowest/95 px-3 pb-2 pt-3 shadow-ambient backdrop-blur-serene">
          {mobileItems.slice(0, 2).map(renderNavItem)}

          <button
            type="button"
            className="flex min-w-0 flex-col items-center justify-end gap-0.5 rounded-xl px-1.5 py-1 text-center transition active:scale-[0.98]"
            onClick={onToggleActions}
            aria-label={isActionsOpen ? "Close quick actions" : "Open quick actions"}
            aria-haspopup="dialog"
            aria-expanded={isActionsOpen}
          >
            <span
              className={`material-symbols-outlined text-[1.32rem] leading-none transition ${
                isQuickActionActive
                  ? "text-primary [font-variation-settings:'FILL'_1,'wght'_500,'GRAD'_0,'opsz'_24]"
                  : "text-on-surface-variant [font-variation-settings:'FILL'_0,'wght'_400,'GRAD'_0,'opsz'_24]"
              }`}
              aria-hidden="true"
            >
              apps
            </span>
            <span
              className={`min-h-[0.7rem] text-[0.61rem] font-semibold leading-none transition ${
                isQuickActionActive ? "text-primary opacity-100" : "text-on-surface-variant opacity-0"
              }`}
              aria-hidden={isQuickActionActive ? undefined : "true"}
            >
              Tools
            </span>
          </button>

          {mobileItems.slice(2).map(renderNavItem)}
        </div>
      </div>
    </nav>
  );
}
