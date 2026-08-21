import { randomUUID } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupTone,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import type { ConfirmChecklistDriverDto } from "../../../../groups/dto/confirm-checklist-driver.dto";
import type { CreateGroupDto } from "../../../../groups/dto/create-group.dto";
import type {
  UpsertGroupItineraryItemDto,
  ReplaceGroupItineraryDto,
  UpsertGroupRaudhahDto,
  UpsertGroupVisaHotelDto,
} from "../../../../groups/dto/group-operations.dto";
import type { ResetChecklistDriverDto } from "../../../../groups/dto/reset-checklist-driver.dto";
import type { UpdateGroupDto } from "../../../../groups/dto/update-group.dto";
import { validateHotelAgreementRules } from "../../../../groups/domain/groups.hotel-validation";
import { resolveAgreementDrivenVisaStatus } from "../../../../groups/domain/visa-status-transition";
import { resolveItineraryTitle } from "../../../../groups/domain/groups-itinerary-title";
import {
  parseIsoDateOnly,
  toChecklistAssignmentSyncResult,
  toIsoDateOnly,
  toShortDateLabel,
  validateTravelDateRangeOrThrow,
} from "../../../../groups/domain/groups.shared";
import type {
  ChecklistAssignmentSyncResult,
  MemoryChecklistAssignment,
  MemoryGroupRecord,
  MemoryItineraryItem,
  MemoryRaudhahAppointment,
  MemoryVisaHotelAgreement,
  MemoryVisaSetup,
  FindAllOptions,
  GroupResponseProjection,
  MemoryGroupSummaryRecord,
  PaginatedGroupList,
  GroupListFilter,
} from "../../../../groups/groups.service-types";
import { buildGroupSearchDocument, normalizeGroupSearchTokens } from "../../../../groups/domain/groups.search-document";

// ==========================================
// BUILDERS & PAYLOADS (from groups.memory-builders.ts / groups.memory-group-payload.ts)
// ==========================================

export function buildMemoryItineraryItem(
  payload: UpsertGroupItineraryItemDto,
  sortOrder: number,
  id: string = randomUUID(),
): MemoryItineraryItem {
  return {
    id,
    sortOrder,
    dateLabel: payload.dateLabel.trim(),
    yearLabel: payload.yearLabel.trim(),
    category: payload.category.trim(),
    categoryKey: payload.categoryKey?.trim() || undefined,
    title: resolveItineraryTitle({
      title: payload.title,
      category: payload.category,
      categoryKey: payload.categoryKey,
      fromLocation: payload.fromLocation,
      toLocation: payload.toLocation,
      cityTourCity: payload.cityTourCity,
    }),
    meta: payload.meta.trim(),
    icon: payload.icon.trim(),
    highlighted: payload.highlighted ?? false,
    isoDate: payload.isoDate,
    time: payload.time?.trim() || undefined,
    transportMode: payload.transportMode?.trim() || undefined,
    flightNumber: payload.flightNumber?.trim() || undefined,
    hotelName: payload.hotelName?.trim() || undefined,
    fromHotelName: payload.fromHotelName?.trim() || undefined,
    fromLocation: payload.fromLocation?.trim() || undefined,
    toLocation: payload.toLocation?.trim() || undefined,
    cityTourCity: payload.cityTourCity?.trim() || undefined,
    requiresBus: payload.requiresBus ?? false,
    notes: payload.notes?.trim() || undefined,
    transferByTrain: payload.transferByTrain ?? false,
    trainDepartureTime: payload.trainDepartureTime?.trim() || undefined,
    destinationPickupTime: payload.destinationPickupTime?.trim() || undefined,
    hotelPickupRequestTime: payload.hotelPickupRequestTime?.trim() || undefined,
  };
}

export function buildMemoryVisaHotelAgreement(
  payload: UpsertGroupVisaHotelDto,
  id: string = randomUUID(),
): MemoryVisaHotelAgreement {
  return {
    id,
    city: payload.city,
    sourceDraftId: payload.sourceDraftId?.trim() || undefined,
    hotelName: payload.hotelName.trim(),
    agreementNumber: payload.agreementNumber.trim(),
    pax: payload.pax,
    status: payload.status ?? AgreementApprovalStatus.WAITING,
    stayStart: payload.stayStart,
    stayEnd: payload.stayEnd,
  };
}

export function buildMemoryRaudhahAppointment(
  payload: UpsertGroupRaudhahDto,
  id: string = randomUUID(),
): MemoryRaudhahAppointment {
  return {
    id,
    date: payload.date,
    status: payload.status ?? GroupRaudhahStatus.FREE,
    tasrehPrinted: payload.tasrehPrinted ?? false,
  };
}

export function ensureMemoryVisaSetup(group: MemoryGroupRecord): MemoryVisaSetup {
  if (!group.visaSetup) {
    group.visaSetup = {
      visaStatus: VisaStatus.DRAFT,
      issuedDate: undefined,
      syarikah: "Not assigned",
      paymentStatus: VisaPaymentStatus.UNPAID,
      makkahHotelWaived: false,
      madinahHotelWaived: false,
      hotelAgreements: [],
      raudhahAppointments: [],
    };
  }

  return group.visaSetup;
}

