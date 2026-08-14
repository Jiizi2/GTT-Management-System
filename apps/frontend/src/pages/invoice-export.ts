import { escapeHtml } from "../shared/app-domain";
import { fetchBackend } from "../shared/api-client";
import { clampMoney, formatMoney } from "../shared/money";
import { stripInvoiceMetadataTags } from "../shared/invoice-notes-tags";
import { resolveInvoiceBrand, type InvoiceBrandProfile } from "../shared/invoice-brands";

export type InvoiceExportCurrency = "IDR" | "USD" | "SAR";

export type InvoiceExportLineItem = {
  description: string;
  pax: number;
  currency: InvoiceExportCurrency;
  unitPrice: number;
  totalPrice: number;
  totalPriceIdr: number;
};

export type InvoiceExportPaymentItem = {
  amount: number;
  dateIso: string;
};

export type InvoiceExportPayload = {
  invoiceId?: string;
  /** Issuer brand id (`"ghaniya"` | `"yahya"`); missing/unknown falls back to Ghaniya. */
  brand?: string;
  invoiceNumber: string;
  issueDateIso: string;
  dueDateIso: string;
  statusLabel?: string;
  issuingOffice: string;
  clientName: string;
  clientCode: string;
  address: string;
  recipientName?: string;
  bankAccountRecipient?: string;
  bankAccountLabel: string;
  notes: string;
  usdToIdr: number;
  sarToIdr: number;
  currency: InvoiceExportCurrency;
  subtotal: number;
  tax: number;
  /** Discount subtracted from the gross subtotal, in the display currency. Optional for back-compat. */
  discount?: number;
  totalPayable: number;
  downPayment: number;
  remainingBalance: number;
  items: InvoiceExportLineItem[];
  payments?: InvoiceExportPaymentItem[];
};

type InvoiceExportWindowOptions = {
  printWindow?: Window | null;
};

const PRINT_TRIGGER_DELAY_MS = 180;
const PRINT_FALLBACK_TIMEOUT_MS = 4_500;
const RESOURCE_WAIT_TIMEOUT_MS = 2_500;

type ProtectedApprovalAssets = {
  stampDataUrl?: string;
  signatureDataUrl?: string;
};

async function responsePngToDataUrl(response: Response): Promise<string | undefined> {
  if (!response.ok || response.headers.get("content-type")?.split(";", 1)[0] !== "image/png") {
    return undefined;
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength === 0 || buffer.byteLength > 2 * 1024 * 1024) return undefined;
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

async function fetchProtectedApprovalAssets(invoiceId?: string): Promise<ProtectedApprovalAssets> {
  const normalizedInvoiceId = invoiceId?.trim();
  if (!normalizedInvoiceId) return {};
  const encodedInvoiceId = encodeURIComponent(normalizedInvoiceId);
  const read = async (kind: "stamp" | "signature") => {
    try {
      const response = await fetchBackend(`/invoices/${encodedInvoiceId}/document-assets/${kind}`, {
        method: "GET",
        headers: { Accept: "image/png" },
        cache: "no-store",
      });
      return await responsePngToDataUrl(response);
    } catch (error) {
      console.warn(`Protected invoice ${kind} is unavailable.`, error);
      return undefined;
    }
  };
  const [stampDataUrl, signatureDataUrl] = await Promise.all([read("stamp"), read("signature")]);
  return { stampDataUrl, signatureDataUrl };
}

/** Whole-number quantities (pax counts), never money. */
function formatCount(value: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(value)));
}

function formatRate(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function formatCurrency(value: number, currency: InvoiceExportCurrency): string {
  return formatMoney(value, currency);
}

function isIdrCurrency(currency: string): boolean {
  return currency.trim().toUpperCase() === "IDR";
}

function formatIdr(value: number): string {
  return formatCurrency(value, "IDR");
}

function formatDateLabel(isoDate: string): string {
  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function resolvePaymentStatusLabel(payload: InvoiceExportPayload): string {
  const explicitStatusLabel = payload.statusLabel?.trim();
  if (explicitStatusLabel) {
    return explicitStatusLabel;
  }

  if (payload.remainingBalance <= 0) {
    return "Paid";
  }

  if (payload.downPayment > 0) {
    return "Partial Payment";
  }

  return "Awaiting Payment";
}

function resolveTaxPercentage(payload: InvoiceExportPayload): number {
  if (payload.subtotal <= 0) {
    return 0;
  }

  return Math.max(0, Math.round((payload.tax / payload.subtotal) * 100));
}

function resolveOutstandingBalanceLabel(payload: InvoiceExportPayload): string {
  if (payload.remainingBalance <= 0) {
    return "Lunas";
  }
  return payload.downPayment > 0 ? "Sisa Tagihan" : "Tagihan";
}

function isPaidStatusLabel(statusLabel: string, remainingBalanceIdr: number): boolean {
  const normalizedStatus = statusLabel.trim().toLowerCase();
  return remainingBalanceIdr <= 0 || normalizedStatus.includes("paid") || normalizedStatus.includes("lunas");
}

function resolveBankMeta(bankAccountLabel: string): {
  bankName: string;
  accountNumber: string;
} {
  const trimmed = bankAccountLabel.trim();
  if (!trimmed) {
    return {
      bankName: "Bank Mandiri",
      accountNumber: "-",
    };
  }

  const chunks = trimmed
    .split(" - ")
    .map((item) => item.trim())
    .filter(Boolean);
  if (chunks.length >= 2) {
    return {
      bankName: chunks[0],
      accountNumber: chunks.slice(1).join(" - "),
    };
  }

  return {
    bankName: trimmed,
    accountNumber: "-",
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveBillToName(payload: InvoiceExportPayload): string {
  const normalizedClientName = payload.clientName.trim();
  const normalizedClientCode = payload.clientCode.trim();

  if (!normalizedClientName) {
    return normalizedClientCode || "Umrah Corporate";
  }

  if (normalizedClientCode) {
    const strictCodePrefixPattern = new RegExp(`^${escapeRegex(normalizedClientCode)}\\s*[-:|]\\s*`, "i");
    const looseCodePrefixPattern = new RegExp(`^${escapeRegex(normalizedClientCode)}\\s+`, "i");
    const withoutCodePrefix = normalizedClientName
      .replace(strictCodePrefixPattern, "")
      .replace(looseCodePrefixPattern, "")
      .trim();
    if (withoutCodePrefix) {
      return withoutCodePrefix;
    }
  }

  const withoutNumericLabel = normalizedClientName.replace(/^\d+\.\s*/, "").trim();
  const genericCodePrefixPattern = /^[A-Z0-9]{2,}(?:[-_/][A-Z0-9]{2,})*\s*[-:|]\s*/i;
  const genericDigitCodePrefixPattern = /^[A-Z0-9._/-]*\d[A-Z0-9._/-]*\s*[-:|.]?\s+/i;
  const cleanedName = withoutNumericLabel
    .replace(genericCodePrefixPattern, "")
    .replace(genericDigitCodePrefixPattern, "")
    .trim();
  return cleanedName || withoutNumericLabel || normalizedClientName;
}

// resolvePrintableWindow removed because export now uses hidden iframe printing

function waitForTimeout(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });
}

function waitForDocumentLoad(printableWindow: Window): Promise<void> {
  const document = printableWindow.document;
  if (document.readyState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) {
        return;
      }

      resolved = true;
      resolve();
    };

    try {
      printableWindow.addEventListener("load", finish, { once: true });
    } catch {
      finish();
      return;
    }

    window.setTimeout(finish, RESOURCE_WAIT_TIMEOUT_MS);
  });
}

function waitForStylesheets(printableWindow: Window): Promise<void> {
  const styleLinks = Array.from(printableWindow.document.querySelectorAll('link[rel="stylesheet"]'));
  if (styleLinks.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    styleLinks.map(
      (link) =>
        new Promise<void>((resolve) => {
          if ((link as HTMLLinkElement).sheet) {
            resolve();
            return;
          }

          let settled = false;
          const finish = () => {
            if (settled) {
              return;
            }

            settled = true;
            resolve();
          };

          link.addEventListener("load", finish, { once: true });
          link.addEventListener("error", finish, { once: true });
          window.setTimeout(finish, RESOURCE_WAIT_TIMEOUT_MS);
        }),
    ),
  ).then(() => undefined);
}

