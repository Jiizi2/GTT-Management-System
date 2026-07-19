import { formatLocalIsoDate, type GroupData } from "../../../shared/app-domain";
import type { BackendInvoiceClient, BackendInvoiceItem, BackendInvoiceRow } from "../../../hooks/use-invoice-backend";

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
  agentId: string;
  agentName?: string;
  groupCode: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  downPaymentIdr: number;
  status: InvoiceStatus;
  recipientName?: string;
  notes?: string;
  description?: string;
  items: InvoiceDraftItem[];
  version?: number;
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
  if (!isoDate || isoDate.trim() === "") {
    return "-";
  }
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
  const items: InvoiceDraftItem[] = Array.isArray(row.items)
    ? row.items.map((item: BackendInvoiceItem, index: number) => ({
        id: `line-${index + 1}`,
        description: item.description.trim(),
        pax: Math.max(0, Math.round(item.pax)),
        currency: item.currency,
        unitPrice: Math.max(0, Math.round(item.unitPrice)),
      }))
    : [];

  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber,
    clientName: row.clientName,
    clientLabel: row.clientLabel,
    clientId: row.clientId,
    agentId: row.agentId,
    groupCode: row.groupCode ?? "",
    issuedDateIso: row.issuedDateIso,
    dueDateIso: row.dueDateIso,
    amount: Math.max(0, Math.round(row.amount)),
    downPaymentIdr: resolveInvoiceDownPaymentIdr(row),
    status: row.status,
    recipientName: row.recipientName ?? "",
    notes: row.notes ?? "",
    description: row.description ?? "",
    items,
    version: row.version,
  };
}

export function resolveExchangeRatesFromItems(
  items: Array<{ currency: string; totalPrice?: number; totalPriceIdr?: number }>,
  fallbackUsd = 15_845,
  fallbackSar = 4_225,
): { usdToIdr: number; sarToIdr: number } {
  let usdToIdr = 0;
  let sarToIdr = 0;

  const usdItem = items.find((item) => item.currency === "USD" && item.totalPrice && item.totalPrice > 0);
  if (usdItem && usdItem.totalPriceIdr && usdItem.totalPrice) {
    usdToIdr = usdItem.totalPriceIdr / usdItem.totalPrice;
  }

  const sarItem = items.find((item) => item.currency === "SAR" && item.totalPrice && item.totalPrice > 0);
  if (sarItem && sarItem.totalPriceIdr && sarItem.totalPrice) {
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

export function resolveExchangeRatesFromRow(row: { notes?: string; items?: any[] }): { usdToIdr: number; sarToIdr: number } {
  const notesRaw = row.notes ?? "";
  const ratesMatch = notesRaw.match(/\[Rates:USD=(\d+),SAR=(\d+)\]/) || notesRaw.match(/\[ExchangeRate:USD=(\d+),SAR=(\d+)\]/);
  if (ratesMatch) {
    return {
      usdToIdr: Number.parseInt(ratesMatch[1], 10),
      sarToIdr: Number.parseInt(ratesMatch[2], 10),
    };
  }

  const items = row.items || [];
  return resolveExchangeRatesFromItems(items);
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
    const valas = row.items?.find((item: BackendInvoiceItem) => item.currency !== "IDR")?.currency;
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
    targetSubtotal = items.reduce((sum: number, item: BackendInvoiceItem) => {
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
  issuingOfficeOptions,
}: {
  row: InvoiceRow;
  groups: GroupData[];
  bankDisbursementOptions?: SelectOption[];
  issuingOfficeOptions?: SelectOption[];
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
  const { exportInvoicePdf } = await import("../../invoice-export");

  const notesRaw = row.notes ?? "";
  const bankMatch = notesRaw.match(/\[BankAccount:([^\]]+)\]/);
  const bankKey = bankMatch && bankMatch[1] ? bankMatch[1].trim() : "bsi";
  const matchedBank = bankDisbursementOptions?.find((option) => option.value === bankKey);
  const bankAccountLabel = matchedBank?.label ?? resolveBankAccountLabel(bankKey, bankDisbursementOptions);
  const bankAccountRecipient = matchedBank?.metadata?.penerima || matchedBank?.metadata?.beneficiary || matchedBank?.metadata?.recipient || matchedBank?.metadata?.recipientName;

  const issuingOfficeMatch = notesRaw.match(/\[IssuingOffice:([^\]]+)\]/);
  const issuingOfficeKey = issuingOfficeMatch && issuingOfficeMatch[1] ? issuingOfficeMatch[1].trim() : "Bekasi Office";
  const issuingOfficeLabel = issuingOfficeOptions?.find((option) => option.value === issuingOfficeKey)?.label ?? issuingOfficeKey;

  const addressMatch = notesRaw.match(/\[Address:([^\]]*)\]/);
  const address = addressMatch ? decodeURIComponent(addressMatch[1]) : "";

  const paymentsMatch = notesRaw.match(/\[Payments:([^\]]*)\]/);
  let payments: Array<{ amount: number; dateIso: string }> = [];
  if (paymentsMatch && paymentsMatch[1]) {
    try {
      payments = JSON.parse(decodeURIComponent(paymentsMatch[1]));
    } catch {
      payments = [];
    }
  } else {
    if (totals.downPayment > 0) {
      payments = [{
        amount: totals.downPayment,
        dateIso: row.issuedDateIso || "",
      }];
    }
  }

  // Strip metadata tags from notes for final printing
  const cleanNotes = notesRaw
    .replace(/\[KeepValasTotal:[A-Z]+\]/g, "")
    .replace(/\[KeepValasTotal\]/g, "")
    .replace(/\[Rates:USD=\d+,SAR=\d+\]/g, "")
    .replace(/\[BankAccount:[^\]]+\]/g, "")
    .replace(/\[IssuingOffice:[^\]]+\]/g, "")
    .replace(/\[NoDueDate:true\]/g, "")
    .replace(/\[Address:[^\]]*\]/g, "")
    .replace(/\[Payments:[^\]]*\]/g, "")
    .trim();

  return await exportInvoicePdf(
    {
      invoiceId: row.id,
      invoiceNumber: row.invoiceNumber,
      issueDateIso: row.issuedDateIso,
      dueDateIso: row.dueDateIso,
      statusLabel: getInvoiceStatusDisplayLabel(row.status),
      issuingOffice: issuingOfficeLabel,
      clientName: row.clientName,
      clientCode: row.groupCode ?? row.clientLabel,
      address,
      recipientName: row.recipientName,
      bankAccountRecipient,
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
      payments,
    }
  );
}

