export type NavId =
  | "overview"
  | "statistics"
  | "input"
  | "checklist"
  | "visa"
  | "agreement-inbox"
  | "new-group"
  | "invoice"
  | "raudhah-reminder"
  | "user-management"
  | "master-data"
  | "profile";

export type NavItem = {
  id: NavId;
  label: string;
  icon: string;
};

export type SessionAccessTier = "super-admin" | "admin";

export type StatusTone = "active" | "inactive";

export type GroupLifecycleStatus = "ENTRY_ONLY" | "ACTIVE" | "INACTIVE" | "COMPLETED" | "ARCHIVED";

export type TimelineItem = {
  date: string;
  title: string;
  isCurrent?: boolean;
  nextActivity?: string;
};

export type NextActivity = {
  title: string;
  date: string;
  time: string;
  icon: string;
};

export type ItineraryItem = {
  date: string;
  year: string;
  category: string;
  title: string;
  meta: string;
  icon: string;
  highlighted?: boolean;
  categoryKey?: string;
  isoDate?: string;
  time?: string;
  flightNumber?: string;
  hotelName?: string;
  fromHotelName?: string;
  from?: string;
  to?: string;
  cityTourCity?: string;
  requiresBus?: boolean;
  notes?: string;
  transferByTrain?: boolean;
  trainDepartureTime?: string;
  destinationPickupTime?: string;
  hotelPickupRequestTime?: string;
};

export type NoteItem = {
  id: string;
  text: string;
  pinned: boolean;
};

export type Musyrif = {
  name: string;
  phone: string;
  avatar: string;
};

export type AgreementApprovalStatus = "Waiting for Approval" | "Approved" | "Rejected";

export type GroupRaudhahStatus = "Free" | "After" | "Before";

export type BusStatus = "Visa Only" | "Visa+";

export type GroupAgreementHotel = {
  id: string;
  sourceDraftId?: string;
  hotelName: string;
  agreementNumber: string;
  pax: number;
  status: AgreementApprovalStatus;
  stayStartIso: string;
  stayEndIso: string;
  ownerGroupCode?: string;
};

export type GroupRaudhahAppointment = {
  id: string;
  dateIso: string;
  status: GroupRaudhahStatus;
  tasrehPrinted?: boolean;
};

export type GroupVisaSetup = {
  visaStatus: "Draft" | "Pending" | "Issued";
  issuedDate?: string;
  syarikah: string;
  busStatus?: BusStatus;
  paymentStatus: "Paid" | "Unpaid" | "Partial";
  makkahHotelWaived?: boolean;
  madinahHotelWaived?: boolean;
  makkahHotels: GroupAgreementHotel[];
  madinahHotels: GroupAgreementHotel[];
  raudhahAppointments: GroupRaudhahAppointment[];
};

