import { type ReactNode, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Controller, type Control, type FieldErrors, type UseFormRegister, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v4";
import { DatePickerInput } from "../components/date-time-pickers";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../components/form-accessibility";
import { SereneSelect } from "../components/serene-select";
import { useModalFocusTrap } from "../components/use-modal-focus-trap";
import {
  assignAgreementDraftInBackend,
  deleteAgreementDraftInBackend,
  saveAgreementDraftInBackend,
  useAgreementDraftsQuery,
  type AgreementDraftStatusFilter,
} from "../hooks/use-agreement-drafts-query";
import {
  formatVisaDateWithYear,
  getLocalIsoDateWithOffset,
  type HotelAgreementDraft,
  type HotelAgreementDraftFormState,
} from "../shared/app-domain";
import { agreementDraftQueryKeys, groupQueryKeys } from "../shared/query-keys";

const draftSchema = z
  .object({
    city: z.enum(["makkah", "madinah"]),
    agentName: z.string(),
    hotelName: z.string().trim().min(1, "Hotel name wajib diisi."),
    agreementNumber: z.string().trim().min(1, "Agreement number wajib diisi."),
    pax: z
      .string()
      .trim()
      .min(1, "Pax wajib diisi.")
      .refine((value) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isInteger(parsed) && parsed > 0;
      }, "Pax harus lebih dari 0."),
    status: z.enum(["Waiting for Approval", "Approved"]),
    stayStartIso: z.string().trim().min(1, "Stay start wajib diisi."),
    stayEndIso: z.string().trim().min(1, "Stay end wajib diisi."),
    notes: z.string(),
  })
  .refine((values) => values.stayEndIso >= values.stayStartIso, {
    path: ["stayEndIso"],
    message: "Stay end tidak boleh sebelum stay start.",
  });

const fieldClassName = "flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-slate-700";
const inputClassName =
  "h-11 w-full rounded-xl border border-slate-300 bg-surface-container-lowest px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";
const textareaClassName =
  "min-h-24 w-full rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

function createDefaultDraftForm(): HotelAgreementDraftFormState {
  return {
    city: "makkah",
    agentName: "",
    hotelName: "",
    agreementNumber: "",
    pax: "1",
    status: "Waiting for Approval",
    stayStartIso: getLocalIsoDateWithOffset(0),
    stayEndIso: getLocalIsoDateWithOffset(1),
    notes: "",
  };
}

function formatMutationError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback;
}

function formatDraftDateTime(value: string): string {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAssignmentBadgeClasses(draft: HotelAgreementDraft): string {
  return draft.assignmentStatus === "Assigned"
    ? "border-brand-primary/25 bg-brand-primary/12 text-brand-primary"
    : "border-amber-200 bg-amber-100 text-amber-800";
}

function getApprovalBadgeClasses(draft: HotelAgreementDraft): string {
  return draft.status === "Approved"
    ? "border-brand-primary/25 bg-brand-primary/12 text-brand-primary"
    : "border-slate-200 bg-slate-50 text-slate-700";
}

function toDraftFormState(draft: HotelAgreementDraft): HotelAgreementDraftFormState {
  return {
    city: draft.city,
    agentName: draft.agentName,
    hotelName: draft.hotelName,
    agreementNumber: draft.agreementNumber,
    pax: draft.pax.toString(),
    status: draft.status,
    stayStartIso: draft.stayStartIso,
    stayEndIso: draft.stayEndIso,
    notes: draft.notes,
  };
}

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
}

