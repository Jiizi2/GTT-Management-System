import { createContext, useContext } from "react";
import type {
  GroupData,
  VisaTrackingRow,
  VisaStatus,
  VisaPaymentStatus,
  VisaHotelEditFormState,
  VisaRaudhahEditFormState,
  GroupAgreementHotel,
  HotelAgreementDraft,
} from "../../../shared/app-domain";

export interface VisaDetailContextType {
  row: VisaTrackingRow;
  group: GroupData | null;
  groups: GroupData[];
  familyGroups: GroupData[];
  activeGroupCode: string;
  setActiveGroupCode: (code: string) => void;
  unlinkingGroup: GroupData | null;
  setUnlinkingGroup: (group: GroupData | null) => void;
  paymentStatus: VisaPaymentStatus;
  setPaymentStatus: (status: VisaPaymentStatus) => void;
  activeModal: "visa-status" | "payment-status" | "syarikah" | "hotel" | "raudhah" | "visa-type" | null;
  setActiveModal: (modal: "visa-status" | "payment-status" | "syarikah" | "hotel" | "raudhah" | "visa-type" | null) => void;
  hotelCityDraft: "makkah" | "madinah";
  setHotelCityDraft: (city: "makkah" | "madinah") => void;
  hotelDraftMode: "add" | "edit";
  setHotelDraftMode: (mode: "add" | "edit") => void;
  hotelDraftId: string | null;
  setHotelDraftId: (id: string | null) => void;
  hotelDraftSeed: VisaHotelEditFormState | null;
  setHotelDraftSeed: (seed: VisaHotelEditFormState | null) => void;
  hotelDraftOwnerGroupCode: string | null;
  setHotelDraftOwnerGroupCode: (code: string | null) => void;
  addingHotelCity: "makkah" | "madinah" | null;
  setAddingHotelCity: (city: "makkah" | "madinah" | null) => void;
  coverageStartIso: string;
  setCoverageStartIso: (iso: string) => void;
  coverageEndIso: string;
  setCoverageEndIso: (iso: string) => void;
  isGroupEditModalOpen: boolean;
  setIsGroupEditModalOpen: (open: boolean) => void;
  isDeleteGroupModalOpen: boolean;
  setIsDeleteGroupModalOpen: (open: boolean) => void;
  deleteAgreementDraft: {
    city: "makkah" | "madinah";
    agreement: GroupAgreementHotel;
    draft?: HotelAgreementDraft;
  } | null;
  setDeleteAgreementDraft: (draft: {
    city: "makkah" | "madinah";
    agreement: GroupAgreementHotel;
    draft?: HotelAgreementDraft;
  } | null) => void;
  assigningAgreementDraftId: string | null;
  unassigningAgreementDraftId: string | null;
  draftAssignFeedback: {
    tone: "success" | "error";
    message: string;
  } | null;
  setDraftAssignFeedback: (feedback: { tone: "success" | "error"; message: string } | null) => void;
  isRaudhahTemplateCopied: boolean;
  isClearRaudhahConfirmOpen: boolean;
  setIsClearRaudhahConfirmOpen: (open: boolean) => void;
  isWhatsappCopied: boolean;
  agreementDraftsQueryLoading?: boolean;
  agreementDraftsQueryError?: boolean;
  
  // Computed values
  totalPax: number;
  requiredBusCount: number;
  durationDays: number;
  agreementDateRange: {
    makkahStartIso: string;
    makkahEndIso: string;
    madinahStartIso: string;
    madinahEndIso: string;
  };
  makkahAgreements: GroupAgreementHotel[];
  madinahAgreements: GroupAgreementHotel[];
  availableAgreementDraftsByCity: { makkah: HotelAgreementDraft[]; madinah: HotelAgreementDraft[] };
  assignedDraftByAgreementId: Map<string, HotelAgreementDraft>;
  makkahAssigned: number;
  madinahAssigned: number;
  makkahMissing: number;
  madinahMissing: number;
  visaTone: "success" | "warning" | "muted" | "info" | "error";
  paymentTone: "success" | "warning" | "muted" | "info" | "error";
  raudhahAppointments: Array<{ dateIso: string; status: string; dateLabel: string }>;
  hasRaudhahDates: boolean;
  raudhahTone: "success" | "warning" | "muted" | "info" | "error";
  raudhahStatusText: string;
  raudhahStatusSummary: string;
  raudhahSecondaryText: string;
  raudhahSecondaryTextMobile: string;
  providerName: string;
  raudhahReminderTemplate: string;
  shouldShowLinkAgreementAction: boolean;
  primaryAgreementMessage: string;
  agreementIssues: Array<{ key: string; label: string; message: string }>;
  clearRaudhahDialogRef: React.RefObject<HTMLDivElement | null>;
  deleteAgreementDialogRef: React.RefObject<HTMLDivElement | null>;
  
  // Callbacks / Action Handlers
  onBack: () => void;
  openVisaStatusModal: () => void;
  openVisaTypeModal: () => void;
  openPaymentStatusModal: () => void;
  openSyarikahModal: () => void;
  openHotelModal: (
    city: "makkah" | "madinah",
    mode: "add" | "edit",
    hotelId?: string,
    seed?: VisaHotelEditFormState,
    ownerGroupCode?: string,
  ) => void;
  openAgreementEditor: (
    city: "makkah" | "madinah",
    agreement: GroupAgreementHotel,
    isStoredAgreement: boolean,
  ) => void;
  openDeleteAgreementConfirm: (
    city: "makkah" | "madinah",
    agreement: GroupAgreementHotel,
    isStoredAgreement: boolean,
    draft?: HotelAgreementDraft,
  ) => void;
  openAddHotelInline: (city: "makkah" | "madinah") => void;
  cancelAddHotelInline: () => void;
  openRaudhahModal: () => void;
  closeModal: () => void;
  handleOpenUnlinkModal: (g: GroupData) => void;
  handleCloseUnlinkModal: () => void;
  handleConfirmUnlink: () => void;
  openGroupEditModal: () => void;
  closeGroupEditModal: () => void;
  openDeleteGroupModal: () => void;
  closeDeleteGroupModal: () => void;
  confirmDeleteGroup: () => void;
  saveGroupEdit: (val: any) => { ok: true } | { ok: false; message: string };
  saveVisaStatus: (nextStatus: VisaStatus) => void;
  saveVisaType: (nextType: "Visa Only" | "Visa+") => void;
  savePaymentStatus: (nextValue: VisaPaymentStatus) => void;
  saveSyarikah: (nextValue: string) => void;
  saveHotel: (hotel: VisaHotelEditFormState) => void;
  saveRaudhah: (appointment: VisaRaudhahEditFormState) => void;
  onUpdatePaymentStatus: (groupCode: string, paymentStatus: VisaPaymentStatus) => void;
  assignAgreementDraft: (draft: HotelAgreementDraft, selectedStart?: string, selectedEnd?: string) => Promise<void>;
  clearRaudhah: () => void;
  deleteAgreement: () => Promise<void>;
  handleCopyRaudhahReminder: () => Promise<void>;
  handleCopyWhatsapp: () => Promise<void>;
  buildHotelDraft: (city: "makkah" | "madinah", mode: "add" | "edit", hotelId?: string) => VisaHotelEditFormState;
  buildRaudhahDraft: () => VisaRaudhahEditFormState;
}

export const VisaDetailContext = createContext<VisaDetailContextType | null>(null);

export function useVisaDetailContext() {
  const context = useContext(VisaDetailContext);
  if (!context) {
    throw new Error("useVisaDetailContext must be used within VisaDetailProvider");
  }
  return context;
}
