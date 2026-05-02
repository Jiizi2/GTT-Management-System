import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import * as z from "zod/v4";
import * as Domain from "../shared/app-domain";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../components/form-accessibility";
import { DatePickerInput } from "../components/date-time-pickers";
import { SereneSelect } from "../components/serene-select";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import type {
  AgreementApprovalStatus,
  BusStatus,
  GroupData,
  GroupRaudhahStatus,
  ItineraryPrefill,
  NewGroupAgreementFormState,
  NewGroupItineraryDraft,
  NewGroupRaudhahFormState,
  VisaStatus,
} from "../shared/app-domain";
import {
  buildAgreementItineraryPrefill,
  buildNewGroupPayload,
  getAgreementSaveValidationError,
  validateConnectedAgreementDates,
} from "./new-group-screen-helpers";

const LazyInputItineraryScreen = lazy(async () => ({
  default: (await import("./add-group-workspace-page")).InputItineraryScreen,
}));

const { createNewGroupAgreementForm, createNewGroupRaudhahForm, getMinimumBusCountForPax, resolveVisaAgreementNumber } =
  Domain;

type HotelCity = "makkah" | "madinah";
type InvoiceTone = "paid" | "pending" | "overdue" | "cancelled";
type VisaServiceOption = "Visa Only" | BusStatus;
type AgreementSaveTone = "success" | "warning" | "error";

const visaStatusSchema = z.enum(["Draft", "Pending", "Issued"]);
const visaServiceOptionSchema = z.enum(["Visa Only", "Visa+"]);
const paymentStatusSchema = z.enum(["Paid", "Unpaid"]);
const agreementApprovalStatusSchema = z.enum(["Waiting for Approval", "Approved"]);
const raudhahStatusSchema = z.enum(["Free", "After", "Before"]);

