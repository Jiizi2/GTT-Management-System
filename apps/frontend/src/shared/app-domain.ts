import {
  buildVisaAgreementNumber,
  formatVisaDateWithYear,
  formatVisaLongDate,
  formatVisaShortDate,
  getGroupAgreementHotelsByCity,
  hasMissingHotelAllocation,
  isIsoDateValue,
  isVisaRowActionRequired,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  resolveVisaProvider,
  shiftIsoDate,
} from "./visa-domain.js";

export {
  buildVisaAgreementNumber,
  formatVisaDateWithYear,
  formatVisaLongDate,
  formatVisaShortDate,
  getGroupAgreementHotelsByCity,
  hasMissingHotelAllocation,
  isIsoDateValue,
  isVisaRowActionRequired,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  resolveVisaProvider,
  shiftIsoDate,
};

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

export function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalIsoDateWithOffset(days: number): string {
  const nextDate = new Date();
  nextDate.setHours(12, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() + days);
  return formatLocalIsoDate(nextDate);
}

export function resolveValidRaudhahAppointments(group: GroupData | undefined): GroupRaudhahAppointment[] {
  const fallbackGroupCode = group?.code?.trim() || "group";

  return (group?.visaSetup?.raudhahAppointments ?? [])
    .map((appointment, index) => ({
      id: appointment.id?.trim() || `${fallbackGroupCode}-raudhah-${index + 1}`,
      dateIso: appointment.dateIso.trim(),
      status: appointment.status,
      tasrehPrinted: Boolean(appointment.tasrehPrinted),
    }))
    .filter((appointment) => isIsoDateValue(appointment.dateIso))
    .sort((left, right) => {
      const dateOrder = left.dateIso.localeCompare(right.dateIso);
      if (dateOrder !== 0) {
        return dateOrder;
      }

      return left.id.localeCompare(right.id);
    });
}

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

export const operatorAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDYxTyP2luvJIjGFQzfh0xRh0AHPBDoS_l-3WNItTegB4jnCMIfkjN_571ulocggZTAS6voqaMm4EoSA-kfN3SxNgXwoxo3NzlaWM8-b3HQoMbNFooz3nsVQqL3smWPEyp8UBTeqYDJEr1qfnNB68B9-4XfLzbyS06bFPL9b8w1TnJJnp2O_s6gH8MLguE3BOtb8uac28oSHRl62ewwxmQRLXyku6cbSP2nh2BszE7hmDB40X8HQtKF-kOCZ_UOJwRQ4i28LoZ6mys";

export const musyrifAvatar =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDh2QYe9f16M9LsFkFiiV-OWeoRQURwjlEBJp3y0F89mrcICkRZYBeBkUm_v0qJ-0yBwSt9K_oWvo7_ckbWvElV1I9mW0eNQp13OqJr51wrBQWMtG-BTce2SZQmPAB4D-vi6dN4r1WOZwOLU_Is3wpMQtnpUX0Q6ADcQpch-DsiK9LqNdTe66t4O5_thVoBNA5vZTfaC5uZWCis1rIXwkpdy8jYpB95SGSj2_tepJPL9kV9YNSbfHtNGlUneW0vOtsh7v8XP-XTxvk";

export const sidebarItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "checklist", label: "H-1 Checklist", icon: "fact_check" },
  { id: "visa", label: "Visa Tracking", icon: "fact_check" },
  { id: "invoice", label: "Invoice", icon: "request_quote" },
  { id: "raudhah-reminder", label: "Raudhah Reminder", icon: "notifications_active" },
];

export const sidebarAccountItem: NavItem = {
  id: "profile",
  label: "Profile",
  icon: "account_circle",
};

export const mobileItems: NavItem[] = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "checklist", label: "Checklist", icon: "fact_check" },
  { id: "visa", label: "Visa", icon: "fact_check" },
  { id: "profile", label: "Profile", icon: "account_circle" },
];

const checklistTwoBusTomorrowIso = getLocalIsoDateWithOffset(1);
const checklistTwoBusPastIso = getLocalIsoDateWithOffset(-4);
const checklistTwoBusTomorrowDisplay = formatScheduleDate(checklistTwoBusTomorrowIso);
const checklistTwoBusPastDisplay = formatScheduleDate(checklistTwoBusPastIso);

