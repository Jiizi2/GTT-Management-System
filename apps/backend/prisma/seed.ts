import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupTone,
  InvoiceStatus,
  Prisma,
  PrismaClient,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import {
  createDefaultAuthUserStorageRecordsWithOverrides,
  requireDefaultAuthUserPasswordOverrides,
} from "../src/auth/auth-default-users";
import { resolveConfiguredNodeEnv, resolveConfiguredString } from "../src/config/app-config";
import { buildGroupSearchDocument } from "../src/groups/domain/groups.search-document";
import { DEFAULT_MASTER_DATA_OPTIONS } from "../src/master-data/master-data.defaults";

const prisma = new PrismaClient();

function assertSeedAllowedInCurrentEnvironment(): void {
  const nodeEnv = resolveConfiguredNodeEnv(undefined);
  if (nodeEnv === "production") {
    throw new Error("Refusing to run Prisma seed while NODE_ENV=production.");
  }
}

async function resetData(): Promise<void> {
  await prisma.appThrottleBucket.deleteMany();
  await prisma.authLoginRateLimitBucket.deleteMany();
  await prisma.groupAuditLog.deleteMany();
  await prisma.masterDataOption.deleteMany();
  await prisma.authUser.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.invoiceClient.deleteMany();
  await prisma.checklistDriver.deleteMany();
  await prisma.checklistAssignment.deleteMany();
  await prisma.raudhahAppointment.deleteMany();
  await prisma.visaHotelAgreement.deleteMany();
  await prisma.visaSetup.deleteMany();
  await prisma.groupNote.deleteMany();
  await prisma.itineraryItem.deleteMany();
  await prisma.groupTimelineItem.deleteMany();
  await prisma.nextActivity.deleteMany();
  await prisma.musyrif.deleteMany();
  await prisma.group.deleteMany();
}