function waitForFonts(printableWindow: Window): Promise<void> {
  try {
    const fontsReady = printableWindow.document.fonts?.ready;
    if (fontsReady) {
      return Promise.race([fontsReady.then(() => undefined), waitForTimeout(RESOURCE_WAIT_TIMEOUT_MS)]);
    }
  } catch {
    // Some popup handles expose a restricted document.fonts API.
  }

  return Promise.resolve();
}

function waitForImages(printableWindow: Window): Promise<void> {
  const images = Array.from(printableWindow.document.images);
  if (images.length === 0) {
    return Promise.resolve();
  }

  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            if (typeof image.decode === "function") {
              void image
                .decode()
                .catch(() => undefined)
                .finally(resolve);
              return;
            }

            resolve();
            return;
          }

          let settled = false;
          const finish = () => {
            if (settled) {
              return;
            }

            settled = true;
            resolve();
          };

          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
          window.setTimeout(finish, RESOURCE_WAIT_TIMEOUT_MS);
        }),
    ),
  ).then(() => undefined);
}

async function finalizePrintWindow(printableWindow: Window, iframe: HTMLIFrameElement): Promise<void> {
  let printTriggered = false;
  const triggerPrint = () => {
    if (printTriggered) {
      return;
    }

    printTriggered = true;
    try {
      printableWindow.focus();
      printableWindow.print();
    } catch (e) {
      console.error("Print triggered an error:", e);
    }
  };

  const waitForResources = Promise.allSettled([
    waitForDocumentLoad(printableWindow),
    waitForStylesheets(printableWindow),
    waitForFonts(printableWindow),
    waitForImages(printableWindow),
  ]);

  await Promise.race([waitForResources, waitForTimeout(PRINT_FALLBACK_TIMEOUT_MS)]);

  window.setTimeout(() => {
    triggerPrint();
    // Schedule clean up of the print iframe after user completes/cancels print dialog
    window.setTimeout(() => {
      try {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      } catch {
        // ignore
      }
    }, 15000);
  }, PRINT_TRIGGER_DELAY_MS);
}

type SultanRenderContext = {
  payload: InvoiceExportPayload;
  brandProfile: InvoiceBrandProfile;
  logoUrl: string;
  appCssUrl: string;
  fontsCssUrl: string;
  billToName: string;
  beneficiaryName: string;
  bankMeta: { bankName: string; accountNumber: string };
  valasCurrency: InvoiceExportCurrency;
  isSingleCurrencyBilling: boolean;
  hasUsdItems: boolean;
  hasSarItems: boolean;
  isPaidInvoice: boolean;
  notesHtml: string;
  approvalAssets: ProtectedApprovalAssets;
};

/**
 * Mirrors the classic single-currency conversion so the `sultan` layout shows
 * the same per-item amounts. Kept separate from the classic inline builder so
 * the Ghaniya template stays byte-for-byte unchanged.
 */
function resolveSultanItemAmounts(
  item: InvoiceExportLineItem,
  payload: InvoiceExportPayload,
  valasCurrency: InvoiceExportCurrency,
  rate: number,
): { unitPriceValas: number; totalPriceValas: number } {
  let unitPriceValas = item.unitPrice;
  let totalPriceValas = item.totalPrice;
  if (item.currency !== valasCurrency) {
    const itemRate = item.currency === "USD" ? payload.usdToIdr : item.currency === "SAR" ? payload.sarToIdr : 1;
    const itemPriceIdr = item.totalPriceIdr;
    if (valasCurrency === "IDR") {
      unitPriceValas = clampMoney(item.unitPrice * itemRate);
      totalPriceValas = itemPriceIdr;
    } else {
      totalPriceValas = rate > 0 ? clampMoney(itemPriceIdr / rate) : 0;
      unitPriceValas = item.pax > 0 ? clampMoney(totalPriceValas / item.pax) : 0;
    }
  }
  return { unitPriceValas, totalPriceValas };
}

/**
 * Purple, payment-in-table invoice modelled on the Sultan Fatih page-1 layout.
 * Reuses every existing feature (exchange rates, USD/SAR billing, multi-currency
 * table with a Total (IDR) column, Lunas/Belum-Lunas status). Used by brands
 * whose profile `layout === "sultan"` (currently Yahya Tours).
 */
