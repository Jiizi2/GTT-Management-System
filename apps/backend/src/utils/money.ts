/**
 * Money helpers for the invoice module.
 *
 * Every nominal column in the schema is `DECIMAL(12,2)`, so 2 decimal places is
 * the storage precision and the only precision the rest of the code may assume.
 * Rounding happens at each boundary (per item, per subtotal, per payload) rather
 * than only at the end, so repeated reads and writes converge instead of drifting.
 */

export const MONEY_DECIMAL_PLACES = 2;

/**
 * Half a minor unit. Two amounts closer than this are the same amount once they
 * hit `DECIMAL(12,2)`, so comparisons that decide invoice status use it instead
 * of `===`/`>=` on raw floats.
 */
export const MONEY_EPSILON = 0.005;

/**
 * Round to 2 decimals. The `toFixed(6)` detour absorbs the binary representation
 * error before the final rounding, so values like `1.005` (stored as
 * `1.00499999...`) round the way an accountant expects.
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

/** True when both amounts are the same at `DECIMAL(12,2)` precision. */
export function isSameMoney(left: number, right: number): boolean {
  return Math.abs(left - right) < MONEY_EPSILON;
}

/** Sum that rounds once at the end instead of accumulating per-term error. */
export function sumMoney(values: ReadonlyArray<number>): number {
  return roundMoney(values.reduce((total, value) => total + value, 0));
}
