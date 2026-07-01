import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type FieldErrors, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as z from "zod/v4";
import * as Domain from "../shared/app-domain";
import type { GroupData } from "../shared/app-domain";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../components/form-accessibility";
import { PageHeroSection } from "../components/page-hero-section";
import { PaginationControls } from "../components/pagination-controls";
import { DatePickerInput } from "../components/date-time-pickers";
import { SereneSelect } from "../components/serene-select";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { useModalFocusTrap } from "../components/use-modal-focus-trap";
import { useThemeMode } from "../theme/theme-provider";
import { Button } from "../components/button";
import {
  type BackendInvoiceClient,
  type BackendInvoiceItem,
  type BackendInvoiceRow,
} from "../hooks/use-invoice-backend";
import {
  useCreateInvoiceMutation,
  useInvoiceDashboardQuery,
  useUpdateInvoiceMutation,
} from "../hooks/use-invoice-query";
import { useMasterDataOptionsQuery } from "../hooks/use-master-data-query";
import {
  isMasterDataClientOptionId,
  mergeInvoiceClientsWithMasterData,
  resolveInvoiceDownPaymentIdr,
  resolveInvoiceOutstandingBalanceLabel,
  resolveInvoiceRemainingBalanceIdr,
  resolveExchangeRatesFromItems,
  resolveExchangeRatesFromRow,
} from "./invoice-page-shared";

const INVOICE_PAGE_SIZE = 8;
const MANUAL_CLIENT_OPTION_ID = "__invoice_client_other__";

type InvoiceStatus = BackendInvoiceRow["status"];
type InvoiceRow = BackendInvoiceRow;
type InvoiceClientOption = BackendInvoiceClient & {
  metadata?: Record<string, any>;
};

type DueMonthOption = {
  value: string;
  label: string;
};

type SelectOption = {
  value: string;
  label: string;
  metadata?: Record<string, any>;
};

type InvoiceStatusOption = {
  value: InvoiceStatus;
  label: string;
};

type InvoiceDraftCurrency = BackendInvoiceItem["currency"];

type InvoiceDraftItem = BackendInvoiceItem & {
  id: string;
};

type InvoiceWorkspaceInitialData = {
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
  items: InvoiceDraftItem[];
};

const defaultBankDisbursementOptions: SelectOption[] = [
  { value: "bsi", label: "Mandiri Syariah (BSI) - 7088 1234 5678" },
  { value: "bca", label: "BCA (IDR) - 035 123 4455" },
  { value: "bca_usd", label: "BCA (USD) - 035 998 7766" },
];

const defaultIssuingOfficeOptions: SelectOption[] = [
  { value: "Bekasi Office", label: "Bekasi Office" },
  { value: "Jakarta HQ", label: "Jakarta HQ" },
];

const defaultInvoiceStatusOptions: InvoiceStatusOption[] = [
  { value: "Pending", label: "Pending" },
  { value: "Partially Paid", label: "Partially Paid" },
  { value: "Paid", label: "Paid" },
  { value: "Overdue", label: "Overdue" },
  { value: "Cancelled", label: "Cancelled" },
];

const invoiceDraftItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  pax: z.number(),
  currency: z.enum(["IDR", "USD", "SAR"]),
  unitPrice: z.number(),
  totalPrice: z.number(),
  totalPriceIdr: z.number(),
});

const invoiceWorkspaceFormSchema = z
  .object({
    issueDateIso: z.string().trim().min(1, "Select issue date before saving invoice."),
    dueDateIso: z.string().optional(),
    invoiceStatus: z.string(),
    issuingOffice: z.string(),
    selectedClientId: z.string().trim().min(1, "Select a client before saving invoice."),
    manualClientName: z.string(),
    selectedGroupCode: z.string(),
    address: z.string().optional(),
    recipientName: z.string().optional(),
    bankAccount: z.string(),
    downPaymentIdr: z.number().min(0),
    notes: z.string(),
    items: z.array(invoiceDraftItemSchema),
    payments: z.array(z.object({
      amount: z.number(),
      dateIso: z.string(),
    })).optional(),
  })
  .superRefine((values, context) => {
    if (values.selectedClientId === MANUAL_CLIENT_OPTION_ID && values.manualClientName.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["manualClientName"],
        message: "Isi nama client manual terlebih dulu.",
      });
    }
  });

type InvoiceWorkspaceFormValues = z.infer<typeof invoiceWorkspaceFormSchema>;

function formatIdr(value: number): string {
  const normalized = Math.max(0, Math.round(value));
  return `IDR ${new Intl.NumberFormat("id-ID").format(normalized)}`;
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

function extractYearFromIsoDate(isoDate: string): string {
  const normalized = isoDate.trim();
  const matched = normalized.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!matched) {
    return Domain.formatLocalIsoDate(new Date()).slice(0, 4);
  }

  return matched[1];
}

function formatMonthLabel(monthKey: string): string {
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

function shiftMonthKey(monthKey: string, offset: number): string {
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

function getStatusClasses(status: InvoiceStatus, isDarkMode: boolean): string {
  if (status === "Cancelled") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (status === "Paid") {
    return isDarkMode
      ? "border-primary/35 bg-primary/16 text-primary"
      : "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "Pending") {
    return isDarkMode
      ? "border-secondary/35 bg-secondary/16 text-secondary"
      : "border-amber-200 bg-amber-100 text-amber-800";
  }

  return isDarkMode ? "border-tertiary/35 bg-tertiary/16 text-tertiary" : "border-rose-200 bg-rose-100 text-rose-700";
}

function getInvoiceStatusDisplayLabel(status: InvoiceStatus): string {
  return status === "Paid" ? "Paid / Lunas" : status;
}

function getAvatarToneByStatus(status: InvoiceStatus, isDarkMode: boolean): string {
  if (status === "Cancelled") {
    return "bg-slate-200 text-slate-700";
  }

  if (status === "Paid") {
    return isDarkMode ? "bg-primary/18 text-primary" : "bg-emerald-100 text-emerald-700";
  }

  if (status === "Pending") {
    return isDarkMode ? "bg-secondary/18 text-secondary" : "bg-amber-100 text-amber-700";
  }

  return isDarkMode ? "bg-tertiary/18 text-tertiary" : "bg-rose-100 text-rose-700";
}

function getStatusValue(status: InvoiceStatus): "all" | "paid" | "pending" | "overdue" | "cancelled" {
  if (status === "Cancelled") {
    return "cancelled";
  }

  if (status === "Paid") {
    return "paid";
  }

  if (status === "Pending") {
    return "pending";
  }

  return "overdue";
}

function resolveDateRangeLabel(rows: InvoiceRow[]): string {
  if (rows.length === 0) {
    return "-";
  }

  const sortedDates = rows.map((row) => row.dueDateIso).sort((left, right) => left.localeCompare(right));
  const minIso = sortedDates[0];
  const maxIso = sortedDates[sortedDates.length - 1];
  return `${formatDateLabel(minIso)} - ${formatDateLabel(maxIso)}`;
}

function parseNumberInput(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return 0;
  }

  return Number.parseInt(digits, 10);
}

function formatNumberInput(value: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.max(0, Math.round(value)));
}

function extractInvoiceSerial(invoiceNumber: string): number | null {
  const matchedSerial = invoiceNumber.trim().match(/\/(\d{4})$/);
  if (!matchedSerial) {
    return null;
  }

  const serialValue = Number.parseInt(matchedSerial[1], 10);
  return Number.isFinite(serialValue) ? serialValue : null;
}

function buildNextInvoiceNumber(existingInvoiceNumbers: string[], year: string): string {
  const sameYearInvoices = existingInvoiceNumbers.filter((value) => value.includes(`/INV/${year}/`));
  const maxSerial = sameYearInvoices.reduce((highest, current) => {
    const parsed = extractInvoiceSerial(current);
    if (!parsed) {
      return highest;
    }

    return Math.max(highest, parsed);
  }, 0);

  return `GTT/INV/${year}/${String(maxSerial + 1).padStart(4, "0")}`;
}

