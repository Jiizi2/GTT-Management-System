import type { GroupData } from "../shared/app-domain";
import type { BackendInvoiceClient, BackendInvoiceItem, BackendInvoiceRow } from "../hooks/use-invoice-backend";

export type InvoiceStatus = BackendInvoiceRow["status"];
export type InvoiceRow = BackendInvoiceRow;
export type InvoiceClientOption = BackendInvoiceClient & {
  metadata?: Record<string, any>;
};

const MASTER_DATA_INVOICE_CLIENT_ID_PREFIX = "__invoice_client_master_data__:";

export type SelectOption = {
  value: string;
  label: string;
  metadata?: Record<string, any>;
};


export type InvoiceStatusOption = {
  value: InvoiceStatus;
  label: string;
};

export type InvoiceWorkspaceInitialData = {
  id: string;
  invoiceNumber: string;
  sourceInvoiceNumber?: string;
  clientName: string;
  clientLabel: string;
  clientId: string;
  groupCode: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  downPaymentIdr: number;
  status: InvoiceStatus;
  recipientName?: string;
  notes?: string;
  items: Array<
    BackendInvoiceItem & {
      id: string;
    }
  >;
};

export const defaultBankDisbursementOptions: SelectOption[] = [
  { value: "bsi", label: "Mandiri Syariah (BSI) - 7088 1234 5678" },
  { value: "bca", label: "BCA (IDR) - 035 123 4455" },
  { value: "bca_usd", label: "BCA (USD) - 035 998 7766" },
];

export const defaultIssuingOfficeOptions: SelectOption[] = [
  { value: "Bekasi Office", label: "Bekasi Office" },
  { value: "Jakarta HQ", label: "Jakarta HQ" },
];

export const defaultInvoiceStatusOptions: InvoiceStatusOption[] = [
  { value: "Pending", label: "Pending" },
  { value: "Partially Paid", label: "Partially Paid" },
  { value: "Paid", label: "Paid" },
  { value: "Overdue", label: "Overdue" },
  { value: "Cancelled", label: "Cancelled" },
];

export function formatIdr(value: number): string {
  const normalized = Math.max(0, Math.round(value));
  return `IDR ${new Intl.NumberFormat("id-ID").format(normalized)}`;
}

export function formatDateLabel(isoDate: string): string {
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

export function formatMonthLabel(monthKey: string): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return monthKey;
  }

  const parsedDate = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return monthKey;
  }

  return parsedDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

export function shiftMonthKey(monthKey: string, offset: number): string {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return monthKey;
  }

  const parsedDate = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return monthKey;
  }

  parsedDate.setMonth(parsedDate.getMonth() + offset);
  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function normalizeClientName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildMasterDataInvoiceClientId(value: string, label: string): string {
  const candidateKey = value.trim() || label.trim();
  const sanitizedKey = candidateKey
    .replace(/\s+/g, "_")
    .replace(/[^\w-]/g, "")
    .toLowerCase();
  return `${MASTER_DATA_INVOICE_CLIENT_ID_PREFIX}${sanitizedKey || "client"}`;
}

export function isMasterDataClientOptionId(clientId: string): boolean {
  return clientId.trim().startsWith(MASTER_DATA_INVOICE_CLIENT_ID_PREFIX);
}

export function getStatusClasses(status: InvoiceStatus, isDarkMode: boolean): string {
  if (status === "Cancelled") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (status === "Paid") {
    return isDarkMode
      ? "border-primary/35 bg-primary/16 text-primary"
      : "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "Partially Paid") {
    return isDarkMode
      ? "border-sky-500/35 bg-sky-500/16 text-sky-400"
      : "border-sky-200 bg-sky-100 text-sky-800";
  }

  if (status === "Pending") {
    return isDarkMode
      ? "border-secondary/35 bg-secondary/16 text-secondary"
      : "border-amber-200 bg-amber-100 text-amber-800";
  }

  return isDarkMode ? "border-tertiary/35 bg-tertiary/16 text-tertiary" : "border-rose-200 bg-rose-100 text-rose-700";
}

export function getAvatarToneByStatus(status: InvoiceStatus, isDarkMode: boolean): string {
  if (status === "Cancelled") {
    return "bg-slate-200 text-slate-700";
  }

  if (status === "Paid") {
    return isDarkMode ? "bg-primary/18 text-primary" : "bg-emerald-100 text-emerald-700";
  }

  if (status === "Partially Paid") {
    return isDarkMode ? "bg-sky-500/18 text-sky-400" : "bg-sky-100 text-sky-700";
  }

  if (status === "Pending") {
    return isDarkMode ? "bg-secondary/18 text-secondary" : "bg-amber-100 text-amber-700";
  }

  return isDarkMode ? "bg-tertiary/18 text-tertiary" : "bg-rose-100 text-rose-700";
}

