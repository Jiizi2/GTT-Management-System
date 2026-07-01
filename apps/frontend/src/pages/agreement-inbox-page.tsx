import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { Controller, type Control, type FieldErrors, type UseFormRegister, useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v4";
import { DatePickerInput } from "../components/date-time-pickers";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../components/form-accessibility";
import { PaginationControls } from "../components/pagination-controls";
import { SereneSelect } from "../components/serene-select";
import { useModalFocusTrap } from "../components/use-modal-focus-trap";
import { Button } from "../components/button";
import { DialogShell } from "../components/dialog-shell";
import {
  assignAgreementDraftInBackend,
  deleteAgreementDraftInBackend,
  saveAgreementDraftInBackend,
  unassignAgreementDraftInBackend,
  useAgreementDraftsQuery,
  type AgreementDraftStatusFilter,
} from "../hooks/use-agreement-drafts-query";
import {
  formatVisaDateWithYear,
  getLocalIsoDateWithOffset,
  type AgreementApprovalStatus,
  type HotelAgreementDraft,
  type HotelAgreementDraftFormState,
  getInclusiveDays,
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
    status: z.enum(["Waiting for Approval", "Approved", "Rejected"]),
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
const AGREEMENT_DRAFT_PAGE_SIZE = 8;

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
  if (draft.assignmentStatus === "Assigned") {
    return "border-brand-primary/25 bg-brand-primary/12 text-brand-primary";
  }
  if (draft.assignmentStatus === "Partially Assigned") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }
  return "border-amber-200 bg-amber-100 text-amber-800";
}

function getApprovalBadgeClasses(draft: HotelAgreementDraft): string {
  if (draft.status === "Approved") {
    return "border-emerald-500 bg-emerald-600 text-white shadow-sm";
  }
  if (draft.status === "Rejected") {
    return "border-rose-500 bg-rose-600 text-white shadow-sm";
  }
  return "border-amber-300 bg-amber-100 text-amber-900";
}

function getApprovalStatusIconName(draft: HotelAgreementDraft): "check_circle" | "pending_actions" | "cancel" {
  if (draft.status === "Approved") {
    return "check_circle";
  }
  if (draft.status === "Rejected") {
    return "cancel";
  }
  return "pending_actions";
}

function getApprovalStatusLabel(draft: HotelAgreementDraft): AgreementApprovalStatus {
  return draft.status;
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
                <option value="Rejected">Rejected</option>
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
        className="serene-modal-overlay z-[130] flex items-start justify-center overflow-y-auto p-3 pt-10 pb-10 sm:p-4 sm:pt-20 sm:pb-20"
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
  const descriptionId = useId();

  return (
    <DialogShell
      isOpen={true}
      onClose={onClose}
      title="Hapus Draft Agreement"
      size="sm"
    >
      <div className="serene-dialog-body px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined rounded-full bg-rose-100 p-2 text-rose-700" aria-hidden="true">
            warning
          </span>
          <div className="min-w-0">
            <p id={descriptionId} className="text-sm leading-relaxed text-slate-600">
              Draft agreement <strong>{draft.agreementNumber}</strong> untuk hotel <strong>{draft.hotelName}</strong>{" "}
              akan dihapus dari inbox.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="inline-flex items-center gap-1.5"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {isDeleting ? "sync" : "delete"}
            </span>
            <span>{isDeleting ? "Deleting..." : "Delete Agreement"}</span>
          </Button>
        </div>
      </div>
    </DialogShell>
  );
}