type MemoryGroupPayloadFields = Pick<
  MemoryGroupRecord,
  | "name"
  | "status"
  | "arrivalDate"
  | "returnDate"
  | "tone"
  | "pax"
  | "totalBuses"
  | "packageName"
  | "durationDays"
  | "musyrif"
  | "nextActivity"
  | "timeline"
  | "itinerary"
  | "notes"
  | "visaSetup"
  | "checklistAssignments"
  | "parentGroupId"
  | "agentId"
>;

function toIsoDateOnlyLocal(value: string): string {
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

export function buildMemoryGroupPayloadFields(payload: CreateGroupDto): MemoryGroupPayloadFields {
  return {
    name: payload.name.trim(),
    status: payload.status.trim(),
    arrivalDate: toIsoDateOnlyLocal(payload.arrivalDate),
    returnDate: toIsoDateOnlyLocal(payload.returnDate),
    tone: payload.tone ?? GroupTone.ACTIVE,
    pax: payload.pax,
    totalBuses: payload.totalBuses ?? null,
    packageName: payload.packageName.trim(),
    durationDays: payload.durationDays,
    agentId: payload.agentId?.trim() || "agent_gtt_direct",
    parentGroupId: payload.parentGroupId?.trim() || null,
    musyrif: payload.musyrif
      ? {
          name: payload.musyrif.name.trim(),
          phone: payload.musyrif.phone.trim(),
          avatar: payload.musyrif.avatar.trim(),
        }
      : undefined,
    nextActivity: payload.nextActivity
      ? {
          title: payload.nextActivity.title.trim(),
          dateLabel: payload.nextActivity.dateLabel.trim(),
          timeLabel: payload.nextActivity.timeLabel.trim(),
          icon: payload.nextActivity.icon.trim(),
        }
      : undefined,
    timeline: (payload.timeline ?? []).map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      dateLabel: item.dateLabel.trim(),
      title: item.title.trim(),
      isCurrent: item.isCurrent ?? false,
      nextActivity: item.nextActivity?.trim() || undefined,
    })),
    itinerary: (payload.itinerary ?? []).map((item, index) => ({
      id: randomUUID(),
      sortOrder: item.sortOrder ?? index,
      dateLabel: item.dateLabel.trim(),
      yearLabel: item.yearLabel.trim(),
      category: item.category.trim(),
      categoryKey: item.categoryKey?.trim() || undefined,
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
      isoDate: item.isoDate,
      time: item.time?.trim() || undefined,
      transportMode: item.transportMode?.trim() || undefined,
      flightNumber: item.flightNumber?.trim() || undefined,
      hotelName: item.hotelName?.trim() || undefined,
      fromHotelName: item.fromHotelName?.trim() || undefined,
      fromLocation: item.fromLocation?.trim() || undefined,
      toLocation: item.toLocation?.trim() || undefined,
      cityTourCity: item.cityTourCity?.trim() || undefined,
      requiresBus: item.requiresBus ?? false,
      notes: item.notes?.trim() || undefined,
      transferByTrain: item.transferByTrain ?? false,
      trainDepartureTime: item.trainDepartureTime?.trim() || undefined,
      destinationPickupTime: item.destinationPickupTime?.trim() || undefined,
      hotelPickupRequestTime: item.hotelPickupRequestTime?.trim() || undefined,
    })),
    notes: (payload.notes ?? []).map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      text: item.text.trim(),
      pinned: item.pinned ?? false,
    })),
    visaSetup: payload.visaSetup
      ? {
          visaStatus: payload.visaSetup.visaStatus ?? VisaStatus.DRAFT,
          issuedDate: payload.visaSetup.issuedDate?.trim() || undefined,
          syarikah: payload.visaSetup.syarikah.trim(),
          busStatus: payload.visaSetup.busStatus,
          paymentStatus: payload.visaSetup.paymentStatus ?? VisaPaymentStatus.UNPAID,
          makkahHotelWaived: payload.visaSetup.makkahHotelWaived ?? false,
          madinahHotelWaived: payload.visaSetup.madinahHotelWaived ?? false,
          arrivalFlightNumber: payload.visaSetup.arrivalFlightNumber?.trim() || undefined,
          arrivalTime: payload.visaSetup.arrivalTime?.trim() || undefined,
          departureFlightNumber: payload.visaSetup.departureFlightNumber?.trim() || undefined,
          departureTime: payload.visaSetup.departureTime?.trim() || undefined,
          hotelAgreements: (payload.visaSetup.hotelAgreements ?? []).map((hotel) => ({
            id: randomUUID(),
            city: hotel.city ?? AgreementCity.MAKKAH,
            hotelName: hotel.hotelName.trim(),
            agreementNumber: hotel.agreementNumber.trim(),
            pax: hotel.pax,
            status: hotel.status ?? AgreementApprovalStatus.WAITING,
            stayStart: hotel.stayStart,
            stayEnd: hotel.stayEnd,
          })),
          raudhahAppointments: (payload.visaSetup.raudhahAppointments ?? []).map((appointment) => ({
            id: randomUUID(),
            idOrAppointment: randomUUID(),
            date: appointment.date,
            status: appointment.status ?? GroupRaudhahStatus.FREE,
            tasrehPrinted: appointment.tasrehPrinted ?? false,
          })),
        }
      : undefined,
    checklistAssignments: (payload.checklistAssignments ?? []).map((assignment) => ({
      id: randomUUID(),
      itineraryItemId: assignment.itineraryItemId,
      tripDate: assignment.tripDate,
      activity: assignment.activity.trim(),
      tripLabel: assignment.tripLabel.trim(),
      requiredBusCount: assignment.requiredBusCount,
      scheduledTime: assignment.scheduledTime.trim(),
      transferByTrain: assignment.transferByTrain ?? false,
      trainDepartureTime: assignment.trainDepartureTime?.trim() || undefined,
      stationPickupTime: assignment.stationPickupTime?.trim() || undefined,
      status: assignment.status ?? ChecklistAssignmentStatus.NOT_COMPLETE,
      drivers: (assignment.drivers ?? []).map((driver, index) => ({
        slotNumber: driver.slotNumber ?? index + 1,
        name: driver.name.trim(),
        phone: driver.phone.trim(),
        plateNumber: driver.plateNumber.trim(),
        isVerified: driver.isVerified ?? false,
      })),
    })),
  };
}