export const baseGroups: GroupData[] = [
  {
    code: "901794508",
    name: "Majestic Umrah Group",
    status: "Active",
    tone: "active",
    pax: 70,
    totalBuses: 2,
    packageName: "Standard Gold",
    durationDays: 14,
    timeline: [
      { date: "2 Apr", title: "Jeddah Arrival & Transfer" },
      {
        date: "3 Apr",
        title: "Makkah City Ziyarah",
        isCurrent: true,
        nextActivity: "Bus Boarding (08:30)",
      },
    ],
    nextActivity: {
      title: "Makkah City Ziyarah",
      date: "3 Apr",
      time: "08:30",
      icon: "tour",
    },
    itinerary: [
      {
        date: "2 Apr",
        year: "2026",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Jeddah Arrival and Airport Transfer",
        meta: "04:20 | SV-827 | Hajj Terminal",
        icon: "flight_land",
        flightNumber: "SV-827",
        isoDate: "2026-04-02",
        time: "04:20",
        from: "JED Airport",
        to: "Makkah",
      },
      {
        date: "2 Apr",
        year: "2026",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Hotel Check-in Makkah",
        meta: "11:00 | Swissotel Al Maqam",
        icon: "flight_land",
        isoDate: "2026-04-02",
        time: "11:00",
        from: "Makkah Arrival Point",
        to: "Swissotel Al Maqam",
      },
      {
        date: "3 Apr",
        year: "2026",
        category: "City Tour",
        categoryKey: "city-tour",
        title: "Makkah City Ziyarah",
        meta: "08:30 | Bus 02 | Gate A",
        icon: "tour",
        highlighted: true,
        isoDate: "2026-04-03",
        time: "08:30",
        from: "Makkah Hotel",
        to: "Jabal Rahmah",
        cityTourCity: "Makkah",
        requiresBus: true,
      },
    ],
    notes: [
      "Airport transfer driver needs final reconfirmation before arrival.",
      "Hotel team requested the final rooming list for extra bed allocation.",
    ],
    musyrif: {
      name: "Ust. Ahmad Hidayat",
      phone: "+62 812-3456-7890",
      avatar: musyrifAvatar,
    },
  },
  {
    code: "901794509",
    name: "Honeymoon Special",
    status: "Active",
    tone: "active",
    pax: 12,
    totalBuses: 2,
    packageName: "VIP Deluxe",
    durationDays: 12,
    timeline: [
      { date: "3 Apr", title: "Departure from Jakarta" },
      {
        date: "4 Apr",
        title: "Check-in Madinah Hotel",
        isCurrent: true,
        nextActivity: "Room Distribution",
      },
    ],
    nextActivity: {
      title: "Check-in Madinah Hotel",
      date: "4 Apr",
      time: "14:00",
      icon: "hotel",
    },
    itinerary: [
      {
        date: "3 Apr",
        year: "2026",
        category: "Departure",
        categoryKey: "departure",
        title: "Departure CGK to Madinah",
        meta: "09:30 | SV-819 | Terminal 3",
        icon: "flight_takeoff",
        flightNumber: "SV-819",
        isoDate: "2026-04-03",
        time: "09:30",
        hotelPickupRequestTime: "06:30",
        from: "Jakarta",
        to: "CGK Airport",
      },
      {
        date: "4 Apr",
        year: "2026",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Madinah Hotel Arrival",
        meta: "14:00 | Pullman Zamzam Madinah",
        icon: "flight_land",
        highlighted: true,
        isoDate: "2026-04-04",
        time: "14:00",
        from: "MED Airport",
        to: "Madinah",
      },
      {
        date: "4 Apr",
        year: "2026",
        category: "Transfer",
        categoryKey: "transfer",
        title: "Transfer Haramain High Speed Railway",
        meta: "13:15 | HHR Transfer | Madinah ke Makkah",
        icon: "airport_shuttle",
        isoDate: "2026-04-04",
        time: "13:15",
        from: "Madinah",
        to: "Makkah",
        requiresBus: true,
        transferByTrain: true,
        trainDepartureTime: "13:15",
        destinationPickupTime: "15:35",
      },
      {
        date: "4 Apr",
        year: "2026",
        category: "City Tour",
        categoryKey: "city-tour",
        title: "Rawdah Entry Coordination",
        meta: "07:00 | Lobby Assembly Point",
        icon: "tour",
        isoDate: "2026-04-04",
        time: "07:00",
        from: "Madinah Hotel",
        to: "Rawdah Gate",
        cityTourCity: "Madinah",
      },
    ],
    notes: [
      "Welcome amenity for the VIP rooms should be placed before 13:00.",
      "Need a final seat map for the airport buggy service booking.",
    ],
    musyrif: {
      name: "Ust. Faris Maulana",
      phone: "+62 811-9900-7722",
      avatar: musyrifAvatar,
    },
  },
  {
    code: "901794510",
    name: "Family Group C",
    status: "In Active",
    tone: "inactive",
    pax: 32,
    packageName: "Economic",
    durationDays: 13,
    timeline: [
      { date: "4 Apr", title: "Final Departure Briefing" },
      {
        date: "5 Apr",
        title: "Airport Assembly",
        isCurrent: true,
        nextActivity: "Document Verification",
      },
    ],
    nextActivity: {
      title: "Airport Assembly",
      date: "5 Apr",
      time: "06:30",
      icon: "flight_takeoff",
    },
    itinerary: [
      {
        date: "4 Apr",
        year: "2026",
        category: "Departure",
        categoryKey: "departure",
        title: "Final Departure Briefing",
        meta: "19:30 | Office Hall | Session C",
        icon: "flight_takeoff",
        isoDate: "2026-04-04",
        time: "19:30",
        hotelPickupRequestTime: "17:00",
        from: "Jakarta",
        to: "CGK Airport",
      },
      {
        date: "5 Apr",
        year: "2026",
        category: "Departure",
        categoryKey: "departure",
        title: "Airport Assembly",
        meta: "06:30 | Terminal 3 | Gate C",
        icon: "flight_takeoff",
        highlighted: true,
        isoDate: "2026-04-05",
        time: "06:30",
        hotelPickupRequestTime: "04:30",
        from: "Jakarta",
        to: "CGK Airport",
      },
      {
        date: "5 Apr",
        year: "2026",
        category: "Departure",
        categoryKey: "departure",
        title: "Departure to Jeddah",
        meta: "09:45 | SV-835 | Terminal 3",
        icon: "flight_takeoff",
        flightNumber: "SV-835",
        isoDate: "2026-04-05",
        time: "09:45",
        hotelPickupRequestTime: "07:00",
        from: "Jakarta",
        to: "CGK Airport",
      },
    ],
    notes: [
      "Three passports are still pending courier confirmation.",
      "Family room allocation needs a final review for connecting rooms.",
    ],
    musyrif: {
      name: "Ust. Yusuf Akbar",
      phone: "+62 813-7008-2200",
      avatar: musyrifAvatar,
    },
  },
  {
    code: "901794526",
    name: "Checklist 2 Bus Trial",
    status: "Active",
    tone: "active",
    pax: 70,
    totalBuses: 2,
    packageName: "Standard Gold",
    durationDays: 10,
    timeline: [
      { date: checklistTwoBusPastDisplay.date, title: "Jeddah Arrival & Transfer" },
      {
        date: checklistTwoBusTomorrowDisplay.date,
        title: "Madinah City Tour",
        isCurrent: true,
        nextActivity: "Driver Briefing (08:00)",
      },
    ],
    nextActivity: {
      title: "Madinah City Tour",
      date: checklistTwoBusTomorrowDisplay.date,
      time: "08:00",
      icon: "tour",
    },
    itinerary: [
      {
        date: checklistTwoBusPastDisplay.date,
        year: checklistTwoBusPastDisplay.year,
        category: "Arrival",
        categoryKey: "arrival",
        title: "Jeddah Arrival and Transfer",
        meta: "04:30 | SV-902 | Hajj Terminal",
        icon: "flight_land",
        flightNumber: "SV-902",
        isoDate: checklistTwoBusPastIso,
        time: "04:30",
        from: "JED Airport",
        to: "Madinah",
        requiresBus: true,
      },
      {
        date: checklistTwoBusTomorrowDisplay.date,
        year: checklistTwoBusTomorrowDisplay.year,
        category: "City Tour",
        categoryKey: "city-tour",
        title: "Madinah City Tour",
        meta: "08:00 | Bus 01 & 02 | Hotel Lobby",
        icon: "tour",
        highlighted: true,
        isoDate: checklistTwoBusTomorrowIso,
        time: "08:00",
        from: "Madinah Hotel",
        to: "Quba Mosque",
        cityTourCity: "Madinah",
        requiresBus: true,
      },
    ],
    notes: [
      "Demo group for validating two-bus assignment flow in H-1 checklist.",
      "Can be removed after QA verification.",
    ],
    musyrif: {
      name: "Ust. Demo Driver",
      phone: "+62 812-0000-5260",
      avatar: musyrifAvatar,
    },
  },
];

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

export const overviewDummySeeds: DummyGroupSeed[] = [
  {
    code: "901794511",
    name: "An-Nur Jakarta Batch",
    tone: "active",
    pax: 38,
    packageName: "Standard Silver",
    durationDays: 12,
    startDay: 2,
    musyrifName: "Ust. Ridwan Fauzi",
    musyrifPhone: "+62 812-1001-2201",
  },
  {
    code: "901794512",
    name: "Ar-Rahmah Family Group",
    tone: "inactive",
    pax: 29,
    packageName: "Economic",
    durationDays: 13,
    startDay: 2,
    musyrifName: "Ust. Khalid Amir",
    musyrifPhone: "+62 812-1001-2202",
  },
  {
    code: "901794513",
    name: "Nurul Iman Bandung",
    tone: "inactive",
    pax: 41,
    packageName: "Standard Gold",
    durationDays: 14,
    startDay: 3,
    musyrifName: "Ust. Salman Azmi",
    musyrifPhone: "+62 812-1001-2203",
  },
  {
    code: "901794514",
    name: "Madinah Executive Team",
    tone: "active",
    pax: 24,
    packageName: "VIP Deluxe",
    durationDays: 11,
    startDay: 3,
    musyrifName: "Ust. Dany Iskandar",
    musyrifPhone: "+62 812-1001-2204",
  },
  {
    code: "901794515",
    name: "Al-Hikmah Surabaya",
    tone: "inactive",
    pax: 34,
    packageName: "Standard Gold",
    durationDays: 12,
    startDay: 4,
    musyrifName: "Ust. Bima Rasyid",
    musyrifPhone: "+62 812-1001-2205",
  },
  {
    code: "901794516",
    name: "Safa Marwah Couple",
    tone: "active",
    pax: 16,
    packageName: "VIP Deluxe",
    durationDays: 10,
    startDay: 4,
    musyrifName: "Ust. Fahri Mahesa",
    musyrifPhone: "+62 812-1001-2206",
  },
  {
    code: "901794517",
    name: "Darussalam Community",
    tone: "inactive",
    pax: 36,
    packageName: "Standard Silver",
    durationDays: 13,
    startDay: 5,
    musyrifName: "Ust. Yogi Pratama",
    musyrifPhone: "+62 812-1001-2207",
  },
  {
    code: "901794518",
    name: "Al-Barokah Premium",
    tone: "active",
    pax: 27,
    packageName: "Standard Gold",
    durationDays: 12,
    startDay: 6,
    musyrifName: "Ust. Irfan Ramadhan",
    musyrifPhone: "+62 812-1001-2208",
  },
  {
    code: "901794519",
    name: "Ummul Qura Team",
    tone: "inactive",
    pax: 43,
    packageName: "Economic",
    durationDays: 14,
    startDay: 7,
    musyrifName: "Ust. Rafi Hidayat",
    musyrifPhone: "+62 812-1001-2209",
  },
  {
    code: "901794520",
    name: "Zamzam Family Circle",
    tone: "active",
    pax: 31,
    packageName: "Standard Silver",
    durationDays: 12,
    startDay: 8,
    musyrifName: "Ust. Ali Mubarok",
    musyrifPhone: "+62 812-1001-2210",
  },
  {
    code: "901794521",
    name: "Haramain West Java",
    tone: "inactive",
    pax: 33,
    packageName: "Standard Gold",
    durationDays: 13,
    startDay: 9,
    musyrifName: "Ust. Ghani Akbar",
    musyrifPhone: "+62 812-1001-2211",
  },
  {
    code: "901794522",
    name: "Quba Pioneer Group",
    tone: "active",
    pax: 22,
    packageName: "Economic",
    durationDays: 11,
    startDay: 10,
    musyrifName: "Ust. Rizky Maulana",
    musyrifPhone: "+62 812-1001-2212",
  },
  {
    code: "901794523",
    name: "Hijrah Care Medan",
    tone: "inactive",
    pax: 30,
    packageName: "Standard Silver",
    durationDays: 12,
    startDay: 11,
    musyrifName: "Ust. Naufal Rahman",
    musyrifPhone: "+62 812-1001-2213",
  },
  {
    code: "901794524",
    name: "Arafah Women Group",
    tone: "active",
    pax: 18,
    packageName: "VIP Deluxe",
    durationDays: 10,
    startDay: 12,
    musyrifName: "Ust. Harits Akmal",
    musyrifPhone: "+62 812-1001-2214",
  },
  {
    code: "901794525",
    name: "Makkah Service Unit",
    tone: "inactive",
    pax: 40,
    packageName: "Standard Gold",
    durationDays: 13,
    startDay: 13,
    musyrifName: "Ust. Fikri Ardian",
    musyrifPhone: "+62 812-1001-2215",
  },
];