export const MANUAL_CLIENT_OPTION_ID = "__invoice_client_other__";

export type InvoiceDraftCurrency = BackendInvoiceItem["currency"];

export type InvoiceDraftItem = Omit<BackendInvoiceItem, "totalPrice" | "totalPriceIdr"> & {
  id: string;
};

export interface DerivedInvoiceState {
  items: Array<
    InvoiceDraftItem & {
      totalPrice: number;
      totalPriceIdr: number;
    }
  >;
  paymentSummary: {
    subtotal: number;
    totalPayable: number;
    totalPaid: number;
    remainingBalance: number;
    downPaymentCoveragePercent: number;
  };
  previewStatus: string;
}

export function convertToIdr({
  amount,
  currency,
  usdToIdr,
  sarToIdr,
}: {
  amount: number;
  currency: InvoiceDraftCurrency;
  usdToIdr: number;
  sarToIdr: number;
}): number {
  if (currency === "USD") {
    return amount * usdToIdr;
  }
  if (currency === "SAR") {
    return amount * sarToIdr;
  }
  return amount;
}

export function resolveDraftItemTotals(
  item: { pax: number; unitPrice: number; currency: "IDR" | "USD" | "SAR" },
  usdToIdr: number,
  sarToIdr: number,
): { totalPrice: number; totalPriceIdr: number } {
  const totalPrice = Math.max(0, Math.round(item.pax)) * Math.max(0, Math.round(item.unitPrice));
  const totalPriceIdr = convertToIdr({
    amount: totalPrice,
    currency: item.currency,
    usdToIdr,
    sarToIdr,
  });

  return {
    totalPrice,
    totalPriceIdr,
  };
}

export function calculateSubtotalInCurrency(
  items: InvoiceDraftItem[],
  targetCurrency: string,
  usdToIdr: number,
  sarToIdr: number,
): number {
  if (targetCurrency === "IDR") {
    return items.reduce((sum, item) => {
      const nextTotals = resolveDraftItemTotals(item, usdToIdr, sarToIdr);
      return sum + Math.max(0, Math.round(nextTotals.totalPriceIdr));
    }, 0);
  } else {
    const rate = targetCurrency === "USD" ? usdToIdr : sarToIdr;
    if (rate <= 0) return 0;
    return items.reduce((sum, item) => {
      if (item.currency === targetCurrency) {
        return sum + Math.max(0, Math.round(item.pax * item.unitPrice));
      }
      const nextTotals = resolveDraftItemTotals(item, usdToIdr, sarToIdr);
      return sum + Math.max(0, Math.ceil(nextTotals.totalPriceIdr / rate));
    }, 0);
  }
}

export function normalizeInvoiceDraftItems(items: InvoiceDraftItem[]): InvoiceDraftItem[] {
  return items
    .map((item) => ({
      ...item,
      description: item.description.trim(),
      pax: Math.max(0, Math.round(item.pax)),
      unitPrice: Math.max(0, Math.round(item.unitPrice)),
    }))
    .filter((item) => item.description.length > 0 && item.pax > 0 && item.unitPrice > 0);
}

