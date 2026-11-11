import { createPortal } from "react-dom";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v4";
import { DatePickerInput, TimePickerInput } from "./date-time-pickers";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "./form-accessibility";
import { SereneSelect } from "./serene-select";
import { FlightAirportField } from "./flight-airport-field";
import { useModalFocusTrap } from "./use-modal-focus-trap";
import type { AgentOption } from "../hooks/use-agents-backend";
import { formatVisaDateWithYear } from "../shared/app-domain";
import type {
  VisaFlightDetailsInput,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaRaudhahEditFormState,
  VisaStatus,
} from "../shared/app-domain";
import { validateFlightDatesAgainstAgreement } from "../shared/visa-flight-date-validation";
import { createEmptyFlightLeg, getFlightLegsByDirection, normalizeFlightLegs } from "../shared/flight-plan";
import {
  addIsoDaysToDate,
  buildMirroredReturnLegs,
  computeAutoArrivalDate,
  diffIsoDays,
  extractCarrierAndFlightNumber,
  parseFlightScheduleText,
} from "../shared/flight-smart-paste";

const modalOverlayClassName = "serene-modal-overlay z-[120]";
const modalFieldClassName = "serene-field";
const modalInputClassName = "serene-input";
const modalSelectClassName = "serene-select";
const modalButtonClassName = "serene-btn-primary";
const modalCancelButtonClassName = "serene-btn-secondary";
const modalErrorClassName = "text-xs font-medium text-brand-tertiary";
const modalCloseButtonClassName = "serene-dialog-close-shell hover:border-primary";
const modalHeaderBarClassName = "serene-dialog-header shrink-0 bg-surface-container-low px-5 py-4";
const modalBodyClassName = "serene-dialog-body overflow-y-auto px-5 py-4";
const modalFooterBarClassName = "serene-dialog-footer-bar shrink-0 bg-surface-container-low";
const modalDashedCardClassName =
  "rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600";
const modalItemCardClassName = "rounded-2xl border border-slate-200 bg-surface-container-lowest p-3";

const syarikahModalSchema = z.object({
  value: z.string().trim().min(1, "Syarikah wajib diisi."),
});

const flightTimeSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || /^([01]\d|2[0-3]):[0-5]\d$/.test(value), "Format jam harus HH:mm.");

const flightDateSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || /^\d{4}-\d{2}-\d{2}$/.test(value), "Format tanggal tidak valid.");

function createFlightDetailsModalSchema(agreementStartDate?: string, agreementEndDate?: string) {
  return z
  .object({
    flightLegs: z.array(
      z.object({
        id: z.string().optional(),
        direction: z.enum(["ONWARD", "RETURN"]),
        sortOrder: z.number().int().min(0),
        departureAirportCode: z
          .string()
          .trim()
          .refine((value) => value.length === 0 || /^[A-Za-z]{3}$/.test(value), "Gunakan 3 huruf kode IATA."),
        arrivalAirportCode: z
          .string()
          .trim()
          .refine((value) => value.length === 0 || /^[A-Za-z]{3}$/.test(value), "Gunakan 3 huruf kode IATA."),
        departureDate: flightDateSchema,
        departureTime: flightTimeSchema,
        arrivalDate: flightDateSchema,
        arrivalTime: flightTimeSchema,
        carrierCode: z.string().trim(),
        flightNumber: z.string().trim(),
        remarks: z.string().trim(),
      }),
    ),
  })
  .superRefine((values, context) => {
    values.flightLegs.forEach((leg, index) => {
      const from = leg.departureAirportCode.trim().toUpperCase();
      const to = leg.arrivalAirportCode.trim().toUpperCase();
      if (from && to && from === to) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["flightLegs", index, "arrivalAirportCode"],
          message: "Bandara tujuan harus berbeda.",
        });
      }
      if (leg.departureDate && leg.arrivalDate) {
        const departureKey = `${leg.departureDate}T${leg.departureTime || "00:00"}`;
        const arrivalKey = `${leg.arrivalDate}T${leg.arrivalTime || "23:59"}`;
        if (arrivalKey < departureKey) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["flightLegs", index, "arrivalDate"],
            message: "Waktu tiba tidak boleh sebelum keberangkatan.",
          });
        }
      }
    });

    (["ONWARD", "RETURN"] as const).forEach((direction) => {
      const indexedLegs = values.flightLegs
        .map((leg, index) => ({ leg, index }))
        .filter(({ leg }) => leg.direction === direction)
        .sort((left, right) => left.leg.sortOrder - right.leg.sortOrder);
      indexedLegs.forEach(({ leg }, position) => {
        const next = indexedLegs[position + 1];
        const destination = leg.arrivalAirportCode.trim().toUpperCase();
        const nextOrigin = next?.leg.departureAirportCode.trim().toUpperCase() ?? "";
        if (next && destination && nextOrigin && destination !== nextOrigin) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["flightLegs", next.index, "departureAirportCode"],
            message: `Harus melanjutkan dari ${destination}.`,
          });
        }
      });
    });

    const onward = getFlightLegsByDirection(values.flightLegs, "ONWARD");
    const returning = getFlightLegsByDirection(values.flightLegs, "RETURN");
    const arrivalDate = onward.at(-1)?.arrivalDate || onward.at(-1)?.departureDate || "";
    const departureDate = returning[0]?.departureDate || returning[0]?.arrivalDate || "";

    const agreementErrors = validateFlightDatesAgainstAgreement({
      arrivalFlightDate: arrivalDate,
      departureFlightDate: departureDate,
      agreementStartDate,
      agreementEndDate,
    });
    if (agreementErrors.arrival) {
      const arrivalIndex = values.flightLegs.lastIndexOf(onward.at(-1)!);
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["flightLegs", Math.max(0, arrivalIndex), "arrivalDate"],
        message: agreementErrors.arrival,
      });
    }
    if (agreementErrors.departure) {
      const departureIndex = values.flightLegs.indexOf(returning[0]!);
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["flightLegs", Math.max(0, departureIndex), "departureDate"],
        message: agreementErrors.departure,
      });
    }
  });
}

const visaStatusModalSchema = z
  .object({
    value: z.enum(["Draft", "Pending", "Issued"]),
    issuedDateIso: z.string(),
  })
  .superRefine((values, context) => {
    // Only Issued carries a date; the other statuses clear it on save.
    if (values.value === "Issued" && values.issuedDateIso.trim().length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["issuedDateIso"],
        message: "Issued date wajib diisi.",
      });
    }
  });

const paymentStatusModalSchema = z.object({
  value: z.enum(["Paid", "Unpaid", "Partial"]),
});

