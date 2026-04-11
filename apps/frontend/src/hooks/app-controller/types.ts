import type {
  AgreementApprovalStatus,
  GroupData,
  NavId,
  SessionAccessTier,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaRaudhahEditFormState,
  VisaStatus,
  VisaTrackingRow,
} from "../../shared/app-domain";

export type OverviewStatCard = {
  label: string;
  value: string;
  subtitle?: string;
  icon: string;
  tone: "primary" | "secondary" | "tertiary";
};

export type SyncFeedback = {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
};

export type AppController = {
  groupRecords: GroupData[];
  isGroupRecordsLoading: boolean;
  sessionAccessTier: SessionAccessTier;
  activeNav: NavId;
  query: string;
  isActiveOnly: boolean;
  selectedGroupCode: string | null;
  selectedGroup: GroupData | null;
  selectedVisaGroupCode: string | null;
  selectedVisaRow: VisaTrackingRow | null;
  isSidebarCollapsed: boolean;
  filteredGroups: GroupData[];
  statCards: OverviewStatCard[];
  summaryMessage: string;
  syncFeedback: SyncFeedback | null;
  handleNavigate: (navId: NavId) => void;
  handleOpenDetail: (groupCode: string) => void;
  handleBackToOverview: () => void;
  handleDeleteGroup: (groupCode: string) => void;
  handleOpenVisaDetail: (row: VisaTrackingRow) => void;
  handleUpdateAgreementStatus: (
    groupCode: string,
    city: "makkah" | "madinah",
    status: AgreementApprovalStatus,
  ) => void;
  handleUpdateVisaStatus: (groupCode: string, visaStatus: VisaStatus) => void;
  handleUpdatePaymentStatus: (groupCode: string, paymentStatus: VisaPaymentStatus) => void;
  handleUpdateSyarikah: (groupCode: string, syarikah: string) => void;
  handleUpdateVisaHotel: (
    groupCode: string,
    city: "makkah" | "madinah",
    hotel: VisaHotelEditFormState,
    hotelId?: string,
  ) => void;
  handleDeleteVisaHotel: (
    groupCode: string,
    city: "makkah" | "madinah",
    hotelId: string,
  ) => void;
  handleUpdateRaudhahAppointment: (
    groupCode: string,
    appointment: VisaRaudhahEditFormState,
  ) => void;
  handleSetRaudhahTasrehPrinted: (
    groupCode: string,
    appointmentId: string,
    tasrehPrinted: boolean,
  ) => void;
  handleClearRaudhahAppointment: (groupCode: string) => void;
  handleBackToVisaTracking: () => void;
  handleOpenNewGroup: () => void;
  handleSaveInputGroup: (group: GroupData) => void;
  handleSaveGroupDetail: (
    group: GroupData,
    sourceGroupCode?: string,
  ) => { ok: true } | { ok: false; message: string };
  dismissSyncFeedback: () => void;
  handleQueryChange: (value: string) => void;
  handleToggleActiveOnly: (value: boolean) => void;
  toggleSidebarCollapse: () => void;
};
