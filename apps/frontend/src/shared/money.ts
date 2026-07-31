/**
 * Money helpers shared by the invoice workspace, list, and PDF export.
 *
 * Mirrors `apps/backend/src/utils/money.ts` — the backend stores every nominal
 * in `DECIMAL(12,2)`, so 2 decimal places is the precision the UI must preserve
 * end to end. Rounding happens at each boundary rather than only at the end, so
 * an invoice that is opened and saved again keeps the same numbers.
 */

export const MONEY_DECIMAL_PLACES = 2;

/**
 * Half a minor unit. Two amounts closer than this are the same amount once they
 * hit `DECIMAL(12,2)`.
 */
export const MONEY_EPSILON = 0.005;

/**
 * Round to 2 decimals. The `toFixed(6)` detour absorbs the binary representation
 * error before the final rounding, so values like `1.005` round the way an
 * accountant expects.
 */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(Number((value * 100).toFixed(6))) / 100;
}

/** `roundMoney` with negatives clamped to zero. */
export function clampMoney(value: number): number {
  return Math.max(0, roundMoney(value));
}

/** True when `value` covers `target` at `DECIMAL(12,2)` precision. */
export function isMoneyAtLeast(value: number, target: number): boolean {
  return value >= target - MONEY_EPSILON;
}

/** Sum that rounds once at the end instead of accumulating per-term error. */
export function sumMoney(values: ReadonlyArray<number>): number {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}

/**
 * Rupiah is quoted without a subunit in practice; USD and SAR are quoted with
 * two. Display precision only — the underlying value keeps its decimals.
 */
export function resolveCurrencyFractionDigits(currency: string): number {
  return currency.trim().toUpperCase() === "IDR" ? 0 : MONEY_DECIMAL_PLACES;
}

/** Grouped number for `currency`, without the currency code prefix. */
export function formatMoneyNumber(value: number, currency: string, locale = "id-ID"): string {
  const fractionDigits = resolveCurrencyFractionDigits(currency);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(clampMoney(value));
}

/** `"SAR 468,75"` / `"IDR 1.980.469"`. */
export function formatMoney(value: number, currency: string, locale = "id-ID"): string {
  return `${currency} ${formatMoneyNumber(value, currency, locale)}`;
}