function renderSultanInvoiceHtml(ctx: SultanRenderContext): string {
  const {
    payload,
    brandProfile,
    logoUrl,
    appCssUrl,
    fontsCssUrl,
    billToName,
    beneficiaryName,
    bankMeta,
    valasCurrency,
    isSingleCurrencyBilling,
    hasUsdItems,
    hasSarItems,
    isPaidInvoice,
    notesHtml,
    approvalAssets,
  } = ctx;

  const rate = valasCurrency === "USD" ? payload.usdToIdr : payload.sarToIdr;
  const showTotalIdrColumn = !isSingleCurrencyBilling;
  const itemColumnCount = showTotalIdrColumn ? 5 : 4;

  const itemRowsHtml = payload.items.length
    ? payload.items
        .map((item) => {
          if (isSingleCurrencyBilling) {
            const { unitPriceValas, totalPriceValas } = resolveSultanItemAmounts(
              item,
              payload,
              valasCurrency,
              rate,
            );
            return `<tr>
<td class="sf-desc">${escapeHtml(item.description)}</td>
<td class="sf-c">${escapeHtml(formatCount(item.pax))}</td>
<td class="sf-r">${escapeHtml(formatCurrency(unitPriceValas, valasCurrency))}</td>
<td class="sf-r">${escapeHtml(formatCurrency(totalPriceValas, valasCurrency))}</td>
</tr>`;
          }
          return `<tr>
<td class="sf-desc">${escapeHtml(item.description)}</td>
<td class="sf-c">${escapeHtml(formatCount(item.pax))}</td>
<td class="sf-r">${escapeHtml(formatCurrency(item.unitPrice, item.currency))}</td>
<td class="sf-r">${escapeHtml(formatCurrency(item.totalPrice, item.currency))}</td>
<td class="sf-r">${escapeHtml(formatIdr(item.totalPriceIdr))}</td>
</tr>`;
        })
        .join("")
    : `<tr><td class="sf-c" colspan="${itemColumnCount}" style="color:#9aa0aa;">No invoice items</td></tr>`;

  const payments = payload.payments ?? [];
  const paymentLinesHtml = payments.length
    ? payments
        .map(
          (p) =>
            `<div class="row pay"><span>${escapeHtml(formatDateLabel(p.dateIso))}</span><strong>${escapeHtml(formatCurrency(p.amount, valasCurrency))}</strong></div>`,
        )
        .join("")
    : `<div class="row pay"><span>Belum ada pembayaran</span><strong>—</strong></div>`;

  const showRates = hasUsdItems || hasSarItems;
  const ratesHtml = showRates
    ? [
        hasSarItems ? `SAR/IDR ${escapeHtml(formatRate(payload.sarToIdr))}` : "",
        hasUsdItems ? `USD/IDR ${escapeHtml(formatRate(payload.usdToIdr))}` : "",
      ]
        .filter(Boolean)
        .join("&nbsp;&nbsp;·&nbsp;&nbsp;")
    : "";

  const totalHargaLabel = formatCurrency(payload.totalPayable, valasCurrency);
  const discountValue = clampMoney(payload.discount ?? 0);
  const hasDiscount = discountValue > 0;
  const grossSubtotalLabel = formatCurrency(payload.subtotal, valasCurrency);
  const discountLabel = formatCurrency(discountValue, valasCurrency);
  const discountColor = hasDiscount ? "color:#b91c1c;" : "";
  const discountRowsHtml = `<div class="row"><span>Subtotal</span><strong>${escapeHtml(grossSubtotalLabel)}</strong></div>
<div class="row"><span style="${discountColor}">Diskon</span><strong style="${discountColor}">${hasDiscount ? "- " : ""}${escapeHtml(discountLabel)}</strong></div>`;
  const sisaLabel = isPaidInvoice ? "LUNAS" : formatCurrency(payload.remainingBalance, valasCurrency);

  const contactLine = [brandProfile.phone, brandProfile.socialHandle]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join("  ·  ");

  const signatureInner =
    approvalAssets.signatureDataUrl || approvalAssets.stampDataUrl
      ? `${approvalAssets.signatureDataUrl ? `<img alt="Tanda tangan terotorisasi" class="sf-sign-img" decoding="sync" src="${escapeHtml(approvalAssets.signatureDataUrl)}"/>` : ""}${approvalAssets.stampDataUrl ? `<img alt="Cap terotorisasi" class="sf-stamp-img" decoding="sync" src="${escapeHtml(approvalAssets.stampDataUrl)}"/>` : ""}`
      : "";

  return `<!DOCTYPE html>
<html lang="id"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<meta content="light only" name="color-scheme"/>
<title>${escapeHtml(brandProfile.documentTitle)}</title>
<link as="style" href="${escapeHtml(fontsCssUrl)}" rel="preload"/>
<link as="style" href="${escapeHtml(appCssUrl)}" rel="preload"/>
<link as="image" href="${escapeHtml(logoUrl)}" rel="preload"/>
${approvalAssets.stampDataUrl ? `<link as="image" href="${escapeHtml(approvalAssets.stampDataUrl)}" rel="preload"/>` : ""}
${approvalAssets.signatureDataUrl ? `<link as="image" href="${escapeHtml(approvalAssets.signatureDataUrl)}" rel="preload"/>` : ""}
<link href="${escapeHtml(fontsCssUrl)}" rel="stylesheet"/>
<link href="${escapeHtml(appCssUrl)}" rel="stylesheet"/>
<style>
:root {
  /* Yahya Tours — green + gold as restrained accents on a white sheet. */
  --sf-green: #007d00;
  --sf-green-deep: #026a02;
  --sf-gold: #b8860b;
  --sf-ink: #1b2230;
  --sf-sub: #3f4653;
  --sf-muted: #5c6470;
  --sf-line: #e7e9ec;
  --sf-line-strong: #cfd4da;
}
* { box-sizing: border-box; }
@page { size: A4 portrait; margin: 0; }
html, body {
  width: 100%; height: 100%; margin: 0; padding: 0;
  background: #ffffff;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
body {
  color: var(--sf-ink);
  font-family: 'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
  font-size: 11.5px; line-height: 1.6; font-weight: 500;
}
img { image-rendering: -webkit-optimize-contrast; }
.sf-r { font-variant-numeric: tabular-nums; }
.sf-page { position: relative; width: 100%; max-width: 210mm; min-height: 297mm; margin: 0 auto; background: #ffffff; display: flex; flex-direction: column; }
.sf-eyebrow { font-family: 'Outfit', 'Inter', sans-serif; font-size: 9.5px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: var(--sf-ink); }
/* Thin brand accent at the very top */
.sf-topbar { height: 4px; background: var(--sf-green); }
.sf-topbar span { display: block; height: 100%; width: 24%; background: var(--sf-gold); }
/* Header — letterhead: full company identity left, logo right */
.sf-header { display: flex; align-items: center; justify-content: space-between; gap: 32px; padding: 44px 56px 22px 56px; }
.sf-company { flex: 1; min-width: 0; }
.sf-company-name { font-family: 'Outfit', 'Inter', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: 0.01em; color: var(--sf-green); text-transform: uppercase; line-height: 1.15; }
.sf-company-line { font-size: 10.5px; color: var(--sf-sub); margin-top: 4px; line-height: 1.55; max-width: 470px; }
.sf-company-line.izin { color: var(--sf-gold); font-weight: 700; letter-spacing: 0.02em; }
.sf-logo { height: 74px; width: auto; object-fit: contain; flex: 0 0 auto; }
/* Divider */
.sf-div { height: 1px; background: var(--sf-line); margin: 0 56px; }
/* Bill row: client (left) + compact invoice meta (right) */
.sf-billrow { display: flex; justify-content: space-between; align-items: flex-start; gap: 48px; padding: 24px 56px 6px 56px; }
.sf-party { max-width: 58%; }
.sf-party .sf-eyebrow { display: block; margin-bottom: 7px; }
.sf-party .name { font-family: 'Outfit', 'Inter', sans-serif; font-size: 15px; font-weight: 700; color: var(--sf-ink); line-height: 1.3; }
.sf-party .line { font-size: 11px; color: var(--sf-sub); margin-top: 4px; line-height: 1.6; }
.sf-docmeta { flex: 0 0 auto; min-width: 220px; text-align: right; border: 1px solid var(--sf-line-strong); border-radius: 9px; padding: 14px 16px; background: #fbfcfd; }
.sf-docmeta-no { font-family: 'Outfit', 'Inter', sans-serif; font-size: 13px; font-weight: 700; color: var(--sf-ink); letter-spacing: 0.01em; }
.sf-docmeta-no span { color: var(--sf-ink); font-weight: 800; letter-spacing: 0.16em; font-size: 9.5px; }
.sf-docmeta-rows { margin-top: 9px; }
.sf-docmeta-rows .r { display: flex; justify-content: flex-end; gap: 12px; font-size: 11px; padding: 2px 0; }
.sf-docmeta-rows .r span { color: var(--sf-sub); font-weight: 700; }
.sf-docmeta-rows .r b { color: var(--sf-ink); font-weight: 700; min-width: 92px; text-align: right; }
.sf-docmeta-rows .r b.paid { color: var(--sf-green); }
.sf-docmeta-rows .r b.unpaid { color: #b45309; }
/* Items table */
.sf-items { padding: 30px 56px 0 56px; }
.sf-tbl { width: 100%; border-collapse: collapse; }
.sf-tbl thead th { font-family: 'Outfit', 'Inter', sans-serif; font-size: 9.5px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--sf-ink); padding: 0 0 11px 0; border-bottom: 1.5px solid var(--sf-ink); text-align: left; }
.sf-tbl tbody td { font-size: 11.5px; padding: 13px 0; border-bottom: 1px solid var(--sf-line); vertical-align: top; color: var(--sf-sub); }
.sf-tbl th + th, .sf-tbl td + td { padding-left: 18px; }
.sf-tbl .sf-desc { font-weight: 700; color: var(--sf-ink); word-break: break-word; }
.sf-tbl .sf-c { text-align: center; white-space: nowrap; }
.sf-tbl .sf-r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
/* Summary — payment instructions + notes (left) beside totals (right) */
.sf-summary { display: flex; justify-content: space-between; gap: 52px; align-items: stretch; padding: 32px 56px 0 56px; }
.sf-payinfo { flex: 1; min-width: 0; max-width: 54%; display: flex; flex-direction: column; }
.sf-payinfo .block { border: 1px solid var(--sf-line-strong); border-radius: 9px; padding: 14px 16px; background: #fbfcfd; }
.sf-payinfo .block + .block { margin-top: 16px; }
/* Last block (Catatan) grows so its bottom edge lines up with the totals box. */
.sf-payinfo .block:last-child { flex: 1 1 auto; }
.sf-payinfo .sf-eyebrow { display: block; margin-bottom: 9px; }
.sf-payinfo .bank { font-size: 12px; color: var(--sf-ink); line-height: 1.75; }
.sf-payinfo .bank .acct { font-family: 'Outfit', 'Inter', sans-serif; font-size: 15px; font-weight: 700; color: var(--sf-green); letter-spacing: 0.02em; }
.sf-payinfo .bank .an { color: var(--sf-sub); }
.sf-payinfo .rates { margin-top: 9px; font-size: 11px; color: var(--sf-muted); }
.sf-payinfo .notes { font-size: 11.5px; line-height: 1.8; color: var(--sf-ink); font-weight: 500; }
.sf-sumbox { width: 320px; flex: 0 0 auto; border: 1px solid var(--sf-line-strong); border-radius: 9px; padding: 16px 18px; background: #fbfcfd; }
.sf-sumbox .row { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; padding: 7px 0; color: var(--sf-sub); }
.sf-sumbox .row strong { color: var(--sf-ink); font-weight: 700; white-space: nowrap; font-variant-numeric: tabular-nums; }
.sf-payhead { margin: 10px 0 4px; padding-top: 12px; border-top: 1px solid var(--sf-line); }
.sf-payhead .sf-eyebrow { display: block; }
.sf-sumbox .row.pay { font-size: 11px; padding: 4px 0; color: var(--sf-muted); }
.sf-sumbox .row.pay strong { color: var(--sf-sub); font-weight: 600; }
.sf-sumbox .grand { display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; padding-top: 13px; border-top: 2px solid var(--sf-ink); }
.sf-sumbox .grand .l { font-family: 'Outfit', 'Inter', sans-serif; font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--sf-ink); }
.sf-sumbox .grand .v { font-family: 'Outfit', 'Inter', sans-serif; font-size: 21px; font-weight: 700; color: var(--sf-green); white-space: nowrap; font-variant-numeric: tabular-nums; }
/* Payment instructions */
.sf-bankblock { padding: 30px 56px 0 56px; }
.sf-bankblock .sf-eyebrow { display: block; margin-bottom: 9px; }
.sf-bankblock .bank { font-size: 12px; color: var(--sf-ink); line-height: 1.6; }
.sf-bankblock .bank .acct { font-family: 'Outfit', 'Inter', sans-serif; font-weight: 700; letter-spacing: 0.02em; color: var(--sf-green); }
.sf-bankblock .rates { margin-top: 7px; font-size: 11px; color: var(--sf-muted); }
/* Notes */
.sf-notes { padding: 24px 56px 0 56px; }
.sf-notes .sf-eyebrow { display: block; margin-bottom: 7px; }
.sf-notes p { margin: 0; font-size: 11px; line-height: 1.75; color: var(--sf-sub); }
/* Signature */
.sf-sign { display: flex; justify-content: flex-end; padding: 34px 56px 22px 56px; }
.sf-sign-col { width: 240px; text-align: center; }
.sf-sign-role { font-size: 11px; color: var(--sf-muted); margin-bottom: 4px; }
.sf-sign-space { position: relative; height: 88px; display: flex; align-items: center; justify-content: center; }
.sf-sign-img { height: 64px; width: auto; object-fit: contain; position: relative; z-index: 2; }
.sf-stamp-img { height: 92px; width: auto; object-fit: contain; position: absolute; top: -2px; left: 44px; opacity: 0.9; transform: rotate(-7deg); z-index: 3; }
.sf-sign-name { display: inline-block; min-width: 190px; font-family: 'Outfit', 'Inter', sans-serif; font-size: 12.5px; font-weight: 700; color: var(--sf-ink); border-top: 1px solid var(--sf-line-strong); padding-top: 6px; }
.sf-sign-title { font-size: 10px; color: var(--sf-muted); margin-top: 3px; }
/* Footer */
.sf-footer { border-top: 1px solid var(--sf-line); margin: auto 56px 0; padding: 15px 0 26px 0; text-align: center; font-size: 10px; color: var(--sf-muted); letter-spacing: 0.06em; }
.sf-footer .sf-foot-tag { color: var(--sf-green); font-weight: 700; }
@media screen {
  html, body { height: auto; min-height: 100%; background: #eef1f4; }
  body { padding: 24px; display: flex; justify-content: center; align-items: flex-start; }
  .sf-page { min-height: 297mm; box-shadow: 0 18px 44px rgba(0,0,0,0.14); }
}
@media print {
  html, body { width: 210mm; background: #fff; }
  .sf-page { width: 210mm !important; min-height: 297mm !important; box-shadow: none !important; }
  .sf-billrow, .sf-summary, .sf-payinfo .block, .sf-sign-col, .sf-tbl tr { break-inside: avoid; page-break-inside: avoid; }
}
</style>
</head>
<body>
<div class="sf-page">
<div class="sf-topbar"><span></span></div>

<header class="sf-header">
<div class="sf-company">
<div class="sf-company-name">${escapeHtml(brandProfile.brandName)}</div>
<div class="sf-company-line izin">No Izin. ${escapeHtml(brandProfile.izinPpiu)}</div>
<div class="sf-company-line">${escapeHtml(brandProfile.alamat)}</div>
${contactLine ? `<div class="sf-company-line">${escapeHtml(contactLine)}</div>` : ""}
</div>
<img alt="Logo" class="sf-logo" decoding="sync" fetchpriority="high" src="${escapeHtml(logoUrl)}"/>
</header>
<div class="sf-div"></div>

<section class="sf-billrow">
<div class="sf-party to">
<span class="sf-eyebrow">Ditagihkan Kepada</span>
<div class="name">${escapeHtml(billToName)}</div>
${payload.recipientName?.trim() ? `<div class="line">U.p. ${escapeHtml(payload.recipientName)}</div>` : ""}
${payload.address?.trim() ? `<div class="line">${escapeHtml(payload.address).replace(/\n/g, "<br/>")}</div>` : ""}
</div>
<div class="sf-docmeta">
<div class="sf-docmeta-no"><span>INVOICE</span>&nbsp;&nbsp;${escapeHtml(payload.invoiceNumber)}</div>
<div class="sf-docmeta-rows">
<div class="r"><span>Tanggal</span><b>${escapeHtml(formatDateLabel(payload.issueDateIso))}</b></div>
${payload.dueDateIso ? `<div class="r"><span>Periode</span><b>${escapeHtml(formatDateLabel(payload.dueDateIso))}</b></div>` : ""}
<div class="r"><span>Status</span><b class="${isPaidInvoice ? "paid" : "unpaid"}">${isPaidInvoice ? "Lunas" : "Belum Lunas"}</b></div>
</div>
</div>
</section>

<section class="sf-items">
<table class="sf-tbl">
<thead>
<tr>
<th>Deskripsi</th>
<th class="sf-c">Pax</th>
<th class="sf-r">Harga</th>
<th class="sf-r">Total</th>
${showTotalIdrColumn ? `<th class="sf-r">Total (IDR)</th>` : ""}
</tr>
</thead>
<tbody>${itemRowsHtml}</tbody>
</table>
</section>

<section class="sf-summary">
<div class="sf-payinfo">
<div class="block">
<span class="sf-eyebrow">Instruksi Pembayaran</span>
<div class="bank">
<div class="acct">${escapeHtml(bankMeta.accountNumber)}</div>
${escapeHtml(bankMeta.bankName)}<br/>
<span class="an">a.n ${escapeHtml(beneficiaryName)}</span>
</div>
${ratesHtml ? `<div class="rates">Kurs&nbsp;&nbsp;${ratesHtml}</div>` : ""}
</div>
${notesHtml ? `<div class="block"><span class="sf-eyebrow">Catatan</span><div class="notes">${notesHtml}</div></div>` : ""}
</div>
<div class="sf-sumbox">
${discountRowsHtml}
<div class="row"><span>Total Tagihan</span><strong>${escapeHtml(totalHargaLabel)}</strong></div>
<div class="sf-payhead"><span class="sf-eyebrow">Riwayat Pembayaran</span></div>
${paymentLinesHtml}
<div class="row grand"><span class="l">Sisa Pembayaran</span><span class="v">${escapeHtml(sisaLabel)}</span></div>
</div>
</section>

<section class="sf-sign">
<div class="sf-sign-col">
<div class="sf-sign-role">Hormat kami,</div>
<div class="sf-sign-space">${signatureInner}</div>
<div class="sf-sign-name">${escapeHtml(brandProfile.directorName)}</div>
<div class="sf-sign-title">${escapeHtml(brandProfile.directorTitle)}</div>
</div>
</section>

<footer class="sf-footer">${escapeHtml(brandProfile.footerText)}${brandProfile.tagline?.trim() ? ` · <span class="sf-foot-tag">${escapeHtml(brandProfile.tagline)}</span>` : ""}</footer>
</div>
</body></html>`;
}


