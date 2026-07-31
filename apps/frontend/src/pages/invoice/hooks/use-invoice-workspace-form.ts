import { useState, useRef, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v4";
import * as Domain from "../../../shared/app-domain";
import { useCreateInvoiceMutation, useUpdateInvoiceMutation } from "../../../hooks/use-invoice-query";
import { useThemeMode } from "../../../theme/theme-provider";
import { useModalFocusTrap } from "../../../components/use-modal-focus-trap";
import {
  MANUAL_CLIENT_OPTION_ID,
  resolveExchangeRatesFromRow,
  resolveClientSelection,
  normalizeInvoiceDraftItems,
  deriveInvoiceState,
  buildInvoicePayload,
  createInitialInvoiceDraftItems,
  type InvoiceWorkspaceInitialData,
  type InvoiceClientOption,
  type SelectOption,
  type InvoiceStatusOption,
  type InvoiceRow,
  type InvoiceStatus,
} from "../helpers/invoice-page-shared";
import { clampMoney } from "../../../shared/money";
import { stripInvoiceMetadataTags } from "../../../shared/invoice-notes-tags";

export const invoiceDraftItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  pax: z.number(),
  currency: z.enum(["IDR", "USD", "SAR"]),
  unitPrice: z.number(),
});

export let globalIsDraftSubmit = false;

export const invoiceWorkspaceFormSchema = z
  .object({
    agentId: z.string().trim().min(1, "Select an Agent before saving invoice."),
    issueDateIso: z.string().trim().min(1, "Select issue date before saving invoice."),
    dueDateIso: z.string().optional(),
    invoiceStatus: z.string(),
    issuingOffice: z.string(),
    selectedClientId: z.string().trim().min(1, "Select a client before saving invoice."),
    manualClientName: z.string(),
    selectedGroupCode: z.string(),
    address: z.string().optional(),
    description: z.string().optional(),
    recipientName: z.string().optional(),
    bankAccount: z.string(),
    notes: z.string(),
    items: z.array(invoiceDraftItemSchema),
    payments: z.array(z.object({
      amount: z.number(),
      dateIso: z.string(),
    })).optional(),
    version: z.number().optional(),
  })
  .superRefine((values, context) => {
    if (values.selectedClientId === MANUAL_CLIENT_OPTION_ID && values.manualClientName.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["manualClientName"],
        message: "Isi nama client manual terlebih dulu.",
      });
    }

    if (!globalIsDraftSubmit) {
      if (!values.invoiceStatus || values.invoiceStatus.trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["invoiceStatus"],
          message: "Select invoice status before saving invoice.",
        });
      }
      if (!values.issuingOffice || values.issuingOffice.trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["issuingOffice"],
          message: "Select issuing office before saving invoice.",
        });
      }
      if (!values.bankAccount || values.bankAccount.trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bankAccount"],
          message: "Select bank account before saving invoice.",
        });
      }
    }
  });

export type InvoiceWorkspaceFormValues = z.infer<typeof invoiceWorkspaceFormSchema>;

export function extractYearFromIsoDate(isoDate: string): string {
  const normalized = isoDate.trim();
  const matched = normalized.match(/^(\d{4})-\d{2}-\d{2}$/);
  if (!matched) {
    return Domain.formatLocalIsoDate(new Date()).slice(0, 4);
  }

  return matched[1];
}

export function buildNextInvoiceNumber(existingInvoiceNumbers: string[], year: string): string {
  const invoicePrefix = `GTT/INV/${year}/`;
  const matchingInvoiceNumbers = existingInvoiceNumbers
    .filter((num) => num.startsWith(invoicePrefix))
    .map((num) => {
      const serialPart = num.slice(invoicePrefix.length);
      const serial = Number.parseInt(serialPart, 10);
      return Number.isFinite(serial) ? serial : 0;
    });

  const nextSerial = matchingInvoiceNumbers.length > 0 ? Math.max(...matchingInvoiceNumbers) + 1 : 1;
  return `${invoicePrefix}${String(nextSerial).padStart(4, "0")}`;
}

