import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod/v4";
import { useAgreementDraftsQuery } from "../../../hooks/use-agreement-drafts-query";
import type {
  AgreementApprovalStatus,
  BusStatus,
  GroupData,
  GroupRaudhahStatus,
  HotelAgreementDraft,
  ItineraryPrefill,
  NewGroupAgreementFormState,
  NewGroupItineraryDraft,
  NewGroupRaudhahFormState,
  VisaStatus,
} from "../../../shared/app-domain";
import * as Domain from "../../../shared/app-domain";
import {
  buildAgreementItineraryPrefill,
  buildNewGroupPayload,
  getAgreementSaveValidationError,
  validateConnectedAgreementDates,
} from "../helpers/new-group-screen-helpers";
import type { NewGroupScreenFormValues } from "../new-group-types";

const { createNewGroupAgreementForm, createNewGroupRaudhahForm, getMinimumBusCountForPax, resolveVisaAgreementNumber } = Domain;

type HotelCity = "makkah" | "madinah";
type InvoiceTone = "paid" | "pending" | "overdue" | "cancelled";
type VisaServiceOption = "Visa Only" | BusStatus;
type AgreementSaveTone = "success" | "warning" | "error";
const EMPTY_AGREEMENT_FORMS: NewGroupAgreementFormState[] = [];

const visaStatusSchema = z.enum(["Draft", "Pending", "Issued"]);
const visaServiceOptionSchema = z.enum(["Visa Only", "Visa+"]);
const paymentStatusSchema = z.enum(["Paid", "Unpaid"]);
const agreementApprovalStatusSchema = z.enum(["Waiting for Approval", "Approved", "Rejected"]);
const raudhahStatusSchema = z.enum(["Free", "After", "Before"]);

const newGroupAgreementFormSchema = z.object({
  id: z.string(),
  sourceDraftId: z.string().optional(),
  hotelName: z.string(),
  agreementNumber: z.string(),
  pax: z.string(),
  status: agreementApprovalStatusSchema,
  stayStartIso: z.string(),
  stayEndIso: z.string(),
});

const newGroupRaudhahFormSchema = z.object({
  id: z.string(),
  dateIso: z.string(),
  status: raudhahStatusSchema,
  tasrehPrinted: z.boolean().optional(),
});

function createNewGroupScreenSchema(requireGroupInformation: boolean) {
  return z.object({
    groupNumber: requireGroupInformation ? z.string().trim().min(1, "Group number wajib diisi.") : z.string(),
    groupName: requireGroupInformation ? z.string().trim().min(1, "Group name wajib diisi.") : z.string(),
    totalPax: requireGroupInformation
      ? z
          .string()
          .trim()
          .min(1, "Total pax wajib diisi.")
          .refine((value) => {
            const parsed = Number.parseInt(value, 10);
            return Number.isFinite(parsed) && parsed > 0;
          }, "Total pax harus lebih dari 0.")
      : z.string(),
    visaStatus: visaStatusSchema,
    syarikahName: z.string(),
    busStatus: visaServiceOptionSchema,
    paymentStatus: paymentStatusSchema,
    makkahHotels: z.array(newGroupAgreementFormSchema),
    madinahHotels: z.array(newGroupAgreementFormSchema),
    raudhahDates: z.array(newGroupRaudhahFormSchema),
  });
}

function toCityLabel(city: HotelCity): string {
  return city === "makkah" ? "Makkah" : "Madinah";
}

function formatAgreementDraftDateRange(draft: HotelAgreementDraft): string {
  const startDate = draft.stayStartIso ? Domain.formatScheduleDate(draft.stayStartIso) : null;
  const endDate = draft.stayEndIso ? Domain.formatScheduleDate(draft.stayEndIso) : null;

  if (startDate && endDate) {
    return `${startDate.date} ${startDate.year} - ${endDate.date} ${endDate.year}`;
  }

  if (startDate) {
    return `Start ${startDate.date} ${startDate.year}`;
  }

  if (endDate) {
    return `End ${endDate.date} ${endDate.year}`;
  }

  return "Stay dates pending";
}

function formatAgreementDraftOptionLabel(draft: HotelAgreementDraft): string {
  const agentLabel = draft.agentName ? `${draft.agentName} - ` : "";
  return `${agentLabel}${draft.hotelName} - ${draft.agreementNumber} - Pax ${draft.pax} - ${formatAgreementDraftDateRange(
    draft,
  )}`;
}

