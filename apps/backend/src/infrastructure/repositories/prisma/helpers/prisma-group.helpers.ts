import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupTone,
  Prisma,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import { CreateGroupDto } from "../../../../groups/dto/create-group.dto";
import { resolveGroupLifecycleStatus } from "../../../../groups/domain/groups.lifecycle-status";
import { resolveItineraryTitle } from "../../../../groups/domain/groups-itinerary-title";
import { buildGroupSearchDocument, normalizeGroupSearchTokens } from "../../../../groups/domain/groups.search-document";
import type { FindAllOptions, GroupListFilter } from "../../../../groups/groups.service-types";

// ==========================================
// SELECTIONS (from groups.prisma-include.ts)
// ==========================================

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
    transportMode: true,
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
  agentId: true,
  agent: { select: { id: true, code: true, name: true, type: true, status: true, picName: true, phone: true, email: true } },
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
      makkahHotelWaived: true,
      madinahHotelWaived: true,
      arrivalFlightNumber: true,
      arrivalTime: true,
      departureFlightNumber: true,
      departureTime: true,
      createdAt: true,
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
  agentId: true,
  agent: { select: { id: true, code: true, name: true, type: true, status: true, picName: true, phone: true, email: true } },
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
      makkahHotelWaived: true,
      madinahHotelWaived: true,
      arrivalFlightNumber: true,
      arrivalTime: true,
      departureFlightNumber: true,
      departureTime: true,
      createdAt: true,
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

// ==========================================
// LISTING & QUERY BUILDERS (from groups.listing.ts)
// ==========================================

export function resolvePaginationState(options?: FindAllOptions): { page: number; pageSize: number } | null {
  const hasPage = Number.isFinite(options?.page);
  const hasPageSize = Number.isFinite(options?.pageSize);
  if (!hasPage && !hasPageSize) {
    return null;
  }

  const page = options?.page && options.page > 0 ? Math.floor(options.page) : 1;
  const requestedSize = options?.pageSize && options.pageSize > 0 ? Math.floor(options.pageSize) : 20;
  const pageSize = Math.max(1, Math.min(100, requestedSize));

  return { page, pageSize };
}

export function normalizeGroupListFilter(rawFilter?: string): GroupListFilter {
  const normalized = rawFilter?.trim().toLowerCase();
  if (normalized === "not-issued" || normalized === "missing-hotel" || normalized === "unpaid") {
    return normalized;
  }
  return "all";
}

