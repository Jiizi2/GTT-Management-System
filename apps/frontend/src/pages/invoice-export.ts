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
  recipientName?: string;
  bankAccountRecipient?: string;
  bankAccountLabel: string;
  notes: string;
  usdToIdr: number;
  sarToIdr: number;
  currency: InvoiceExportCurrency;
  subtotal: number;
  tax: number;
  totalPayable: number;
  downPayment: number;
  remainingBalance: number;
  items: InvoiceExportLineItem[];
};

type InvoiceExportWindowOptions = {
  printWindow?: Window | null;
};

const PRINT_TRIGGER_DELAY_MS = 180;
const PRINT_FALLBACK_TIMEOUT_MS = 4_500;
const RESOURCE_WAIT_TIMEOUT_MS = 2_500;

const companyProfile = {
  brandName: "PT.Ghaniya Zilia Rahman",
  directorName: "Husein Ghanim",
  directorTitle: "Director",
  izinPpiu: "SK NO U.419 TAHUN 2021",
  alamat: "Graha Al Badegel Jl. Hajjah Tutty Alawiyah No.7, RT.2/RW.5, Kalibata, Kec. Pancoran, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta",
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


export async function exportInvoicePdf(
  payload: InvoiceExportPayload,
  _options: InvoiceExportWindowOptions = {},
): Promise<boolean> {
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

  const logoUrl = new URL("/logo-ghaniya-travel-polos.png", window.location.origin).toString();
  const capUrl = new URL("/cap-ghaniya.png", window.location.origin).toString();
  const signatureUrl = new URL("/ttd-husein.png", window.location.origin).toString();
  const appCssUrl = new URL("/index.css", window.location.origin).toString();
  const fontsCssUrl = new URL("/fonts.css", window.location.origin).toString();
  const statusLabel = resolvePaymentStatusLabel(payload);
  const isPaidInvoice = isPaidStatusLabel(statusLabel, payload.remainingBalance);
  const printableStatusLabel = isPaidInvoice ? "Lunas" : statusLabel;
  const taxPercentage = resolveTaxPercentage(payload);
  const bankMeta = resolveBankMeta(payload.bankAccountLabel);
  const billToName = resolveBillToName(payload);
  const beneficiaryName = payload.bankAccountRecipient?.trim() || companyProfile.brandName;

  const valasCurrency = payload.currency || "IDR";
  const isRupiahOnly = payload.items.every((item) => isIdrCurrency(item.currency));
  const isSingleCurrencyBilling = valasCurrency !== "IDR" || isRupiahOnly;

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
            unitPriceValas = item.unitPrice * itemRate;
            totalPriceValas = itemPriceIdr;
          } else {
            totalPriceValas = rate > 0 ? Math.ceil(itemPriceIdr / rate) : 0;
            unitPriceValas = item.pax > 0 ? Math.ceil(totalPriceValas / item.pax) : 0;
          }
        }

        return `
<tr class="invoice-line-row">
<td class="invoice-cell-no">${String(index + 1).padStart(2, "0")}</td>
<td class="invoice-cell-desc">
<div class="invoice-row-description">${escapeHtml(item.description)}</div>
</td>
<td class="invoice-cell-pax">${escapeHtml(formatNumber(item.pax))}</td>
<td class="invoice-cell-price">${escapeHtml(formatCurrency(unitPriceValas, valasCurrency))}</td>
<td class="invoice-cell-total">${escapeHtml(formatCurrency(totalPriceValas, valasCurrency))}</td>
</tr>`;
      } else {
        const totalPriceLabel = formatCurrency(item.totalPrice, item.currency);
        const kursLabel = isIdrCurrency(item.currency)
          ? "-"
          : `IDR ${formatRate(item.currency === "USD" ? payload.usdToIdr : payload.sarToIdr)}`;
        return `
<tr class="invoice-line-row">
<td class="invoice-cell-no">${String(index + 1).padStart(2, "0")}</td>
<td class="invoice-cell-desc">
<div class="invoice-row-description">${escapeHtml(item.description)}</div>
</td>
<td class="invoice-cell-pax">${escapeHtml(formatNumber(item.pax))}</td>
<td class="invoice-cell-price">${escapeHtml(formatCurrency(item.unitPrice, item.currency))}</td>
<td class="invoice-cell-kurs">${escapeHtml(kursLabel)}</td>
<td class="invoice-cell-total">${escapeHtml(totalPriceLabel)}</td>
<td class="invoice-cell-total-idr">${escapeHtml(formatIdr(item.totalPriceIdr))}</td>
</tr>`;
      }
    })
    .join("");

  const cleanNotes = payload.notes
    .replace(/\[KeepValasTotal:[A-Z]+\]/g, "")
    .replace(/\[KeepValasTotal\]/g, "")
    .replace(/\[Rates:USD=\d+,SAR=\d+\]/g, "")
    .trim();

  const notesHtml = cleanNotes
    ? escapeHtml(cleanNotes).replace(/\n/g, "<br/>")
    : "Thank you for choosing Ghaniya Tour & Travel for your spiritual pilgrimage. We look forward to serving your group.";

  const displaySubtotal = formatCurrency(payload.subtotal, valasCurrency);
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
            .invoice-table th:nth-child(1), .invoice-table td:nth-child(1) { width: 5%; }
            .invoice-table th:nth-child(2), .invoice-table td:nth-child(2) { width: 30%; }
            .invoice-table th:nth-child(3), .invoice-table td:nth-child(3) { width: 10%; }
            .invoice-table th:nth-child(4), .invoice-table td:nth-child(4) { width: 14%; }
            .invoice-table th:nth-child(5), .invoice-table td:nth-child(5) { width: 11%; }
            .invoice-table th:nth-child(6), .invoice-table td:nth-child(6) { width: 15%; }
            .invoice-table th:nth-child(7), .invoice-table td:nth-child(7) { width: 15%; }
  `;

  const printableHtml = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<meta content="light only" name="color-scheme"/>
<title>Invoice - Ghaniya Tour & Travel</title>
<link as="style" href="${escapeHtml(fontsCssUrl)}" rel="preload"/>
<link as="style" href="${escapeHtml(appCssUrl)}" rel="preload"/>
<link as="image" href="${escapeHtml(logoUrl)}" rel="preload"/>
<link as="image" href="${escapeHtml(capUrl)}" rel="preload"/>
<link as="image" href="${escapeHtml(signatureUrl)}" rel="preload"/>
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
            line-height: 1.5;
            color: var(--invoice-gray-muted) !important;
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
<h1 class="invoice-header-title">PT. Ghaniya Zilia Rahman</h1>
<span class="invoice-header-sub">IZIN PPIU: SK NO U.419 TAHUN 2021</span>
<p class="invoice-header-address">
Graha Al Badegel Jl. Hajjah Tutty Alawiyah No.7, RT.2/RW.5, Kalibata, Kec. Pancoran, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta
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
<div class="invoice-meta-row">
<span class="invoice-meta-label">Due Date</span>
<span class="invoice-meta-value">${escapeHtml(formatDateLabel(payload.dueDateIso))}</span>
</div>
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
<th style="text-align: right;">Kurs</th>
<th style="text-align: right;">Total Harga</th>
<th style="text-align: right;">Total Harga (IDR)</th>
</tr>
</thead>
`}
<tbody class="divide-y divide-stone-100">
${rowsHtml || `<tr><td colspan="${isSingleCurrencyBilling ? 5 : 7}" class="py-6 px-4 text-center text-stone-500 text-sm">No invoice items</td></tr>`}
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
<div style="display: flex; justify-content: space-between;">
<span>Rate SAR/IDR</span>
<strong>IDR ${escapeHtml(formatRate(payload.sarToIdr))}</strong>
</div>
<div style="display: flex; justify-content: space-between;">
<span>Rate USD/IDR</span>
<strong>IDR ${escapeHtml(formatRate(payload.usdToIdr))}</strong>
</div>
</div>
</div>
</div>
`}
</div>
<div class="invoice-summary-right">
<div class="invoice-subtotal-card">
<div class="subtotal-row">
<span>Subtotal</span>
<strong>${escapeHtml(displaySubtotal)}</strong>
</div>
${payload.tax > 0 ? `
<div class="subtotal-row">
<span>Tax (${taxPercentage}%)</span>
<strong>${escapeHtml(formatCurrency(payload.tax, valasCurrency))}</strong>
</div>
` : ''}
${payload.downPayment > 0 ? `
<div class="subtotal-row">
<span>Total Tagihan</span>
<strong>${escapeHtml(displayTotalPayable)}</strong>
</div>
<div class="subtotal-row" style="color: #dc2626;">
<span>Uang Muka / DP</span>
<strong>-${escapeHtml(displayDownPayment)}</strong>
</div>
` : ''}
<div class="subtotal-row grand-total ${isPaidInvoice ? 'invoice-paid-total' : ''}">
<span class="grand-total-label">${escapeHtml(resolveOutstandingBalanceLabel(payload))}</span>
<span class="grand-total-value">${escapeHtml(displayRemainingBalance)}</span>
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
<img alt="Cap Ghaniya" class="stamp-img" decoding="sync" fetchpriority="high" src="${escapeHtml(capUrl)}"/>
<img alt="Tanda Tangan Husein" class="signature-img" decoding="sync" fetchpriority="high" src="${escapeHtml(signatureUrl)}"/>
</div>
<p class="signature-name">${escapeHtml(companyProfile.directorName)}</p>
<p class="signature-title">${escapeHtml(companyProfile.directorTitle)}</p>
</div>
</section>
<footer class="invoice-footer">
<span class="invoice-footer-text">© 2026 PT. Ghaniya Zilia Rahman</span>
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
