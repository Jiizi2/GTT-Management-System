import { memo, useState } from "react";
import { formatNumberInput, parseNumberInput } from "../helpers/invoice-page-shared";

/**
 * Text input for a money amount, in `id-ID` notation (`.` groups, `,` decimals).
 *
 * The reason this is a component rather than an inline `value`/`onChange` pair:
 * a fully controlled `value={formatNumberInput(props.value)}` cannot accept a
 * decimal. Typing `468,` parses to `468`, which re-renders as `"468"` and eats
 * the separator the moment it is typed, so the user never reaches the decimals.
 *
 * While the field is focused we keep the raw keystrokes in `draft` and show
 * those instead, so half-typed values like `468,` survive. The parsed number is
 * still reported on every keystroke, so derived totals stay live. On blur the
 * draft is dropped and the canonical formatting takes over.
 */
export const MoneyInput = memo(function MoneyInput({
  value,
  onChange,
  className,
  ariaLabel,
  id,
  allowNegative = false,
}: {
  value: number;
  onChange: (nextValue: number) => void;
  className?: string;
  ariaLabel?: string;
  id?: string;
  allowNegative?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      id={id}
      type="text"
      // "decimal" rather than "numeric": the numeric keypad on mobile has no
      // separator key, which would block decimals on phones just as surely.
      inputMode="decimal"
      className={className}
      aria-label={ariaLabel}
      value={draft ?? formatNumberInput(value || 0)}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        const parsed = parseNumberInput(raw);
        onChange(allowNegative ? parsed : Math.max(0, parsed));
      }}
      onBlur={() => setDraft(null)}
    />
  );
});