export function getStatusValue(status: InvoiceStatus): "all" | "paid" | "partially-paid" | "pending" | "overdue" | "cancelled" {
  if (status === "Cancelled") {
    return "cancelled";
  }

  if (status === "Paid") {
    return "paid";
  }

  if (status === "Partially Paid") {
    return "partially-paid";
  }

  if (status === "Pending") {
    return "pending";
  }

  return "overdue";
}

export function getInvoiceStatusDisplayLabel(status: InvoiceStatus): string {
  return status === "Paid" ? "Paid / Lunas" : status === "Partially Paid" ? "Partially Paid / DP" : status;
}

export function resolveDateRangeLabel(rows: InvoiceRow[]): string {
  if (rows.length === 0) {
    return "-";
  }

  const sortedDates = rows.map((row) => row.dueDateIso).sort((left, right) => left.localeCompare(right));
  const minIso = sortedDates[0];
  const maxIso = sortedDates[sortedDates.length - 1];
  return `${formatDateLabel(minIso)} - ${formatDateLabel(maxIso)}`;
}

export function mapMasterDataToSelectOptions(
  options: Array<{ value: string; label: string; isActive: boolean; metadata?: any }>,
): SelectOption[] {
  return options
    .filter((option) => option.isActive)
    .map((option) => ({
      value: option.value.trim(),
      label: option.label.trim() || option.value.trim(),
      metadata: option.metadata,
    }))
    .filter((option) => option.value.length > 0);
}

export function mapMasterDataToInvoiceStatusOptions(
  options: Array<{ value: string; label: string; isActive: boolean }>,
): InvoiceStatusOption[] {
  const allowedStatuses = new Set<InvoiceStatus>(["Pending", "Partially Paid", "Paid", "Overdue", "Cancelled"]);
  return mapMasterDataToSelectOptions(options)
    .filter((option): option is { value: InvoiceStatus; label: string } =>
      allowedStatuses.has(option.value as InvoiceStatus),
    )
    .sort(
      (left, right) =>
        defaultInvoiceStatusOptions.findIndex((option) => option.value === left.value) -
        defaultInvoiceStatusOptions.findIndex((option) => option.value === right.value),
    );
}

export function mapMasterDataToClientSuggestions(options: Array<{ label: string; isActive: boolean }>): string[] {
  return Array.from(
    new Set(
      options
        .filter((option) => option.isActive)
        .map((option) => option.label.trim())
        .filter((label) => label.length > 0),
    ),
  );
}

export function mergeInvoiceClientsWithMasterData(
  clients: ReadonlyArray<InvoiceClientOption>,
  options: ReadonlyArray<{ value: string; label: string; sortOrder: number; isActive: boolean; metadata?: Record<string, any> }>,
): InvoiceClientOption[] {
  const normalizedNames = new Set(clients.map((client) => normalizeClientName(client.name)));
  const backendClients = [...clients].sort((left, right) => {
    const sortOrderDiff = left.sortOrder - right.sortOrder;
    if (sortOrderDiff !== 0) {
      return sortOrderDiff;
    }

    return left.name.localeCompare(right.name);
  });

  const masterDataOnlyClients = options
    .filter((option) => option.isActive)
    .map((option) => ({
      ...option,
      label: option.label.trim(),
      value: option.value.trim(),
    }))
    .filter((option) => option.label.length > 0)
    .filter((option) => {
      const normalizedLabel = normalizeClientName(option.label);
      if (!normalizedLabel || normalizedNames.has(normalizedLabel)) {
        return false;
      }

      normalizedNames.add(normalizedLabel);
      return true;
    })
    .sort((left, right) => {
      const sortOrderDiff = left.sortOrder - right.sortOrder;
      if (sortOrderDiff !== 0) {
        return sortOrderDiff;
      }

      return left.label.localeCompare(right.label);
    })
    .map((option, index) => ({
      id: buildMasterDataInvoiceClientId(option.value, option.label),
      name: option.label,
      sortOrder: backendClients.length + index + 1,
      label: option.label,
      metadata: option.metadata,
    }));

  return [...backendClients, ...masterDataOnlyClients];
}