// ==========================================
// STORE CRUD & OPERATIONS (from groups.memory-store.ts)
// ==========================================

function addUtcDays(baseDate: Date, dayOffset: number): Date {
  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
  return nextDate;
}

function resolveMemoryGroupIndex(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
): number {
  const normalizedCode = idOrCode.trim().toUpperCase();
  return memoryGroups.findIndex(
    (item) => item.id === idOrCode || item.code === normalizedCode,
  );
}

function resolveNextSortOrder(entries: Array<{ sortOrder: number }>): number {
  if (entries.length === 0) {
    return 0;
  }

  return Math.max(...entries.map((entry) => entry.sortOrder)) + 1;
}

export function createDefaultMemoryGroups(): MemoryGroupRecord[] {
  const now = new Date();
  const createdAt = now.toISOString();
  const updatedAt = createdAt;

  const arrivalDate = addUtcDays(now, 3);
  const makkahCityTourDate = addUtcDays(now, 4);
  const intercityTransferDate = addUtcDays(now, 6);
  const madinahCityTourDate = addUtcDays(now, 7);
  const departureDate = addUtcDays(now, 8);

  const arrivalIso = toIsoDateOnly(arrivalDate);
  const makkahCityTourIso = toIsoDateOnly(makkahCityTourDate);
  const transferIso = toIsoDateOnly(intercityTransferDate);
  const madinahCityTourIso = toIsoDateOnly(madinahCityTourDate);
  const departureIso = toIsoDateOnly(departureDate);

  const arrivalItemId = randomUUID();
  const makkahCityTourItemId = randomUUID();
  const transferItemId = randomUUID();
  const madinahCityTourItemId = randomUUID();
  const departureItemId = randomUUID();

  return [
    {
      id: randomUUID(),
      code: "9017000001",
      name: "Dummy Trip Lengkap",
      status: "Active",
      arrivalDate: arrivalIso,
      returnDate: departureIso,
      tone: GroupTone.ACTIVE,
      pax: 45,
      totalBuses: 1,
      packageName: "Umrah Plus",
      durationDays: 9,
      musyrif: {
        name: "Ust. Ahmad Hidayat",
        phone: "+62 812-3456-7890",
        avatar: "https://i.pravatar.cc/160?img=12",
      },
      nextActivity: {
        title: "Arrival and transfer to Makkah hotel",
        dateLabel: toShortDateLabel(arrivalDate),
        timeLabel: "09:30",
        icon: "flight_land",
      },
      timeline: [
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
        },
      ],
      itinerary: [
        {
          id: arrivalItemId,
          sortOrder: 0,
          dateLabel: toShortDateLabel(arrivalDate),
          yearLabel: `${arrivalDate.getUTCFullYear()}`,
          category: "Arrival",
          categoryKey: "arrival",
          title: "Arrival and transfer to Makkah hotel",
          meta: "09:30 AM | SV-827 | JED Airport",
          icon: "flight_land",
          highlighted: true,
          isoDate: arrivalIso,
          time: "09:30",
          flightNumber: "SV-827",
          hotelName: "Makkah Hotel",
          fromLocation: "JED Airport",
          toLocation: "Makkah Hotel",
          requiresBus: true,
          notes: "Group expected to clear immigration before transfer.",
          transferByTrain: false,
        },
        {
          id: makkahCityTourItemId,
          sortOrder: 1,
          dateLabel: toShortDateLabel(makkahCityTourDate),
          yearLabel: `${makkahCityTourDate.getUTCFullYear()}`,
          category: "City Tour",
          categoryKey: "city-tour",
          title: "Makkah City Tour",
          meta: "08:00 AM | Makkah Clock Tower -> Jabal Rahmah",
          icon: "tour",
          highlighted: false,
          isoDate: makkahCityTourIso,
          time: "08:00",
          hotelName: "Makkah Hotel",
          fromLocation: "Makkah Clock Tower",
          toLocation: "Jabal Rahmah",
          cityTourCity: "Makkah",
          requiresBus: true,
          notes: "Prepare hydration and elder-friendly transport access.",
          transferByTrain: false,
        },
        {
          id: transferItemId,
          sortOrder: 2,
          dateLabel: toShortDateLabel(intercityTransferDate),
          yearLabel: `${intercityTransferDate.getUTCFullYear()}`,
          category: "Transfer",
          categoryKey: "transfer",
          title: "Transfer from Makkah to Madinah",
          meta: "07:30 AM | Makkah Hotel -> Madinah Hotel",
          icon: "swap_horiz",
          highlighted: false,
          isoDate: transferIso,
          time: "07:30",
          hotelName: "Madinah Hotel",
          fromLocation: "Makkah Hotel",
          toLocation: "Madinah Hotel",
          requiresBus: true,
          notes: "Coordinate luggage tagging before checkout.",
          transferByTrain: false,
        },
        {
          id: madinahCityTourItemId,
          sortOrder: 3,
          dateLabel: toShortDateLabel(madinahCityTourDate),
          yearLabel: `${madinahCityTourDate.getUTCFullYear()}`,
          category: "City Tour",
          categoryKey: "city-tour",
          title: "Madinah City Tour",
          meta: "08:30 AM | Nabawi Area -> Quba Mosque",
          icon: "tour",
          highlighted: false,
          isoDate: madinahCityTourIso,
          time: "08:30",
          hotelName: "Madinah Hotel",
          fromLocation: "Nabawi Area",
          toLocation: "Quba Mosque",
          cityTourCity: "Madinah",
          requiresBus: true,
          notes: "Include elder drop point near Quba gate.",
          transferByTrain: false,
        },
        {
          id: departureItemId,
          sortOrder: 4,
          dateLabel: toShortDateLabel(departureDate),
          yearLabel: `${departureDate.getUTCFullYear()}`,
          category: "Departure",
          categoryKey: "departure",
          title: "Departure to airport",
          meta: "11:30 AM | Madinah Hotel -> MED Airport",
          icon: "flight_takeoff",
          highlighted: false,
          isoDate: departureIso,
          time: "11:30",
          flightNumber: "GA-981",
          hotelName: "Madinah Hotel",
          fromLocation: "Madinah Hotel",
          toLocation: "MED Airport",
          requiresBus: true,
          hotelPickupRequestTime: "09:00",
          notes: "Final headcount and passport check before boarding.",
          transferByTrain: false,
        },
      ],
      notes: [
        {
          sortOrder: 0,
          text: "Bus status: Visa+.",
          pinned: true,
        },
        {
          sortOrder: 1,
          text: "Dummy data siap untuk uji flow itinerary lengkap.",
          pinned: false,
        },
      ],
      visaSetup: {
        visaStatus: VisaStatus.PENDING,
        syarikah: "Daleel Maalem",
        paymentStatus: VisaPaymentStatus.PARTIAL,
        hotelAgreements: [
          {
            id: randomUUID(),
            city: AgreementCity.MAKKAH,
            hotelName: "Swissotel Al Maqam",
            agreementNumber: "20269017000001",
            pax: 45,
            status: AgreementApprovalStatus.APPROVED,
            stayStart: arrivalIso,
            stayEnd: transferIso,
          },
          {
            id: randomUUID(),
            city: AgreementCity.MADINAH,
            hotelName: "Pullman Zamzam Madinah",
            agreementNumber: "20269017000002",
            pax: 45,
            status: AgreementApprovalStatus.WAITING,
            stayStart: transferIso,
            stayEnd: departureIso,
          },
        ],
        raudhahAppointments: [
          {
            id: randomUUID(),
            date: madinahCityTourIso,
            status: GroupRaudhahStatus.AFTER,
            tasrehPrinted: false,
          },
        ],
      },
      checklistAssignments: [
        {
          id: randomUUID(),
          itineraryItemId: arrivalItemId,
          tripDate: arrivalIso,
          activity: "Arrival",
          tripLabel: "Arrival and transfer to Makkah hotel",
          requiredBusCount: 1,
          scheduledTime: "09:30",
          transferByTrain: false,
          trainDepartureTime: undefined,
          stationPickupTime: undefined,
          status: ChecklistAssignmentStatus.ASSIGNED,
          drivers: [
            {
              slotNumber: 1,
              name: "Yusuf Mansur",
              phone: "+966 50 111 2222",
              plateNumber: "B 1234 ABC",
              isVerified: true,
            },
          ],
        },
        {
          id: randomUUID(),
          itineraryItemId: makkahCityTourItemId,
          tripDate: makkahCityTourIso,
          activity: "City Tour",
          tripLabel: "Makkah City Tour",
          requiredBusCount: 1,
          scheduledTime: "08:00",
          transferByTrain: false,
          trainDepartureTime: undefined,
          stationPickupTime: undefined,
          status: ChecklistAssignmentStatus.NOT_COMPLETE,
          drivers: [],
        },
        {
          id: randomUUID(),
          itineraryItemId: transferItemId,
          tripDate: transferIso,
          activity: "Transfer",
          tripLabel: "Transfer from Makkah to Madinah",
          requiredBusCount: 1,
          scheduledTime: "07:30",
          transferByTrain: false,
          trainDepartureTime: undefined,
          stationPickupTime: undefined,
          status: ChecklistAssignmentStatus.NOT_COMPLETE,
          drivers: [],
        },
        {
          id: randomUUID(),
          itineraryItemId: madinahCityTourItemId,
          tripDate: madinahCityTourIso,
          activity: "City Tour",
          tripLabel: "Madinah City Tour",
          requiredBusCount: 1,
          scheduledTime: "08:30",
          transferByTrain: false,
          trainDepartureTime: undefined,
          stationPickupTime: undefined,
          status: ChecklistAssignmentStatus.NOT_COMPLETE,
          drivers: [],
        },
        {
          id: randomUUID(),
          itineraryItemId: departureItemId,
          tripDate: departureIso,
          activity: "Departure",
          tripLabel: "Departure to airport",
          requiredBusCount: 1,
          scheduledTime: "11:30",
          transferByTrain: false,
          trainDepartureTime: undefined,
          stationPickupTime: undefined,
          status: ChecklistAssignmentStatus.NOT_COMPLETE,
          drivers: [],
        },
      ],
      createdAt,
      updatedAt,
    },
  ];
}

