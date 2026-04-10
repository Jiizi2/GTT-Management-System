import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DatePickerInput } from "./date-time-pickers";
import { SereneSelect } from "./serene-select";
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

const syarikahModalSchema = z.object({
  value: z.string().trim().min(1, "Syarikah wajib diisi."),
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
    status: z.enum(["Waiting for Approval", "Approved"]),
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
  return (
    <ModalPortal>
      <div className={`${modalOverlayClassName} flex items-center justify-center overflow-y-auto p-3 sm:p-4`} onClick={onClose}>
        <div
          className={`serene-modal-shell flex max-h-[calc(100dvh-1.5rem)] w-full flex-col sm:max-h-[calc(100dvh-2rem)] ${widthClassName}`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 bg-surface-container-low px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <span className="material-symbols-outlined" aria-hidden="true">
                  {icon}
                </span>
              </div>

              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-on-surface">{title}</h2>
                <p className="mt-1 text-sm text-on-surface-variant">{description}</p>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant transition hover:text-primary"
              onClick={onClose}
              aria-label={`Close ${title.toLowerCase()} popup`}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className="space-y-4 overflow-y-auto px-5 py-4">{children}</div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 bg-surface-container-low px-5 py-4">
            {footer}
          </div>
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
      <button
        type="button"
        className={modalButtonClassName}
        onClick={onSave}
        disabled={isSaveDisabled || isSaving}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          check_circle
        </span>
        <span>{saveLabel}</span>
      </button>

      <button type="button" className={modalCancelButtonClassName} onClick={onClose}>
        Cancel
      </button>
    </>
  );
}

export function VisaStatusModal({
  value,
  onChange,
  onClose,
  onSave,
}: {
  value: VisaStatus;
  onChange: (nextValue: VisaStatus) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalShell
      title="Edit Visa Status"
      description="Update the visa approval status for this group."
      icon="verified_user"
      onClose={onClose}
      footer={<SaveFooter onClose={onClose} onSave={onSave} saveLabel="Save Changes" />}
    >
      <label className={modalFieldClassName}>
        <span>Visa Status</span>
        <div className="relative">
          <SereneSelect
            className={modalSelectClassName}
            value={value}
            onChange={(event) => onChange(event.target.value as VisaStatus)}
          >
            <option value="Draft">Draft</option>
            <option value="Pending">Pending</option>
            <option value="Issued">Issued</option>
          </SereneSelect>
        </div>
      </label>
    </ModalShell>
  );
}

export function PaymentStatusModal({
  value,
  onChange,
  onClose,
  onSave,
}: {
  value: VisaPaymentStatus;
  onChange: (nextValue: VisaPaymentStatus) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <ModalShell
      title="Edit Payment Status"
      description="Update the payment progress for this group."
      icon="payments"
      onClose={onClose}
      footer={<SaveFooter onClose={onClose} onSave={onSave} saveLabel="Save Changes" />}
    >
      <label className={modalFieldClassName}>
        <span>Payment Status</span>
        <div className="relative">
          <SereneSelect
            className={modalSelectClassName}
            value={value}
            onChange={(event) => onChange(event.target.value as VisaPaymentStatus)}
          >
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
            <option value="Partial">Partial</option>
          </SereneSelect>
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

  return (
    <ModalShell
      title="Edit Syarikah"
      description="Update the provider agency used for visa coordination."
      icon="business"
      onClose={onClose}
      footer={
        <SaveFooter
          onClose={onClose}
          onSave={() =>
            void handleSubmit(({ value }) => void onSave(value.trim()))()
          }
          saveLabel="Save Changes"
          isSaving={isSubmitting}
        />
      }
    >
      <label className={modalFieldClassName}>
        <span>Syarikah / Provider Agency</span>
        <input
          className={modalInputClassName}
          type="text"
          placeholder="e.g. Al-Tayyar"
          {...register("value")}
        />
      </label>
      {errors.value ? <p className="text-xs font-medium text-brand-tertiary">{errors.value.message}</p> : null}
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
            className={modalInputClassName}
            type="text"
            placeholder={`e.g. ${cityLabel} Hotel`}
            {...register("hotelName")}
          />
        </label>
        {errors.hotelName ? <p className="text-xs font-medium text-brand-tertiary">{errors.hotelName.message}</p> : null}

        <label className={modalFieldClassName}>
          <span>Agreement Number</span>
          <input
            className={modalInputClassName}
            type="text"
            placeholder="2026xxxxxxxxxxxxx"
            {...register("agreementNumber")}
          />
        </label>
        {errors.agreementNumber ? (
          <p className="text-xs font-medium text-brand-tertiary">{errors.agreementNumber.message}</p>
        ) : null}

        <label className={modalFieldClassName}>
          <span>Total Pax</span>
          <input
            className={modalInputClassName}
            type="number"
            min={1}
            placeholder="70"
            {...register("pax")}
          />
        </label>
        {errors.pax ? <p className="text-xs font-medium text-brand-tertiary">{errors.pax.message}</p> : null}

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
                >
                  <option value="Waiting for Approval">Waiting for Approval</option>
                  <option value="Approved">Approved</option>
                </SereneSelect>
              )}
            />
          </div>
        </label>
        {errors.status ? <p className="text-xs font-medium text-brand-tertiary">{errors.status.message}</p> : null}

        <div className="grid gap-3 md:grid-cols-2 md:col-span-2">
          <label className={modalFieldClassName}>
            <span>Stay Start Date</span>
            <Controller
              control={control}
              name="stayStartIso"
              render={({ field }) => (
                <DatePickerInput
                  inputClassName={modalInputClassName}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </label>
          {errors.stayStartIso ? (
            <p className="text-xs font-medium text-brand-tertiary">{errors.stayStartIso.message}</p>
          ) : null}

          <label className={modalFieldClassName}>
            <span>Stay End Date</span>
            <Controller
              control={control}
              name="stayEndIso"
              render={({ field }) => (
                <DatePickerInput
                  inputClassName={modalInputClassName}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </label>
          {errors.stayEndIso ? (
            <p className="text-xs font-medium text-brand-tertiary">{errors.stayEndIso.message}</p>
          ) : null}
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
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Belum ada target tanggal Raudhah. Klik tombol "Add Date" untuk menambahkan target date.
          </div>
        ) : null}

        {fields.map((appointment, index) => (
          <div
            key={appointment.fieldId}
            className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-3"
          >
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
                      inputClassName={modalInputClassName}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </label>
              {errors.appointments?.[index]?.dateIso ? (
                <p className="text-xs font-medium text-brand-tertiary">
                  {errors.appointments[index]?.dateIso?.message}
                </p>
              ) : null}

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

