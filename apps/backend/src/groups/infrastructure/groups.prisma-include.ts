import { Prisma } from "@prisma/client";

const groupItinerarySelection = {
  orderBy: {
    sortOrder: "asc",
  },
  select: {
    id: true,
    sortOrder: true,
    dateLabel: true,
    yearLabel: true,
    category: true,
    categoryKey: true,
    title: true,
    meta: true,
    icon: true,
    highlighted: true,
    isoDate: true,
    time: true,
    flightNumber: true,
    hotelName: true,
    fromHotelName: true,
    fromLocation: true,
    toLocation: true,
    cityTourCity: true,
    requiresBus: true,
    notes: true,
    transferByTrain: true,
    trainDepartureTime: true,
    destinationPickupTime: true,
    hotelPickupRequestTime: true,
  },
} satisfies Prisma.ItineraryItemFindManyArgs;

const groupNotesSelection = {
  orderBy: {
    sortOrder: "asc",
  },
  select: {
    sortOrder: true,
    text: true,
    pinned: true,
  },
} satisfies Prisma.GroupNoteFindManyArgs;

export const groupSummarySelection = {
  id: true,
  code: true,
  name: true,
  status: true,
  lifecycleStatus: true,
  tone: true,
  arrivalDate: true,
  returnDate: true,
  pax: true,
  totalBuses: true,
  packageName: true,
  durationDays: true,
  parentGroupId: true,
  nextActivity: {
    select: {
      title: true,
      dateLabel: true,
      timeLabel: true,
      icon: true,
    },
  },
  itinerary: groupItinerarySelection,
  notes: groupNotesSelection,
  visaSetup: {
    select: {
      visaStatus: true,
      issuedDate: true,
      syarikah: true,
      busStatus: true,
      paymentStatus: true,
      hotelAgreements: {
        orderBy: [{ city: "asc" }, { stayStart: "asc" }],
        select: {
          id: true,
          sourceDraftId: true,
          city: true,
          hotelName: true,
          agreementNumber: true,
          pax: true,
          status: true,
          stayStart: true,
          stayEnd: true,
        },
      },
    },
  },
} satisfies Prisma.GroupSelect;

export const groupDetailSelection = {
  id: true,
  code: true,
  name: true,
  status: true,
  lifecycleStatus: true,
  tone: true,
  arrivalDate: true,
  returnDate: true,
  pax: true,
  totalBuses: true,
  packageName: true,
  durationDays: true,
  parentGroupId: true,
  musyrif: {
    select: {
      name: true,
      phone: true,
      avatar: true,
    },
  },
  nextActivity: {
    select: {
      title: true,
      dateLabel: true,
      timeLabel: true,
      icon: true,
    },
  },
  timeline: {
    orderBy: {
      sortOrder: "asc",
    },
    select: {
      sortOrder: true,
      dateLabel: true,
      title: true,
      isCurrent: true,
      nextActivity: true,
    },
  },
  itinerary: groupItinerarySelection,
  notes: groupNotesSelection,
  visaSetup: {
    select: {
      visaStatus: true,
      issuedDate: true,
      syarikah: true,
      busStatus: true,
      paymentStatus: true,
      hotelAgreements: {
        orderBy: [{ city: "asc" }, { stayStart: "asc" }],
        select: {
          id: true,
          sourceDraftId: true,
          city: true,
          hotelName: true,
          agreementNumber: true,
          pax: true,
          status: true,
          stayStart: true,
          stayEnd: true,
        },
      },
      raudhahAppointments: {
        orderBy: {
          date: "asc",
        },
        select: {
          id: true,
          date: true,
          status: true,
          tasrehPrinted: true,
        },
      },
    },
  },
  checklistAssignments: {
    orderBy: {
      tripDate: "asc",
    },
    select: {
      id: true,
      itineraryItemId: true,
      tripDate: true,
      activity: true,
      tripLabel: true,
      requiredBusCount: true,
      scheduledTime: true,
      transferByTrain: true,
      trainDepartureTime: true,
      stationPickupTime: true,
      status: true,
      drivers: {
        orderBy: {
          slotNumber: "asc",
        },
        select: {
          slotNumber: true,
          name: true,
          phone: true,
          plateNumber: true,
          isVerified: true,
        },
      },
    },
  },
} satisfies Prisma.GroupSelect;