export function findOneFromMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
): MemoryGroupRecord {
  const normalizedCode = idOrCode.trim().toUpperCase();
  const group = memoryGroups.find(
    (item) => item.id === idOrCode || item.code === normalizedCode,
  );

  if (!group) {
    throw new NotFoundException(`Group '${idOrCode}' not found.`);
  }

  if (group.parentGroupId) {
    const parent = memoryGroups.find((item) => item.id === group.parentGroupId);
    if (parent) {
      return {
        ...group,
        musyrif: parent.musyrif,
        nextActivity: parent.nextActivity,
        timeline: parent.timeline,
        itinerary: parent.itinerary,
        notes: parent.notes,
        checklistAssignments: parent.checklistAssignments,
      };
    }
  }

  return group;
}

export function createInMemory(
  memoryGroups: MemoryGroupRecord[],
  payload: CreateGroupDto,
): MemoryGroupRecord {
  const normalizedCode = payload.code.trim().toUpperCase();
  const existing = memoryGroups.find((item) => item.code === normalizedCode);

  if (existing) {
    throw new ConflictException(
      `Group code '${normalizedCode}' already exists.`,
    );
  }

  const now = new Date().toISOString();
  const payloadFields = buildMemoryGroupPayloadFields(payload);
  const record: MemoryGroupRecord = {
    id: randomUUID(),
    code: normalizedCode,
    ...payloadFields,
    createdAt: now,
    updatedAt: now,
  };

  memoryGroups.unshift(record);
  return record;
}

