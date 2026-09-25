import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

interface DetailOverflowMenuProps {
  children: ReactNode;
}

export function DetailOverflowMenu({ children }: DetailOverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
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
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label="More actions"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="material-symbols-outlined text-lg" aria-hidden="true">
          more_vert
        </span>
      </button>

      <div
        id={menuId}
        role="group"
        aria-label="More actions"
        hidden={!isOpen}
        className="absolute right-0 top-full z-30 mt-2 min-w-48 rounded-2xl border border-outline-variant/45 bg-surface-container-lowest p-1.5 shadow-ambient"
        onClick={() => setIsOpen(false)}
      >
        {children}
      </div>
    </div>
  );
}