const agentAssignmentModalSchema = z.object({
  agentId: z.string().trim().min(1, "Agent wajib dipilih."),
});

const hotelModalSchema = z
  .object({
    sourceDraftId: z.string().optional(),
    hotelName: z.string().trim().min(1, "Hotel name wajib diisi."),
    agreementNumber: z.string().trim().min(1, "Agreement number wajib diisi."),
    pax: z
      .string()
      .trim()
      .min(1, "Total pax wajib diisi.")
      .refine((value) => {
        const parsedValue = Number.parseInt(value, 10);
        return Number.isInteger(parsedValue) && parsedValue > 0;
      }, "Total pax harus lebih dari 0."),
    status: z.enum(["Waiting for Approval", "Approved", "Rejected"]),
    stayStartIso: z.string().trim().min(1, "Stay start date wajib diisi."),
    stayEndIso: z.string().trim().min(1, "Stay end date wajib diisi."),
  })
  .refine((values) => values.stayEndIso >= values.stayStartIso, {
    path: ["stayEndIso"],
    message: "Stay end date tidak boleh sebelum stay start date.",
  });

const raudhahModalSchema = z.object({
  appointments: z.array(
    z.object({
      id: z.string(),
      dateIso: z.string().trim().min(1, "Appointment date wajib diisi."),
      status: z.enum(["Free", "After", "Before"]),
      tasrehPrinted: z.boolean().optional(),
    }),
  ),
});

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