const newGroupAgreementFormSchema = z.object({
  id: z.string(),
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

type NewGroupScreenFormValues = z.infer<ReturnType<typeof createNewGroupScreenSchema>>;

type NewGroupSetupDraft = {
  resolvedGroupCode: string;
  resolvedGroupName: string;
  safePax: number;
  hasValidPax: boolean;
  visaStatus: VisaStatus;
  syarikahName: string;
  busStatus: VisaServiceOption;
  paymentStatus: "Paid" | "Unpaid";
  makkahHotels: NewGroupAgreementFormState[];
  madinahHotels: NewGroupAgreementFormState[];
  raudhahDates: NewGroupRaudhahFormState[];
  agreementDateConnection: ReturnType<typeof validateConnectedAgreementDates>;
  canProceed: boolean;
};

function toCityLabel(city: HotelCity): string {
  return city === "makkah" ? "Makkah" : "Madinah";
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

function ItinerarySectionFallback({ label }: { label: string }) {
  return (
    <section className="serene-section">
      <div className="flex items-center gap-3 text-sm font-semibold text-on-surface-variant" role="status" aria-live="polite">
        <span className="material-symbols-outlined animate-pulse text-base text-primary" aria-hidden="true">
          sync
        </span>
        <span>{label}</span>
      </div>
    </section>
  );
}

export function NewGroupScreen({
  onSaveGroup,
  onCancel,
  hideHeader = false,
  itineraryDraft = null,
  itinerarySectionTop,
  itinerarySectionBottom,
  hideGroupInformation = false,
  requireItineraryBeforeSave = false,
  onItineraryPrefillChange,
  hideFooterActions = false,
  onSetupDraftChange,
}: {
  onSaveGroup: (group: GroupData) => void;
  onCancel: () => void;
  hideHeader?: boolean;
  itineraryDraft?: NewGroupItineraryDraft | null;
  itinerarySectionTop?: ReactNode;
  itinerarySectionBottom?: ReactNode;
  hideGroupInformation?: boolean;
  requireItineraryBeforeSave?: boolean;
  onItineraryPrefillChange?: (prefill: ItineraryPrefill | null) => void;
  hideFooterActions?: boolean;
  onSetupDraftChange?: (draft: NewGroupSetupDraft) => void;
}) {
  const formSchema = useMemo(() => createNewGroupScreenSchema(!hideGroupInformation), [hideGroupInformation]);
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<NewGroupScreenFormValues>({
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
  const groupNumber = watch("groupNumber");
  const groupName = watch("groupName");
  const totalPax = watch("totalPax");
  const visaStatus = watch("visaStatus");
  const syarikahName = watch("syarikahName");
  const busStatus = watch("busStatus");
  const paymentStatus = watch("paymentStatus");
  const watchedMakkahHotels = watch("makkahHotels");
  const watchedMadinahHotels = watch("madinahHotels");
  const watchedRaudhahDates = watch("raudhahDates");
  const makkahHotels = useMemo(() => watchedMakkahHotels ?? [], [watchedMakkahHotels]);
  const madinahHotels = useMemo(() => watchedMadinahHotels ?? [], [watchedMadinahHotels]);
  const raudhahDates = useMemo(() => watchedRaudhahDates ?? [], [watchedRaudhahDates]);
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
  const savedMakkahHotels = savedAgreementSnapshot?.makkahHotels ?? [];
  const savedMadinahHotels = savedAgreementSnapshot?.madinahHotels ?? [];
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

  const handleAgreementChange = <Key extends keyof NewGroupAgreementFormState>(
    city: HotelCity,
    agreementIndex: number,
    field: Key,
    value: NewGroupAgreementFormState[Key],
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

  const handleRaudhahChange = <Key extends keyof NewGroupRaudhahFormState>(
    appointmentIndex: number,
    field: Key,
    value: NewGroupRaudhahFormState[Key],
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

  const sectionClassName = "serene-section";
  const fieldClassName = "serene-field";
  const controlClassName = "serene-input";
  const selectClassName = "serene-select";
  const containerClassName = hideHeader ? "space-y-6" : "mx-auto max-w-7xl space-y-6";
  const toneDotClassName =
    "pointer-events-none absolute left-3 top-1/2 z-10 h-2.5 w-2.5 -translate-y-1/2 rounded-full border";
  const getToneSelectClassName = (tone: InvoiceTone) => `${selectClassName} pl-10 ${getInvoiceToneClasses(tone)}`;

  const getAgreementStatusChipClassName = (status: AgreementApprovalStatus) =>
    `inline-flex whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${getInvoiceToneClasses(
      getAgreementStatusTone(status),
    )}`;
  const groupNumberErrorMessage = errors.groupNumber?.message;
  const totalPaxErrorMessage = errors.totalPax?.message;
  const groupNameErrorMessage = errors.groupName?.message;
  const canProceedFromSetupStep =
    isAgreementReadyForContinue && !savedAgreementDateConnection.hasWarning && !!resolvedGroupCode && !!resolvedGroupName && hasValidPax;
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
  const identitySectionSummary =
    [resolvedGroupCode, resolvedGroupName]
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .join(" · ") || "Fill the basic group identity";
  const setupSectionSummary = agreementDateConnection.hasWarning
    ? "Review agreement dates"
    : `${makkahHotels.length + madinahHotels.length} hotel cards · ${raudhahDates.length} raudhah`;

  void identitySectionSummary;
  void setupSectionSummary;

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

  const renderAgreementSection = (city: HotelCity, agreements: NewGroupAgreementFormState[]) => (
    <div className="rounded-2xl bg-surface-container-low p-4 shadow-ambient">
      <div className="mb-3 flex items-center gap-2 text-on-surface">
        <span className="material-symbols-outlined text-primary" aria-hidden="true">
          location_on
        </span>
        <h3 className="text-lg font-semibold">{toCityLabel(city)} Subsection</h3>
      </div>

      <div className="space-y-3">
        {agreements.map((agreement, index) => (
          <details key={agreement.id} className="serene-accordion">
            <summary className="serene-accordion-summary">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="truncate text-base font-semibold text-on-surface">
                    {agreement.hotelName.trim() || `Hotel ${index + 1}`}
                  </h4>
                  <span className={getAgreementStatusChipClassName(agreement.status)}>{agreement.status}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                  {agreement.agreementNumber.trim() || "Agreement number pending"} · Pax {agreement.pax.trim() || "0"} ·{" "}
                  {formatAgreementStayRange(agreement)}
                </p>
              </div>
              <span
                className="serene-accordion-chevron material-symbols-outlined text-on-surface-variant"
                aria-hidden="true"
              >
                expand_more
              </span>
            </summary>

            <div className="serene-accordion-content">
              <div className="grid gap-3 md:grid-cols-2">
                <label className={`${fieldClassName} md:col-span-2`}>
                  <span>Hotel Name</span>
                  <input
                    className={controlClassName}
                    type="text"
                    value={agreement.hotelName}
                    onChange={(event) => handleAgreementChange(city, index, "hotelName", event.target.value)}
                    placeholder={`e.g. ${toCityLabel(city)} Main Hotel`}
                  />
                </label>

                <label className={`${fieldClassName} md:col-span-2`}>
                  <span>Agreement Number</span>
                  <input
                    className={controlClassName}
                    type="text"
                    value={agreement.agreementNumber}
                    onChange={(event) => handleAgreementChange(city, index, "agreementNumber", event.target.value)}
                    placeholder={resolveVisaAgreementNumber(
                      { groupCode: resolvedGroupCode || "901794508" },
                      undefined,
                      city,
                    )}
                  />
                </label>

                <label className={fieldClassName}>
                  <span>Pax</span>
                  <input
                    className={controlClassName}
                    type="number"
                    min={0}
                    value={agreement.pax}
                    onChange={(event) => handleAgreementChange(city, index, "pax", event.target.value)}
                    placeholder={String(safePax || 0)}
                  />
                </label>

                <label className={fieldClassName}>
                  <span>Status</span>
                  <div className="relative">
                    <span
                      className={`${toneDotClassName} ${getInvoiceToneDotClasses(
                        getAgreementStatusTone(agreement.status),
                      )}`}
                      aria-hidden="true"
                    />
                    <SereneSelect
                      className={getToneSelectClassName(getAgreementStatusTone(agreement.status))}
                      value={agreement.status}
                      onChange={(event) =>
                        handleAgreementChange(city, index, "status", event.target.value as AgreementApprovalStatus)
                      }
                    >
                      <option value="Waiting for Approval">Waiting for Approval</option>
                      <option value="Approved">Approved</option>
                    </SereneSelect>
                  </div>
                </label>

                <label className={fieldClassName}>
                  <span>Stay Start</span>
                  <DatePickerInput
                    inputClassName={controlClassName}
                    value={agreement.stayStartIso}
                    onChange={(nextValue) => handleAgreementChange(city, index, "stayStartIso", nextValue)}
                  />
                </label>

                <label className={fieldClassName}>
                  <span>Stay End</span>
                  <DatePickerInput
                    inputClassName={controlClassName}
                    value={agreement.stayEndIso}
                    onChange={(nextValue) => handleAgreementChange(city, index, "stayEndIso", nextValue)}
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-md border border-outline-variant/45 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition hover:border-primary/35 hover:text-primary"
                  onClick={() => handleClearAgreement(city, index)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    close
                  </span>
                  <span>Clear</span>
                </button>

                {agreements.length > 1 ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md bg-error-container px-3 py-1.5 text-xs font-semibold text-on-error-container transition hover:brightness-95"
                    onClick={() => handleRemoveAgreement(city, index)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      delete
                    </span>
                    <span>Remove Hotel {index + 1}</span>
                  </button>
                ) : null}
              </div>
            </div>
          </details>
        ))}
      </div>

      {agreementDateConnection.cityWarnings[city] ? (
        <div
          className="mt-3 flex items-start gap-2 rounded-md bg-tertiary-fixed px-3 py-2 text-sm text-on-tertiary-fixed-variant"
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            warning
          </span>
          <p>{agreementDateConnection.cityWarnings[city]}</p>
        </div>
      ) : null}

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          className="inline-flex items-center text-sm font-semibold text-primary transition hover:text-primary/85 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          onClick={() => handleAddAgreement(city)}
        >
          <span>Add Hotel</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className={containerClassName}>
      {!hideHeader ? (
        <header className="serene-section p-6">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            Add New Group
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant sm:text-base">
            <span className="sm:hidden">Create group and visa setup.</span>
            <span className="hidden sm:inline">Create group and initialize visa tracking details.</span>
          </p>
        </header>
      ) : null}

      <form className="space-y-6" onSubmit={handleSubmit(handleSave)}>
        {itinerarySectionTop ? <div className="space-y-4">{itinerarySectionTop}</div> : null}

        <div className={`grid gap-4 ${hideGroupInformation ? "" : "xl:grid-cols-2"}`}>
          {!hideGroupInformation ? (
            <section className={sectionClassName}>
              <h2 className="mb-4 font-display text-xl font-semibold text-on-surface">Group Information</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className={fieldClassName}>
                  <span>Group Number</span>
                  <input
                    id="new-group-number"
                    className={controlClassName}
                    type="text"
                    {...register("groupNumber")}
                    placeholder="e.g. 901794508"
                    aria-invalid={getFieldAriaInvalid(groupNumberErrorMessage)}
                    aria-describedby={getFieldDescribedBy("new-group-number", {
                      errorMessage: groupNumberErrorMessage,
                    })}
                  />
                  <FieldErrorMessage fieldId="new-group-number" message={groupNumberErrorMessage} />
                </label>
                <label className={fieldClassName}>
                  <span>Total Pax</span>
                  <input
                    id="new-group-total-pax"
                    className={controlClassName}
                    type="number"
                    min={1}
                    {...register("totalPax")}
                    placeholder="45"
                    aria-invalid={getFieldAriaInvalid(totalPaxErrorMessage)}
                    aria-describedby={getFieldDescribedBy("new-group-total-pax", {
                      errorMessage: totalPaxErrorMessage,
                    })}
                  />
                  <FieldErrorMessage fieldId="new-group-total-pax" message={totalPaxErrorMessage} />
                </label>
                <label className={`${fieldClassName} md:col-span-2`}>
                  <span>Group Name</span>
                  <input
                    id="new-group-name"
                    className={controlClassName}
                    type="text"
                    {...register("groupName")}
                    placeholder="e.g. FEB 25 - Group 3"
                    aria-invalid={getFieldAriaInvalid(groupNameErrorMessage)}
                    aria-describedby={getFieldDescribedBy("new-group-name", {
                      errorMessage: groupNameErrorMessage,
                    })}
                  />
                  <FieldErrorMessage fieldId="new-group-name" message={groupNameErrorMessage} />
                </label>
              </div>
            </section>
          ) : null}

          <section className={sectionClassName}>
            <h2 className="mb-4 font-display text-xl font-semibold text-on-surface">Visa Information</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={fieldClassName}>
                <span>Visa Status</span>
                <div className="relative">
                  <span
                    className={`${toneDotClassName} ${getInvoiceToneDotClasses(getVisaStatusTone(visaStatus))}`}
                    aria-hidden="true"
                  />
                  <Controller
                    name="visaStatus"
                    control={control}
                    render={({ field }) => (
                      <SereneSelect
                        className={getToneSelectClassName(getVisaStatusTone(field.value))}
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Pending">On Process</option>
                        <option value="Issued">Issued</option>
                      </SereneSelect>
                    )}
                  />
                </div>
              </label>
              <label className={fieldClassName}>
                <span>Syarikah</span>
                <input className={controlClassName} type="text" {...register("syarikahName")} placeholder="Enter syarikah name" />
              </label>
              <label className={fieldClassName}>
                <span>Visa Type</span>
                <div className="relative">
                  <span
                    className={`${toneDotClassName} ${getInvoiceToneDotClasses(getBusStatusTone(busStatus))}`}
                    aria-hidden="true"
                  />
                  <Controller
                    name="busStatus"
                    control={control}
                    render={({ field }) => (
                      <SereneSelect
                        className={getToneSelectClassName(getBusStatusTone(field.value))}
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                      >
                        <option value="Visa Only">Visa Only</option>
                        <option value="Visa+">Visa+</option>
                      </SereneSelect>
                    )}
                  />
                </div>
              </label>
              <div className={`${fieldClassName} justify-end`}>
                <span className="text-xs text-on-surface-variant/80">Minimum buses</span>
                <strong className="text-lg text-on-surface">{minimumBusCount}</strong>
              </div>
            </div>
          </section>
        </div>

        <section className={sectionClassName}>
          <h2 className="mb-4 font-display text-xl font-semibold text-on-surface">Agreement Hotel</h2>
          {agreementDateConnection.crossCityWarning ? (
            <div
              className="mb-4 flex items-start gap-2 rounded-md bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant"
              role="status"
              aria-live="polite"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                warning
              </span>
              <p>{agreementDateConnection.crossCityWarning}</p>
            </div>
          ) : null}
          <div className="grid gap-4 xl:grid-cols-2">
            {renderAgreementSection("makkah", makkahHotels)}
            {renderAgreementSection("madinah", madinahHotels)}
          </div>
          {agreementSaveStatus ? (
            <div
              className={`mt-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${getAgreementSaveClasses(
                agreementSaveStatus.tone,
              )}`}
              role="status"
              aria-live="polite"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                {agreementSaveStatus.tone === "success" ? "check_circle" : agreementSaveStatus.tone === "error" ? "error" : "info"}
              </span>
              <p>{agreementSaveStatus.message}</p>
            </div>
          ) : null}
          <div className="serene-form-actions mt-4 serene-form-actions-fill">
            <button type="button" className="serene-btn-primary min-h-10 w-full sm:w-auto" onClick={handleSaveAgreement}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                task_alt
              </span>
              <span>Save Agreement</span>
            </button>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className={sectionClassName}>
            <h2 className="mb-4 font-display text-xl font-semibold text-on-surface">Raudhah Appointments</h2>
            <div className="space-y-3">
              {raudhahDates.map((appointment, index) => (
                <article key={appointment.id} className="rounded-2xl bg-surface-container-lowest p-4 shadow-ambient">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className={fieldClassName}>
                      <span>Raudhah Date</span>
                      <DatePickerInput
                        inputClassName={controlClassName}
                        value={appointment.dateIso}
                        onChange={(nextValue) => handleRaudhahChange(index, "dateIso", nextValue)}
                      />
                    </label>
                    <label className={fieldClassName}>
                      <span>Status</span>
                      <div className="relative">
                        <span
                          className={`${toneDotClassName} ${getInvoiceToneDotClasses(
                            getRaudhahStatusTone(appointment.status),
                          )}`}
                          aria-hidden="true"
                        />
                        <SereneSelect
                          className={getToneSelectClassName(getRaudhahStatusTone(appointment.status))}
                          value={appointment.status}
                          onChange={(event) =>
                            handleRaudhahChange(index, "status", event.target.value as GroupRaudhahStatus)
                          }
                        >
                          <option value="Free">Free</option>
                          <option value="After">After</option>
                          <option value="Before">Before</option>
                        </SereneSelect>
                      </div>
                    </label>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="serene-btn-secondary"
                onClick={() => appendRaudhahDate(createNewGroupRaudhahForm())}
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  add_circle
                </span>
                <span className="sm:hidden">Add Raudhah Date</span>
                <span className="hidden sm:inline">Add Another Raudhah Date</span>
              </button>
            </div>
          </section>

          <section className={sectionClassName}>
            <h2 className="mb-4 font-display text-xl font-semibold text-on-surface">Payment</h2>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-high p-1">
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  paymentStatus === "Unpaid"
                    ? `${getInvoiceToneClasses(getPaymentStatusTone("Unpaid"))} shadow-sm`
                    : "border-transparent text-on-surface-variant hover:border-outline-variant/45 hover:bg-surface-container-lowest"
                }`}
                onClick={() => setValue("paymentStatus", "Unpaid", { shouldDirty: true })}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  hourglass_top
                </span>
                <span>Unpaid</span>
              </button>
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  paymentStatus === "Paid"
                    ? `${getInvoiceToneClasses(getPaymentStatusTone("Paid"))} shadow-sm`
                    : "border-transparent text-on-surface-variant hover:border-outline-variant/45 hover:bg-surface-container-lowest"
                }`}
                onClick={() => setValue("paymentStatus", "Paid", { shouldDirty: true })}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  task_alt
                </span>
                <span>Paid</span>
              </button>
            </div>
          </section>
        </div>

        {itinerarySectionBottom ? <div className="space-y-4">{itinerarySectionBottom}</div> : null}

        {!hideFooterActions ? (
          <footer className="serene-form-actions">
            {requireItineraryBeforeSave && !hasItineraryDraft ? (
              <p className="w-full text-sm font-medium text-on-tertiary-fixed-variant" role="status" aria-live="polite">
                <span className="sm:hidden">Isi Add Schedule dulu untuk mengaktifkan Save.</span>
                <span className="hidden sm:inline">
                  Isi itinerary di bagian Add Schedule terlebih dahulu untuk mengaktifkan Save Group.
                </span>
              </p>
            ) : null}
            {!isAgreementReadyForContinue ? (
              <p className="w-full text-sm font-medium text-on-tertiary-fixed-variant" role="status" aria-live="polite">
                <span className="sm:hidden">Save agreement hotel dulu sebelum simpan group.</span>
                <span className="hidden sm:inline">
                  Simpan agreement hotel terlebih dahulu. Saat save, sistem akan validasi tanggal dan sync ke itinerary.
                </span>
              </p>
            ) : null}
            <button type="button" className="serene-btn-secondary min-h-11 w-full sm:w-auto" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="serene-btn-primary min-h-11 w-full sm:w-auto" disabled={isSaveDisabled}>
              Save Group
            </button>
          </footer>
        ) : null}
      </form>
    </div>
  );
}

export function AddGroupWorkspaceScreen({
  onSaveGroup,
  onCancel,
}: {
  onSaveGroup: (group: GroupData) => void;
  onCancel: () => void;
}) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [visitedSteps, setVisitedSteps] = useState<Record<1 | 2 | 3, boolean>>({
    1: true,
    2: false,
    3: false,
  });
  const [identityDraft, setIdentityDraft] = useState<NewGroupItineraryDraft | null>(null);
  const [setupDraft, setSetupDraft] = useState<NewGroupSetupDraft | null>(null);
  const [itineraryDetailDraft, setItineraryDetailDraft] = useState<NewGroupItineraryDraft | null>(null);
  const [itineraryPrefill, setItineraryPrefill] = useState<ItineraryPrefill | null>(null);

  const itineraryDraft =
    identityDraft || itineraryDetailDraft
      ? {
          ...(identityDraft ?? {}),
          ...(itineraryDetailDraft ?? {}),
        }
      : null;

  const isIdentityStepComplete = Boolean(
    identityDraft?.groupCode?.trim() &&
      identityDraft?.groupName?.trim() &&
      identityDraft?.packageName?.trim() &&
      identityDraft?.startDate &&
      identityDraft?.endDate &&
      typeof identityDraft?.pax === "number" &&
      identityDraft.pax > 0 &&
      typeof identityDraft?.totalBuses === "number" &&
      identityDraft.totalBuses > 0 &&
      identityDraft?.musyrifName?.trim() &&
      identityDraft?.musyrifPhone?.trim(),
  );
  const canOpenSetupStep = isIdentityStepComplete;
  const canOpenItineraryStep = isIdentityStepComplete && Boolean(setupDraft?.canProceed);
  const isItineraryStepComplete = Boolean(itineraryDetailDraft?.itinerary?.length);
  const canSaveGroup = canOpenItineraryStep && isItineraryStepComplete && Boolean(setupDraft);

  useEffect(() => {
    setVisitedSteps((currentVisitedSteps) =>
      currentVisitedSteps[currentStep] ? currentVisitedSteps : { ...currentVisitedSteps, [currentStep]: true },
    );
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 3 && !canOpenItineraryStep) {
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2 && !canOpenSetupStep) {
      setCurrentStep(1);
    }
  }, [canOpenItineraryStep, canOpenSetupStep, currentStep]);

  const handleSaveWorkspaceGroup = () => {
    if (!identityDraft || !setupDraft || !canSaveGroup) {
      return;
    }

    onSaveGroup(
      buildNewGroupPayload({
        resolvedGroupCode: identityDraft.groupCode?.trim().toUpperCase() ?? "",
        resolvedGroupName: identityDraft.groupName?.trim() ?? "",
        safePax: setupDraft.safePax,
        visaStatus: setupDraft.visaStatus,
        syarikahName: setupDraft.syarikahName,
        busStatus: setupDraft.busStatus === "Visa+" ? "Visa+" : undefined,
        paymentStatus: setupDraft.paymentStatus,
        makkahHotels: setupDraft.makkahHotels,
        madinahHotels: setupDraft.madinahHotels,
        raudhahDates: setupDraft.raudhahDates,
        itineraryDraft,
      }),
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="serene-btn-secondary min-h-10 min-w-0 flex-1 sm:flex-none sm:w-auto"
          onClick={onCancel}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">Overview</span>
        </button>

        <ThemeToggleButton className="sm:ml-auto sm:mr-5" />
      </div>

      <section className="serene-section p-5 sm:p-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary/85">Group Workspace</p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            Add New Group
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant sm:text-base">
            <span className="sm:hidden">Semua kebutuhan group dalam satu alur.</span>
            <span className="hidden sm:inline">Semua kebutuhan pembuatan group dan itinerary ada dalam satu alur.</span>
          </p>
        </div>
      </section>

      {visitedSteps[1] || currentStep === 1 ? (
        <div className={currentStep === 1 ? "space-y-6" : "hidden"} aria-hidden={currentStep !== 1}>
          <section className="serene-section p-5 sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary/85">Step 1 of 3</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-on-surface">Group Identity</h2>
            <p className="mt-2 text-sm text-on-surface-variant sm:text-base">
              Isi identitas group, rentang tanggal, kebutuhan bus, dan PIC musyrif sebelum masuk ke setup visa.
            </p>
          </section>

          <Suspense fallback={<ItinerarySectionFallback label="Loading itinerary identity form..." />}>
            <LazyInputItineraryScreen
              onSaveGroup={onSaveGroup}
              hideHeader
              hideSaveAction
              sectionMode="identity-only"
              onItineraryDraftChange={setIdentityDraft}
            />
          </Suspense>

          <section className="serene-section">
            <div className="serene-form-actions serene-form-actions-fill">
              <button type="button" className="serene-btn-secondary min-h-11 w-full sm:w-auto" onClick={onCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="serene-btn-primary min-h-11 w-full sm:w-auto"
                onClick={() => setCurrentStep(2)}
                disabled={!canOpenSetupStep}
              >
                Next: Visa
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {visitedSteps[2] || currentStep === 2 ? (
        <div className={currentStep === 2 ? "space-y-6" : "hidden"} aria-hidden={currentStep !== 2}>
          <section className="serene-section p-5 sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary/85">Step 2 of 3</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-on-surface">
              Visa & Booking Setup
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant sm:text-base">
              Lengkapi visa, hotel agreement, raudhah, dan payment. Jika hotel agreement sudah siap, klik save untuk validasi lalu sync ke itinerary.
            </p>
          </section>

          <NewGroupScreen
            onSaveGroup={onSaveGroup}
            onCancel={onCancel}
            hideHeader
            hideGroupInformation
            hideFooterActions
            itineraryDraft={itineraryDraft}
            onItineraryPrefillChange={setItineraryPrefill}
            onSetupDraftChange={setSetupDraft}
          />

          <section className="serene-section">
            <div className="serene-form-actions-split serene-form-actions-fill">
              <button
                type="button"
                className="serene-btn-secondary min-h-11 w-full sm:w-auto"
                onClick={() => setCurrentStep(1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="serene-btn-primary min-h-11 w-full sm:w-auto"
                onClick={() => setCurrentStep(3)}
                disabled={!canOpenItineraryStep}
              >
                Next: Itinerary
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {visitedSteps[3] || currentStep === 3 ? (
        <div className={currentStep === 3 ? "space-y-6" : "hidden"} aria-hidden={currentStep !== 3}>
          <section className="serene-section p-5 sm:p-6">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary/85">Step 3 of 3</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-on-surface">
              Itinerary / Add Schedule
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant sm:text-base">
              Susun itinerary group. Setelah minimal satu itinerary terisi, group siap disimpan.
            </p>
          </section>

          <Suspense fallback={<ItinerarySectionFallback label="Loading itinerary schedule form..." />}>
            <LazyInputItineraryScreen
              onSaveGroup={onSaveGroup}
              hideHeader
              hideSaveAction
              sectionMode="schedule-only"
              identityDraft={identityDraft}
              itineraryPrefill={itineraryPrefill}
              emitIdentityInDraft={false}
              onItineraryDraftChange={setItineraryDetailDraft}
            />
          </Suspense>

          <section className="serene-section">
            <div className="serene-form-actions-split serene-form-actions-fill">
              <button
                type="button"
                className="serene-btn-secondary min-h-11 w-full sm:w-auto"
                onClick={() => setCurrentStep(2)}
              >
                Previous
              </button>
              <button
                type="button"
                className="serene-btn-primary min-h-11 w-full sm:w-auto"
                onClick={handleSaveWorkspaceGroup}
                disabled={!canSaveGroup}
              >
                Save Group
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
