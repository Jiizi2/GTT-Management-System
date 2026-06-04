import { escapeHtml } from "../shared/app-domain";

export type InvoiceExportCurrency = "IDR" | "USD" | "SAR";

export type InvoiceExportLineItem = {
  description: string;
  pax: number;
  currency: InvoiceExportCurrency;
  unitPrice: number;
  totalPrice: number;
  totalPriceIdr: number;
};

export type InvoiceExportPayload = {
  invoiceNumber: string;
  issueDateIso: string;
  dueDateIso: string;
  statusLabel?: string;
  issuingOffice: string;
  clientName: string;
  clientCode: string;
  address: string;
  bankAccountLabel: string;
  notes: string;
  usdToIdr: number;
  sarToIdr: number;
  subtotalIdr: number;
  taxIdr: number;
  totalPayableIdr: number;
  downPaymentIdr: number;
  remainingBalanceIdr: number;
  items: InvoiceExportLineItem[];
};

type InvoiceExportWindowOptions = {
  printWindow?: Window | null;
};

const PRINT_TRIGGER_DELAY_MS = 180;
const PRINT_FALLBACK_TIMEOUT_MS = 4_500;
const RESOURCE_WAIT_TIMEOUT_MS = 2_500;

const companyProfile = {
  brandName: "Ghaniya Tour and Travel",
  directorName: "Husein Ghanim",
  directorTitle: "Director",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(value)));
}

function formatRate(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, value));
}

function formatCurrency(value: number, currency: InvoiceExportCurrency): string {
  return `${currency} ${formatNumber(value)}`;
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

  if (payload.remainingBalanceIdr <= 0) {
    return "Paid";
  }

  if (payload.downPaymentIdr > 0) {
    return "Partial Payment";
  }

  return "Awaiting Payment";
}

function resolveTaxPercentage(payload: InvoiceExportPayload): number {
  if (payload.subtotalIdr <= 0) {
    return 0;
  }

  return Math.max(0, Math.round((payload.taxIdr / payload.subtotalIdr) * 100));
}