function ModalShell({
  title,
  description,
  icon,
  widthClassName = "max-w-2xl",
  onClose,
  children,
  footer,
}: {
  title: string;
  description: string;
  icon: string;
  widthClassName?: string;
  onClose: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });
  const titleId = useId();
  const descriptionId = useId();

  return (
    <ModalPortal>
      <div
        className={`${modalOverlayClassName} flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20`}
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          className={`serene-modal-shell flex max-h-[calc(100dvh-1.5rem)] w-full flex-col sm:max-h-[calc(100dvh-2rem)] ${widthClassName}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          <div className={modalHeaderBarClassName}>
            <div className="flex items-start gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <span className="material-symbols-outlined" aria-hidden="true">
                  {icon}
                </span>
              </div>

              <div>
                <h2 id={titleId} className="font-display text-2xl font-bold tracking-tight text-on-surface">
                  {title}
                </h2>
                <p id={descriptionId} className="mt-1 text-sm text-on-surface-variant">
                  {description}
                </p>
              </div>
            </div>

            <button
              type="button"
              className={modalCloseButtonClassName}
              onClick={onClose}
              aria-label={`Close ${title.toLowerCase()} popup`}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className={modalBodyClassName}>{children}</div>

          <div className={modalFooterBarClassName}>{footer}</div>
        </div>
      </div>
    </ModalPortal>
  );
}

function SaveFooter({
  onClose,
  onSave,
  saveLabel,
  isSaveDisabled = false,
  isSaving = false,
}: {
  onClose: () => void;
  onSave: () => void;
  saveLabel: string;
  isSaveDisabled?: boolean;
  isSaving?: boolean;
}) {
  return (
    <>
      <button type="button" className={modalButtonClassName} onClick={onSave} disabled={isSaveDisabled || isSaving}>
        <span className="material-symbols-outlined" aria-hidden="true">
          {isSaving ? "sync" : "check_circle"}
        </span>
        <span>{isSaving ? "Saving..." : saveLabel}</span>
      </button>
      {isSaving ? (
        <p className="sr-only" role="status" aria-live="polite">
          Saving changes.
        </p>
      ) : null}

      <button type="button" className={modalCancelButtonClassName} onClick={onClose}>
        Cancel
      </button>
    </>
  );
}

export function VisaStatusModal({
  initialValue,
  initialIssuedDateIso = "",
  todayIso,
  onClose,
  onSave,
}: {
  initialValue: VisaStatus;
  initialIssuedDateIso?: string;
  todayIso: string;
  onClose: () => void;
  onSave: (nextValue: VisaStatus, issuedDateIso: string) => void | Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<{ value: VisaStatus; issuedDateIso: string }>({
    resolver: zodResolver(visaStatusModalSchema),
    defaultValues: {
      value: initialValue,
      // Prefill today so marking a visa Issued stays a single click, while still
      // letting the user backdate a visa that was issued earlier.
      issuedDateIso: initialIssuedDateIso.trim() || todayIso,
    },
  });

  const selectedStatus = watch("value");
  const issuedDateErrorMessage = errors.issuedDateIso?.message;

  return (
    <ModalShell
      title="Edit Visa Status"
      description="Update the visa approval status for this group."
      icon="verified_user"
      onClose={onClose}
      footer={
        <SaveFooter
          onClose={onClose}
          onSave={() =>
            void handleSubmit(({ value, issuedDateIso }) =>
              // Non-issued statuses have no issued date to carry.
              void onSave(value, value === "Issued" ? issuedDateIso : ""),
            )()
          }
          saveLabel="Save Changes"
          isSaving={isSubmitting}
        />
      }
    >
      <label className={modalFieldClassName}>
        <span>Visa Status</span>
        <div className="relative">
          <Controller
            control={control}
            name="value"
            render={({ field }) => (
              <SereneSelect
                className={modalSelectClassName}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              >
                <option value="Draft">Draft</option>
                <option value="Pending">Pending</option>
                <option value="Issued">Issued</option>
              </SereneSelect>
            )}
          />
        </div>
      </label>

      {selectedStatus === "Issued" ? (
        <>
          <label className={modalFieldClassName}>
            <span>Issued Date</span>
            <Controller
              control={control}
              name="issuedDateIso"
              render={({ field }) => (
                <DatePickerInput
                  id="visa-status-issued-date"
                  inputClassName={modalInputClassName}
                  value={field.value}
                  onChange={field.onChange}
                  ariaInvalid={getFieldAriaInvalid(issuedDateErrorMessage)}
                  ariaDescribedBy={getFieldDescribedBy("visa-status-issued-date", {
                    errorMessage: issuedDateErrorMessage,
                  })}
                />
              )}
            />
          </label>
          <FieldErrorMessage
            fieldId="visa-status-issued-date"
            message={issuedDateErrorMessage}
            className={modalErrorClassName}
          />
        </>
      ) : null}
    </ModalShell>
  );
}

export function PaymentStatusModal({
  initialValue,
  onClose,
  onSave,
}: {
  initialValue: VisaPaymentStatus;
  onClose: () => void;
  onSave: (nextValue: VisaPaymentStatus) => void | Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ value: VisaPaymentStatus }>({
    resolver: zodResolver(paymentStatusModalSchema),
    defaultValues: {
      value: initialValue,
    },
  });

  return (
    <ModalShell
      title="Edit Payment Status"
      description="Update the payment progress for this group."
      icon="payments"
      onClose={onClose}
      footer={
        <SaveFooter
          onClose={onClose}
          onSave={() => void handleSubmit(({ value }) => void onSave(value))()}
          saveLabel="Save Changes"
          isSaving={isSubmitting}
        />
      }
    >
      <label className={modalFieldClassName}>
        <span>Payment Status</span>
        <div className="relative">
          <Controller
            control={control}
            name="value"
            render={({ field }) => (
              <SereneSelect
                className={modalSelectClassName}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
              >
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partial">Partial</option>
              </SereneSelect>
            )}
          />
        </div>
      </label>
    </ModalShell>
  );
}

export function SyarikahModal({
  initialValue,
  muassasahOptions = [],
  isLoading = false,
  loadError,
  onClose,
  onSave,
}: {
  initialValue: string;
  muassasahOptions?: Array<{ id: string; name: string; isActive?: boolean }>;
  isLoading?: boolean;
  loadError?: string;
  onClose: () => void;
  onSave: (nextValue: string) => void | Promise<void>;
}) {
  const normalizedInitial =
    initialValue.trim() &&
    initialValue.trim().toLowerCase() !== "not assigned" &&
    initialValue.trim() !== "-" &&
    initialValue.trim().toLowerCase() !== "pending provider selection"
      ? initialValue.trim()
      : "";

  const resolvedOptions = useMemo(() => {
    const active = muassasahOptions.filter((item) => item.isActive !== false);
    if (
      normalizedInitial &&
      !active.some((item) => item.name.toLowerCase() === normalizedInitial.toLowerCase())
    ) {
      return [{ id: normalizedInitial, name: normalizedInitial, isActive: true }, ...active];
    }
    return active;
  }, [muassasahOptions, normalizedInitial]);

  const matchedInitialValue =
    resolvedOptions.find((item) => item.name.toLowerCase() === normalizedInitial.toLowerCase())?.name ??
    normalizedInitial;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ value: string }>({
    resolver: zodResolver(syarikahModalSchema),
    defaultValues: {
      value: matchedInitialValue,
    },
  });
  const valueErrorMessage = errors.value?.message;
  const options = [
    <option key="empty" value="" disabled>
      {isLoading ? "Loading muassasah..." : "Select Muassasah"}
    </option>,
    ...resolvedOptions.map((item) => (
      <option key={item.id} value={item.name}>
        {item.name}
      </option>
    )),
  ];

  return (
    <ModalShell
      title="Edit Syarikah"
      description="Update the provider agency used for visa coordination."
      icon="business"
      onClose={onClose}
      footer={
        <SaveFooter
          onClose={onClose}
          onSave={() => void handleSubmit(({ value }) => void onSave(value.trim()))()}
          saveLabel="Save Changes"
          isSaveDisabled={isLoading}
          isSaving={isSubmitting}
        />
      }
    >
      <label className={modalFieldClassName}>
        <span>Syarikah / Provider Agency</span>
        <div className="relative">
          <Controller
            control={control}
            name="value"
            render={({ field }) => (
              <SereneSelect
                id="visa-syarikah"
                className={modalSelectClassName}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                disabled={isLoading}
                searchable
                searchPlaceholder="Cari nama muassasah..."
                aria-invalid={getFieldAriaInvalid(valueErrorMessage)}
                aria-describedby={getFieldDescribedBy("visa-syarikah", {
                  errorMessage: valueErrorMessage,
                })}
              >
                {options}
              </SereneSelect>
            )}
          />
        </div>
      </label>
      <FieldErrorMessage fieldId="visa-syarikah" message={valueErrorMessage} className={modalErrorClassName} />
      {loadError ? <p className={modalErrorClassName}>{loadError}</p> : null}
    </ModalShell>
  );
}

function FlightLegRoute({ control, index }: { control: Control<VisaFlightDetailsInput>; index: number }) {
  const [departure, arrival, carrierCode, flightNumber] = useWatch({
    control,
    name: [
      `flightLegs.${index}.departureAirportCode`,
      `flightLegs.${index}.arrivalAirportCode`,
      `flightLegs.${index}.carrierCode`,
      `flightLegs.${index}.flightNumber`,
    ],
    exact: true,
  });
  const resolvedFlightBadge = flightNumber?.trim().toUpperCase() || carrierCode?.trim().toUpperCase() || "";
  return (
    <span className="inline-flex items-center gap-2 truncate text-sm font-extrabold text-slate-800">
      <span>
        {departure?.toUpperCase() || "FROM"}
        <span className="mx-2 text-slate-400">→</span>
        {arrival?.toUpperCase() || "TO"}
      </span>
      {resolvedFlightBadge ? (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-600">
          {resolvedFlightBadge}
        </span>
      ) : null}
    </span>
  );
}

const ORIGIN_QUICK_AIRPORTS = ["CGK", "SUB", "KNO", "UPG", "DOH", "DXB"] as const;
const SAUDI_AND_TRANSIT_QUICK_AIRPORTS = ["JED", "MED", "DOH", "DXB", "AUH"] as const;

function FlightArrivalDateControl({
  control,
  setValue,
  index,
  errorMessage,
}: {
  control: Control<VisaFlightDetailsInput>;
  setValue: UseFormSetValue<VisaFlightDetailsInput>;
  index: number;
  errorMessage?: string;
}) {
  const [departureDate, arrivalDate] = useWatch({
    control,
    name: [`flightLegs.${index}.departureDate`, `flightLegs.${index}.arrivalDate`],
    exact: true,
  });
  const dayOffset = departureDate && arrivalDate ? diffIsoDays(departureDate, arrivalDate) : 0;
  const [customExpanded, setCustomExpanded] = useState(false);
  const showDatePicker =
    customExpanded ||
    Boolean(errorMessage) ||
    (!departureDate && Boolean(arrivalDate)) ||
    (dayOffset !== null && dayOffset !== 0 && dayOffset !== 1);

  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[10px] font-bold text-slate-500">Tiba:</span>
        <button
          type="button"
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold transition ${
            !showDatePicker && (dayOffset === 0 || !arrivalDate)
              ? "bg-brand-primary text-white"
              : "bg-slate-100 text-slate-600 hover:bg-brand-primary/10 hover:text-brand-primary"
          }`}
          onClick={() => {
            setCustomExpanded(false);
            if (departureDate) {
              setValue(`flightLegs.${index}.arrivalDate`, departureDate, { shouldDirty: true, shouldValidate: true });
            }
          }}
        >
          Hari sama
        </button>
        <button
          type="button"
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold transition ${
            !showDatePicker && dayOffset === 1
              ? "bg-brand-primary text-white"
              : "bg-slate-100 text-slate-600 hover:bg-brand-primary/10 hover:text-brand-primary"
          }`}
          onClick={() => {
            setCustomExpanded(false);
            if (departureDate) {
              setValue(`flightLegs.${index}.arrivalDate`, addIsoDaysToDate(departureDate, 1), {
                shouldDirty: true,
                shouldValidate: true,
              });
            }
          }}
        >
          +1 hari
        </button>
        <button
          type="button"
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold transition ${
            showDatePicker
              ? "bg-brand-primary/15 text-brand-primary"
              : "bg-slate-100 text-slate-600 hover:bg-brand-primary/10 hover:text-brand-primary"
          }`}
          onClick={() => setCustomExpanded((prev) => !prev)}
        >
          {arrivalDate && dayOffset !== 0 && dayOffset !== 1 ? formatVisaDateWithYear(arrivalDate) : "Pilih tgl"}
        </button>
      </div>
      {showDatePicker ? (
        <Controller
          control={control}
          name={`flightLegs.${index}.arrivalDate`}
          render={({ field: pickerField }) => (
            <DatePickerInput
              id={`flight-leg-${index}-arrival-date`}
              inputClassName={modalInputClassName}
              value={pickerField.value}
              onChange={pickerField.onChange}
              ariaInvalid={getFieldAriaInvalid(errorMessage)}
              ariaDescribedBy={getFieldDescribedBy(`flight-leg-${index}-arrival-date`, {
                errorMessage,
              })}
            />
          )}
        />
      ) : null}
      <FieldErrorMessage
        fieldId={`flight-leg-${index}-arrival-date`}
        message={errorMessage}
        className={modalErrorClassName}
      />
    </div>
  );
}

