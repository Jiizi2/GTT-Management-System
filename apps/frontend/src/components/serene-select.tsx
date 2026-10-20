import { createPortal } from "react-dom";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

type SelectOption = {
  value: string;
  label: ReactNode;
  searchText: string;
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
  menuMaxHeight?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: "true" | "false";
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

function getOptionText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child): string => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }
      return isValidElement<{ children?: ReactNode }>(child) ? getOptionText(child.props.children) : "";
    })
    .join("");
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
        searchText: getOptionText(childProps.children ?? String(rawValue)).toLocaleLowerCase(),
        disabled: Boolean(childProps.disabled),
      },
    ];
  });
}

function computeDropdownStyle(
  triggerElement: HTMLElement,
  optionCount: number,
  menuMaxHeight: number,
  searchHeight = 0,
): CSSProperties {
  const rect = triggerElement.getBoundingClientRect();
  const viewportPadding = 8;
  const gap = 6;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const preferredWidth = Math.max(rect.width, 176);
  const width = Math.min(preferredWidth, viewportWidth - viewportPadding * 2);
  const maxLeft = Math.max(viewportPadding, viewportWidth - width - viewportPadding);
  const left = Math.min(Math.max(viewportPadding, rect.left), maxLeft);

  const estimatedHeight = Math.min(menuMaxHeight, Math.max(168, optionCount * 38 + 10 + searchHeight));
  const availableBelow = Math.max(0, viewportHeight - rect.bottom - viewportPadding - gap);
  const availableAbove = Math.max(0, rect.top - viewportPadding - gap);
  const openBelow = availableBelow >= estimatedHeight || availableBelow >= availableAbove;
  const maxHeight = Math.max(128, Math.min(estimatedHeight, openBelow ? availableBelow : availableAbove));

  if (openBelow) {
    return {
      position: "fixed",
      top: rect.bottom + gap,
      left,
      width,
      maxHeight,
    };
  }

  return {
    position: "fixed",
    bottom: viewportHeight - rect.top + gap,
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
  menuMaxHeight = 320,
  searchable = false,
  searchPlaceholder = "Cari pilihan...",
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: SereneSelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();

  const options = useMemo(() => parseSelectOptions(children), [children]);
  const selectedValue = value ?? "";
  const selectedIndex = options.findIndex((option) => option.value === selectedValue);
  const firstEnabledIndex = options.findIndex((option) => !option.disabled);

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return searchable && query ? options.filter((option) => option.searchText.includes(query)) : options;
  }, [options, searchQuery, searchable]);
  const activeIndex =
    filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled
      ? highlightedIndex
      : filteredOptions.findIndex((option) => !option.disabled);
  const isMenuVisible = isOpen && menuStyle !== null;

  const selectedLabel = options[selectedIndex]?.label ?? options[firstEnabledIndex]?.label ?? selectedValue;

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
    setSearchQuery("");
  }, []);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) {
      return;
    }

    setMenuStyle(computeDropdownStyle(triggerRef.current, options.length, menuMaxHeight, searchable ? 54 : 0));
  }, [menuMaxHeight, options.length, searchable]);

  const openMenu = useCallback(() => {
    if (disabled || options.length === 0) {
      return;
    }

    setIsOpen(true);
    setSearchQuery("");
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

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
      }
      closeMenu();
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeIndex >= 0) {
        commitValue(filteredOptions[activeIndex].value);
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex(getNextEnabledIndex(filteredOptions, activeIndex, event.key === "ArrowDown" ? 1 : -1));
    }
  };

  useEffect(() => {
    if (isMenuVisible && searchable) {
      searchRef.current?.focus({ preventScroll: true });
    }
  }, [isMenuVisible, searchable]);

  useEffect(() => {
    if (isMenuVisible) {
      document.getElementById(`${listboxId}-option-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
    }
  }, [activeIndex, isMenuVisible, listboxId, searchQuery]);

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
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
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

            if (activeIndex >= 0) {
              commitValue(filteredOptions[activeIndex].value);
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
            const nextIndex = getNextEnabledIndex(filteredOptions, activeIndex, direction);
            setHighlightedIndex(nextIndex);
          }
        }}
      >
        <span className="block truncate text-left">{selectedLabel}</span>
        {showCaret ? (
          <span
            className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center material-symbols-outlined text-base leading-none text-on-surface-variant"
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
              className="z-[260] flex flex-col overflow-hidden rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-1.5 shadow-float backdrop-blur-serene"
              style={menuStyle}
              onKeyDown={searchable ? handleSearchKeyDown : undefined}
            >
              {searchable ? (
                <div className="shrink-0 px-1.5 pb-1.5 pt-1">
                  <input
                    ref={searchRef}
                    type="text"
                    role="combobox"
                    className="serene-input h-10 w-full rounded-xl px-3 text-sm"
                    aria-label={searchPlaceholder}
                    aria-controls={listboxId}
                    aria-expanded="true"
                    aria-autocomplete="list"
                    aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
                    autoComplete="off"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setHighlightedIndex(-1);
                    }}
                  />
                </div>
              ) : null}
              <div
                id={listboxId}
                role="listbox"
                className="min-h-0 overflow-auto"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy}
              >
                {filteredOptions.map((option, index) => {
                  const isSelected = option.value === selectedValue;
                  const isHighlighted = index === activeIndex;

                  return (
                    <button
                      key={`${option.value}-${index}`}
                      type="button"
                      role="option"
                      id={`${listboxId}-option-${index}`}
                      tabIndex={searchable ? -1 : undefined}
                      aria-selected={isSelected}
                      disabled={option.disabled}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 sm:py-2 text-left text-sm transition ${
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
                      onMouseDown={searchable ? (event) => event.preventDefault() : undefined}
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
              </div>
              {filteredOptions.length === 0 ? (
                <p role="status" className="px-3 py-4 text-sm text-on-surface-variant">
                  Tidak ada pilihan yang cocok.
                </p>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