export function formatAprilIsoDate(day: number): string {
  return `2026-04-${String(Math.min(Math.max(day, 1), 30)).padStart(2, "0")}`;
}

export function formatAprilDisplayDate(day: number): string {
  return `${Math.min(Math.max(day, 1), 30)} Apr`;
}

export function getStatusByTone(tone: StatusTone): string {
  if (tone === "active") {
    return "Active";
  }

  return "In Active";
}

export const saudiLocationKeywords = ["saudi", "makkah", "madinah", "jeddah", "jed", "med", "haram", "rawdah", "jabal"];

export const nonSaudiLocationKeywords = [
  "jakarta",
  "surabaya",
  "bandung",
  "medan",
  "indonesia",
  "cgk",
  "soekarno",
  "soetta",
  "terminal 3",
];

export function includesKnownKeyword(value: string, keywords: string[]): boolean {
  const normalizedValue = value.toLowerCase();
  return keywords.some((keyword) => normalizedValue.includes(keyword));
}

export function resolveGroupToneByItinerary(itinerary: ItineraryItem[]): StatusTone {
  if (itinerary.length === 0) {
    return "inactive";
  }

  const latestItem = [...itinerary].sort((left, right) => {
    const leftDate = left.isoDate ?? parseDisplayDateToIso(left.date, left.year);
    const rightDate = right.isoDate ?? parseDisplayDateToIso(right.date, right.year);
    const leftKey = `${leftDate}T${left.time ?? "00:00"}`;
    const rightKey = `${rightDate}T${right.time ?? "00:00"}`;
    return leftKey.localeCompare(rightKey);
  })[itinerary.length - 1];

  if (!latestItem) {
    return "inactive";
  }

  const routeHint = [latestItem.to, latestItem.from, latestItem.title, latestItem.meta]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasSaudiKeyword = includesKnownKeyword(routeHint, saudiLocationKeywords);
  const hasNonSaudiKeyword = includesKnownKeyword(routeHint, nonSaudiLocationKeywords);

  if (hasSaudiKeyword) {
    return "active";
  }

  if (hasNonSaudiKeyword) {
    return "inactive";
  }

  return "inactive";
}

function hasCurrentOrUpcomingItinerary(itinerary: ItineraryItem[], now: Date): boolean | null {
  const nowMs = now.getTime();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStartMs = today.getTime();
  let hasComparableItem = false;

  for (const item of itinerary) {
    const itineraryIsoDate = getItineraryIsoDate(item).trim();
    if (!isIsoDateValue(itineraryIsoDate)) {
      continue;
    }

    hasComparableItem = true;

    const normalizedTime =
      parseTimeForInput(item.time?.trim() ?? "") || parseTimeForInput(item.meta.split(" | ")[0] ?? "");
    if (normalizedTime) {
      const parsedDateTime = Date.parse(`${itineraryIsoDate}T${normalizedTime}:00`);
      if (Number.isFinite(parsedDateTime) && parsedDateTime >= nowMs) {
        return true;
      }

      continue;
    }

    const parsedDateOnly = Date.parse(`${itineraryIsoDate}T00:00:00`);
    if (Number.isFinite(parsedDateOnly) && parsedDateOnly >= todayStartMs) {
      return true;
    }
  }

  return hasComparableItem ? false : null;
}

export function resolveCurrentGroupTone(
  fallbackTone: StatusTone,
  itinerary: ItineraryItem[],
  now: Date = new Date(),
): StatusTone {
  return hasCurrentOrUpcomingItinerary(itinerary, now) === false ? "inactive" : fallbackTone;
}

function sortItineraryForOverview(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((left, right) => {
    const leftDate = getItineraryIsoDate(left) || "9999-12-31";
    const rightDate = getItineraryIsoDate(right) || "9999-12-31";
    const leftMetaTime = parseTimeForInput(left.meta.split(" | ")[0] ?? "");
    const rightMetaTime = parseTimeForInput(right.meta.split(" | ")[0] ?? "");
    const leftTime = left.time?.trim() || leftMetaTime || "00:00";
    const rightTime = right.time?.trim() || rightMetaTime || "00:00";
    const leftKey = `${leftDate}T${leftTime}`;
    const rightKey = `${rightDate}T${rightTime}`;
    return leftKey.localeCompare(rightKey);
  });
}

function resolveItineraryOverviewDate(item: ItineraryItem): string {
  const isoDate = getItineraryIsoDate(item);
  if (!isoDate) {
    return item.date || "-";
  }

  return formatScheduleDate(isoDate).date;
}

function resolveItineraryOverviewTime(item: ItineraryItem): string {
  const fallbackMetaTime = parseTimeForInput(item.meta.split(" | ")[0] ?? "");
  const rawTime = item.time?.trim() || fallbackMetaTime;
  if (!rawTime) {
    return "";
  }

  const normalizedTime = formatScheduleTime(rawTime);
  return normalizedTime === "TBD" ? "" : normalizedTime;
}

function resolveItineraryOverviewSummary(item: ItineraryItem): string {
  const from = item.from?.trim() ?? "";
  const to = item.to?.trim() ?? "";
  if (from && to) {
    return formatRouteSummary(inferCategoryKey(item), from, to, item.cityTourCity ?? "");
  }

  return item.title.trim() || "Activity detail pending";
}

function buildOverviewSnapshotFromItinerary(
  itinerary: ItineraryItem[],
  currentGroup: GroupData,
): { timeline: [TimelineItem, TimelineItem]; nextActivity: NextActivity } {
  const sortedItems = sortItineraryForOverview(itinerary);
  const firstItem = sortedItems[0];

  if (!firstItem) {
    return {
      timeline: currentGroup.timeline,
      nextActivity: currentGroup.nextActivity,
    };
  }

  const secondItem = sortedItems[1];
  const firstTypeOption = getScheduleTypeOption(inferCategoryKey(firstItem));
  const firstDateLabel = resolveItineraryOverviewDate(firstItem);
  const firstSummary = resolveItineraryOverviewSummary(firstItem);
  const firstTime = resolveItineraryOverviewTime(firstItem);

  const timelineFirst: TimelineItem = {
    date: firstDateLabel,
    title: `${firstTypeOption.cardLabel} | ${firstSummary}`,
  };

  const timelineSecond: TimelineItem = secondItem
    ? (() => {
        const secondTypeOption = getScheduleTypeOption(inferCategoryKey(secondItem));
        const secondDateLabel = resolveItineraryOverviewDate(secondItem);
        const secondSummary = resolveItineraryOverviewSummary(secondItem);
        const secondTime = resolveItineraryOverviewTime(secondItem);
        const secondTimelineActivity =
          secondTime && secondTime.length > 0
            ? `${secondTime}${secondItem.requiresBus ? " | Requires Bus" : ""}`
            : "Awaiting operator update";

        return {
          date: secondDateLabel,
          title: `${secondTypeOption.cardLabel} | ${secondSummary}`,
          isCurrent: true,
          nextActivity: secondTimelineActivity,
        };
      })()
    : {
        date: firstDateLabel,
        title: "Next activity to be confirmed",
        isCurrent: true,
        nextActivity: "Awaiting operator update",
      };

  return {
    timeline: [timelineFirst, timelineSecond],
    nextActivity: {
      title: `${firstTypeOption.cardLabel}: ${firstSummary}`,
      date: firstDateLabel,
      time: firstTime,
      icon: firstItem.icon?.trim() || firstTypeOption.icon,
    },
  };
}

