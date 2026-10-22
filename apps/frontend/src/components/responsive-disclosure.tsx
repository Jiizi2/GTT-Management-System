import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFloatingPopoverStyle } from "./date-time-pickers";

// Keep the mobile disclosure in flow; float its desktop panel outside clipping parents.
export function ResponsiveDisclosure({
  summary,
  children,
  label,
}: {
  summary: ReactNode;
  children: ReactNode;
  label: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia?.("(min-width: 1280px)").matches ?? false);
  const rootRef = useRef<HTMLDivElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const style = useFloatingPopoverStyle(isOpen && isDesktop, rootRef, 288, 224);
  const positioned = style !== null;

  useEffect(() => {
    if (isOpen && isDesktop && positioned) panelRef.current?.focus({ preventScroll: true });
  }, [isOpen, isDesktop, positioned]);

  useEffect(() => {
    const query = window.matchMedia?.("(min-width: 1280px)");
    if (!query) return;
    const update = () => setIsDesktop(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const panel = (
    <div
      ref={panelRef}
      tabIndex={-1}
      role="group"
      aria-label={label}
      className={`${isDesktop ? "fixed z-[100] overflow-y-auto" : "mt-2"} grid gap-3 rounded-xl border border-outline-variant/35 bg-surface-container-lowest p-3 shadow-float`}
      style={isDesktop ? (style ?? undefined) : undefined}
    >
      {children}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className="min-w-0"
      onKeyDown={(event) => {
        const target = event.target as Node;
        // Calendar portals handle their own Escape without closing this disclosure.
        if (event.key !== "Escape" || (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)))
          return;
        if (panelRef.current?.querySelector('[aria-haspopup="dialog"][aria-expanded="true"]')) return;
        if (detailsRef.current) detailsRef.current.open = false;
        summaryRef.current?.focus();
      }}
    >
      <details ref={detailsRef} className="group relative" onToggle={(event) => setIsOpen(event.currentTarget.open)}>
        <summary
          ref={summaryRef}
          className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden"
        >
          {summary}
        </summary>
        {!isDesktop ? panel : null}
      </details>
      {isDesktop && isOpen && style ? createPortal(panel, document.body) : null}
    </div>
  );
}