export function FlightDetailsModal({
  initialValue,
  agreementStartDate,
  agreementEndDate,
  defaultOnwardDate,
  defaultReturnDate,
  copySourceFlight,
  onClose,
  onSave,
}: {
  initialValue: VisaFlightDetailsInput;
  agreementStartDate?: string;
  agreementEndDate?: string;
  defaultOnwardDate?: string;
  defaultReturnDate?: string;
  copySourceFlight?: { groupCode: string; flight: VisaFlightDetailsInput };
  onClose: () => void;
  onSave: (flight: VisaFlightDetailsInput) => void | Promise<void>;
}) {
  const resolvedOnwardDate = defaultOnwardDate || agreementStartDate || "";
  const resolvedReturnDate = defaultReturnDate || agreementEndDate || "";

  const schema = useMemo(
    () => createFlightDetailsModalSchema(agreementStartDate, agreementEndDate),
    [agreementStartDate, agreementEndDate],
  );
  const {
    register,
    control,
    getValues,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VisaFlightDetailsInput>({
    resolver: zodResolver(schema),
    defaultValues: initialValue,
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: "flightLegs" });

  const [smartPasteText, setSmartPasteText] = useState("");
  const [smartPasteFeedback, setSmartPasteFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  const ensureDefaultDateIfEmpty = (index: number, direction: "ONWARD" | "RETURN") => {
    const currentLeg = getValues(`flightLegs.${index}`);
    if (!currentLeg || currentLeg.departureDate || currentLeg.arrivalDate) return;
    const fallbackDate = direction === "ONWARD" ? resolvedOnwardDate : resolvedReturnDate;
    if (!fallbackDate) return;
    setValue(`flightLegs.${index}.departureDate`, fallbackDate, { shouldDirty: true });
    setValue(
      `flightLegs.${index}.arrivalDate`,
      computeAutoArrivalDate(fallbackDate, currentLeg.departureTime, currentLeg.arrivalTime),
      { shouldDirty: true },
    );
  };

  const syncAutoArrivalDate = (index: number, nextDepDate?: string, nextDepTime?: string, nextArrTime?: string) => {
    const currentLeg = getValues(`flightLegs.${index}`);
    if (!currentLeg) return;
    const depDate = nextDepDate ?? currentLeg.departureDate;
    const depTime = nextDepTime ?? currentLeg.departureTime;
    const arrTime = nextArrTime ?? currentLeg.arrivalTime;
    if (!depDate) return;
    const computed = computeAutoArrivalDate(depDate, depTime, arrTime);
    if (computed) {
      setValue(`flightLegs.${index}.arrivalDate`, computed, { shouldDirty: true });
    }
  };

  const handleApplySmartPaste = () => {
    const parsedLegs = parseFlightScheduleText(smartPasteText, {
      defaultOnwardDate: resolvedOnwardDate,
      defaultReturnDate: resolvedReturnDate,
    });
    if (parsedLegs.length === 0) {
      setSmartPasteFeedback({
        tone: "error",
        message: "Format belum dikenali. Contoh: GA980 12NOV CGK-JED 11:50 17:40",
      });
      return;
    }

    const currentLegs = getValues("flightLegs");
    const parsedOnward = getFlightLegsByDirection(parsedLegs, "ONWARD");
    const parsedReturn = getFlightLegsByDirection(parsedLegs, "RETURN");
    const existingOnward = getFlightLegsByDirection(currentLegs, "ONWARD");
    const existingReturn = getFlightLegsByDirection(currentLegs, "RETURN");

    const nextLegs = [
      ...(parsedOnward.length > 0
        ? parsedOnward
        : existingOnward.length > 0
          ? existingOnward
          : [createEmptyFlightLeg("ONWARD")]),
      ...(parsedReturn.length > 0
        ? parsedReturn
        : existingReturn.length > 0
          ? existingReturn
          : [createEmptyFlightLeg("RETURN")]),
    ];

    replace(nextLegs);
    setSmartPasteFeedback({
      tone: "success",
      message: `Berhasil mengisi ${parsedLegs.length} segmen penerbangan dari teks.`,
    });
  };

  const handleMirrorFromOnward = () => {
    const currentLegs = getValues("flightLegs");
    const mirroredReturn = buildMirroredReturnLegs(currentLegs, resolvedReturnDate);
    if (mirroredReturn.length === 0) return;
    const onwardLegs = getFlightLegsByDirection(currentLegs, "ONWARD");
    replace([...(onwardLegs.length > 0 ? onwardLegs : [createEmptyFlightLeg("ONWARD")]), ...mirroredReturn]);
    setSmartPasteFeedback({
      tone: "success",
      message: "Rute Return berhasil dibalik dari Onward.",
    });
  };

  const handleCopyFromGroup = () => {
    if (!copySourceFlight) return;
    replace(copySourceFlight.flight.flightLegs);
    setSmartPasteFeedback({
      tone: "success",
      message: `Jadwal penerbangan disalin dari grup ${copySourceFlight.groupCode}.`,
    });
  };

  const addLeg = (direction: "ONWARD" | "RETURN") => {
    const directionLegs = getFlightLegsByDirection(getValues("flightLegs"), direction);
    const previous = directionLegs.at(-1);
    const fallbackDate =
      previous?.arrivalDate ||
      previous?.departureDate ||
      (direction === "ONWARD" ? resolvedOnwardDate : resolvedReturnDate);
    append({
      ...createEmptyFlightLeg(direction, directionLegs.length),
      departureAirportCode: previous?.arrivalAirportCode ?? "",
      departureDate: fallbackDate,
      arrivalDate: fallbackDate,
      carrierCode: previous?.carrierCode ?? "",
    });
  };

  const renderDirection = (direction: "ONWARD" | "RETURN", title: string, description: string) => {
    const indexes = fields.flatMap((field, index) => (field.direction === direction ? [index] : []));
    const isTransit = indexes.length > 1;
    const defaultDirectionDate = direction === "ONWARD" ? resolvedOnwardDate : resolvedReturnDate;

    return (
      <fieldset className={direction === "RETURN" ? "border-t border-slate-200 pt-5" : ""}>
        <legend className="sr-only">{title}</legend>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-xl text-brand-primary" aria-hidden="true">
                {direction === "ONWARD" ? "flight_takeoff" : "flight_land"}
              </span>
              <h3 className="text-base font-extrabold text-slate-900">{title}</h3>
              {indexes.length > 0 ? (
                <span className="rounded-full bg-brand-primary/10 px-2 py-1 text-[11px] font-extrabold text-brand-primary">
                  {isTransit ? `${indexes.length} segmen · Transit` : "1 segmen"}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-medium text-slate-600">{description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {direction === "RETURN" ? (
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 transition hover:border-brand-primary/40 hover:bg-brand-primary/5 hover:text-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
                onClick={handleMirrorFromOnward}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">sync</span>
                Balik rute Onward
              </button>
            ) : null}
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-extrabold text-brand-primary transition hover:bg-brand-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
              onClick={() => addLeg(direction)}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">add</span>
              {indexes.length === 0 ? "Tambah penerbangan" : "Tambah transit"}
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {indexes.length === 0 ? (
            <div className="py-5 text-center text-sm font-medium text-slate-500">
              Belum ada segmen penerbangan.
            </div>
          ) : null}
          {indexes.map((index, position) => {
            const legErrors = errors.flightLegs?.[index];
            const field = fields[index];
            const isOriginAirport =
              (direction === "ONWARD" && position === 0) ||
              (direction === "RETURN" && position === indexes.length - 1);
            const fromQuickCodes =
              direction === "ONWARD" && position === 0 ? ORIGIN_QUICK_AIRPORTS : SAUDI_AND_TRANSIT_QUICK_AIRPORTS;
            const toQuickCodes =
              direction === "RETURN" && position === indexes.length - 1
                ? ORIGIN_QUICK_AIRPORTS
                : SAUDI_AND_TRANSIT_QUICK_AIRPORTS;

            return (
              <div key={field.id} className="py-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-primary/10 text-xs font-black text-brand-primary">
                      {position + 1}
                    </span>
                    <FlightLegRoute control={control} index={index} />
                  </div>
                  <button
                    type="button"
                    className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
                    onClick={() => remove(index)}
                    aria-label={`Hapus segmen ${position + 1} ${title}`}
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                  </button>
                </div>

                <input type="hidden" {...register(`flightLegs.${index}.direction`)} />
                <input type="hidden" value={position} {...register(`flightLegs.${index}.sortOrder`, { valueAsNumber: true })} />
                <input type="hidden" {...register(`flightLegs.${index}.carrierCode`)} />

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                  <div className={`${modalFieldClassName} lg:col-span-2`}>
                    <label htmlFor={`flight-leg-${index}-departure-date`}>Tanggal berangkat</label>
                    <Controller
                      control={control}
                      name={`flightLegs.${index}.departureDate`}
                      render={({ field: pickerField }) => (
                        <>
                          <DatePickerInput
                            id={`flight-leg-${index}-departure-date`}
                            inputClassName={modalInputClassName}
                            value={pickerField.value}
                            onChange={(nextDate) => {
                              pickerField.onChange(nextDate);
                              syncAutoArrivalDate(index, nextDate);
                            }}
                            ariaInvalid={getFieldAriaInvalid(legErrors?.departureDate?.message)}
                            ariaDescribedBy={getFieldDescribedBy(`flight-leg-${index}-departure-date`, {
                              errorMessage: legErrors?.departureDate?.message,
                            })}
                          />
                          {position === 0 && defaultDirectionDate && pickerField.value !== defaultDirectionDate ? (
                            <button
                              type="button"
                              className="mt-1 self-start rounded-md bg-brand-primary/10 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-primary transition hover:bg-brand-primary/20"
                              onClick={() => {
                                pickerField.onChange(defaultDirectionDate);
                                syncAutoArrivalDate(index, defaultDirectionDate);
                              }}
                            >
                              Gunakan {formatVisaDateWithYear(defaultDirectionDate)}
                            </button>
                          ) : null}
                        </>
                      )}
                    />
                    <FieldErrorMessage fieldId={`flight-leg-${index}-departure-date`} message={legErrors?.departureDate?.message} className={modalErrorClassName} />
                  </div>

                  <Controller
                    control={control}
                    name={`flightLegs.${index}.departureAirportCode`}
                    render={({ field: airportField }) => (
                      <FlightAirportField
                        id={`flight-leg-${index}-from`}
                        label="From"
                        accessibleLabel={`From ${title} segmen ${position + 1}`}
                        value={airportField.value}
                        onChange={(nextCode) => {
                          airportField.onChange(nextCode);
                          if (nextCode) ensureDefaultDateIfEmpty(index, direction);
                        }}
                        onBlur={airportField.onBlur}
                        inputRef={airportField.ref}
                        quickCodes={fromQuickCodes}
                        preferCustomWhenEmpty={direction === "ONWARD" && position === 0 && isOriginAirport}
                        errorMessage={legErrors?.departureAirportCode?.message}
                      />
                    )}
                  />

                  <Controller
                    control={control}
                    name={`flightLegs.${index}.arrivalAirportCode`}
                    render={({ field: airportField }) => (
                      <FlightAirportField
                        id={`flight-leg-${index}-to`}
                        label="To"
                        accessibleLabel={`To ${title} segmen ${position + 1}`}
                        value={airportField.value}
                        onChange={(nextCode) => {
                          airportField.onChange(nextCode);
                          if (nextCode) ensureDefaultDateIfEmpty(index, direction);
                        }}
                        onBlur={airportField.onBlur}
                        inputRef={airportField.ref}
                        quickCodes={toQuickCodes}
                        preferCustomWhenEmpty={direction === "RETURN" && position === indexes.length - 1 && isOriginAirport}
                        errorMessage={legErrors?.arrivalAirportCode?.message}
                      />
                    )}
                  />

                  <label className={`${modalFieldClassName} lg:col-span-2`}>
                    <span>Flight no.</span>
                    <Controller
                      control={control}
                      name={`flightLegs.${index}.flightNumber`}
                      render={({ field: flightField }) => (
                        <input
                          className={`${modalInputClassName} uppercase`}
                          placeholder="GA-980 / SV817"
                          value={flightField.value}
                          onChange={(event) => {
                            const raw = event.target.value.toUpperCase();
                            flightField.onChange(raw);
                            const { carrierCode } = extractCarrierAndFlightNumber(
                              raw,
                              getValues(`flightLegs.${index}.carrierCode`),
                            );
                            if (carrierCode) {
                              setValue(`flightLegs.${index}.carrierCode`, carrierCode, { shouldDirty: true });
                            }
                            if (raw.trim()) {
                              ensureDefaultDateIfEmpty(index, direction);
                            }
                          }}
                          onBlur={() => {
                            const { carrierCode, flightNumber } = extractCarrierAndFlightNumber(
                              flightField.value,
                              getValues(`flightLegs.${index}.carrierCode`),
                            );
                            if (flightNumber && flightNumber !== flightField.value) {
                              flightField.onChange(flightNumber);
                            }
                            if (carrierCode) {
                              setValue(`flightLegs.${index}.carrierCode`, carrierCode, { shouldDirty: true });
                            }
                            flightField.onBlur();
                          }}
                        />
                      )}
                    />
                  </label>

                  <label className={`${modalFieldClassName} lg:col-span-1`}>
                    <span>ETD</span>
                    <Controller
                      control={control}
                      name={`flightLegs.${index}.departureTime`}
                      render={({ field: pickerField }) => (
                        <TimePickerInput
                          id={`flight-leg-${index}-etd`}
                          inputClassName={modalInputClassName}
                          value={pickerField.value}
                          onChange={(nextTime) => {
                            pickerField.onChange(nextTime);
                            syncAutoArrivalDate(index, undefined, nextTime, undefined);
                          }}
                          ariaInvalid={getFieldAriaInvalid(legErrors?.departureTime?.message)}
                          ariaDescribedBy={getFieldDescribedBy(`flight-leg-${index}-etd`, {
                            errorMessage: legErrors?.departureTime?.message,
                          })}
                        />
                      )}
                    />
                    <FieldErrorMessage fieldId={`flight-leg-${index}-etd`} message={legErrors?.departureTime?.message} className={modalErrorClassName} />
                  </label>

                  <div className={`${modalFieldClassName} lg:col-span-2`}>
                    <label htmlFor={`flight-leg-${index}-eta`}>ETA</label>
                    <Controller
                      control={control}
                      name={`flightLegs.${index}.arrivalTime`}
                      render={({ field: pickerField }) => (
                        <TimePickerInput
                          id={`flight-leg-${index}-eta`}
                          inputClassName={modalInputClassName}
                          value={pickerField.value}
                          onChange={(nextTime) => {
                            pickerField.onChange(nextTime);
                            syncAutoArrivalDate(index, undefined, undefined, nextTime);
                          }}
                          ariaInvalid={getFieldAriaInvalid(legErrors?.arrivalTime?.message)}
                          ariaDescribedBy={getFieldDescribedBy(`flight-leg-${index}-eta`, {
                            errorMessage: legErrors?.arrivalTime?.message,
                          })}
                        />
                      )}
                    />
                    <FieldErrorMessage fieldId={`flight-leg-${index}-eta`} message={legErrors?.arrivalTime?.message} className={modalErrorClassName} />
                    <FlightArrivalDateControl
                      control={control}
                      setValue={setValue}
                      index={index}
                      errorMessage={legErrors?.arrivalDate?.message}
                    />
                  </div>

                  <label className={`${modalFieldClassName} lg:col-span-1`}>
                    <span>Catatan</span>
                    <input className={modalInputClassName} placeholder="Opsional" {...register(`flightLegs.${index}.remarks`)} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
    );
  };

  return (
    <ModalShell
      title="Detail Penerbangan"
      description="Susun rute penerbangan internasional direct atau transit per segmen."
      icon="flight"
      widthClassName="max-w-6xl"
      onClose={onClose}
      footer={
        <SaveFooter
          onClose={onClose}
          onSave={() =>
            void handleSubmit((values) => void onSave({ flightLegs: normalizeFlightLegs(values.flightLegs) }))()
          }
          saveLabel="Save Changes"
          isSaving={isSubmitting}
        />
      }
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="flight-smart-paste-input" className="text-xs font-extrabold text-slate-800">
              Isi Cepat dari Teks Tiket / PNR / WhatsApp
            </label>
            {copySourceFlight ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 self-start rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-2.5 py-1 text-xs font-extrabold text-brand-primary transition hover:bg-brand-primary/20"
                onClick={handleCopyFromGroup}
              >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">sync</span>
                Salin dari {copySourceFlight.groupCode}
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <textarea
              id="flight-smart-paste-input"
              aria-label="Tempel jadwal tiket atau PNR"
              rows={2}
              value={smartPasteText}
              onChange={(event) => setSmartPasteText(event.target.value)}
              placeholder={"Tempel teks tiket/PNR di sini, contoh:\nGA980 12NOV CGK-JED 11:50 17:40\nGA981 20NOV JED-CGK 19:40 09:50+1"}
              className="serene-input min-h-[3.25rem] flex-1 resize-y py-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={handleApplySmartPaste}
              disabled={!smartPasteText.trim()}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-xs font-extrabold text-white transition hover:bg-brand-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">check_circle</span>
              Terapkan jadwal
            </button>
          </div>
          {smartPasteFeedback ? (
            <p
              className={`mt-2 text-xs font-semibold ${
                smartPasteFeedback.tone === "success" ? "text-emerald-700" : "text-brand-tertiary"
              }`}
              role="status"
            >
              {smartPasteFeedback.message}
            </p>
          ) : null}
        </div>

        {renderDirection("ONWARD", "Onward", "Penerbangan dari Indonesia menuju Arab Saudi.")}
        {renderDirection("RETURN", "Return", "Penerbangan dari Arab Saudi kembali ke Indonesia.")}
      </div>
    </ModalShell>
  );
}

export function AgentAssignmentModal({
  initialValue,
  agents,
  isLoading = false,
  loadError,
  onClose,
  onSave,
}: {
  initialValue: string;
  agents: AgentOption[];
  isLoading?: boolean;
  loadError?: string;
  onClose: () => void;
  onSave: (agentId: string) => void | Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<{ agentId: string }>({
    resolver: zodResolver(agentAssignmentModalSchema),
    defaultValues: { agentId: initialValue },
  });
  const agentErrorMessage = errors.agentId?.message;
  const saveErrorMessage = errors.root?.message;
  const options = [
    <option key="empty" value="" disabled>
      {isLoading ? "Loading agents..." : "Select Agent"}
    </option>,
    ...agents.map((agent) => (
      <option key={agent.id} value={agent.id}>
        {agent.name}{agent.status === "INACTIVE" ? " (Inactive)" : ""}
      </option>
    )),
  ];

  const submit = handleSubmit(async ({ agentId }) => {
    try {
      await onSave(agentId);
    } catch (error: unknown) {
      setError("root", {
        message: error instanceof Error ? error.message : "Agent belum berhasil diperbarui.",
      });
    }
  });

  return (
    <ModalShell
      title={initialValue ? "Edit Agent" : "Assign Agent"}
      description="Choose the agent responsible for this visa group."
      icon="business"
      widthClassName="max-w-lg"
      onClose={onClose}
      footer={
        <SaveFooter
          onClose={onClose}
          onSave={() => void submit()}
          saveLabel={initialValue ? "Save Changes" : "Assign Agent"}
          isSaveDisabled={isLoading || agents.length === 0}
          isSaving={isSubmitting}
        />
      }
    >
      <label className={modalFieldClassName}>
        <span>Agent</span>
        <div className="relative">
          <Controller
            control={control}
            name="agentId"
            render={({ field }) => (
              <SereneSelect
                className={modalSelectClassName}
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                disabled={isLoading}
                searchable
                searchPlaceholder="Cari nama agent..."
                aria-invalid={getFieldAriaInvalid(agentErrorMessage)}
                aria-describedby={getFieldDescribedBy("visa-agent", { errorMessage: agentErrorMessage })}
              >
                {options}
              </SereneSelect>
            )}
          />
        </div>
      </label>
      <FieldErrorMessage fieldId="visa-agent" message={agentErrorMessage} className={modalErrorClassName} />
      {loadError ? <p className={modalErrorClassName}>{loadError}</p> : null}
      {saveErrorMessage ? (
        <p className={modalErrorClassName} role="alert">
          {saveErrorMessage}
        </p>
      ) : null}
    </ModalShell>
  );
}

export function VisaHotelModal({
  city,
  mode,
  initialValue,
  onClose,
  onSave,
}: {
  city: "makkah" | "madinah";
  mode: "add" | "edit";
  initialValue: VisaHotelEditFormState;
  onClose: () => void;
  onSave: (values: VisaHotelEditFormState) => void | Promise<void>;
}) {
  const cityLabel = city === "makkah" ? "Makkah" : "Madinah";
  const isAddMode = mode === "add";
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VisaHotelEditFormState>({
    resolver: zodResolver(hotelModalSchema),
    defaultValues: initialValue,
  });
  const hotelNameErrorMessage = errors.hotelName?.message;
  const agreementNumberErrorMessage = errors.agreementNumber?.message;
  const paxErrorMessage = errors.pax?.message;
  const statusErrorMessage = errors.status?.message;
  const stayStartErrorMessage = errors.stayStartIso?.message;
  const stayEndErrorMessage = errors.stayEndIso?.message;

  return (
    <ModalShell
      title={`${isAddMode ? "Add" : "Edit"} ${cityLabel} Hotel`}
      description={
        isAddMode
          ? `Create a new ${cityLabel.toLowerCase()} hotel agreement for this group.`
          : `Update the ${cityLabel.toLowerCase()} hotel agreement for this group.`
      }
      icon="hotel"
      widthClassName="max-w-3xl"
      onClose={onClose}
      footer={
        <SaveFooter
          onClose={onClose}
          onSave={() => void handleSubmit((values) => void onSave(values))()}
          saveLabel={isAddMode ? "Add Hotel" : "Save Changes"}
          isSaving={isSubmitting}
        />
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        <input type="hidden" {...register("sourceDraftId")} />
        <label className={modalFieldClassName}>
          <span>Hotel Name</span>
          <input
            id="visa-hotel-name"
            className={modalInputClassName}
            type="text"
            placeholder={`e.g. ${cityLabel} Hotel`}
            {...register("hotelName")}
            aria-invalid={getFieldAriaInvalid(hotelNameErrorMessage)}
            aria-describedby={getFieldDescribedBy("visa-hotel-name", {
              errorMessage: hotelNameErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId="visa-hotel-name" message={hotelNameErrorMessage} className={modalErrorClassName} />

        <label className={modalFieldClassName}>
          <span>Agreement Number</span>
          <input
            id="visa-hotel-agreement-number"
            className={modalInputClassName}
            type="text"
            placeholder="2026xxxxxxxxxxxxx"
            {...register("agreementNumber")}
            aria-invalid={getFieldAriaInvalid(agreementNumberErrorMessage)}
            aria-describedby={getFieldDescribedBy("visa-hotel-agreement-number", {
              errorMessage: agreementNumberErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage
          fieldId="visa-hotel-agreement-number"
          message={agreementNumberErrorMessage}
          className={modalErrorClassName}
        />

        <label className={modalFieldClassName}>
          <span>Total Pax</span>
          <input
            id="visa-hotel-pax"
            className={modalInputClassName}
            type="number"
            min={1}
            placeholder="70"
            {...register("pax")}
            aria-invalid={getFieldAriaInvalid(paxErrorMessage)}
            aria-describedby={getFieldDescribedBy("visa-hotel-pax", {
              errorMessage: paxErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId="visa-hotel-pax" message={paxErrorMessage} className={modalErrorClassName} />

        <label className={modalFieldClassName}>
          <span>Approval Status</span>
          <div className="relative">
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <SereneSelect
                  className={modalSelectClassName}
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  aria-invalid={getFieldAriaInvalid(statusErrorMessage)}
                  aria-describedby={getFieldDescribedBy("visa-hotel-status", {
                    errorMessage: statusErrorMessage,
                  })}
                >
                  <option value="Waiting for Approval">Waiting for Approval</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </SereneSelect>
              )}
            />
          </div>
        </label>
        <FieldErrorMessage fieldId="visa-hotel-status" message={statusErrorMessage} className={modalErrorClassName} />

        <div className="grid gap-3 md:grid-cols-2 md:col-span-2">
          <label className={modalFieldClassName}>
            <span>Stay Start Date</span>
            <Controller
              control={control}
              name="stayStartIso"
              render={({ field }) => (
                <DatePickerInput
                  id="visa-hotel-stay-start"
                  inputClassName={modalInputClassName}
                  value={field.value}
                  onChange={field.onChange}
                  ariaInvalid={getFieldAriaInvalid(stayStartErrorMessage)}
                  ariaDescribedBy={getFieldDescribedBy("visa-hotel-stay-start", {
                    errorMessage: stayStartErrorMessage,
                  })}
                />
              )}
            />
          </label>
          <FieldErrorMessage
            fieldId="visa-hotel-stay-start"
            message={stayStartErrorMessage}
            className={modalErrorClassName}
          />

          <label className={modalFieldClassName}>
            <span>Stay End Date</span>
            <Controller
              control={control}
              name="stayEndIso"
              render={({ field }) => (
                <DatePickerInput
                  id="visa-hotel-stay-end"
                  inputClassName={modalInputClassName}
                  value={field.value}
                  onChange={field.onChange}
                  ariaInvalid={getFieldAriaInvalid(stayEndErrorMessage)}
                  ariaDescribedBy={getFieldDescribedBy("visa-hotel-stay-end", {
                    errorMessage: stayEndErrorMessage,
                  })}
                />
              )}
            />
          </label>
          <FieldErrorMessage
            fieldId="visa-hotel-stay-end"
            message={stayEndErrorMessage}
            className={modalErrorClassName}
          />
        </div>
      </div>
    </ModalShell>
  );
}

export function VisaRaudhahModal({
  initialValue,
  appointmentIdPrefix,
  defaultAppointmentDateIso,
  onClose,
  onSave,
}: {
  initialValue: VisaRaudhahEditFormState;
  appointmentIdPrefix: string;
  defaultAppointmentDateIso: string;
  onClose: () => void;
  onSave: (values: VisaRaudhahEditFormState) => void | Promise<void>;
}) {
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VisaRaudhahEditFormState>({
    resolver: zodResolver(raudhahModalSchema),
    defaultValues: initialValue,
  });
  const { fields, append, remove } = useFieldArray({
    control,
    name: "appointments",
    keyName: "fieldId",
  });

  return (
    <ModalShell
      title="Edit Raudhah"
      description="Set target Raudhah dates. Nusuk booking opens only on H-7 and H-2 for each target date."
      icon="calendar_month"
      onClose={onClose}
      footer={
        <SaveFooter
          onClose={onClose}
          onSave={() => void handleSubmit((values) => void onSave(values))()}
          saveLabel="Save Changes"
          isSaving={isSubmitting}
        />
      }
    >
      <div className="space-y-3">
        {fields.length === 0 ? (
          <div className={modalDashedCardClassName}>
            Belum ada target tanggal Raudhah. Klik tombol "Add Date" untuk menambahkan target date.
          </div>
        ) : null}

        {fields.map((appointment, index) => (
          <div key={appointment.fieldId} className={modalItemCardClassName}>
            <input type="hidden" {...register(`appointments.${index}.id`)} />
            <input type="hidden" {...register(`appointments.${index}.tasrehPrinted`)} />
            <div className="mb-2 flex items-center justify-between gap-2">
              <strong className="text-sm text-slate-800">Appointment {index + 1}</strong>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                onClick={() => remove(index)}
                aria-label={`Remove Raudhah appointment ${index + 1}`}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  delete
                </span>
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className={modalFieldClassName}>
                <span>Appointment Date</span>
                <Controller
                  control={control}
                  name={`appointments.${index}.dateIso`}
                  render={({ field }) => (
                    <DatePickerInput
                      id={`visa-raudhah-date-${index}`}
                      inputClassName={modalInputClassName}
                      value={field.value}
                      onChange={field.onChange}
                      ariaInvalid={getFieldAriaInvalid(errors.appointments?.[index]?.dateIso?.message)}
                      ariaDescribedBy={getFieldDescribedBy(`visa-raudhah-date-${index}`, {
                        errorMessage: errors.appointments?.[index]?.dateIso?.message,
                      })}
                    />
                  )}
                />
              </label>
              <FieldErrorMessage
                fieldId={`visa-raudhah-date-${index}`}
                message={errors.appointments?.[index]?.dateIso?.message}
                className={modalErrorClassName}
              />

              <label className={modalFieldClassName}>
                <span>Appointment Tone</span>
                <div className="relative">
                  <Controller
                    control={control}
                    name={`appointments.${index}.status`}
                    render={({ field }) => (
                      <SereneSelect
                        className={modalSelectClassName}
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                      >
                        <option value="Free">Free / Not Set</option>
                        <option value="Before">Before 13:00</option>
                        <option value="After">After 13:00</option>
                      </SereneSelect>
                    )}
                  />
                </div>
              </label>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          onClick={() =>
            append({
              id: `${appointmentIdPrefix}-raudhah-draft-${Date.now().toString(36)}-${fields.length + 1}`,
              dateIso: defaultAppointmentDateIso,
              status: "After",
              tasrehPrinted: false,
            })
          }
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            add
          </span>
          <span>Add Date</span>
        </button>
      </div>
    </ModalShell>
  );
}

const visaTypeModalSchema = z.object({
  value: z.enum(["Visa Only", "Visa+"]),
});

export function VisaTypeModal({
  initialValue,
  onClose,
  onSave,
}: {
  initialValue: "Visa Only" | "Visa+";
  onClose: () => void;
  onSave: (nextValue: "Visa Only" | "Visa+") => void | Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ value: "Visa Only" | "Visa+" }>({
    resolver: zodResolver(visaTypeModalSchema),
    defaultValues: {
      value: initialValue,
    },
  });

  return (
    <ModalShell
      title="Edit Visa Type"
      description="Update the visa service type for this group."
      icon="fact_check"
      onClose={onClose}
      footer={
        <SaveFooter
          onClose={onClose}
          onSave={() => void handleSubmit(({ value }) => void onSave(value))()}
          saveLabel="Save Changes"
          isSaving={isSubmitting}
        />
      }
    >
      <label className={modalFieldClassName}>
        <span>Visa Type</span>
        <div className="relative">
          <Controller
            control={control}
            name="value"
            render={({ field }) => (
              <SereneSelect
                className={modalSelectClassName}
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
    </ModalShell>
  );
}