export function normalizeGroupStatus(group: GroupData): GroupData {
  const normalizedItinerary = expandTransferTrainItineraryItems(group.itinerary);
  const { earliestIsoDate, latestIsoDate } = resolveItineraryBoundaryIsoDates(normalizedItinerary);
  const currentArrivalDate = group.arrivalDate?.trim() ?? "";
  const currentReturnDate = group.returnDate?.trim() ?? "";
  const normalizedArrivalDate = isIsoDateValue(currentArrivalDate)
    ? currentArrivalDate
    : (earliestIsoDate ?? getLocalIsoDateWithOffset(0));
  const fallbackReturnDate = latestIsoDate ?? shiftIsoDate(normalizedArrivalDate, Math.max(1, group.durationDays - 1));
  const normalizedReturnDateCandidate = isIsoDateValue(currentReturnDate) ? currentReturnDate : fallbackReturnDate;
  const normalizedReturnDate =
    normalizedReturnDateCandidate >= normalizedArrivalDate ? normalizedReturnDateCandidate : normalizedArrivalDate;
  const tone = resolveCurrentGroupTone(resolveGroupToneByItinerary(normalizedItinerary), normalizedItinerary);
  const overviewSnapshot = buildOverviewSnapshotFromItinerary(normalizedItinerary, group);
  return {
    ...group,
    arrivalDate: normalizedArrivalDate,
    returnDate: normalizedReturnDate,
    itinerary: normalizedItinerary,
    timeline: overviewSnapshot.timeline,
    nextActivity: overviewSnapshot.nextActivity,
    tone,
    status: getStatusByTone(tone),
    totalBuses: resolveTotalBusCount(group.pax, group.totalBuses),
  };
}

export function createDummyOverviewGroups(): GroupData[] {
  return overviewDummySeeds.map((seed, index) => {
    const departureDay = seed.startDay;
    const arrivalDay = Math.min(seed.startDay + 1, 30);
    const operationDay = Math.min(seed.startDay + 2, 30);
    const departureTime = `${String(5 + (index % 6)).padStart(2, "0")}:${index % 2 === 0 ? "30" : "45"}`;
    const arrivalTime = `${String(9 + (index % 5)).padStart(2, "0")}:${index % 2 === 0 ? "10" : "25"}`;
    const operationTime = `${String(7 + (index % 6)).padStart(2, "0")}:${index % 2 === 0 ? "00" : "15"}`;
    const flightNumber = `SV-${840 + index}`;
    const isCityTour = index % 2 === 0;
    const operationCategory = isCityTour ? "City Tour" : "Transfer";
    const operationCategoryKey = isCityTour ? "city-tour" : "transfer";
    const operationIcon = isCityTour ? "tour" : "airport_shuttle";
    const operationFrom = isCityTour ? "Makkah Hotel" : "Makkah";
    const operationTo = isCityTour ? "Jabal Rahmah" : "Madinah";
    const operationTitle = isCityTour ? "Makkah City Ziyarah" : "Transfer from Makkah to Madinah";
    const operationMeta = isCityTour
      ? `${formatScheduleTime(operationTime)} | Bus ${String((index % 9) + 1).padStart(2, "0")} | Gate A`
      : `${formatScheduleTime(operationTime)} | Highway Route 40`;

    return {
      code: seed.code,
      name: seed.name,
      status: getStatusByTone(seed.tone),
      tone: seed.tone,
      pax: seed.pax,
      totalBuses: resolveTotalBusCount(seed.pax),
      packageName: seed.packageName,
      durationDays: seed.durationDays,
      timeline: [
        { date: formatAprilDisplayDate(departureDay), title: "Departure from Jakarta" },
        {
          date: formatAprilDisplayDate(operationDay),
          title: operationTitle,
          isCurrent: true,
          nextActivity: `${operationCategory} (${formatScheduleTime(operationTime)})`,
        },
      ],
      nextActivity: {
        title: operationTitle,
        date: formatAprilDisplayDate(operationDay),
        time: operationTime,
        icon: operationIcon,
      },
      itinerary: [
        {
          date: formatAprilDisplayDate(departureDay),
          year: "2026",
          category: "Departure",
          categoryKey: "departure",
          title: "Depart from Jakarta to CGK Airport",
          meta: `${formatScheduleTime(departureTime)} | ${flightNumber} | Terminal 3`,
          icon: "flight_takeoff",
          flightNumber,
          isoDate: formatAprilIsoDate(departureDay),
          time: departureTime,
          hotelPickupRequestTime: departureTime,
          from: "Jakarta",
          to: "CGK Airport",
        },
        {
          date: formatAprilDisplayDate(arrivalDay),
          year: "2026",
          category: "Arrival",
          categoryKey: "arrival",
          title: "Landing at JED Airport and heading to Makkah",
          meta: `${formatScheduleTime(arrivalTime)} | Hajj Terminal | Group Bus`,
          icon: "flight_land",
          isoDate: formatAprilIsoDate(arrivalDay),
          time: arrivalTime,
          from: "JED Airport",
          to: "Makkah",
        },
        {
          date: formatAprilDisplayDate(operationDay),
          year: "2026",
          category: operationCategory,
          categoryKey: operationCategoryKey,
          title: operationTitle,
          meta: operationMeta,
          icon: operationIcon,
          highlighted: true,
          isoDate: formatAprilIsoDate(operationDay),
          time: operationTime,
          from: operationFrom,
          to: operationTo,
          cityTourCity: isCityTour ? operationFrom : "",
          requiresBus: true,
        },
      ],
      notes: [
        "Driver coordination needs reconfirmation 24 hours before schedule.",
        "Rooming and baggage list already shared with ground handling team.",
      ],
      musyrif: {
        name: seed.musyrifName,
        phone: seed.musyrifPhone,
        avatar: musyrifAvatar,
      },
    };
  });
}

export const groups: GroupData[] = [];

export const scheduleTypeOptions = [
  { value: "arrival", cardLabel: "Arrival", modalLabel: "Arrival", icon: "flight_land" },
  { value: "city-tour", cardLabel: "City Tour", modalLabel: "City Tour", icon: "tour" },
  { value: "transfer", cardLabel: "Transfer", modalLabel: "Transfer", icon: "airport_shuttle" },
  { value: "departure", cardLabel: "Departure", modalLabel: "Departure", icon: "flight_takeoff" },
] as const;

export const saudiCityOptions = [
  "Makkah",
  "Madinah",
  "Jeddah",
  "Riyadh",
  "Taif",
  "Abha",
  "Tabuk",
  "Dammam",
  "Khobar",
  "Buraidah",
  "AlUla",
  "Yanbu",
  "Hail",
  "Jubail",
  "Najran",
  "Jazan",
  "Al Ahsa",
  "Qassim",
] as const;

const SAUDI_CITY_OPTIONS_STORAGE_KEY = "gtt-master-saudi-city-options-v1";

function normalizeSaudiCityOptionsList(options: readonly string[]): string[] {
  return Array.from(new Set(options.map((city) => city.trim()).filter((city) => city.length > 0)));
}

function readPersistedSaudiCityOptions(): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  const runtimeOptions = (window as { __GTT_SAUDI_CITY_OPTIONS__?: unknown }).__GTT_SAUDI_CITY_OPTIONS__;
  if (Array.isArray(runtimeOptions)) {
    const normalizedRuntime = normalizeSaudiCityOptionsList(
      runtimeOptions.filter((entry): entry is string => typeof entry === "string"),
    );
    if (normalizedRuntime.length > 0) {
      return normalizedRuntime;
    }
  }

  try {
    const rawStorageValue = window.localStorage.getItem(SAUDI_CITY_OPTIONS_STORAGE_KEY);
    if (!rawStorageValue) {
      return null;
    }

    const parsed = JSON.parse(rawStorageValue) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const normalizedStored = normalizeSaudiCityOptionsList(
      parsed.filter((entry): entry is string => typeof entry === "string"),
    );
    return normalizedStored.length > 0 ? normalizedStored : null;
  } catch {
    return null;
  }
}

