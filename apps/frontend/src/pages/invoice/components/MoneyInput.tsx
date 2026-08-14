import { memo, useLayoutEffect, useRef, useState } from "react";
import { formatNumberInput, parseNumberInput } from "../helpers/invoice-page-shared";

/** Group integer digits with id-ID thousand separators ("."). */
function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Live id-ID money formatting for the value the user is typing: thousand
 * separators are added to the integer part on every keystroke, while a
 * half-typed decimal survives (`468,` and `468,75` both round-trip). The
 * grouping dots are always re-derived, so the field cannot accumulate stray
 * separators, and the decimal comma is preserved instead of being eaten.
 */
function formatMoneyDraft(raw: string): string {
  // The minus is kept regardless of `allowNegative`: a disallowed negative stays
  // visible while the caller's `Math.max(0, …)` clamps the reported value to 0,
  // matching the pre-formatting behaviour instead of silently becoming positive.
  const negative = raw.trimStart().startsWith("-");
  const cleaned = raw.replace(/[^\d,]/g, "");
  const commaIndex = cleaned.indexOf(",");
  const intDigits = (commaIndex === -1 ? cleaned : cleaned.slice(0, commaIndex))
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "");
  const decimalDigits = commaIndex === -1 ? "" : cleaned.slice(commaIndex + 1).replace(/\D/g, "").slice(0, 2);
  const grouped = groupThousands(intDigits);
  const body = commaIndex === -1 ? grouped : `${grouped},${decimalDigits}`;
  if (!body) {
    return negative ? "-" : "";
  }
  return negative ? `-${body}` : body;
}

/** Count the chars whose position the caret should track across a reformat (grouping dots excluded). */
function countSignificant(text: string): number {
  const matched = text.match(/[\d,-]/g);
  return matched ? matched.length : 0;
}

/** Caret index in `formatted` sitting after `significant` significant chars, so grouping dots do not shift it. */
function caretForSignificant(formatted: string, significant: number): number {
  if (significant <= 0) {
    return formatted.startsWith("-") ? 1 : 0;
  }
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/[\d,-]/.test(formatted[index])) {
      seen += 1;
      if (seen === significant) {
        return index + 1;
      }
    }
  }
  return formatted.length;
}

/**
 * Text input for a money amount, in `id-ID` notation (`.` groups, `,` decimals).
 *
 * The field formats as the user types: `1000000` reads back as `1.000.000`
 * immediately, not only after blur. While focused the keystrokes are held in
 * `draft` (formatted), which is what lets a half-typed value like `468,` keep
 * its separator instead of being re-rendered as `468`. The parsed number is
 * still reported on every keystroke so derived totals stay live, and the caret
 * is restored by significant-character count so inserted grouping dots do not
 * make it jump. On blur the draft is dropped and the canonical formatting of
 * the stored value takes over.
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
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);

  // Restore the caret after a reformat re-renders the value under it.
  useLayoutEffect(() => {
    if (caretRef.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(caretRef.current, caretRef.current);
      caretRef.current = null;
    }
  });

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      // "decimal" rather than "numeric": the numeric keypad on mobile has no
      // separator key, which would block decimals on phones just as surely.
      inputMode="decimal"
      className={className}
      aria-label={ariaLabel}
      value={draft ?? formatNumberInput(value || 0)}
      onChange={(event) => {
        const rawValue = event.target.value;
        const selectionStart = event.target.selectionStart ?? rawValue.length;
        const significantBeforeCaret = countSignificant(rawValue.slice(0, selectionStart));
        const formatted = formatMoneyDraft(rawValue);
        caretRef.current = caretForSignificant(formatted, significantBeforeCaret);
        setDraft(formatted);
        const parsed = parseNumberInput(formatted);
        onChange(allowNegative ? parsed : Math.max(0, parsed));
      }}
      onBlur={() => setDraft(null)}
    />
  );
});
