import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    if (!isOpen) return undefined;

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

  const copy = (format: WhatsappCopyFormat) => {
    setIsOpen(false);
    void onCopy(format);
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsOpen(false);
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

      {isOpen ? (
        <div
          className="absolute right-0 top-full z-30 mt-1.5 min-w-52 rounded-2xl border border-outline-variant/45 bg-surface-container-lowest p-1.5 shadow-ambient"
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
        </div>
      ) : null}
    </div>
  );
}
