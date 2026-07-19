import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v4";
import {
  assignAgreementDraftInBackend,
  deleteAgreementDraftInBackend,
  saveAgreementDraftInBackend,
  unassignAgreementDraftInBackend,
  useAgreementDraftsQuery,
  type AgreementDraftStatusFilter,
} from "../../../hooks/use-agreement-drafts-query";
import {
  getLocalIsoDateWithOffset,
  type HotelAgreementDraft,
  type HotelAgreementDraftFormState,
  getInclusiveDays,
} from "../../../shared/app-domain";
import { agreementDraftQueryKeys, groupQueryKeys } from "../../../shared/query-keys";

export const draftSchema = z
  .object({
    city: z.enum(["makkah", "madinah"]),
    agentId: z.string().trim().min(1, "Agent wajib dipilih."),
    groupName: z.string().trim().min(1, "Nama group wajib diisi."),
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

export const AGREEMENT_DRAFT_PAGE_SIZE = 8;

export function createDefaultDraftForm(): HotelAgreementDraftFormState {
  return {
    city: "makkah",
    agentId: "",
    groupName: "",
    hotelName: "",
    agreementNumber: "",
    pax: "1",
    status: "Waiting for Approval",
    stayStartIso: getLocalIsoDateWithOffset(0),
    stayEndIso: getLocalIsoDateWithOffset(1),
    notes: "",
  };
}

export function formatMutationError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback;
}

export function useAgreementInbox() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const linkedGroupCode = searchParams.get("groupCode")?.trim().toUpperCase() ?? "";
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AgreementDraftStatusFilter>("unassigned");
  const [agentFilter, setAgentFilter] = useState("all");
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

  const effectiveStatusFilter: AgreementDraftStatusFilter = hasDatesSelected
    ? "all"
    : isSearchingAcrossStatuses
      ? "all"
      : statusFilter;
  const draftsQuery = useAgreementDraftsQuery(query, effectiveStatusFilter);
  const drafts = draftsQuery.data ?? [];

  const filteredDrafts = useMemo(() => {
    let result = drafts;
    if (agentFilter !== "all") result = result.filter((draft) => draft.agentId === agentFilter);

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
  }, [drafts, hasDatesSelected, isDateRangeInvalid, statusFilter, startDateFilter, endDateFilter, agentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredDrafts.length / AGREEMENT_DRAFT_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * AGREEMENT_DRAFT_PAGE_SIZE;
  const paginatedDrafts = filteredDrafts.slice(pageStartIndex, pageStartIndex + AGREEMENT_DRAFT_PAGE_SIZE);
  const rangeStart = filteredDrafts.length === 0 ? 0 : pageStartIndex + 1;
  const rangeEnd =
    filteredDrafts.length === 0 ? 0 : Math.min(filteredDrafts.length, pageStartIndex + paginatedDrafts.length);

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

  const form = useForm<HotelAgreementDraftFormState>({
    resolver: zodResolver(draftSchema),
    defaultValues: createDefaultDraftForm(),
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = form;

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
  }, [query, statusFilter, startDateFilter, endDateFilter, agentFilter]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  return {
    linkedGroupCode,
    query,
    setQuery,
    statusFilter,
    agentFilter,
    setAgentFilter,
    setStatusFilter,
    startDateFilter,
    setStartDateFilter,
    endDateFilter,
    setEndDateFilter,
    currentPage,
    setCurrentPage,
    isDraftComposerOpen,
    setIsDraftComposerOpen,
    editingDraft,
    setEditingDraft,
    deleteDraftTarget,
    setDeleteDraftTarget,
    assignmentGroupCodes,
    feedback,
    setFeedback,
    hasBlockingModal,
    hasDatesSelected,
    isDateRangeInvalid,
    draftsQuery,
    drafts,
    filteredDrafts,
    totalPages,
    pageStartIndex,
    paginatedDrafts,
    rangeStart,
    rangeEnd,
    isSaving,
    resetDraftForm,
    onSubmit,
    startEditDraft,
    closeEditDraftModal,
    updateDraft,
    requestDeleteDraft,
    updateAssignmentGroupCode,
    assignDraftToGroup,
    deleteDraft,
    unassignDraftFromGroup,
    deleteDraftMutationPending: deleteDraftMutation.isPending,
    assignDraftMutationPending: assignDraftMutation.isPending,
    unassignDraftMutationPending: unassignDraftMutation.isPending,
    form,
  };
}