function AgreementDraftFields({
  control,
  register,
  errors,
  idPrefix,
}: {
  control: Control<HotelAgreementDraftFormState>;
  register: UseFormRegister<HotelAgreementDraftFormState>;
  errors: FieldErrors<HotelAgreementDraftFormState>;
  idPrefix: string;
}) {
  const cityErrorMessage = errors.city?.message;
  const agentNameErrorMessage = errors.agentName?.message;
  const hotelNameErrorMessage = errors.hotelName?.message;
  const agreementNumberErrorMessage = errors.agreementNumber?.message;
  const paxErrorMessage = errors.pax?.message;
  const statusErrorMessage = errors.status?.message;
  const stayStartErrorMessage = errors.stayStartIso?.message;
  const stayEndErrorMessage = errors.stayEndIso?.message;

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className="grid gap-1.5 lg:col-span-3">
        <label className={fieldClassName}>
          <span>City</span>
          <Controller
            control={control}
            name="city"
            render={({ field }) => (
              <SereneSelect
                id={`${idPrefix}-city`}
                className="serene-select"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                aria-invalid={getFieldAriaInvalid(cityErrorMessage)}
                aria-describedby={getFieldDescribedBy(`${idPrefix}-city`, {
                  errorMessage: cityErrorMessage,
                })}
              >
                <option value="makkah">Makkah</option>
                <option value="madinah">Madinah</option>
              </SereneSelect>
            )}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-city`} message={cityErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-3">
        <label className={fieldClassName}>
          <span>Agent Name</span>
          <input
            id={`${idPrefix}-agent`}
            type="text"
            className={inputClassName}
            placeholder="Optional"
            {...register("agentName")}
            aria-invalid={getFieldAriaInvalid(agentNameErrorMessage)}
            aria-describedby={getFieldDescribedBy(`${idPrefix}-agent`, {
              errorMessage: agentNameErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-agent`} message={agentNameErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-6">
        <label className={fieldClassName}>
          <span>Hotel Name</span>
          <input
            id={`${idPrefix}-hotel`}
            type="text"
            className={inputClassName}
            placeholder="Swissotel Al Maqam"
            {...register("hotelName")}
            aria-invalid={getFieldAriaInvalid(hotelNameErrorMessage)}
            aria-describedby={getFieldDescribedBy(`${idPrefix}-hotel`, {
              errorMessage: hotelNameErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-hotel`} message={hotelNameErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-5">
        <label className={fieldClassName}>
          <span>Agreement Number</span>
          <input
            id={`${idPrefix}-number`}
            type="text"
            className={inputClassName}
            placeholder="2026xxxxxxxxxxxxx"
            {...register("agreementNumber")}
            aria-invalid={getFieldAriaInvalid(agreementNumberErrorMessage)}
            aria-describedby={getFieldDescribedBy(`${idPrefix}-number`, {
              errorMessage: agreementNumberErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-number`} message={agreementNumberErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-2">
        <label className={fieldClassName}>
          <span>Pax</span>
          <input
            id={`${idPrefix}-pax`}
            type="number"
            min={1}
            className={inputClassName}
            {...register("pax")}
            aria-invalid={getFieldAriaInvalid(paxErrorMessage)}
            aria-describedby={getFieldDescribedBy(`${idPrefix}-pax`, {
              errorMessage: paxErrorMessage,
            })}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-pax`} message={paxErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-3">
        <label className={fieldClassName}>
          <span>Approval Status</span>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SereneSelect
                id={`${idPrefix}-status`}
                className="serene-select"
                value={field.value}
                onChange={(event) => field.onChange(event.target.value)}
                aria-invalid={getFieldAriaInvalid(statusErrorMessage)}
                aria-describedby={getFieldDescribedBy(`${idPrefix}-status`, {
                  errorMessage: statusErrorMessage,
                })}
              >
                <option value="Waiting for Approval">Waiting for Approval</option>
                <option value="Approved">Approved</option>
              </SereneSelect>
            )}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-status`} message={statusErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-2">
        <label className={fieldClassName}>
          <span>Stay Start</span>
          <Controller
            control={control}
            name="stayStartIso"
            render={({ field }) => (
              <DatePickerInput
                id={`${idPrefix}-stay-start`}
                inputClassName={inputClassName}
                value={field.value}
                onChange={field.onChange}
                ariaInvalid={getFieldAriaInvalid(stayStartErrorMessage)}
                ariaDescribedBy={getFieldDescribedBy(`${idPrefix}-stay-start`, {
                  errorMessage: stayStartErrorMessage,
                })}
              />
            )}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-stay-start`} message={stayStartErrorMessage} />
      </div>

      <div className="grid gap-1.5 lg:col-span-2">
        <label className={fieldClassName}>
          <span>Stay End</span>
          <Controller
            control={control}
            name="stayEndIso"
            render={({ field }) => (
              <DatePickerInput
                id={`${idPrefix}-stay-end`}
                inputClassName={inputClassName}
                value={field.value}
                onChange={field.onChange}
                ariaInvalid={getFieldAriaInvalid(stayEndErrorMessage)}
                ariaDescribedBy={getFieldDescribedBy(`${idPrefix}-stay-end`, {
                  errorMessage: stayEndErrorMessage,
                })}
              />
            )}
          />
        </label>
        <FieldErrorMessage fieldId={`${idPrefix}-stay-end`} message={stayEndErrorMessage} />
      </div>

      <label className={`${fieldClassName} lg:col-span-12`}>
        <span>Notes</span>
        <textarea className={textareaClassName} placeholder="Optional notes" {...register("notes")} />
      </label>
    </div>
  );
}

function AgreementDraftEditModal({
  draft,
  isSaving,
  onClose,
  onSave,
}: {
  draft: HotelAgreementDraft;
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: HotelAgreementDraftFormState) => void | Promise<void>;
}) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });
  const titleId = useId();
  const descriptionId = useId();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<HotelAgreementDraftFormState>({
    resolver: zodResolver(draftSchema),
    defaultValues: toDraftFormState(draft),
  });
  const isBusy = isSaving || isSubmitting;

  return (
    <ModalPortal>
      <div
        className="serene-modal-overlay z-[130] flex items-center justify-center overflow-y-auto p-3 sm:p-4"
        onClick={onClose}
      >
        <section
          ref={dialogRef}
          className="serene-modal-shell flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col sm:max-h-[calc(100dvh-2rem)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="serene-dialog-header shrink-0 bg-surface-container-low px-5 py-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <span className="material-symbols-outlined" aria-hidden="true">
                  edit
                </span>
              </span>
              <div className="min-w-0">
                <h2 id={titleId} className="font-display text-2xl font-bold tracking-tight text-on-surface">
                  Edit Draft Agreement
                </h2>
                <p id={descriptionId} className="mt-1 break-words text-sm text-on-surface-variant">
                  Update agreement {draft.agreementNumber}.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="serene-dialog-close-shell hover:border-primary"
              onClick={onClose}
              aria-label="Close edit agreement popup"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <form
            className="serene-dialog-body overflow-y-auto px-5 py-4"
            onSubmit={handleSubmit((values) => void onSave(values))}
          >
            <AgreementDraftFields
              control={control}
              register={register}
              errors={errors}
              idPrefix={`agreement-draft-edit-${draft.id}`}
            />

            <div className="serene-dialog-footer-bar -mx-5 -mb-4 mt-5 bg-surface-container-low">
              <button type="submit" className="serene-btn-primary" disabled={isBusy}>
                <span className="material-symbols-outlined" aria-hidden="true">
                  {isBusy ? "sync" : "check_circle"}
                </span>
                <span>{isBusy ? "Saving..." : "Save Changes"}</span>
              </button>
              <button type="button" className="serene-btn-secondary" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      </div>
    </ModalPortal>
  );
}

function DeleteAgreementDraftModal({
  draft,
  isDeleting,
  onClose,
  onConfirm,
}: {
  draft: HotelAgreementDraft;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });
  const titleId = useId();
  const descriptionId = useId();

  return (
    <ModalPortal>
      <div className="serene-modal-overlay z-[130] flex items-center justify-center p-4" onClick={onClose}>
        <section
          ref={dialogRef}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-surface-container-lowest p-5 shadow-2xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined rounded-full bg-rose-100 p-2 text-rose-700" aria-hidden="true">
              warning
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-extrabold text-slate-900">
                Delete Agreement?
              </h2>
              <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-slate-600">
                Draft agreement <strong>{draft.agreementNumber}</strong> untuk hotel <strong>{draft.hotelName}</strong>{" "}
                akan dihapus dari inbox.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-surface-container-high"
              onClick={onClose}
            >
              Batal
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={onConfirm}
              disabled={isDeleting}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                {isDeleting ? "sync" : "delete"}
              </span>
              <span>{isDeleting ? "Deleting..." : "Delete Agreement"}</span>
            </button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}

export function AgreementInboxScreen() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const linkedGroupCode = searchParams.get("groupCode")?.trim().toUpperCase() ?? "";
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgreementDraftStatusFilter>("unassigned");
  const [editingDraft, setEditingDraft] = useState<HotelAgreementDraft | null>(null);
  const [deleteDraftTarget, setDeleteDraftTarget] = useState<HotelAgreementDraft | null>(null);
  const [assignmentGroupCodes, setAssignmentGroupCodes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const hasBlockingModal = editingDraft !== null || deleteDraftTarget !== null;
  const draftsQuery = useAgreementDraftsQuery(query, statusFilter);
  const drafts = draftsQuery.data ?? [];

  const saveDraftMutation = useMutation({
    mutationFn: saveAgreementDraftInBackend,
    retry: false,
  });
  const deleteDraftMutation = useMutation({
    mutationFn: deleteAgreementDraftInBackend,
    retry: false,
  });
  const assignDraftMutation = useMutation({
    mutationFn: assignAgreementDraftInBackend,
    retry: false,
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<HotelAgreementDraftFormState>({
    resolver: zodResolver(draftSchema),
    defaultValues: createDefaultDraftForm(),
  });

  const isSaving = saveDraftMutation.isPending;

  const resetDraftForm = () => {
    reset(createDefaultDraftForm());
  };

  const onSubmit = handleSubmit(async (values) => {
    setFeedback(null);
    try {
      await saveDraftMutation.mutateAsync({
        draft: values,
      });
      await queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all });
      setFeedback({
        tone: "success",
        message: "Draft agreement berhasil disimpan.",
      });
      resetDraftForm();
    } catch (error: unknown) {
      setFeedback({
        tone: "error",
        message: formatMutationError(error, "Draft agreement belum berhasil disimpan."),
      });
    }
  });

  const startEditDraft = (draft: HotelAgreementDraft) => {
    setEditingDraft(draft);
    setFeedback(null);
  };

  const closeEditDraftModal = () => {
    setEditingDraft(null);
  };

  const updateDraft = async (draft: HotelAgreementDraft, values: HotelAgreementDraftFormState) => {
    setFeedback(null);
    try {
      await saveDraftMutation.mutateAsync({
        draftId: draft.id,
        draft: values,
      });
      await queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all });
      setEditingDraft(null);
      setFeedback({ tone: "success", message: "Draft agreement berhasil diperbarui." });
    } catch (error: unknown) {
      setFeedback({
        tone: "error",
        message: formatMutationError(error, "Draft agreement belum berhasil diperbarui."),
      });
    }
  };

  const requestDeleteDraft = (draft: HotelAgreementDraft) => {
    setDeleteDraftTarget(draft);
    setFeedback(null);
  };

  const updateAssignmentGroupCode = (draftId: string, groupCode: string) => {
    setAssignmentGroupCodes((current) => ({
      ...current,
      [draftId]: groupCode,
    }));
  };

  const assignDraftToGroup = async (draft: HotelAgreementDraft) => {
    const groupCode = (assignmentGroupCodes[draft.id] ?? linkedGroupCode).trim().toUpperCase();
    if (!groupCode) {
      setFeedback({
        tone: "error",
        message: "Isi group number sebelum menghubungkan agreement.",
      });
      return;
    }

    setFeedback(null);
    try {
      await assignDraftMutation.mutateAsync({
        draftId: draft.id,
        groupCode,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: groupQueryKeys.all }),
      ]);
      setAssignmentGroupCodes((current) => {
        const next = { ...current };
        delete next[draft.id];
        return next;
      });
      setFeedback({
        tone: "success",
        message: `Agreement berhasil dihubungkan ke group ${groupCode}.`,
      });
    } catch (error: unknown) {
      setFeedback({
        tone: "error",
        message: formatMutationError(error, "Agreement belum berhasil dihubungkan ke group."),
      });
    }
  };

  const deleteDraft = async (draft: HotelAgreementDraft) => {
    setFeedback(null);
    try {
      await deleteDraftMutation.mutateAsync(draft.id);
      await queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all });
      if (editingDraft?.id === draft.id) {
        setEditingDraft(null);
      }
      setDeleteDraftTarget(null);
      setFeedback({ tone: "success", message: "Draft agreement berhasil dihapus." });
    } catch (error: unknown) {
      setFeedback({
        tone: "error",
        message: formatMutationError(error, "Draft agreement belum berhasil dihapus."),
      });
    }
  };

  useEffect(() => {
    if (!hasBlockingModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasBlockingModal]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 py-5 sm:py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-primary">Hotel Agreement</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Agreement Inbox</h1>
        </div>

        <label className="serene-page-search w-full sm:max-w-sm" aria-label="Search agreement drafts">
          <span className="material-symbols-outlined text-slate-400" aria-hidden="true">
            search
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agreement..."
          />
        </label>
      </header>

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            feedback.tone === "success"
              ? "border border-brand-primary/25 bg-brand-primary/12 text-brand-primary"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {feedback.message}
        </div>
      ) : null}

      {linkedGroupCode ? (
        <section className="rounded-2xl border border-brand-primary/25 bg-brand-primary/12 px-4 py-3 text-sm font-semibold text-brand-primary">
          Draft unassigned akan otomatis memakai group <strong>{linkedGroupCode}</strong> saat dihubungkan.
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Draft Agreement</h2>
          </div>
        </div>

        <form className="space-y-5" onSubmit={onSubmit}>
          <AgreementDraftFields control={control} register={register} errors={errors} idPrefix="agreement-draft" />

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-4 py-2 text-sm font-bold text-on-primary transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                save
              </span>
              <span>{isSaving ? "Saving..." : "Save Draft"}</span>
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" aria-label="Agreement draft filters">
          {(["unassigned", "assigned", "all"] as AgreementDraftStatusFilter[]).map((filter) => {
            const isActive = statusFilter === filter;
            const label = filter === "all" ? "All" : filter === "assigned" ? "Assigned" : "Unassigned";
            return (
              <button
                key={filter}
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-sm font-bold leading-none transition ${
                  isActive
                    ? "border-brand-primary/30 bg-brand-primary/12 text-brand-primary"
                    : "border-slate-200 bg-surface-container-lowest text-slate-600 hover:border-brand-primary/30 hover:text-brand-primary"
                }`}
                onClick={() => setStatusFilter(filter)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {draftsQuery.isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-surface-container-lowest px-4 py-6 text-sm font-semibold text-slate-600">
            Loading agreement drafts...
          </div>
        ) : null}

        {!draftsQuery.isLoading && drafts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-surface-container-lowest px-4 py-8 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">
              inventory_2
            </span>
            <h2 className="mt-2 text-lg font-bold text-slate-900">No agreement drafts found</h2>
          </div>
        ) : null}

        {drafts.map((draft) => {
          const isAssigned = draft.assignmentStatus === "Assigned";

          return (
            <article
              key={draft.id}
              className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-lg font-bold text-slate-900">{draft.hotelName}</h3>
                    <span
                      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${getAssignmentBadgeClasses(
                        draft,
                      )}`}
                    >
                      {draft.assignmentStatus}
                    </span>
                    <span
                      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${getApprovalBadgeClasses(
                        draft,
                      )}`}
                    >
                      {draft.status}
                    </span>
                  </div>

                  {draft.agentName ? (
                    <p className="mt-1 break-words text-sm font-semibold text-brand-primary">
                      Agent: {draft.agentName}
                    </p>
                  ) : null}
                  <p className="mt-1 break-words text-sm font-semibold text-slate-700">{draft.agreementNumber}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {draft.city === "makkah" ? "Makkah" : "Madinah"} - Pax {draft.pax} -{" "}
                    {formatVisaDateWithYear(draft.stayStartIso)} to {formatVisaDateWithYear(draft.stayEndIso)}
                  </p>
                  {draft.notes ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{draft.notes}</p> : null}
                  <p className="mt-2 text-xs text-slate-500">
                    {isAssigned && draft.groupCode
                      ? `Assigned to ${draft.groupCode}${draft.assignedAtIso ? ` on ${formatDraftDateTime(draft.assignedAtIso)}` : ""}`
                      : `Created ${formatDraftDateTime(draft.createdAtIso)}`}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-surface-container-lowest text-slate-600 transition hover:border-brand-primary hover:text-brand-primary"
                    aria-label={`Edit agreement draft ${draft.agreementNumber}`}
                    onClick={() => startEditDraft(draft)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      edit
                    </span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand-tertiary/35 bg-brand-tertiary/12 text-brand-tertiary transition hover:bg-brand-tertiary/20 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={`Delete agreement draft ${draft.agreementNumber}`}
                    onClick={() => requestDeleteDraft(draft)}
                    disabled={deleteDraftMutation.isPending}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      delete
                    </span>
                  </button>
                </div>
              </div>

              {!isAssigned ? (
                <div className="mt-4 flex flex-col gap-2 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
                  <label className="sr-only" htmlFor={`assign-${draft.id}`}>
                    Group number
                  </label>
                  <input
                    id={`assign-${draft.id}`}
                    type="text"
                    className="h-10 min-w-0 rounded-xl border border-slate-300 bg-surface-container-lowest px-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 sm:w-52"
                    placeholder="Group number"
                    value={assignmentGroupCodes[draft.id] ?? linkedGroupCode}
                    onChange={(event) => updateAssignmentGroupCode(draft.id, event.target.value)}
                  />
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-brand-primary/35 bg-brand-primary/10 px-3 text-sm font-bold text-brand-primary transition hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void assignDraftToGroup(draft)}
                    disabled={assignDraftMutation.isPending}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      link
                    </span>
                    <span>{assignDraftMutation.isPending ? "Linking..." : "Link to Group"}</span>
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>

      {editingDraft ? (
        <AgreementDraftEditModal
          key={editingDraft.id}
          draft={editingDraft}
          isSaving={saveDraftMutation.isPending}
          onClose={closeEditDraftModal}
          onSave={(values) => void updateDraft(editingDraft, values)}
        />
      ) : null}

      {deleteDraftTarget ? (
        <DeleteAgreementDraftModal
          draft={deleteDraftTarget}
          isDeleting={deleteDraftMutation.isPending}
          onClose={() => setDeleteDraftTarget(null)}
          onConfirm={() => void deleteDraft(deleteDraftTarget)}
        />
      ) : null}
    </div>
  );
}
