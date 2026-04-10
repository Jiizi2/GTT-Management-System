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

  const chunks = trimmed.split(" - ").map((item) => item.trim()).filter(Boolean);
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

function resolvePrintableWindow(options: InvoiceExportWindowOptions): Window | null {
  const reusableWindow = options.printWindow;
  if (reusableWindow && !reusableWindow.closed) {
    return reusableWindow;
  }

  return window.open("", "_blank", "width=1180,height=860");
}

function schedulePrint(printableWindow: Window): void {
  let printTriggered = false;
  const triggerPrint = () => {
    if (printTriggered || printableWindow.closed) {
      return;
    }

    printTriggered = true;
    printableWindow.focus();
    printableWindow.print();
  };

  try {
    printableWindow.addEventListener("load", () => {
      window.setTimeout(triggerPrint, 180);
    }, { once: true });
  } catch {
    // Some browser contexts expose restricted event APIs on popup proxies.
  }

  window.setTimeout(triggerPrint, 1600);
}

export function exportInvoicePdf(
  payload: InvoiceExportPayload,
  options: InvoiceExportWindowOptions = {},
): boolean {
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
  const statusLabel = resolvePaymentStatusLabel(payload);
  const taxPercentage = resolveTaxPercentage(payload);
  const bankMeta = resolveBankMeta(payload.bankAccountLabel);

  const rowsHtml = payload.items
    .map(
      (item, index) => {
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
      },
    )
    .join("");

  const notesHtml = payload.notes.trim()
    ? escapeHtml(payload.notes).replace(/\n/g, "<br/>")
    : "Thank you for choosing Ghaniya Tour and Travel for your spiritual pilgrimage. We look forward to serving your group.";

  const billToDescription = payload.address.trim()
    ? escapeHtml(payload.address)
    : "Authorized Travel Partner for Sacred Journeys and Spiritual Management.";

  const printableHtml = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Invoice - Ghaniya Tour and Travel</title>
<link href="${escapeHtml(appCssUrl)}" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&amp;family=Inter:wght@400;500;600&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<style>
        :root {
            --invoice-ink: #111111;
            --invoice-gold: #D4AF37;
            --invoice-gold-soft: rgba(212, 175, 55, 0.72);
            --invoice-black: #1A1A1A;
        }
        html,
        body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        body {
            color: var(--invoice-ink);
        }
        .print-container,
        .print-container * {
            color: var(--invoice-ink);
        }
        @page {
            size: A4 portrait;
            margin: 10mm;
        }
        @media print {
            html,
            body {
                margin: 0;
                padding: 0;
                background: white;
            }
            .no-print { display: none; }
            .print-container {
                width: 100% !important;
                max-width: none !important;
                min-height: auto !important;
                height: auto !important;
                box-shadow: none !important;
                padding: 0 !important;
                overflow: visible !important;
                display: block !important;
            }
            header { background-color: var(--invoice-black) !important; -webkit-print-color-adjust: exact; }
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
            .invoice-status-badge {
                background-color: var(--invoice-black) !important;
                color: var(--invoice-gold) !important;
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
            .invoice-notes-block,
            .invoice-signature-block,
            .invoice-line-row {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            .invoice-block {
                break-inside: auto !important;
                page-break-inside: auto !important;
            }
            .invoice-overview-block {
                margin-bottom: 6mm !important;
                padding-top: 8mm !important;
                padding-bottom: 7mm !important;
            }
            .invoice-table-block {
                margin-top: 0 !important;
                padding-top: 2mm !important;
            }
            .invoice-main-title {
                font-size: 2.7rem !important;
                line-height: 1 !important;
                margin-bottom: 4mm !important;
            }
            .invoice-bill-to-label {
                font-size: 8px !important;
                letter-spacing: 0.18em !important;
            }
            .invoice-bill-to-name {
                font-size: 1.35rem !important;
                line-height: 1.15 !important;
            }
            .invoice-bill-to-description {
                font-size: 10px !important;
                line-height: 1.4 !important;
                max-width: none !important;
            }
            .invoice-meta-card {
                padding: 5mm !important;
                font-size: 11px !important;
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
            .invoice-table td:nth-child(1) { width: 6%; }
            .invoice-table th:nth-child(2),
            .invoice-table td:nth-child(2) { width: 28%; }
            .invoice-table th:nth-child(3),
            .invoice-table td:nth-child(3) { width: 12%; }
            .invoice-table th:nth-child(4),
            .invoice-table td:nth-child(4) { width: 20%; }
            .invoice-table th:nth-child(5),
            .invoice-table td:nth-child(5) { width: 16%; }
            .invoice-table th:nth-child(6),
            .invoice-table td:nth-child(6) { width: 18%; }
            .invoice-table th {
                font-size: 7px !important;
                line-height: 1.25 !important;
                padding: 1.7mm 1.3mm !important;
                white-space: normal !important;
                word-break: break-word !important;
                vertical-align: bottom !important;
            }
            .invoice-table td {
                font-size: 10px !important;
                line-height: 1.35 !important;
                padding: 2.2mm 1.3mm !important;
                word-break: break-word !important;
                vertical-align: top !important;
            }
            .invoice-row-description {
                font-size: 11px !important;
                line-height: 1.3 !important;
            }
            thead,
            tbody,
            tr,
            td,
            th {
                break-inside: avoid;
                page-break-inside: avoid;
            }
            .gold-highlight { color: #B8860B !important; }
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
        .rub-el-hizb-pattern {
            background-image:
              linear-gradient(rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.94)),
              url("${escapeHtml(logoUrl)}");
            background-repeat: repeat, repeat;
            background-position: 0 0, 0 0;
            background-size: auto, 130px auto;
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
        .invoice-status-label,
        .invoice-status-badge,
        .invoice-section-accent,
        .invoice-accent-icon {
            color: var(--invoice-gold) !important;
        }
        .invoice-total-due-label {
            color: var(--invoice-gold) !important;
        }
        .invoice-total-due-value {
            color: var(--invoice-ink) !important;
        }
        .invoice-status-badge {
            background-color: var(--invoice-black) !important;
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
<body class="bg-stone-50 font-body text-luxury-black antialiased min-h-screen p-4 md:p-12 flex justify-center items-start">
<div class="print-container bg-white w-full max-w-4xl min-h-[1123px] shadow-2xl relative overflow-hidden flex flex-col rub-el-hizb-pattern border border-stone-200">
<header class="w-full luxury-gradient flex justify-between items-center px-12 py-10 relative z-10 border-b-4 border-gold-primary">
<div class="flex items-center gap-6">
<img alt="Logo" class="h-16 w-auto object-contain" src="${escapeHtml(logoUrl)}"/>
<div class="flex flex-col">
<span class="invoice-header-brand font-bold text-xl uppercase tracking-[0.3em] font-headline">Ghaniya Tour</span>
<span class="invoice-header-subtitle font-manrope text-2xl font-light tracking-tight">Umrah Group Summary</span>
</div>
</div>
<div class="text-right">
<span class="invoice-header-doc-label uppercase tracking-[0.3em] text-[10px] font-bold">Official Document</span>
</div>
</header>
<section class="invoice-block invoice-overview-block px-12 py-12 grid grid-cols-12 gap-8 items-start">
<div class="col-span-7">
<h1 class="invoice-main-title font-headline text-6xl font-extrabold text-luxury-black tracking-tighter mb-6">INVOICE</h1>
<div class="space-y-1">
<p class="invoice-bill-to-label text-stone-400 text-xs uppercase tracking-widest font-bold">Bill To:</p>
<h2 class="invoice-bill-to-name text-2xl font-bold text-luxury-black">${escapeHtml(payload.clientName)}</h2>
<p class="invoice-bill-to-description text-stone-600 text-sm max-w-xs leading-relaxed">${billToDescription}</p>
</div>
</div>
<div class="invoice-meta-card col-span-5 bg-stone-50 p-8 border-t-2 border-luxury-black space-y-4">
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
<span class="invoice-status-badge px-4 py-1.5 rounded-sm text-[9px] font-bold uppercase tracking-widest">${escapeHtml(statusLabel)}</span>
</div>
</div>
</div>
</section>
<section class="invoice-block invoice-table-block flex-grow px-12 py-4">
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
<section class="invoice-block px-12 py-12 flex flex-col md:flex-row gap-16 bg-stone-50/50">
<div class="invoice-payment-block flex-grow space-y-8">
<div>
<h3 class="invoice-section-accent text-[10px] font-extrabold uppercase tracking-[0.25em] mb-4">Payment Instructions</h3>
<div class="bg-white p-6 border border-stone-200 shadow-sm">
<div class="flex items-center gap-3 mb-4">
<span class="invoice-accent-icon material-symbols-outlined">account_balance</span>
<span class="font-bold text-luxury-black uppercase tracking-widest text-sm">${escapeHtml(bankMeta.bankName)}</span>
</div>
<p class="text-xs text-stone-500 mb-2">Account Number: <span class="font-bold text-luxury-black text-sm">${escapeHtml(bankMeta.accountNumber)}</span></p>
<p class="text-xs text-stone-500">Beneficiary: <span class="font-bold text-luxury-black uppercase tracking-wider text-sm">${escapeHtml(companyProfile.brandName.toUpperCase())}</span></p>
</div>
</div>
<div class="grid grid-cols-2 gap-4">
<div class="bg-white p-4 border border-stone-100">
<span class="text-[9px] text-stone-400 font-bold uppercase tracking-widest block mb-1">Rate SAR/IDR</span>
<span class="font-bold text-xs text-luxury-black">IDR ${escapeHtml(formatRate(payload.sarToIdr))}</span>
</div>
<div class="bg-white p-4 border border-stone-100">
<span class="text-[9px] text-stone-400 font-bold uppercase tracking-widest block mb-1">Rate USD/IDR</span>
<span class="font-bold text-xs text-luxury-black">IDR ${escapeHtml(formatRate(payload.usdToIdr))}</span>
</div>
</div>
</div>
<div class="invoice-summary-block w-full md:w-80 space-y-4">
<div class="flex justify-between items-center py-2 text-sm">
<span class="text-stone-500 font-medium">Subtotal</span>
<span class="font-manrope font-semibold text-luxury-black">${escapeHtml(formatIdr(payload.subtotalIdr))}</span>
</div>
<div class="flex justify-between items-center py-2 text-sm">
<span class="text-stone-500 font-medium">Tax (${taxPercentage}%)</span>
<span class="font-manrope font-semibold text-luxury-black">${escapeHtml(formatIdr(payload.taxIdr))}</span>
</div>
<div class="flex justify-between items-center py-2 border-b border-stone-200 pb-4 text-sm">
<span class="text-stone-500 font-medium">Payment Received</span>
<span class="font-manrope font-semibold text-red-700">${escapeHtml(formatIdr(payload.downPaymentIdr))}</span>
</div>
<div class="invoice-total-due-row flex justify-between items-center py-4">
<span class="invoice-total-due-label font-bold uppercase tracking-[0.2em] text-[10px]">Total Due</span>
<span class="invoice-total-due-value font-manrope text-2xl font-extrabold tracking-tight">${escapeHtml(formatIdr(payload.remainingBalanceIdr))}</span>
</div>
</div>
</section>
<section class="invoice-block px-12 py-12 grid grid-cols-2 gap-12 border-t border-stone-100">
<div class="invoice-notes-block space-y-6">
<div class="">
<p class="text-[11px] font-extrabold text-luxury-black uppercase tracking-widest mb-2">Message</p>
<p class="text-xs text-stone-500 leading-relaxed">${notesHtml}</p>
</div>
</div>
<div class="invoice-signature-block flex flex-col items-center justify-end">
<div class="w-56 border-b-2 border-gold-primary mb-3 relative pb-2 pt-6 flex justify-center">
<img alt="Cap Ghaniya" class="h-16 w-auto object-contain opacity-25 absolute -top-6 left-1/2 -translate-x-1/2" src="${escapeHtml(capUrl)}"/>
<img alt="Tanda Tangan Husein" class="h-14 w-auto object-contain relative z-10" src="${escapeHtml(signatureUrl)}"/>
</div>
<p class="font-bold text-luxury-black uppercase tracking-[0.25em] text-[11px]">${escapeHtml(companyProfile.directorName)}</p>
<p class="invoice-section-accent text-[9px] font-bold uppercase tracking-widest mt-1">${escapeHtml(companyProfile.directorTitle)}</p>
</div>
</section>
<footer class="invoice-footer flex justify-between items-center w-full px-12 py-8 mt-auto luxury-gradient border-t-2 border-gold-primary">
<span class="invoice-footer-muted font-inter text-[8pt] uppercase tracking-[0.2em]">© 2024 Ghaniya Tour | Spiritual Journey Management</span>
<div class="flex gap-8">
<span class="font-inter text-[8pt] uppercase tracking-[0.15em]">Terms of Service</span>
<span class="font-inter text-[8pt] uppercase tracking-[0.15em]">Bank Info</span>
<span class="font-inter text-[8pt] uppercase tracking-[0.15em]">Support</span>
</div>
</footer>
</div>
<button class="no-print fixed bottom-8 right-8 bg-luxury-black text-gold-primary w-16 h-16 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform border border-gold-primary/30" onclick="window.print()">
<span class="material-symbols-outlined">print</span>
</button>
</body></html>`;

  printableWindow.document.open();
  printableWindow.document.write(printableHtml);
  printableWindow.document.close();
  schedulePrint(printableWindow);

  return true;
}
