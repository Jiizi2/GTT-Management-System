import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import * as Domain from "../shared/app-domain";
import { DatePickerInput } from "../components/date-time-pickers";
import { SereneSelect } from "../components/serene-select";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { useThemeMode } from "../theme/theme-provider";
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
import { InputItineraryScreen } from "./add-group-workspace-page";
import {
  buildAgreementItineraryPrefill,
  buildNewGroupPayload,
  validateConnectedAgreementDates,
} from "./new-group-screen-helpers";

const { createNewGroupAgreementForm, createNewGroupRaudhahForm, getMinimumBusCountForPax, resolveVisaAgreementNumber } =
  Domain;

type HotelCity = "makkah" | "madinah";
type InvoiceTone = "paid" | "pending" | "overdue" | "cancelled";
type VisaServiceOption = "Visa Only" | BusStatus;

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

function toCityLabel(city: HotelCity): string {
  return city === "makkah" ? "Makkah" : "Madinah";
}

function getInvoiceToneClasses(tone: InvoiceTone): string {
  if (tone === "cancelled") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  if (tone === "paid") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (tone === "pending") {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }

  return "border-rose-200 bg-rose-100 text-rose-700";
}

function getInvoiceToneDotClasses(tone: InvoiceTone): string {
  if (tone === "cancelled") {
    return "border-slate-400 bg-slate-500";
  }

  if (tone === "paid") {
    return "border-emerald-400 bg-emerald-500";
  }

  if (tone === "pending") {
    return "border-amber-400 bg-amber-500";
  }

  return "border-rose-400 bg-rose-500";
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

  const itineraryGroupCode = itineraryDraft?.groupCode?.trim().toUpperCase() ?? "";
  const itineraryGroupName = itineraryDraft?.groupName?.trim() ?? "";
  const itineraryPax = itineraryDraft?.pax;
  const groupNumber = watch("groupNumber");
  const groupName = watch("groupName");
  const totalPax = watch("totalPax");
  const visaStatus = watch("visaStatus");
  const busStatus = watch("busStatus");
  const paymentStatus = watch("paymentStatus");
  const watchedMakkahHotels = watch("makkahHotels");
  const watchedMadinahHotels = watch("madinahHotels");
  const makkahHotels = useMemo(() => watchedMakkahHotels ?? [], [watchedMakkahHotels]);
  const madinahHotels = useMemo(() => watchedMadinahHotels ?? [], [watchedMadinahHotels]);
  const raudhahDates = watch("raudhahDates") ?? [];
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
  const isSaveDisabled =
    !resolvedGroupCode ||
    !resolvedGroupName ||
    !hasValidPax ||
    agreementDateConnection.hasWarning ||
    (requireItineraryBeforeSave && !hasItineraryDraft);

  const handleAgreementChange = <Key extends keyof NewGroupAgreementFormState>(
    city: HotelCity,
    agreementIndex: number,
    field: Key,
    value: NewGroupAgreementFormState[Key],
  ) => {
    const currentAgreements = city === "makkah" ? makkahHotels : madinahHotels;
    const nextAgreements = currentAgreements.map((agreement, index) =>
      index === agreementIndex ? { ...agreement, [field]: value } : agreement,
    );
    setValue(city === "makkah" ? "makkahHotels" : "madinahHotels", nextAgreements, {
      shouldDirty: true,
    });
  };

  const handleAddAgreement = (city: HotelCity) => {
    if (city === "makkah") {
      appendMakkahHotel(createNewGroupAgreementForm(city));
      return;
    }

    appendMadinahHotel(createNewGroupAgreementForm(city));
  };

  const handleRemoveAgreement = (city: HotelCity, agreementIndex: number) => {
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

  const handleSyncAgreementDatesToSchedule = () => {
    if (!onItineraryPrefillChange || agreementDateConnection.hasWarning) {
      return;
    }

    onItineraryPrefillChange(buildAgreementItineraryPrefill(makkahHotels, madinahHotels));
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
        makkahHotels,
        madinahHotels,
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
        <span className="material-symbols-outlined text-emerald-700" aria-hidden="true">
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

              {agreements.length > 1 ? (
                <button
                  type="button"
                  className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-error-container px-3 py-1.5 text-xs font-semibold text-on-error-container transition hover:brightness-95"
                  onClick={() => handleRemoveAgreement(city, index)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    delete
                  </span>
                  <span>Remove Hotel {index + 1}</span>
                </button>
              ) : null}
            </div>
          </details>
        ))}
      </div>

      {agreementDateConnection.cityWarnings[city] ? (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-tertiary-fixed px-3 py-2 text-sm text-on-tertiary-fixed-variant">
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
                    className={controlClassName}
                    type="text"
                    {...register("groupNumber")}
                    placeholder="e.g. 901794508"
                  />
                  {errors.groupNumber ? (
                    <p className="text-xs font-semibold text-error">{errors.groupNumber.message}</p>
                  ) : null}
                </label>
                <label className={fieldClassName}>
                  <span>Total Pax</span>
                  <input
                    className={controlClassName}
                    type="number"
                    min={1}
                    {...register("totalPax")}
                    placeholder="45"
                  />
                  {errors.totalPax ? (
                    <p className="text-xs font-semibold text-error">{errors.totalPax.message}</p>
                  ) : null}
                </label>
                <label className={`${fieldClassName} md:col-span-2`}>
                  <span>Group Name</span>
                  <input
                    className={controlClassName}
                    type="text"
                    {...register("groupName")}
                    placeholder="e.g. FEB 25 - Group 3"
                  />
                  {errors.groupName ? (
                    <p className="text-xs font-semibold text-error">{errors.groupName.message}</p>
                  ) : null}
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
                <input
                  className={controlClassName}
                  type="text"
                  {...register("syarikahName")}
                  placeholder="Enter syarikah name"
                />
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
            <div className="mb-4 flex items-start gap-2 rounded-md bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant">
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
          <div className="mt-4 flex justify-stretch sm:justify-end">
            <button
              type="button"
              className="serene-btn-secondary min-h-10 w-full sm:w-auto"
              onClick={handleSyncAgreementDatesToSchedule}
              disabled={!onItineraryPrefillChange || agreementDateConnection.hasWarning}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                sync
              </span>
              <span>Sync to Itinerary</span>
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
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                  paymentStatus === "Unpaid"
                    ? `${getInvoiceToneClasses(getPaymentStatusTone("Unpaid"))} shadow-sm`
                    : "border-transparent text-on-surface-variant hover:border-slate-200 hover:bg-surface-container-lowest"
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
                    : "border-transparent text-on-surface-variant hover:border-slate-200 hover:bg-surface-container-lowest"
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

        <footer className="flex flex-wrap items-center justify-end gap-2">
          {requireItineraryBeforeSave && !hasItineraryDraft ? (
            <p className="w-full text-sm font-medium text-amber-700">
              <span className="sm:hidden">Isi Add Schedule dulu untuk mengaktifkan Save.</span>
              <span className="hidden sm:inline">
                Isi itinerary di bagian Add Schedule terlebih dahulu untuk mengaktifkan Save Group.
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
  const { theme } = useThemeMode();
  const isDarkMode = theme === "dark";
  const [isItineraryVisible, setIsItineraryVisible] = useState(true);
  const [identityDraft, setIdentityDraft] = useState<NewGroupItineraryDraft | null>(null);
  const [itineraryDetailDraft, setItineraryDetailDraft] = useState<NewGroupItineraryDraft | null>(null);
  const [itineraryPrefill, setItineraryPrefill] = useState<ItineraryPrefill | null>(null);

  const itineraryDraft =
    identityDraft || itineraryDetailDraft
      ? {
          ...(identityDraft ?? {}),
          ...(itineraryDetailDraft ?? {}),
        }
      : null;

  const itineraryIdentitySectionTop = (
    <InputItineraryScreen
      onSaveGroup={onSaveGroup}
      hideHeader
      hideSaveAction
      sectionMode="identity-only"
      onItineraryDraftChange={setIdentityDraft}
    />
  );

  const itineraryScheduleSectionBottom = (
    <>
      <section className="serene-section">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-on-surface">Add Schedule</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              <span className="sm:hidden">Lengkapi itinerary setelah Visa.</span>
              <span className="hidden sm:inline">Lengkapi itinerary setelah Visa Information.</span>
            </p>
          </div>
          <button
            type="button"
            className="serene-btn-secondary min-h-10 w-full sm:w-auto"
            onClick={() => setIsItineraryVisible((current) => !current)}
            aria-expanded={isItineraryVisible}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {isItineraryVisible ? "expand_less" : "expand_more"}
            </span>
            <span className="sm:hidden">{isItineraryVisible ? "Hide Form" : "Add Detail"}</span>
            <span className="hidden sm:inline">
              {isItineraryVisible ? "Hide Schedule Form" : "Add Schedule Detail"}
            </span>
          </button>
        </div>
      </section>

      {isItineraryVisible ? (
        <InputItineraryScreen
          onSaveGroup={onSaveGroup}
          hideHeader
          hideSaveAction
          sectionMode="schedule-only"
          identityDraft={identityDraft}
          itineraryPrefill={itineraryPrefill}
          emitIdentityInDraft={false}
          onItineraryDraftChange={setItineraryDetailDraft}
        />
      ) : null}
    </>
  );

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
          <span className="hidden sm:inline">Back to Overview</span>
        </button>

        <ThemeToggleButton className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:border-primary/45 hover:text-primary sm:ml-auto sm:mr-5" />
      </div>

      <section className="serene-section p-5 sm:p-6">
        <div>
          <p
            className={`text-xs font-extrabold uppercase tracking-[0.16em] ${isDarkMode ? "text-primary/85" : "text-emerald-700/80"}`}
          >
            Group Workspace
          </p>
          <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl lg:text-4xl">
            Add New Group
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant sm:text-base">
            <span className="sm:hidden">Semua kebutuhan group dalam satu alur.</span>
            <span className="hidden sm:inline">Semua kebutuhan pembuatan group dan itinerary ada dalam satu alur.</span>
          </p>
        </div>
      </section>

      <NewGroupScreen
        onSaveGroup={onSaveGroup}
        onCancel={onCancel}
        hideHeader
        itineraryDraft={itineraryDraft}
        itinerarySectionTop={itineraryIdentitySectionTop}
        itinerarySectionBottom={itineraryScheduleSectionBottom}
        hideGroupInformation
        requireItineraryBeforeSave
        onItineraryPrefillChange={setItineraryPrefill}
      />
    </div>
  );
}