function getInvoiceToneClasses(tone: InvoiceTone): string {
  if (tone === "cancelled") {
    return "border-outline-variant/45 bg-surface-container-high text-on-surface-variant";
  }

  if (tone === "paid") {
    return "border-primary/35 bg-primary-fixed text-on-primary-fixed-variant";
  }

  if (tone === "pending") {
    return "border-tertiary-fixed/60 bg-tertiary-fixed text-on-tertiary-fixed-variant";
  }

  return "border-error-container/65 bg-error-container text-on-error-container";
}

function getInvoiceToneDotClasses(tone: InvoiceTone): string {
  if (tone === "cancelled") {
    return "border-outline-variant/55 bg-on-surface-variant/55";
  }

  if (tone === "paid") {
    return "border-primary/35 bg-primary";
  }

  if (tone === "pending") {
    return "border-tertiary-fixed/60 bg-tertiary";
  }

  return "border-error-container/80 bg-on-error-container/85";
}

function getVisaStatusTone(status: VisaStatus): InvoiceTone {
  if (status === "Issued") {
    return "paid";
  }

  if (status === "Pending") {
    return "pending";
  }

  return "cancelled";
}

function getBusStatusTone(status: VisaServiceOption): InvoiceTone {
  if (status === "Visa+") {
    return "paid";
  }

  return "cancelled";
}

function getAgreementStatusTone(status: AgreementApprovalStatus): InvoiceTone {
  if (status === "Approved") {
    return "paid";
  }

  return "pending";
}

function getRaudhahStatusTone(status: GroupRaudhahStatus): InvoiceTone {
  if (status === "After") {
    return "paid";
  }

  if (status === "Before") {
    return "pending";
  }

  return "cancelled";
}

function getPaymentStatusTone(status: "Paid" | "Unpaid"): InvoiceTone {
  if (status === "Paid") {
    return "paid";
  }

  return "pending";
}

function getAgreementSaveClasses(tone: AgreementSaveTone): string {
  if (tone === "success") {
    return "border-primary/35 bg-primary-fixed text-on-primary-fixed-variant";
  }

  if (tone === "warning") {
    return "border-tertiary-fixed/60 bg-tertiary-fixed text-on-tertiary-fixed-variant";
  }

  return "border-error-container/65 bg-error-container text-on-error-container";
}

function cloneAgreementForms(forms: NewGroupAgreementFormState[]): NewGroupAgreementFormState[] {
  return forms.map((form) => ({ ...form }));
}

