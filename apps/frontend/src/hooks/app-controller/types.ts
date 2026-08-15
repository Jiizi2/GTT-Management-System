import type {
  AgreementApprovalStatus,
  GroupData,
  GroupVisaSetup,
  NavId,
  SessionAccessTier,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaRaudhahEditFormState,
  VisaStatus,
  VisaTrackingRow,
} from "../../shared/app-domain";
import type {
  GroupFetchProjection,
  GroupIdentityDraftPayload,
} from "../use-app-controller-backend";

export type OverviewStatCard = {
  label: string;
  value: string;
  subtitle?: string;
  icon: string;
  tone: "primary" | "secondary" | "tertiary";
};

export type OverviewMonthOption = {
  value: string;
  label: string;
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
  overviewMonthFilter: string;
  overviewMonthOptions: OverviewMonthOption[];
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
  handleDeleteVisaGroup: (groupCode: string) => void;
  handleOpenVisaDetail: (row: VisaTrackingRow) => void;
  handleUpdateAgreementStatus: (groupCode: string, city: "makkah" | "madinah", status: AgreementApprovalStatus) => void;
  handleUpdateVisaStatus: (groupCode: string, visaStatus: VisaStatus, issuedDateIso?: string) => void;
  handleUpdateVisaType: (groupCode: string, visaType: "Visa Only" | "Visa+") => void;
  handleToggleHotelWaiver: (groupCode: string, city: "makkah" | "madinah", waived: boolean) => void;
  handleUpdatePaymentStatus: (groupCode: string, paymentStatus: VisaPaymentStatus) => void;
  handleUpdateSyarikah: (groupCode: string, syarikah: string) => void;
  handleUpdateVisaHotel: (
    groupCode: string,
    city: "makkah" | "madinah",
    hotel: VisaHotelEditFormState,
    hotelId?: string,
  ) => void;
  handleDeleteVisaHotel: (groupCode: string, city: "makkah" | "madinah", hotelId: string) => void;
  handleUpdateRaudhahAppointment: (groupCode: string, appointment: VisaRaudhahEditFormState) => void;
  handleSetRaudhahTasrehPrinted: (groupCode: string, appointmentId: string, tasrehPrinted: boolean) => void;
  handleClearRaudhahAppointment: (groupCode: string) => void;
  handleBackToVisaTracking: () => void;
  handleOpenNewGroup: () => void;
  handleSaveInputGroup: (group: GroupData) => void;
  handleSaveGroupIdentity: (identity: GroupIdentityDraftPayload) => void;
  handleSaveGroupDetail: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  handleSaveGroupItinerary: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  handlePatchGroupDetail: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  handleSaveVisaGroupDetail: (
    group: GroupData,
    sourceGroupCode?: string,
  ) => { ok: true } | { ok: false; message: string };
  dismissSyncFeedback: () => void;
  handleQueryChange: (value: string) => void;
  handleToggleActiveOnly: (value: boolean) => void;
  handleOverviewMonthFilterChange: (value: string) => void;
  toggleSidebarCollapse: () => void;
};

/**
 * Snapshot of the record list taken before an optimistic mutation, so a failed
 * backend sync can roll the UI back to exactly what the user last saw.
 */
export type GroupRecordsSnapshot = {
  groupRecords: GroupData[];
  projection: GroupFetchProjection;
  activeOnly: boolean;
};

/** Either a fixed message or one derived from the error the backend returned. */
export type SyncFailureMessage = string | ((error: unknown) => string);

/**
 * The optimistic-update primitive the visa and Raudhah mutations are built on:
 * apply `updater` to a group's visa setup, commit it locally, then sync.
 * Extracted so those mutation groups can live outside the dashboard hook.
 */
export type UpdateVisaSetupForGroupAndSync = (
  groupCode: string,
  updater: (args: { group: GroupData; row: VisaTrackingRow; visaSetup: GroupVisaSetup }) => GroupVisaSetup,
  syncMessages?: {
    successMessage?: string;
    failureMessage?: string;
  },
) => void;
