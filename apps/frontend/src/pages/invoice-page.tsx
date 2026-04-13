import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, type FieldErrors, useFieldArray, useForm } from "react-hook-form";
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
import { type BackendInvoiceClient, type BackendInvoiceItem, type BackendInvoiceRow } from "../hooks/use-invoice-backend";
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
} from "./invoice-page-shared";

const INVOICE_PAGE_SIZE = 8;
const MANUAL_CLIENT_OPTION_ID = "__invoice_client_other__";

type InvoiceStatus = BackendInvoiceRow["status"];
type InvoiceRow = BackendInvoiceRow;
type InvoiceClientOption = BackendInvoiceClient;

type DueMonthOption = {
  value: string;
  label: string;
};

type SelectOption = {
  value: string;
  label: string;
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
  clientName: string;
  clientLabel: string;
  clientId: string;
  groupCode: string;
  issuedDateIso: string;
  dueDateIso: string;
  amount: number;
  downPaymentIdr: number;
  status: InvoiceStatus;
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
    dueDateIso: z.string().trim().min(1, "Select due date before saving invoice."),
    invoiceStatus: z.string(),
    issuingOffice: z.string(),
    selectedClientId: z.string().trim().min(1, "Select a client before saving invoice."),
    manualClientName: z.string(),
    selectedGroupCode: z.string(),
    address: z.string(),
    bankAccount: z.string(),
    downPaymentIdr: z.number().min(0),
    notes: z.string(),
    items: z.array(invoiceDraftItemSchema),
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

async function viewInvoicePdfFromRow({
  row,
  groups,
  printWindow,
}: {
  row: InvoiceRow;
  groups: GroupData[];
  printWindow?: Window | null;
}): Promise<boolean> {
  const linkedGroup = row.groupCode
    ? (groups.find((group) => group.code.trim().toUpperCase() === row.groupCode?.trim().toUpperCase()) ?? null)
    : null;
  const description = linkedGroup
    ? `${linkedGroup.packageName} Package - ${linkedGroup.durationDays} Days`
    : `Invoice ${row.invoiceNumber}`;
  const downPaymentIdr = resolveInvoiceDownPaymentIdr(row);
  const { exportInvoicePdf } = await import("./invoice-export");

  return exportInvoicePdf({
    invoiceNumber: row.invoiceNumber,
    issueDateIso: row.issuedDateIso,
    dueDateIso: row.dueDateIso,
    statusLabel: row.status,
    issuingOffice: "Bekasi Office",
    clientName: row.clientName,
    clientCode: row.groupCode ?? row.clientLabel,
    address: row.clientLabel,
    bankAccountLabel: resolveBankAccountLabel("bsi"),
    notes: row.groupCode ? `Linked group: ${row.groupCode}` : "",
    usdToIdr: 15_845,
    sarToIdr: 4_225,
    subtotalIdr: row.amount,
    taxIdr: 0,
    totalPayableIdr: row.amount,
    downPaymentIdr,
    remainingBalanceIdr: resolveInvoiceRemainingBalanceIdr(row.amount, downPaymentIdr),
    items: [
      {
        description,
        pax: 1,
        currency: "IDR",
        unitPrice: row.amount,
        totalPrice: row.amount,
        totalPriceIdr: row.amount,
      },
    ],
  }, { printWindow });
}

function openPendingInvoicePdfWindow(): Window | null {
  const pendingWindow = window.open("", "_blank", "width=1180,height=860");
  if (!pendingWindow) {
    return null;
  }

  try {
    pendingWindow.document.open();
    pendingWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preparing Invoice PDF</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
    }
    p {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.01em;
    }
  </style>
</head>
<body>
  <p>Preparing invoice PDF...</p>
</body>
</html>`);
    pendingWindow.document.close();
  } catch {
    // Ignore write failures; export flow will retry with generated document.
  }

  return pendingWindow;
}

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
  const resolvedInitialInvoice = isEditMode ? (initialInvoice ?? null) : null;
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
      issuingOffice: isEditMode ? (issuingOfficeOptions[0]?.value ?? "") : "",
      selectedClientId: resolvedInitialInvoice
        ? hasResolvedInitialClient
          ? initialClientId
          : hasResolvedInitialManualClient
            ? MANUAL_CLIENT_OPTION_ID
            : ""
        : "",
      manualClientName: hasResolvedInitialManualClient ? resolvedInitialClientName : "",
      selectedGroupCode: resolvedInitialInvoice?.groupCode ?? "",
      address: resolvedInitialInvoice?.clientLabel || resolvedInitialInvoice?.clientName || "",
      bankAccount: isEditMode ? (bankDisbursementOptions[0]?.value ?? "") : "",
      downPaymentIdr: resolvedInitialInvoice?.downPaymentIdr ?? 0,
      notes: "",
      items: createInitialInvoiceDraftItems(resolvedInitialInvoice),
    },
  });
  const dueDateIso = watch("dueDateIso");
  const invoiceStatus = watch("invoiceStatus") as InvoiceStatus | "";
  const issuingOffice = watch("issuingOffice");
  const selectedClientId = watch("selectedClientId");
  const selectedGroupCode = watch("selectedGroupCode");
  const address = watch("address");
  const bankAccount = watch("bankAccount");
  const downPaymentIdr = watch("downPaymentIdr");
  const items = watch("items");
  const {
    fields: itemFields,
    append: appendItem,
    remove: removeItemFromForm,
  } = useFieldArray({
    control,
    name: "items",
    keyName: "fieldKey",
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
    () => buildNextInvoiceNumber(existingInvoiceNumbers, extractYearFromIsoDate(dueDateIso)),
    [existingInvoiceNumbers, dueDateIso],
  );
  const [usdToIdr, setUsdToIdr] = useState(15_845);
  const [sarToIdr, setSarToIdr] = useState(4_225);
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

    if (!address.trim()) {
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

  const subtotalIdr = useMemo(() => calculateSubtotalIdr({ items, usdToIdr, sarToIdr }), [items, usdToIdr, sarToIdr]);
  const taxAmount = 0;
  const totalPayable = subtotalIdr + taxAmount;
  const normalizedDownPaymentIdr = Math.min(totalPayable, Math.max(0, Math.round(downPaymentIdr)));
  const downPaymentCoveragePercent =
    totalPayable > 0 ? Math.min(100, Math.round((normalizedDownPaymentIdr / totalPayable) * 100)) : 0;
  const remainingBalanceIdr = resolveInvoiceRemainingBalanceIdr(totalPayable, normalizedDownPaymentIdr);

  useEffect(() => {
    if (downPaymentIdr <= totalPayable) {
      return;
    }

    setValue("downPaymentIdr", totalPayable, {
      shouldDirty: true,
      shouldValidate: false,
    });
  }, [downPaymentIdr, totalPayable, setValue]);

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
    setIsSavingDraft(true);
    try {
      const savedInvoice = await createInvoiceMutation.mutateAsync({
        clientId: clientSelection.clientId,
        clientName: clientSelection.clientName,
        groupCode: linkedGroupCode || undefined,
        issuedDateIso: values.issueDateIso,
        dueDateIso: values.dueDateIso,
        amount: totalPayable,
        downPaymentIdr: normalizedDownPaymentIdr,
        status: values.invoiceStatus ? (values.invoiceStatus as InvoiceStatus) : "Pending",
        notes: values.notes,
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
    const preOpenedPdfWindow = openPendingInvoicePdfWindow();

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
                dueDateIso: values.dueDateIso,
                amount: totalPayable,
                downPaymentIdr: normalizedDownPaymentIdr,
                status: values.invoiceStatus as InvoiceStatus,
                notes: values.notes,
                items: printableItems,
              },
            })
          : await createInvoiceMutation.mutateAsync({
              clientId: clientSelection.clientId,
              clientName: clientSelection.clientName,
              groupCode: linkedGroupCode || undefined,
              issuedDateIso: values.issueDateIso,
              dueDateIso: values.dueDateIso,
              amount: totalPayable,
              downPaymentIdr: normalizedDownPaymentIdr,
              status: values.invoiceStatus as InvoiceStatus,
              notes: values.notes,
              items: printableItems,
            });

      const { exportInvoicePdf } = await import("./invoice-export");
      const exported = exportInvoicePdf(
        {
          invoiceNumber: savedInvoice.invoiceNumber,
          issueDateIso: values.issueDateIso,
          dueDateIso: values.dueDateIso,
          statusLabel: values.invoiceStatus as InvoiceStatus,
          issuingOffice: values.issuingOffice,
          clientName: savedInvoice.clientName,
          clientCode: linkedGroupCode || savedInvoice.groupCode || savedInvoice.clientLabel,
          address: values.address.trim(),
          bankAccountLabel: resolveBankAccountLabel(values.bankAccount, bankDisbursementOptions),
          notes: values.notes.trim(),
          usdToIdr,
          sarToIdr,
          subtotalIdr,
          taxIdr: taxAmount,
          totalPayableIdr: totalPayable,
          downPaymentIdr: savedInvoice.downPaymentIdr,
          remainingBalanceIdr: resolveInvoiceRemainingBalanceIdr(savedInvoice.amount, savedInvoice.downPaymentIdr),
          items: printableItems,
        },
        {
          printWindow: preOpenedPdfWindow,
        },
      );

      if (!exported) {
        if (preOpenedPdfWindow && !preOpenedPdfWindow.closed) {
          preOpenedPdfWindow.close();
        }
        window.alert("Popup diblokir browser. Izinkan pop-up lalu ulangi aksi invoice.");
      }

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
      if (preOpenedPdfWindow && !preOpenedPdfWindow.closed) {
        preOpenedPdfWindow.close();
      }
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
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary sm:w-auto sm:justify-start sm:py-1.5"
          onClick={onBack}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          <span>Back to List</span>
        </button>

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

        <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
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

            <div className="flex flex-wrap gap-2 rounded-xl bg-surface-container-low p-2">
              {!isEditMode ? (
                <button
                  type="button"
                  className={`inline-flex items-center justify-center rounded-lg border border-outline-variant/40 px-4 py-2 text-sm font-bold transition ${
                    isWorkspaceBusy || !isBackendAvailable
                      ? "cursor-not-allowed bg-surface-container-low text-on-surface-variant/60"
                      : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low"
                  }`}
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
                </button>
              ) : null}
              <button
                type="button"
                className={`inline-flex items-center justify-center rounded-lg px-6 py-2 text-sm font-bold text-on-primary shadow-cta-soft transition ${
                  isSubmitDisabled ? "cursor-not-allowed bg-slate-300" : "bg-primary hover:bg-primary-container"
                }`}
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
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 space-y-5 lg:col-span-9">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <article className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
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
                        value={field.value}
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

            <article className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
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
              </div>
            </article>
          </div>

          <article className="overflow-hidden rounded-xl border border-outline-variant/15 bg-surface-container-lowest shadow-sm">
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
                        <td className="px-5 py-3">
                          <input
                            type="text"
                            className="w-full border-none bg-transparent p-0 text-xs font-semibold text-on-surface outline-none ring-0 focus:ring-0"
                            value={item.description}
                            onChange={(event) => updateItemRow(index, { ...item, description: event.target.value })}
                          />
                        </td>
                        <td className="px-5 py-3">
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
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <SereneSelect
                              className="serene-select h-auto min-w-[72px] border-none bg-transparent p-0 text-xs font-bold text-on-surface shadow-none"
                              value={item.currency}
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
                        <td className="px-5 py-3 text-xs font-bold text-on-surface">{formatIdr(currentTotals.totalPriceIdr)}</td>
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
            <div className="col-span-12 space-y-5 xl:col-span-7">
              <article className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm">
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

              <article className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-sm">
                <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/70">
                  Live Exchange Rates
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.11em] text-on-surface-variant/65">
                      USD/IDR
                    </span>
                    <input
                      type="text"
                      className="h-9 w-full rounded-lg border border-outline-variant/35 bg-surface-container-low px-3 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                      value={formatNumberInput(usdToIdr)}
                      onChange={(event) => setUsdToIdr(Math.max(1, parseNumberInput(event.target.value)))}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.11em] text-on-surface-variant/65">
                      SAR/IDR
                    </span>
                    <input
                      type="text"
                      className="h-9 w-full rounded-lg border border-outline-variant/35 bg-surface-container-low px-3 text-xs font-bold text-on-surface outline-none ring-0 focus:ring-2 focus:ring-primary/20"
                      value={formatNumberInput(sarToIdr)}
                      onChange={(event) => setSarToIdr(Math.max(1, parseNumberInput(event.target.value)))}
                    />
                  </label>
                </div>
              </article>
            </div>

            <div className="col-span-12 xl:col-span-5 xl:h-full">
              <article className="rounded-xl border border-primary/20 bg-surface-container-low p-4 shadow-sm ring-1 ring-primary/10 xl:flex xl:h-full xl:flex-col">
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
                  className="h-[92px] w-full resize-none rounded-xl border border-primary/15 bg-surface-container-lowest p-3 text-sm leading-relaxed text-on-surface outline-none ring-0 placeholder:italic placeholder:text-on-surface-variant/55 focus:ring-2 focus:ring-primary/25 xl:h-auto xl:min-h-0 xl:flex-1"
                  placeholder="Terms, installments, or group specifics..."
                  {...register("notes")}
                />
              </article>
            </div>
          </div>
        </section>

        <aside className="col-span-12 space-y-4 lg:col-span-3">
          <article className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-5">
            <h3 className="mb-4 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/65">
              <span>Summary</span>
              <span className="material-symbols-outlined text-base text-on-surface-variant/35" aria-hidden="true">
                payments
              </span>
            </h3>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">Subtotal</span>
                <strong className="text-xs text-on-surface">{formatNumberInput(subtotalIdr)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-on-surface-variant">Tax (0%)</span>
                <strong className="text-xs text-on-surface">{formatNumberInput(taxAmount)}</strong>
              </div>
              <div className="h-px bg-outline-variant/25" />
              <div className="pt-1">
                <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/65">
                  Yang harus dibayarkan
                </span>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xs font-bold text-primary">IDR</span>
                  <span className="font-display text-xl font-extrabold tracking-tight text-primary">
                    {formatNumberInput(totalPayable)}
                  </span>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-800">
                      <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
                        account_balance
                      </span>
                      DP / Uang muka
                    </span>
                    <p className="text-[10px] leading-snug text-amber-900/70">
                      Masukkan nominal DP yang sudah diterima dari customer.
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] ${
                      normalizedDownPaymentIdr > 0
                        ? "border-amber-200 bg-white text-amber-800"
                        : "border-outline-variant/30 bg-white text-on-surface-variant/60"
                    }`}
                  >
                    {normalizedDownPaymentIdr > 0 ? `${downPaymentCoveragePercent}%` : "Opsional"}
                  </span>
                </div>

                <label className="mt-2 block space-y-1.5">
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-2">
                    <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-amber-700/80">
                      IDR
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="min-w-0 flex-1 border-none bg-transparent p-0 text-right text-sm font-extrabold text-amber-900 outline-none ring-0 placeholder:text-amber-900/30 focus:ring-0"
                      value={formatNumberInput(downPaymentIdr)}
                      onChange={(event) =>
                        setValue("downPaymentIdr", Math.max(0, parseNumberInput(event.target.value)), {
                          shouldDirty: true,
                          shouldValidate: false,
                        })
                      }
                      aria-label="Down payment amount"
                    />
                  </div>
                </label>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-[width] duration-300 ease-out"
                    style={{ width: `${downPaymentCoveragePercent}%` }}
                  />
                </div>

                <p className="mt-1.5 text-[10px] font-medium text-amber-700">
                  {normalizedDownPaymentIdr > 0
                    ? `DP menutup ${downPaymentCoveragePercent}% dari total tagihan.`
                    : "DP belum diisi, jadi total pembayaran masih utuh."}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-primary/10 bg-primary/5 px-3 py-2">
                <span className="text-xs font-medium text-on-surface-variant">
                  {resolveInvoiceOutstandingBalanceLabel(normalizedDownPaymentIdr)}
                </span>
                <strong className="text-xs font-bold text-primary">{formatNumberInput(remainingBalanceIdr)}</strong>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-5 text-center shadow-sm">
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

          <article className="rounded-xl border border-primary/15 bg-primary/5 p-4">
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
              className="serene-modal-overlay fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4"
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
                <header className="flex items-center gap-3 border-b border-outline-variant/35 bg-surface-container-lowest px-4 py-4 sm:px-5">
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
                  className="space-y-2 bg-surface-container-lowest px-4 py-4 text-sm leading-relaxed text-on-surface-variant sm:px-5"
                >
                  <p>Invoice ini akan disimpan sebagai Cancelled. Lanjutkan penyimpanan?</p>
                  <p>Status cancelled akan menandai invoice sebagai dibatalkan.</p>
                  <p>Amount invoice juga akan otomatis menjadi 0 saat disimpan.</p>
                </div>

                <footer className="flex flex-wrap items-center justify-end gap-2 bg-surface-container-lowest px-4 py-4 sm:px-5">
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-emerald-100 px-6 py-2 text-lg font-semibold text-emerald-800 transition hover:bg-emerald-200"
                    onClick={() => setIsCancelConfirmationOpen(false)}
                    disabled={isSubmitting}
                  >
                    Kembali
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center justify-center rounded-2xl bg-emerald-700 px-6 py-2 text-lg font-bold text-on-primary transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
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

      <div
        className={`fixed bottom-6 left-1/2 z-[60] w-[min(94vw,42rem)] -translate-x-1/2 rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 text-amber-900 shadow-[0_20px_42px_rgba(146,64,14,0.24)] transition-all duration-200 ${
          saveFeedback ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 text-2xl text-amber-700" aria-hidden="true">
            warning
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-[0.08em]">Periksa Data Invoice</p>
            <p className="mt-1 text-base font-bold leading-snug">{saveFeedback ?? ""}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InvoiceScreen({
  groups,
  onOpenDetail,
}: {
  groups: GroupData[];
  onOpenDetail: (groupCode: string) => void;
}) {
  const { theme } = useThemeMode();
  const isDarkMode = theme === "dark";
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "overdue" | "cancelled">("all");
  const [dueMonthFilter, setDueMonthFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [workspaceMode, setWorkspaceMode] = useState<"list" | "create" | "edit">("list");
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWorkspaceInitialData | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const invoiceDashboardQuery = useInvoiceDashboardQuery();
  const issuingOfficeOptionsQuery = useMasterDataOptionsQuery({
    categoryKey: "invoice-issuing-office",
  });
  const invoiceStatusOptionsQuery = useMasterDataOptionsQuery({
    categoryKey: "invoice-status",
  });
  const bankDisbursementOptionsQuery = useMasterDataOptionsQuery({
    categoryKey: "bank-disbursement",
  });
  const invoiceClientNameOptionsQuery = useMasterDataOptionsQuery({
    categoryKey: "invoice-client-name",
  });
  const issuingOfficeOptions = useMemo(() => {
    const resolved = mapMasterDataToSelectOptions(issuingOfficeOptionsQuery.data ?? []).map((option) => ({
      value: option.label,
      label: option.label,
    }));
    return resolved.length > 0 ? resolved : defaultIssuingOfficeOptions;
  }, [issuingOfficeOptionsQuery.data]);
  const invoiceStatusOptions = useMemo(() => {
    const resolved = mapMasterDataToInvoiceStatusOptions(invoiceStatusOptionsQuery.data ?? []);
    return resolved.length > 0 ? resolved : defaultInvoiceStatusOptions;
  }, [invoiceStatusOptionsQuery.data]);
  const bankDisbursementOptions = useMemo(() => {
    const resolved = mapMasterDataToSelectOptions(bankDisbursementOptionsQuery.data ?? []);
    return resolved.length > 0 ? resolved : defaultBankDisbursementOptions;
  }, [bankDisbursementOptionsQuery.data]);
  const manualClientNameSuggestions = useMemo(
    () => mapMasterDataToClientSuggestions(invoiceClientNameOptionsQuery.data ?? []),
    [invoiceClientNameOptionsQuery.data],
  );
  const isInvoiceBackendAvailable = invoiceDashboardQuery.data?.dataSource === "prisma";
  const isInvoiceDataLoading = invoiceDashboardQuery.isLoading;
  const invoiceClients = useMemo<InvoiceClientOption[]>(
    () =>
      isInvoiceBackendAvailable
        ? mergeInvoiceClientsWithMasterData(
            invoiceDashboardQuery.data?.clients ?? [],
            invoiceClientNameOptionsQuery.data ?? [],
          )
        : [],
    [invoiceDashboardQuery.data?.clients, invoiceClientNameOptionsQuery.data, isInvoiceBackendAvailable],
  );
  const invoiceRows = useMemo<InvoiceRow[]>(
    () => (isInvoiceBackendAvailable ? (invoiceDashboardQuery.data?.rows ?? []) : []),
    [invoiceDashboardQuery.data, isInvoiceBackendAvailable],
  );
  const systemFeedback = useMemo(() => {
    if (invoiceDashboardQuery.error) {
      return "Backend invoice/database belum terhubung. Data invoice tidak bisa di-load dari database dan Generate Invoice dinonaktifkan.";
    }

    if (invoiceDashboardQuery.data?.dataSource && invoiceDashboardQuery.data.dataSource !== "prisma") {
      return "Backend invoice terhubung tetapi masih DATA_SOURCE=memory. Ubah ke DATA_SOURCE=prisma agar Save Draft dan Generate Invoice tersimpan ke database.";
    }

    if (isInvoiceBackendAvailable && invoiceClients.length === 0) {
      return "Backend invoice terhubung, tetapi daftar client invoice masih kosong. Jalankan seed database lalu refresh halaman.";
    }

    return null;
  }, [invoiceClients.length, invoiceDashboardQuery.data, invoiceDashboardQuery.error, isInvoiceBackendAvailable]);
  const visibleFeedback = actionFeedback ?? systemFeedback;

  const normalizedQuery = query.trim().toLowerCase();
  const searchedRows = invoiceRows.filter((row) => {
    if (!normalizedQuery) {
      return true;
    }

    return [row.invoiceNumber, row.clientLabel, row.clientName, row.groupCode ?? "", row.status].some((value) =>
      value.toLowerCase().includes(normalizedQuery),
    );
  });

  const dueMonthOptions = useMemo<DueMonthOption[]>(() => {
    const keySet = new Set<string>();
    invoiceRows.forEach((row) => {
      if (/^\d{4}-\d{2}$/.test(row.monthKey)) {
        keySet.add(row.monthKey);
      }
    });

    return Array.from(keySet)
      .sort((left, right) => right.localeCompare(left))
      .map((value) => ({
        value,
        label: formatMonthLabel(value),
      }));
  }, [invoiceRows]);

  const filteredRows = searchedRows
    .filter((row) => (statusFilter === "all" ? true : getStatusValue(row.status) === statusFilter))
    .filter((row) => (dueMonthFilter === "all" ? true : row.monthKey === dueMonthFilter));

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / INVOICE_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * INVOICE_PAGE_SIZE;
  const paginatedRows = filteredRows.slice(pageStartIndex, pageStartIndex + INVOICE_PAGE_SIZE);
  const rangeStart = filteredRows.length === 0 ? 0 : pageStartIndex + 1;
  const rangeEnd = filteredRows.length === 0 ? 0 : Math.min(filteredRows.length, pageStartIndex + paginatedRows.length);

  const totalRevenue = filteredRows.reduce((total, row) => total + row.amount, 0);
  const paidCount = filteredRows.filter((row) => row.status === "Paid").length;
  const pendingCount = filteredRows.filter((row) => row.status === "Pending").length;
  const overdueCount = filteredRows.filter((row) => row.status === "Overdue").length;
  const cancelledCount = filteredRows.filter((row) => row.status === "Cancelled").length;
  const currentMonthKey = Domain.formatLocalIsoDate(new Date()).slice(0, 7);
  const previousMonthKey = shiftMonthKey(currentMonthKey, -1);
  const currentMonthRevenue = invoiceRows
    .filter((row) => row.monthKey === currentMonthKey)
    .reduce((total, row) => total + row.amount, 0);
  const previousMonthRevenue = invoiceRows
    .filter((row) => row.monthKey === previousMonthKey)
    .reduce((total, row) => total + row.amount, 0);
  const monthlyGrowth =
    previousMonthRevenue > 0
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      : currentMonthRevenue > 0
        ? 100
        : 0;
  const monthlyGrowthLabel = `${monthlyGrowth >= 0 ? "+" : ""}${monthlyGrowth.toFixed(1)}%`;
  const dueDateRangeLabel =
    dueMonthFilter === "all"
      ? resolveDateRangeLabel(invoiceRows)
      : resolveDateRangeLabel(invoiceRows.filter((row) => row.monthKey === dueMonthFilter));
  const paidSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-primary/35 bg-primary/16 px-3 py-1 text-xs font-bold leading-none text-primary"
    : "inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold leading-none text-emerald-700";
  const pendingSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-secondary/35 bg-secondary/16 px-3 py-1 text-xs font-bold leading-none text-secondary"
    : "inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold leading-none text-amber-700";
  const overdueSummaryBadgeClassName = isDarkMode
    ? "inline-flex items-center gap-1 rounded-lg border border-tertiary/35 bg-tertiary/16 px-3 py-1 text-xs font-bold leading-none text-tertiary"
    : "inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold leading-none text-rose-700";

  const handleViewPdf = (row: InvoiceRow) => {
    const printableWindow = window.open("", "_blank", "width=1180,height=860");
    if (!printableWindow) {
      setActionFeedback("Popup PDF diblokir browser. Izinkan pop-up lalu coba lagi.");
      return;
    }

    void viewInvoicePdfFromRow({ row, groups, printWindow: printableWindow }).then((exported) => {
      if (!exported) {
        if (!printableWindow.closed) {
          printableWindow.close();
        }
        setActionFeedback("Popup PDF diblokir browser. Izinkan pop-up lalu coba lagi.");
      }
    }).catch(() => {
      if (!printableWindow.closed) {
        printableWindow.close();
      }
      setActionFeedback("Gagal menyiapkan PDF invoice. Coba lagi.");
    });
  };

  const handleOpenEditInvoice = (row: InvoiceRow) => {
    if (!isInvoiceBackendAvailable) {
      setActionFeedback("Backend invoice/database belum terhubung. Edit invoice dinonaktifkan.");
      return;
    }

    setEditingInvoice(createInvoiceWorkspaceInitialData(row));
    setWorkspaceMode("edit");
  };

  useEffect(() => {
    if (!actionFeedback) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setActionFeedback((current) => (current ? null : current));
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionFeedback]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, dueMonthFilter]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (dueMonthFilter === "all") {
      return;
    }

    const isStillAvailable = dueMonthOptions.some((option) => option.value === dueMonthFilter);
    if (!isStillAvailable) {
      setDueMonthFilter("all");
    }
  }, [dueMonthFilter, dueMonthOptions]);

  if (workspaceMode === "create") {
    return (
      <CreateInvoiceWorkspace
        mode="create"
        initialInvoice={null}
        clients={invoiceClients}
        issuingOfficeOptions={issuingOfficeOptions}
        invoiceStatusOptions={invoiceStatusOptions}
        bankDisbursementOptions={bankDisbursementOptions}
        manualClientNameSuggestions={manualClientNameSuggestions}
        groups={groups}
        isBackendAvailable={isInvoiceBackendAvailable}
        existingInvoiceNumbers={invoiceRows.map((row) => row.invoiceNumber)}
        onBack={() => setWorkspaceMode("list")}
        onCreate={(invoice, action) => {
          setWorkspaceMode("list");
          setActionFeedback(
            action === "draft"
              ? `Draft invoice ${invoice.invoiceNumber} saved to database.`
              : `Invoice ${invoice.invoiceNumber} generated and saved to database.`,
          );
          setQuery("");
          setStatusFilter("all");
          setDueMonthFilter("all");
          setCurrentPage(1);
        }}
        onUpdate={() => {
          // no-op on create mode
        }}
      />
    );
  }

  if (workspaceMode === "edit" && editingInvoice) {
    return (
      <CreateInvoiceWorkspace
        key={`edit-${editingInvoice.id}`}
        mode="edit"
        initialInvoice={editingInvoice}
        clients={invoiceClients}
        issuingOfficeOptions={issuingOfficeOptions}
        invoiceStatusOptions={invoiceStatusOptions}
        bankDisbursementOptions={bankDisbursementOptions}
        manualClientNameSuggestions={manualClientNameSuggestions}
        groups={groups}
        isBackendAvailable={isInvoiceBackendAvailable}
        existingInvoiceNumbers={invoiceRows.map((row) => row.invoiceNumber)}
        onBack={() => {
          setWorkspaceMode("list");
          setEditingInvoice(null);
        }}
        onCreate={() => {
          // no-op on edit mode
        }}
        onUpdate={(invoice) => {
          setWorkspaceMode("list");
          setEditingInvoice(null);
          setActionFeedback(`Invoice ${invoice.invoiceNumber} berhasil diupdate.`);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      {visibleFeedback ? (
        <section
          className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 shadow-ambient"
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined mt-0.5 text-base" aria-hidden="true">
            check_circle
          </span>
          <p className="text-sm font-semibold">{visibleFeedback}</p>
        </section>
      ) : null}
      {isInvoiceDataLoading ? (
        <section
          className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-800 shadow-ambient"
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined mt-0.5 text-base" aria-hidden="true">
            sync
          </span>
          <p className="text-sm font-semibold">Loading invoice data...</p>
        </section>
      ) : null}

      <header className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 max-w-xl items-center gap-3">
          <label
            className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface-container-lowest px-4 shadow-ambient sm:h-14"
            aria-label="Search invoices"
          >
            <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              className="w-full border-none bg-transparent text-sm font-medium text-on-surface-variant outline-none placeholder:text-on-surface-variant/50"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search invoices or clients..."
            />
          </label>
        </div>

        <ThemeToggleButton className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:border-primary/45 hover:text-primary sm:ml-auto sm:mr-5" />
      </header>

      <PageHeroSection
        eyebrow="Invoice Workspace"
        title="Invoice List"
        description={
          <>
            <span className="sm:hidden">Track all issued invoices.</span>
            <span className="hidden sm:inline">Manage and track all issued invoices.</span>
          </>
        }
        actions={
          <button
            type="button"
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-on-primary shadow-cta-soft transition sm:w-auto ${
              isInvoiceBackendAvailable ? "bg-primary hover:bg-primary-container" : "cursor-not-allowed bg-slate-300"
            }`}
            aria-label="Create new invoice"
            disabled={!isInvoiceBackendAvailable}
            onClick={() => {
              setEditingInvoice(null);
              setWorkspaceMode("create");
            }}
            title={
              isInvoiceBackendAvailable
                ? undefined
                : "Backend invoice/database belum terhubung, invoice belum bisa disimpan."
            }
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              add
            </span>
            <span>New Invoice</span>
          </button>
        }
      />

      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <article className="rounded-2xl border border-outline-variant/45 bg-surface-container-low p-4 shadow-ambient sm:p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_0.9fr_auto] md:items-end">
            <label className="space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/80">
                Date Range
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-3 text-sm font-medium text-on-surface-variant">
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  calendar_today
                </span>
                <span>{dueDateRangeLabel}</span>
              </div>
            </label>

            <label className="space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/80">
                Status
              </span>
              <SereneSelect
                className="serene-select rounded-xl bg-surface-container-lowest text-sm font-medium text-on-surface-variant"
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | "paid" | "pending" | "overdue" | "cancelled")
                }
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </SereneSelect>
            </label>

            <label className="space-y-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/80">
                Due Month
              </span>
              <SereneSelect
                className="serene-select rounded-xl bg-surface-container-lowest text-sm font-medium text-on-surface-variant"
                value={dueMonthFilter}
                onChange={(event) => setDueMonthFilter(event.target.value)}
              >
                <option value="all">All Months</option>
                {dueMonthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SereneSelect>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={paidSummaryBadgeClassName}>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                task_alt
              </span>
              <span>Paid {paidCount}</span>
            </span>
            <span className={pendingSummaryBadgeClassName}>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                hourglass_top
              </span>
              <span>Pending {pendingCount}</span>
            </span>
            <span className={overdueSummaryBadgeClassName}>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                warning
              </span>
              <span>Overdue {overdueCount}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-bold leading-none text-slate-700">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                block
              </span>
              <span>Cancelled {cancelledCount}</span>
            </span>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-2xl bg-primary p-5 text-on-primary shadow-ambient">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-primary/85">
            <span className="sm:hidden">Monthly Revenue</span>
            <span className="hidden sm:inline">Total Monthly Revenue</span>
          </p>
          <strong className="mt-2 block text-3xl font-extrabold leading-tight">{formatIdr(totalRevenue)}</strong>
          <p className="mt-3 inline-flex rounded-lg bg-surface-container-lowest/20 px-2 py-1 text-xs font-bold">
            {monthlyGrowthLabel}
          </p>
          <p className="mt-1 text-xs text-on-primary/85">
            <span className="sm:hidden">vs last month</span>
            <span className="hidden sm:inline">vs previous month</span>
          </p>
          <span
            className="material-symbols-outlined absolute -right-3 -bottom-4 text-8xl text-on-primary/15"
            aria-hidden="true"
          >
            pentagon
          </span>
        </article>
      </section>

      {filteredRows.length === 0 ? (
        <article className="rounded-3xl border border-dashed border-slate-300 bg-surface-container-lowest p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">
            receipt_long
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-800">No invoices found</h2>
          <p className="mt-2 text-sm text-slate-600">
            <span className="sm:hidden">Coba keyword atau filter lain.</span>
            <span className="hidden sm:inline">
              Coba ubah keyword pencarian atau filter untuk melihat invoice lainnya.
            </span>
          </p>
        </article>
      ) : (
        <>
          <section className="space-y-3 lg:hidden" aria-label="Invoice cards">
            {paginatedRows.map((row) => (
              <article
                key={row.id}
                className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/70">
                      Invoice ID
                    </p>
                    <p className="truncate text-sm font-bold text-primary">{row.invoiceNumber}</p>
                  </div>
                  <span
                    className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold leading-none ${getStatusClasses(
                      row.status,
                      isDarkMode,
                    )}`}
                  >
                    {row.status}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <div
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${getAvatarToneByStatus(
                      row.status,
                      isDarkMode,
                    )}`}
                  >
                    {row.clientInitials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">{row.clientName}</p>
                    <p className="truncate text-xs text-on-surface-variant">
                      {row.groupCode ? `Group ${row.groupCode}` : "No group"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-xl bg-surface-container-low px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/70">
                      Due Date
                    </p>
                    <p className="mt-1 font-semibold text-on-surface">{formatDateLabel(row.dueDateIso)}</p>
                  </div>
                  <div className="rounded-xl bg-surface-container-low px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/70">
                      Amount
                    </p>
                    <p className="mt-1 font-extrabold text-on-surface">{formatIdr(row.amount)}</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] shadow-cta-soft transition ${
                      row.groupCode
                        ? "bg-primary text-on-primary hover:bg-primary-container"
                        : "cursor-not-allowed bg-surface-container-high text-on-surface-variant"
                    }`}
                    onClick={() => {
                      if (row.groupCode) {
                        onOpenDetail(row.groupCode);
                      }
                    }}
                    disabled={!row.groupCode}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      visibility
                    </span>
                    <span>View Group</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-low text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
                    aria-label={`Open PDF for ${row.invoiceNumber}`}
                    onClick={() => handleViewPdf(row)}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      picture_as_pdf
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary ${
                      isInvoiceBackendAvailable
                        ? "bg-surface-container-low"
                        : "cursor-not-allowed bg-surface-container-high"
                    }`}
                    aria-label={`Edit ${row.invoiceNumber}`}
                    onClick={() => handleOpenEditInvoice(row)}
                    disabled={!isInvoiceBackendAvailable}
                    title={
                      isInvoiceBackendAvailable
                        ? "Edit"
                        : "Backend invoice/database belum terhubung, edit invoice dinonaktifkan."
                    }
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      edit
                    </span>
                  </button>
                </div>
              </article>
            ))}
          </section>

          <section
            className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-surface-container-lowest shadow-sm lg:block"
            aria-label="Invoice list table"
          >
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <div
                  className="grid gap-2 border-b border-slate-200 bg-surface-container-low px-5 py-3 text-xs font-semibold uppercase tracking-[0.11em] text-on-surface-variant/80"
                  style={{ gridTemplateColumns: "1.2fr 1.05fr 0.7fr 0.85fr 0.65fr 0.85fr" }}
                >
                  <div>Invoice ID</div>
                  <div>Client Name</div>
                  <div>Due Date</div>
                  <div>Amount</div>
                  <div>Status</div>
                  <div className="text-right">Actions</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {paginatedRows.map((row) => (
                    <article
                      key={row.id}
                      className="grid items-center gap-2 px-5 py-4 text-sm transition hover:bg-surface-container-low"
                      style={{ gridTemplateColumns: "1.2fr 1.05fr 0.7fr 0.85fr 0.65fr 0.85fr" }}
                    >
                      <div>
                        <button
                          type="button"
                          className={`text-left font-display text-[0.95rem] font-bold text-primary transition ${
                            row.groupCode ? "hover:underline" : "cursor-default"
                          }`}
                          onClick={() => {
                            if (row.groupCode) {
                              onOpenDetail(row.groupCode);
                            }
                          }}
                          disabled={!row.groupCode}
                        >
                          {row.invoiceNumber}
                        </button>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-on-surface">{row.clientName}</p>
                        <p className="truncate text-xs text-on-surface-variant">
                          {row.groupCode ? `Group ${row.groupCode}` : "No linked group"}
                        </p>
                      </div>

                      <div>
                        <p className="font-medium text-on-surface">{formatDateLabel(row.dueDateIso)}</p>
                      </div>

                      <div>
                        <p className="font-display text-[0.95rem] font-bold text-on-surface">{formatIdr(row.amount)}</p>
                      </div>

                      <div>
                        <span
                          className={`inline-flex rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${getStatusClasses(
                            row.status,
                            isDarkMode,
                          )}`}
                        >
                          {row.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary"
                          title="View PDF"
                          aria-label={`Open PDF for ${row.invoiceNumber}`}
                          onClick={() => handleViewPdf(row)}
                        >
                          <span className="material-symbols-outlined text-base" aria-hidden="true">
                            picture_as_pdf
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary ${
                            isInvoiceBackendAvailable ? "" : "cursor-not-allowed opacity-50"
                          }`}
                          title="Edit"
                          aria-label={`Edit ${row.invoiceNumber}`}
                          onClick={() => handleOpenEditInvoice(row)}
                          disabled={!isInvoiceBackendAvailable}
                        >
                          <span className="material-symbols-outlined text-base" aria-hidden="true">
                            edit
                          </span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredRows.length}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="invoices"
        onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
      />
    </div>
  );
}
