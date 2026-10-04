import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFloatingPopoverStyle } from "../../components/date-time-pickers";
import { monthLabel } from "../data/departure-calendar";

const months = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function DepartureMonthPicker({
  value,
  currentMonth,
  onChange,
}: {
  value: string;
  currentMonth: string;
  onChange: (month: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(value.slice(0, 4)));
  const [focusedMonth, setFocusedMonth] = useState(() => Number(value.slice(5)) - 1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const initialFocus = useRef(focusedMonth);
  const id = useId();
  const style = useFloatingPopoverStyle(open, rootRef, 296, 352);
  const positioned = style !== null;

  useEffect(() => {
    if (open && positioned) monthRefs.current[initialFocus.current]?.focus();
  }, [open, positioned]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      const target = event.target as Node | null;
      if (target && !rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div ref={rootRef} className="agent-month-picker-wrap">
      <button
        ref={triggerRef}
        type="button"
        className="agent-month-picker"
        aria-label="Pilih bulan keberangkatan"
        aria-describedby={`${id}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          setYear(Number(value.slice(0, 4)));
          initialFocus.current = Number(value.slice(5)) - 1;
          setFocusedMonth(initialFocus.current);
          setOpen(true);
        }}
      >
        <span id={`${id}-value`}>{monthLabel(value)}</span>
        <Icon icon="expand_more" />
      </button>
      {open && style
        ? createPortal(
            <div
              ref={popupRef}
              id={id}
              role="dialog"
              aria-label="Pilih bulan dan tahun keberangkatan"
              className="agent-month-popover"
              style={style}
            >
              <div className="agent-month-popover-header">
                <button
                  type="button"
                  aria-label="Tahun sebelumnya"
                  disabled={year === 1000}
                  onClick={() => setYear(year - 1)}
                >
                  <Icon icon="chevron_left" />
                </button>
                <strong aria-live="polite">{year}</strong>
                <button
                  type="button"
                  aria-label="Tahun berikutnya"
                  disabled={year === 9999}
                  onClick={() => setYear(year + 1)}
                >
                  <Icon icon="chevron_right" />
                </button>
              </div>
              <div className="agent-month-options" role="group" aria-label="Daftar bulan">
                {months.map((label, index) => {
                  const key = `${year}-${String(index + 1).padStart(2, "0")}`;
                  return (
                    <button
                      key={label}
                      ref={(element) => {
                        monthRefs.current[index] = element;
                      }}
                      type="button"
                      aria-label={monthLabel(key)}
                      aria-pressed={value === key}
                      aria-current={currentMonth === key ? "date" : undefined}
                      tabIndex={focusedMonth === index ? 0 : -1}
                      onFocus={() => setFocusedMonth(index)}
                      onClick={() => select(key)}
                      onKeyDown={(event) => {
                        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[event.key];
                        if (step === undefined && event.key !== "Home" && event.key !== "End") return;
                        event.preventDefault();
                        const next =
                          event.key === "Home" ? 0 : event.key === "End" ? 11 : (index + (step ?? 0) + 12) % 12;
                        monthRefs.current[next]?.focus();
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="agent-month-popover-footer">
                <button type="button" onClick={() => select(currentMonth)}>
                  Bulan ini
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function Icon({ icon }: { icon: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {icon}
    </span>
  );
}