export function useInvoiceWorkspaceForm({
  mode,
  initialInvoice,
  clients,
  issuingOfficeOptions,
  bankDisbursementOptions,
  invoiceStatusOptions,
  existingInvoiceNumbers,
  isBackendAvailable,
  groups,
  onCreate,
  onUpdate,
}: {
  mode: "create" | "edit";
  initialInvoice?: InvoiceWorkspaceInitialData | null;
  clients: InvoiceClientOption[];
  issuingOfficeOptions: SelectOption[];
  invoiceStatusOptions: InvoiceStatusOption[];
  bankDisbursementOptions: SelectOption[];
  existingInvoiceNumbers: string[];
  isBackendAvailable: boolean;
  groups: Domain.GroupData[];
  onBack: () => void;
  onCreate: (invoice: InvoiceRow, action: "generated" | "draft") => void;
  onUpdate: (invoice: InvoiceRow) => void;
}) {
  const { theme } = useThemeMode();
  const submitLockRef = useRef(false);
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
  const methods = useForm<InvoiceWorkspaceFormValues>({
    resolver: zodResolver(invoiceWorkspaceFormSchema),
    mode: "onChange",
    defaultValues: {
      agentId: resolvedInitialInvoice?.agentId ?? "",
      issueDateIso: resolvedInitialInvoice?.issuedDateIso ?? "",
      dueDateIso: resolvedInitialInvoice?.dueDateIso ?? "",
      invoiceStatus: resolvedInitialInvoice?.status ?? "Pending",
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
      description: resolvedInitialInvoice?.description ?? "",
      address: (() => {
        if (!resolvedInitialInvoice) return "";
        const notesRaw = resolvedInitialInvoice.notes ?? "";
        const match = notesRaw.match(/\[Address:([^\]]*)\]/);
        if (match) {
          return decodeURIComponent(match[1]);
        }
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

      notes: resolvedInitialInvoice?.notes ? stripInvoiceMetadataTags(resolvedInitialInvoice.notes) : "",
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
            legacyAmount = clampMoney(resolvedInitialInvoice.downPaymentIdr / rateVal);
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
      version: resolvedInitialInvoice?.version ?? 0,
    },
  });
  const {
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors: formErrors },
  } = methods;
  const issueDateIso = watch("issueDateIso");
  const dueDateIso = watch("dueDateIso");
  const invoiceStatus = watch("invoiceStatus") as InvoiceStatus | "";
  const issuingOffice = watch("issuingOffice");
  const selectedClientId = watch("selectedClientId");
  const selectedGroupCode = watch("selectedGroupCode");
  const bankAccount = watch("bankAccount");

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const selectedGroup = useMemo(
    () => groups.find((group) => group.code === selectedGroupCode) ?? null,
    [groups, selectedGroupCode],
  );
  const isManualClientSelected = selectedClientId === MANUAL_CLIENT_OPTION_ID;
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
      return;
    }

    if (selectedClient.groupCode && !selectedGroupCode) {
      setValue("selectedGroupCode", selectedClient.groupCode);
    }
  }, [selectedClient, selectedGroupCode, isEditMode, isManualClientSelected, setValue]);

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

  function handleWorkspaceValidationError(errors: any) {
    const list = Object.keys(errors);
    if (list.length === 0) {
      return;
    }

    const firstKey = list[0];
    const firstError = errors[firstKey];
    if (firstKey === "items" && Array.isArray(firstError)) {
      const activeIdx = firstError.findIndex(Boolean);
      if (activeIdx !== -1) {
        const itemErr = firstError[activeIdx];
        if (itemErr.description) {
          setSaveFeedback(`Item ${activeIdx + 1}: ${itemErr.description.message}`);
          return;
        }
        if (itemErr.pax) {
          setSaveFeedback(`Item ${activeIdx + 1}: ${itemErr.pax.message}`);
          return;
        }
        if (itemErr.unitPrice) {
          setSaveFeedback(`Item ${activeIdx + 1}: ${itemErr.unitPrice.message}`);
          return;
        }
      }
    }

    const simpleMsg = firstError.message;
    if (typeof simpleMsg === "string" && simpleMsg.trim().length > 0) {
      setSaveFeedback(simpleMsg);
      return;
    }

    setSaveFeedback("Form data is invalid. Please check the inputs.");
  }

  const handleSaveDraft = handleSubmit(async (values) => {
    if (isEditMode || isWorkspaceBusy || submitLockRef.current) {
      return;
    }
    submitLockRef.current = true;

    if (!isBackendAvailable) {
      setSaveFeedback("Save Draft hanya tersedia saat backend invoice dan database terhubung.");
      submitLockRef.current = false;
      return;
    }

    const clientSelection = resolveClientSelection(values, clients);
    if (!clientSelection.clientId && !clientSelection.clientName) {
      setSaveFeedback("Select a client before saving draft.");
      submitLockRef.current = false;
      return;
    }

    const normalizedItems = normalizeInvoiceDraftItems(values.items);
    if (normalizedItems.length === 0) {
      setSaveFeedback("Add at least one valid package item first.");
      submitLockRef.current = false;
      return;
    }

    clearErrors(["invoiceStatus", "issuingOffice", "bankAccount"]);
    
    const derivedForPayload = deriveInvoiceState({
      items: values.items,
      payments: values.payments || [],
      usdToIdr,
      sarToIdr,
      keepValasCurrency,
    });

    const payload = buildInvoicePayload({
      values: {
        ...values,
        version: resolvedInitialInvoice?.version ?? 0,
      },
      usdToIdr,
      sarToIdr,
      keepValasCurrency,
      derived: derivedForPayload,
      clients,
    });

    setIsSavingDraft(true);
    try {
      const savedInvoice = await createInvoiceMutation.mutateAsync(payload);
      onCreate(savedInvoice, "draft");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to save invoice draft. Please retry.";
      setSaveFeedback(errorMessage);
    } finally {
      setIsSavingDraft(false);
      submitLockRef.current = false;
    }
  }, handleWorkspaceValidationError);

  const handleSubmitInvoice = handleSubmit(async (values) => {
    if (isWorkspaceBusy || submitLockRef.current) {
      return;
    }
    submitLockRef.current = true;

    if (!isBackendAvailable) {
      setSaveFeedback(
        isEditMode
          ? "Save Changes hanya tersedia saat backend invoice dan database terhubung."
          : "Generate Invoice hanya tersedia saat backend invoice dan database terhubung.",
      );
      submitLockRef.current = false;
      return;
    }

    const clientSelection = resolveClientSelection(values, clients);
    if (!clientSelection.clientId && !clientSelection.clientName) {
      setSaveFeedback(
        isEditMode ? "Select a client before saving invoice changes." : "Select a client before generating invoice.",
      );
      submitLockRef.current = false;
      return;
    }

    const normalizedItems = normalizeInvoiceDraftItems(values.items);
    if (normalizedItems.length === 0) {
      setSaveFeedback("Add at least one valid package item first.");
      submitLockRef.current = false;
      return;
    }

    const derivedForPayload = deriveInvoiceState({
      items: values.items,
      payments: values.payments || [],
      usdToIdr,
      sarToIdr,
      keepValasCurrency,
    });

    const payload = buildInvoicePayload({
      values: {
        ...values,
        version: resolvedInitialInvoice?.version ?? 0,
      },
      usdToIdr,
      sarToIdr,
      keepValasCurrency,
      derived: derivedForPayload,
      clients,
    });

    setIsSubmitting(true);
    try {
      const savedInvoice =
        isEditMode && resolvedInitialInvoice
          ? await updateInvoiceMutation.mutateAsync({
              invoiceId: resolvedInitialInvoice.id,
              payload,
            })
          : await createInvoiceMutation.mutateAsync(payload);
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
      submitLockRef.current = false;
    }
  }, handleWorkspaceValidationError);

  const handleSubmitButtonClick = () => {
    if (submitLockRef.current) {
      return;
    }
    if (isEditMode && invoiceStatus === "Cancelled") {
      setIsCancelConfirmationOpen(true);
      return;
    }

    globalIsDraftSubmit = false;
    void handleSubmitInvoice();
  };

  const handleConfirmCancelledStatus = () => {
    setIsCancelConfirmationOpen(false);
    globalIsDraftSubmit = false;
    void handleSubmitInvoice();
  };

  return {
    methods,
    isDarkMode,
    isEditMode,
    usdToIdr,
    setUsdToIdr,
    sarToIdr,
    setSarToIdr,
    keepValasCurrency,
    setKeepValasCurrency,
    saveFeedback,
    setSaveFeedback,
    isSubmitting,
    isSavingDraft,
    isCancelConfirmationOpen,
    setIsCancelConfirmationOpen,
    cancelConfirmationDialogRef,
    isWorkspaceBusy,
    isSubmitDisabled,
    formErrors,
    issueDateIso,
    dueDateIso,
    invoiceStatus,
    issuingOffice,
    selectedClientId,
    selectedGroupCode,
    bankAccount,
    selectedClient,
    selectedGroup,
    isManualClientSelected,
    nextInvoiceNumberPreview,
    handleSaveDraft,
    handleSubmitButtonClick,
    handleConfirmCancelledStatus,
  };
}