export function replaceInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  payload: CreateGroupDto,
): MemoryGroupRecord {
  const targetIndex = resolveMemoryGroupIndex(memoryGroups, idOrCode);
  if (targetIndex === -1) {
    throw new NotFoundException(`Group '${idOrCode}' not found.`);
  }

  const current = memoryGroups[targetIndex];
  const normalizedCode = payload.code.trim().toUpperCase();
  const hasDuplicate = memoryGroups.some(
    (item, index) => index !== targetIndex && item.code === normalizedCode,
  );
  if (hasDuplicate) {
    throw new ConflictException(
      `Group code '${normalizedCode}' already exists.`,
    );
  }

  const updatedAt = new Date().toISOString();
  const payloadFields = buildMemoryGroupPayloadFields(payload);
  const updated: MemoryGroupRecord = {
    ...current,
    code: normalizedCode,
    ...payloadFields,
    updatedAt,
  };

  memoryGroups[targetIndex] = updated;
  return updated;
}

export function updateInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  payload: UpdateGroupDto,
): MemoryGroupRecord {
  const targetIndex = resolveMemoryGroupIndex(memoryGroups, idOrCode);
  if (targetIndex === -1) {
    throw new NotFoundException(`Group '${idOrCode}' not found.`);
  }

  const current = memoryGroups[targetIndex];
  const nextCode = payload.code?.trim().toUpperCase();
  if (nextCode && nextCode !== current.code) {
    const hasDuplicate = memoryGroups.some(
      (item, index) => index !== targetIndex && item.code === nextCode,
    );
    if (hasDuplicate) {
      throw new ConflictException(`Group code '${nextCode}' already exists.`);
    }
  }

  const nextArrivalDate = payload.arrivalDate
    ? parseIsoDateOnly(payload.arrivalDate)
    : current.arrivalDate;
  const nextReturnDate = payload.returnDate
    ? parseIsoDateOnly(payload.returnDate)
    : current.returnDate;
  validateTravelDateRangeOrThrow(nextArrivalDate, nextReturnDate);

  const updated: MemoryGroupRecord = {
    ...current,
    code: nextCode ?? current.code,
    name: payload.name?.trim() ?? current.name,
    status: payload.status?.trim() ?? current.status,
    arrivalDate: nextArrivalDate,
    returnDate: nextReturnDate,
    tone: payload.tone ?? current.tone,
    pax: payload.pax ?? current.pax,
    totalBuses: payload.totalBuses ?? current.totalBuses,
    packageName: payload.packageName?.trim() ?? current.packageName,
    durationDays: payload.durationDays ?? current.durationDays,
    parentGroupId: payload.parentGroupId !== undefined ? (payload.parentGroupId?.trim() || null) : current.parentGroupId,
    updatedAt: new Date().toISOString(),
  };

  memoryGroups[targetIndex] = updated;
  return updated;
}

export function removeFromMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
): void {
  const targetIndex = resolveMemoryGroupIndex(memoryGroups, idOrCode);
  if (targetIndex === -1) {
    throw new NotFoundException(`Group '${idOrCode}' not found.`);
  }

  const target = memoryGroups[targetIndex];
  const hasChildGroups = memoryGroups.some(
    (group) =>
      group.parentGroupId &&
      (group.parentGroupId === target.id ||
        group.parentGroupId.toUpperCase() === target.code),
  );
  if (hasChildGroups) {
    throw new ConflictException(
      `Group '${target.code}' still has child groups and cannot be deleted. Unlink child groups first.`,
    );
  }

  memoryGroups.splice(targetIndex, 1);
}