export function resolveBankAccountLabel(
  value: string,
  options: ReadonlyArray<SelectOption> = defaultBankDisbursementOptions,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function resolveInvoiceDownPaymentIdr(row: Pick<InvoiceRow, "amount" | "status" | "downPaymentIdr">): number {
  const normalizedAmount = Math.max(0, Math.round(row.amount));
  const normalizedDownPayment = Math.min(normalizedAmount, Math.max(0, Math.round(row.downPaymentIdr ?? 0)));

  if (normalizedDownPayment > 0) {
    return normalizedDownPayment;
  }

  return row.status === "Paid" ? normalizedAmount : 0;
}

export function resolveInvoiceRemainingBalanceIdr(amount: number, downPaymentIdr: number): number {
  return Math.max(0, Math.round(amount) - Math.max(0, Math.round(downPaymentIdr)));
}

export function resolveInvoiceOutstandingBalanceLabel(downPaymentIdr: number, remainingBalanceIdr?: number): string {
  if (remainingBalanceIdr !== undefined && Math.max(0, Math.round(remainingBalanceIdr)) <= 0) {
    return "Lunas";
  }

  return Math.max(0, Math.round(downPaymentIdr)) > 0 ? "Sisa Tagihan" : "Tagihan";
}

// openInvoiceExportWindow removed because popups are no longer used for printing

export function createInvoiceWorkspaceInitialData(row: InvoiceRow): InvoiceWorkspaceInitialData {
  const items: Array<BackendInvoiceItem & { id: string }> = Array.isArray(row.items)
    ? row.items.map((item, index) => ({
        id: `line-${index + 1}`,
        description: item.description.trim(),
        pax: Math.max(0, Math.round(item.pax)),
        currency: item.currency,
        unitPrice: Math.max(0, Math.round(item.unitPrice)),
        totalPrice: Math.max(0, Math.round(item.totalPrice)),
        totalPriceIdr: Math.max(0, Math.round(item.totalPriceIdr)),
      }))
    : [];

  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    clientName: row.clientName,
    clientLabel: row.clientLabel,
    clientId: row.clientId,
    groupCode: row.groupCode ?? "",
    issuedDateIso: row.issuedDateIso,
    dueDateIso: row.dueDateIso,
    amount: Math.max(0, Math.round(row.amount)),
    downPaymentIdr: resolveInvoiceDownPaymentIdr(row),
    status: row.status,
    recipientName: row.recipientName ?? "",
    notes: row.notes ?? "",
    items,
  };
}

export function resolveExchangeRatesFromItems(
  items: Array<{ currency: string; totalPrice: number; totalPriceIdr: number }>,
  fallbackUsd = 15_845,
  fallbackSar = 4_225,
): { usdToIdr: number; sarToIdr: number } {
  let usdToIdr = 0;
  let sarToIdr = 0;

  const usdItem = items.find((item) => item.currency === "USD" && item.totalPrice > 0);
  if (usdItem) {
    usdToIdr = usdItem.totalPriceIdr / usdItem.totalPrice;
  }

  const sarItem = items.find((item) => item.currency === "SAR" && item.totalPrice > 0);
  if (sarItem) {
    sarToIdr = sarItem.totalPriceIdr / sarItem.totalPrice;
  }

  if (usdToIdr > 0 && sarToIdr === 0) {
    sarToIdr = usdToIdr / 3.75;
  } else if (sarToIdr > 0 && usdToIdr === 0) {
    usdToIdr = sarToIdr * 3.75;
  }

  if (usdToIdr === 0) usdToIdr = fallbackUsd;
  if (sarToIdr === 0) sarToIdr = fallbackSar;

  return {
    usdToIdr: Math.round(usdToIdr),
    sarToIdr: Math.round(sarToIdr),
  };
}

export function resolveExchangeRatesFromRow(row: Pick<InvoiceRow, "notes" | "items">): { usdToIdr: number; sarToIdr: number } {
  const notesRaw = row.notes ?? "";
  let usdToIdr = 0;
  let sarToIdr = 0;

  const ratesMatch = notesRaw.match(/\[Rates:USD=(\d+),SAR=(\d+)\]/);
  if (ratesMatch) {
    usdToIdr = Number.parseInt(ratesMatch[1], 10);
    sarToIdr = Number.parseInt(ratesMatch[2], 10);
  }

  if (usdToIdr <= 0 || sarToIdr <= 0) {
    const items = row.items || [];
    const itemRates = resolveExchangeRatesFromItems(items);
    if (usdToIdr <= 0) usdToIdr = itemRates.usdToIdr;
    if (sarToIdr <= 0) sarToIdr = itemRates.sarToIdr;
  }

  return { usdToIdr, sarToIdr };
}

export function formatCurrencyLabel(value: number, currency: string): string {
  if (currency === "IDR") {
    return formatIdr(value);
  }
  const rounded = Math.max(0, Math.round(value));
  return `${currency} ${new Intl.NumberFormat("en-US").format(rounded)}`;
}