export function AgreementInboxScreen() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const linkedGroupCode = searchParams.get("groupCode")?.trim().toUpperCase() ?? "";
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgreementDraftStatusFilter>("unassigned");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isDraftComposerOpen, setIsDraftComposerOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<HotelAgreementDraft | null>(null);
  const [deleteDraftTarget, setDeleteDraftTarget] = useState<HotelAgreementDraft | null>(null);
  const [assignmentGroupCodes, setAssignmentGroupCodes] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const hasBlockingModal = editingDraft !== null || deleteDraftTarget !== null;
  const normalizedSearchQuery = query.trim();
  const isSearchingAcrossStatuses = normalizedSearchQuery.length > 0;

  const hasDatesSelected = startDateFilter !== "" && endDateFilter !== "";
  const isDateRangeInvalid = hasDatesSelected && startDateFilter > endDateFilter;

  const effectiveStatusFilter: AgreementDraftStatusFilter =
    hasDatesSelected ? "all" : (isSearchingAcrossStatuses ? "all" : statusFilter);
  const draftsQuery = useAgreementDraftsQuery(query, effectiveStatusFilter);
  const drafts = draftsQuery.data ?? [];

  const filteredDrafts = useMemo(() => {
    let result = drafts;

    if (hasDatesSelected && !isDateRangeInvalid) {
      result = result.filter((draft) => {
        return draft.stayStartIso <= endDateFilter && draft.stayEndIso >= startDateFilter;
      });
    }

    if (hasDatesSelected && statusFilter !== "all") {
      result = result.filter((draft) => {
        const isAssigned = draft.assignmentStatus === "Assigned" || draft.assignmentStatus === "Partially Assigned";
        if (statusFilter === "assigned") {
          return isAssigned;
        }
        if (statusFilter === "unassigned") {
          return !isAssigned;
        }
        return true;
      });
    }

    return result;
  }, [drafts, hasDatesSelected, isDateRangeInvalid, statusFilter, startDateFilter, endDateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDrafts.length / AGREEMENT_DRAFT_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * AGREEMENT_DRAFT_PAGE_SIZE;
  const paginatedDrafts = filteredDrafts.slice(pageStartIndex, pageStartIndex + AGREEMENT_DRAFT_PAGE_SIZE);
  const rangeStart = filteredDrafts.length === 0 ? 0 : pageStartIndex + 1;
  const rangeEnd = filteredDrafts.length === 0 ? 0 : Math.min(filteredDrafts.length, pageStartIndex + paginatedDrafts.length);

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
  const unassignDraftMutation = useMutation({
    mutationFn: unassignAgreementDraftInBackend,
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: groupQueryKeys.all }),
      ]);
      setFeedback({
        tone: "success",
        message: "Draft agreement berhasil disimpan.",
      });
      resetDraftForm();
      setIsDraftComposerOpen(false);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: groupQueryKeys.all }),
      ]);
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

  const unassignDraftFromGroup = async (draft: HotelAgreementDraft, groupCode?: string) => {
    setFeedback(null);
    try {
      await unassignDraftMutation.mutateAsync({ draftId: draft.id, groupCode });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: groupQueryKeys.all }),
      ]);
      setFeedback({
        tone: "success",
        message: `Agreement ${draft.agreementNumber} berhasil dilepas dari group.`,
      });
    } catch (error: unknown) {
      setFeedback({
        tone: "error",
        message: formatMutationError(error, "Agreement belum berhasil di-unassign dari group."),
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

  useEffect(() => {
    setCurrentPage(1);
  }, [query, statusFilter, startDateFilter, endDateFilter]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 py-5 sm:py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-primary">Hotel Agreement</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Agreement Inbox</h1>
        </div>

        <label
          className="serene-page-search w-full cursor-text border border-transparent transition focus-within:border-brand-primary/25 focus-within:ring-2 focus-within:ring-brand-primary/15 sm:max-w-sm"
          aria-label="Search agreement drafts"
        >
          <span className="material-symbols-outlined text-slate-400" aria-hidden="true">
            search
          </span>
          <input
            type="search"
            className="serene-page-search-input h-full"
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
        <section className="rounded-2xl border border-brand-primary/25 bg-brand-primary/12 px-4 py-3 text-brand-primary">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                link
              </span>
              <p className="text-sm font-bold">Target group: {linkedGroupCode}</p>
            </div>
            <span className="inline-flex w-fit rounded-lg bg-surface-container-lowest px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em]">
              Prefilled
            </span>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-surface-container-lowest px-3 py-2.5 shadow-sm sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">New Draft Agreement</h2>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="inline-flex items-center gap-1.5"
            onClick={() => setIsDraftComposerOpen((isOpen) => !isOpen)}
            aria-expanded={isDraftComposerOpen}
            aria-controls="agreement-draft-composer"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {isDraftComposerOpen ? "close" : "add"}
            </span>
            <span>{isDraftComposerOpen ? "Close" : "Create Draft"}</span>
          </Button>
        </div>

        {isDraftComposerOpen ? (
          <form
            id="agreement-draft-composer"
            className="mt-4 space-y-4 border-t border-slate-200 pt-4"
            onSubmit={onSubmit}
          >
            <AgreementDraftFields control={control} register={register} errors={errors} idPrefix="agreement-draft" />

            <div className="flex justify-end">
              <Button
                variant="primary"
                type="submit"
                className="inline-flex items-center gap-1.5"
                disabled={isSaving}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  save
                </span>
                <span>{isSaving ? "Saving..." : "Save Draft"}</span>
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          {/* Status Segmented Control */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</span>
            <div className="relative flex items-center bg-slate-100 dark:bg-surface-container-high/65 p-1 rounded-xl w-[278px] h-9">
              {/* Sliding background indicator */}
              <div
                className="absolute top-1 bottom-1 left-1 bg-white dark:bg-surface-container-lowest rounded-lg shadow-sm transition-transform duration-200 ease-out"
                style={{
                  width: "88px",
                  transform: `translateX(${
                    statusFilter === "unassigned"
                      ? "0px"
                      : statusFilter === "assigned"
                      ? "90px"
                      : "180px"
                  })`,
                }}
              />
              {(["unassigned", "assigned", "all"] as AgreementDraftStatusFilter[]).map((filter) => {
                const isActive = statusFilter === filter;
                const label = filter === "all" ? "All" : filter === "assigned" ? "Assigned" : "Unassigned";
                return (
                  <button
                    key={filter}
                    type="button"
                    className={`relative z-10 w-[90px] h-full rounded-lg text-xs font-extrabold transition-colors duration-200 leading-none text-center ${
                      isActive
                        ? "text-brand-primary dark:text-primary"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                    onClick={() => setStatusFilter(filter)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Period Filter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stay Period</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DatePickerInput
                id="filter-start-date"
                inputClassName="h-8 w-36 rounded-lg border border-slate-200 bg-surface-container-lowest px-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-brand-primary"
                value={startDateFilter}
                onChange={setStartDateFilter}
                placeholder="Start Date"
              />
              <span className="text-slate-400 font-bold text-xs">➔</span>
              <DatePickerInput
                id="filter-end-date"
                inputClassName="h-8 w-36 rounded-lg border border-slate-200 bg-surface-container-lowest px-2 text-xs font-semibold text-slate-900 outline-none transition focus:border-brand-primary"
                value={endDateFilter}
                onChange={setEndDateFilter}
                placeholder="End Date"
              />
              {(startDateFilter || endDateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDateFilter("");
                    setEndDateFilter("");
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-rose-600 transition shadow-sm border border-slate-200"
                  title="Clear stay period"
                  aria-label="Clear stay period"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {isDateRangeInvalid && (
          <div className="mt-3 text-xs font-semibold text-rose-600 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              error
            </span>
            <span>End Date tidak boleh sebelum Start Date</span>
          </div>
        )}
      </section>

      <section className={`space-y-2 transition-opacity duration-200 ${draftsQuery.isFetching ? "opacity-60" : ""}`}>
        {draftsQuery.isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-surface-container-lowest px-4 py-6 text-sm font-semibold text-slate-600">
            Loading agreement drafts...
          </div>
        ) : null}

        {!draftsQuery.isLoading && filteredDrafts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-surface-container-lowest px-4 py-8 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">
              inventory_2
            </span>
            <h2 className="mt-2 text-lg font-bold text-slate-900">No agreement drafts found</h2>
          </div>
        ) : null}

        {paginatedDrafts.map((draft) => {
          const isAssigned = draft.assignmentStatus === "Assigned" || draft.assignmentStatus === "Partially Assigned";
          const isRejected = draft.status === "Rejected";
          const isApproved = draft.status === "Approved";

          let cardBorderClass = "border-l-[6px] border-l-amber-500";
          let cardBgClass = "bg-surface-container-lowest";
          let opacityClass = "";

          if (isApproved) {
            cardBorderClass = "border-l-[6px] border-l-emerald-500";
          } else if (isRejected) {
            cardBorderClass = "border-l-[6px] border-l-rose-500";
            cardBgClass = "bg-slate-50/75";
            opacityClass = "opacity-90";
          }

          return (
            <article
              key={draft.id}
              className={`overflow-hidden rounded-3xl border-[0.5px] border-black/20 ${cardBgClass} ${cardBorderClass} ${opacityClass} shadow-sm`}
            >
              <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
                <div className="border-b border-dashed border-black/45 bg-transparent p-5 lg:border-b-0 lg:border-r">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-900">Agreement No</p>
                      <p className="mt-2 break-words text-2xl font-extrabold leading-none tracking-tight text-slate-900 sm:text-[2rem]">
                        {draft.agreementNumber}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest/90 text-slate-900 transition hover:bg-surface-container-high"
                      aria-label={`Edit agreement draft ${draft.agreementNumber}`}
                      onClick={() => startEditDraft(draft)}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        edit
                      </span>
                    </button>
                  </div>

                  <div className="mt-5 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Hotel</p>
                    <h3 className="break-words text-lg font-bold leading-snug text-slate-900">{draft.hotelName}</h3>
                    {draft.agentName ? (
                      <p className="truncate text-sm font-semibold text-brand-primary">Agent: {draft.agentName}</p>
                    ) : (
                      <p className="text-sm font-semibold text-slate-500">Agent belum diisi</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="inline-flex rounded-lg bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-slate-800">
                        {draft.city === "makkah" ? "Makkah" : "Madinah"}
                      </span>
                      <span className="inline-flex rounded-lg bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-slate-800">
                        {draft.remainingPax !== undefined
                          ? `Available: ${draft.remainingPax}/${draft.pax} Pax`
                          : `Available: ${draft.pax} Pax`}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Check In</p>
                      <strong className="mt-1 block text-sm font-extrabold text-slate-900 sm:text-base">
                        {formatVisaDateWithYear(draft.stayStartIso)}
                      </strong>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Check Out</p>
                      <strong className="mt-1 block text-sm font-extrabold text-slate-900 sm:text-base">
                        {formatVisaDateWithYear(draft.stayEndIso)}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 bg-surface-container-low p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant/90">
                        Agreement Status
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] leading-none ${getApprovalBadgeClasses(
                            draft,
                          )}`}
                        >
                          <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
                            {getApprovalStatusIconName(draft)}
                          </span>
                          <span>{getApprovalStatusLabel(draft)}</span>
                        </span>
                        <span
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.08em] ${getAssignmentBadgeClasses(
                            draft,
                          )}`}
                        >
                          {draft.assignmentStatus}
                        </span>
                        {hasDatesSelected && !isDateRangeInvalid && (() => {
                          const isFullCoverage = draft.stayStartIso <= startDateFilter && draft.stayEndIso >= endDateFilter;
                          const coverageType = isFullCoverage ? "Full Coverage" : "Partial Coverage";
                          const filterDays = getInclusiveDays(startDateFilter, endDateFilter);
                          const overlapStart = draft.stayStartIso > startDateFilter ? draft.stayStartIso : startDateFilter;
                          const overlapEnd = draft.stayEndIso < endDateFilter ? draft.stayEndIso : endDateFilter;
                          const matchDays = getInclusiveDays(overlapStart, overlapEnd);
                          return (
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold uppercase leading-none tracking-[0.08em] ${
                                isFullCoverage
                                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                  : "border-amber-400 bg-amber-50 text-amber-800"
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
                                {isFullCoverage ? "assignment_turned_in" : "assignment_late"}
                              </span>
                              <span>{coverageType} ({matchDays}/{filterDays} hari)</span>
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <Button
                      variant="danger"
                      size="sm"
                      className="h-9 w-9 p-0 rounded-full inline-flex items-center justify-center shrink-0"
                      aria-label={`Delete agreement draft ${draft.agreementNumber}`}
                      title={isAssigned ? "Unassign agreement before deleting it." : undefined}
                      onClick={() => requestDeleteDraft(draft)}
                      disabled={deleteDraftMutation.isPending || isAssigned}
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        delete
                      </span>
                    </Button>
                  </div>

                  <div className="border-t border-dashed border-black/20 pt-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">
                          Group Link
                        </p>
                        {draft.assignedGroups && draft.assignedGroups.length > 0 ? (
                          <div className="mt-2 space-y-1.5 max-w-md">
                            {draft.assignedGroups.map((link) => (
                              <div key={link.groupCode} className="flex items-center justify-between gap-3 bg-surface-container-high/60 rounded-xl px-3 py-1.5 border border-black/5">
                                <div className="min-w-0">
                                  <span className="font-extrabold text-slate-900 text-sm">{link.groupCode}</span>
                                  <span className="ml-2 text-xs font-semibold text-slate-500">({link.pax} Pax)</span>
                                </div>
                                <button
                                  type="button"
                                  className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                                  onClick={() => void unassignDraftFromGroup(draft, link.groupCode)}
                                  disabled={unassignDraftMutation.isPending}
                                >
                                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                                    link_off
                                  </span>
                                  <span>Lepas</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-1 text-sm font-bold text-slate-900">Belum terhubung ke group</p>
                        )}
                        <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
                          Created {formatDraftDateTime(draft.createdAtIso)}
                        </p>
                      </div>

                      {isRejected ? (
                        <div className="flex min-w-0 flex-col gap-1 sm:w-64">
                          <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm" aria-hidden="true">
                              error
                            </span>
                            <span>Draft ditolak. Harap edit nomor agreement dengan nomor baru untuk menghubungkan.</span>
                          </p>
                        </div>
                      ) : (draft.remainingPax === undefined || draft.remainingPax > 0) ? (
                        <div className="flex min-w-0 flex-col gap-2 sm:w-64">
                          <label className="sr-only" htmlFor={`assign-${draft.id}`}>
                            Group number
                          </label>
                          <input
                            id={`assign-${draft.id}`}
                            type="text"
                            className="serene-input serene-input-md min-w-0"
                            placeholder="Group number"
                            value={assignmentGroupCodes[draft.id] ?? linkedGroupCode}
                            onChange={(event) => updateAssignmentGroupCode(draft.id, event.target.value)}
                          />
                          <Button
                            variant="secondary"
                            className="inline-flex items-center gap-1.5"
                            onClick={() => void assignDraftToGroup(draft)}
                            disabled={assignDraftMutation.isPending}
                          >
                            <span className="material-symbols-outlined text-base" aria-hidden="true">
                              link
                            </span>
                            <span>{assignDraftMutation.isPending ? "Linking..." : "Link to Group"}</span>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {draft.notes ? (
                    <div className="border-t border-dashed border-black/20 pt-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">
                        Notes
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">{draft.notes}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={drafts.length}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="agreement drafts"
        onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
      />

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
