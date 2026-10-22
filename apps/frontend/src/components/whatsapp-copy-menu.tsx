import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";

export type WhatsappCopyFormat = "general" | "muassasah-hijazi";

type WhatsappCopyMenuProps = {
  isCopied: boolean;
  onCopy: (format: WhatsappCopyFormat) => void | Promise<void>;
  className?: string;
};

export function WhatsappCopyMenu({ isCopied, onCopy, className = "" }: WhatsappCopyMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  // Escape header stacking contexts and clipping without losing the trigger anchor.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!triggerRef.current || !menuRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const padding = 8;
      const gap = 6;
      const width = Math.min(208, window.innerWidth - padding * 2);
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
    menuRef.current?.querySelector("button")?.focus({ preventScroll: true });
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

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

  const copy = (format: WhatsappCopyFormat) => {
    setIsOpen(false);
    triggerRef.current?.focus();
    void onCopy(format);
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onBlur={(event) => {
        const target = event.relatedTarget as Node | null;
        if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-transparent px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary ${
          isCopied ? "text-emerald-600 hover:bg-emerald-500/10" : "text-brand-primary hover:bg-brand-primary/5"
        }`}
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label="Copy WhatsApp details"
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          {isCopied ? "check" : "content_copy"}
        </span>
        <span className="sm:hidden">{isCopied ? "Copied" : "Copy WA"}</span>
        <span className="hidden sm:inline">{isCopied ? "Copied" : "Copy WhatsApp"}</span>
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          expand_more
        </span>
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              style={menuStyle}
              className="fixed z-[100] overflow-y-auto rounded-2xl border border-outline-variant/45 bg-surface-container-lowest p-1.5 shadow-ambient"
              role="group"
              aria-label="WhatsApp copy format"
            >
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-on-surface transition hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onClick={() => copy("general")}
              >
                General
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm font-semibold text-on-surface transition hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onClick={() => copy("muassasah-hijazi")}
              >
                Muassasah Hijazi
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