function resolveOutstandingBalanceLabel(payload: InvoiceExportPayload): string {
  if (payload.remainingBalanceIdr <= 0) {
    return "Lunas";
  }

  return payload.downPaymentIdr > 0 ? "Sisa Tagihan" : "Tagihan";
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

function resolvePrintableWindow(options: InvoiceExportWindowOptions): Window | null {
  const reusableWindow = options.printWindow;
  if (reusableWindow && !reusableWindow.closed) {
    return reusableWindow;
  }

  const isCompactViewport = window.innerWidth < 768;
  return isCompactViewport ? window.open("", "_blank") : window.open("", "_blank", "width=1180,height=860");
}

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

async function finalizePrintWindow(printableWindow: Window): Promise<void> {
  let printTriggered = false;
  const triggerPrint = () => {
    if (printTriggered || printableWindow.closed) {
      return;
    }

    printTriggered = true;
    printableWindow.focus();
    printableWindow.print();
  };

  const waitForResources = Promise.allSettled([
    waitForDocumentLoad(printableWindow),
    waitForStylesheets(printableWindow),
    waitForFonts(printableWindow),
    waitForImages(printableWindow),
  ]);

  await Promise.race([waitForResources, waitForTimeout(PRINT_FALLBACK_TIMEOUT_MS)]);

  if (printableWindow.closed) {
    return;
  }

  window.setTimeout(triggerPrint, PRINT_TRIGGER_DELAY_MS);
}

export async function exportInvoicePdf(
  payload: InvoiceExportPayload,
  options: InvoiceExportWindowOptions = {},
): Promise<boolean> {
  const printableWindow = resolvePrintableWindow(options);
  if (!printableWindow) {
    return false;
  }

  try {
    printableWindow.opener = null;
  } catch {
    // Some browsers expose a restricted window handle when opener is unavailable.
  }

  const logoUrl = new URL("/logo-ghaniya-travel-polos.png", window.location.origin).toString();
  const capUrl = new URL("/cap-ghaniya.png", window.location.origin).toString();
  const signatureUrl = new URL("/ttd-husein.png", window.location.origin).toString();
  const appCssUrl = new URL("/index.css", window.location.origin).toString();
  const fontsCssUrl = new URL("/fonts.css", window.location.origin).toString();
  const statusLabel = resolvePaymentStatusLabel(payload);
  const isPaidInvoice = isPaidStatusLabel(statusLabel, payload.remainingBalanceIdr);
  const printableStatusLabel = isPaidInvoice ? "Lunas" : statusLabel;
  const taxPercentage = resolveTaxPercentage(payload);
  const bankMeta = resolveBankMeta(payload.bankAccountLabel);
  const billToName = resolveBillToName(payload);

  const rowsHtml = payload.items
    .map((item, index) => {
      const totalPriceLabel =
        isIdrCurrency(item.currency) || item.totalPriceIdr === item.totalPrice
          ? "-"
          : formatCurrency(item.totalPrice, item.currency);
      return `
<tr class="invoice-line-row group hover:bg-stone-50 transition-colors">
<td class="py-4 px-4 text-luxury-black font-semibold text-sm">${String(index + 1).padStart(2, "0")}</td>
<td class="py-4 px-4">
<div class="invoice-row-description font-bold text-luxury-black">${escapeHtml(item.description)}</div>
</td>
<td class="py-4 px-4 text-left font-bold text-sm text-luxury-black">${escapeHtml(formatNumber(item.pax))}</td>
<td class="py-4 px-4 text-left font-manrope text-sm font-bold text-luxury-black">${escapeHtml(formatCurrency(item.unitPrice, item.currency))}</td>
<td class="py-4 px-4 text-left font-bold font-manrope text-luxury-black">${escapeHtml(totalPriceLabel)}</td>
<td class="py-4 px-4 text-left font-bold font-manrope text-luxury-black">${escapeHtml(formatIdr(item.totalPriceIdr))}</td>
<td class="py-4 px-4 text-center text-stone-400 font-semibold text-sm">-</td>
</tr>`;
    })
    .join("");

  const notesHtml = payload.notes.trim()
    ? escapeHtml(payload.notes).replace(/\n/g, "<br/>")
    : "Thank you for choosing Ghaniya Tour and Travel for your spiritual pilgrimage. We look forward to serving your group.";

  const printableHtml = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<meta content="light only" name="color-scheme"/>
<title>Invoice - Ghaniya Tour and Travel</title>
<link as="style" href="${escapeHtml(fontsCssUrl)}" rel="preload"/>
<link as="style" href="${escapeHtml(appCssUrl)}" rel="preload"/>
<link as="image" href="${escapeHtml(logoUrl)}" rel="preload"/>
<link as="image" href="${escapeHtml(capUrl)}" rel="preload"/>
<link as="image" href="${escapeHtml(signatureUrl)}" rel="preload"/>
<link href="${escapeHtml(fontsCssUrl)}" rel="stylesheet"/>
<link href="${escapeHtml(appCssUrl)}" rel="stylesheet"/>
<style>
        :root {
            --invoice-ink: #111111;
            --invoice-gold: #D4AF37;
            --invoice-gold-soft: rgba(212, 175, 55, 0.72);
            --invoice-black: #1A1A1A;
        }
        .print-container,
        .print-container * {
            color: var(--invoice-ink);
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
            display: block;
            text-rendering: geometricPrecision;
            -webkit-font-smoothing: subpixel-antialiased;
            font-smooth: always;
        }
        img {
            image-rendering: -webkit-optimize-contrast;
            image-rendering: high-quality;
        }
        .print-container {
            width: 210mm;
            min-width: 210mm;
            max-width: 210mm;
            height: 297mm;
            min-height: 297mm;
            max-height: 297mm;
            margin: 0;
            padding: 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            position: relative;
            background: #ffffff;
            page-break-after: avoid;
            break-after: avoid;
        }
        .invoice-paid-stamp {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: relative;
            min-width: 36mm;
            min-height: 14mm;
            border: 2.5px solid #047857;
            background: rgba(236, 253, 245, 0.5);
            color: #047857 !important;
            border-radius: 7px;
            padding: 3mm 5mm;
            font-size: 1.75rem;
            font-weight: 900;
            line-height: 1;
            text-transform: uppercase;
            transform: rotate(-6deg);
            box-shadow: inset 0 0 0 3px rgba(4, 120, 87, 0.16), 0 4px 10px rgba(4, 120, 87, 0.12);
        }
        .invoice-paid-stamp::before {
            content: "";
            position: absolute;
            inset: 3px;
            border: 1px solid rgba(4, 120, 87, 0.7);
            border-radius: 4px;
        }
        .invoice-paid-stamp span {
            position: relative;
            z-index: 1;
            color: #047857 !important;
        }
        .invoice-paid-total {
            border-color: #059669 !important;
            background: #ecfdf5 !important;
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
                padding: 12px;
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
                box-shadow: 0 18px 40px rgba(15, 23, 42, 0.14);
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
            }
            header {
                background-color: var(--invoice-black) !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .invoice-header-brand {
                color: var(--invoice-gold) !important;
            }
            .invoice-header-subtitle {
                color: var(--invoice-gold) !important;
            }
            .invoice-header-doc-label {
                color: var(--invoice-gold-soft) !important;
            }
            .invoice-total-due-row {
                background: transparent !important;
                color: var(--invoice-ink) !important;
                border-top: 2px solid var(--invoice-gold) !important;
                box-shadow: none !important;
            }
            .invoice-paid-stamp,
            .invoice-paid-total {
                border-color: #059669 !important;
                background: #ecfdf5 !important;
                color: #047857 !important;
            }
            .invoice-paid-stamp::before {
                border-color: rgba(4, 120, 87, 0.7) !important;
            }
            .invoice-paid-stamp * {
                color: #047857 !important;
            }
            .invoice-total-due-label {
                color: var(--invoice-gold) !important;
            }
            .invoice-total-due-value {
                color: var(--invoice-ink) !important;
            }
            .invoice-payment-block,
            .invoice-meta-card,
            .invoice-summary-block,
            .invoice-subtotal-block,
            .invoice-notes-block,
            .invoice-signature-block,
            .invoice-line-row {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            .invoice-block {
                break-inside: avoid !important;
                page-break-inside: avoid !important;
            }
            .invoice-overview-block {
                margin-bottom: 4mm !important;
                padding-top: 5mm !important;
                padding-bottom: 4mm !important;
            }
            .invoice-table-block {
                margin-top: 0 !important;
                padding-top: 0 !important;
                padding-bottom: 0 !important;
            }
            .invoice-main-title {
                font-size: 2.4rem !important;
                line-height: 0.95 !important;
                margin-bottom: 3mm !important;
            }
            .invoice-bill-to-name {
                font-size: 0.98rem !important;
                line-height: 1.25 !important;
                letter-spacing: 0.07em !important;
            }
            .invoice-meta-card {
                padding: 4mm !important;
                font-size: 10px !important;
            }
            .invoice-table-block .w-full {
                overflow: visible !important;
            }
            .invoice-table-block table {
                width: 100% !important;
                table-layout: fixed;
            }
            .invoice-table-block thead {
                display: table-header-group;
            }
            .invoice-table-block tbody {
                display: table-row-group;
            }
            .invoice-table th:nth-child(7),
            .invoice-table td:nth-child(7) {
                display: none !important;
            }
            .invoice-table th:nth-child(1),
            .invoice-table td:nth-child(1) { width: 5%; }
            .invoice-table th:nth-child(2),
            .invoice-table td:nth-child(2) { width: 31%; }
            .invoice-table th:nth-child(3),
            .invoice-table td:nth-child(3) { width: 12%; }
            .invoice-table th:nth-child(4),
            .invoice-table td:nth-child(4) { width: 19%; }
            .invoice-table th:nth-child(5),
            .invoice-table td:nth-child(5) { width: 15%; }
            .invoice-table th:nth-child(6),
            .invoice-table td:nth-child(6) { width: 18%; }
            .invoice-table th {
                font-size: 6.8px !important;
                line-height: 1.2 !important;
                padding: 1.4mm 1.1mm !important;
                white-space: normal !important;
                word-break: break-word !important;
                vertical-align: bottom !important;
            }
            .invoice-table td {
                font-size: 9px !important;
                line-height: 1.25 !important;
                padding: 1.8mm 1.1mm !important;
                word-break: break-word !important;
                vertical-align: top !important;
            }
            .invoice-row-description {
                font-size: 10px !important;
                line-height: 1.25 !important;
            }
            .invoice-payment-summary-section {
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
                gap: 4mm !important;
                align-items: start !important;
            }
            .invoice-payment-summary-section > .invoice-payment-block,
            .invoice-payment-summary-section > .invoice-summary-block {
                min-width: 0 !important;
                width: auto !important;
            }
            .invoice-payment-summary-section > .invoice-subtotal-block {
                grid-column: 1 / -1 !important;
            }
            .invoice-bank-card,
            .invoice-rate-card {
                min-height: 36mm !important;
            }
            .invoice-subtotal-card {
                border-top-width: 2px !important;
                border-top-color: var(--invoice-gold) !important;
            }
            .invoice-subtotal-label {
                color: var(--invoice-gold) !important;
            }
            .invoice-subtotal-value {
                color: var(--invoice-ink) !important;
            }
            thead,
            tbody,
            tr,
            td,
            th {
                break-inside: avoid;
                page-break-inside: avoid;
            }
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
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
        .luxury-gradient {
            background: linear-gradient(135deg, #1A1A1A 0%, #333333 100%);
        }
        .invoice-header-brand {
            color: var(--invoice-gold) !important;
        }
        .invoice-header-subtitle {
            color: var(--invoice-gold) !important;
        }
        .invoice-header-doc-label {
            color: var(--invoice-gold-soft) !important;
        }
        .invoice-total-due-row {
            background: transparent !important;
            color: var(--invoice-ink) !important;
            border-top: 2px solid var(--invoice-gold) !important;
            box-shadow: none !important;
        }
        .invoice-section-accent,
        .invoice-accent-icon {
            color: var(--invoice-gold) !important;
        }
        .invoice-status-label,
        .invoice-status-value {
            color: var(--invoice-ink) !important;
        }
        .invoice-total-due-label {
            color: var(--invoice-gold) !important;
        }
        .invoice-total-due-value {
            color: var(--invoice-ink) !important;
        }
        .invoice-footer {
            border-top: 2px solid var(--invoice-gold) !important;
        }
        .invoice-footer,
        .invoice-footer * {
            color: var(--invoice-gold) !important;
        }
        .invoice-footer-muted {
            color: var(--invoice-gold-soft) !important;
        }
        .gold-border {
            border-image: linear-gradient(to bottom, #D4AF37, #B8860B) 1;
        }
    </style>
</head>
<body class="font-body text-luxury-black antialiased">
<div class="print-container bg-white rub-el-hizb-pattern border border-stone-200">
<header class="w-full luxury-gradient flex justify-between items-center px-10 py-7 relative z-10 border-b-4 border-gold-primary">
<div class="flex items-center gap-6">
<img alt="Logo" class="h-16 w-auto object-contain" decoding="sync" fetchpriority="high" src="${escapeHtml(logoUrl)}"/>
<div class="flex flex-col">
<span class="invoice-header-brand font-bold text-xl uppercase tracking-[0.3em] font-headline">Ghaniya Tour</span>
<span class="invoice-header-subtitle font-manrope text-xl font-light tracking-tight">Umrah Group Summary</span>
</div>
</div>
<div class="text-right">
<span class="invoice-header-doc-label uppercase tracking-[0.3em] text-[10px] font-bold">Official Document</span>
</div>
</header>
<section class="invoice-block invoice-overview-block px-10 py-6 grid grid-cols-12 gap-5 items-start">
<div class="col-span-7">
<h1 class="invoice-main-title font-headline text-5xl font-extrabold text-luxury-black tracking-tighter mb-4">INVOICE</h1>
${isPaidInvoice ? '<div class="invoice-paid-stamp mb-5"><span>LUNAS</span></div>' : ""}
<div class="space-y-1">
<h2 class="invoice-bill-to-name text-lg font-bold uppercase text-luxury-black">BILL TO: ${escapeHtml(billToName)}</h2>
</div>
</div>
<div class="invoice-meta-card col-span-5 bg-stone-50 p-5 border-t-2 border-luxury-black space-y-3">
<div class="flex justify-between">
<span class="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Invoice #</span>
<span class="font-bold text-luxury-black">${escapeHtml(payload.invoiceNumber)}</span>
</div>
<div class="flex justify-between">
<span class="text-stone-500 text-[10px] font-bold uppercase tracking-widest">Date</span>
<span class="font-bold text-luxury-black">${escapeHtml(formatDateLabel(payload.issueDateIso))}</span>
</div>
<div class="pt-4 border-t border-stone-200">
<div class="flex justify-between items-center">
<span class="invoice-status-label font-bold text-[10px] uppercase tracking-widest">Status</span>
<span class="invoice-status-value text-[10px] font-bold uppercase tracking-widest">${escapeHtml(printableStatusLabel)}</span>
</div>
</div>
</div>
</section>
<section class="invoice-block invoice-table-block px-10 py-2">
<div class="w-full overflow-hidden">
<table class="invoice-table min-w-full border-collapse text-left">
<thead class="border-b border-stone-300 bg-stone-100/90">
<tr class="text-luxury-black">
<th class="py-3 px-4 font-headline text-[9px] font-extrabold uppercase tracking-[0.13em] text-stone-500">No</th>
<th class="py-3 px-4 font-headline text-[9px] font-extrabold uppercase tracking-[0.13em] text-stone-500">Uraian</th>
<th class="py-3 px-4 font-headline text-[9px] font-extrabold uppercase tracking-[0.13em] text-stone-500">Jumlah (PAX)</th>
<th class="py-3 px-4 font-headline text-[9px] font-extrabold uppercase tracking-[0.13em] text-stone-500">Harga per Unit (PAX)</th>
<th class="py-3 px-4 font-headline text-[9px] font-extrabold uppercase tracking-[0.13em] text-stone-500">Total Harga</th>
<th class="py-3 px-4 font-headline text-[9px] font-extrabold uppercase tracking-[0.13em] text-stone-500">Total Harga (IDR)</th>
<th class="py-3 px-4 font-headline text-[9px] font-extrabold uppercase tracking-[0.13em] text-stone-500">Action</th>
</tr>
</thead>
<tbody class="divide-y divide-stone-100">
${rowsHtml || '<tr><td colspan="7" class="py-6 px-4 text-center text-stone-500 text-sm">No invoice items</td></tr>'}
</tbody>
</table>
</div>
</section>
<section class="invoice-block invoice-payment-summary-section grid grid-cols-1 gap-4 px-10 py-4 bg-stone-50/50 lg:grid-cols-2 items-start">
<div class="invoice-payment-block space-y-3">
<h3 class="invoice-section-accent text-[9px] font-extrabold uppercase tracking-[0.25em] mb-1">Payment Instructions</h3>
<div class="invoice-bank-card bg-white p-4 border border-stone-200 shadow-sm">
<div class="flex items-center gap-2 mb-2">
<span class="invoice-accent-icon material-symbols-outlined">account_balance</span>
<span class="font-bold text-luxury-black uppercase tracking-[0.18em] text-[13px]">${escapeHtml(bankMeta.bankName)}</span>
</div>
<p class="text-[11px] text-stone-500 mb-1">Account Number: <span class="font-bold text-luxury-black text-[13px]">${escapeHtml(bankMeta.accountNumber)}</span></p>
<p class="text-[11px] text-stone-500">Beneficiary: <span class="font-bold text-luxury-black uppercase tracking-wider text-[13px]">${escapeHtml(companyProfile.brandName.toUpperCase())}</span></p>
</div>
</div>
<div class="invoice-summary-block invoice-rate-block space-y-3">
<h3 class="invoice-section-accent text-[9px] font-extrabold uppercase tracking-[0.25em] mb-1">Exchange Rates</h3>
<div class="invoice-rate-card bg-white p-4 border border-stone-200 shadow-sm">
<div class="space-y-2">
<div class="flex justify-between items-center gap-4 border-b border-stone-100 pb-2">
<span class="text-[8px] text-stone-400 font-bold uppercase tracking-widest">Rate SAR/IDR</span>
<span class="font-bold text-[13px] text-luxury-black">IDR ${escapeHtml(formatRate(payload.sarToIdr))}</span>
</div>
<div class="flex justify-between items-center gap-4 pt-1">
<span class="text-[8px] text-stone-400 font-bold uppercase tracking-widest">Rate USD/IDR</span>
<span class="font-bold text-[13px] text-luxury-black">IDR ${escapeHtml(formatRate(payload.usdToIdr))}</span>
</div>
</div>
</div>
</div>
<div class="invoice-subtotal-block lg:col-span-2">
<div class="invoice-subtotal-card bg-white p-4 border border-stone-200 shadow-sm">
<div class="flex justify-between items-end gap-4 border-b border-stone-100 pb-2 mb-2">
<span class="invoice-subtotal-label text-[9px] font-extrabold uppercase tracking-[0.25em]">Subtotal</span>
<span class="invoice-subtotal-value font-manrope text-2xl font-extrabold tracking-tight text-right">${escapeHtml(formatIdr(payload.subtotalIdr))}</span>
</div>
<div class="space-y-1.5">
<div class="flex justify-between items-center text-[11px]">
<span class="text-stone-500 font-medium">Tax (${taxPercentage}%)</span>
<span class="font-manrope font-semibold text-luxury-black">${escapeHtml(formatIdr(payload.taxIdr))}</span>
</div>
<div class="flex justify-between items-center text-[11px]">
<span class="text-stone-500 font-medium">Yang harus dibayarkan</span>
<span class="font-manrope font-semibold text-luxury-black">${escapeHtml(formatIdr(payload.totalPayableIdr))}</span>
</div>
<div class="flex justify-between items-center text-[11px]">
<span class="text-stone-500 font-medium">DP</span>
<span class="font-manrope font-semibold text-red-700">${escapeHtml(formatIdr(payload.downPaymentIdr))}</span>
</div>
</div>
<div class="invoice-total-due-row mt-2 flex justify-between items-center py-2.5 ${isPaidInvoice ? "invoice-paid-total px-3 rounded-xl" : ""}">
<span class="invoice-total-due-label font-bold uppercase tracking-[0.2em] text-[9px]">${escapeHtml(resolveOutstandingBalanceLabel(payload))}</span>
<span class="invoice-total-due-value font-manrope text-lg font-extrabold tracking-tight">${escapeHtml(formatIdr(payload.remainingBalanceIdr))}</span>
</div>
</div>
</section>
<section class="invoice-block px-10 py-4 grid grid-cols-2 gap-6 border-t border-stone-100 items-start">
<div class="invoice-notes-block space-y-3">
<div>
<p class="text-[10px] font-extrabold text-luxury-black uppercase tracking-widest mb-1.5">Message</p>
<p class="text-xs text-stone-500 leading-relaxed">${notesHtml}</p>
</div>
</div>
<div class="invoice-signature-block flex flex-col items-center justify-start pt-1">
<div class="w-48 border-b-2 border-gold-primary mb-2 relative pb-2 pt-3 flex justify-center">
<img alt="Cap Ghaniya" class="h-16 w-auto object-contain opacity-25 absolute -top-6 left-1/2 -translate-x-1/2" decoding="sync" fetchpriority="high" src="${escapeHtml(capUrl)}"/>
<img alt="Tanda Tangan Husein" class="h-14 w-auto object-contain relative z-10" decoding="sync" fetchpriority="high" src="${escapeHtml(signatureUrl)}"/>
</div>
<p class="font-bold text-luxury-black uppercase tracking-[0.25em] text-[10px]">${escapeHtml(companyProfile.directorName)}</p>
<p class="invoice-section-accent text-[8px] font-bold uppercase tracking-widest mt-1">${escapeHtml(companyProfile.directorTitle)}</p>
</div>
</section>
<footer class="invoice-footer flex justify-center items-center w-full px-10 py-2 mt-auto luxury-gradient border-t-2 border-gold-primary">
<span class="invoice-footer-muted font-inter text-[8pt] uppercase tracking-[0.2em]">© 2026 Ghaniya Tour</span>
</footer>
</div>
</body></html>`;

  printableWindow.document.open();
  printableWindow.document.write(printableHtml);
  printableWindow.document.close();

  void finalizePrintWindow(printableWindow).catch(() => {
    if (printableWindow.closed) {
      return;
    }

    window.setTimeout(() => {
      if (printableWindow.closed) {
        return;
      }

      printableWindow.focus();
      printableWindow.print();
    }, PRINT_TRIGGER_DELAY_MS);
  });

  return true;
}
