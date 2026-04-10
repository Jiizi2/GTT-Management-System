import { Prisma } from "@prisma/client";

export const groupInclude = {
  musyrif: true,
  nextActivity: true,
  timeline: {
    orderBy: {
      sortOrder: "asc",
    },
  },
  itinerary: {
    orderBy: {
      sortOrder: "asc",
    },
  },
  notes: {
    orderBy: {
      sortOrder: "asc",
    },
  },
  visaSetup: {
    include: {
      hotelAgreements: {
        orderBy: [{ city: "asc" }, { stayStart: "asc" }],
      },
      raudhahAppointments: {
        orderBy: {
          date: "asc",
        },
      },
    },
  },
  checklistAssignments: {
    orderBy: {
      tripDate: "asc",
    },
    include: {
      drivers: {
        orderBy: {
          slotNumber: "asc",
        },
      },
    },
  },
} satisfies Prisma.GroupInclude;