export async function exportInvoicePdf(
  payload: InvoiceExportPayload,
  _options: InvoiceExportWindowOptions = {},
): Promise<boolean> {
  const approvalAssets = await fetchProtectedApprovalAssets(payload.invoiceId);
  const iframe = window.document.createElement("iframe");
  iframe.name = `invoice_print_${Date.now()}`;
  iframe.style.position = "absolute";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";
  window.document.body.appendChild(iframe);

  const printableWindow = iframe.contentWindow;
  if (!printableWindow) {
    return false;
  }

  const brandProfile = resolveInvoiceBrand(payload.brand);
  const logoUrl = new URL(brandProfile.logoFileName, window.location.origin).toString();
  const appCssUrl = new URL("/index.css", window.location.origin).toString();
  const fontsCssUrl = new URL("/fonts.css", window.location.origin).toString();
  const statusLabel = resolvePaymentStatusLabel(payload);
  const isPaidInvoice = isPaidStatusLabel(statusLabel, payload.remainingBalance);
  const printableStatusLabel = isPaidInvoice ? "Lunas" : statusLabel;
  const taxPercentage = resolveTaxPercentage(payload);
  const bankMeta = resolveBankMeta(payload.bankAccountLabel);
  const billToName = resolveBillToName(payload);
  const beneficiaryName = payload.bankAccountRecipient?.trim() || brandProfile.brandName;

  const valasCurrency = payload.currency || "IDR";
  const isRupiahOnly = payload.items.every((item) => isIdrCurrency(item.currency));
  const isSingleCurrencyBilling = valasCurrency !== "IDR" || isRupiahOnly;
  const hasUsdItems = payload.items.some((item) => item.currency === "USD");
  const hasSarItems = payload.items.some((item) => item.currency === "SAR");

  let statusBadgeHtml = "";
  const normalizedStatus = statusLabel.trim().toLowerCase();
  if (isPaidInvoice || normalizedStatus.includes("paid") || normalizedStatus.includes("lunas")) {
    statusBadgeHtml = `<span class="status-badge badge-lunas">Lunas</span>`;
  } else if (normalizedStatus.includes("partially") || normalizedStatus.includes("dp")) {
    statusBadgeHtml = `<span class="status-badge badge-dp">Partial Payment</span>`;
  } else if (normalizedStatus.includes("cancelled") || normalizedStatus.includes("batal")) {
    statusBadgeHtml = `<span class="status-badge badge-batal">Batal</span>`;
  } else if (normalizedStatus.includes("overdue") || normalizedStatus.includes("tempo")) {
    statusBadgeHtml = `<span class="status-badge badge-overdue">Jatuh Tempo</span>`;
  } else {
    statusBadgeHtml = `<span class="status-badge badge-awaiting">${escapeHtml(printableStatusLabel)}</span>`;
  }

  const rate = valasCurrency === "USD" ? payload.usdToIdr : payload.sarToIdr;

  const rowsHtml = payload.items
    .map((item, index) => {
      if (isSingleCurrencyBilling) {
        let unitPriceValas = item.unitPrice;
        let totalPriceValas = item.totalPrice;
        
        if (item.currency !== valasCurrency) {
          const itemRate = item.currency === "USD" ? payload.usdToIdr : item.currency === "SAR" ? payload.sarToIdr : 1;
          const itemPriceIdr = item.totalPriceIdr;
          if (valasCurrency === "IDR") {
            unitPriceValas = clampMoney(item.unitPrice * itemRate);
            totalPriceValas = itemPriceIdr;
          } else {
            totalPriceValas = rate > 0 ? clampMoney(itemPriceIdr / rate) : 0;
            unitPriceValas = item.pax > 0 ? clampMoney(totalPriceValas / item.pax) : 0;
          }
        }

        return `
<tr class="invoice-line-row">
<td class="invoice-cell-no">${String(index + 1).padStart(2, "0")}</td>
<td class="invoice-cell-desc">
<div class="invoice-row-description">${escapeHtml(item.description)}</div>
</td>
<td class="invoice-cell-pax">${escapeHtml(formatCount(item.pax))}</td>
<td class="invoice-cell-price">${escapeHtml(formatCurrency(unitPriceValas, valasCurrency))}</td>
<td class="invoice-cell-total">${escapeHtml(formatCurrency(totalPriceValas, valasCurrency))}</td>
</tr>`;
      } else {
        const totalPriceLabel = formatCurrency(item.totalPrice, item.currency);
        return `
<tr class="invoice-line-row">
<td class="invoice-cell-no">${String(index + 1).padStart(2, "0")}</td>
<td class="invoice-cell-desc">
<div class="invoice-row-description">${escapeHtml(item.description)}</div>
</td>
<td class="invoice-cell-pax">${escapeHtml(formatCount(item.pax))}</td>
<td class="invoice-cell-price">${escapeHtml(formatCurrency(item.unitPrice, item.currency))}</td>
<td class="invoice-cell-total">${escapeHtml(totalPriceLabel)}</td>
<td class="invoice-cell-total-idr">${escapeHtml(formatIdr(item.totalPriceIdr))}</td>
</tr>`;
      }
    })
    .join("");

  // Callers normally pre-strip these, but stripping again is a no-op and keeps a
  // stray metadata tag from ever reaching the customer-facing document.
  const cleanNotes = stripInvoiceMetadataTags(payload.notes);

  const notesHtml = cleanNotes
    ? escapeHtml(cleanNotes).replace(/\n/g, "<br/>")
    : escapeHtml(brandProfile.thankYouNote);

  const discountValue = clampMoney(payload.discount ?? 0);
  const hasDiscount = discountValue > 0;
  const displaySubtotal = formatCurrency(payload.subtotal, valasCurrency);
  const displayDiscount = formatCurrency(discountValue, valasCurrency);
  const displayTotalPayable = formatCurrency(payload.totalPayable, valasCurrency);
  const displayDownPayment = formatCurrency(payload.downPayment, valasCurrency);
  const displayRemainingBalance = formatCurrency(payload.remainingBalance, valasCurrency);

  const columnStyles = isSingleCurrencyBilling ? `
            .invoice-table th:nth-child(1), .invoice-table td:nth-child(1) { width: 6%; }
            .invoice-table th:nth-child(2), .invoice-table td:nth-child(2) { width: 50%; }
            .invoice-table th:nth-child(3), .invoice-table td:nth-child(3) { width: 12%; }
            .invoice-table th:nth-child(4), .invoice-table td:nth-child(4) { width: 16%; }
            .invoice-table th:nth-child(5), .invoice-table td:nth-child(5) { width: 16%; }
  ` : `
            .invoice-table th:nth-child(1), .invoice-table td:nth-child(1) { width: 6%; }
            .invoice-table th:nth-child(2), .invoice-table td:nth-child(2) { width: 34%; }
            .invoice-table th:nth-child(3), .invoice-table td:nth-child(3) { width: 12%; }
            .invoice-table th:nth-child(4), .invoice-table td:nth-child(4) { width: 16%; }
            .invoice-table th:nth-child(5), .invoice-table td:nth-child(5) { width: 16%; }
            .invoice-table th:nth-child(6), .invoice-table td:nth-child(6) { width: 16%; }
  `;

  const printableHtml = brandProfile.layout === "sultan"
    ? renderSultanInvoiceHtml({
        payload,
        brandProfile,
        logoUrl,
        appCssUrl,
        fontsCssUrl,
        billToName,
        beneficiaryName,
        bankMeta,
        valasCurrency,
        isSingleCurrencyBilling,
        hasUsdItems,
        hasSarItems,
        isPaidInvoice,
        notesHtml,
        approvalAssets,
      })
    : `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<meta content="light only" name="color-scheme"/>
<title>${escapeHtml(brandProfile.documentTitle)}</title>
<link as="style" href="${escapeHtml(fontsCssUrl)}" rel="preload"/>
<link as="style" href="${escapeHtml(appCssUrl)}" rel="preload"/>
<link as="image" href="${escapeHtml(logoUrl)}" rel="preload"/>
${approvalAssets.stampDataUrl ? `<link as="image" href="${escapeHtml(approvalAssets.stampDataUrl)}" rel="preload"/>` : ""}
${approvalAssets.signatureDataUrl ? `<link as="image" href="${escapeHtml(approvalAssets.signatureDataUrl)}" rel="preload"/>` : ""}
<link href="${escapeHtml(fontsCssUrl)}" rel="stylesheet"/>
<link href="${escapeHtml(appCssUrl)}" rel="stylesheet"/>
<style>
        :root {
            --invoice-ink: #1a1a1a;
            --invoice-gold: #b8860b;
            --invoice-gold-soft: rgba(184, 134, 11, 0.5);
            --invoice-gold-light: #faf8f2;
            --invoice-border: #e2e8f0;
            --invoice-gray-muted: #718096;
        }
        .print-container,
        .print-container * {
            box-sizing: border-box;
        }
        @page {
            size: A4 portrait;
            margin: 0;
        }
        html,
        body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            overflow: visible;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        body {
            color: var(--invoice-ink);
            font-family: 'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
            text-rendering: geometricPrecision;
            -webkit-font-smoothing: antialiased;
        }
        img {
            image-rendering: -webkit-optimize-contrast;
            image-rendering: high-quality;
        }
        .print-container {
            width: 100%;
            max-width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            padding: 0;
            display: flex;
            flex-direction: column;
            position: relative;
            background: #ffffff;
            overflow: visible;
        }
        
        /* Header / Kop Surat Styles */
        .invoice-header {
            width: 100%;
            background-color: #ffffff !important;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 24px 40px !important;
            border-bottom: 3px double var(--invoice-gold) !important;
            position: relative;
            z-index: 10;
        }
        .invoice-header-left {
            display: flex;
            align-items: center;
            gap: 20px;
        }
        .invoice-header-logo {
            height: 76px;
            width: auto;
            object-fit: contain;
        }
        .invoice-header-info {
            display: flex;
            flex-direction: column;
        }
        .invoice-header-title {
            font-family: 'Outfit', 'Inter', sans-serif;
            font-size: 19px !important;
            font-weight: 800 !important;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #111111 !important;
            margin: 0 !important;
            line-height: 1.2;
        }
        .invoice-header-sub {
            font-family: 'Manrope', 'Inter', sans-serif;
            font-size: 11.5px !important;
            font-weight: 700 !important;
            color: var(--invoice-gold) !important;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            margin-top: 4px !important;
            margin-bottom: 2px !important;
        }
        .invoice-header-address {
            font-size: 9.5px !important;
            line-height: 1.4 !important;
            color: var(--invoice-gray-muted) !important;
            margin: 0 !important;
            max-width: 430px;
        }
        .invoice-header-right {
            text-align: right;
        }
        .invoice-header-doc-label {
            font-family: 'Outfit', 'Inter', sans-serif;
            font-size: 20px !important;
            font-weight: 900 !important;
            letter-spacing: 0.15em;
            color: var(--invoice-gold) !important;
            text-transform: uppercase;
        }

        /* Overview / Metadata Styles */
        .invoice-overview {
            padding: 24px 40px !important;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 20px;
        }
        .invoice-bill-to {
            flex: 1;
            max-width: 60%;
        }
        .invoice-bill-to-title {
            font-size: 11.5px !important;
            font-weight: 800 !important;
            color: var(--invoice-gold) !important;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            margin-bottom: 6px !important;
        }
        .invoice-bill-to-name {
            font-size: 19px !important;
            font-weight: 800 !important;
            color: #111111 !important;
            text-transform: uppercase;
            margin: 0 0 4px 0 !important;
            line-height: 1.2;
        }
        .invoice-bill-to-recipient {
            font-size: 13px !important;
            font-weight: 600 !important;
            color: #4a5568 !important;
            margin: 4px 0 !important;
        }
        .invoice-bill-to-address {
            font-size: 13px !important;
            line-height: 1.4 !important;
            color: var(--invoice-gray-muted) !important;
            margin: 4px 0 0 0 !important;
        }
        
        .invoice-meta-container {
            width: 300px;
            background-color: var(--invoice-gold-light) !important;
            border: 1px solid rgba(184, 134, 11, 0.15) !important;
            border-top: 4px solid var(--invoice-gold) !important;
            border-radius: 6px;
            padding: 20px 24px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.03);
        }
        .invoice-meta-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 7px 0 !important;
            font-size: 12.5px !important;
        }
        .invoice-meta-row:not(:last-child) {
            border-bottom: 1px solid rgba(184, 134, 11, 0.12) !important;
        }
        .invoice-meta-label {
            color: var(--invoice-gray-muted) !important;
            font-weight: 700;
            text-transform: uppercase;
            font-size: 9.5px !important;
            letter-spacing: 0.08em;
        }
        .invoice-meta-value {
            color: #111111 !important;
            font-weight: 700;
        }
        .invoice-meta-value.invoice-num-highlight {
            font-size: 14.5px !important;
            font-weight: 800 !important;
            color: #111111 !important;
        }
        .status-badge {
            display: inline-block;
            padding: 4px 10px;
            font-size: 10.5px !important;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            border-radius: 4px;
            text-align: center;
            line-height: 1;
        }
        .badge-lunas {
            background-color: #ecfdf5 !important;
            color: #047857 !important;
            border: 1px solid #a7f3d0;
        }
        .badge-dp {
            background-color: #f0f9ff !important;
            color: #0369a1 !important;
            border: 1px solid #bae6fd;
        }
        .badge-batal {
            background-color: #fef2f2 !important;
            color: #b91c1c !important;
            border: 1px solid #fecaca;
        }
        .badge-overdue {
            background-color: #fff7ed !important;
            color: #c2410c !important;
            border: 1px solid #ffedd5;
        }
        .badge-awaiting {
            background-color: #fef3c7 !important;
            color: #92400e !important;
            border: 1px solid #fde68a;
        }

        /* Table Styles (Main Focus) */
        .invoice-table-section {
            padding: 8px 40px 16px 40px !important;
            flex-grow: 1;
        }
        .invoice-table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }
        .invoice-table th {
            background-color: var(--invoice-gold-light) !important;
            color: #111111 !important;
            font-size: 11.5px !important;
            font-weight: 700 !important;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            padding: 12px 14px !important;
            border-top: 1px solid var(--invoice-gold-soft) !important;
            border-bottom: 2px solid var(--invoice-gold) !important;
        }
        .invoice-table td {
            font-size: 13px !important;
            color: #2d3748 !important;
            padding: 12px 14px !important;
            border-bottom: 1px solid var(--invoice-border) !important;
            vertical-align: top;
        }
        .invoice-table tr:hover {
            background-color: #fcfbf9 !important;
        }
        .invoice-cell-no {
            text-align: center !important;
            font-weight: 600;
            color: var(--invoice-gray-muted) !important;
        }
        .invoice-row-description {
            font-size: 13.5px !important;
            font-weight: 700 !important;
            color: #111111 !important;
            line-height: 1.3;
            white-space: normal !important;
            word-break: break-word !important;
        }
        .invoice-cell-desc {
            white-space: normal !important;
            word-break: break-word !important;
        }
        .invoice-cell-pax {
            text-align: center !important;
            font-weight: 700;
            color: #111111 !important;
        }
        .invoice-cell-price {
            text-align: right !important;
            font-weight: 600;
            white-space: nowrap !important;
        }
        .invoice-cell-total {
            text-align: right !important;
            font-weight: 700;
            color: #111111 !important;
            white-space: nowrap !important;
        }
        .invoice-cell-total-idr {
            text-align: right !important;
            font-weight: 700;
            color: #111111 !important;
            white-space: nowrap !important;
        }
        .invoice-cell-kurs {
            text-align: right !important;
            font-weight: 600;
            color: var(--invoice-gray-muted) !important;
            white-space: nowrap !important;
        }

        /* Payment Summary & Subtotal Styles */
        .invoice-summary-section {
            padding: 16px 40px !important;
            background-color: #fafaf9 !important;
            border-top: 1px solid var(--invoice-border) !important;
            border-bottom: 1px solid var(--invoice-border) !important;
            display: flex;
            justify-content: space-between;
            gap: 30px;
        }
        .invoice-summary-left {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 16px;
        }
        .invoice-summary-right {
            width: 320px;
        }
        
        .invoice-bank-card, .invoice-rate-card {
            background: #ffffff !important;
            border: 1px solid var(--invoice-border) !important;
            border-radius: 4px;
            padding: 14px !important;
            box-shadow: 0 1px 2px rgba(0,0,0,0.01);
        }
        .invoice-section-title {
            font-size: 11px !important;
            font-weight: 800 !important;
            color: var(--invoice-gold) !important;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            margin-bottom: 8px !important;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .bank-details {
            font-size: 13px !important;
            line-height: 1.5;
            color: #4a5568 !important;
        }
        .bank-details strong {
            color: #111111 !important;
        }
        
        .invoice-subtotal-card {
            background: #ffffff !important;
            border: 1px solid var(--invoice-border) !important;
            border-top: 3px solid var(--invoice-gold) !important;
            border-radius: 4px;
            padding: 20px !important;
        }
        .subtotal-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 13px !important;
            padding: 4px 0;
            color: #4a5568 !important;
        }
        .subtotal-row strong {
            white-space: nowrap !important;
        }
        .subtotal-row.grand-total {
            border-top: 1px solid var(--invoice-border) !important;
            margin-top: 8px !important;
            padding-top: 12px !important;
            font-size: 15px !important;
            font-weight: 800 !important;
            color: #111111 !important;
        }
        .grand-total-label {
            color: var(--invoice-gold) !important;
            text-transform: uppercase;
            font-size: 11px !important;
            letter-spacing: 0.1em;
        }
        .grand-total-value {
            font-size: 21px !important;
            color: #111111 !important;
            font-family: 'Manrope', sans-serif;
            font-weight: 800;
            white-space: nowrap !important;
        }
        
        /* Notes and Signature Styles */
        .invoice-bottom-section {
            padding: 24px 40px !important;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 40px;
        }
        .invoice-notes {
            flex: 1;
            padding-left: 16px !important;
            border-left: 3px solid var(--invoice-gold) !important;
        }
        .invoice-notes-title {
            font-size: 11px !important;
            font-weight: 800 !important;
            color: var(--invoice-gold) !important;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            margin-bottom: 6px !important;
        }
        .invoice-notes-text {
            font-size: 12.5px !important;
            line-height: 1.6;
            color: #1a1a1a !important;
            font-weight: 700 !important;
            margin: 0 !important;
        }
        
        .invoice-signature-block {
            width: 200px;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
        }
        .signature-container {
            position: relative;
            width: 160px;
            height: 70px;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-bottom: 6px;
            border-bottom: 2px solid var(--invoice-gold);
        }
        .signature-img {
            height: 55px;
            width: auto;
            object-fit: contain;
            position: relative;
            z-index: 10;
        }
        .stamp-img {
            height: 75px;
            width: auto;
            object-fit: contain;
            position: absolute;
            top: -12px;
            left: 20px;
            opacity: 0.8;
            transform: rotate(-10deg);
            z-index: 20;
            pointer-events: none;
        }
        .signature-name {
            font-size: 13px !important;
            font-weight: 800 !important;
            color: #111111 !important;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin: 4px 0 2px 0 !important;
        }
        .signature-title {
            font-size: 11px !important;
            font-weight: 700;
            color: var(--invoice-gold) !important;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin: 0 !important;
        }
        
        /* Footer Styles */
        .invoice-footer {
            width: 100%;
            background-color: var(--invoice-gold-light) !important;
            border-top: 1px solid var(--invoice-gold-soft) !important;
            padding: 12px 40px !important;
            text-align: center;
            margin-top: auto;
        }
        .invoice-footer-text {
            font-size: 11px !important;
            font-weight: 600;
            color: var(--invoice-gold) !important;
            letter-spacing: 0.15em;
            text-transform: uppercase;
        }


        .rub-el-hizb-pattern {
            position: relative;
            isolation: isolate;
            background: #ffffff;
        }
        .rub-el-hizb-pattern::before {
            content: "";
            position: absolute;
            inset: 0;
            background-image: url("${escapeHtml(logoUrl)}");
            background-repeat: repeat;
            background-position: 0 0;
            background-size: 170px auto;
            opacity: 0.028;
            pointer-events: none;
            z-index: 0;
        }
        .rub-el-hizb-pattern > * {
            position: relative;
            z-index: 1;
        }

        @media screen {
            html,
            body {
                height: auto;
                min-height: 100%;
                overflow: auto;
                background: #f3f4f6;
            }
            body {
                padding: 24px;
                display: flex;
                justify-content: center;
                align-items: flex-start;
            }
            .print-container {
                margin: 0 auto;
                height: auto;
                min-height: 297mm;
                max-height: none;
                overflow: visible;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
                border-radius: 8px;
                border: 1px solid #e2e8f0;
            }
        }
        @media screen and (max-width: 767px) {
            body {
                padding: 8px;
                justify-content: flex-start;
                overflow-x: auto;
            }
            .print-container {
                margin: 0;
            }
        }
        @media print {
            html,
            body {
                width: 210mm;
                min-width: 210mm;
                height: auto;
                min-height: 297mm;
                margin: 0;
                padding: 0;
                overflow: visible;
                background: white;
            }
            .print-container {
                width: 210mm !important;
                min-width: 210mm !important;
                max-width: 210mm !important;
                height: auto !important;
                min-height: 297mm !important;
                max-height: none !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: visible !important;
                box-shadow: none !important;
                display: flex !important;
                flex-direction: column !important;
            }
            .invoice-header {
                padding: 20px 30px !important;
                border-bottom: 3px double var(--invoice-gold) !important;
            }
            .invoice-overview {
                padding: 20px 30px !important;
            }
            .invoice-table-section {
                padding: 0 30px 10px 30px !important;
            }
            .invoice-summary-section {
                padding: 12px 30px !important;
            }
            .invoice-bottom-section {
                padding: 20px 30px !important;
            }
            .invoice-footer {
                padding: 10px 30px !important;
            }
            
            .invoice-header-title { font-size: 19px !important; }
            .invoice-header-sub { font-size: 11.5px !important; }
            .invoice-header-address { font-size: 9.5px !important; }
            .invoice-bill-to-name { font-size: 19px !important; }
            .invoice-bill-to-recipient { font-size: 13px !important; }
            .invoice-bill-to-address { font-size: 13px !important; }
            .invoice-meta-container { width: 310px !important; }
            .invoice-meta-row { font-size: 13.5px !important; }
            .invoice-meta-label { font-size: 10px !important; }
            .invoice-meta-value { font-size: 13.5px !important; }
            .invoice-meta-value.invoice-num-highlight { font-size: 16px !important; }
            .status-badge { font-size: 11.5px !important; }
            .invoice-section-title { font-size: 11px !important; }
            .bank-details { font-size: 13px !important; }
            .subtotal-row { font-size: 13px !important; }
            .grand-total-label { font-size: 11px !important; }
            .grand-total-value { font-size: 21px !important; }
            .invoice-notes-text { font-size: 12.5px !important; }
            .signature-name { font-size: 13px !important; }
            .signature-title { font-size: 11px !important; }
            
            .invoice-table th {
                font-size: 11.5px !important;
                padding: 12px 14px !important;
                background-color: var(--invoice-gold-light) !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .invoice-table td {
                font-size: 13px !important;
                padding: 12px 14px !important;
            }
            .invoice-row-description {
                font-size: 13.5px !important;
                white-space: normal !important;
                word-break: break-word !important;
            }
            .invoice-cell-desc {
                white-space: normal !important;
                word-break: break-word !important;
            }
            ${columnStyles}
            
            .invoice-payment-block,
            .invoice-bank-card,
            .invoice-rate-card,
            .invoice-subtotal-card,
            .invoice-notes,
            .invoice-signature-block,
            .invoice-table tr {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
    </style>
</head>
<body class="font-body text-luxury-black antialiased">
<div class="print-container bg-white rub-el-hizb-pattern border border-stone-200">
<header class="invoice-header">
<div class="invoice-header-left">
<img alt="Logo" class="invoice-header-logo" decoding="sync" fetchpriority="high" src="${escapeHtml(logoUrl)}"/>
<div class="invoice-header-info">
<h1 class="invoice-header-title">${escapeHtml(brandProfile.brandName)}</h1>
<span class="invoice-header-sub">IZIN PPIU: ${escapeHtml(brandProfile.izinPpiu)}</span>
<p class="invoice-header-address">
${escapeHtml(brandProfile.alamat)}
</p>
</div>
</div>
<div class="invoice-header-right">
<span class="invoice-header-doc-label">INVOICE</span>
</div>
</header>
<section class="invoice-overview">
<div class="invoice-bill-to">
<h2 class="invoice-bill-to-title">Bill To</h2>
<h3 class="invoice-bill-to-name">${escapeHtml(billToName)}</h3>
${payload.recipientName?.trim() ? `<p class="invoice-bill-to-recipient">U.p. / Penerima: <span>${escapeHtml(payload.recipientName)}</span></p>` : ""}
${payload.address?.trim() ? `<p class="invoice-bill-to-address">${escapeHtml(payload.address).replace(/\n/g, "<br/>")}</p>` : ""}
</div>
<div class="invoice-meta-container">
<div class="invoice-meta-row">
<span class="invoice-meta-label">Invoice #</span>
<span class="invoice-meta-value invoice-num-highlight">${escapeHtml(payload.invoiceNumber)}</span>
</div>
<div class="invoice-meta-row">
<span class="invoice-meta-label">Date</span>
<span class="invoice-meta-value">${escapeHtml(formatDateLabel(payload.issueDateIso))}</span>
</div>
${payload.dueDateIso ? `
<div class="invoice-meta-row">
<span class="invoice-meta-label">Due Date</span>
<span class="invoice-meta-value">${escapeHtml(formatDateLabel(payload.dueDateIso))}</span>
</div>
` : ""}
<div class="invoice-meta-row" style="margin-top: 6px; border-top: 1px solid rgba(184, 134, 11, 0.15); padding-top: 8px;">
<span class="invoice-meta-label">Status</span>
<span class="invoice-meta-value">${statusBadgeHtml}</span>
</div>
</div>
</section>
<section class="invoice-table-section">
<table class="invoice-table">
${isSingleCurrencyBilling ? `
<thead>
<tr>
<th style="text-align: center;">No</th>
<th>Uraian</th>
<th style="text-align: center;">Jumlah (PAX)</th>
<th style="text-align: right;">Harga Satuan</th>
<th style="text-align: right;">Total Harga</th>
</tr>
</thead>
` : `
<thead>
<tr>
<th style="text-align: center;">No</th>
<th>Uraian</th>
<th style="text-align: center;">Jumlah (PAX)</th>
<th style="text-align: right;">Harga per Unit</th>
<th style="text-align: right;">Total Harga</th>
<th style="text-align: right;">Total Harga (IDR)</th>
</tr>
</thead>
`}
<tbody class="divide-y divide-stone-100">
${rowsHtml || `<tr><td colspan="${isSingleCurrencyBilling ? 5 : 6}" class="py-6 px-4 text-center text-stone-500 text-sm">No invoice items</td></tr>`}
</tbody>
</table>
</section>
<section class="invoice-summary-section">
<div class="invoice-summary-left">
<div class="invoice-payment-block">
<h3 class="invoice-section-title">
<span class="material-symbols-outlined" style="font-size: 12px; vertical-align: middle;">account_balance</span>
Payment Instructions
</h3>
<div class="invoice-bank-card">
<div class="bank-details">
Account Bank: <strong>${escapeHtml(bankMeta.bankName)}</strong><br/>
Account Number: <strong>${escapeHtml(bankMeta.accountNumber)}</strong><br/>
Penerima / Beneficiary: <strong>${escapeHtml(beneficiaryName.toUpperCase())}</strong>
</div>
</div>
</div>
${isSingleCurrencyBilling && valasCurrency !== "IDR" ? '' : isRupiahOnly ? '' : `
<div class="invoice-rate-block">
<h3 class="invoice-section-title">
<span class="material-symbols-outlined" style="font-size: 12px; vertical-align: middle;">currency_exchange</span>
Exchange Rates
</h3>
<div class="invoice-rate-card">
<div class="bank-details" style="display: flex; flex-direction: column; gap: 4px;">
${hasSarItems ? `
<div style="display: flex; justify-content: space-between;">
<span>Rate SAR/IDR</span>
<strong>IDR ${escapeHtml(formatRate(payload.sarToIdr))}</strong>
</div>
` : ""}
${hasUsdItems ? `
<div style="display: flex; justify-content: space-between;">
<span>Rate USD/IDR</span>
<strong>IDR ${escapeHtml(formatRate(payload.usdToIdr))}</strong>
</div>
` : ""}
</div>
</div>
</div>
`}
</div>
<div class="invoice-summary-right">
<div class="invoice-subtotal-card">
  <div class="invoice-section-title" style="margin-bottom: 4px;">Total Pembayaran</div>
  <div style="border-top: 1px solid var(--invoice-gold); margin-bottom: 12px;"></div>

  <div class="subtotal-row" style="font-size: 12.5px; color: #4a5568; margin-bottom: 6px;">
    <span>Subtotal :</span>
    <strong>${escapeHtml(displaySubtotal)}</strong>
  </div>
  <div class="subtotal-row" style="font-size: 12.5px; color: ${hasDiscount ? "#dc2626" : "#4a5568"}; font-weight: 700; margin-bottom: 8px;">
    <span>Diskon :</span>
    <strong>${hasDiscount ? "- " : ""}${escapeHtml(displayDiscount)}</strong>
  </div>

  <div class="subtotal-row" style="font-size: 13.5px; font-weight: 700; color: #111111; margin-bottom: 8px;">
    <span>Total Tagihan :</span>
    <strong>${escapeHtml(displayTotalPayable)}</strong>
  </div>

  ${payload.payments && payload.payments.length > 0 ? payload.payments.map((p, index) => {
    return `
    <div class="subtotal-row" style="color: #4a5568; font-size: 12.5px; margin-bottom: 6px; align-items: flex-start;">
      <div style="display: flex; flex-direction: column; gap: 1px; text-align: left;">
        <span style="font-weight: 600;">Pembayaran #${index + 1}</span>
        <span style="font-size: 10.5px; color: var(--invoice-gray-muted); font-weight: 500;">${escapeHtml(formatDateLabel(p.dateIso))}</span>
      </div>
      <strong style="align-self: flex-start; text-align: right;">${escapeHtml(formatCurrency(p.amount, valasCurrency))}</strong>
    </div>`;
  }).join("") : ""}

  ${!isPaidInvoice ? `
  <div class="subtotal-row" style="border-top: 1px solid var(--invoice-border); margin-top: 12px; padding-top: 12px; font-size: 12.5px; color: #dc2626; font-weight: 800; text-transform: uppercase;">
    <span>Sisa Tagihan :</span>
    <strong>${escapeHtml(displayRemainingBalance)}</strong>
  </div>
  ` : ""}

  <div class="subtotal-row" style="${isPaidInvoice ? 'border-top: 1px solid var(--invoice-border); margin-top: 12px; padding-top: 12px;' : 'margin-top: 6px;'} font-size: 14px; font-weight: 800;">
    <span style="color: var(--invoice-gold); font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase;">Status :</span>
    <span style="color: ${isPaidInvoice ? '#047857' : '#dc2626'}; text-transform: uppercase;">
      ${isPaidInvoice ? 'Lunas' : 'Belum Lunas'}
    </span>
  </div>
</div>
</div>
</section>
<section class="invoice-bottom-section">
<div class="invoice-notes">
<h3 class="invoice-notes-title">Message / Catatan</h3>
<p class="invoice-notes-text">${notesHtml}</p>
</div>
<div class="invoice-signature-block">
<div class="signature-container">
${approvalAssets.signatureDataUrl ? `<img alt="Tanda tangan terotorisasi" class="signature-img" decoding="sync" src="${escapeHtml(approvalAssets.signatureDataUrl)}"/>` : ""}
${approvalAssets.stampDataUrl ? `<img alt="Cap terotorisasi" class="stamp-img" decoding="sync" src="${escapeHtml(approvalAssets.stampDataUrl)}"/>` : ""}
${!approvalAssets.signatureDataUrl && !approvalAssets.stampDataUrl ? `<span class="text-xs">Dokumen dibuat oleh sistem. Aset persetujuan belum tersedia.</span>` : ""}
</div>
<p class="signature-name">${escapeHtml(brandProfile.directorName)}</p>
<p class="signature-title">${escapeHtml(brandProfile.directorTitle)}</p>
</div>
</section>
<footer class="invoice-footer">
<span class="invoice-footer-text">${escapeHtml(brandProfile.footerText)}</span>
</footer>
</div>
</body></html>`;

  printableWindow.document.open();
  printableWindow.document.write(printableHtml);
  printableWindow.document.close();

  void finalizePrintWindow(printableWindow, iframe).catch(() => {
    window.setTimeout(() => {
      try {
        printableWindow.focus();
        printableWindow.print();
      } catch {
        // ignore
      }
      window.setTimeout(() => {
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch {
          // ignore
        }
      }, 15000);
    }, PRINT_TRIGGER_DELAY_MS);
  });

  return true;
}
