import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as Domain from "../../../shared/app-domain";
import {
  assignAgreementDraftInBackend,
  unassignAgreementDraftInBackend,
  useAgreementDraftsQuery,
} from "../../../hooks/use-agreement-drafts-query";
import { buildRaudhahReminderTemplate } from "../../../shared/raudhah-reminder-template.js";
import { agreementDraftQueryKeys, groupQueryKeys } from "../../../shared/query-keys";
import { useModalFocusTrap } from "../../../components/use-modal-focus-trap";
import type {
  GroupAgreementHotel,
  GroupData,
  HotelAgreementDraft,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaRaudhahEditFormState,
  VisaStatus,
  VisaTrackingRow,
} from "../../../shared/app-domain";
import {
  doesAgreementMatchAssignedDraft,
  formatVisaMutationError,
  getUncoveredPeriod,
  type Tone,
} from "../visa-detail-helpers";

const {
  formatVisaDateWithYear,
  generateWhatsappCopyText,
  getGroupAgreementHotelsByCity,
  resolveGroupCompleteness,
  resolveTotalBusCount,
  resolveVisaAgreementDateRange,
  filterAgreementDrafts,
} = Domain;

interface UseVisaTrackingDetailProps {
  row: VisaTrackingRow;
  groups: GroupData[];
  onBack: () => void;
  onDeleteGroup: (groupCode: string) => void;
  onSaveGroup: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  onUpdateVisaStatus: (groupCode: string, visaStatus: VisaStatus) => void;
  onUpdateVisaType: (groupCode: string, visaType: "Visa Only" | "Visa+") => void;
  onUpdatePaymentStatus: (groupCode: string, paymentStatus: VisaPaymentStatus) => void;
  onUpdateSyarikah: (groupCode: string, syarikah: string) => void;
  onUpdateVisaHotel: (
    groupCode: string,
    city: "makkah" | "madinah",
    hotel: VisaHotelEditFormState,
    hotelId?: string,
  ) => void;
  onDeleteVisaHotel: (groupCode: string, city: "makkah" | "madinah", hotelId: string) => void;
  onUpdateRaudhahAppointment: (groupCode: string, appointment: VisaRaudhahEditFormState) => void;
  onClearRaudhahAppointment: (groupCode: string) => void;
}

