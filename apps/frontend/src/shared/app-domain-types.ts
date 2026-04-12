export type NavId =
  | "overview"
  | "input"
  | "checklist"
  | "visa"
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

export type AgreementApprovalStatus = "Waiting for Approval" | "Approved";

export type GroupRaudhahStatus = "Free" | "After" | "Before";
export type BusStatus = "Visa+";

export type GroupAgreementHotel = {
  id: string;
  hotelName: string;
  agreementNumber: string;
  pax: number;
  status: AgreementApprovalStatus;
  stayStartIso: string;
  stayEndIso: string;
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
  makkahHotels: GroupAgreementHotel[];
  madinahHotels: GroupAgreementHotel[];
  raudhahAppointments: GroupRaudhahAppointment[];
};

export type GroupData = {
  code: string;
  name: string;
  status: string;
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

export type VisaFilterId = "all" | "not-issued" | "missing-hotel" | "unpaid";

export type VisaStatus = "Issued" | "Draft" | "Pending";

export type VisaPaymentStatus = "Paid" | "Unpaid" | "Partial";

export type VisaRaudhahTone = "good" | "warn" | "muted";

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
  outstandingAmount: number;
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
  groupCode?: string;
  groupName?: string;
  pax?: number;
  totalBuses?: number;
  packageName?: string;
  startDate?: string;
  endDate?: string;
  musyrifName?: string;
  musyrifPhone?: string;
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
