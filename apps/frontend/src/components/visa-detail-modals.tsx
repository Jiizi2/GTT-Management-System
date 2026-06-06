import { createPortal } from "react-dom";
import { type ReactNode, useId } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v4";
import { DatePickerInput } from "./date-time-pickers";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "./form-accessibility";
import { SereneSelect } from "./serene-select";
import { useModalFocusTrap } from "./use-modal-focus-trap";
import type {
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaRaudhahEditFormState,
  VisaStatus,
} from "../shared/app-domain";

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
const modalInfoCardClassName = "serene-dialog-section text-sm text-on-surface-variant";
const modalDashedCardClassName =
  "rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600";
const modalItemCardClassName = "rounded-2xl border border-slate-200 bg-surface-container-lowest p-3";

const syarikahModalSchema = z.object({
  value: z.string().trim().min(1, "Syarikah wajib diisi."),
});

const visaStatusModalSchema = z.object({
  value: z.enum(["Draft", "Pending", "Issued"]),
});

const paymentStatusModalSchema = z.object({
  value: z.enum(["Paid", "Unpaid", "Partial"]),
});

const hotelModalSchema = z
  .object({
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
        className={`${modalOverlayClassName} flex items-center justify-center overflow-y-auto p-3 sm:p-4`}
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
  onClose,
  onSave,
}: {
  initialValue: VisaStatus;
  onClose: () => void;
  onSave: (nextValue: VisaStatus) => void | Promise<void>;
}) {
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<{ value: VisaStatus }>({
    resolver: zodResolver(visaStatusModalSchema),
    defaultValues: {
      value: initialValue,
    },
  });

  return (
    <ModalShell
      title="Edit Visa Status"
      description="Update the visa approval status for this group."
      icon="verified_user"
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
  onClose,
  onSave,
}: {
  initialValue: string;
  onClose: () => void;
  onSave: (nextValue: string) => void | Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ value: string }>({
    resolver: zodResolver(syarikahModalSchema),
    defaultValues: {
      value: initialValue,
    },
  });
  const valueErrorMessage = errors.value?.message;

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
          isSaving={isSubmitting}
        />
      }
    >
      <label className={modalFieldClassName}>
        <span>Syarikah / Provider Agency</span>
        <input
          id="visa-syarikah"
          className={modalInputClassName}
          type="text"
          placeholder="e.g. Al-Tayyar"
          {...register("value")}
          aria-invalid={getFieldAriaInvalid(valueErrorMessage)}
          aria-describedby={getFieldDescribedBy("visa-syarikah", {
            errorMessage: valueErrorMessage,
          })}
        />
      </label>
      <FieldErrorMessage fieldId="visa-syarikah" message={valueErrorMessage} className={modalErrorClassName} />
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
