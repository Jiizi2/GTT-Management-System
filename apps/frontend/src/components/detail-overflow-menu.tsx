import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";

interface DetailOverflowMenuProps {
  children: ReactNode;
}

export function DetailOverflowMenu({ children }: DetailOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  // Keep actions above cards and outside any clipping or header stacking context.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!triggerRef.current || !menuRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const padding = 8;
      const gap = 8;
      const width = Math.min(192, window.innerWidth - padding * 2);
      const below = Math.max(0, window.innerHeight - rect.bottom - gap - padding);
      const above = Math.max(0, rect.top - gap - padding);
      const height = menuRef.current.scrollHeight;
      const openBelow = below >= height || below >= above;
      const maxHeight = openBelow ? below : above;

      setMenuStyle({
        width,
        left: Math.max(padding, Math.min(rect.right - width, window.innerWidth - width - padding)),
        top: openBelow ? rect.bottom + gap : Math.max(padding, rect.top - gap - Math.min(height, maxHeight)),
        maxHeight,
      });
    };

    updatePosition();
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onBlur={(event) => {
        const target = event.relatedTarget as Node | null;
        if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-haspopup="true"
        aria-label="More actions"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="material-symbols-outlined text-lg" aria-hidden="true">
          more_vert
        </span>
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              style={menuStyle}
              role="group"
              aria-label="More actions"
              className="fixed z-[100] overflow-y-auto rounded-2xl border border-outline-variant/45 bg-surface-container-lowest p-1.5 shadow-ambient"
              onClick={() => {
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