export function buildGroupWhere(query?: string, rawFilter?: string, activeOnly = false, agentId?: string): Prisma.GroupWhereInput | undefined {
  const searchTokens = normalizeGroupSearchTokens(query);
  const filter = normalizeGroupListFilter(rawFilter);
  const conditions: Prisma.GroupWhereInput[] = [];

  if (agentId?.trim()) conditions.push({ agentId: agentId.trim() });

  if (searchTokens.length > 0) {
    conditions.push({
      AND: searchTokens.map<Prisma.GroupWhereInput>((token) => ({
        searchDocument: {
          contains: token,
          mode: "insensitive",
        },
      })),
    });
  }

  if (activeOnly) {
    conditions.push({
      tone: GroupTone.ACTIVE,
    });
  }

  if (filter === "not-issued") {
    conditions.push({
      OR: [
        {
          visaSetup: {
            is: null,
          },
        },
        {
          visaSetup: {
            is: {
              visaStatus: {
                not: VisaStatus.ISSUED,
              },
            },
          },
        },
      ],
    });
  } else if (filter === "missing-hotel") {
    conditions.push({
      OR: [
        {
          visaSetup: {
            is: null,
          },
        },
        {
          visaSetup: {
            is: {
              hotelAgreements: {
                none: {
                  city: "MAKKAH",
                },
              },
            },
          },
        },
        {
          visaSetup: {
            is: {
              hotelAgreements: {
                none: {
                  city: "MADINAH",
                },
              },
            },
          },
        },
      ],
    });
  } else if (filter === "unpaid") {
    conditions.push({
      OR: [
        {
          visaSetup: {
            is: null,
          },
        },
        {
          visaSetup: {
            is: {
              paymentStatus: {
                not: VisaPaymentStatus.PAID,
              },
            },
          },
        },
      ],
    });
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return {
    AND: conditions,
  };
}

// ==========================================
// WRITE BUILDERS (from groups.prisma-write-builders.ts)
// ==========================================

type BuildGroupWriteDataOptions = {
  nullifyMissingTotalBuses: boolean;
  preserveChecklistItineraryLinks: boolean;
};

function toIsoDateOnly(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid ISO date value '${value}'.`);
  }

  return parsedDate.toISOString().slice(0, 10);
}

function toUtcMidnight(input: string): Date {
  const isoDate = toIsoDateOnly(input);
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function buildTimelineCreate(timeline: CreateGroupDto["timeline"]) {
  if (!timeline || timeline.length === 0) {
    return undefined;
  }

  return {
    create: timeline.map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      dateLabel: item.dateLabel.trim(),
      title: item.title.trim(),
      isCurrent: item.isCurrent ?? false,
      nextActivity: item.nextActivity?.trim() || null,
    })),
  };
}

// Re-using local helper for date range validation or itinerary properties:
function buildItineraryCreate(itinerary: CreateGroupDto["itinerary"]) {
  if (!itinerary || itinerary.length === 0) {
    return undefined;
  }

  return {
    create: itinerary.map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      dateLabel: item.dateLabel.trim(),
      yearLabel: item.yearLabel.trim(),
      category: item.category.trim(),
      categoryKey: item.categoryKey?.trim() || null,
      title: resolveItineraryTitle({
        title: item.title,
        category: item.category,
        categoryKey: item.categoryKey,
        fromLocation: item.fromLocation,
        toLocation: item.toLocation,
        cityTourCity: item.cityTourCity,
      }),
      meta: item.meta.trim(),
      icon: item.icon.trim(),
      highlighted: item.highlighted ?? false,
      isoDate: item.isoDate ? toUtcMidnight(item.isoDate) : null,
      time: item.time?.trim() || null,
      transportMode: item.transportMode?.trim() || null,
      flightNumber: item.flightNumber?.trim() || null,
      hotelName: item.hotelName?.trim() || null,
      fromHotelName: item.fromHotelName?.trim() || null,
      fromLocation: item.fromLocation?.trim() || null,
      toLocation: item.toLocation?.trim() || null,
      cityTourCity: item.cityTourCity?.trim() || null,
      requiresBus: item.requiresBus ?? false,
      notes: item.notes?.trim() || null,
      transferByTrain: item.transferByTrain ?? false,
      trainDepartureTime: item.trainDepartureTime?.trim() || null,
      destinationPickupTime: item.destinationPickupTime?.trim() || null,
      hotelPickupRequestTime: item.hotelPickupRequestTime?.trim() || null,
    })),
  };
}

function buildNotesCreate(notes: CreateGroupDto["notes"]) {
  if (!notes || notes.length === 0) {
    return undefined;
  }

  return {
    create: notes.map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      text: item.text.trim(),
      pinned: item.pinned ?? false,
    })),
  };
}

function buildVisaSetupCreate(visaSetup: CreateGroupDto["visaSetup"]) {
  if (!visaSetup) {
    return undefined;
  }

  return {
    create: {
      visaStatus: visaSetup.visaStatus ?? VisaStatus.DRAFT,
      issuedDate: visaSetup.issuedDate ? toUtcMidnight(visaSetup.issuedDate) : null,
      syarikah: visaSetup.syarikah.trim(),
      busStatus: visaSetup.busStatus ?? null,
      paymentStatus: visaSetup.paymentStatus ?? VisaPaymentStatus.UNPAID,
      makkahHotelWaived: visaSetup.makkahHotelWaived ?? false,
      madinahHotelWaived: visaSetup.madinahHotelWaived ?? false,
      arrivalFlightNumber: visaSetup.arrivalFlightNumber?.trim() || null,
      arrivalTime: visaSetup.arrivalTime?.trim() || null,
      departureFlightNumber: visaSetup.departureFlightNumber?.trim() || null,
      departureTime: visaSetup.departureTime?.trim() || null,
      hotelAgreements:
        visaSetup.hotelAgreements && visaSetup.hotelAgreements.length > 0
          ? {
              create: visaSetup.hotelAgreements.map((hotel) => ({
                sourceDraftId: hotel.sourceDraftId?.trim() || null,
                city: hotel.city ?? AgreementCity.MAKKAH,
                hotelName: hotel.hotelName.trim(),
                agreementNumber: hotel.agreementNumber.trim(),
                pax: hotel.pax,
                status: hotel.status ?? AgreementApprovalStatus.WAITING,
                stayStart: toUtcMidnight(hotel.stayStart),
                stayEnd: toUtcMidnight(hotel.stayEnd),
              })),
            }
          : undefined,
      raudhahAppointments:
        visaSetup.raudhahAppointments && visaSetup.raudhahAppointments.length > 0
          ? {
              create: visaSetup.raudhahAppointments.map((appointment) => ({
                date: toUtcMidnight(appointment.date),
                status: appointment.status ?? GroupRaudhahStatus.FREE,
                tasrehPrinted: appointment.tasrehPrinted ?? false,
              })),
            }
          : undefined,
    },
  };
}

function buildChecklistAssignmentsCreate(
  checklistAssignments: CreateGroupDto["checklistAssignments"],
  preserveChecklistItineraryLinks: boolean,
) {
  if (!checklistAssignments || checklistAssignments.length === 0) {
    return undefined;
  }

  return {
    create: checklistAssignments.map((assignment) => ({
      itineraryItemId: preserveChecklistItineraryLinks ? assignment.itineraryItemId ?? null : null,
      tripDate: toUtcMidnight(assignment.tripDate),
      activity: assignment.activity.trim(),
      tripLabel: assignment.tripLabel.trim(),
      requiredBusCount: assignment.requiredBusCount,
      scheduledTime: assignment.scheduledTime.trim(),
      transferByTrain: assignment.transferByTrain ?? false,
      trainDepartureTime: assignment.trainDepartureTime?.trim() || null,
      stationPickupTime: assignment.stationPickupTime?.trim() || null,
      status: assignment.status ?? ChecklistAssignmentStatus.NOT_COMPLETE,
      drivers:
        assignment.drivers && assignment.drivers.length > 0
          ? {
              create: assignment.drivers.map((driver, index) => ({
                slotNumber: driver.slotNumber ?? index + 1,
                name: driver.name.trim(),
                phone: driver.phone.trim(),
                plateNumber: driver.plateNumber.trim(),
                isVerified: driver.isVerified ?? false,
              })),
            }
          : undefined,
    })),
  };
}

function buildGroupWriteData(
  payload: CreateGroupDto,
  normalizedCode: string,
  options: BuildGroupWriteDataOptions,
) {
  const lifecycleStatus = payload.lifecycleStatus ?? resolveGroupLifecycleStatus(payload.status);
  return {
    code: normalizedCode,
    name: payload.name.trim(),
    status: payload.status.trim(),
    lifecycleStatus,
    searchDocument: buildGroupSearchDocument({
      code: normalizedCode,
      name: payload.name,
      status: payload.status,
      packageName: payload.packageName,
    }),
    arrivalDate: toUtcMidnight(payload.arrivalDate),
    returnDate: toUtcMidnight(payload.returnDate),
    tone: payload.tone ?? GroupTone.ACTIVE,
    pax: payload.pax,
    totalBuses: options.nullifyMissingTotalBuses ? payload.totalBuses ?? null : payload.totalBuses,
    packageName: payload.packageName.trim(),
    durationDays: payload.durationDays,
    agentId: payload.agentId?.trim() || "agent_gtt_direct",
    parentGroupId: payload.parentGroupId?.trim() || null,
    musyrif: payload.musyrif
      ? {
          create: {
            name: payload.musyrif.name.trim(),
            phone: payload.musyrif.phone.trim(),
            avatar: payload.musyrif.avatar.trim(),
          },
        }
      : undefined,
    nextActivity: payload.nextActivity
      ? {
          create: {
            title: payload.nextActivity.title.trim(),
            dateLabel: payload.nextActivity.dateLabel.trim(),
            timeLabel: payload.nextActivity.timeLabel.trim(),
            icon: payload.nextActivity.icon.trim(),
          },
        }
      : undefined,
    timeline: buildTimelineCreate(payload.timeline),
    itinerary: buildItineraryCreate(payload.itinerary),
    notes: buildNotesCreate(payload.notes),
    visaSetup: buildVisaSetupCreate(payload.visaSetup),
    checklistAssignments: buildChecklistAssignmentsCreate(
      payload.checklistAssignments,
      options.preserveChecklistItineraryLinks,
    ),
  };
}

export function buildGroupCreateData(
  payload: CreateGroupDto,
  normalizedCode: string,
): Prisma.GroupUncheckedCreateInput {
  return buildGroupWriteData(payload, normalizedCode, {
    nullifyMissingTotalBuses: false,
    preserveChecklistItineraryLinks: true,
  });
}

export function buildGroupReplaceData(
  payload: CreateGroupDto,
  normalizedCode: string,
): Prisma.GroupUncheckedUpdateInput {
  return buildGroupWriteData(payload, normalizedCode, {
    nullifyMissingTotalBuses: true,
    preserveChecklistItineraryLinks: false,
  });
}

// ==========================================
// AUDIT HELPERS (from groups.audit.ts)
// ==========================================

type AuditJsonPrimitive = string | number | boolean | null;
type AuditJsonValue = AuditJsonPrimitive | AuditJsonValue[] | { [key: string]: AuditJsonValue };

export function sanitizeAuditPayloadValue(value: unknown): AuditJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAuditPayloadValue(entry) ?? null);
  }

  if (typeof value === "object") {
    const next: Record<string, AuditJsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      const sanitizedEntry = sanitizeAuditPayloadValue(entry);
      if (sanitizedEntry !== undefined) {
        next[key] = sanitizedEntry;
      }
    }
    return next;
  }

  return String(value);
}

export function extractGroupId(group: unknown): string | undefined {
  if (typeof group !== "object" || group === null || !("id" in group)) {
    return undefined;
  }

  const id = (group as { id?: unknown }).id;
  return typeof id === "string" ? id.trim() || undefined : undefined;
}

export function extractGroupCode(group: unknown): string | undefined {
  if (typeof group !== "object" || group === null) {
    return undefined;
  }

  const code =
    "code" in group
      ? (group as { code?: unknown }).code
      : "groupCode" in group
        ? (group as { groupCode?: unknown }).groupCode
        : undefined;
  return typeof code === "string" ? code.trim().toUpperCase() : undefined;
}