export function useNewGroupForm({
  onSaveGroup,
  itineraryDraft,
  hideGroupInformation,
  requireItineraryBeforeSave,
  onItineraryPrefillChange,
  onSetupDraftChange,
}: {
  onSaveGroup: (group: GroupData) => void;
  itineraryDraft: NewGroupItineraryDraft | null;
  hideGroupInformation: boolean;
  requireItineraryBeforeSave: boolean;
  onItineraryPrefillChange?: (prefill: ItineraryPrefill | null) => void;
  onSetupDraftChange?: (draft: any) => void;
}) {
  const formSchema = useMemo(() => createNewGroupScreenSchema(!hideGroupInformation), [hideGroupInformation]);
  const form = useForm<NewGroupScreenFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      groupNumber: "",
      groupName: "",
      totalPax: "",
      visaStatus: "Draft",
      syarikahName: "",
      busStatus: "Visa Only",
      paymentStatus: "Unpaid",
      makkahHotels: [createNewGroupAgreementForm("makkah")],
      madinahHotels: [createNewGroupAgreementForm("madinah")],
      raudhahDates: [createNewGroupRaudhahForm()],
    },
  });

  const { control, watch, setValue } = form;

  const { append: appendMakkahHotel, remove: removeMakkahHotel } = useFieldArray({
    control,
    name: "makkahHotels",
    keyName: "fieldKey",
  });
  const { append: appendMadinahHotel, remove: removeMadinahHotel } = useFieldArray({
    control,
    name: "madinahHotels",
    keyName: "fieldKey",
  });
  const { append: appendRaudhahDate } = useFieldArray({
    control,
    name: "raudhahDates",
    keyName: "fieldKey",
  });

  const [savedAgreementSnapshot, setSavedAgreementSnapshot] = useState<{
    makkahHotels: NewGroupAgreementFormState[];
    madinahHotels: NewGroupAgreementFormState[];
  } | null>(null);
  const [savedAgreementSignature, setSavedAgreementSignature] = useState<string | null>(null);
  const [agreementSaveFeedback, setAgreementSaveFeedback] = useState<{
    tone: Exclude<AgreementSaveTone, "warning">;
    message: string;
  } | null>(null);

  const itineraryGroupCode = itineraryDraft?.groupCode?.trim().toUpperCase() ?? "";
  const itineraryGroupName = itineraryDraft?.groupName?.trim() ?? "";
  const itineraryPax = itineraryDraft?.pax;
  
  const groupNumber = watch("groupNumber") ?? "";
  const groupName = watch("groupName") ?? "";
  const totalPax = watch("totalPax") ?? "";
  const visaStatus = watch("visaStatus") ?? "Draft";
  const syarikahName = watch("syarikahName") ?? "";
  const busStatus = watch("busStatus") ?? "Visa Only";
  const paymentStatus = watch("paymentStatus") ?? "Unpaid";
  const watchedMakkahHotels = watch("makkahHotels");
  const watchedMadinahHotels = watch("madinahHotels");
  const watchedRaudhahDates = watch("raudhahDates");
  const makkahHotels = useMemo(() => watchedMakkahHotels ?? [], [watchedMakkahHotels]);
  const madinahHotels = useMemo(() => watchedMadinahHotels ?? [], [watchedMadinahHotels]);
  const raudhahDates = useMemo(() => watchedRaudhahDates ?? [], [watchedRaudhahDates]);
  
  const agreementDraftsQuery = useAgreementDraftsQuery("", "unassigned");
  
  const agreementDraftOptionsByCity = useMemo(() => {
    const options: Record<HotelCity, HotelAgreementDraft[]> = {
      makkah: [],
      madinah: [],
    };

    for (const draft of agreementDraftsQuery.data ?? []) {
      options[draft.city].push(draft);
    }

    return {
      makkah: options.makkah.sort((left, right) =>
        `${left.stayStartIso}-${left.hotelName}`.localeCompare(`${right.stayStartIso}-${right.hotelName}`),
      ),
      madinah: options.madinah.sort((left, right) =>
        `${left.stayStartIso}-${left.hotelName}`.localeCompare(`${right.stayStartIso}-${right.hotelName}`),
      ),
    };
  }, [agreementDraftsQuery.data]);

  const agreementDraftOptionsById = useMemo(
    () => new Map((agreementDraftsQuery.data ?? []).map((draft) => [draft.id, draft])),
    [agreementDraftsQuery.data],
  );

  const selectedAgreementDraftIds = useMemo(
    () =>
      new Set(
        [...makkahHotels, ...madinahHotels]
          .map((agreement) => agreement.sourceDraftId?.trim())
          .filter((draftId): draftId is string => Boolean(draftId)),
      ),
    [madinahHotels, makkahHotels],
  );

  const fallbackPax = Number.parseInt(totalPax, 10);
  const safePax = Number.isFinite(itineraryPax) && (itineraryPax ?? 0) > 0 ? (itineraryPax as number) : fallbackPax;
  const hasValidPax = Number.isFinite(safePax) && safePax > 0;
  const minimumBusCount = hasValidPax ? getMinimumBusCountForPax(safePax) : 1;

  const resolvedGroupCode = itineraryGroupCode || groupNumber.trim().toUpperCase();
  const resolvedGroupName = itineraryGroupName || groupName.trim();
  const hasItineraryDraft = Boolean(itineraryDraft?.itinerary?.length);
  
  const agreementDateConnection = useMemo(
    () => validateConnectedAgreementDates(makkahHotels, madinahHotels),
    [makkahHotels, madinahHotels],
  );
  
  const agreementSaveValidationError = useMemo(
    () => getAgreementSaveValidationError(makkahHotels, madinahHotels),
    [makkahHotels, madinahHotels],
  );

  const currentAgreementSignature = useMemo(
    () =>
      JSON.stringify({
        makkahHotels,
        madinahHotels,
      }),
    [makkahHotels, madinahHotels],
  );

  const savedMakkahHotels = savedAgreementSnapshot?.makkahHotels ?? EMPTY_AGREEMENT_FORMS;
  const savedMadinahHotels = savedAgreementSnapshot?.madinahHotels ?? EMPTY_AGREEMENT_FORMS;
  
  const savedAgreementDateConnection = useMemo(
    () => validateConnectedAgreementDates(savedMakkahHotels, savedMadinahHotels),
    [savedMadinahHotels, savedMakkahHotels],
  );

  const isAgreementSaved = savedAgreementSnapshot !== null;
  const hasUnsavedAgreementChanges = !isAgreementSaved || currentAgreementSignature !== savedAgreementSignature;
  const isAgreementReadyForContinue = isAgreementSaved && !hasUnsavedAgreementChanges;
  
  const isSaveDisabled =
    !resolvedGroupCode ||
    !resolvedGroupName ||
    !hasValidPax ||
    !isAgreementReadyForContinue ||
    (requireItineraryBeforeSave && !hasItineraryDraft);

  const handleAgreementDraftSelect = (city: HotelCity, agreementIndex: number, draftId: string) => {
    setAgreementSaveFeedback(null);
    const currentAgreements = city === "makkah" ? makkahHotels : madinahHotels;
    const selectedDraft = draftId ? agreementDraftOptionsById.get(draftId) : undefined;
    const nextAgreements = currentAgreements.map((agreement, index) => {
      if (index !== agreementIndex) {
        return agreement;
      }

      if (!selectedDraft) {
        return {
          ...agreement,
          sourceDraftId: undefined,
        };
      }

      return {
        ...agreement,
        sourceDraftId: selectedDraft.id,
        hotelName: selectedDraft.hotelName,
        agreementNumber: selectedDraft.agreementNumber,
        pax: selectedDraft.pax.toString(),
        status: selectedDraft.status,
        stayStartIso: selectedDraft.stayStartIso,
        stayEndIso: selectedDraft.stayEndIso,
      };
    });

    setValue(city === "makkah" ? "makkahHotels" : "madinahHotels", nextAgreements, {
      shouldDirty: true,
    });
  };

  const handleAgreementChange = (
    city: HotelCity,
    agreementIndex: number,
    field: any,
    value: any,
  ) => {
    setAgreementSaveFeedback(null);
    const currentAgreements = city === "makkah" ? makkahHotels : madinahHotels;
    const nextAgreements = currentAgreements.map((agreement, index) =>
      index === agreementIndex ? { ...agreement, [field]: value } : agreement,
    );
    setValue(city === "makkah" ? "makkahHotels" : "madinahHotels", nextAgreements, {
      shouldDirty: true,
    });
  };

  const handleAddAgreement = (city: HotelCity) => {
    setAgreementSaveFeedback(null);
    if (city === "makkah") {
      appendMakkahHotel(createNewGroupAgreementForm(city));
      return;
    }

    appendMadinahHotel(createNewGroupAgreementForm(city));
  };

  const handleRemoveAgreement = (city: HotelCity, agreementIndex: number) => {
    setAgreementSaveFeedback(null);
    const agreements = city === "makkah" ? makkahHotels : madinahHotels;
    if (agreements.length <= 1) {
      return;
    }

    if (city === "makkah") {
      removeMakkahHotel(agreementIndex);
      return;
    }

    removeMadinahHotel(agreementIndex);
  };

  const handleClearAgreement = (city: HotelCity, agreementIndex: number) => {
    setAgreementSaveFeedback(null);
    const agreements = city === "makkah" ? makkahHotels : madinahHotels;
    const agreementToClear = agreements[agreementIndex];
    if (!agreementToClear) {
      return;
    }

    const resetAgreement: NewGroupAgreementFormState = {
      ...createNewGroupAgreementForm(city),
      id: agreementToClear.id,
    };
    const nextAgreements = agreements.map((agreement, index) =>
      index === agreementIndex ? resetAgreement : agreement,
    );
    setValue(city === "makkah" ? "makkahHotels" : "madinahHotels", nextAgreements, {
      shouldDirty: true,
    });
  };

  const handleRaudhahChange = (
    appointmentIndex: number,
    field: any,
    value: any,
  ) => {
    const nextAppointments = raudhahDates.map((appointment, index) =>
      index === appointmentIndex ? { ...appointment, [field]: value } : appointment,
    );
    setValue("raudhahDates", nextAppointments, { shouldDirty: true });
  };

  const handleSaveAgreement = () => {
    if (agreementSaveValidationError) {
      setAgreementSaveFeedback({
        tone: "error",
        message: agreementSaveValidationError,
      });
      return;
    }

    setSavedAgreementSnapshot({
      makkahHotels: cloneAgreementForms(makkahHotels),
      madinahHotels: cloneAgreementForms(madinahHotels),
    });
    setSavedAgreementSignature(currentAgreementSignature);
    onItineraryPrefillChange?.(buildAgreementItineraryPrefill(makkahHotels, madinahHotels));
    setAgreementSaveFeedback({
      tone: "success",
      message: onItineraryPrefillChange
        ? "Agreement hotel berhasil disimpan dan itinerary ikut diperbarui."
        : "Agreement hotel berhasil disimpan.",
    });
  };

  const handleSave = (values: NewGroupScreenFormValues) => {
    if (isSaveDisabled || !hasValidPax) {
      return;
    }

    onSaveGroup(
      buildNewGroupPayload({
        resolvedGroupCode,
        resolvedGroupName,
        safePax,
        visaStatus: values.visaStatus,
        syarikahName: values.syarikahName,
        busStatus: values.busStatus === "Visa+" ? "Visa+" : undefined,
        paymentStatus: values.paymentStatus,
        makkahHotels: savedMakkahHotels,
        madinahHotels: savedMadinahHotels,
        raudhahDates,
        itineraryDraft,
      }),
    );
  };

  const selectClassName = "serene-select";
  const toneDotClassName =
    "pointer-events-none absolute left-3 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full border";
  const getToneSelectClassName = (tone: InvoiceTone) => `${selectClassName} pl-10 ${getInvoiceToneClasses(tone)}`;

  const getAgreementStatusChipClassName = (status: AgreementApprovalStatus) =>
    `inline-flex whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${getInvoiceToneClasses(
      getAgreementStatusTone(status),
    )}`;

  const canProceedFromSetupStep =
    isAgreementReadyForContinue &&
    !savedAgreementDateConnection.hasWarning &&
    !!resolvedGroupCode &&
    !!resolvedGroupName &&
    hasValidPax;

  const agreementSaveStatus =
    agreementSaveFeedback?.tone === "error"
      ? agreementSaveFeedback
      : !isAgreementSaved
        ? {
            tone: "warning" as const,
            message: "Agreement hotel belum disimpan. Klik Save Agreement untuk validasi tanggal dan sync itinerary.",
          }
        : hasUnsavedAgreementChanges
          ? {
              tone: "warning" as const,
              message: "Ada perubahan agreement yang belum disimpan. Klik Save Agreement lagi untuk update itinerary.",
            }
          : agreementSaveFeedback;

  useEffect(() => {
    if (!onSetupDraftChange) {
      return;
    }

    onSetupDraftChange({
      resolvedGroupCode,
      resolvedGroupName,
      safePax,
      hasValidPax,
      visaStatus,
      syarikahName: syarikahName.trim(),
      busStatus,
      paymentStatus,
      makkahHotels: savedMakkahHotels,
      madinahHotels: savedMadinahHotels,
      raudhahDates,
      agreementDateConnection: savedAgreementDateConnection,
      canProceed: canProceedFromSetupStep,
    });
  }, [
    busStatus,
    canProceedFromSetupStep,
    hasValidPax,
    onSetupDraftChange,
    paymentStatus,
    raudhahDates,
    resolvedGroupCode,
    resolvedGroupName,
    savedAgreementDateConnection,
    savedMadinahHotels,
    savedMakkahHotels,
    safePax,
    syarikahName,
    visaStatus,
  ]);

  const formatAgreementStayRange = (agreement: NewGroupAgreementFormState) => {
    if (!agreement.stayStartIso && !agreement.stayEndIso) {
      return "Stay dates pending";
    }

    const startDate = agreement.stayStartIso ? Domain.formatScheduleDate(agreement.stayStartIso) : null;
    const endDate = agreement.stayEndIso ? Domain.formatScheduleDate(agreement.stayEndIso) : null;

    if (startDate && endDate) {
      return `${startDate.date} ${startDate.year} - ${endDate.date} ${endDate.year}`;
    }

    if (startDate) {
      return `Start ${startDate.date} ${startDate.year}`;
    }

    return `End ${endDate?.date ?? ""} ${endDate?.year ?? ""}`.trim();
  };

  return {
    form,
    makkahHotels,
    madinahHotels,
    raudhahDates,
    agreementDraftOptionsByCity,
    selectedAgreementDraftIds,
    safePax,
    hasValidPax,
    minimumBusCount,
    resolvedGroupCode,
    resolvedGroupName,
    agreementDateConnection,
    agreementSaveValidationError,
    agreementSaveStatus,
    visaStatus,
    syarikahName,
    busStatus,
    paymentStatus,
    draftsLoading: agreementDraftsQuery.isLoading,
    isDraftsError: agreementDraftsQuery.isError,

    handleAgreementDraftSelect,
    handleAgreementChange,
    handleAddAgreement,
    handleRemoveAgreement,
    handleClearAgreement,
    handleRaudhahChange,
    handleSaveAgreement,
    handleSave,
    appendRaudhahDate,
    
    getInvoiceToneClasses,
    getInvoiceToneDotClasses,
    getVisaStatusTone,
    getBusStatusTone,
    getRaudhahStatusTone,
    getPaymentStatusTone,
    getAgreementStatusTone,
    getToneSelectClassName,
    getAgreementStatusChipClassName,
    formatAgreementStayRange,
    isSaveDisabled,
    hasItineraryDraft,
  };
}
