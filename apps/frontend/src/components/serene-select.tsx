import { createPortal } from "react-dom";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type SelectOption = {
  value: string;
  label: ReactNode;
  disabled: boolean;
};

type SereneSelectProps = {
  className?: string;
  value: string;
  onChange?: (event: { target: { value: string } }) => void;
  children: ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
  showCaret?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

function getNextEnabledIndex(options: SelectOption[], startIndex: number, direction: 1 | -1): number {
  if (options.length === 0) {
    return -1;
  }

  let index = startIndex;
  for (let attempt = 0; attempt < options.length; attempt += 1) {
    index = (index + direction + options.length) % options.length;
    if (!options[index].disabled) {
      return index;
    }
  }

  return -1;
}

function parseSelectOptions(children: ReactNode): SelectOption[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement(child) || child.type !== "option") {
      return [];
    }

    const childProps = child.props as {
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    };
    const rawValue = childProps.value ?? childProps.children;
    if (rawValue === undefined || rawValue === null) {
      return [];
    }

    return [
      {
        value: String(rawValue),
        label: childProps.children ?? String(rawValue),
        disabled: Boolean(childProps.disabled),
      },
    ];
  });
}

function computeDropdownStyle(triggerElement: HTMLElement, optionCount: number): CSSProperties {
  const rect = triggerElement.getBoundingClientRect();
  const viewportPadding = 8;
  const gap = 6;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const preferredWidth = Math.max(rect.width, 176);
  const width = Math.min(preferredWidth, viewportWidth - viewportPadding * 2);
  const maxLeft = Math.max(viewportPadding, viewportWidth - width - viewportPadding);
  const left = Math.min(Math.max(viewportPadding, rect.left), maxLeft);

  const estimatedHeight = Math.min(320, Math.max(168, optionCount * 38 + 10));
  const availableBelow = Math.max(0, viewportHeight - rect.bottom - viewportPadding - gap);
  const availableAbove = Math.max(0, rect.top - viewportPadding - gap);
  const openBelow = availableBelow >= estimatedHeight || availableBelow >= availableAbove;
  const maxHeight = Math.max(128, Math.min(estimatedHeight, openBelow ? availableBelow : availableAbove));
  const top = openBelow ? rect.bottom + gap : Math.max(viewportPadding, rect.top - gap - maxHeight);

  return {
    position: "fixed",
    top,
    left,
    width,
    maxHeight,
  };
}

export function SereneSelect({
  className = "serene-select",
  value,
  onChange,
  children,
  disabled = false,
  id,
  name,
  showCaret = true,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: SereneSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const options = useMemo(() => parseSelectOptions(children), [children]);
  const selectedValue = value ?? "";
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const firstEnabledIndex = options.findIndex((option) => !option.disabled);

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);

  const selectedLabel = options[selectedIndex]?.label ?? options[firstEnabledIndex]?.label ?? selectedValue;

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    setMenuStyle(computeDropdownStyle(triggerRef.current, options.length));
  }, [options.length]);

  const openMenu = useCallback(() => {
    if (disabled || options.length === 0) {
      return;
    }

    setIsOpen(true);
    if (selectedIndex >= 0 && !options[selectedIndex].disabled) {
      setHighlightedIndex(selectedIndex);
      return;
    }

    setHighlightedIndex(firstEnabledIndex);
  }, [disabled, firstEnabledIndex, options, selectedIndex]);

  const commitValue = useCallback(
    (nextValue: string) => {
      if (nextValue !== selectedValue) {
        onChange?.({ target: { value: nextValue } });
      }

      closeMenu();
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    },
    [closeMenu, onChange, selectedValue],
  );

  useEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return undefined;
    }

    updateMenuPosition();
    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [closeMenu, isOpen]);

  return (
    <div ref={rootRef}>
      {name ? <input type="hidden" name={name} value={selectedValue} /> : null}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`relative ${className}`.trim()}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onClick={() => {
          if (isOpen) {
            closeMenu();
            return;
          }

          openMenu();
        }}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            closeMenu();
            return;
          }

          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (!isOpen) {
              openMenu();
              return;
            }

            if (highlightedIndex >= 0) {
              commitValue(options[highlightedIndex].value);
            }
            return;
          }

          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!isOpen) {
              openMenu();
              return;
            }

            const direction: 1 | -1 = event.key === "ArrowDown" ? 1 : -1;
            const baseIndex = highlightedIndex >= 0 ? highlightedIndex : selectedIndex;
            const nextIndex = getNextEnabledIndex(options, baseIndex, direction);
            setHighlightedIndex(nextIndex);
          }
        }}
      >
        <span className="block truncate text-left">{selectedLabel}</span>
        {showCaret ? (
          <span
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center material-symbols-outlined text-base leading-none text-on-surface-variant"
            aria-hidden="true"
          >
            expand_more
          </span>
        ) : null}
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="z-[260] overflow-auto rounded-2xl bg-surface-container-lowest p-1.5 shadow-float backdrop-blur-serene"
              role="listbox"
              style={menuStyle}
              aria-label={ariaLabel}
              aria-labelledby={ariaLabelledBy}
            >
              {options.map((option, index) => {
                const isSelected = option.value === selectedValue;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    key={`${option.value}-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                      option.disabled
                        ? "cursor-not-allowed text-slate-400"
                        : isSelected
                          ? "bg-primary-fixed text-on-primary-fixed-variant"
                          : isHighlighted
                            ? "bg-surface-container-high text-on-surface"
                            : "text-on-surface hover:bg-surface-container-low hover:text-on-surface"
                    }`}
                    onMouseEnter={() => {
                      if (option.disabled) {
                        return;
                      }

                      setHighlightedIndex(index);
                    }}
                    onClick={() => {
                      if (option.disabled) {
                        return;
                      }

                      commitValue(option.value);
                    }}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? (
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        check
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