async function seedMasterData({ resetDataFirst }: { resetDataFirst: boolean }): Promise<void> {
  const existingCount = await prisma.masterDataOption.count();
  if (existingCount > 0 && !resetDataFirst) {
    console.log(
      `Master data seed skipped: found ${existingCount} existing option(s). Set SEED_RESET=true to reset and reseed.`,
    );
    return;
  }

  for (const option of DEFAULT_MASTER_DATA_OPTIONS) {
    await prisma.masterDataOption.upsert({
      where: {
        categoryKey_value: {
          categoryKey: option.categoryKey,
          value: option.value,
        },
      },
      update: {
        label: option.label,
        description: option.description ?? null,
        sortOrder: option.sortOrder,
        isActive: option.isActive ?? true,
        metadata: (option.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
      create: {
        categoryKey: option.categoryKey,
        value: option.value,
        label: option.label,
        description: option.description ?? null,
        sortOrder: option.sortOrder,
        isActive: option.isActive ?? true,
        metadata: (option.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    });
  }

  console.log(`Seeded master data options: ${DEFAULT_MASTER_DATA_OPTIONS.length}`);
}

async function seedAuthUsers(): Promise<void> {
  const passwordOverrides = requireDefaultAuthUserPasswordOverrides({
    superAdminPassword: resolveConfiguredString(undefined, "DEV_AUTH_SUPERADMIN_PASSWORD"),
    adminPassword: resolveConfiguredString(undefined, "DEV_AUTH_ADMIN_PASSWORD"),
  });
  const defaultUsers = createDefaultAuthUserStorageRecordsWithOverrides(passwordOverrides);
  if (defaultUsers.length === 0) {
    return;
  }

  const usernames = defaultUsers.map((user) => user.username);
  const emails = defaultUsers.map((user) => user.email);
  const existingUsers = await prisma.authUser.findMany({
    where: {
      OR: [
        { username: { in: usernames } },
        { email: { in: emails } },
      ],
    },
    select: {
      username: true,
      email: true,
    },
  });
  const existingUsernames = new Set(existingUsers.map((user) => user.username));
  const existingEmails = new Set(existingUsers.map((user) => user.email));

  const createdUsernames: string[] = [];
  for (const user of defaultUsers) {
    if (existingUsernames.has(user.username) || existingEmails.has(user.email)) {
      continue;
    }

    await prisma.authUser.create({
      data: user,
    });
    existingUsernames.add(user.username);
    existingEmails.add(user.email);
    createdUsernames.push(user.username);
  }

  if (createdUsernames.length > 0) {
    console.log(`Seeded auth users: ${createdUsernames.join(", ")}`);
  } else {
    console.log("Auth user seed skipped: default users already exist.");
  }
}

function addUtcDays(baseDate: Date, dayOffset: number): Date {
  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
  return nextDate;
}

function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toUtcMidnightDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function toShortDateLabel(value: Date): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${value.getUTCDate()} ${monthNames[value.getUTCMonth()]}`;
}

function requireGroupId(groupCode: string, groupIdByCode: Map<string, string>): string {
  const matched = groupIdByCode.get(groupCode);
  if (!matched) {
    throw new Error(`Group '${groupCode}' not found while seeding.`);
  }

  return matched;
}

function withGroupSearchDocument<
  T extends {
    data: {
      code: string;
      name: string;
      status: string;
      packageName: string;
    };
  },
>(args: T): T {
  return {
    ...args,
    data: {
      ...args.data,
      searchDocument: buildGroupSearchDocument(args.data),
    },
  };
}

async function seedGroups({ resetDataFirst }: { resetDataFirst: boolean }): Promise<void> {
  const existingCount = await prisma.group.count();
  if (existingCount > 0 && !resetDataFirst) {
    console.log(
      `Seed skipped: found ${existingCount} existing group(s). Set SEED_RESET=true to reset and reseed.`,
    );
    return;
  }

  const now = new Date();
  const arrivalDate = addUtcDays(now, 3);
  const transferDate = addUtcDays(now, 6);
  const departureDate = addUtcDays(now, 8);
  const issuedDate = addUtcDays(now, 1);

  const trainMakkahStayStartDate = addUtcDays(now, 0);
  const trainTransferDate = addUtcDays(now, 1);
  const trainDepartureDate = addUtcDays(now, 2);
  const trainDepartureHMinusOneDate = addUtcDays(trainDepartureDate, -1);

  const draftArrivalDate = addUtcDays(now, 2);
  const draftDepartureDate = addUtcDays(now, 3);
  const draftDepartureHMinusOneDate = addUtcDays(draftDepartureDate, -1);
  const draftRaudhahDate = addUtcDays(now, 14);
  const archiveArrivalDate = addUtcDays(now, -14);
  const archiveReturnDate = addUtcDays(archiveArrivalDate, 6);
  const overviewArrivalOnlyDate = addUtcDays(now, 4);
  const overviewArrivalDepartureArrivalDate = addUtcDays(now, 5);
  const overviewArrivalDepartureReturnDate = addUtcDays(now, 7);
  const overviewArrivalDepartureHMinusOneDate = addUtcDays(overviewArrivalDepartureReturnDate, -1);
  const overviewFullTripArrivalDate = addUtcDays(now, 9);
  const overviewFullTripMakkahTourDate = addUtcDays(now, 10);
  const overviewFullTripTransferDate = addUtcDays(now, 11);
  const overviewFullTripMadinahTourDate = addUtcDays(now, 12);
  const overviewFullTripReturnDate = addUtcDays(now, 13);
  const overviewFullTripHMinusOneDate = addUtcDays(overviewFullTripReturnDate, -1);

  const arrivalIso = toIsoDateOnly(arrivalDate);
  const transferIso = toIsoDateOnly(transferDate);
  const departureIso = toIsoDateOnly(departureDate);
  const issuedIso = toIsoDateOnly(issuedDate);
  const trainMakkahStayStartIso = toIsoDateOnly(trainMakkahStayStartDate);
  const trainTransferIso = toIsoDateOnly(trainTransferDate);
  const trainDepartureIso = toIsoDateOnly(trainDepartureDate);
  const trainDepartureHMinusOneIso = toIsoDateOnly(trainDepartureHMinusOneDate);
  const draftArrivalIso = toIsoDateOnly(draftArrivalDate);
  const draftDepartureIso = toIsoDateOnly(draftDepartureDate);
  const draftDepartureHMinusOneIso = toIsoDateOnly(draftDepartureHMinusOneDate);
  const draftRaudhahIso = toIsoDateOnly(draftRaudhahDate);
  const archiveArrivalIso = toIsoDateOnly(archiveArrivalDate);
  const archiveReturnIso = toIsoDateOnly(archiveReturnDate);
  const overviewArrivalOnlyIso = toIsoDateOnly(overviewArrivalOnlyDate);
  const overviewArrivalDepartureArrivalIso = toIsoDateOnly(overviewArrivalDepartureArrivalDate);
  const overviewArrivalDepartureReturnIso = toIsoDateOnly(overviewArrivalDepartureReturnDate);
  const overviewArrivalDepartureHMinusOneIso = toIsoDateOnly(overviewArrivalDepartureHMinusOneDate);
  const overviewFullTripArrivalIso = toIsoDateOnly(overviewFullTripArrivalDate);
  const overviewFullTripMakkahTourIso = toIsoDateOnly(overviewFullTripMakkahTourDate);
  const overviewFullTripTransferIso = toIsoDateOnly(overviewFullTripTransferDate);
  const overviewFullTripMadinahTourIso = toIsoDateOnly(overviewFullTripMadinahTourDate);
  const overviewFullTripReturnIso = toIsoDateOnly(overviewFullTripReturnDate);
  const overviewFullTripHMinusOneIso = toIsoDateOnly(overviewFullTripHMinusOneDate);

  await prisma.group.create(withGroupSearchDocument({
    data: {
      code: "9017001001",
      name: "Sample Umrah Group",
      status: "Active",
      arrivalDate: toUtcMidnightDate(arrivalIso),
      returnDate: toUtcMidnightDate(departureIso),
      tone: GroupTone.ACTIVE,
      pax: 45,
      totalBuses: 1,
      packageName: "Umrah Plus",
      durationDays: 9,
      musyrif: {
        create: {
          name: "Ust. Ahmad Hidayat",
          phone: "+62 812-3456-7890",
          avatar: "https://i.pravatar.cc/160?img=12",
        },
      },
      nextActivity: {
        create: {
          title: "Arrival and transfer to Makkah hotel",
          dateLabel: toShortDateLabel(arrivalDate),
          timeLabel: "09:30",
          icon: "flight_land",
        },
      },
      timeline: {
        create: [
          {
            sortOrder: 0,
            dateLabel: toShortDateLabel(arrivalDate),
            title: "Jeddah Arrival",
            isCurrent: true,
            nextActivity: "Arrival and transfer to Makkah hotel",
          },
          {
            sortOrder: 1,
            dateLabel: toShortDateLabel(departureDate),
            title: "Departure to Jakarta",
            isCurrent: false,
            nextActivity: null,
          },
        ],
      },
      itinerary: {
        create: [
          {
            sortOrder: 0,
            dateLabel: toShortDateLabel(arrivalDate),
            yearLabel: `${arrivalDate.getUTCFullYear()}`,
            category: "Arrival",
            categoryKey: "arrival",
            title: "Arrival and transfer to Makkah hotel",
            meta: "09:30 AM | SV-827 | JED Airport",
            icon: "flight_land",
            highlighted: true,
            isoDate: toUtcMidnightDate(arrivalIso),
            time: "09:30",
            flightNumber: "SV-827",
            fromLocation: "JED Airport",
            toLocation: "Makkah Hotel",
            requiresBus: true,
            notes: "Sample seeded itinerary item.",
            transferByTrain: false,
          },
          {
            sortOrder: 1,
            dateLabel: toShortDateLabel(transferDate),
            yearLabel: `${transferDate.getUTCFullYear()}`,
            category: "Transfer",
            categoryKey: "transfer",
            title: "Transfer from Makkah to Madinah",
            meta: "07:30 AM | Makkah Hotel -> Madinah Hotel",
            icon: "swap_horiz",
            highlighted: false,
            isoDate: toUtcMidnightDate(transferIso),
            time: "07:30",
            fromLocation: "Makkah Hotel",
            toLocation: "Madinah Hotel",
            requiresBus: true,
            transferByTrain: false,
          },
          {
            sortOrder: 2,
            dateLabel: toShortDateLabel(departureDate),
            yearLabel: `${departureDate.getUTCFullYear()}`,
            category: "Departure",
            categoryKey: "departure",
            title: "Departure to airport",
            meta: "11:30 AM | Madinah Hotel -> MED Airport",
            icon: "flight_takeoff",
            highlighted: false,
            isoDate: toUtcMidnightDate(departureIso),
            time: "11:30",
            flightNumber: "GA-981",
            fromLocation: "Madinah Hotel",
            toLocation: "MED Airport",
            requiresBus: true,
            hotelPickupRequestTime: "09:00",
            transferByTrain: false,
          },
        ],
      },
      notes: {
        create: [
          {
            sortOrder: 0,
            text: "Bus status: Visa+.",
            pinned: true,
          },
          {
            sortOrder: 1,
            text: "Seed data for local integration testing.",
            pinned: false,
          },
          {
            sortOrder: 2,
            text: "Overview case: arrival + transfer + departure.",
            pinned: false,
          },
        ],
      },
      visaSetup: {
        create: {
          visaStatus: VisaStatus.PENDING,
          syarikah: "Daleel Maalem",
          paymentStatus: VisaPaymentStatus.PARTIAL,
          hotelAgreements: {
            create: [
              {
                city: AgreementCity.MAKKAH,
                hotelName: "Swissotel Al Maqam",
                agreementNumber: "20269017001001",
                pax: 45,
                status: AgreementApprovalStatus.APPROVED,
                stayStart: toUtcMidnightDate(arrivalIso),
                stayEnd: toUtcMidnightDate(transferIso),
              },
              {
                city: AgreementCity.MADINAH,
                hotelName: "Pullman Zamzam Madinah",
                agreementNumber: "20269017001002",
                pax: 45,
                status: AgreementApprovalStatus.WAITING,
                stayStart: toUtcMidnightDate(transferIso),
                stayEnd: toUtcMidnightDate(departureIso),
              },
            ],
          },
          raudhahAppointments: {
            create: [
              {
                date: toUtcMidnightDate(transferIso),
                status: GroupRaudhahStatus.AFTER,
              },
            ],
          },
        },
      },
      checklistAssignments: {
        create: [
          {
            tripDate: toUtcMidnightDate(arrivalIso),
            activity: "Arrival",
            tripLabel: "Arrival and transfer to Makkah hotel",
            requiredBusCount: 1,
            scheduledTime: "09:30",
            transferByTrain: false,
            status: ChecklistAssignmentStatus.ASSIGNED,
            drivers: {
              create: [
                {
                  slotNumber: 1,
                  name: "Yusuf Mansur",
                  phone: "+966 50 111 2222",
                  plateNumber: "B 1234 ABC",
                  isVerified: true,
                },
              ],
            },
          },
        ],
      },
    },
  }));

  await prisma.group.create(withGroupSearchDocument({
    data: {
      code: "9017001002",
      name: "Issued Paid Train Group",
      status: "Active",
      arrivalDate: toUtcMidnightDate(trainMakkahStayStartIso),
      returnDate: toUtcMidnightDate(trainDepartureIso),
      tone: GroupTone.ACTIVE,
      pax: 38,
      totalBuses: 2,
      packageName: "Umrah Executive",
      durationDays: 10,
      itinerary: {
        create: [
          {
            sortOrder: 0,
            dateLabel: toShortDateLabel(trainTransferDate),
            yearLabel: `${trainTransferDate.getUTCFullYear()}`,
            category: "Transfer",
            categoryKey: "transfer",
            title: "Train transfer to Madinah",
            meta: "10:20 AM | Haramain Train",
            icon: "train",
            highlighted: true,
            isoDate: toUtcMidnightDate(trainTransferIso),
            time: "10:20",
            fromLocation: "Makkah Station",
            toLocation: "Madinah Station",
            requiresBus: true,
            transferByTrain: true,
            trainDepartureTime: "10:20",
            destinationPickupTime: "12:05",
          },
          {
            sortOrder: 1,
            dateLabel: toShortDateLabel(trainDepartureDate),
            yearLabel: `${trainDepartureDate.getUTCFullYear()}`,
            category: "Departure",
            categoryKey: "departure",
            title: "Departure to airport",
            meta: "03:15 PM | MED Airport",
            icon: "flight_takeoff",
            highlighted: false,
            isoDate: toUtcMidnightDate(trainDepartureIso),
            time: "15:15",
            fromLocation: "Madinah Hotel",
            toLocation: "MED Airport",
            requiresBus: true,
            hotelPickupRequestTime: "12:45",
            transferByTrain: false,
          },
        ],
      },
      visaSetup: {
        create: {
          visaStatus: VisaStatus.ISSUED,
          issuedDate: toUtcMidnightDate(issuedIso),
          syarikah: "Nusuk Premium",
          paymentStatus: VisaPaymentStatus.PAID,
          hotelAgreements: {
            create: [
              {
                city: AgreementCity.MAKKAH,
                hotelName: "Anjum Makkah",
                agreementNumber: "20269017002001",
                pax: 38,
                status: AgreementApprovalStatus.APPROVED,
                stayStart: toUtcMidnightDate(trainMakkahStayStartIso),
                stayEnd: toUtcMidnightDate(trainTransferIso),
              },
              {
                city: AgreementCity.MADINAH,
                hotelName: "Sofitel Shahd Al Madinah",
                agreementNumber: "20269017002002",
                pax: 38,
                status: AgreementApprovalStatus.APPROVED,
                stayStart: toUtcMidnightDate(trainTransferIso),
                stayEnd: toUtcMidnightDate(trainDepartureIso),
              },
            ],
          },
          raudhahAppointments: {
            create: [
              {
                date: toUtcMidnightDate(trainTransferIso),
                status: GroupRaudhahStatus.BEFORE,
              },
            ],
          },
        },
      },
      checklistAssignments: {
        create: [
          {
            tripDate: toUtcMidnightDate(trainDepartureHMinusOneIso),
            activity: "Departure",
            tripLabel: "H-1 preparation departure to airport",
            requiredBusCount: 2,
            scheduledTime: "12:45",
            transferByTrain: false,
            status: ChecklistAssignmentStatus.ASSIGNED,
            drivers: {
              create: [
                {
                  slotNumber: 1,
                  name: "Saiful Bahri",
                  phone: "+966 55 101 0101",
                  plateNumber: "H 1234 ZZ",
                  isVerified: true,
                },
                {
                  slotNumber: 2,
                  name: "Ridwan Hakim",
                  phone: "+966 55 202 0202",
                  plateNumber: "H 5678 YY",
                  isVerified: false,
                },
              ],
            },
          },
          {
            tripDate: toUtcMidnightDate(trainDepartureIso),
            activity: "Departure",
            tripLabel: "Departure to airport",
            requiredBusCount: 2,
            scheduledTime: "12:45",
            transferByTrain: false,
            status: ChecklistAssignmentStatus.NOT_COMPLETE,
            drivers: {
              create: [],
            },
          },
        ],
      },
    },
  }));

  await prisma.group.create(withGroupSearchDocument({
    data: {
      code: "9017001003",
      name: "Draft Visa Missing Hotel Group",
      status: "Active",
      arrivalDate: toUtcMidnightDate(draftArrivalIso),
      returnDate: toUtcMidnightDate(draftDepartureIso),
      tone: GroupTone.ACTIVE,
      pax: 30,
      totalBuses: 1,
      packageName: "Umrah Regular",
      durationDays: 8,
      itinerary: {
        create: [
          {
            sortOrder: 0,
            dateLabel: toShortDateLabel(draftArrivalDate),
            yearLabel: `${draftArrivalDate.getUTCFullYear()}`,
            category: "Arrival",
            categoryKey: "arrival",
            title: "Arrival and temporary accommodation",
            meta: "06:10 AM | GA-970",
            icon: "flight_land",
            highlighted: false,
            isoDate: toUtcMidnightDate(draftArrivalIso),
            time: "06:10",
            fromLocation: "JED Airport",
            toLocation: "Temporary Hotel",
            requiresBus: true,
            transferByTrain: false,
          },
          {
            sortOrder: 1,
            dateLabel: toShortDateLabel(draftDepartureDate),
            yearLabel: `${draftDepartureDate.getUTCFullYear()}`,
            category: "Departure",
            categoryKey: "departure",
            title: "Return to Jakarta",
            meta: "09:40 PM | GA-971",
            icon: "flight_takeoff",
            highlighted: false,
            isoDate: toUtcMidnightDate(draftDepartureIso),
            time: "21:40",
            fromLocation: "Madinah Hotel",
            toLocation: "MED Airport",
            requiresBus: true,
            hotelPickupRequestTime: "18:30",
            transferByTrain: false,
          },
        ],
      },
      visaSetup: {
        create: {
          visaStatus: VisaStatus.DRAFT,
          syarikah: "Pending Provider Selection",
          paymentStatus: VisaPaymentStatus.UNPAID,
          hotelAgreements: {
            create: [],
          },
          raudhahAppointments: {
            create: [
              {
                date: toUtcMidnightDate(draftRaudhahIso),
                status: GroupRaudhahStatus.FREE,
              },
            ],
          },
        },
      },
      checklistAssignments: {
        create: [
          {
            tripDate: toUtcMidnightDate(draftDepartureHMinusOneIso),
            activity: "Departure",
            tripLabel: "H-1 readiness return to Jakarta",
            requiredBusCount: 1,
            scheduledTime: "18:30",
            transferByTrain: false,
            status: ChecklistAssignmentStatus.NOT_COMPLETE,
            drivers: {
              create: [],
            },
          },
        ],
      },
    },
  }));

  await prisma.group.create(withGroupSearchDocument({
    data: {
      code: "9017001004",
      name: "Inactive Archive Group",
      status: "Inactive",
      arrivalDate: toUtcMidnightDate(archiveArrivalIso),
      returnDate: toUtcMidnightDate(archiveReturnIso),
      tone: GroupTone.INACTIVE,
      pax: 22,
      totalBuses: 1,
      packageName: "Archive Package",
      durationDays: 7,
      notes: {
        create: [
          {
            sortOrder: 0,
            text: "No visa setup by design for null-visa case.",
            pinned: false,
          },
        ],
      },
    },
  }));

  await prisma.group.create(withGroupSearchDocument({
    data: {
      code: "9017001005",
      name: "Overview Arrival Only Group",
      status: "Active",
      arrivalDate: toUtcMidnightDate(overviewArrivalOnlyIso),
      returnDate: toUtcMidnightDate(overviewArrivalOnlyIso),
      tone: GroupTone.ACTIVE,
      pax: 20,
      totalBuses: 1,
      packageName: "Overview Arrival Only",
      durationDays: 1,
      nextActivity: {
        create: {
          title: "Arrival and transfer to Makkah hotel",
          dateLabel: toShortDateLabel(overviewArrivalOnlyDate),
          timeLabel: "07:15",
          icon: "flight_land",
        },
      },
      timeline: {
        create: [
          {
            sortOrder: 0,
            dateLabel: toShortDateLabel(overviewArrivalOnlyDate),
            title: "Arrival",
            isCurrent: true,
            nextActivity: "Arrival and transfer to Makkah hotel",
          },
        ],
      },
      itinerary: {
        create: [
          {
            sortOrder: 0,
            dateLabel: toShortDateLabel(overviewArrivalOnlyDate),
            yearLabel: `${overviewArrivalOnlyDate.getUTCFullYear()}`,
            category: "Arrival",
            categoryKey: "arrival",
            title: "Arrival and transfer to Makkah hotel",
            meta: "07:15 | JED Airport -> Makkah Hotel",
            icon: "flight_land",
            highlighted: true,
            isoDate: toUtcMidnightDate(overviewArrivalOnlyIso),
            time: "07:15",
            fromLocation: "JED Airport",
            toLocation: "Makkah Hotel",
            requiresBus: true,
            transferByTrain: false,
          },
        ],
      },
      notes: {
        create: [
          {
            sortOrder: 0,
            text: "Bus status: Visa+.",
            pinned: true,
          },
          {
            sortOrder: 1,
            text: "Overview case: arrival only.",
            pinned: false,
          },
        ],
      },
      visaSetup: {
        create: {
          visaStatus: VisaStatus.ISSUED,
          issuedDate: toUtcMidnightDate(issuedIso),
          syarikah: "Overview Provider Arrival",
          paymentStatus: VisaPaymentStatus.PAID,
          hotelAgreements: {
            create: [
              {
                city: AgreementCity.MAKKAH,
                hotelName: "Makkah Arrival Base",
                agreementNumber: "20269017005001",
                pax: 20,
                status: AgreementApprovalStatus.APPROVED,
                stayStart: toUtcMidnightDate(overviewArrivalOnlyIso),
                stayEnd: toUtcMidnightDate(overviewArrivalOnlyIso),
              },
            ],
          },
          raudhahAppointments: {
            create: [],
          },
        },
      },
    },
  }));

  await prisma.group.create(withGroupSearchDocument({
    data: {
      code: "9017001006",
      name: "Overview Arrival Departure Group",
      status: "Active",
      arrivalDate: toUtcMidnightDate(overviewArrivalDepartureArrivalIso),
      returnDate: toUtcMidnightDate(overviewArrivalDepartureReturnIso),
      tone: GroupTone.ACTIVE,
      pax: 28,
      totalBuses: 1,
      packageName: "Overview Arrival Departure",
      durationDays: 3,
      nextActivity: {
        create: {
          title: "Arrival and transfer to Makkah hotel",
          dateLabel: toShortDateLabel(overviewArrivalDepartureArrivalDate),
          timeLabel: "07:45",
          icon: "flight_land",
        },
      },
      timeline: {
        create: [
          {
            sortOrder: 0,
            dateLabel: toShortDateLabel(overviewArrivalDepartureArrivalDate),
            title: "Arrival",
            isCurrent: true,
            nextActivity: "Arrival and transfer to Makkah hotel",
          },
          {
            sortOrder: 1,
            dateLabel: toShortDateLabel(overviewArrivalDepartureReturnDate),
            title: "Departure",
            isCurrent: false,
            nextActivity: null,
          },
        ],
      },
      itinerary: {
        create: [
          {
            sortOrder: 0,
            dateLabel: toShortDateLabel(overviewArrivalDepartureArrivalDate),
            yearLabel: `${overviewArrivalDepartureArrivalDate.getUTCFullYear()}`,
            category: "Arrival",
            categoryKey: "arrival",
            title: "Arrival and transfer to Makkah hotel",
            meta: "07:45 | JED Airport -> Makkah Hotel",
            icon: "flight_land",
            highlighted: true,
            isoDate: toUtcMidnightDate(overviewArrivalDepartureArrivalIso),
            time: "07:45",
            fromLocation: "JED Airport",
            toLocation: "Makkah Hotel",
            requiresBus: true,
            transferByTrain: false,
          },
          {
            sortOrder: 1,
            dateLabel: toShortDateLabel(overviewArrivalDepartureReturnDate),
            yearLabel: `${overviewArrivalDepartureReturnDate.getUTCFullYear()}`,
            category: "Departure",
            categoryKey: "departure",
            title: "Departure to airport",
            meta: "21:45 | Madinah Hotel -> MED Airport",
            icon: "flight_takeoff",
            highlighted: false,
            isoDate: toUtcMidnightDate(overviewArrivalDepartureReturnIso),
            time: "21:45",
            fromLocation: "Madinah Hotel",
            toLocation: "MED Airport",
            requiresBus: true,
            hotelPickupRequestTime: "18:30",
            transferByTrain: false,
          },
        ],
      },
      notes: {
        create: [
          {
            sortOrder: 0,
            text: "Bus status: Visa+.",
            pinned: true,
          },
          {
            sortOrder: 1,
            text: "Overview case: arrival + departure.",
            pinned: false,
          },
        ],
      },
      visaSetup: {
        create: {
          visaStatus: VisaStatus.ISSUED,
          issuedDate: toUtcMidnightDate(issuedIso),
          syarikah: "Overview Provider ArrivalDeparture",
          paymentStatus: VisaPaymentStatus.PAID,
          hotelAgreements: {
            create: [
              {
                city: AgreementCity.MAKKAH,
                hotelName: "Makkah Direct Return Hotel",
                agreementNumber: "20269017006001",
                pax: 28,
                status: AgreementApprovalStatus.APPROVED,
                stayStart: toUtcMidnightDate(overviewArrivalDepartureArrivalIso),
                stayEnd: toUtcMidnightDate(overviewArrivalDepartureReturnIso),
              },
            ],
          },
          raudhahAppointments: {
            create: [],
          },
        },
      },
      checklistAssignments: {
        create: [
          {
            tripDate: toUtcMidnightDate(overviewArrivalDepartureHMinusOneIso),
            activity: "Departure",
            tripLabel: "H-1 preparation departure to airport",
            requiredBusCount: 1,
            scheduledTime: "18:30",
            transferByTrain: false,
            status: ChecklistAssignmentStatus.NOT_COMPLETE,
            drivers: {
              create: [],
            },
          },
        ],
      },
    },
  }));

  await prisma.group.create(withGroupSearchDocument({
    data: {
      code: "9017001007",
      name: "Overview Full Trip Group",
      status: "Active",
      arrivalDate: toUtcMidnightDate(overviewFullTripArrivalIso),
      returnDate: toUtcMidnightDate(overviewFullTripReturnIso),
      tone: GroupTone.ACTIVE,
      pax: 46,
      totalBuses: 2,
      packageName: "Overview Full Trip",
      durationDays: 5,
      nextActivity: {
        create: {
          title: "Arrival and transfer to Makkah hotel",
          dateLabel: toShortDateLabel(overviewFullTripArrivalDate),
          timeLabel: "06:55",
          icon: "flight_land",
        },
      },
      timeline: {
        create: [
          {
            sortOrder: 0,
            dateLabel: toShortDateLabel(overviewFullTripArrivalDate),
            title: "Arrival",
            isCurrent: true,
            nextActivity: "Arrival and transfer to Makkah hotel",
          },
          {
            sortOrder: 1,
            dateLabel: toShortDateLabel(overviewFullTripReturnDate),
            title: "Departure",
            isCurrent: false,
            nextActivity: null,
          },
        ],
      },
      itinerary: {
        create: [
          {
            sortOrder: 0,
            dateLabel: toShortDateLabel(overviewFullTripArrivalDate),
            yearLabel: `${overviewFullTripArrivalDate.getUTCFullYear()}`,
            category: "Arrival",
            categoryKey: "arrival",
            title: "Arrival and transfer to Makkah hotel",
            meta: "06:55 | JED Airport -> Makkah Hotel",
            icon: "flight_land",
            highlighted: true,
            isoDate: toUtcMidnightDate(overviewFullTripArrivalIso),
            time: "06:55",
            fromLocation: "JED Airport",
            toLocation: "Makkah Hotel",
            requiresBus: true,
            transferByTrain: false,
          },
          {
            sortOrder: 1,
            dateLabel: toShortDateLabel(overviewFullTripMakkahTourDate),
            yearLabel: `${overviewFullTripMakkahTourDate.getUTCFullYear()}`,
            category: "City Tour",
            categoryKey: "city-tour",
            title: "Makkah City Tour",
            meta: "08:00 | Makkah Hotel -> Masjidil Haram",
            icon: "tour",
            highlighted: false,
            isoDate: toUtcMidnightDate(overviewFullTripMakkahTourIso),
            time: "08:00",
            fromLocation: "Makkah Hotel",
            toLocation: "Masjidil Haram",
            cityTourCity: "Makkah",
            requiresBus: true,
            transferByTrain: false,
          },
          {
            sortOrder: 2,
            dateLabel: toShortDateLabel(overviewFullTripTransferDate),
            yearLabel: `${overviewFullTripTransferDate.getUTCFullYear()}`,
            category: "Transfer",
            categoryKey: "transfer",
            title: "Transfer from Makkah to Madinah",
            meta: "08:30 | Makkah Hotel -> Madinah Hotel",
            icon: "swap_horiz",
            highlighted: false,
            isoDate: toUtcMidnightDate(overviewFullTripTransferIso),
            time: "08:30",
            fromLocation: "Makkah Hotel",
            toLocation: "Madinah Hotel",
            requiresBus: true,
            transferByTrain: false,
          },
          {
            sortOrder: 3,
            dateLabel: toShortDateLabel(overviewFullTripMadinahTourDate),
            yearLabel: `${overviewFullTripMadinahTourDate.getUTCFullYear()}`,
            category: "City Tour",
            categoryKey: "city-tour",
            title: "Madinah City Tour",
            meta: "09:00 | Madinah Hotel -> Masjid Nabawi",
            icon: "tour",
            highlighted: false,
            isoDate: toUtcMidnightDate(overviewFullTripMadinahTourIso),
            time: "09:00",
            fromLocation: "Madinah Hotel",
            toLocation: "Masjid Nabawi",
            cityTourCity: "Madinah",
            requiresBus: true,
            transferByTrain: false,
          },
          {
            sortOrder: 4,
            dateLabel: toShortDateLabel(overviewFullTripReturnDate),
            yearLabel: `${overviewFullTripReturnDate.getUTCFullYear()}`,
            category: "Departure",
            categoryKey: "departure",
            title: "Departure to airport",
            meta: "21:45 | Madinah Hotel -> MED Airport",
            icon: "flight_takeoff",
            highlighted: false,
            isoDate: toUtcMidnightDate(overviewFullTripReturnIso),
            time: "21:45",
            fromLocation: "Madinah Hotel",
            toLocation: "MED Airport",
            requiresBus: true,
            hotelPickupRequestTime: "18:30",
            transferByTrain: false,
          },
        ],
      },
      notes: {
        create: [
          {
            sortOrder: 0,
            text: "Bus status: Visa+.",
            pinned: true,
          },
          {
            sortOrder: 1,
            text: "Overview case: full trip itinerary.",
            pinned: false,
          },
        ],
      },
      visaSetup: {
        create: {
          visaStatus: VisaStatus.ISSUED,
          issuedDate: toUtcMidnightDate(issuedIso),
          syarikah: "Overview Provider Full Trip",
          paymentStatus: VisaPaymentStatus.PAID,
          hotelAgreements: {
            create: [
              {
                city: AgreementCity.MAKKAH,
                hotelName: "Makkah Full Trip Hotel",
                agreementNumber: "20269017007001",
                pax: 46,
                status: AgreementApprovalStatus.APPROVED,
                stayStart: toUtcMidnightDate(overviewFullTripArrivalIso),
                stayEnd: toUtcMidnightDate(overviewFullTripTransferIso),
              },
              {
                city: AgreementCity.MADINAH,
                hotelName: "Madinah Full Trip Hotel",
                agreementNumber: "20269017007002",
                pax: 46,
                status: AgreementApprovalStatus.APPROVED,
                stayStart: toUtcMidnightDate(overviewFullTripTransferIso),
                stayEnd: toUtcMidnightDate(overviewFullTripReturnIso),
              },
            ],
          },
          raudhahAppointments: {
            create: [
              {
                date: toUtcMidnightDate(overviewFullTripMadinahTourIso),
                status: GroupRaudhahStatus.AFTER,
              },
            ],
          },
        },
      },
      checklistAssignments: {
        create: [
          {
            tripDate: toUtcMidnightDate(overviewFullTripHMinusOneIso),
            activity: "Departure",
            tripLabel: "H-1 preparation departure to airport",
            requiredBusCount: 2,
            scheduledTime: "18:30",
            transferByTrain: false,
            status: ChecklistAssignmentStatus.ASSIGNED,
            drivers: {
              create: [
                {
                  slotNumber: 1,
                  name: "Farid Kamil",
                  phone: "+966 55 303 0303",
                  plateNumber: "OVR 7001",
                  isVerified: true,
                },
              ],
            },
          },
        ],
      },
    },
  }));

  console.log("Seeded groups: 9017001001, 9017001002, 9017001003, 9017001004, 9017001005, 9017001006, 9017001007");
}

async function seedInvoiceClients({ resetDataFirst }: { resetDataFirst: boolean }): Promise<void> {
  const existingCount = await prisma.invoiceClient.count();
  if (existingCount > 0 && !resetDataFirst) {
    console.log(
      `Invoice client seed skipped: found ${existingCount} existing client(s). Set SEED_RESET=true to reset and reseed.`,
    );
    return;
  }

  const defaultClients = [
    { sortOrder: 1, name: "Yassir", groupCode: "9017001001" },
    { sortOrder: 2, name: "Haris", groupCode: "9017001002" },
    { sortOrder: 3, name: "JSA", groupCode: null },
    { sortOrder: 4, name: "Umrah Corporate", groupCode: "9017001003" },
  ] as const;

  const groupCodes = defaultClients
    .map((entry) => entry.groupCode)
    .filter((entry): entry is Exclude<typeof entry, null> => entry !== null && entry.length > 0);
  const matchedGroups = groupCodes.length
    ? await prisma.group.findMany({
        where: {
          code: {
            in: groupCodes,
          },
        },
        select: {
          id: true,
          code: true,
        },
      })
    : [];
  const groupIdByCode = new Map(matchedGroups.map((group) => [group.code, group.id]));

  for (const client of defaultClients) {
    const groupId = client.groupCode ? requireGroupId(client.groupCode, groupIdByCode) : null;

    const existing = await prisma.invoiceClient.findFirst({
      where: {
        sortOrder: client.sortOrder,
      },
    });

    if (existing) {
      await prisma.invoiceClient.update({
        where: {
          id: existing.id,
        },
        data: {
          name: client.name,
          groupId,
        },
      });
    } else {
      await prisma.invoiceClient.create({
        data: {
          name: client.name,
          sortOrder: client.sortOrder,
          groupId,
        },
      });
    }
  }

  console.log("Seeded invoice clients: 01. Yassir, 02. Haris, 03. JSA, 04. Umrah Corporate");
}

async function seedInvoices({ resetDataFirst }: { resetDataFirst: boolean }): Promise<void> {
  const existingCount = await prisma.invoice.count();
  if (existingCount > 0 && !resetDataFirst) {
    console.log(
      `Invoice seed skipped: found ${existingCount} existing invoice(s). Set SEED_RESET=true to reset and reseed.`,
    );
    return;
  }

  const now = new Date();
  const year = now.getUTCFullYear();
  const invoiceSeeds = [
    {
      invoiceNumber: `GTT/INV/${year}/0001`,
      clientSortOrder: 1,
      groupCode: "9017001001",
      issuedDateIso: toIsoDateOnly(addUtcDays(now, -21)),
      dueDateIso: toIsoDateOnly(addUtcDays(now, 14)),
      amount: 17500000,
      status: InvoiceStatus.PENDING,
      notes: "Pending invoice with future due date.",
    },
    {
      invoiceNumber: `GTT/INV/${year}/0002`,
      clientSortOrder: 2,
      groupCode: "9017001002",
      issuedDateIso: toIsoDateOnly(addUtcDays(now, -45)),
      dueDateIso: toIsoDateOnly(addUtcDays(now, -10)),
      amount: 9800000,
      status: InvoiceStatus.PENDING,
      notes: "Past due invoice that should resolve as Overdue.",
    },
    {
      invoiceNumber: `GTT/INV/${year}/0003`,
      clientSortOrder: 3,
      groupCode: null,
      issuedDateIso: toIsoDateOnly(addUtcDays(now, -14)),
      dueDateIso: toIsoDateOnly(addUtcDays(now, 5)),
      amount: 4500000,
      status: InvoiceStatus.PAID,
      notes: "Paid invoice without linked group.",
    },
    {
      invoiceNumber: `GTT/INV/${year}/0004`,
      clientSortOrder: 4,
      groupCode: "9017001003",
      issuedDateIso: toIsoDateOnly(addUtcDays(now, -90)),
      dueDateIso: toIsoDateOnly(addUtcDays(now, 60)),
      amount: 22200000,
      status: InvoiceStatus.OVERDUE,
      notes: "Manually marked overdue scenario.",
    },
    {
      invoiceNumber: `GTT/INV/${year}/0005`,
      clientSortOrder: 2,
      groupCode: "9017001002",
      issuedDateIso: toIsoDateOnly(addUtcDays(now, -30)),
      dueDateIso: toIsoDateOnly(addUtcDays(now, 20)),
      amount: 7100000,
      status: InvoiceStatus.CANCELLED,
      notes: "Cancelled invoice for delete-block flow.",
    },
  ] as const;

  const clients = await prisma.invoiceClient.findMany({
    select: {
      id: true,
      sortOrder: true,
    },
  });
  const clientIdBySortOrder = new Map(clients.map((client) => [client.sortOrder, client.id]));

  const groupCodes = invoiceSeeds
    .map((entry) => entry.groupCode)
    .filter((entry): entry is Exclude<typeof entry, null> => entry !== null && entry.length > 0);
  const matchedGroups = groupCodes.length
    ? await prisma.group.findMany({
        where: {
          code: {
            in: groupCodes,
          },
        },
        select: {
          id: true,
          code: true,
        },
      })
    : [];
  const groupIdByCode = new Map(matchedGroups.map((group) => [group.code, group.id]));

  for (const seed of invoiceSeeds) {
    const clientId = clientIdBySortOrder.get(seed.clientSortOrder);
    if (!clientId) {
      throw new Error(`Invoice client with sortOrder '${seed.clientSortOrder}' not found while seeding invoices.`);
    }

    const groupId = seed.groupCode ? requireGroupId(seed.groupCode, groupIdByCode) : null;

    await prisma.invoice.create({
      data: {
        invoiceNumber: seed.invoiceNumber,
        clientId,
        groupId,
        issuedDate: toUtcMidnightDate(seed.issuedDateIso),
        dueDate: toUtcMidnightDate(seed.dueDateIso),
        amount: seed.amount,
        status: seed.status,
        notes: seed.notes,
      },
    });
  }

  console.log(
    `Seeded invoices: ${invoiceSeeds.map((invoice) => `${invoice.invoiceNumber} (${invoice.status})`).join(", ")}`,
  );
}

async function main(): Promise<void> {
  assertSeedAllowedInCurrentEnvironment();

  const resetDataFirst = process.env.SEED_RESET?.toLowerCase() === "true";

  if (resetDataFirst) {
    console.log("SEED_RESET=true detected. Existing data will be cleared before seeding.");
    await resetData();
  } else {
    console.log("SEED_RESET is not enabled. Existing data will be preserved.");
  }

  await seedAuthUsers();
  await seedMasterData({ resetDataFirst });
  await seedGroups({ resetDataFirst });
  await seedInvoiceClients({ resetDataFirst });
  await seedInvoices({ resetDataFirst });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seed completed.");
  })
  .catch(async (error: unknown) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