export function getSaudiCityOptions(): string[] {
  return readPersistedSaudiCityOptions() ?? [...saudiCityOptions];
}

export function registerSaudiCityOptions(options: readonly string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeSaudiCityOptionsList(options);
  if (normalized.length === 0) {
    return;
  }

  (window as { __GTT_SAUDI_CITY_OPTIONS__?: string[] }).__GTT_SAUDI_CITY_OPTIONS__ = normalized;
  try {
    window.localStorage.setItem(SAUDI_CITY_OPTIONS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage write errors.
  }
}

export const OVERVIEW_PAGE_SIZE = 9;
export const CHECKLIST_PAGE_SIZE = 6;
export const VISA_PAGE_SIZE = 15;
export const MAX_PAX_PER_BUS = 50;

export function getMinimumBusCountForPax(pax: number): number {
  const safePax = Number.isFinite(pax) && pax > 0 ? pax : 1;
  return Math.max(1, Math.ceil(safePax / MAX_PAX_PER_BUS));
}

export function resolveTotalBusCount(pax: number, requestedTotalBuses?: number): number {
  const minimumBusCount = getMinimumBusCountForPax(pax);
  if (!Number.isFinite(requestedTotalBuses) || !requestedTotalBuses || requestedTotalBuses < 1) {
    return minimumBusCount;
  }

  return Math.max(minimumBusCount, Math.floor(requestedTotalBuses));
}

export function createInitialInputItineraryForm(): InputItineraryFormState {
  return {
    date: "",
    time: "",
    category: scheduleTypeOptions[1].value,
    hotelName: "",
    fromHotelName: "",
    from: "",
    to: "",
    cityTourCity: "",
    flightNumber: "",
    requiresBus: true,
    notes: "",
    transferByTrain: false,
    trainDepartureTime: "",
    destinationPickupTime: "",
    hotelPickupRequestTime: "",
  };
}

export function createNewGroupAgreementForm(city: "makkah" | "madinah"): NewGroupAgreementFormState {
  return {
    id: `${city}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    hotelName: "",
    agreementNumber: "",
    pax: "",
    status: "Waiting for Approval",
    stayStartIso: "",
    stayEndIso: "",
  };
}

export function createNewGroupRaudhahForm(): NewGroupRaudhahFormState {
  return {
    id: `raudhah-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dateIso: "",
    status: "Free",
    tasrehPrinted: false,
  };
}

export function sortInputItineraryItems(items: InputItineraryItem[]): InputItineraryItem[] {
  return [...items].sort((left, right) => {
    const leftKey = `${left.date}T${left.time || "00:00"}`;
    const rightKey = `${right.date}T${right.time || "00:00"}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function createInitialScheduleForm(): ScheduleFormState {
  return {
    category: scheduleTypeOptions[1].value,
    date: "",
    time: "",
    flightNumber: "",
    hotelName: "",
    fromHotelName: "",
    from: "",
    to: "",
    cityTourCity: "",
    note: "",
    highlighted: false,
    transferByTrain: false,
    trainDepartureTime: "",
    destinationPickupTime: "",
    hotelPickupRequestTime: "",
  };
}

export function createInitialNoteForm(): NoteFormState {
  return {
    text: "",
    pinned: false,
  };
}

export function createEmptyChecklistDriverProfile(): ChecklistDriverProfile {
  return {
    name: "",
    phone: "",
    plateNumber: "",
  };
}

export function createEmptyChecklistDraft(): ChecklistDriverDraft {
  return createEmptyChecklistDriverProfile();
}

export function createNoteItems(notes: string[], groupCode: string): NoteItem[] {
  return notes.map((note, index) => ({
    id: `${groupCode}-note-${index}`,
    text: note,
    pinned: false,
  }));
}

export function getScheduleTypeOption(category: string) {
  return scheduleTypeOptions.find((option) => option.value === category) ?? scheduleTypeOptions[1];
}

export function isFlightActivityType(category: string): boolean {
  const normalizedCategory = category.toLowerCase();
  return normalizedCategory === "arrival" || normalizedCategory === "departure";
}

export function isTransferActivityType(category: string): boolean {
  return category.toLowerCase() === "transfer";
}

export function isCityTourActivityType(category: string): boolean {
  return category.toLowerCase() === "city-tour";
}

export function isDepartureActivityType(category: string): boolean {
  return category.toLowerCase() === "departure";
}

export function hasIncompleteTransferTrainFields(fields: TransferTrainFields): boolean {
  if (!isTransferActivityType(fields.category) || !fields.transferByTrain) {
    return false;
  }

  return !fields.trainDepartureTime.trim() || !fields.destinationPickupTime.trim();
}

export function buildTransferTrainSummary(fields: TransferTrainFields): string {
  if (!isTransferActivityType(fields.category) || !fields.transferByTrain) {
    return "";
  }

  return [
    "HHR Transfer",
    `Train departure: ${formatScheduleTime(fields.trainDepartureTime.trim())}`,
    `Station pickup: ${formatScheduleTime(fields.destinationPickupTime.trim())}`,
  ].join(" | ");
}

export function inferCategoryKey(item: ItineraryItem): string {
  if (item.categoryKey) {
    return item.categoryKey;
  }

  const normalizedCategory = item.category.toLowerCase();

  if (normalizedCategory.includes("arrival")) {
    return "arrival";
  }

  if (normalizedCategory.includes("city tour") || normalizedCategory.includes("tour")) {
    return "city-tour";
  }

  if (normalizedCategory.includes("transfer")) {
    return "transfer";
  }

  if (normalizedCategory.includes("departure")) {
    return "departure";
  }

  if (item.icon === "flight_land") {
    return "arrival";
  }

  if (item.icon === "airport_shuttle") {
    return "transfer";
  }

  if (item.icon === "flight_takeoff") {
    return "departure";
  }

  return "city-tour";
}

export function formatScheduleDate(isoDate: string): { date: string; year: string } {
  const [year, month, day] = isoDate.split("-");
  const monthIndex = Number(month) - 1;
  const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return {
    date: `${Number(day)} ${shortMonths[monthIndex] ?? "Jan"}`,
    year,
  };
}

export function formatScheduleTime(value: string): string {
  if (!value) {
    return "TBD";
  }

  const trimmedValue = value.trim();
  const parsedFromMeridiem = parseTimeForInput(trimmedValue);
  if (parsedFromMeridiem) {
    return parsedFromMeridiem;
  }

  const twentyFourHourMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})$/);
  if (!twentyFourHourMatch) {
    return trimmedValue;
  }

  const [, rawHour, rawMinute] = twentyFourHourMatch;
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return trimmedValue;
  }

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return trimmedValue;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseDisplayDateToIso(date: string, year: string): string {
  if (!date || !year) {
    return "";
  }

  const [day, monthLabel] = date.split(" ");
  const monthMap: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  const month = monthMap[monthLabel];
  if (!month) {
    return "";
  }

  return `${year}-${month}-${String(Number(day)).padStart(2, "0")}`;
}

export function parseTimeForInput(value: string): string {
  if (!value) {
    return "";
  }

  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    return "";
  }

  const [, rawHour, minute, rawSuffix] = match;
  let hour = Number(rawHour);
  const suffix = rawSuffix.toUpperCase();

  if (suffix === "PM" && hour !== 12) {
    hour += 12;
  }

  if (suffix === "AM" && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

export function createScheduleMeta({
  category,
  time,
  flightNumber,
  hotelName,
  fromHotelName,
  hotelPickupRequestTime,
  from,
  to,
  cityTourCity,
  note,
  transferTrainSummary,
}: {
  category?: string;
  time: string;
  flightNumber?: string;
  hotelName?: string;
  fromHotelName?: string;
  hotelPickupRequestTime?: string;
  from?: string;
  to?: string;
  cityTourCity?: string;
  note?: string;
  transferTrainSummary?: string;
}): string {
  const trimmedFrom = from?.trim() ?? "";
  const trimmedTo = to?.trim() ?? "";
  const route =
    trimmedFrom && trimmedTo
      ? formatRouteSummary(category ?? "", trimmedFrom, trimmedTo, cityTourCity)
      : [trimmedFrom, trimmedTo].filter(Boolean).join(" -> ");
  const trimmedFlightNumber = flightNumber?.trim() ?? "";
  const trimmedHotelName = hotelName?.trim() ?? "";
  const trimmedFromHotelName = fromHotelName?.trim() ?? "";
  const normalizedCategory = category?.trim().toLowerCase() ?? "";
  const hotelNameSummary =
    normalizedCategory === "transfer"
      ? trimmedFromHotelName && trimmedHotelName
        ? `Hotel ${trimmedFromHotelName} -> ${trimmedHotelName}`
        : trimmedHotelName
          ? `Hotel ${trimmedHotelName}`
          : trimmedFromHotelName
            ? `Hotel ${trimmedFromHotelName}`
            : ""
      : trimmedHotelName
        ? `Hotel ${trimmedHotelName}`
        : "";
  const trimmedHotelPickupRequestTime = hotelPickupRequestTime?.trim() ?? "";
  const hotelPickupRequestSummary = trimmedHotelPickupRequestTime
    ? `Hotel pickup request ${formatScheduleTime(trimmedHotelPickupRequestTime)}`
    : "";
  const trimmedNote = note?.trim() ?? "";
  const trimmedTransferTrainSummary = transferTrainSummary?.trim() ?? "";
  const compactNote = trimmedNote.length > 42 ? `${trimmedNote.slice(0, 39).trimEnd()}...` : trimmedNote;

  return (
    [
      formatScheduleTime(time),
      trimmedFlightNumber,
      hotelNameSummary,
      hotelPickupRequestSummary,
      route,
      trimmedTransferTrainSummary,
      compactNote,
    ]
      .filter(Boolean)
      .join(" | ") || "Schedule details pending confirmation"
  );
}

export function detectCityFromText(rawValue: string): string {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  const foundCity = getSaudiCityOptions().find((city) => normalized.includes(city.toLowerCase()));
  return foundCity ?? "";
}

export function normalizeAgreementCityKey(rawValue: string): "makkah" | "madinah" | "" {
  const detectedCity = detectCityFromText(rawValue);
  if (!detectedCity) {
    return "";
  }

  const normalizedCity = detectedCity.trim().toLowerCase();
  if (normalizedCity === "makkah") {
    return "makkah";
  }

  if (normalizedCity === "madinah") {
    return "madinah";
  }

  return "";
}

export function normalizeSaudiCityValue(rawValue: string): string {
  const trimmedValue = rawValue.trim();
  if (!trimmedValue) {
    return "";
  }

  const matchedCity = getSaudiCityOptions().find((city) => city.toLowerCase() === trimmedValue.toLowerCase());
  return matchedCity ?? "";
}

export function inferCityTourCity(item: ItineraryItem): string {
  if (item.cityTourCity?.trim()) {
    return item.cityTourCity.trim();
  }

  return (
    detectCityFromText(item.from ?? "") ||
    detectCityFromText(item.to ?? "") ||
    detectCityFromText(item.title ?? "") ||
    detectCityFromText(item.notes ?? "")
  );
}

export function createEditScheduleForm(item: ItineraryItem): EditScheduleFormState {
  const category = inferCategoryKey(item);
  const parsedTime = item.time ?? parseTimeForInput(item.meta.split(" | ")[0] ?? "");
  const isTransferByTrain = category === "transfer" && (item.transferByTrain ?? false);
  const isDepartureActivity = isDepartureActivityType(category);
  const rawFromValue = (item.from ?? "").trim();
  const rawToValue = (item.to ?? item.title).trim();
  const fromValue = category === "transfer" ? normalizeSaudiCityValue(rawFromValue) : rawFromValue;
  const toValue = category === "arrival" || category === "transfer" ? normalizeSaudiCityValue(rawToValue) : rawToValue;

  return {
    date: item.isoDate ?? parseDisplayDateToIso(item.date, item.year),
    time: parsedTime,
    category,
    flightNumber: item.flightNumber ?? "",
    hotelName: item.hotelName ?? "",
    fromHotelName: category === "transfer" ? (item.fromHotelName ?? "") : "",
    from: fromValue,
    to: toValue,
    cityTourCity: category === "city-tour" ? inferCityTourCity(item) : "",
    requiresBus: item.requiresBus ?? /bus/i.test(item.meta),
    notes: item.notes ?? "",
    transferByTrain: isTransferByTrain,
    trainDepartureTime: item.trainDepartureTime ?? (isTransferByTrain ? parsedTime : ""),
    destinationPickupTime: item.destinationPickupTime ?? "",
    hotelPickupRequestTime: isDepartureActivity ? (item.hotelPickupRequestTime ?? "") : "",
  };
}

export function buildItineraryItemFromEditForm(currentItem: ItineraryItem, form: EditScheduleFormState): ItineraryItem {
  const typeOption = getScheduleTypeOption(form.category);
  const formattedDate = formatScheduleDate(form.date);
  const nextCityTourCity = isCityTourActivityType(form.category) ? form.cityTourCity.trim() : "";
  const nextTitle =
    form.from.trim() && form.to.trim()
      ? formatRouteSummary(form.category, form.from, form.to, nextCityTourCity)
      : currentItem.title;
  const nextFlightNumber = isFlightActivityType(form.category) ? form.flightNumber.trim() : "";
  const shouldPersistHotelName =
    form.category === "arrival" ||
    form.category === "city-tour" ||
    form.category === "departure";
  const nextHotelName = shouldPersistHotelName ? (form.hotelName?.trim() ?? "") : "";
  const nextFromHotelName = "";
  const nextHotelPickupRequestTime = isDepartureActivityType(form.category) ? form.hotelPickupRequestTime.trim() : "";
  const isTransferByTrain = isTransferActivityType(form.category) && form.transferByTrain;
  const scheduleTime = isTransferByTrain ? form.trainDepartureTime : form.time;
  const transferTrainSummary = buildTransferTrainSummary(form);

  return {
    ...currentItem,
    date: formattedDate.date,
    year: formattedDate.year,
    category: typeOption.cardLabel,
    title: nextTitle,
    meta: createScheduleMeta({
      category: form.category,
      time: scheduleTime,
      flightNumber: nextFlightNumber,
      hotelName: nextHotelName,
      fromHotelName: nextFromHotelName,
      hotelPickupRequestTime: nextHotelPickupRequestTime,
      from: form.from,
      to: form.to,
      cityTourCity: nextCityTourCity,
      note: form.notes,
      transferTrainSummary,
    }),
    icon: typeOption.icon,
    categoryKey: typeOption.value,
    isoDate: form.date,
    time: scheduleTime,
    flightNumber: nextFlightNumber,
    hotelName: nextHotelName,
    fromHotelName: nextFromHotelName,
    from: form.from.trim(),
    to: form.to.trim(),
    cityTourCity: nextCityTourCity,
    requiresBus: isTransferByTrain ? true : form.requiresBus,
    notes: form.notes.trim(),
    transferByTrain: isTransferByTrain,
    trainDepartureTime: isTransferByTrain ? form.trainDepartureTime.trim() : "",
    destinationPickupTime: isTransferByTrain ? form.destinationPickupTime.trim() : "",
    hotelPickupRequestTime: nextHotelPickupRequestTime,
  };
}

export function isFridayDate(value: string): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.getDay() === 5;
}

export function shouldShowFridayCityTourWarning(category: string, date: string): boolean {
  return category === "city-tour" && isFridayDate(date);
}

export function getRouteFieldConfigByCategory(category: string): {
  fromLabel: string;
  toLabel: string;
  fromPlaceholder: string;
  toPlaceholder: string;
  helperText: string;
} {
  if (category === "arrival") {
    return {
      fromLabel: "Landing Airport City",
      toLabel: "To City",
      fromPlaceholder: "e.g. Jeddah",
      toPlaceholder: "e.g. Makkah",
      helperText: "Enter the landing airport city and select the destination city.",
    };
  }

  if (category === "transfer") {
    return {
      fromLabel: "From City",
      toLabel: "To City",
      fromPlaceholder: "e.g. Makkah",
      toPlaceholder: "e.g. Madinah",
      helperText: "Enter the origin city and select the destination city.",
    };
  }

  if (category === "departure") {
    return {
      fromLabel: "Departure City",
      toLabel: "Destination Airport City",
      fromPlaceholder: "e.g. Madinah",
      toPlaceholder: "e.g. Jeddah",
      helperText: "Select the departure city and airport city in Saudi, then fill flight return time and hotel pickup request time.",
    };
  }

  if (category === "city-tour") {
    return {
      fromLabel: "Meeting Point",
      toLabel: "Tour Destination",
      fromPlaceholder: "e.g. Madinah Hotel Lobby",
      toPlaceholder: "e.g. Masjid Quba",
      helperText: "Select the city tour city, then fill in the meeting point and ziyarah destination.",
    };
  }

  return {
    fromLabel: "From Location",
    toLabel: "To Location",
    fromPlaceholder: "e.g. Makkah Hotel",
    toPlaceholder: "e.g. Jabal Rahmah",
    helperText: "",
  };
}

export function formatRouteSummary(category: string, from: string, to: string, cityTourCity = ""): string {
  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();
  const trimmedCityTourCity = cityTourCity.trim();

  if (!trimmedFrom || !trimmedTo) {
    return [trimmedFrom, trimmedTo].filter(Boolean).join(" -> ");
  }

  if (category === "arrival") {
    return `Landing at ${trimmedFrom} and heading to ${trimmedTo}`;
  }

  if (category === "transfer") {
    return `Transfer from ${trimmedFrom} to ${trimmedTo}`;
  }

  if (category === "departure") {
    return `Depart from ${trimmedFrom} to ${trimmedTo}`;
  }

  if (category === "city-tour") {
    if (!trimmedCityTourCity) {
      return `${trimmedFrom} -> ${trimmedTo}`;
    }

    return `City Tour in ${trimmedCityTourCity}: ${trimmedFrom} -> ${trimmedTo}`;
  }

  return `${trimmedFrom} -> ${trimmedTo}`;
}

export function getTransferTrainSegmentCategory(segment: TransferTrainSegment): string {
  return segment === "train-departure" ? "Transfer - Train Departure" : "Transfer - Arrival Station Pickup";
}

export function expandInputTransferTrainItems(items: InputItineraryItem[]): InputItineraryItem[] {
  return items.flatMap((item) => {
    const isTransferByTrain = isTransferActivityType(item.categoryKey) && item.transferByTrain;
    if (!isTransferByTrain) {
      return [item];
    }

    const transferCategoryKey = "transfer";
    const transferIcon = "airport_shuttle";
    const departureTime = item.trainDepartureTime.trim() || item.time.trim();
    const pickupTime = item.destinationPickupTime.trim() || departureTime;
    const trimmedFrom = item.from.trim();
    const trimmedTo = item.to.trim();
    const trimmedHotelName = item.hotelName?.trim() ?? "";
    const trimmedFromHotelName = item.fromHotelName?.trim() ?? "";
    const trimmedNotes = item.notes.trim();

    return [
      {
        id: `${item.id}-train-departure`,
        date: item.date,
        time: departureTime,
        category: getTransferTrainSegmentCategory("train-departure"),
        categoryKey: transferCategoryKey,
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        flightNumber: "",
        requiresBus: true,
        notes: trimmedNotes,
        icon: transferIcon,
        transferByTrain: false,
        trainDepartureTime: "",
        destinationPickupTime: "",
        hotelPickupRequestTime: "",
      },
      {
        id: `${item.id}-station-pickup`,
        date: item.date,
        time: pickupTime,
        category: getTransferTrainSegmentCategory("station-pickup"),
        categoryKey: transferCategoryKey,
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        flightNumber: "",
        requiresBus: true,
        notes: "",
        icon: transferIcon,
        transferByTrain: false,
        trainDepartureTime: "",
        destinationPickupTime: "",
        hotelPickupRequestTime: "",
      },
    ];
  });
}

export function expandTransferTrainItineraryItems(items: ItineraryItem[]): ItineraryItem[] {
  return items.flatMap((item) => {
    const categoryKey = inferCategoryKey(item);
    const isTransferByTrain = categoryKey === "transfer" && (item.transferByTrain ?? false);
    if (!isTransferByTrain) {
      return [item];
    }

    const fallbackMetaTime = parseTimeForInput(item.meta.split(" | ")[0] ?? "");
    const departureTime = (item.trainDepartureTime ?? "").trim() || (item.time ?? "").trim() || fallbackMetaTime;
    const pickupTime = (item.destinationPickupTime ?? "").trim() || departureTime;
    const isoDate = item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
    const formattedDate = isoDate ? formatScheduleDate(isoDate) : { date: item.date, year: item.year };
    const transferCategoryKey = "transfer";
    const transferIcon = "airport_shuttle";
    const trimmedFrom = item.from?.trim() ?? "";
    const trimmedTo = item.to?.trim() ?? "";
    const trimmedHotelName = item.hotelName?.trim() ?? "";
    const trimmedFromHotelName = item.fromHotelName?.trim() ?? "";
    const trimmedNotes = item.notes?.trim() ?? "";
    const routeTitle =
      trimmedFrom && trimmedTo
        ? formatRouteSummary("transfer", trimmedFrom, trimmedTo, item.cityTourCity ?? "")
        : item.title;

    return [
      {
        ...item,
        date: formattedDate.date,
        year: formattedDate.year,
        category: getTransferTrainSegmentCategory("train-departure"),
        title: routeTitle,
        meta: createScheduleMeta({
          category: "transfer",
          time: departureTime,
          hotelName: trimmedHotelName,
          fromHotelName: trimmedFromHotelName,
          from: trimmedFrom,
          to: trimmedTo,
          note: trimmedNotes,
        }),
        icon: transferIcon,
        categoryKey: transferCategoryKey,
        isoDate: isoDate ?? item.isoDate,
        time: departureTime,
        flightNumber: "",
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        requiresBus: true,
        notes: trimmedNotes,
        transferByTrain: false,
        trainDepartureTime: "",
        destinationPickupTime: "",
        hotelPickupRequestTime: "",
      },
      {
        ...item,
        date: formattedDate.date,
        year: formattedDate.year,
        category: getTransferTrainSegmentCategory("station-pickup"),
        title: routeTitle,
        meta: createScheduleMeta({
          category: "transfer",
          time: pickupTime,
          hotelName: trimmedHotelName,
          fromHotelName: trimmedFromHotelName,
          from: trimmedFrom,
          to: trimmedTo,
        }),
        icon: transferIcon,
        highlighted: false,
        categoryKey: transferCategoryKey,
        isoDate: isoDate ?? item.isoDate,
        time: pickupTime,
        flightNumber: "",
        hotelName: trimmedHotelName,
        fromHotelName: trimmedFromHotelName,
        from: trimmedFrom,
        to: trimmedTo,
        cityTourCity: "",
        requiresBus: true,
        notes: "",
        transferByTrain: false,
        trainDepartureTime: "",
        destinationPickupTime: "",
        hotelPickupRequestTime: "",
      },
    ];
  });
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getChecklistRangeDates(): string[] {
  return [getLocalIsoDateWithOffset(0), getLocalIsoDateWithOffset(1), getLocalIsoDateWithOffset(2)];
}

export function getChecklistDayLabel(tripDate: string): string {
  if (!tripDate) {
    return "-";
  }

  const date = new Date(`${tripDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return tripDate;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatChecklistCopyDate(tripDate: string): string {
  if (!tripDate) {
    return "-";
  }

  const date = new Date(`${tripDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return tripDate.toUpperCase();
  }

  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

export function getItineraryIsoDate(item: ItineraryItem): string {
  return item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
}

function resolveItineraryBoundaryIsoDates(itinerary: ItineraryItem[]): {
  earliestIsoDate: string | null;
  latestIsoDate: string | null;
} {
  let earliestKey: string | null = null;
  let latestKey: string | null = null;
  let earliestIsoDate: string | null = null;
  let latestIsoDate: string | null = null;

  for (const item of itinerary) {
    const itineraryIsoDate = getItineraryIsoDate(item);
    const metaTime = parseTimeForInput(item.meta.split(" | ")[0] ?? "");
    const itineraryTime = item.time?.trim() || metaTime || "00:00";
    const sortKey = `${itineraryIsoDate || "9999-12-31"}T${itineraryTime}`;

    if (earliestKey === null || sortKey.localeCompare(earliestKey) < 0) {
      earliestKey = sortKey;
      earliestIsoDate = itineraryIsoDate || null;
    }

    if (latestKey === null || sortKey.localeCompare(latestKey) > 0) {
      latestKey = sortKey;
      latestIsoDate = itineraryIsoDate || null;
    }
  }

  return {
    earliestIsoDate,
    latestIsoDate,
  };
}

export function buildVisaTrackingRowsFromGroups(groups: GroupData[]): VisaTrackingRow[] {
  return groups.map((group, index) => {
    const visaSetup = group.visaSetup;
    const { earliestIsoDate, latestIsoDate } = resolveItineraryBoundaryIsoDates(group.itinerary);
    const configuredArrivalIso = group.arrivalDate?.trim() ?? "";
    const configuredReturnIso = group.returnDate?.trim() ?? "";
    const groupArrivalIso = isIsoDateValue(configuredArrivalIso) ? configuredArrivalIso : "";
    const groupReturnIso = isIsoDateValue(configuredReturnIso) ? configuredReturnIso : "";
    const fallbackDeparture = getLocalIsoDateWithOffset(index % 4);
    const itineraryDepartureIso = groupArrivalIso || earliestIsoDate || fallbackDeparture;
    const resolvedReturnIso = groupReturnIso || latestIsoDate || "";
    const itineraryReturnIso =
      resolvedReturnIso && resolvedReturnIso >= itineraryDepartureIso
        ? resolvedReturnIso
        : shiftIsoDate(itineraryDepartureIso, Math.max(6, group.durationDays - 1));
    const customAgreementDateRange = resolveVisaAgreementDateRange(
      { departureIso: itineraryDepartureIso, returnIso: itineraryReturnIso },
      group.durationDays,
      group,
    );
    const departureIso = customAgreementDateRange.makkahStartIso;
    const returnIso = customAgreementDateRange.madinahEndIso;

    const visaStatus: VisaStatus =
      visaSetup?.visaStatus ?? (index % 6 === 0 ? "Draft" : index % 4 === 0 ? "Pending" : "Issued");
    const paymentStatus: VisaPaymentStatus =
      visaSetup?.paymentStatus ?? (index % 5 === 0 ? "Unpaid" : index % 3 === 0 ? "Partial" : "Paid");
    const configuredIssuedDate = visaSetup?.issuedDate?.trim() ?? "";
    const issuedDateIso =
      visaStatus === "Issued" ? (isIsoDateValue(configuredIssuedDate) ? configuredIssuedDate : departureIso) : "";

    const pax = Math.max(1, group.pax);
    const visaDelayFactor = visaStatus === "Issued" ? 0 : 1;
    const defaultMakkahGap = (index % 5 === 0 ? Math.max(1, Math.ceil(pax * 0.12)) : 0) + visaDelayFactor;
    const defaultMadinahGap = (index % 4 === 0 ? Math.max(1, Math.ceil(pax * 0.18)) : 0) + visaDelayFactor;
    const fallbackMakkahVerified = Math.max(0, pax - Math.min(pax, defaultMakkahGap));
    const fallbackMadinahVerified = Math.max(0, pax - Math.min(pax, defaultMadinahGap));
    const mappedMakkahVerified = visaSetup
      ? Math.min(
          pax,
          Math.max(
            0,
            visaSetup.makkahHotels.reduce((total, hotel) => total + Math.max(0, hotel.pax || 0), 0),
          ),
        )
      : fallbackMakkahVerified;
    const mappedMadinahVerified = visaSetup
      ? Math.min(
          pax,
          Math.max(
            0,
            visaSetup.madinahHotels.reduce((total, hotel) => total + Math.max(0, hotel.pax || 0), 0),
          ),
        )
      : fallbackMadinahVerified;
    const makkahVerified = mappedMakkahVerified;
    const madinahVerified = mappedMadinahVerified;

    const validRaudhahAppointments = resolveValidRaudhahAppointments(group);
    const firstRaudhah =
      validRaudhahAppointments.find((appointment) => appointment.status !== "Free") ?? validRaudhahAppointments[0];
    const raudhahTone: VisaRaudhahTone =
      !firstRaudhah || firstRaudhah.status === "Free" ? "muted" : firstRaudhah.status === "Before" ? "warn" : "good";
    const raudhahLabel =
      !firstRaudhah || firstRaudhah.status === "Free"
        ? "Not Set"
        : `${formatVisaShortDate(firstRaudhah.dateIso)} ${firstRaudhah.status}`;
    const raudhahHint =
      !firstRaudhah || firstRaudhah.status === "Free"
        ? "Appointment pending"
        : firstRaudhah.status === "Before"
          ? "Before 13:00"
          : "After 13:00";

    const outstandingAmount = paymentStatus === "Unpaid" ? pax * 280 : paymentStatus === "Partial" ? pax * 120 : 0;

    return {
      id: `${group.code}-visa-${index}`,
      groupCode: group.code,
      groupName: group.name,
      pax,
      packageName: group.packageName,
      issuedDateIso,
      departureIso,
      returnIso,
      visaStatus,
      paymentStatus,
      raudhahLabel,
      raudhahHint,
      raudhahTone,
      makkahVerified,
      madinahVerified,
      outstandingAmount,
    };
  });
}

export function buildChecklistActivityLabel(item: ItineraryItem, categoryKey: string): string {
  const baseCategory = item.category?.trim() || "Activity";
  if (categoryKey !== "city-tour") {
    return baseCategory;
  }

  const cityTourCity = inferCityTourCity(item);
  if (!cityTourCity) {
    return baseCategory;
  }

  return baseCategory.toLowerCase().includes(cityTourCity.toLowerCase())
    ? baseCategory
    : `${baseCategory} ${cityTourCity}`;
}

export function buildChecklistItemsFromGroups(groups: GroupData[]): ChecklistItem[] {
  const allowedDateSet = new Set(getChecklistRangeDates());
  const result: ChecklistItem[] = [];

  groups.forEach((group) => {
    const normalizedItinerary = expandTransferTrainItineraryItems(group.itinerary);

    normalizedItinerary.forEach((item, index) => {
      const tripDate = item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
      if (!tripDate || !allowedDateSet.has(tripDate)) {
        return;
      }

      const categoryKey = inferCategoryKey(item);
      const typeOption = getScheduleTypeOption(categoryKey);
      const parsedTime = item.time ?? parseTimeForInput(item.meta.split(" | ")[0] ?? "");
      const normalizedTime = parsedTime ? formatScheduleTime(parsedTime) : "TBD";
      const transferByTrain = categoryKey === "transfer" && (item.transferByTrain ?? false);
      const isDepartureActivity = categoryKey === "departure";
      const requiredBusCount = resolveTotalBusCount(group.pax, group.totalBuses);
      const trainDepartureSource = item.trainDepartureTime ?? (transferByTrain ? parsedTime : "");
      const stationPickupSource = item.destinationPickupTime ?? "";
      const hotelPickupRequestSource = isDepartureActivity ? (item.hotelPickupRequestTime ?? "") : "";
      const trainDepartureTime = trainDepartureSource ? formatScheduleTime(trainDepartureSource) : "TBD";
      const stationPickupTime = stationPickupSource ? formatScheduleTime(stationPickupSource) : "TBD";
      const hotelPickupRequestTime = hotelPickupRequestSource ? formatScheduleTime(hotelPickupRequestSource) : "";
      const departureFlightTime = isDepartureActivity ? normalizedTime : "";
      const scheduledTime = transferByTrain ? trainDepartureTime : hotelPickupRequestTime || normalizedTime;

      result.push({
        id: `${group.code}-${tripDate}-${index}-${categoryKey}`,
        groupCode: group.code,
        groupName: group.name,
        groupPax: group.pax,
        tripDate,
        activity: buildChecklistActivityLabel(item, categoryKey),
        trip:
          item.from && item.to ? formatRouteSummary(categoryKey, item.from, item.to, item.cityTourCity) : item.title,
        activityIcon: typeOption.icon,
        requiredBusCount,
        scheduledTime,
        transferByTrain,
        trainDepartureTime: transferByTrain ? trainDepartureTime : "",
        stationPickupTime: transferByTrain ? stationPickupTime : "",
        hotelPickupRequestTime,
        departureFlightTime,
      });
    });
  });

  return result.sort((left, right) => {
    const leftKey = `${left.tripDate} ${left.scheduledTime}`;
    const rightKey = `${right.tripDate} ${right.scheduledTime}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