export function addItineraryItemInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  payload: UpsertGroupItineraryItemDto,
): MemoryGroupRecord {
  const targetIndex = resolveMemoryGroupIndex(memoryGroups, idOrCode);
  if (targetIndex === -1) {
    throw new NotFoundException(`Group '${idOrCode}' not found.`);
  }

  const group = memoryGroups[targetIndex];
  const sortOrder = payload.sortOrder ?? resolveNextSortOrder(group.itinerary);
  const conflict = group.itinerary.some((item) => item.sortOrder === sortOrder);
  if (conflict) {
    throw new ConflictException(
      `Sort order '${sortOrder}' already exists for this group itinerary.`,
    );
  }

  group.itinerary.push(buildMemoryItineraryItem(payload, sortOrder));
  group.itinerary.sort((left, right) => left.sortOrder - right.sortOrder);
  group.updatedAt = new Date().toISOString();
  return group;
}

export function replaceItineraryInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  payload: ReplaceGroupItineraryDto,
): MemoryGroupRecord {
  const targetIndex = resolveMemoryGroupIndex(memoryGroups, idOrCode);
  if (targetIndex === -1) {
    throw new NotFoundException(`Group '${idOrCode}' not found.`);
  }

  const group = memoryGroups[targetIndex];
  const requestedSortOrders = payload.itinerary.map(
    (item, index) => item.sortOrder ?? index,
  );
  if (new Set(requestedSortOrders).size !== requestedSortOrders.length) {
    throw new ConflictException(
      "Setiap itinerary item harus memiliki sort order yang unik.",
    );
  }
  const existingBySortOrder = new Map(
    group.itinerary.map((item) => [item.sortOrder, item]),
  );
  group.itinerary = payload.itinerary.map((item, index) => {
    const sortOrder = item.sortOrder ?? index;
    return buildMemoryItineraryItem(
      item,
      sortOrder,
      existingBySortOrder.get(sortOrder)?.id,
    );
  });
  group.itinerary.sort((left, right) => left.sortOrder - right.sortOrder);

  const validItineraryIds = new Set(group.itinerary.map((item) => item.id));
  group.checklistAssignments = group.checklistAssignments.map((assignment) =>
    assignment.itineraryItemId && !validItineraryIds.has(assignment.itineraryItemId)
      ? { ...assignment, itineraryItemId: undefined }
      : assignment,
  );
  group.updatedAt = new Date().toISOString();
  return group;
}

export function updateItineraryItemInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  itemId: string,
  payload: UpsertGroupItineraryItemDto,
): MemoryGroupRecord {
  const group = findOneFromMemory(memoryGroups, idOrCode);
  const itemIndex = group.itinerary.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) {
    throw new NotFoundException(
      `Itinerary item '${itemId}' not found in group '${idOrCode}'.`,
    );
  }

  const current = group.itinerary[itemIndex];
  const sortOrder = payload.sortOrder ?? current.sortOrder;
  const conflict = group.itinerary.some(
    (item, index) => index !== itemIndex && item.sortOrder === sortOrder,
  );
  if (conflict) {
    throw new ConflictException(
      `Sort order '${sortOrder}' already exists for this group itinerary.`,
    );
  }

  group.itinerary[itemIndex] = buildMemoryItineraryItem(
    payload,
    sortOrder,
    current.id,
  );
  group.itinerary.sort((left, right) => left.sortOrder - right.sortOrder);
  group.updatedAt = new Date().toISOString();
  return group;
}

export function removeItineraryItemInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  itemId: string,
): MemoryGroupRecord {
  const group = findOneFromMemory(memoryGroups, idOrCode);
  const itemIndex = group.itinerary.findIndex((item) => item.id === itemId);
  if (itemIndex === -1) {
    throw new NotFoundException(
      `Itinerary item '${itemId}' not found in group '${idOrCode}'.`,
    );
  }

  group.itinerary.splice(itemIndex, 1);
  group.checklistAssignments = group.checklistAssignments.map((assignment) =>
    assignment.itineraryItemId === itemId
      ? {
          ...assignment,
          itineraryItemId: undefined,
        }
      : assignment,
  );
  group.updatedAt = new Date().toISOString();
  return group;
}

export function addVisaHotelAgreementInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  payload: UpsertGroupVisaHotelDto,
): MemoryGroupRecord {
  const group = findOneFromMemory(memoryGroups, idOrCode);
  const visaSetup = ensureMemoryVisaSetup(group);
  const nextHotelAgreements = [
    ...visaSetup.hotelAgreements,
    buildMemoryVisaHotelAgreement(payload),
  ];
  validateHotelAgreementRules(nextHotelAgreements, {
    requireMakkah: false,
  });

  visaSetup.hotelAgreements = nextHotelAgreements.sort((left, right) => {
    const cityDiff = left.city.localeCompare(right.city);
    if (cityDiff !== 0) {
      return cityDiff;
    }
    return left.stayStart.localeCompare(right.stayStart);
  });

  visaSetup.visaStatus = resolveAgreementDrivenVisaStatus(
    visaSetup.visaStatus,
    visaSetup.hotelAgreements.length > 0,
  );

  group.updatedAt = new Date().toISOString();
  return group;
}

export function updateVisaHotelAgreementInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  hotelId: string,
  payload: UpsertGroupVisaHotelDto,
): MemoryGroupRecord {
  const group = findOneFromMemory(memoryGroups, idOrCode);
  const visaSetup = ensureMemoryVisaSetup(group);
  const hotelIndex = visaSetup.hotelAgreements.findIndex(
    (item) => item.id === hotelId,
  );
  if (hotelIndex === -1) {
    throw new NotFoundException(
      `Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`,
    );
  }

  const nextHotelAgreements = visaSetup.hotelAgreements.map(
    (agreement, index) =>
      index === hotelIndex
        ? buildMemoryVisaHotelAgreement(
            payload,
            visaSetup.hotelAgreements[hotelIndex].id,
          )
        : agreement,
  );
  validateHotelAgreementRules(nextHotelAgreements, {
    requireMakkah: false,
  });

  visaSetup.hotelAgreements = nextHotelAgreements.sort((left, right) => {
    const cityDiff = left.city.localeCompare(right.city);
    if (cityDiff !== 0) {
      return cityDiff;
    }
    return left.stayStart.localeCompare(right.stayStart);
  });

  group.updatedAt = new Date().toISOString();
  return group;
}

export function removeVisaHotelAgreementInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  hotelId: string,
): MemoryGroupRecord {
  const group = findOneFromMemory(memoryGroups, idOrCode);
  const visaSetup = ensureMemoryVisaSetup(group);
  const hotelIndex = visaSetup.hotelAgreements.findIndex(
    (item) => item.id === hotelId,
  );
  if (hotelIndex === -1) {
    throw new NotFoundException(
      `Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`,
    );
  }

  const nextHotelAgreements = visaSetup.hotelAgreements.filter(
    (agreement) => agreement.id !== hotelId,
  );
  validateHotelAgreementRules(nextHotelAgreements, {
    requireMakkah: false,
  });
  visaSetup.hotelAgreements = nextHotelAgreements;
  visaSetup.visaStatus = resolveAgreementDrivenVisaStatus(
    visaSetup.visaStatus,
    visaSetup.hotelAgreements.length > 0,
  );
  group.updatedAt = new Date().toISOString();
  return group;
}

export function upsertPrimaryRaudhahAppointmentInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  payload: UpsertGroupRaudhahDto,
): MemoryGroupRecord {
  const group = findOneFromMemory(memoryGroups, idOrCode);
  const visaSetup = ensureMemoryVisaSetup(group);
  const sorted = [...visaSetup.raudhahAppointments].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const primary = sorted[0];

  if (!primary) {
    visaSetup.raudhahAppointments.push(buildMemoryRaudhahAppointment(payload));
  } else {
    const primaryIndex = visaSetup.raudhahAppointments.findIndex(
      (item) => item.id === primary.id,
    );
    visaSetup.raudhahAppointments[primaryIndex] = buildMemoryRaudhahAppointment(
      payload,
      primary.id,
    );
  }

  visaSetup.raudhahAppointments.sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  group.updatedAt = new Date().toISOString();
  return group;
}

export function confirmChecklistDriverInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  payload: ConfirmChecklistDriverDto,
): ChecklistAssignmentSyncResult {
  const group = findOneFromMemory(memoryGroups, idOrCode);
  const normalizedTripDate = payload.tripDate.trim().slice(0, 10);
  const normalizedActivity = payload.activity.trim();
  const normalizedTripLabel = payload.tripLabel.trim();
  const normalizedScheduledTime = payload.scheduledTime.trim();
  const requiredBusCount = Math.max(1, payload.requiredBusCount);
  const transferByTrain = payload.transferByTrain ?? false;
  const trainDepartureTime = payload.trainDepartureTime?.trim() || undefined;
  const stationPickupTime = payload.stationPickupTime?.trim() || undefined;
  const normalizedDriver = {
    name: payload.driver.name.trim(),
    phone: payload.driver.phone.trim(),
    plateNumber: payload.driver.plateNumber.trim(),
  };

  const assignmentIndex = group.checklistAssignments.findIndex(
    (assignment) =>
      assignment.tripDate === normalizedTripDate &&
      assignment.scheduledTime === normalizedScheduledTime &&
      assignment.activity === normalizedActivity &&
      assignment.tripLabel === normalizedTripLabel,
  );

  const assignment =
    assignmentIndex === -1
      ? (() => {
          const createdAssignment: MemoryChecklistAssignment = {
            id: randomUUID(),
            itineraryItemId: undefined,
            tripDate: normalizedTripDate,
            activity: normalizedActivity,
            tripLabel: normalizedTripLabel,
            requiredBusCount,
            scheduledTime: normalizedScheduledTime,
            transferByTrain,
            trainDepartureTime,
            stationPickupTime,
            status: ChecklistAssignmentStatus.NOT_COMPLETE,
            drivers: [],
          };
          group.checklistAssignments.push(createdAssignment);
          return createdAssignment;
        })()
      : group.checklistAssignments[assignmentIndex];

  assignment.activity = normalizedActivity;
  assignment.tripLabel = normalizedTripLabel;
  assignment.requiredBusCount = requiredBusCount;
  assignment.scheduledTime = normalizedScheduledTime;
  assignment.transferByTrain = transferByTrain;
  assignment.trainDepartureTime = trainDepartureTime;
  assignment.stationPickupTime = stationPickupTime;

  const nextDrivers = [...(assignment.drivers ?? [])].sort(
    (left, right) => left.slotNumber - right.slotNumber,
  );
  if (nextDrivers.length < requiredBusCount) {
    nextDrivers.push({
      slotNumber: nextDrivers.length + 1,
      name: normalizedDriver.name,
      phone: normalizedDriver.phone,
      plateNumber: normalizedDriver.plateNumber,
      isVerified: true,
    });
  }

  assignment.drivers = nextDrivers;
  assignment.status =
    assignment.drivers.length >= requiredBusCount
      ? ChecklistAssignmentStatus.ASSIGNED
      : ChecklistAssignmentStatus.NOT_COMPLETE;

  group.updatedAt = new Date().toISOString();
  return toChecklistAssignmentSyncResult(group.code, assignment);
}

