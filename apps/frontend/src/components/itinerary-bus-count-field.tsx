import { useEffect, useState } from "react";

type ItineraryBusCountFieldProps = {
  id: string;
  busCount: number;
  onChange: (busCount: number) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function ItineraryBusCountField({
  id,
  busCount,
  onChange,
  disabled = false,
  compact = false,
}: ItineraryBusCountFieldProps) {
  const [countDraft, setCountDraft] = useState(String(busCount > 0 ? busCount : 1));
  const requiresBus = busCount > 0;

  useEffect(() => {
    setCountDraft(String(busCount > 0 ? busCount : 1));
  }, [busCount]);

  const handleCountInput = (value: string) => {
    setCountDraft(value);
    if (!value.trim()) {
      return;
    }

    const nextCount = Number(value);
    if (Number.isSafeInteger(nextCount) && nextCount > 0) {
      onChange(nextCount);
    }
  };

  const normalizeCountDraft = () => {
    const parsedCount = Number(countDraft);
    if (!Number.isSafeInteger(parsedCount) || parsedCount < 1) {
      setCountDraft(String(busCount > 0 ? busCount : 1));
    }
  };

  return (
    <fieldset
      className={
        compact
          ? "md:col-span-2 border-t border-outline-variant/30 pt-2"
          : "md:col-span-2 rounded-xl border border-outline-variant/40 bg-surface-container-low p-3"
      }
    >
      <legend className="sr-only">Bus untuk trip ini</legend>
      <div className={`flex flex-wrap items-center gap-3 ${compact ? "justify-start sm:gap-5" : "justify-between"}`}>
        <label
          htmlFor={`${id}-required`}
          className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-3 ${compact ? "" : "flex-1"}`}
        >
          <input
            id={`${id}-required`}
            className="h-4 w-4 shrink-0 rounded border-outline-variant/45 text-primary accent-primary focus:ring-primary/25"
            type="checkbox"
            checked={requiresBus}
            onChange={(event) => onChange(event.currentTarget.checked ? 1 : 0)}
            disabled={disabled}
          />
          <span className="text-sm font-semibold text-on-surface">Trip ini membutuhkan bus</span>
        </label>
        {!requiresBus ? (
          <span className="hidden text-xs text-on-surface-variant sm:inline">Tidak perlu bus</span>
        ) : null}
      </div>
      {requiresBus ? (
        <label
          htmlFor={`${id}-count`}
          className={
            compact
              ? "mt-2 flex flex-wrap items-center gap-3 text-sm font-medium text-on-surface"
              : "mt-3 grid max-w-xs gap-1.5 text-sm font-medium text-on-surface"
          }
        >
          <span>Jumlah bus untuk trip ini</span>
          <input
            id={`${id}-count`}
            className={`h-11 rounded-lg border border-outline-variant/45 bg-surface-container-lowest px-3 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 ${compact ? "w-20" : "w-full"}`}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={countDraft}
            onChange={(event) => handleCountInput(event.currentTarget.value)}
            onBlur={normalizeCountDraft}
            disabled={disabled}
          />
        </label>
      ) : null}
    </fieldset>
  );
}
