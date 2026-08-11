/**
 * Invoice metadata is encoded as bracket tags inside the `notes` column
 * (`[Rates:...]`, `[Payments:...]`, `[BankAccount:...]`, ...) because those
 * fields have no columns of their own.
 *
 * The patterns live here rather than being re-declared per call site: the read
 * pattern and the strip pattern have to accept exactly the same shape. When they
 * drift, a tag that fails to parse also fails to be stripped and leaks into the
 * notes printed on the customer-facing PDF.
 */

/** Accepts integer and decimal rates — `15845` and `15845.5` both parse. */
const RATE_NUMBER = String.raw`\d+(?:\.\d+)?`;

export const INVOICE_RATES_TAG_PATTERN = new RegExp(
  String.raw`\[(?:Rates|ExchangeRate):USD=(${RATE_NUMBER}),SAR=(${RATE_NUMBER})\]`,
);

const INVOICE_METADATA_TAG_PATTERNS: RegExp[] = [
  /\[KeepValasTotal:[A-Z]+\]/g,
  /\[KeepValasTotal\]/g,
  new RegExp(String.raw`\[(?:Rates|ExchangeRate):USD=${RATE_NUMBER},SAR=${RATE_NUMBER}\]`, "g"),
  /\[BankAccount:[^\]]+\]/g,
  /\[IssuingOffice:[^\]]+\]/g,
  /\[Brand:[^\]]+\]/g,
  /\[NoDueDate:true\]/g,
  /\[Address:[^\]]*\]/g,
  /\[Payments:[^\]]*\]/g,
];

/** Single read pattern for the brand tag, shared by parse below. */
const INVOICE_BRAND_TAG_PATTERN = /\[Brand:([^\]]+)\]/;

/** Strip every metadata tag, leaving only the human-written note text. */
export function stripInvoiceMetadataTags(notes: string): string {
  return INVOICE_METADATA_TAG_PATTERNS
    .reduce((text, pattern) => text.replace(pattern, ""), notes)
    .trim();
}

/**
 * Serialise a rate for the `[Rates:...]` tag. Trailing zeros are dropped so an
 * integer rate keeps writing as `15845`, unchanged from before decimals.
 */
function formatRateForTag(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) {
    return "0";
  }

  return String(Math.round(rate * 100) / 100);
}

export function buildInvoiceRatesTag(usdToIdr: number, sarToIdr: number): string {
  return `[Rates:USD=${formatRateForTag(usdToIdr)},SAR=${formatRateForTag(sarToIdr)}]`;
}

/** Serialise the invoice issuer brand as a `[Brand:...]` tag. */
export function buildInvoiceBrandTag(brandId: string): string {
  return `[Brand:${brandId.trim().toLowerCase()}]`;
}

/** Read the brand id back, or `null` when the invoice carries no brand tag (= default). */
export function parseInvoiceBrandTag(notes: string | undefined): string | null {
  if (!notes) {
    return null;
  }

  const matched = notes.match(INVOICE_BRAND_TAG_PATTERN);
  if (!matched || !matched[1]) {
    return null;
  }

  return matched[1].trim().toLowerCase();
}

/** Read the rates back, or `null` when the invoice carries no rate tag. */
export function parseInvoiceRatesTag(notes: string | undefined): { usdToIdr: number; sarToIdr: number } | null {
  if (!notes) {
    return null;
  }

  const matched = notes.match(INVOICE_RATES_TAG_PATTERN);
  if (!matched) {
    return null;
  }

  const usdToIdr = Number.parseFloat(matched[1]);
  const sarToIdr = Number.parseFloat(matched[2]);
  if (!Number.isFinite(usdToIdr) || !Number.isFinite(sarToIdr)) {
    return null;
  }

  return { usdToIdr, sarToIdr };
}