export function resetChecklistDriverInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  payload: ResetChecklistDriverDto,
): ChecklistAssignmentSyncResult {
  const group = findOneFromMemory(memoryGroups, idOrCode);
  const normalizedTripDate = payload.tripDate.trim().slice(0, 10);
  const normalizedScheduledTime = payload.scheduledTime.trim();
  const normalizedActivity = payload.activity?.trim().toLowerCase();

  const assignment = group.checklistAssignments.find(
    (item) =>
      item.tripDate === normalizedTripDate &&
      item.scheduledTime === normalizedScheduledTime &&
      (!normalizedActivity ||
        item.activity.trim().toLowerCase() === normalizedActivity),
  );

  if (!assignment) {
    throw new NotFoundException(
      `Checklist assignment for '${idOrCode}' on '${normalizedTripDate}' at '${normalizedScheduledTime}' not found.`,
    );
  }

  assignment.drivers = [];
  assignment.status = ChecklistAssignmentStatus.NOT_COMPLETE;
  group.updatedAt = new Date().toISOString();

  return toChecklistAssignmentSyncResult(group.code, assignment);
}

// ==========================================
// LISTING & PAGINATION (from groups.listing.ts)
// ==========================================

export function projectMemoryGroupRecord(
  group: MemoryGroupRecord,
  projection: GroupResponseProjection,
): MemoryGroupRecord | MemoryGroupSummaryRecord {
  if (projection === "detail") {
    return group;
  }

  return {
    id: group.id,
    code: group.code,
    name: group.name,
    status: group.status,
    arrivalDate: group.arrivalDate,
    returnDate: group.returnDate,
    tone: group.tone,
    pax: group.pax,
    totalBuses: group.totalBuses,
    packageName: group.packageName,
    durationDays: group.durationDays,
    nextActivity: group.nextActivity,
    itinerary: group.itinerary,
    notes: group.notes,
    visaSetup: group.visaSetup,
    parentGroupId: group.parentGroupId,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export function normalizeGroupListFilter(rawFilter?: string): GroupListFilter {
  const normalized = rawFilter?.trim().toLowerCase();
  if (normalized === "not-issued" || normalized === "missing-hotel" || normalized === "unpaid") {
    return normalized;
  }
  return "all";
}

function matchesMemoryFilter(item: MemoryGroupRecord, filter: GroupListFilter, activeOnly: boolean): boolean {
  if (activeOnly && item.tone !== GroupTone.ACTIVE) {
    return false;
  }

  if (filter === "all") {
    return true;
  }

  if (filter === "not-issued") {
    return item.visaSetup?.visaStatus !== VisaStatus.ISSUED;
  }

  if (filter === "missing-hotel") {
    if (!item.visaSetup) {
      return true;
    }
    const makkahPax = item.visaSetup.hotelAgreements
      .filter((h) => h.city === "MAKKAH")
      .reduce((sum, h) => sum + h.pax, 0);
    const madinahPax = item.visaSetup.hotelAgreements
      .filter((h) => h.city === "MADINAH")
      .reduce((sum, h) => sum + h.pax, 0);
    return makkahPax < item.pax || madinahPax < item.pax;
  }

  return item.visaSetup?.paymentStatus !== VisaPaymentStatus.PAID;
}

export function findAllFromMemory(
  memoryGroups: MemoryGroupRecord[],
  query?: string,
  rawFilter?: string,
  activeOnly = false,
): MemoryGroupRecord[] {
  const searchTokens = normalizeGroupSearchTokens(query);
  const filter = normalizeGroupListFilter(rawFilter);
  const source =
    searchTokens.length === 0
      ? memoryGroups
      : memoryGroups.filter((item) => {
          const searchDocument = buildGroupSearchDocument({
            code: item.code,
            name: item.name,
            status: item.status,
            packageName: item.packageName,
          });
          return searchTokens.every((token) => searchDocument.includes(token));
        });

  const filtered = source.filter((item) => matchesMemoryFilter(item, filter, activeOnly));
  return [...filtered].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

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

export function paginateGroupItems<T>(
  items: T[],
  options?: FindAllOptions,
): T[] | PaginatedGroupList<T> {
  const pageState = resolvePaginationState(options);
  if (!pageState) {
    return items;
  }

  const start = (pageState.page - 1) * pageState.pageSize;
  const pagedItems = items.slice(start, start + pageState.pageSize);
  return {
    items: pagedItems,
    total: items.length,
    page: pageState.page,
    pageSize: pageState.pageSize,
  };
}
