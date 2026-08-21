import { createContext, useContext } from "react";
import type {
  GroupData,
  Musyrif,
  ItineraryItem,
  NoteItem,
  ScheduleFormState,
  EditScheduleFormState,
} from "../../../shared/app-domain";

export interface GroupDetailContextType {
  readOnly: boolean;
  group: GroupData;
  groups: GroupData[];
  familyGroups: GroupData[];
  childGroupCount: number;
  totalPax: number;
  itineraryItems: ItineraryItem[];
  noteItems: NoteItem[];
  musyrifProfile: Musyrif;
  isMusyrifModalOpen: boolean;
  isMusyrifCopied: boolean;
  isWhatsappCopied: boolean;
  isScheduleModalOpen: boolean;
  scheduleForm: ScheduleFormState;
  pendingScheduleItems: ItineraryItem[];
  isScheduleCommitDisabled: boolean;
  editingIndex: number | null;
  editScheduleForm: EditScheduleFormState | null;
  deletingIndex: number | null;
  isNoteModalOpen: boolean;
  isDeleteGroupModalOpen: boolean;
  isGroupEditModalOpen: boolean;
  unlinkingGroup: GroupData | null;
  requiredBusCount: number;
  onBack: () => void;
  onDeleteGroup: (groupCode: string) => void;
  onSaveGroup: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  onPatchGroup: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  deletingItem: ItineraryItem | null;
  hasOpenModal: boolean;
  isEditModalOpen: boolean;
  isDeleteModalOpen: boolean;
  isUnlinkModalOpen: boolean;

  // Handlers
  handleSaveSchedule: () => void;
  handleAddAnotherSchedule: () => void;
  handleRemovePendingSchedule: (index: number) => void;
  handleCloseScheduleModal: () => void;
  handleOpenScheduleModal: () => void;
  handleScheduleFieldChange: (field: keyof ScheduleFormState, value: any) => void;
  handleOpenEditModal: (index: number) => void;
  handleCloseEditModal: () => void;
  handleEditFieldChange: (field: keyof EditScheduleFormState, value: any) => void;
  handleSaveEditedSchedule: () => void;
  handleOpenDeleteModal: (index: number) => void;
  handleCloseDeleteModal: () => void;
  handleConfirmDelete: () => void;
  handleOpenNoteModal: () => void;
  handleCloseNoteModal: () => void;
  handleSaveNote: (note: { text: string; pinned: boolean }) => void;
  handleSaveMusyrif: (musyrif: { name: string; phone: string }) => void;
  handleOpenMusyrifModal: () => void;
  handleCloseMusyrifModal: () => void;
  handleCopyMusyrif: () => void;
  handleCopyWhatsapp: () => void;
  handleExportPdf: () => void;
  handleDeleteGroupBtn: () => void;
  handleCloseDeleteGroupModal: () => void;
  handleConfirmDeleteGroup: () => void;
  handleOpenGroupEditModal: () => void;
  handleCloseGroupEditModal: () => void;
  handleSaveGroupEdit: (val: any) => { ok: true } | { ok: false; message: string };
  handleOpenUnlinkModal: (g: GroupData) => void;
  handleCloseUnlinkModal: () => void;
  handleConfirmUnlink: () => void;

  // Helpers/Autofill properties
  isScheduleSaveDisabled: boolean;
  showScheduleFridayCityTourWarning: boolean;
  isEditSaveDisabled: boolean;
  showEditFridayCityTourWarning: boolean;
  compactAgreementSummaries: any[];
  completeness: any;
  displayedNextActivity: any;
  shouldShowLinkAgreementAction: boolean;
  shouldShowCreateItineraryAction: boolean;
  isDarkMode: boolean;
}

export const GroupDetailContext = createContext<GroupDetailContextType | null>(null);

export function useGroupDetailContext() {
  const context = useContext(GroupDetailContext);
  if (!context) {
    throw new Error("useGroupDetailContext must be used within GroupDetailProvider");
  }
  return context;
}
