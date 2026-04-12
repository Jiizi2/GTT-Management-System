import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import { SereneSelect } from "./serene-select";

type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  inputClassName: string;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: "true" | "false";
  ariaDescribedBy?: string;
};

type TimePickerProps = {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  inputClassName: string;
  placeholder?: string;
  disabled?: boolean;
  ariaInvalid?: "true" | "false";
  ariaDescribedBy?: string;
};

const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;
const monthLabels = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const hourOptions = Array.from({ length: 24 }, (_, index) => index.toString().padStart(2, "0"));
const minuteOptions = Array.from({ length: 60 }, (_, index) => index.toString().padStart(2, "0"));
const pickerPopoverClassName =
  "fixed z-[180] w-[18.5rem] max-w-[calc(100vw-1rem)] rounded-2xl border border-outline-variant/70 bg-surface-container-lowest p-3 shadow-float overflow-y-auto";
const pickerActionButtonClassName =
  "inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-xs font-semibold transition";
const pickerSelectClassName = "serene-select-soft";

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const date = Number.parseInt(match[3], 10);
  const resolved = new Date(year, month - 1, date);
  if (resolved.getFullYear() !== year || resolved.getMonth() !== month - 1 || resolved.getDate() !== date) {
    return null;
  }

  return resolved;
}

function formatIsoDate(date: Date): string {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string): string {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return "";
  }

  const day = parsed.getDate().toString().padStart(2, "0");
  const month = (parsed.getMonth() + 1).toString().padStart(2, "0");
  const year = parsed.getFullYear().toString();
  return `${day}/${month}/${year}`;
}

function isSameDate(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function parseIsoTime(value: string): { hour: string; minute: string } | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return null;
  }

  return {
    hour: match[1],
    minute: match[2],
  };
}

function getRoundedNowTime(): { hour: string; minute: string } {
  const now = new Date();
  let hour = now.getHours();
  let minute = Math.round(now.getMinutes() / 5) * 5;
  if (minute >= 60) {
    minute = 0;
    hour = (hour + 1) % 24;
  }

  return {
    hour: hour.toString().padStart(2, "0"),
    minute: minute.toString().padStart(2, "0"),
  };
}

function computePopoverStyle(
  anchorElement: HTMLElement,
  preferredWidth: number,
  estimatedHeight: number,
): CSSProperties {
  const viewportPadding = 8;
  const gap = 8;
  const rect = anchorElement.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const width = Math.min(preferredWidth, Math.max(240, viewportWidth - viewportPadding * 2));
  const maxLeft = Math.max(viewportPadding, viewportWidth - width - viewportPadding);
  const left = Math.min(Math.max(viewportPadding, rect.left), maxLeft);

  const availableBelow = Math.max(0, viewportHeight - rect.bottom - viewportPadding - gap);
  const availableAbove = Math.max(0, rect.top - viewportPadding - gap);
  const openBelow = availableBelow >= estimatedHeight || availableBelow >= availableAbove;
  const maxHeight = Math.max(120, Math.min(estimatedHeight, openBelow ? availableBelow : availableAbove));

  const top = openBelow ? rect.bottom + gap : Math.max(viewportPadding, rect.top - gap - maxHeight);

  return {
    top,
    left,
    width,
    maxHeight,
  };
}

function useFloatingPopoverStyle(
  isOpen: boolean,
  anchorRef: RefObject<HTMLDivElement | null>,
  preferredWidth: number,
  estimatedHeight: number,
): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const updatePosition = useCallback(() => {
    if (!anchorRef.current) {
      return;
    }

    setStyle(computePopoverStyle(anchorRef.current, preferredWidth, estimatedHeight));
  }, [anchorRef, estimatedHeight, preferredWidth]);

  useEffect(() => {
    if (!isOpen) {
      setStyle(null);
      return undefined;
    }

    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, updatePosition]);

  return style;
}