function convertToIdr({
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

function resolveDraftItemTotals(
  item: Pick<InvoiceDraftItem, "pax" | "unitPrice" | "currency">,
  usdToIdr: number,
  sarToIdr: number,
): Pick<InvoiceDraftItem, "totalPrice" | "totalPriceIdr"> {
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

function calculateSubtotalIdr(args: { items: InvoiceDraftItem[]; usdToIdr: number; sarToIdr: number }): number {
  return args.items.reduce((total, item) => {
    const nextTotals = resolveDraftItemTotals(item, args.usdToIdr, args.sarToIdr);
    return total + Math.max(0, Math.round(nextTotals.totalPriceIdr));
  }, 0);
}

function calculateSubtotalInCurrency(items: InvoiceDraftItem[], targetCurrency: string, usdToIdr: number, sarToIdr: number): number {
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

function createEmptyDraftItems(): InvoiceDraftItem[] {
  return [
    {
      id: "line-1",
      description: "",
      pax: 0,
      currency: "IDR",
      unitPrice: 0,
      totalPrice: 0,
      totalPriceIdr: 0,
    },
  ];
}

function mapBackendInvoiceItemsToDraftItems(items: ReadonlyArray<BackendInvoiceItem> | undefined): InvoiceDraftItem[] {
  if (!items || items.length === 0) {
    return [];
  }

  return items
    .map((item, index) => ({
      id: `line-${index + 1}`,
      description: item.description.trim(),
      pax: Math.max(0, Math.round(item.pax)),
      currency: item.currency,
      unitPrice: Math.max(0, Math.round(item.unitPrice)),
      totalPrice: Math.max(0, Math.round(item.totalPrice)),
      totalPriceIdr: Math.max(0, Math.round(item.totalPriceIdr)),
    }))
    .filter((item) => item.description.length > 0 && item.pax > 0 && item.unitPrice > 0);
}

function createInitialInvoiceDraftItems(initialInvoice: InvoiceWorkspaceInitialData | null): InvoiceDraftItem[] {
  if (!initialInvoice) {
    return createEmptyDraftItems();
  }

  if (initialInvoice.items.length > 0) {
    return initialInvoice.items.map((item, index) => ({
      ...item,
      id: `line-${index + 1}`,
    }));
  }

  return [
    {
      id: "line-1",
      description: initialInvoice.groupCode
        ? `Invoice for Group ${initialInvoice.groupCode}`
        : `Invoice ${initialInvoice.invoiceNumber}`,
      pax: 1,
      currency: "IDR",
      unitPrice: Math.max(0, Math.round(initialInvoice.amount)),
      totalPrice: Math.max(0, Math.round(initialInvoice.amount)),
      totalPriceIdr: Math.max(0, Math.round(initialInvoice.amount)),
    },
  ];
}

function mapMasterDataToSelectOptions(
  options: Array<{ value: string; label: string; isActive: boolean }>,
): SelectOption[] {
  return options
    .filter((option) => option.isActive)
    .map((option) => ({
      value: option.value.trim(),
      label: option.label.trim() || option.value.trim(),
    }))
    .filter((option) => option.value.length > 0);
}

function mapMasterDataToInvoiceStatusOptions(
  options: Array<{ value: string; label: string; isActive: boolean }>,
): InvoiceStatusOption[] {
  const allowedStatuses = new Set<InvoiceStatus>(["Pending", "Paid", "Overdue", "Cancelled"]);
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

function mapMasterDataToClientSuggestions(options: Array<{ label: string; isActive: boolean }>): string[] {
  return Array.from(
    new Set(
      options
        .filter((option) => option.isActive)
        .map((option) => option.label.trim())
        .filter((label) => label.length > 0),
    ),
  );
}

function resolveBankAccountLabel(
  value: string,
  options: ReadonlyArray<SelectOption> = defaultBankDisbursementOptions,
): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function createInvoiceWorkspaceInitialData(row: InvoiceRow): InvoiceWorkspaceInitialData {
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
    items: mapBackendInvoiceItemsToDraftItems(row.items),
  };
}


function resolveInvoiceWorkspaceValidationMessage(errors: FieldErrors<InvoiceWorkspaceFormValues>): string | null {
  const candidateMessages = [
    errors.issueDateIso?.message,
    errors.dueDateIso?.message,
    errors.selectedClientId?.message,
    errors.manualClientName?.message,
    errors.issuingOffice?.message,
    errors.invoiceStatus?.message,
    errors.bankAccount?.message,
  ];

  for (const candidate of candidateMessages) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

function normalizeInvoiceDraftItems(items: InvoiceDraftItem[]): InvoiceDraftItem[] {
  return items
    .map((item) => ({
      ...item,
      description: item.description.trim(),
      pax: Math.max(0, Math.round(item.pax)),
      unitPrice: Math.max(0, Math.round(item.unitPrice)),
    }))
    .filter((item) => item.description.length > 0 && item.pax > 0 && item.unitPrice > 0);
}

function buildPrintableInvoiceItems(
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

// viewInvoicePdfFromRow and openPendingInvoicePdfWindow removed in favor of direct iframe-based printing

export function CreateInvoiceWorkspace({
  mode,
  initialInvoice,
  clients,
  issuingOfficeOptions,
  invoiceStatusOptions,
  bankDisbursementOptions,
  manualClientNameSuggestions,
  groups,
  existingInvoiceNumbers,
  isBackendAvailable,
  onBack,
  onCreate,
  onUpdate,
}: {
  mode: "create" | "edit";
  initialInvoice?: InvoiceWorkspaceInitialData | null;
  clients: InvoiceClientOption[];
  issuingOfficeOptions: SelectOption[];
  invoiceStatusOptions: InvoiceStatusOption[];
  bankDisbursementOptions: SelectOption[];
  manualClientNameSuggestions: string[];
  groups: GroupData[];
  existingInvoiceNumbers: string[];
  isBackendAvailable: boolean;
  onBack: () => void;
  onCreate: (invoice: InvoiceRow, action: "generated" | "draft") => void;
  onUpdate: (invoice: InvoiceRow) => void;
}) {
  const { theme } = useThemeMode();
  const isDarkMode = theme === "dark";
  const createInvoiceMutation = useCreateInvoiceMutation();
  const updateInvoiceMutation = useUpdateInvoiceMutation();
  const isEditMode = mode === "edit";
  const resolvedInitialInvoice = initialInvoice ?? null;
  const initialRates = useMemo(() => {
    return resolveExchangeRatesFromRow(resolvedInitialInvoice || { notes: "", items: [] });
  }, [resolvedInitialInvoice]);
  const [usdToIdr, setUsdToIdr] = useState(() => initialRates.usdToIdr);
  const [sarToIdr, setSarToIdr] = useState(() => initialRates.sarToIdr);
  const [keepValasCurrency, setKeepValasCurrency] = useState<"IDR" | "USD" | "SAR">(() => {
    const notesRaw = resolvedInitialInvoice?.notes ?? "";
    if (notesRaw.includes("[KeepValasTotal:USD]")) return "USD";
    if (notesRaw.includes("[KeepValasTotal:SAR]")) return "SAR";
    if (notesRaw.includes("[KeepValasTotal]")) {
      const valas = resolvedInitialInvoice?.items.find((item) => item.currency !== "IDR")?.currency;
      return valas || "IDR";
    }
    return "IDR";
  });

  const initialClientId = resolvedInitialInvoice?.clientId ?? "";
  const resolvedInitialClientName = resolvedInitialInvoice?.clientName.trim() ?? "";
  const hasResolvedInitialClient = initialClientId ? clients.some((client) => client.id === initialClientId) : false;
  const hasResolvedInitialManualClient =
    Boolean(resolvedInitialInvoice) && !hasResolvedInitialClient && resolvedInitialClientName.length > 0;
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors: formErrors },
  } = useForm<InvoiceWorkspaceFormValues>({
    resolver: zodResolver(invoiceWorkspaceFormSchema),
    mode: "onChange",
    defaultValues: {
      issueDateIso: resolvedInitialInvoice?.issuedDateIso ?? "",
      dueDateIso: resolvedInitialInvoice?.dueDateIso ?? "",
      invoiceStatus: resolvedInitialInvoice?.status ?? (isEditMode ? (invoiceStatusOptions[0]?.value ?? "") : ""),
      issuingOffice: (() => {
        const notesRaw = resolvedInitialInvoice?.notes ?? "";
        const match = notesRaw.match(/\[IssuingOffice:([^\]]+)\]/);
        if (match && match[1]) {
          return match[1].trim();
        }
        return issuingOfficeOptions[0]?.value ?? "";
      })(),
      selectedClientId: resolvedInitialInvoice
        ? hasResolvedInitialClient
          ? initialClientId
          : hasResolvedInitialManualClient
            ? MANUAL_CLIENT_OPTION_ID
            : ""
        : "",
      manualClientName: hasResolvedInitialManualClient ? resolvedInitialClientName : "",
      selectedGroupCode: resolvedInitialInvoice?.groupCode ?? "",
      address: (() => {
        if (!resolvedInitialInvoice) return "";
        const notesRaw = resolvedInitialInvoice.notes ?? "";
        const match = notesRaw.match(/\[Address:([^\]]*)\]/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
        // Fallback to clientLabel but exclude it if it is just a sequence pattern like '01. Yassir'
        const label = resolvedInitialInvoice.clientLabel || "";
        if (label.match(/^\d+\.\s/)) {
          return "";
        }
        return label || resolvedInitialInvoice.clientName || "";
      })(),
      recipientName: resolvedInitialInvoice?.recipientName ?? "",
      bankAccount: (() => {
        const notesRaw = resolvedInitialInvoice?.notes ?? "";
        const match = notesRaw.match(/\[BankAccount:([^\]]+)\]/);
        if (match && match[1]) {
          return match[1].trim();
        }
        return bankDisbursementOptions[0]?.value ?? "";
      })(),
      downPaymentIdr: (() => {
        if (!resolvedInitialInvoice) return 0;
        const notesRaw = resolvedInitialInvoice.notes ?? "";
        let initialKeepValasCurrency: "IDR" | "USD" | "SAR" = "IDR";
        if (notesRaw.includes("[KeepValasTotal:USD]")) initialKeepValasCurrency = "USD";
        else if (notesRaw.includes("[KeepValasTotal:SAR]")) initialKeepValasCurrency = "SAR";
        else if (notesRaw.includes("[KeepValasTotal]")) {
          initialKeepValasCurrency = resolvedInitialInvoice.items.find((item) => item.currency !== "IDR")?.currency || "IDR";
        }
        if (initialKeepValasCurrency !== "IDR") {
          const rateVal = initialKeepValasCurrency === "USD" ? initialRates.usdToIdr : initialRates.sarToIdr;
          if (rateVal > 0) {
            return Math.ceil(resolvedInitialInvoice.downPaymentIdr / rateVal);
          }
        }
        return resolvedInitialInvoice.downPaymentIdr;
      })(),
      notes: resolvedInitialInvoice?.notes
        ? resolvedInitialInvoice.notes
            .replace(/\[KeepValasTotal:[A-Z]+\]/g, "")
            .replace(/\[KeepValasTotal\]/g, "")
            .replace(/\[Rates:USD=\d+,SAR=\d+\]/g, "")
            .replace(/\[BankAccount:[^\]]+\]/g, "")
            .replace(/\[IssuingOffice:[^\]]+\]/g, "")
            .replace(/\[NoDueDate:true\]/g, "")
            .replace(/\[Address:[^\]]*\]/g, "")
            .replace(/\[Payments:[^\]]*\]/g, "")
            .trim()
        : "",
      items: createInitialInvoiceDraftItems(resolvedInitialInvoice),
      payments: (() => {
        if (!resolvedInitialInvoice) return [];
        const notesRaw = resolvedInitialInvoice.notes ?? "";
        const match = notesRaw.match(/\[Payments:([^\]]*)\]/);
        if (match && match[1]) {
          try {
            return JSON.parse(decodeURIComponent(match[1]));
          } catch {
            return [];
          }
        }
        
        let initialKeepValasCurrency: "IDR" | "USD" | "SAR" = "IDR";
        if (notesRaw.includes("[KeepValasTotal:USD]")) initialKeepValasCurrency = "USD";
        else if (notesRaw.includes("[KeepValasTotal:SAR]")) initialKeepValasCurrency = "SAR";
        else if (notesRaw.includes("[KeepValasTotal]")) {
          initialKeepValasCurrency = resolvedInitialInvoice.items.find((item) => item.currency !== "IDR")?.currency || "IDR";
        }
        let legacyAmount = resolvedInitialInvoice.downPaymentIdr;
        if (initialKeepValasCurrency !== "IDR") {
          const rateVal = initialKeepValasCurrency === "USD" ? initialRates.usdToIdr : initialRates.sarToIdr;
          if (rateVal > 0) {
            legacyAmount = Math.ceil(resolvedInitialInvoice.downPaymentIdr / rateVal);
          }
        }

        if (legacyAmount > 0) {
          return [
            {
              amount: legacyAmount,
              dateIso: resolvedInitialInvoice.issuedDateIso || "",
            },
          ];
        }
        return [];
      })(),
    },
  });
  const issueDateIso = watch("issueDateIso");
  const dueDateIso = watch("dueDateIso");
  const invoiceStatus = watch("invoiceStatus") as InvoiceStatus | "";
  const issuingOffice = watch("issuingOffice");
  const selectedClientId = watch("selectedClientId");
  const prevClientIdRef = useRef(selectedClientId);
  const selectedGroupCode = watch("selectedGroupCode");
  const address = watch("address");
  const bankAccount = watch("bankAccount");
  const downPaymentIdr = watch("downPaymentIdr");
  const items = useWatch({ control, name: "items" }) || [];
  const {
    fields: itemFields,
    append: appendItem,
    remove: removeItemFromForm,
  } = useFieldArray({
    control,
    name: "items",
    keyName: "fieldKey",
  });
  const {
    fields: paymentFields,
    append: appendPayment,
    remove: removePayment,
  } = useFieldArray({
    control,
    name: "payments" as any,
  });
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const isManualClientSelected = selectedClientId === MANUAL_CLIENT_OPTION_ID;
  const selectedGroup = useMemo(
    () => groups.find((group) => group.code === selectedGroupCode) ?? null,
    [groups, selectedGroupCode],
  );
  const nextInvoiceNumberPreview = useMemo(
    () => buildNextInvoiceNumber(existingInvoiceNumbers, extractYearFromIsoDate(dueDateIso || issueDateIso || "")),
    [existingInvoiceNumbers, dueDateIso, issueDateIso],
  );
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isCancelConfirmationOpen, setIsCancelConfirmationOpen] = useState(false);
  const cancelConfirmationDialogRef = useModalFocusTrap<HTMLDivElement>({
    isActive: isCancelConfirmationOpen,
    onClose: () => setIsCancelConfirmationOpen(false),
  });
  const isWorkspaceBusy = isSubmitting || isSavingDraft;
  const isSubmitDisabled = isWorkspaceBusy || !isBackendAvailable;
  const issueDateErrorMessage = formErrors.issueDateIso?.message;
  const dueDateErrorMessage = formErrors.dueDateIso?.message;
  const issuingOfficeErrorMessage = formErrors.issuingOffice?.message;
  const invoiceStatusErrorMessage = formErrors.invoiceStatus?.message;
  const selectedClientErrorMessage = formErrors.selectedClientId?.message;
  const manualClientNameErrorMessage = formErrors.manualClientName?.message;
  const bankAccountErrorMessage = formErrors.bankAccount?.message;
  const bankDisbursementHintClassName = isDarkMode
    ? "flex items-start gap-2 rounded-lg border border-outline-variant/45 bg-surface-container-high p-2"
    : "flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2";
  const rowCounterRef = useRef(3);

  const resolveClientSelection = (values: InvoiceWorkspaceFormValues) => {
    const isUsingManualClient = values.selectedClientId === MANUAL_CLIENT_OPTION_ID;
    const selectedClient = isUsingManualClient
      ? null
      : (clients.find((client) => client.id === values.selectedClientId) ?? null);
    const isUsingMasterDataClient = Boolean(selectedClient && isMasterDataClientOptionId(selectedClient.id));
    const manualClientName = values.manualClientName.trim();

    return {
      selectedClient,
      clientId: selectedClient && !isUsingMasterDataClient ? selectedClient.id : undefined,
      clientName: isUsingManualClient
        ? manualClientName || undefined
        : isUsingMasterDataClient
          ? selectedClient?.name.trim() || undefined
          : undefined,
    };
  };

  useEffect(() => {
    if (!isEditMode || selectedClient || selectedClientId === MANUAL_CLIENT_OPTION_ID || clients.length === 0) {
      return;
    }

    setValue("selectedClientId", clients[0].id);
  }, [isEditMode, selectedClient, selectedClientId, clients, setValue]);

  useEffect(() => {
    if (!isEditMode || isManualClientSelected) {
      return;
    }

    if (!selectedClient) {
      setValue("address", "");
      return;
    }

    if (selectedClient.groupCode && !selectedGroupCode) {
      setValue("selectedGroupCode", selectedClient.groupCode);
    }

    if (!address || !address.trim()) {
      setValue("address", selectedClient.name);
    }
  }, [selectedClient, selectedGroupCode, isEditMode, isManualClientSelected, address, setValue]);

  useEffect(() => {
    if (!isEditMode || issuingOffice.trim() || issuingOfficeOptions.length === 0) {
      return;
    }

    setValue("issuingOffice", issuingOfficeOptions[0].value);
  }, [isEditMode, issuingOffice, issuingOfficeOptions, setValue]);

  useEffect(() => {
    if (!isEditMode || invoiceStatus || invoiceStatusOptions.length === 0) {
      return;
    }

    setValue("invoiceStatus", invoiceStatusOptions[0].value);
  }, [isEditMode, invoiceStatus, invoiceStatusOptions, setValue]);

  useEffect(() => {
    if (!isEditMode || bankAccount.trim() || bankDisbursementOptions.length === 0) {
      return;
    }

    setValue("bankAccount", bankDisbursementOptions[0].value);
  }, [isEditMode, bankAccount, bankDisbursementOptions, setValue]);

  useEffect(() => {
    if (!selectedClientId) {
      prevClientIdRef.current = selectedClientId;
      return;
    }

    const isInitialClient = isEditMode && resolvedInitialInvoice && selectedClientId === resolvedInitialInvoice.clientId;
    const isClientChanged = prevClientIdRef.current !== selectedClientId;

    if (!isInitialClient || isClientChanged) {
      if (selectedClientId === MANUAL_CLIENT_OPTION_ID) {
        setValue("recipientName", "", { shouldDirty: true });
      } else {
        const matchedClient = clients.find((client) => client.id === selectedClientId);
        const metadata = (matchedClient as any)?.metadata;
        const defaultRecipient = metadata?.penerima || "";
        setValue("recipientName", defaultRecipient, { shouldDirty: true });
      }
    }

    prevClientIdRef.current = selectedClientId;
  }, [selectedClientId, clients, setValue, isEditMode, resolvedInitialInvoice]);

  useEffect(() => {
    if (!saveFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setSaveFeedback((current) => (current ? null : current));
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [saveFeedback]);

  useEffect(() => {
    if (!isCancelConfirmationOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCancelConfirmationOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isCancelConfirmationOpen]);

  useEffect(() => {
    items.forEach((item, index) => {
      const nextTotals = resolveDraftItemTotals(item, usdToIdr, sarToIdr);

      if (item.totalPrice !== nextTotals.totalPrice) {
        setValue(`items.${index}.totalPrice`, nextTotals.totalPrice, {
          shouldDirty: false,
          shouldValidate: false,
        });
      }

      if (item.totalPriceIdr !== nextTotals.totalPriceIdr) {
        setValue(`items.${index}.totalPriceIdr`, nextTotals.totalPriceIdr, {
          shouldDirty: false,
          shouldValidate: false,
        });
      }
    });
  }, [items, usdToIdr, sarToIdr, setValue]);

  const uniqueValasCurrencies = useMemo(() => {
    const valas = new Set<"USD" | "SAR">();
    items.forEach((item) => {
      if (item.currency === "USD" || item.currency === "SAR") {
        valas.add(item.currency);
      }
    });
    return Array.from(valas);
  }, [items]);

  const valasCurrency = uniqueValasCurrencies[0] || "IDR";

  const invoiceCurrency = keepValasCurrency;

  const handleKeepValasCurrencyChange = (nextCurrency: "IDR" | "USD" | "SAR") => {
    const prevCurrency = keepValasCurrency;
    setKeepValasCurrency(nextCurrency);

    const prevRate = prevCurrency === "USD" ? usdToIdr : prevCurrency === "SAR" ? sarToIdr : 1;
    const nextRate = nextCurrency === "USD" ? usdToIdr : nextCurrency === "SAR" ? sarToIdr : 1;

    // Convert each payment's amount to the new currency
    const updatedPayments = payments.map((p) => {
      const amtInIdr = prevRate > 0 ? p.amount * prevRate : p.amount;
      const convertedAmt = nextRate > 0 ? amtInIdr / nextRate : 0;
      const finalAmt = nextCurrency !== "IDR" ? Math.ceil(convertedAmt) : Math.round(convertedAmt);
      return {
        ...p,
        amount: finalAmt,
      };
    });

    setValue("payments", updatedPayments, {
      shouldDirty: true,
      shouldValidate: false,
    });
  };

  useEffect(() => {
    if (keepValasCurrency !== "IDR" && !uniqueValasCurrencies.includes(keepValasCurrency as any)) {
      handleKeepValasCurrencyChange("IDR");
    }
  }, [uniqueValasCurrencies, keepValasCurrency]);

  const subtotal = useMemo(() => {
    return calculateSubtotalInCurrency(items, invoiceCurrency, usdToIdr, sarToIdr);
  }, [items, invoiceCurrency, usdToIdr, sarToIdr]);

  const taxAmount = 0;
  const totalPayable = subtotal + taxAmount;
  const normalizedDownPayment = Math.min(totalPayable, Math.max(0, Math.round(downPaymentIdr)));
  const downPaymentCoveragePercent =
    totalPayable > 0 ? Math.min(100, Math.round((normalizedDownPayment / totalPayable) * 100)) : 0;
  const remainingBalance = resolveInvoiceRemainingBalanceIdr(totalPayable, normalizedDownPayment);

  const payments = watch("payments") || [];
  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [payments]);

  // Sync downPaymentIdr to totalPaid
  useEffect(() => {
    setValue("downPaymentIdr", totalPaid, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [totalPaid, setValue]);

  // Automatically calculate status based on payment progress
  useEffect(() => {
    if (invoiceStatus === "Cancelled") {
      return;
    }

    if (totalPayable > 0 && totalPaid >= totalPayable) {
      setValue("invoiceStatus", "Paid", { shouldDirty: true, shouldValidate: true });
    } else if (totalPaid > 0) {
      setValue("invoiceStatus", "Partially Paid", { shouldDirty: true, shouldValidate: true });
    } else {
      if (dueDateIso) {
        const todayIso = Domain.formatLocalIsoDate(new Date());
        if (dueDateIso < todayIso) {
          setValue("invoiceStatus", "Overdue", { shouldDirty: true, shouldValidate: true });
          return;
        }
      }
      setValue("invoiceStatus", "Pending", { shouldDirty: true, shouldValidate: true });
    }
  }, [totalPaid, totalPayable, dueDateIso, setValue, invoiceStatus]);

  const addItemRow = () => {
    const nextId = `line-${Date.now()}-${rowCounterRef.current}`;
    rowCounterRef.current += 1;

    appendItem({
      id: nextId,
      description: "",
      pax: Math.max(1, selectedGroup?.pax ?? 1),
      currency: "IDR",
      unitPrice: 0,
      totalPrice: 0,
      totalPriceIdr: 0,
    });
  };

  const updateItemRow = (index: number, nextItem: InvoiceDraftItem) => {
    const nextTotals = resolveDraftItemTotals(nextItem, usdToIdr, sarToIdr);

    setValue(
      `items.${index}`,
      {
        ...nextItem,
        ...nextTotals,
      },
      {
        shouldDirty: true,
        shouldValidate: true,
      },
    );
  };

  const removeItem = (index: number) => {
    if (itemFields.length <= 1) {
      return;
    }

    removeItemFromForm(index);
  };

  const handleWorkspaceValidationError = (errors: FieldErrors<InvoiceWorkspaceFormValues>) => {
    setSaveFeedback(
      resolveInvoiceWorkspaceValidationMessage(errors) ?? "Periksa kembali data invoice sebelum disimpan.",
    );
  };

  const handleSaveDraft = handleSubmit(async (values) => {
    if (isEditMode || isWorkspaceBusy) {
      return;
    }

    if (!isBackendAvailable) {
      setSaveFeedback("Save Draft hanya tersedia saat backend invoice dan database terhubung.");
      return;
    }

    const clientSelection = resolveClientSelection(values);
    if (!clientSelection.clientId && !clientSelection.clientName) {
      setSaveFeedback("Select a client before saving draft.");
      return;
    }

    const normalizedItems = normalizeInvoiceDraftItems(values.items);
    if (normalizedItems.length === 0) {
      setSaveFeedback("Add at least one valid package item first.");
      return;
    }
    const printableItems = buildPrintableInvoiceItems(normalizedItems, usdToIdr, sarToIdr);

    const linkedGroupCode = values.selectedGroupCode.trim() || (clientSelection.selectedClient?.groupCode ?? "");

    clearErrors(["invoiceStatus", "issuingOffice", "bankAccount"]);
    const payloadDownPaymentIdr = keepValasCurrency !== "IDR"
      ? Math.max(0, Math.round(normalizedDownPayment * (keepValasCurrency === "USD" ? usdToIdr : sarToIdr)))
      : normalizedDownPayment;
    const payloadAmount = keepValasCurrency !== "IDR"
      ? Math.max(0, Math.round(totalPayable * (keepValasCurrency === "USD" ? usdToIdr : sarToIdr)))
      : totalPayable;
    
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
    if (values.address) {
      payloadNotes += `\n[Address:${encodeURIComponent(values.address)}]`;
    }
    if (values.payments && values.payments.length > 0) {
      payloadNotes += `\n[Payments:${encodeURIComponent(JSON.stringify(values.payments))}]`;
    }
    if (!values.dueDateIso || !values.dueDateIso.trim()) {
      payloadNotes += `\n[NoDueDate:true]`;
    }

    setIsSavingDraft(true);
    try {
      const savedInvoice = await createInvoiceMutation.mutateAsync({
        clientId: clientSelection.clientId,
        clientName: clientSelection.clientName,
        groupCode: linkedGroupCode || undefined,
        issuedDateIso: values.issueDateIso,
        dueDateIso: values.dueDateIso || "",
        amount: payloadAmount,
        downPaymentIdr: payloadDownPaymentIdr,
        status: values.invoiceStatus ? (values.invoiceStatus as InvoiceStatus) : "Pending",
        notes: payloadNotes,
        recipientName: values.recipientName?.trim() ?? "",
        items: printableItems,
      });

      onCreate(savedInvoice, "draft");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save invoice draft. Please retry.";
      setSaveFeedback(errorMessage);
    } finally {
      setIsSavingDraft(false);
    }
  }, handleWorkspaceValidationError);

  const handleSubmitInvoice = handleSubmit(async (values) => {
    if (isWorkspaceBusy) {
      return;
    }

    if (!isBackendAvailable) {
      setSaveFeedback(
        isEditMode
          ? "Save Changes hanya tersedia saat backend invoice dan database terhubung."
          : "Generate Invoice hanya tersedia saat backend invoice dan database terhubung.",
      );
      return;
    }

    const clientSelection = resolveClientSelection(values);
    if (!clientSelection.clientId && !clientSelection.clientName) {
      setSaveFeedback(
        isEditMode ? "Select a client before saving invoice changes." : "Select a client before generating invoice.",
      );
      return;
    }

    if (!values.invoiceStatus) {
      setError("invoiceStatus", {
        type: "manual",
        message: "Select invoice status before saving invoice.",
      });
      setSaveFeedback("Select invoice status before saving invoice.");
      return;
    }

    if (!values.issuingOffice.trim()) {
      setError("issuingOffice", {
        type: "manual",
        message: "Select issuing office before saving invoice.",
      });
      setSaveFeedback("Select issuing office before saving invoice.");
      return;
    }

    if (!values.bankAccount.trim()) {
      setError("bankAccount", {
        type: "manual",
        message: "Select bank account before saving invoice.",
      });
      setSaveFeedback("Select bank account before saving invoice.");
      return;
    }

    clearErrors(["invoiceStatus", "issuingOffice", "bankAccount"]);
    const normalizedItems = normalizeInvoiceDraftItems(values.items);
    if (normalizedItems.length === 0) {
      setSaveFeedback("Add at least one valid package item first.");
      return;
    }
    const printableItems = buildPrintableInvoiceItems(normalizedItems, usdToIdr, sarToIdr);

    const linkedGroupCode = values.selectedGroupCode.trim() || (clientSelection.selectedClient?.groupCode ?? "");
    const payloadDownPaymentIdr = keepValasCurrency !== "IDR"
      ? Math.max(0, Math.round(normalizedDownPayment * (keepValasCurrency === "USD" ? usdToIdr : sarToIdr)))
      : normalizedDownPayment;
    const payloadAmount = keepValasCurrency !== "IDR"
      ? Math.max(0, Math.round(totalPayable * (keepValasCurrency === "USD" ? usdToIdr : sarToIdr)))
      : totalPayable;
    
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
    if (values.address) {
      payloadNotes += `\n[Address:${encodeURIComponent(values.address)}]`;
    }
    if (values.payments && values.payments.length > 0) {
      payloadNotes += `\n[Payments:${encodeURIComponent(JSON.stringify(values.payments))}]`;
    }
    if (!values.dueDateIso || !values.dueDateIso.trim()) {
      payloadNotes += `\n[NoDueDate:true]`;
    }

    setIsSubmitting(true);
    try {
      const savedInvoice =
        isEditMode && resolvedInitialInvoice
          ? await updateInvoiceMutation.mutateAsync({
              invoiceId: resolvedInitialInvoice.id,
              payload: {
                clientId: clientSelection.clientId,
                clientName: clientSelection.clientName,
                groupCode: linkedGroupCode || undefined,
                issuedDateIso: values.issueDateIso,
                dueDateIso: values.dueDateIso || "",
                amount: payloadAmount,
                downPaymentIdr: payloadDownPaymentIdr,
                status: values.invoiceStatus as InvoiceStatus,
                notes: payloadNotes,
                recipientName: values.recipientName?.trim() ?? "",
                items: printableItems,
              },
            })
          : await createInvoiceMutation.mutateAsync({
              clientId: clientSelection.clientId,
              clientName: clientSelection.clientName,
              groupCode: linkedGroupCode || undefined,
              issuedDateIso: values.issueDateIso,
              dueDateIso: values.dueDateIso || "",
              amount: payloadAmount,
              downPaymentIdr: payloadDownPaymentIdr,
              status: values.invoiceStatus as InvoiceStatus,
              notes: payloadNotes,
              recipientName: values.recipientName?.trim() ?? "",
              items: printableItems,
            });
      if (isEditMode) {
        onUpdate(savedInvoice);
      } else {
        onCreate(savedInvoice, "generated");
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : isEditMode
            ? "Failed to update invoice. Please retry."
            : "Failed to generate invoice. Please retry.";
      setSaveFeedback(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, handleWorkspaceValidationError);

  const handleSubmitButtonClick = () => {
    if (isEditMode && invoiceStatus === "Cancelled") {
      setIsCancelConfirmationOpen(true);
      return;
    }

    void handleSubmitInvoice();
  };

  const handleConfirmCancelledStatus = () => {
    setIsCancelConfirmationOpen(false);
    void handleSubmitInvoice();
  };

  return (
    <div
      className="mx-auto max-w-[88rem] space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8"
      aria-busy={isWorkspaceBusy ? "true" : "false"}
    >
      <section className="space-y-3">
        <Button
          variant="secondary"
          size="sm"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 sm:justify-start"
          onClick={onBack}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          <span>Back to List</span>
        </Button>

        {!isBackendAvailable ? (
          <section
            className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
            role="status"
            aria-live="polite"
          >
            <span className="material-symbols-outlined mt-0.5 text-base" aria-hidden="true">
              warning
            </span>
            <p className="text-xs font-semibold leading-relaxed">
              Backend invoice/database belum terhubung.{" "}
              {isEditMode ? "Save Changes" : "Save Draft dan Generate Invoice"} dinonaktifkan sampai koneksi backend
              kembali normal.
            </p>
          </section>
        ) : null}



        <div className="serene-form-section">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <nav className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                <button type="button" className="transition hover:text-primary" onClick={onBack}>
                  Invoices
                </button>
                <span>/</span>
                <span className="text-primary">{isEditMode ? "Edit Invoice" : "Create New Invoice"}</span>
              </nav>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">
                {isEditMode ? "Edit Invoice" : "New Invoice"}
              </h1>
            </div>

            <div className="serene-form-actions rounded-xl bg-surface-container-low p-2">
              {!isEditMode ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    void handleSaveDraft();
                  }}
                  disabled={isWorkspaceBusy || !isBackendAvailable}
                  title={
                    isBackendAvailable
                      ? undefined
                      : "Backend invoice/database belum terhubung, draft belum bisa disimpan."
                  }
                >
                  {isSavingDraft ? "Saving Draft..." : "Save Draft"}
                </Button>
              ) : null}
              <Button
                variant="primary"
                onClick={handleSubmitButtonClick}
                disabled={isSubmitDisabled}
                title={
                  isBackendAvailable
                    ? undefined
                    : `Backend invoice/database belum terhubung, ${
                        isEditMode ? "perubahan invoice" : "invoice"
                      } belum bisa disimpan.`
                }
              >
                {isSubmitting
                  ? isEditMode
                    ? "Saving..."
                    : "Generating..."
                  : isEditMode
                    ? "Save Changes"
                    : "Generate Invoice"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 space-y-5 lg:col-span-9">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <article className="serene-form-section">
              <h3 className="serene-form-section-header text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  confirmation_number
                </span>
                <span>Invoice Details</span>
              </h3>

              <div className="grid grid-cols-1 gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                      Invoice Number
                    </span>
                    <input
                      type="text"
                      className="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                      value={
                        isEditMode && resolvedInitialInvoice
                          ? resolvedInitialInvoice.invoiceNumber
                          : nextInvoiceNumberPreview
                      }
                      readOnly
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                      Issue Date
                    </span>
                    <Controller
                      name="issueDateIso"
                      control={control}
                      render={({ field }) => (
                        <DatePickerInput
                          id="invoice-issue-date"
                          inputClassName="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                          value={field.value}
                          onChange={field.onChange}
                          ariaInvalid={getFieldAriaInvalid(issueDateErrorMessage)}
                          ariaDescribedBy={getFieldDescribedBy("invoice-issue-date", {
                            errorMessage: issueDateErrorMessage,
                          })}
                        />
                      )}
                    />
                    <FieldErrorMessage fieldId="invoice-issue-date" message={issueDateErrorMessage} />
                  </label>
                </div>

                <label className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                    Due Date
                  </span>
                  <Controller
                    name="dueDateIso"
                    control={control}
                    render={({ field }) => (
                      <DatePickerInput
                        id="invoice-due-date"
                        inputClassName="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                        value={field.value || ""}
                        onChange={field.onChange}
                        ariaInvalid={getFieldAriaInvalid(dueDateErrorMessage)}
                        ariaDescribedBy={getFieldDescribedBy("invoice-due-date", {
                          errorMessage: dueDateErrorMessage,
                        })}
                      />
                    )}
                  />
                  <FieldErrorMessage fieldId="invoice-due-date" message={dueDateErrorMessage} />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                    Issuing Office
                  </span>
                  <Controller
                    name="issuingOffice"
                    control={control}
                    render={({ field }) => (
                      <SereneSelect
                        id="invoice-issuing-office"
                        className="serene-select h-10 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface"
                        value={field.value}
                        onChange={(event) => {
                          clearErrors("issuingOffice");
                          field.onChange(event.target.value);
                        }}
                        aria-invalid={getFieldAriaInvalid(issuingOfficeErrorMessage)}
                        aria-describedby={getFieldDescribedBy("invoice-issuing-office", {
                          errorMessage: issuingOfficeErrorMessage,
                        })}
                      >
                        <option value="">Select office</option>
                        {issuingOfficeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SereneSelect>
                    )}
                  />
                  <FieldErrorMessage fieldId="invoice-issuing-office" message={issuingOfficeErrorMessage} />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                    Invoice Status
                  </span>
                  <Controller
                    name="invoiceStatus"
                    control={control}
                    render={({ field }) => (
                      <SereneSelect
                        id="invoice-status"
                        className="serene-select h-10 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface"
                        value={field.value}
                        onChange={(event) => {
                          clearErrors("invoiceStatus");
                          field.onChange(event.target.value);
                        }}
                        aria-invalid={getFieldAriaInvalid(invoiceStatusErrorMessage)}
                        aria-describedby={getFieldDescribedBy("invoice-status", {
                          errorMessage: invoiceStatusErrorMessage,
                        })}
                      >
                        <option value="">Select status</option>
                        {invoiceStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SereneSelect>
                    )}
                  />
                  <FieldErrorMessage fieldId="invoice-status" message={invoiceStatusErrorMessage} />
                </label>
              </div>
            </article>

            <article className="serene-form-section">
              <h3 className="serene-form-section-header text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  person_pin
                </span>
                <span>Client Information</span>
              </h3>

              <div className="grid grid-cols-1 gap-3">
                <label className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                    Client Name
                  </span>
                  <Controller
                    name="selectedClientId"
                    control={control}
                    render={({ field }) => (
                      <SereneSelect
                        id="invoice-client"
                        className="serene-select h-10 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface"
                        value={field.value}
                        onChange={(event) => {
                          const nextClientId = event.target.value;
                          clearErrors(["selectedClientId", "manualClientName"]);
                          field.onChange(nextClientId);
                          if (nextClientId !== MANUAL_CLIENT_OPTION_ID) {
                            setValue("manualClientName", "");
                          }
                        }}
                        aria-invalid={getFieldAriaInvalid(selectedClientErrorMessage)}
                        aria-describedby={getFieldDescribedBy("invoice-client", {
                          errorMessage: selectedClientErrorMessage,
                        })}
                      >
                        <option value="">Select client</option>
                        <option value={MANUAL_CLIENT_OPTION_ID}>Other</option>
                        {clients.map((client) => (
                          <option key={client.id} value={client.id}>
                            {client.name}
                          </option>
                        ))}
                      </SereneSelect>
                    )}
                  />
                  <FieldErrorMessage fieldId="invoice-client" message={selectedClientErrorMessage} />
                </label>

                {isManualClientSelected ? (
                  <label className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                      Manual Client Name
                    </span>
                    <input
                      id="invoice-manual-client-name"
                      type="text"
                      className="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                      list="invoice-manual-client-suggestions"
                      placeholder="Type client name..."
                      {...register("manualClientName")}
                      aria-invalid={getFieldAriaInvalid(manualClientNameErrorMessage)}
                      aria-describedby={getFieldDescribedBy("invoice-manual-client-name", {
                        errorMessage: manualClientNameErrorMessage,
                      })}
                    />
                    {manualClientNameSuggestions.length > 0 ? (
                      <datalist id="invoice-manual-client-suggestions">
                        {manualClientNameSuggestions.map((suggestion) => (
                          <option key={suggestion} value={suggestion} />
                        ))}
                      </datalist>
                    ) : null}
                    <FieldErrorMessage fieldId="invoice-manual-client-name" message={manualClientNameErrorMessage} />
                  </label>
                ) : null}

                <label className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                    Linked Group (Optional)
                  </span>
                  <Controller
                    name="selectedGroupCode"
                    control={control}
                    render={({ field }) => (
                      <SereneSelect
                        className="serene-select h-10 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface"
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                      >
                        <option value="">No linked group</option>
                        {groups.map((group) => (
                          <option key={group.code} value={group.code}>
                            {group.code} - {group.name}
                          </option>
                        ))}
                      </SereneSelect>
                    )}
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                    Address
                  </span>
                  <input
                    type="text"
                    className="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                    placeholder="Primary business address..."
                    {...register("address")}
                  />
                </label>

                <label className="space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                    Nama Penerima / U.p.
                  </span>
                  <input
                    type="text"
                    className="h-10 w-full rounded-lg border-none bg-surface-container-low px-3 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                    placeholder="Nama PIC penerima invoice..."
                    {...register("recipientName")}
                  />
                </label>
              </div>
            </article>
          </div>

          <article className="serene-table-shell">
            <div className="flex items-center justify-between border-b border-outline-variant/20 px-5 py-3">
              <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  list_alt
                </span>
                <span>Package Items</span>
              </h3>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.11em] text-primary transition hover:underline"
                onClick={addItemRow}
              >
                <span className="material-symbols-outlined text-xs" aria-hidden="true">
                  add_circle
                </span>
                <span>Add Row</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead className="border-b border-outline-variant/20 bg-surface-container-low">
                  <tr>
                    <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                      No
                    </th>
                    <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                      Uraian
                    </th>
                    <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                      Jumlah (PAX)
                    </th>
                    <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                      Harga per Unit (PAX)
                    </th>
                    <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                      Total Harga
                    </th>
                    <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                      Total Harga (IDR)
                    </th>
                    <th className="px-5 py-2.5 text-[9px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/65">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-outline-variant/15">
                  {itemFields.map((itemField, index) => {
                    const item = items[index] ?? itemField;
                    const currentTotals = resolveDraftItemTotals(item, usdToIdr, sarToIdr);
                    const lineSubtotalLabel = `${item.currency} ${formatNumberInput(currentTotals.totalPrice)}`;
                    return (
                       <tr key={itemField.fieldKey} className="transition hover:bg-surface-container-low/45">
                        <td className="px-5 py-3 text-xs font-bold text-on-surface">
                          {String(index + 1).padStart(2, "0")}
                        </td>
                        <td className="px-5 py-3 min-w-[200px]">
                          <textarea
                            rows={1}
                            placeholder="Input description / uraian..."
                            className="w-full resize-none overflow-hidden border-none bg-transparent p-0 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-0 placeholder:italic placeholder:text-on-surface-variant/40"
                            value={item.description}
                            onChange={(event) => {
                              event.target.style.height = "auto";
                              event.target.style.height = `${event.target.scrollHeight}px`;
                              updateItemRow(index, { ...item, description: event.target.value });
                            }}
                            ref={(el) => {
                              if (el) {
                                el.style.height = "auto";
                                el.style.height = `${el.scrollHeight}px`;
                              }
                            }}
                          />
                        </td>
                        <td className="px-5 py-3 w-[80px]">
                          <input
                            type="number"
                            min={0}
                            className="w-full border-none bg-transparent p-0 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-0"
                            value={item.pax}
                            onChange={(event) =>
                              updateItemRow(index, {
                                ...item,
                                pax: Math.max(0, Number.parseInt(event.target.value || "0", 10)),
                              })
                            }
                          />
                        </td>
                        <td className="px-5 py-3 min-w-[200px]">
                          <div className="flex items-center gap-2">
                            <SereneSelect
                              className="serene-select h-8 min-w-[76px] rounded-lg bg-surface-container-low text-xs font-bold text-on-surface shadow-none border-none py-1 px-2"
                              value={item.currency || "IDR"}
                              onChange={(event) =>
                                updateItemRow(index, {
                                  ...item,
                                  currency: event.target.value as InvoiceDraftCurrency,
                                })
                              }
                            >
                              <option value="IDR">IDR</option>
                              <option value="USD">USD</option>
                              <option value="SAR">SAR</option>
                            </SereneSelect>
                            <input
                              type="text"
                              className="w-full border-none bg-transparent p-0 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-0"
                              value={formatNumberInput(item.unitPrice)}
                              onChange={(event) =>
                                updateItemRow(index, {
                                  ...item,
                                  unitPrice: parseNumberInput(event.target.value),
                                })
                              }
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs font-bold text-on-surface">{lineSubtotalLabel}</td>
                        <td className="px-5 py-3 text-xs font-bold text-on-surface">
                          {formatIdr(currentTotals.totalPriceIdr)}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-rose-50 hover:text-rose-600"
                            aria-label={`Delete row ${index + 1}`}
                            onClick={() => removeItem(index)}
                          >
                            <span className="material-symbols-outlined text-base" aria-hidden="true">
                              delete
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>

          <div className="grid grid-cols-12 gap-5">
            <div className="col-span-12 space-y-5 xl:col-span-6">
              <article className="serene-form-section">
                <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/70">
                  Bank Disbursement
                </h3>
                <div className="space-y-3">
                  <Controller
                    name="bankAccount"
                    control={control}
                    render={({ field }) => (
                      <SereneSelect
                        id="invoice-bank-account"
                        className="serene-select h-10 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface"
                        value={field.value}
                        onChange={(event) => {
                          clearErrors("bankAccount");
                          field.onChange(event.target.value);
                        }}
                        aria-invalid={getFieldAriaInvalid(bankAccountErrorMessage)}
                        aria-describedby={getFieldDescribedBy("invoice-bank-account", {
                          errorMessage: bankAccountErrorMessage,
                        })}
                      >
                        <option value="">Select bank account</option>
                        {bankDisbursementOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </SereneSelect>
                    )}
                  />
                  <FieldErrorMessage fieldId="invoice-bank-account" message={bankAccountErrorMessage} />
                  {bankAccount ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-2.5 flex items-center justify-between text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      <span className="text-slate-500 font-medium">Penerima / Beneficiary:</span>
                      <strong className="text-amber-800 dark:text-amber-400 font-extrabold uppercase">
                        {(() => {
                          const matchedBank = bankDisbursementOptions.find((o) => o.value === bankAccount);
                          return matchedBank?.metadata?.penerima || matchedBank?.metadata?.beneficiary || matchedBank?.metadata?.recipient || matchedBank?.metadata?.recipientName || "PT. Ghaniya Zilia Rahman";
                        })()}
                      </strong>
                    </div>
                  ) : null}
                  <div className={bankDisbursementHintClassName}>
                    <span className="material-symbols-outlined mt-0.5 text-sm text-primary" aria-hidden="true">
                      info
                    </span>
                    <p className="text-[10px] italic leading-tight text-on-surface-variant">
                      This account will be visible on the final invoice PDF for payment.
                    </p>
                  </div>
                </div>
              </article>

              <article className="serene-form-section">
                <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/70">
                  Exchange Rates
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.11em] text-on-surface-variant/65">
                      USD/IDR
                    </span>
                    <input
                      type="text"
                      className="h-10 w-full rounded-lg border border-outline-variant/35 bg-surface-container-low px-3 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                      value={formatNumberInput(usdToIdr)}
                      onChange={(event) => {
                        const val = Math.max(0, parseNumberInput(event.target.value));
                        setUsdToIdr(val);
                      }}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.11em] text-on-surface-variant/65">
                      SAR/IDR
                    </span>
                    <input
                      type="text"
                      className="h-10 w-full rounded-lg border border-outline-variant/35 bg-surface-container-low px-3 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                      value={formatNumberInput(sarToIdr)}
                      onChange={(event) => {
                        const val = Math.max(0, parseNumberInput(event.target.value));
                        setSarToIdr(val);
                      }}
                    />
                  </label>
                </div>
              </article>

              <article className="serene-form-section border-primary/20 bg-surface-container-low ring-1 ring-primary/10 flex flex-col min-h-[140px]">
                <div className="mb-2 flex items-center gap-2.5">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="material-symbols-outlined rounded-lg bg-primary/10 p-1.5 text-base text-primary"
                      aria-hidden="true"
                    >
                      edit_note
                    </span>
                    <div>
                      <label
                        className="block text-[11px] font-bold uppercase tracking-[0.14em] text-primary"
                        htmlFor="invoice-notes"
                      >
                        Notes / Instructions
                      </label>
                    </div>
                  </div>
                </div>
                <textarea
                  id="invoice-notes"
                  className="h-[92px] w-full resize-none rounded-xl border border-primary/15 bg-surface-container-lowest p-3 text-sm leading-relaxed text-on-surface outline-none ring-0 placeholder:italic placeholder:text-on-surface-variant/55 focus:ring-2 focus:ring-primary/25 flex-1"
                  placeholder="Terms, installments, or group specifics..."
                  {...register("notes")}
                />
              </article>
            </div>

            <div className="col-span-12 xl:col-span-6 xl:h-full">
              <article className="serene-form-section border border-amber-200/50 bg-amber-50/40 p-5 space-y-4 xl:flex xl:h-full xl:flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-800">
                      <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
                        account_balance
                      </span>
                      Histori Pembayaran
                    </span>
                    <p className="text-[11px] leading-snug text-amber-900/70">
                      Catat pembayaran cicilan atau pelunasan dari customer.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700/10 px-3 py-1.5 text-[10px] font-bold text-amber-800 hover:bg-amber-700/20 transition shadow-sm"
                    onClick={() => appendPayment({ amount: 0, dateIso: Domain.formatLocalIsoDate(new Date()) })}
                  >
                    <span className="material-symbols-outlined text-[12px]" aria-hidden="true">add</span>
                    <span>Tambah Pembayaran</span>
                  </button>
                </div>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {paymentFields.map((field, idx) => {
                    const runningPaid = payments.slice(0, idx + 1).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                    const remainingAfterThis = Math.max(0, totalPayable - runningPaid);
                    return (
                      <div key={field.id} className="relative bg-white/95 dark:bg-surface-container-lowest rounded-xl p-3 border border-amber-200/50 shadow-sm space-y-2 transition hover:shadow-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800">
                              Pembayaran #{idx + 1}
                            </span>
                            <span className="rounded-md bg-slate-100 dark:bg-surface-container-high px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-400">
                              Sisa: {invoiceCurrency} {formatNumberInput(remainingAfterThis)}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            aria-label={`Hapus Pembayaran ${idx + 1}`}
                            onClick={() => removePayment(idx)}
                          >
                            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">delete</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="block text-[8px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                              Nominal
                            </label>
                            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-surface-container-lowest px-2 py-1 h-9">
                              <span className="text-[9px] font-extrabold text-slate-500">{invoiceCurrency}</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="min-w-0 flex-1 border-none bg-transparent p-0 text-right text-xs font-extrabold text-on-surface outline-none ring-0 focus:ring-0"
                                value={formatNumberInput(watch(`payments.${idx}.amount`) ?? 0)}
                                onChange={(event) =>
                                  setValue(`payments.${idx}.amount`, Math.max(0, parseNumberInput(event.target.value)), {
                                    shouldDirty: true,
                                  })
                                }
                                aria-label={`Payment ${idx + 1} amount`}
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[8px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                              Tanggal Bayar
                            </label>
                            <Controller
                              name={`payments.${idx}.dateIso`}
                              control={control}
                              render={({ field: dateField }) => (
                                <DatePickerInput
                                  id={`payment-date-${idx}`}
                                  inputClassName="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-surface-container-lowest px-2 text-[10px] font-semibold text-on-surface outline-none ring-0 focus:ring-1 focus:ring-primary/20"
                                  value={dateField.value || ""}
                                  onChange={dateField.onChange}
                                />
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {normalizedDownPayment > 0 ? (
                  <div className="pt-2 border-t border-amber-200/40">
                    <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-[width] duration-300 ease-out"
                        style={{ width: `${downPaymentCoveragePercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] font-medium text-amber-700 mt-1.5">
                      Terbayar {downPaymentCoveragePercent}% dari total tagihan.
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] font-medium text-amber-700/60 italic pt-2 border-t border-amber-200/40">
                    Belum ada pembayaran yang dicatat.
                  </p>
                )}
              </article>
            </div>
          </div>
        </section>

        <aside className="col-span-12 space-y-4 lg:col-span-3">
          <article className="serene-form-section p-5">
            <h3 className="mb-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/65">
              <span>Summary</span>
              <span className="material-symbols-outlined text-base text-on-surface-variant/35" aria-hidden="true">
                payments
              </span>
            </h3>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">Subtotal</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[10px] font-bold text-on-surface-variant/70">{invoiceCurrency}</span>
                  <strong className="text-xs text-on-surface">{formatNumberInput(subtotal)}</strong>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">Tax (0%)</span>
                <strong className="text-xs text-on-surface">{formatNumberInput(taxAmount)}</strong>
              </div>

              {uniqueValasCurrencies.length > 0 ? (
                <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 space-y-2">
                  <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-primary">
                    Mata Uang Tagihan Akhir
                  </span>
                  <SereneSelect
                    className="serene-select h-8 w-full rounded-lg bg-white/70 text-xs font-bold text-on-surface shadow-none border border-primary/15 py-1 px-2"
                    value={keepValasCurrency}
                    onChange={(event) => handleKeepValasCurrencyChange(event.target.value as any)}
                  >
                    <option value="IDR">Rupiah (IDR)</option>
                    {uniqueValasCurrencies.includes("USD") && (
                      <option value="USD">Dollar (USD)</option>
                    )}
                    {uniqueValasCurrencies.includes("SAR") && (
                      <option value="SAR">Riyal (SAR)</option>
                    )}
                  </SereneSelect>
                  <p className="text-[10px] leading-snug text-on-surface-variant/75">
                    Menentukan mata uang sisa tagihan & DP yang dicetak pada PDF invoice.
                  </p>
                </div>
              ) : null}

              <div className="h-px bg-outline-variant/25" />
              <div className="pt-1">
                <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/65">
                  Yang harus dibayarkan
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xs font-bold text-primary">{invoiceCurrency}</span>
                  <span className="font-display text-xl font-extrabold tracking-tight text-primary">
                    {formatNumberInput(totalPayable)}
                  </span>
                </div>
              </div>

              <div
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                  remainingBalance <= 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-primary/10 bg-primary/5"
                }`}
              >
                <span className="text-xs font-medium text-on-surface-variant">
                  {resolveInvoiceOutstandingBalanceLabel(normalizedDownPayment, remainingBalance)}
                </span>
                <strong
                  className={`text-xs font-bold ${remainingBalance <= 0 ? "text-emerald-700" : "text-primary"}`}
                >
                  <span className="mr-1 text-[10px] font-bold text-on-surface-variant/70">{invoiceCurrency}</span>
                  {formatNumberInput(remainingBalance)}
                </strong>
              </div>
            </div>
          </article>

          <article className="serene-form-section p-5 text-center">
            <div className="mb-3 border-b border-outline-variant/20 pb-6">
              <span className="material-symbols-outlined mx-auto text-4xl text-primary/20" aria-hidden="true">
                approval_delegation
              </span>
            </div>
            <p className="text-xs font-extrabold text-on-surface">Husein Ghanim</p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/65">
              Director Operations
            </p>
          </article>

          <article className="serene-form-section border-primary/15 bg-primary/5">
            <p className="text-[10px] italic leading-relaxed text-primary/75">
              Note: Ensure all pilgrim PAX counts match the visa manifestations before generating the final document.
            </p>
          </article>
        </aside>
      </div>

      {isCancelConfirmationOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={cancelConfirmationDialogRef}
              className="serene-modal-overlay fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
              role="dialog"
              aria-modal="true"
              aria-labelledby="invoice-cancel-confirmation-title"
              aria-describedby="invoice-cancel-confirmation-description"
              tabIndex={-1}
              onClick={() => setIsCancelConfirmationOpen(false)}
            >
              <section
                className="serene-modal-shell w-full max-w-[32rem] overflow-hidden"
                onClick={(event) => event.stopPropagation()}
              >
                <header className="serene-dialog-header border-b border-outline-variant/35 bg-surface-container-lowest px-4 py-4 sm:px-5">
                  <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-800">
                    <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                      warning
                    </span>
                  </div>

                  <div>
                    <h2
                      id="invoice-cancel-confirmation-title"
                      className="font-display text-2xl font-bold tracking-tight text-on-surface"
                    >
                      Konfirmasi Status Cancelled
                    </h2>
                  </div>
                </header>

                <div
                  id="invoice-cancel-confirmation-description"
                  className="serene-dialog-body bg-surface-container-lowest px-4 py-4 text-sm leading-relaxed text-on-surface-variant sm:px-5"
                >
                  <p>Invoice ini akan disimpan sebagai Cancelled. Lanjutkan penyimpanan?</p>
                  <p>Status cancelled akan menandai invoice sebagai dibatalkan.</p>
                  <p>Amount invoice juga akan otomatis menjadi 0 saat disimpan.</p>
                </div>

                <footer className="serene-dialog-footer-bar bg-surface-container-lowest px-4 py-4 sm:px-5">
                  <button
                    type="button"
                    className="serene-btn-secondary min-h-10 rounded-2xl px-6 py-2 text-lg font-semibold"
                    onClick={() => setIsCancelConfirmationOpen(false)}
                    disabled={isSubmitting}
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    className="serene-btn-primary min-h-10 rounded-2xl px-6 py-2 text-lg font-bold"
                    onClick={handleConfirmCancelledStatus}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Menyimpan..." : "Ya, Simpan"}
                  </button>
                </footer>
              </section>
            </div>,
            document.body,
          )
        : null}


    </div>
  );
}