export function useVisaTrackingDetail({
  row: initialRow,
  groups,
  onBack,
  onDeleteGroup,
  onSaveGroup,
  onUpdateVisaStatus,
  onUpdateVisaType,
  onUpdatePaymentStatus,
  onUpdateSyarikah,
  onUpdateVisaHotel,
  onDeleteVisaHotel,
  onUpdateRaudhahAppointment,
  onClearRaudhahAppointment,
}: UseVisaTrackingDetailProps) {
  const [activeGroupCode, setActiveGroupCode] = useState(initialRow.groupCode);
  const [unlinkingGroup, setUnlinkingGroup] = useState<GroupData | null>(null);
  const allVisaRows = useMemo(() => Domain.buildVisaTrackingRowsFromGroups(groups), [groups]);
  const activeRow = useMemo(() => {
    return allVisaRows.find((r) => r.groupCode === activeGroupCode) ?? initialRow;
  }, [allVisaRows, activeGroupCode, initialRow]);

  useEffect(() => {
    setActiveGroupCode(initialRow.groupCode);
  }, [initialRow.groupCode]);

  // Find family groups for tabs
  const familyGroups = useMemo(() => {
    const currentGroup = groups.find((item) => item.code === activeRow.groupCode) ?? null;
    if (!currentGroup) return [];
    const parent = currentGroup.parentGroupId
      ? (groups.find((g) => g.id === currentGroup.parentGroupId || g.code === currentGroup.parentGroupId) ?? null)
      : currentGroup;
    if (!parent) return [currentGroup];
    const parentKey = parent.id || parent.code;
    if (!parentKey) return [currentGroup];
    const children = groups.filter(
      (g) => g.parentGroupId && (g.parentGroupId === parent.id || g.parentGroupId === parent.code) && g.code !== parent.code
    );
    return [parent, ...children];
  }, [groups, activeRow.groupCode]);

  const operationalGroup = familyGroups[0] ?? groups.find((item) => item.code === activeRow.groupCode) ?? null;
  const row = activeRow;

  const queryClient = useQueryClient();
  const agreementDraftsQuery = useAgreementDraftsQuery("", "all");
  const [paymentStatus, setPaymentStatus] = useState<VisaPaymentStatus>(row.paymentStatus);

  useEffect(() => {
    setPaymentStatus(activeRow.paymentStatus);
  }, [activeRow.groupCode, activeRow.paymentStatus]);

  const [activeModal, setActiveModal] = useState<
    "visa-status" | "payment-status" | "syarikah" | "hotel" | "raudhah" | "visa-type" | null
  >(null);
  const [hotelCityDraft, setHotelCityDraft] = useState<"makkah" | "madinah">("makkah");
  const [hotelDraftMode, setHotelDraftMode] = useState<"add" | "edit">("edit");
  const [hotelDraftId, setHotelDraftId] = useState<string | null>(null);
  const [hotelDraftSeed, setHotelDraftSeed] = useState<VisaHotelEditFormState | null>(null);
  const [hotelDraftOwnerGroupCode, setHotelDraftOwnerGroupCode] = useState<string | null>(null);
  const [addingHotelCity, setAddingHotelCity] = useState<"makkah" | "madinah" | null>(null);
  const [coverageStartIso, setCoverageStartIso] = useState<string>("");
  const [coverageEndIso, setCoverageEndIso] = useState<string>("");
  const [isGroupEditModalOpen, setIsGroupEditModalOpen] = useState(false);
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
  const [deleteAgreementDraft, setDeleteAgreementDraft] = useState<{
    city: "makkah" | "madinah";
    agreement: GroupAgreementHotel;
    draft?: HotelAgreementDraft;
  } | null>(null);
  const [assigningAgreementDraftId, setAssigningAgreementDraftId] = useState<string | null>(null);
  const [unassigningAgreementDraftId, setUnassigningAgreementDraftId] = useState<string | null>(null);
  const [draftAssignFeedback, setDraftAssignFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isRaudhahTemplateCopied, setIsRaudhahTemplateCopied] = useState(false);
  const [isClearRaudhahConfirmOpen, setIsClearRaudhahConfirmOpen] = useState(false);
  const raudhahCopyTimerRef = useRef<any | null>(null);
  const [isWhatsappCopied, setIsWhatsappCopied] = useState(false);
  const whatsappCopyTimerRef = useRef<any | null>(null);
  
  const hasBlockingModal =
    activeModal !== null ||
    isGroupEditModalOpen ||
    isDeleteGroupModalOpen ||
    isClearRaudhahConfirmOpen ||
    unlinkingGroup !== null ||
    deleteAgreementDraft !== null;

  const clearRaudhahDialogRef = useModalFocusTrap<HTMLDivElement>({
    isActive: isClearRaudhahConfirmOpen,
    onClose: () => setIsClearRaudhahConfirmOpen(false),
  });
  const deleteAgreementDialogRef = useModalFocusTrap<HTMLDivElement>({
    isActive: deleteAgreementDraft !== null,
    onClose: () => setDeleteAgreementDraft(null),
  });

  const group = groups.find((item) => item.code === activeGroupCode) ?? groups.find((item) => item.code === row.groupCode) ?? null;
  const groupCompleteness = group ? resolveGroupCompleteness(group) : null;
  const agreementIssues =
    groupCompleteness?.issues.filter(
      (issue) =>
        issue.key === "missing-agreement" ||
        issue.key === "missing-makkah-agreement" ||
        issue.key === "missing-madinah-agreement" ||
        issue.key === "pax-mismatch" ||
        issue.key === "date-mismatch",
    ) ?? [];
  const shouldShowLinkAgreementAction = agreementIssues.some(
    (issue) =>
      issue.key === "missing-agreement" ||
      issue.key === "missing-makkah-agreement" ||
      issue.key === "missing-madinah-agreement",
  );
  const primaryAgreementMessage = agreementIssues[0]?.message ?? "Agreement hotel sudah tersambung.";

  const totalPax = row.pax ?? group?.pax ?? 0;
  const requiredBusCount = resolveTotalBusCount(totalPax, group?.totalBuses);
  const durationDays = group?.durationDays ?? 8;
  const agreementDateRange = resolveVisaAgreementDateRange(row, durationDays, group ?? undefined);

  const makkahAgreements: GroupAgreementHotel[] = getGroupAgreementHotelsByCity(group ?? undefined, "makkah");
  const madinahAgreements: GroupAgreementHotel[] = getGroupAgreementHotelsByCity(group ?? undefined, "madinah");
  
  const connectedAgreementKeys = useMemo(
    () =>
      new Set([
        ...makkahAgreements.map((agreement) => `makkah:${agreement.agreementNumber.trim().toUpperCase()}`),
        ...madinahAgreements.map((agreement) => `madinah:${agreement.agreementNumber.trim().toUpperCase()}`),
      ]),
    [madinahAgreements, makkahAgreements],
  );
  
  const availableAgreementDraftsByCity = useMemo(() => {
    return filterAgreementDrafts(agreementDraftsQuery.data ?? [], {
      groupArrivalDate: group?.arrivalDate,
      groupReturnDate: group?.returnDate,
      rowDepartureIso: row.departureIso,
      rowReturnIso: row.returnIso,
      totalPax,
      connectedAgreementKeys,
      existingAgreements: [
        ...makkahAgreements,
        ...madinahAgreements,
      ],
    });
  }, [
    agreementDraftsQuery.data,
    connectedAgreementKeys,
    group?.arrivalDate,
    group?.returnDate,
    row.departureIso,
    row.returnIso,
    totalPax,
    makkahAgreements,
    madinahAgreements,
  ]);
  
  const assignedDraftByAgreementId = useMemo(() => {
    const drafts = agreementDraftsQuery.data ?? [];
    const draftByAgreementId = new Map<string, HotelAgreementDraft>();

    for (const agreement of makkahAgreements) {
      const assignedDraft = drafts.find((draft) =>
        doesAgreementMatchAssignedDraft({
          draft,
          agreement,
          city: "makkah",
          groupCode: row.groupCode,
        }),
      );
      if (assignedDraft) {
        draftByAgreementId.set(agreement.id, assignedDraft);
      }
    }

    for (const agreement of madinahAgreements) {
      const assignedDraft = drafts.find((draft) =>
        doesAgreementMatchAssignedDraft({
          draft,
          agreement,
          city: "madinah",
          groupCode: row.groupCode,
        }),
      );
      if (assignedDraft) {
        draftByAgreementId.set(agreement.id, assignedDraft);
      }
    }

    return draftByAgreementId;
  }, [agreementDraftsQuery.data, madinahAgreements, makkahAgreements, row.groupCode]);

  const makkahAssigned = Math.min(totalPax, row.makkahVerified);
  const madinahAssigned = Math.min(totalPax, row.madinahVerified);
  const makkahMissing = Math.max(0, totalPax - makkahAssigned);
  const madinahMissing = Math.max(0, totalPax - madinahAssigned);

  const visaTone: Tone = row.visaStatus === "Issued" ? "success" : row.visaStatus === "Pending" ? "warning" : "muted";
  const paymentTone: Tone = paymentStatus === "Paid" ? "success" : paymentStatus === "Unpaid" ? "warning" : "muted";
  
  const raudhahAppointments = (group?.visaSetup?.raudhahAppointments ?? [])
    .map((appointment) => ({
      dateIso: appointment.dateIso?.trim() ?? "",
      status: appointment.status,
    }))
    .filter((appointment) => appointment.dateIso.length > 0)
    .sort((left, right) => left.dateIso.localeCompare(right.dateIso))
    .map((appointment) => ({
      ...appointment,
      dateLabel: formatVisaDateWithYear(appointment.dateIso),
    }));
    
  const hasRaudhahDates = raudhahAppointments.length > 0;
  const raudhahTone: Tone = hasRaudhahDates ? "success" : "muted";
  const raudhahStatusText = hasRaudhahDates ? "Set" : "Not Set";
  const raudhahStatusSummary = hasRaudhahDates
    ? Array.from(new Set(raudhahAppointments.map((appointment) => appointment.status))).join(", ")
    : "";
  const raudhahSecondaryText = hasRaudhahDates
    ? `${raudhahAppointments.length} appointment date${raudhahAppointments.length > 1 ? "s" : ""} selected${
        raudhahStatusSummary ? ` (${raudhahStatusSummary})` : ""
      }`
    : "Appointment pending";
  const raudhahSecondaryTextMobile = hasRaudhahDates
    ? `${raudhahAppointments.length} date${raudhahAppointments.length > 1 ? "s" : ""} set`
    : "Pending";
  const rawSyarikahValue = group?.visaSetup?.syarikah?.trim() ?? "";
  const syarikahValue = rawSyarikahValue.toLowerCase() === "not assigned" ? "" : rawSyarikahValue;
  const providerName = syarikahValue || "Provider pending";
  
  const raudhahReminderTemplate = buildRaudhahReminderTemplate({
    groupCode: row.groupCode,
    groupName: row.groupName,
    totalPax,
    packageName: row.packageName,
    departureIso: row.departureIso,
    providerName,
    coordinatorName: group?.musyrif?.name,
    appointments: raudhahAppointments,
  });

  const buildHotelDraft = useCallback((
    city: "makkah" | "madinah",
    mode: "add" | "edit",
    hotelId?: string,
  ): VisaHotelEditFormState => {
    const cityHotels = getGroupAgreementHotelsByCity(group ?? undefined, city);
    const currentHotel = hotelId ? cityHotels.find((entry) => entry.id === hotelId) : cityHotels[0];
    const cityRange = resolveVisaAgreementDateRange(row, durationDays, group ?? undefined);

    if (mode === "add") {
      return {
        sourceDraftId: undefined,
        hotelName: "",
        agreementNumber: "",
        pax: totalPax.toString(),
        status: "Waiting for Approval",
        stayStartIso: city === "makkah" ? cityRange.makkahStartIso : cityRange.madinahStartIso,
        stayEndIso: city === "makkah" ? cityRange.makkahEndIso : cityRange.madinahEndIso,
      };
    }

    return {
      sourceDraftId: currentHotel?.sourceDraftId?.trim() || undefined,
      hotelName: currentHotel?.hotelName?.trim() || "",
      agreementNumber: currentHotel?.agreementNumber?.trim() || "",
      pax: currentHotel?.pax?.toString() || totalPax.toString(),
      status: currentHotel?.status ?? "Waiting for Approval",
      stayStartIso:
        currentHotel?.stayStartIso?.trim() ||
        (city === "makkah" ? cityRange.makkahStartIso : cityRange.madinahStartIso),
      stayEndIso:
        currentHotel?.stayEndIso?.trim() || (city === "makkah" ? cityRange.makkahEndIso : cityRange.madinahEndIso),
    };
  }, [group, row, durationDays, totalPax]);

  const buildHotelDraftFromAgreement = (agreement: GroupAgreementHotel): VisaHotelEditFormState => ({
    sourceDraftId: agreement.sourceDraftId?.trim() || undefined,
    hotelName: agreement.hotelName.trim(),
    agreementNumber: agreement.agreementNumber.trim(),
    pax: agreement.pax.toString(),
    status: agreement.status,
    stayStartIso: agreement.stayStartIso.trim(),
    stayEndIso: agreement.stayEndIso.trim(),
  });

  const buildRaudhahDraft = useCallback((): VisaRaudhahEditFormState => {
    return {
      appointments: (group?.visaSetup?.raudhahAppointments ?? [])
        .map((appointment, index) => ({
          id: appointment.id?.trim() || `${row.groupCode}-raudhah-${Date.now().toString(36)}-${index + 1}`,
          dateIso: appointment.dateIso?.trim() ?? "",
          status: appointment.status,
          tasrehPrinted: Boolean(appointment.tasrehPrinted),
        }))
        .filter((appointment) => appointment.dateIso.length > 0),
    };
  }, [group, row]);

  const openVisaStatusModal = () => {
    setActiveModal("visa-status");
  };

  const openVisaTypeModal = () => {
    setActiveModal("visa-type");
  };

  const openPaymentStatusModal = () => {
    setActiveModal("payment-status");
  };

  const openSyarikahModal = () => {
    setActiveModal("syarikah");
  };

  const openHotelModal = useCallback((
    city: "makkah" | "madinah",
    mode: "add" | "edit",
    hotelId?: string,
    seed?: VisaHotelEditFormState,
    ownerGroupCode?: string,
  ) => {
    setAddingHotelCity(null);
    setHotelCityDraft(city);
    setHotelDraftMode(mode);
    setHotelDraftId(mode === "edit" ? (hotelId ?? null) : null);
    setHotelDraftSeed(seed ?? null);
    setHotelDraftOwnerGroupCode(ownerGroupCode ?? null);
    setActiveModal("hotel");
  }, []);

  const openAgreementEditor = (
    city: "makkah" | "madinah",
    agreement: GroupAgreementHotel,
    isStoredAgreement: boolean,
  ) => {
    openHotelModal(city, "edit", isStoredAgreement ? agreement.id : undefined, buildHotelDraftFromAgreement(agreement), agreement.ownerGroupCode);
  };

  const openDeleteAgreementConfirm = (
    city: "makkah" | "madinah",
    agreement: GroupAgreementHotel,
    isStoredAgreement: boolean,
    draft?: HotelAgreementDraft,
  ) => {
    if (!isStoredAgreement) {
      return;
    }

    setDeleteAgreementDraft({ city, agreement, draft });
  };

  const openAddHotelInline = (city: "makkah" | "madinah") => {
    setActiveModal(null);
    setHotelDraftSeed(null);
    setAddingHotelCity(city);
    setDraftAssignFeedback(null);

    const groupArrival = group?.arrivalDate || row.departureIso || "";
    const groupReturn = group?.returnDate || row.returnIso || "";
    const existing = city === "makkah" ? makkahAgreements : madinahAgreements;
    const { start, end } = getUncoveredPeriod(city, groupArrival, groupReturn, existing);
    setCoverageStartIso(start);
    setCoverageEndIso(end);
  };

  const cancelAddHotelInline = () => {
    setAddingHotelCity(null);
  };

  const openRaudhahModal = () => {
    setActiveModal("raudhah");
  };

  const closeModal = useCallback(() => {
    setActiveModal(null);
    setHotelDraftSeed(null);
    setHotelDraftOwnerGroupCode(null);
  }, []);

  const handleOpenUnlinkModal = (g: GroupData) => setUnlinkingGroup(g);
  const handleCloseUnlinkModal = () => setUnlinkingGroup(null);
  const handleConfirmUnlink = () => {
    if (unlinkingGroup) {
      onSaveGroup({ ...unlinkingGroup, parentGroupId: null }, unlinkingGroup.code);
      setUnlinkingGroup(null);
    }
  };

  const openGroupEditModal = () => {
    if (!group) {
      return;
    }
    setIsGroupEditModalOpen(true);
  };

  const closeGroupEditModal = () => {
    setIsGroupEditModalOpen(false);
  };

  const openDeleteGroupModal = () => {
    if (!group) {
      return;
    }
    setIsDeleteGroupModalOpen(true);
  };

  const closeDeleteGroupModal = () => {
    setIsDeleteGroupModalOpen(false);
  };

  const confirmDeleteGroup = () => {
    setIsDeleteGroupModalOpen(false);
    onDeleteGroup(group?.code ?? row.groupCode);
  };

  const saveGroupEdit = ({
    code,
    name,
    pax,
    totalBuses,
    arrivalDate,
    returnDate,
    parentGroupId,
  }: {
    code: string;
    name: string;
    pax: number;
    totalBuses: number;
    arrivalDate: string;
    returnDate: string;
    parentGroupId?: string | null;
  }): { ok: true } | { ok: false; message: string } => {
    if (!group) {
      return { ok: false, message: "Group belum tersedia." };
    }

    const normalizedPax = Math.max(1, Math.floor(pax));
    const normalizedTotalBuses = resolveTotalBusCount(normalizedPax, totalBuses);
    const nextDurationDays = Math.max(
      1,
      Math.floor((Date.parse(returnDate) - Date.parse(arrivalDate)) / 86_400_000) + 1
    );

    const result = onSaveGroup(
      {
        ...group,
        code,
        name,
        pax: normalizedPax,
        totalBuses: normalizedTotalBuses,
        arrivalDate,
        returnDate,
        durationDays: nextDurationDays,
        parentGroupId,
      },
      group.code,
    );

    if (result.ok) {
      setIsGroupEditModalOpen(false);
    }

    return result;
  };

  const saveVisaStatus = (nextStatus: VisaStatus) => {
    onUpdateVisaStatus(row.groupCode, nextStatus);
    closeModal();
  };

  const saveVisaType = (nextType: "Visa Only" | "Visa+") => {
    onUpdateVisaType(row.groupCode, nextType);
    closeModal();
  };

  const savePaymentStatus = (nextValue: VisaPaymentStatus) => {
    onUpdatePaymentStatus(row.groupCode, nextValue);
    setPaymentStatus(nextValue);
    closeModal();
  };

  const saveSyarikah = (nextValue: string) => {
    onUpdateSyarikah(row.groupCode, nextValue);
    closeModal();
  };

  const saveHotel = (hotel: VisaHotelEditFormState) => {
    const targetGroupCode = hotelDraftOwnerGroupCode ?? activeGroupCode;
    onUpdateVisaHotel(
      targetGroupCode,
      hotelCityDraft,
      hotel,
      hotelDraftMode === "edit" ? (hotelDraftId ?? undefined) : undefined,
    );
    closeModal();
  };

  const saveRaudhah = (appointment: VisaRaudhahEditFormState) => {
    onUpdateRaudhahAppointment(row.groupCode, appointment);
    closeModal();
  };

  const assignAgreementDraft = async (
    draft: HotelAgreementDraft,
    selectedStart?: string,
    selectedEnd?: string,
  ) => {
    setAssigningAgreementDraftId(draft.id);
    setDraftAssignFeedback(null);
    try {
      await assignAgreementDraftInBackend({
        draftId: draft.id,
        groupCode: activeGroupCode,
        stayStartIso: selectedStart,
        stayEndIso: selectedEnd,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: groupQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all }),
      ]);
      setAddingHotelCity(null);
      setDraftAssignFeedback({
        tone: "success",
        message: `Agreement ${draft.agreementNumber} berhasil di-assign ke group ${activeGroupCode}.`,
      });
    } catch (error: unknown) {
      setDraftAssignFeedback({
        tone: "error",
        message: formatVisaMutationError(error, "Agreement belum berhasil di-assign."),
      });
    } finally {
      setAssigningAgreementDraftId(null);
    }
  };

  const clearRaudhah = () => {
    onClearRaudhahAppointment(row.groupCode);
    setIsClearRaudhahConfirmOpen(false);
    closeModal();
  };

  const deleteAgreement = async () => {
    if (!deleteAgreementDraft) {
      return;
    }

    if (!deleteAgreementDraft.draft) {
      const targetGroupCode = deleteAgreementDraft.agreement.ownerGroupCode ?? activeGroupCode;
      onDeleteVisaHotel(targetGroupCode, deleteAgreementDraft.city, deleteAgreementDraft.agreement.id);
      setDeleteAgreementDraft(null);
      return;
    }

    setUnassigningAgreementDraftId(deleteAgreementDraft.draft.id);
    setDraftAssignFeedback(null);
    try {
      await unassignAgreementDraftInBackend({
        draftId: deleteAgreementDraft.draft.id,
        groupCode: deleteAgreementDraft.agreement.ownerGroupCode ?? activeGroupCode,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: groupQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all }),
      ]);
      setDraftAssignFeedback({
        tone: "success",
        message: `Agreement ${deleteAgreementDraft.agreement.agreementNumber} berhasil dikembalikan ke Unassigned.`,
      });
    } catch (error: unknown) {
      setDraftAssignFeedback({
        tone: "error",
        message: formatVisaMutationError(error, "Agreement belum berhasil di-unassign dari group."),
      });
    } finally {
      setUnassigningAgreementDraftId(null);
      setDeleteAgreementDraft(null);
    }
  };

  const handleCopyRaudhahReminder = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(raudhahReminderTemplate);
      }
    } catch {
      // No-op fallback
    }

    setIsRaudhahTemplateCopied(true);
    if (raudhahCopyTimerRef.current !== null) {
      window.clearTimeout(raudhahCopyTimerRef.current);
    }

    raudhahCopyTimerRef.current = window.setTimeout(() => {
      setIsRaudhahTemplateCopied(false);
      raudhahCopyTimerRef.current = null;
    }, 1600);
  };

  const handleCopyWhatsapp = async () => {
    const text = generateWhatsappCopyText(operationalGroup ?? group ?? undefined, familyGroups);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // fallback
    }

    setIsWhatsappCopied(true);
    if (whatsappCopyTimerRef.current !== null) {
      window.clearTimeout(whatsappCopyTimerRef.current);
    }
    whatsappCopyTimerRef.current = window.setTimeout(() => {
      setIsWhatsappCopied(false);
      whatsappCopyTimerRef.current = null;
    }, 1600);
  };

  useEffect(() => {
    setPaymentStatus(row.paymentStatus);
  }, [row.id, row.paymentStatus]);

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
    if (!hasBlockingModal) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
        setUnlinkingGroup(null);
        setIsGroupEditModalOpen(false);
        setIsDeleteGroupModalOpen(false);
        setIsClearRaudhahConfirmOpen(false);
        setDeleteAgreementDraft(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasBlockingModal, closeModal]);

  useEffect(() => {
    setAddingHotelCity(null);
    setHotelDraftSeed(null);
    setIsGroupEditModalOpen(false);
    setIsDeleteGroupModalOpen(false);
    setUnlinkingGroup(null);
    setDeleteAgreementDraft(null);
    setIsRaudhahTemplateCopied(false);
    setIsWhatsappCopied(false);
    setIsClearRaudhahConfirmOpen(false);
  }, [row.id]);

  useEffect(
    () => () => {
      if (raudhahCopyTimerRef.current !== null) {
        window.clearTimeout(raudhahCopyTimerRef.current);
        raudhahCopyTimerRef.current = null;
      }
      if (whatsappCopyTimerRef.current !== null) {
        window.clearTimeout(whatsappCopyTimerRef.current);
        whatsappCopyTimerRef.current = null;
      }
    },
    [],
  );

  return {
    row,
    group,
    groups,
    familyGroups,
    activeGroupCode,
    setActiveGroupCode,
    unlinkingGroup,
    setUnlinkingGroup,
    paymentStatus,
    setPaymentStatus,
    activeModal,
    setActiveModal,
    hotelCityDraft,
    setHotelCityDraft,
    hotelDraftMode,
    setHotelDraftMode,
    hotelDraftId,
    setHotelDraftId,
    hotelDraftSeed,
    setHotelDraftSeed,
    hotelDraftOwnerGroupCode,
    setHotelDraftOwnerGroupCode,
    addingHotelCity,
    setAddingHotelCity,
    coverageStartIso,
    setCoverageStartIso,
    coverageEndIso,
    setCoverageEndIso,
    isGroupEditModalOpen,
    setIsGroupEditModalOpen,
    isDeleteGroupModalOpen,
    setIsDeleteGroupModalOpen,
    deleteAgreementDraft,
    setDeleteAgreementDraft,
    assigningAgreementDraftId,
    unassigningAgreementDraftId,
    draftAssignFeedback,
    setDraftAssignFeedback,
    isRaudhahTemplateCopied,
    isClearRaudhahConfirmOpen,
    setIsClearRaudhahConfirmOpen,
    isWhatsappCopied,
    
    // Computed values
    totalPax,
    requiredBusCount,
    durationDays,
    agreementDateRange,
    makkahAgreements,
    madinahAgreements,
    availableAgreementDraftsByCity,
    assignedDraftByAgreementId,
    makkahAssigned,
    madinahAssigned,
    makkahMissing,
    madinahMissing,
    visaTone,
    paymentTone,
    raudhahAppointments,
    hasRaudhahDates,
    raudhahTone,
    raudhahStatusText,
    raudhahStatusSummary,
    raudhahSecondaryText,
    raudhahSecondaryTextMobile,
    providerName,
    raudhahReminderTemplate,
    shouldShowLinkAgreementAction,
    primaryAgreementMessage,
    agreementIssues,
    
    // Refs
    clearRaudhahDialogRef,
    deleteAgreementDialogRef,
    
    // Handlers
    onBack,
    openVisaStatusModal,
    openVisaTypeModal,
    openPaymentStatusModal,
    openSyarikahModal,
    openHotelModal,
    openAgreementEditor,
    openDeleteAgreementConfirm,
    openAddHotelInline,
    cancelAddHotelInline,
    openRaudhahModal,
    closeModal,
    handleOpenUnlinkModal,
    handleCloseUnlinkModal,
    handleConfirmUnlink,
    openGroupEditModal,
    closeGroupEditModal,
    openDeleteGroupModal,
    closeDeleteGroupModal,
    confirmDeleteGroup,
    saveGroupEdit,
    saveVisaStatus,
    saveVisaType,
    savePaymentStatus,
    saveSyarikah,
    saveHotel,
    saveRaudhah,
    onUpdatePaymentStatus,
    assignAgreementDraft,
    clearRaudhah,
    deleteAgreement,
    handleCopyRaudhahReminder,
    handleCopyWhatsapp,
    buildHotelDraft,
    buildRaudhahDraft,
  };
}