export function DatePickerInput({
  id,
  value,
  onChange,
  inputClassName,
  placeholder = "dd/mm/yyyy",
  disabled = false,
  ariaInvalid = "false",
  ariaDescribedBy,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState<Date>(() => parseIsoDate(value) ?? new Date());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();
  const selectedDate = parseIsoDate(value);
  const today = useMemo(() => new Date(), []);
  const popoverStyle = useFloatingPopoverStyle(isOpen, rootRef, 296, 360);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDayInMonth = new Date(year, month, 1);
    const startOffset = firstDayInMonth.getDay();
    const gridStart = new Date(year, month, 1 - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + index);
      return current;
    });
  }, [viewDate]);

  const openPicker = () => {
    if (disabled) {
      return;
    }

    setViewDate(selectedDate ?? new Date());
    setIsOpen(true);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        className={`${inputClassName} cursor-pointer pr-10`}
        value={selectedDate ? formatDisplayDate(value) : ""}
        onClick={openPicker}
        onFocus={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            openPicker();
          }
        }}
        readOnly
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-readonly="true"
        aria-controls={isOpen ? popoverId : undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        placeholder={placeholder}
      />
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant"
        aria-hidden="true"
      >
        calendar_month
      </span>

      {isOpen && popoverStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              id={popoverId}
              ref={popoverRef}
              className={pickerPopoverClassName}
              style={popoverStyle}
              role="dialog"
              aria-label="Select date"
            >
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                  onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                  aria-label="Previous month"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    chevron_left
                  </span>
                </button>

                <p className="text-sm font-semibold text-on-surface">
                  {monthLabels[viewDate.getMonth()]} {viewDate.getFullYear()}
                </p>

                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface"
                  onClick={() => setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                  aria-label="Next month"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    chevron_right
                  </span>
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-1">
                {dayLabels.map((label) => (
                  <span
                    key={label}
                    className="text-center text-[11px] font-semibold uppercase text-on-surface-variant/75"
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const isCurrentMonth = day.getMonth() === viewDate.getMonth();
                  const isSelected = selectedDate ? isSameDate(day, selectedDate) : false;
                  const isToday = isSameDate(day, today);
                  const dayIso = formatIsoDate(day);

                  return (
                    <button
                      key={dayIso}
                      type="button"
                      className={`inline-flex h-8 items-center justify-center rounded-lg text-sm font-medium transition ${
                        isSelected
                          ? "bg-brand-primary text-brand-neutral"
                          : isCurrentMonth
                            ? "text-on-surface hover:bg-primary-fixed hover:text-primary"
                            : "text-on-surface-variant/35 hover:bg-surface-container-high hover:text-on-surface-variant"
                      } ${isToday && !isSelected ? "ring-1 ring-brand-primary/40" : ""}`}
                      onClick={() => {
                        onChange(dayIso);
                        setIsOpen(false);
                      }}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-outline-variant/70 pt-2">
                <button
                  type="button"
                  className={`${pickerActionButtonClassName} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface`}
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                >
                  Clear
                </button>
                <button
                  type="button"
                  className={`${pickerActionButtonClassName} bg-primary-fixed text-primary hover:bg-primary-fixed/80`}
                  onClick={() => {
                    onChange(formatIsoDate(new Date()));
                    setIsOpen(false);
                  }}
                >
                  Today
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function TimePickerInput({
  id,
  value,
  onChange,
  inputClassName,
  placeholder = "--:--",
  disabled = false,
  ariaInvalid = "false",
  ariaDescribedBy,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftHour, setDraftHour] = useState("00");
  const [draftMinute, setDraftMinute] = useState("00");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();
  const parsedTime = parseIsoTime(value);
  const popoverStyle = useFloatingPopoverStyle(isOpen, rootRef, 272, 280);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const openPicker = () => {
    if (disabled) {
      return;
    }

    const fallbackTime = getRoundedNowTime();
    setDraftHour(parsedTime?.hour ?? fallbackTime.hour);
    setDraftMinute(parsedTime?.minute ?? fallbackTime.minute);
    setIsOpen(true);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        className={`${inputClassName} cursor-pointer pr-10`}
        value={parsedTime ? `${parsedTime.hour}:${parsedTime.minute}` : ""}
        onClick={openPicker}
        onFocus={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " " || event.key === "ArrowDown") {
            event.preventDefault();
            openPicker();
          }
        }}
        readOnly
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-readonly="true"
        aria-controls={isOpen ? popoverId : undefined}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        disabled={disabled}
        placeholder={placeholder}
      />
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant"
        aria-hidden="true"
      >
        schedule
      </span>

      {isOpen && popoverStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              id={popoverId}
              ref={popoverRef}
              className={pickerPopoverClassName}
              style={popoverStyle}
              role="dialog"
              aria-label="Select time"
            >
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant/75">
                  Hour
                  <SereneSelect
                    className={pickerSelectClassName}
                    value={draftHour}
                    onChange={(event) => setDraftHour(event.target.value)}
                  >
                    {hourOptions.map((hourOption) => (
                      <option key={hourOption} value={hourOption}>
                        {hourOption}
                      </option>
                    ))}
                  </SereneSelect>
                </label>

                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant/75">
                  Minute
                  <SereneSelect
                    className={pickerSelectClassName}
                    value={draftMinute}
                    onChange={(event) => setDraftMinute(event.target.value)}
                  >
                    {minuteOptions.map((minuteOption) => (
                      <option key={minuteOption} value={minuteOption}>
                        {minuteOption}
                      </option>
                    ))}
                  </SereneSelect>
                </label>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-outline-variant/70 pt-2">
                <button
                  type="button"
                  className={`${pickerActionButtonClassName} text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface`}
                  onClick={() => {
                    onChange("");
                    setIsOpen(false);
                  }}
                >
                  Clear
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`${pickerActionButtonClassName} text-primary hover:bg-primary-fixed`}
                    onClick={() => {
                      const now = getRoundedNowTime();
                      setDraftHour(now.hour);
                      setDraftMinute(now.minute);
                    }}
                  >
                    Now
                  </button>
                  <button
                    type="button"
                    className={`${pickerActionButtonClassName} bg-primary-fixed text-primary hover:bg-primary-fixed/80`}
                    onClick={() => {
                      onChange(`${draftHour}:${draftMinute}`);
                      setIsOpen(false);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