export function buildPrintableInvoiceItems(
  items: InvoiceDraftItem[],
  usdToIdr: number,
  sarToIdr: number,
): BackendInvoiceItem[] {
  return items.map((item) => {
    const totalPrice = item.pax * item.unitPrice;
    const totalPriceIdr = convertToIdr({
      amount: totalPrice,
      currency: item.currency,
      usdToIdr,
      sarToIdr,
    });

    return {
      description: item.description,
      pax: item.pax,
      currency: item.currency,
      unitPrice: item.unitPrice,
      totalPrice,
      totalPriceIdr,
    };
  });
}

export function resolveClientSelection(values: any, clients: InvoiceClientOption[]) {
  const isUsingManualClient = values.selectedClientId === MANUAL_CLIENT_OPTION_ID;
  const selectedClient = isUsingManualClient
    ? null
    : (clients.find((client) => client.id === values.selectedClientId) ?? null);
  const isUsingMasterDataClient = Boolean(selectedClient && isMasterDataClientOptionId(selectedClient.id));
  const manualClientName = values.manualClientName ? values.manualClientName.trim() : "";

  return {
    selectedClient,
    clientId: selectedClient && !isUsingMasterDataClient ? selectedClient.id : undefined,
    clientName: isUsingManualClient
      ? manualClientName || undefined
      : isUsingMasterDataClient
        ? selectedClient?.name.trim() || undefined
        : undefined,
  };
}

export function deriveItemTotals(
  items: InvoiceDraftItem[],
  usdToIdr: number,
  sarToIdr: number,
): Array<InvoiceDraftItem & { totalPrice: number; totalPriceIdr: number }> {
  return items.map((item) => {
    const totalPrice = Math.max(0, Math.round(item.pax)) * Math.max(0, Math.round(item.unitPrice));
    const totalPriceIdr = convertToIdr({
      amount: totalPrice,
      currency: item.currency,
      usdToIdr,
      sarToIdr,
    });
    return {
      ...item,
      totalPrice,
      totalPriceIdr,
    };
  });
}

export function deriveSubtotal(
  itemsWithTotals: Array<InvoiceDraftItem & { totalPrice: number; totalPriceIdr: number }>,
  keepValasCurrency: "IDR" | "USD" | "SAR",
  usdToIdr: number,
  sarToIdr: number,
): number {
  if (keepValasCurrency === "IDR") {
    return itemsWithTotals.reduce((sum, item) => sum + Math.max(0, Math.round(item.totalPriceIdr)), 0);
  } else {
    const rate = keepValasCurrency === "USD" ? usdToIdr : sarToIdr;
    if (rate <= 0) return 0;
    return itemsWithTotals.reduce((sum, item) => {
      if (item.currency === keepValasCurrency) {
        return sum + Math.max(0, Math.round(item.pax * item.unitPrice));
      }
      return sum + Math.max(0, Math.ceil(item.totalPriceIdr / rate));
    }, 0);
  }
}

export function derivePayments(
  payments: Array<{ amount: number; dateIso: string }>,
  totalPayable: number,
) {
  const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const remainingBalance = Math.max(0, totalPayable - totalPaid);
  const downPaymentCoveragePercent =
    totalPayable > 0 ? Math.min(100, Math.round((totalPaid / totalPayable) * 100)) : 0;

  return {
    totalPaid,
    remainingBalance,
    downPaymentCoveragePercent,
  };
}

export function derivePreviewStatus(
  paymentSummary: { totalPaid: number; remainingBalance: number },
  totalPayable: number,
  dueDateIso?: string,
): string {
  let previewStatus = "Pending";
  if (totalPayable > 0 && paymentSummary.totalPaid >= totalPayable) {
    previewStatus = "Paid";
  } else if (paymentSummary.totalPaid > 0) {
    previewStatus = "Partially Paid";
  } else {
    if (dueDateIso) {
      const todayIsoStr = formatLocalIsoDate(new Date());
      if (dueDateIso < todayIsoStr) {
        previewStatus = "Overdue";
      }
    }
  }
  return previewStatus;
}

export function deriveInvoiceState({
  items,
  payments,
  usdToIdr,
  sarToIdr,
  dueDateIso,
  keepValasCurrency,
}: {
  items: InvoiceDraftItem[];
  payments: Array<{ amount: number; dateIso: string }>;
  usdToIdr: number;
  sarToIdr: number;
  dueDateIso?: string;
  keepValasCurrency: "IDR" | "USD" | "SAR";
}): DerivedInvoiceState {
  const itemsWithTotals = deriveItemTotals(items, usdToIdr, sarToIdr);
  const subtotal = deriveSubtotal(itemsWithTotals, keepValasCurrency, usdToIdr, sarToIdr);

  const taxAmount = 0;
  const totalPayable = subtotal + taxAmount;
  const paymentsResult = derivePayments(payments, totalPayable);
  const previewStatus = derivePreviewStatus(paymentsResult, totalPayable, dueDateIso);

  return {
    items: itemsWithTotals,
    paymentSummary: {
      subtotal,
      totalPayable,
      totalPaid: paymentsResult.totalPaid,
      remainingBalance: paymentsResult.remainingBalance,
      downPaymentCoveragePercent: paymentsResult.downPaymentCoveragePercent,
    },
    previewStatus,
  };
}

