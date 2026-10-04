export type LifecycleStatus = "ENTRY_ONLY" | "ACTIVE" | "INACTIVE" | "COMPLETED" | "ARCHIVED";

export type GroupSummary = {
  parentGroupId?: string | null;
  id: string;
  code: string;
  name: string;
  lifecycleStatus: LifecycleStatus;
  arrivalDate: string;
  returnDate: string;
  pax: number;
  packageName: string;
  totalBuses: number | null;
  musyrif: { name: string; phone: string; avatar: string } | null;
  notes: GroupNote[];
  itinerary: ItineraryItem[];
};
export type GroupDetail = GroupSummary & { totalBuses: number | null; durationDays: number; familyGroups?: GroupSummary[] };
export type GroupNote = { id: string; sortOrder: number; text: string; pinned: boolean };
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type Dashboard = {
  groups: { journeys?: number; total: number; active: number; completed: number; archived: number; upcoming: number; totalPax: number };
  attention: { visaGroups: number; hotelGroups: number };
  upcomingGroups: GroupSummary[];
  recentTimeline: Array<{
    group: { id: string; code: string; name: string };
    dateLabel: string;
    title: string;
    isCurrent: boolean;
  }>;
};

export type ItineraryItem = {
  transportMode?: "bus" | "train" | "flight" | "none" | null;
  id: string;
  sortOrder: number;
  dateLabel: string;
  yearLabel: string;
  category: string;
  title: string;
  isoDate: string | null;
  time: string | null;
  flightNumber: string | null;
  hotelName: string | null;
  fromHotelName: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  cityTourCity: string | null;
  busCount?: number;
  requiresBus: boolean;
  transferByTrain: boolean;
  trainDepartureTime: string | null;
  destinationPickupTime: string | null;
  hotelPickupRequestTime: string | null;
};
export type TimelineItem = { dateLabel: string; title: string; isCurrent: boolean };
export type FlightLeg = {
  id: string; direction: "ONWARD" | "RETURN"; sortOrder: number;
  departureAirportCode: string | null; arrivalAirportCode: string | null;
  departureDate: string | null; departureTime: string | null; arrivalDate: string | null; arrivalTime: string | null;
  carrierCode: string | null; flightNumber: string | null;
};
export type VisaFacet = {
  flightLegs?: FlightLeg[];
  raudhahAppointments?: Array<{ id: string; date: string | null; status: "FREE" | "AFTER" | "BEFORE"; tasrehPrinted: boolean }>;
  makkahHotelWaived?: boolean; madinahHotelWaived?: boolean;
  status: "DRAFT" | "PENDING" | "ISSUED" | null;
  issuedDate: string | null;
  syarikah: string | null;
  busStatus: "VISA_ONLY" | "VISA_PLUS" | null;
  paymentStatus: "PAID" | "UNPAID" | "PARTIAL" | null;
};
export type HotelAgreement = {
  id: string;
  city: "MAKKAH" | "MADINAH";
  hotelName: string;
  agreementNumber: string;
  pax: number;
  status: "WAITING" | "APPROVED" | "REJECTED";
  stayStart: string | null;
  stayEnd: string | null;
};
export type TransportationItem = {
  id: string;
  tripDate: string | null;
  activity: string;
  tripLabel: string;
  requiredBusCount: number;
  scheduledTime: string;
  transferByTrain: boolean;
  trainDepartureTime: string | null;
  stationPickupTime: string | null;
  status: "NOT_COMPLETE" | "ASSIGNED";
  drivers?: Array<{ slotNumber: number | null; name: string; phone: string; plateNumber: string; isVerified: boolean }>;
  assignedDriverCount: number;
  verifiedDriverCount: number;
};

export type Profile = { account: { displayName: string }; agent: { code: string; name: string } };

export type VisaApplicationStatus =
  | "WAITING_DOCUMENT"
  | "NEED_REVISION"
  | "DOCUMENT_VERIFIED"
  | "WAITING_HOTEL_AGREEMENT"
  | "PASSENGER_ENTERED"
  | "GROUP_CREATED"
  | "READY_TO_SEND"
  | "VISA_SUBMITTED"
  | "PAYMENT_COMPLETED"
  | "VISA_PROCESSING"
  | "VISA_ISSUED"
  | "COMPLETED";

export type VisaApplicationDocumentStatus = "WAITING_DOCUMENT" | "NEED_REVISION" | "VERIFIED";

export type VisaApplicationDocument = {
  id: string;
  type: "PASSPORT" | "VACCINE_CERTIFICATE" | "MANIFEST" | "PACKAGE_INFORMATION";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  status: VisaApplicationDocumentStatus;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VisaApplication = {
  id: string;
  applicationNumber: string;
  agentId: string;
  groupId: string | null;
  departureDate: string;
  returnDate: string;
  departureCity: string;
  providerName: string | null;
  packageName: string;
  passengerCount: number;
  status: VisaApplicationStatus;
  documentStatus: VisaApplicationDocumentStatus;
  agreementStatus: "NOT_STARTED" | "WAITING_APPROVAL" | "APPROVED";
  nusukStatus: "NOT_STARTED" | "PASSENGER_ENTRY" | "PASSENGER_ENTERED" | "GROUP_CREATED";
  paymentStatus: "NOT_STARTED" | "WAITING_PAYMENT" | "COMPLETED";
  visaStatus: "NOT_STARTED" | "READY_TO_SEND" | "SUBMITTED" | "PROCESSING" | "ISSUED" | "COMPLETED";
  nusukGroupNumber: string | null;
  nusukReferenceNumber: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  group: null | {
    id: string;
    code: string;
    name: string;
    arrivalDate: string;
    returnDate: string;
    pax: number;
    packageName: string;
    agentId: string;
  };
  documents: VisaApplicationDocument[];
};
