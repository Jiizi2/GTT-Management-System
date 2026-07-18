export type LifecycleStatus = "ENTRY_ONLY" | "ACTIVE" | "INACTIVE" | "COMPLETED" | "ARCHIVED";
export type InvoiceStatus = "PAID" | "PARTIALLY_PAID" | "PENDING" | "OVERDUE" | "CANCELLED";

export type GroupSummary = {
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
export type GroupDetail = GroupSummary & { totalBuses: number | null; durationDays: number };
export type GroupNote = { id: string; sortOrder: number; text: string; pinned: boolean };
export type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

export type Dashboard = {
  groups: { total: number; active: number; completed: number; archived: number; upcoming: number; totalPax: number };
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
  requiresBus: boolean;
  transferByTrain: boolean;
  trainDepartureTime: string | null;
  destinationPickupTime: string | null;
  hotelPickupRequestTime: string | null;
};
export type TimelineItem = { dateLabel: string; title: string; isCurrent: boolean };
export type VisaFacet = {
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
  assignedDriverCount: number;
  verifiedDriverCount: number;
};

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  issuedDate: string;
  dueDate: string;
  group: { id: string; code: string; name: string } | null;
};
export type Profile = { account: { displayName: string }; agent: { code: string; name: string } };
export type VisaApplicationDocumentType = "PASSPORT" | "VACCINE_CERTIFICATE" | "MANIFEST" | "PACKAGE_INFORMATION";
export type VisaApplication = {
  id: string;
  applicationNumber: string;
  departureDate: string;
  returnDate: string;
  departureCity: string;
  providerName: string | null;
  packageName: string;
  passengerCount: number;
  status: string;
  documentStatus: string;
  agreementStatus: string;
  nusukStatus: string;
  paymentStatus: string;
  visaStatus: string;
  nusukGroupNumber: string | null;
  nusukReferenceNumber: string | null;
  adminNote: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  agent: { code: string; name: string };
  documents: Array<{
    id: string;
    type: VisaApplicationDocumentType;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    status: string;
    reviewNote: string | null;
  }>;
};