export type GroupData = {
  id?: string;
  agentId?: string;
  agent?: {
    id: string;
    code: string;
    name: string;
    type: "DIRECT" | "PARTNER";
    status: "ACTIVE" | "INACTIVE";
    picName?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  code: string;
  name: string;
  status: string;
  lifecycleStatus?: GroupLifecycleStatus;
  tone: StatusTone;
  pax: number;
  totalBuses?: number;
  packageName: string;
  durationDays: number;
  arrivalDate?: string;
  returnDate?: string;
  timeline: [TimelineItem, TimelineItem];
  nextActivity: NextActivity;
  itinerary: ItineraryItem[];
  notes: string[];
  musyrif: Musyrif;
  visaSetup?: GroupVisaSetup;
  checklistAssignments?: GroupChecklistAssignment[];
  parentGroupId?: string | null;
};

export type GroupCompletenessIssueKey =
  | "missing-identity"
  | "missing-agreement"
  | "missing-makkah-agreement"
  | "missing-madinah-agreement"
  | "missing-itinerary"
  | "pax-mismatch"
  | "date-mismatch";

export type GroupCompletenessIssue = {
  key: GroupCompletenessIssueKey;
  severity: "warning" | "error";
  label: string;
  message: string;
};

export type GroupCompletenessState = "ready" | "incomplete" | "action-required";

export type GroupCompletenessSummary = {
  state: GroupCompletenessState;
  isReadyForOperations: boolean;
  issues: GroupCompletenessIssue[];
  primaryMessage: string;
  badgeLabel: string;
};

export type ScheduleFormState = {
  category: string;
  date: string;
  time: string;
  flightNumber: string;
  hotelName: string;
  fromHotelName: string;
  from: string;
  to: string;
  cityTourCity: string;
  note: string;
  highlighted: boolean;
  transferByTrain: boolean;
  trainDepartureTime: string;
  destinationPickupTime: string;
  hotelPickupRequestTime: string;
};

export type EditScheduleFormState = {
  date: string;
  time: string;
  category: string;
  flightNumber: string;
  hotelName: string;
  fromHotelName: string;
  from: string;
  to: string;
  cityTourCity: string;
  requiresBus: boolean;
  notes: string;
  transferByTrain: boolean;
  trainDepartureTime: string;
  destinationPickupTime: string;
  hotelPickupRequestTime: string;
};

export type NoteFormState = {
  text: string;
  pinned: boolean;
};

export type MusyrifFormState = {
  name: string;
  phone: string;
};

export type ChecklistItem = {
  id: string;
  groupCode: string;
  groupName: string;
  groupPax: number;
  agentId?: string;
  agentName?: string;
  tripDate: string;
  activity: string;
  trip: string;
  activityIcon: string;
  requiredBusCount: number;
  scheduledTime: string;
  transferByTrain: boolean;
  trainDepartureTime: string;
  stationPickupTime: string;
  hotelPickupRequestTime: string;
  departureFlightTime: string;
  groupCodes?: string[];
};

export type ChecklistDriverProfile = {
  name: string;
  phone: string;
  plateNumber: string;
  isVerified?: boolean;
};

export type ChecklistAssignmentStatus = "Not Complete" | "Assigned";

export type GroupChecklistAssignment = {
  id: string;
  itineraryItemId?: string;
  tripDate: string;
  activity: string;
  tripLabel: string;
  requiredBusCount: number;
  scheduledTime: string;
  transferByTrain: boolean;
  trainDepartureTime: string;
  stationPickupTime: string;
  status: ChecklistAssignmentStatus;
  drivers: ChecklistDriverProfile[];
};

export type ChecklistDriverDraft = ChecklistDriverProfile;

export type ChecklistDriverAssignment = {
  drivers: ChecklistDriverProfile[];
};

export type VisaFilterId = "all" | "not-issued" | "missing-hotel" | "unpaid" | "visa-only" | "visa-plus";

export type VisaStatus = "Issued" | "Draft" | "Pending";

export type VisaPaymentStatus = "Paid" | "Unpaid" | "Partial";

export type VisaRaudhahTone = "good" | "warn" | "muted";

export type AgreementDraftAssignmentStatus = "Unassigned" | "Assigned" | "Partially Assigned";

export type HotelAgreementDraft = {
  id: string;
  agentId: string;
  city: "makkah" | "madinah";
  agentName: string;
  groupName?: string;
  hotelName: string;
  agreementNumber: string;
  pax: number;
  remainingPax?: number;
  assignedGroups?: Array<{ groupCode: string; pax: number; stayStartIso?: string; stayEndIso?: string }>;
  status: AgreementApprovalStatus;
  stayStartIso: string;
  stayEndIso: string;
  notes: string;
  assignmentStatus: AgreementDraftAssignmentStatus;
  createdAtIso: string;
  updatedAtIso: string;
};

export type HotelAgreementDraftFormState = {
  city: "makkah" | "madinah";
  agentId: string;
  groupName: string;
  hotelName: string;
  agreementNumber: string;
  pax: string;
  status: AgreementApprovalStatus;
  stayStartIso: string;
  stayEndIso: string;
  notes: string;
};

export type VisaTrackingRow = {
  id: string;
  groupCode: string;
  groupName: string;
  pax: number;
  packageName: string;
  issuedDateIso: string;
  departureIso: string;
  returnIso: string;
  visaStatus: VisaStatus;
  paymentStatus: VisaPaymentStatus;
  raudhahLabel: string;
  raudhahHint: string;
  raudhahTone: VisaRaudhahTone;
  makkahVerified: number;
  madinahVerified: number;
  makkahHotelWaived: boolean;
  madinahHotelWaived: boolean;
  parentGroupId?: string | null;
};

export type InputItineraryItem = {
  id: string;
  date: string;
  time: string;
  category: string;
  categoryKey: string;
  hotelName?: string;
  fromHotelName?: string;
  from: string;
  to: string;
  cityTourCity: string;
  flightNumber: string;
  requiresBus: boolean;
  notes: string;
  icon: string;
  transferByTrain: boolean;
  trainDepartureTime: string;
  destinationPickupTime: string;
  hotelPickupRequestTime: string;
};

export type InputItineraryFormState = {
  date: string;
  time: string;
  category: string;
  hotelName?: string;
  fromHotelName?: string;
  from: string;
  to: string;
  cityTourCity: string;
  flightNumber: string;
  requiresBus: boolean;
  notes: string;
  transferByTrain: boolean;
  trainDepartureTime: string;
  destinationPickupTime: string;
  hotelPickupRequestTime: string;
};

export type NewGroupItineraryDraft = {
  agentId?: string;
  groupCode?: string;
  groupName?: string;
  pax?: number;
  totalBuses?: number;
  packageName?: string;
  startDate?: string;
  endDate?: string;
  musyrifName?: string;
  musyrifPhone?: string;
  busStatus?: BusStatus;
  itinerary?: ItineraryItem[];
  timeline?: [TimelineItem, TimelineItem];
  nextActivity?: NextActivity;
  durationDays?: number;
  notes?: string[];
};

export type ItineraryPrefillTrip = {
  date?: string;
  hotelName?: string;
  from?: string;
  to?: string;
  cityTourCity?: string;
  flightNumber?: string;
  hotelPickupRequestTime?: string;
};

export type ItineraryPrefill = {
  startDate?: string;
  endDate?: string;
  cityHotelNames?: {
    makkah?: string;
    madinah?: string;
  };
  trips?: Partial<Record<string, ItineraryPrefillTrip>>;
};

export type NewGroupAgreementFormState = {
  id: string;
  sourceDraftId?: string;
  hotelName: string;
  agreementNumber: string;
  pax: string;
  status: AgreementApprovalStatus;
  stayStartIso: string;
  stayEndIso: string;
};

export type NewGroupRaudhahFormState = {
  id: string;
  dateIso: string;
  status: GroupRaudhahStatus;
  tasrehPrinted?: boolean;
};

export type VisaHotelEditFormState = {
  sourceDraftId?: string;
  hotelName: string;
  agreementNumber: string;
  pax: string;
  status: AgreementApprovalStatus;
  stayStartIso: string;
  stayEndIso: string;
};

export type VisaRaudhahEditFormState = {
  appointments: Array<{
    id: string;
    dateIso: string;
    status: GroupRaudhahStatus;
    tasrehPrinted?: boolean;
  }>;
};

export type TransferTrainFields = {
  category: string;
  transferByTrain: boolean;
  trainDepartureTime: string;
  destinationPickupTime: string;
};

export type TransferTrainSegment = "train-departure" | "station-pickup";

export type DummyGroupSeed = {
  code: string;
  name: string;
  tone: StatusTone;
  pax: number;
  packageName: string;
  durationDays: number;
  startDay: number;
  musyrifName: string;
  musyrifPhone: string;
};