export function buildInvoicePayload({
  values,
  usdToIdr,
  sarToIdr,
  keepValasCurrency,
  derived,
  clients,
}: {
  values: any;
  usdToIdr: number;
  sarToIdr: number;
  keepValasCurrency: "IDR" | "USD" | "SAR";
  derived: DerivedInvoiceState;
  clients: InvoiceClientOption[];
}) {
  const clientSelection = resolveClientSelection(values, clients);
  const normalizedItems = normalizeInvoiceDraftItems(values.items);
  const printableItems = buildPrintableInvoiceItems(normalizedItems, usdToIdr, sarToIdr);

  const linkedGroupCode = values.selectedGroupCode.trim() || (clientSelection.selectedClient?.groupCode ?? "");
  
  const totalPaidIdr = keepValasCurrency !== "IDR"
    ? Math.max(0, Math.round(derived.paymentSummary.totalPaid * (keepValasCurrency === "USD" ? usdToIdr : sarToIdr)))
    : derived.paymentSummary.totalPaid;
  
  const payloadAmountIdr = keepValasCurrency !== "IDR"
    ? Math.max(0, Math.round(derived.paymentSummary.totalPayable * (keepValasCurrency === "USD" ? usdToIdr : sarToIdr)))
    : derived.paymentSummary.totalPayable;

  let payloadNotes = values.notes.trim();
  if (keepValasCurrency !== "IDR") {
    payloadNotes += `\n[KeepValasTotal:${keepValasCurrency}]`;
  }
  payloadNotes += `\n[Rates:USD=${usdToIdr},SAR=${sarToIdr}]`;
  if (values.bankAccount) {
    payloadNotes += `\n[BankAccount:${values.bankAccount}]`;
  }
  if (values.issuingOffice) {
    payloadNotes += `\n[IssuingOffice:${values.issuingOffice}]`;
  }
  if (values.address !== undefined && values.address !== null) {
    payloadNotes += `\n[Address:${encodeURIComponent(values.address.trim())}]`;
  }
  if (values.payments && values.payments.length > 0) {
    payloadNotes += `\n[Payments:${encodeURIComponent(JSON.stringify(values.payments))}]`;
  }
  if (!values.dueDateIso || !values.dueDateIso.trim()) {
    payloadNotes += `\n[NoDueDate:true]`;
  }

  return {
    agentId: values.agentId,
    clientId: clientSelection.clientId,
    clientName: clientSelection.clientName,
    groupCode: linkedGroupCode || undefined,
    issuedDateIso: values.issueDateIso,
    dueDateIso: values.dueDateIso || "",
    amount: payloadAmountIdr,
    downPaymentIdr: totalPaidIdr,
    notes: payloadNotes,
    description: values.description || "",
    recipientName: values.recipientName?.trim() ?? "",
    items: printableItems,
    version: values.version,
    status: values.invoiceStatus,
  };
}

export function parseNumberInput(value: string): number {
  let normalized = value.replace(/\./g, "");
  normalized = normalized.replace(/,/g, ".");
  normalized = normalized.replace(/[^0-9.-]/g, "");
  const val = Number.parseFloat(normalized);
  return Number.isFinite(val) ? val : 0;
}

export function formatNumberInput(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

export function createEmptyDraftItems(): InvoiceDraftItem[] {
  return [
    {
      id: "line-item-1",
      description: "",
      pax: 1,
      currency: "IDR",
      unitPrice: 0,
    },
  ];
}

export function mapBackendInvoiceItemsToDraftItems(items: ReadonlyArray<any> | undefined): InvoiceDraftItem[] {
  if (!items || items.length === 0) {
    return createEmptyDraftItems();
  }

  return items.map((item) => ({
    id: item.id || `line-${Date.now()}-${Math.random()}`,
    description: item.description,
    pax: item.pax,
    currency: item.currency,
    unitPrice: item.unitPrice,
  }));
}

export function createInitialInvoiceDraftItems(initialInvoice: InvoiceWorkspaceInitialData | null): InvoiceDraftItem[] {
  if (!initialInvoice) {
    return createEmptyDraftItems();
  }

  return mapBackendInvoiceItemsToDraftItems(initialInvoice.items);
}