export function resolveInvoiceDisplayTotals(row: InvoiceRow): {
  currency: string;
  subtotal: number;
  downPayment: number;
  remainingBalance: number;
  usdToIdr: number;
  sarToIdr: number;
} {
  const notesRaw = row.notes ?? "";
  let keepValasCurrency: "IDR" | "USD" | "SAR" = "IDR";
  if (notesRaw.includes("[KeepValasTotal:USD]")) keepValasCurrency = "USD";
  else if (notesRaw.includes("[KeepValasTotal:SAR]")) keepValasCurrency = "SAR";
  else if (notesRaw.includes("[KeepValasTotal]")) {
    const valas = row.items?.find((item) => item.currency !== "IDR")?.currency;
    keepValasCurrency = valas || "IDR";
  }

  const rates = resolveExchangeRatesFromRow(row);
  const amountIdr = Math.max(0, Math.round(row.amount));
  const dpIdr = resolveInvoiceDownPaymentIdr(row);

  if (keepValasCurrency === "IDR") {
    return {
      currency: "IDR",
      subtotal: amountIdr,
      downPayment: dpIdr,
      remainingBalance: resolveInvoiceRemainingBalanceIdr(amountIdr, dpIdr),
      usdToIdr: rates.usdToIdr,
      sarToIdr: rates.sarToIdr,
    };
  }

  const rate = keepValasCurrency === "USD" ? rates.usdToIdr : rates.sarToIdr;
  if (rate <= 0) {
    return {
      currency: "IDR",
      subtotal: amountIdr,
      downPayment: dpIdr,
      remainingBalance: resolveInvoiceRemainingBalanceIdr(amountIdr, dpIdr),
      usdToIdr: rates.usdToIdr,
      sarToIdr: rates.sarToIdr,
    };
  }

  const items = row.items || [];
  let targetSubtotal = 0;
  if (items.length > 0) {
    targetSubtotal = items.reduce((sum, item) => {
      if (item.currency === keepValasCurrency) {
        return sum + Math.max(0, Math.round(item.pax * item.unitPrice));
      }
      return sum + Math.max(0, Math.ceil(item.totalPriceIdr / rate));
    }, 0);
  } else {
    targetSubtotal = Math.ceil(amountIdr / rate);
  }

  const targetDp = Math.ceil(dpIdr / rate);
  const targetRemaining = Math.max(0, targetSubtotal - targetDp);

  return {
    currency: keepValasCurrency,
    subtotal: targetSubtotal,
    downPayment: targetDp,
    remainingBalance: targetRemaining,
    usdToIdr: rates.usdToIdr,
    sarToIdr: rates.sarToIdr,
  };
}

export async function viewInvoicePdfFromRow({
  row,
  groups,
  bankDisbursementOptions,
}: {
  row: InvoiceRow;
  groups: GroupData[];
  bankDisbursementOptions?: SelectOption[];
}): Promise<boolean> {
  const linkedGroup = row.groupCode
    ? (groups.find((group) => group.code.trim().toUpperCase() === row.groupCode?.trim().toUpperCase()) ?? null)
    : null;
  const description = linkedGroup
    ? `${linkedGroup.packageName} Package - ${linkedGroup.durationDays} Days`
    : `Invoice ${row.invoiceNumber}`;
  const printableItems =
    row.items && row.items.length > 0
      ? row.items
      : [
          {
            description,
            pax: 1,
            currency: "IDR" as const,
            unitPrice: row.amount,
            totalPrice: row.amount,
            totalPriceIdr: row.amount,
          },
        ];
  const totals = resolveInvoiceDisplayTotals(row);
  const { exportInvoicePdf } = await import("./invoice-export");

  const notesRaw = row.notes ?? "";
  const bankMatch = notesRaw.match(/\[BankAccount:([^\]]+)\]/);
  const bankKey = bankMatch && bankMatch[1] ? bankMatch[1].trim() : "bsi";
  const bankAccountLabel = resolveBankAccountLabel(bankKey, bankDisbursementOptions);

  // Strip metadata tags from notes for final printing
  const cleanNotes = notesRaw
    .replace(/\[KeepValasTotal:[A-Z]+\]/g, "")
    .replace(/\[KeepValasTotal\]/g, "")
    .replace(/\[Rates:USD=\d+,SAR=\d+\]/g, "")
    .replace(/\[BankAccount:[^\]]+\]/g, "")
    .trim();

  return await exportInvoicePdf(
    {
      invoiceNumber: row.invoiceNumber,
      issueDateIso: row.issuedDateIso,
      dueDateIso: row.dueDateIso,
      statusLabel: getInvoiceStatusDisplayLabel(row.status),
      issuingOffice: "Bekasi Office",
      clientName: row.clientName,
      clientCode: row.groupCode ?? row.clientLabel,
      address: row.clientLabel,
      recipientName: row.recipientName,
      bankAccountLabel,
      notes: cleanNotes,
      usdToIdr: totals.usdToIdr,
      sarToIdr: totals.sarToIdr,
      currency: totals.currency as any,
      subtotal: totals.subtotal,
      tax: 0,
      totalPayable: totals.subtotal,
      downPayment: totals.downPayment,
      remainingBalance: totals.remainingBalance,
      items: printableItems,
    }
  );
}
