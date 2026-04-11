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
import type { ConfirmChecklistDriverDto } from "../dto/confirm-checklist-driver.dto";
import type { CreateGroupDto } from "../dto/create-group.dto";
import type {
  UpsertGroupItineraryItemDto,
  UpsertGroupRaudhahDto,
  UpsertGroupVisaHotelDto,
} from "../dto/group-operations.dto";
import type { ResetChecklistDriverDto } from "../dto/reset-checklist-driver.dto";
import type { UpdateGroupDto } from "../dto/update-group.dto";
import { validateHotelAgreementRules } from "../domain/groups.hotel-validation";
import {
  buildMemoryItineraryItem,
  buildMemoryRaudhahAppointment,
  buildMemoryVisaHotelAgreement,
  ensureMemoryVisaSetup,
} from "./groups.memory-builders";
import { buildMemoryGroupPayloadFields } from "./groups.memory-group-payload";
import {
  parseIsoDateOnly,
  toChecklistAssignmentSyncResult,
  toIsoDateOnly,
  toShortDateLabel,
  validateTravelDateRangeOrThrow,
} from "../domain/groups.shared";
import type {
  ChecklistAssignmentSyncResult,
  MemoryChecklistAssignment,
  MemoryGroupRecord,
} from "../groups.service-types";

function addUtcDays(baseDate: Date, dayOffset: number): Date {
  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
  return nextDate;
}

function resolveMemoryGroupIndex(memoryGroups: MemoryGroupRecord[], idOrCode: string): number {
  const normalizedCode = idOrCode.trim().toUpperCase();
  return memoryGroups.findIndex((item) => item.id === idOrCode || item.code === normalizedCode);
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
        outstandingAmount: 1500,
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

export function findOneFromMemory(memoryGroups: MemoryGroupRecord[], idOrCode: string): MemoryGroupRecord {
  const normalizedCode = idOrCode.trim().toUpperCase();
  const group = memoryGroups.find((item) => item.id === idOrCode || item.code === normalizedCode);

  if (!group) {
    throw new NotFoundException(`Group '${idOrCode}' not found.`);
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
    throw new ConflictException(`Group code '${normalizedCode}' already exists.`);
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
  const hasDuplicate = memoryGroups.some((item, index) => index !== targetIndex && item.code === normalizedCode);
  if (hasDuplicate) {
    throw new ConflictException(`Group code '${normalizedCode}' already exists.`);
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
    const hasDuplicate = memoryGroups.some((item, index) => index !== targetIndex && item.code === nextCode);
    if (hasDuplicate) {
      throw new ConflictException(`Group code '${nextCode}' already exists.`);
    }
  }

  const nextArrivalDate = payload.arrivalDate ? parseIsoDateOnly(payload.arrivalDate) : current.arrivalDate;
  const nextReturnDate = payload.returnDate ? parseIsoDateOnly(payload.returnDate) : current.returnDate;
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
    updatedAt: new Date().toISOString(),
  };

  memoryGroups[targetIndex] = updated;
  return updated;
}

export function removeFromMemory(memoryGroups: MemoryGroupRecord[], idOrCode: string): void {
  const targetIndex = resolveMemoryGroupIndex(memoryGroups, idOrCode);
  if (targetIndex === -1) {
    throw new NotFoundException(`Group '${idOrCode}' not found.`);
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
    throw new ConflictException(`Sort order '${sortOrder}' already exists for this group itinerary.`);
  }

  group.itinerary.push(buildMemoryItineraryItem(payload, sortOrder));
  group.itinerary.sort((left, right) => left.sortOrder - right.sortOrder);
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
    throw new NotFoundException(`Itinerary item '${itemId}' not found in group '${idOrCode}'.`);
  }

  const current = group.itinerary[itemIndex];
  const sortOrder = payload.sortOrder ?? current.sortOrder;
  const conflict = group.itinerary.some((item, index) => index !== itemIndex && item.sortOrder === sortOrder);
  if (conflict) {
    throw new ConflictException(`Sort order '${sortOrder}' already exists for this group itinerary.`);
  }

  group.itinerary[itemIndex] = buildMemoryItineraryItem(payload, sortOrder, current.id);
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
    throw new NotFoundException(`Itinerary item '${itemId}' not found in group '${idOrCode}'.`);
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
  const nextHotelAgreements = [...visaSetup.hotelAgreements, buildMemoryVisaHotelAgreement(payload)];
  validateHotelAgreementRules(nextHotelAgreements);

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

export function updateVisaHotelAgreementInMemory(
  memoryGroups: MemoryGroupRecord[],
  idOrCode: string,
  hotelId: string,
  payload: UpsertGroupVisaHotelDto,
): MemoryGroupRecord {
  const group = findOneFromMemory(memoryGroups, idOrCode);
  const visaSetup = ensureMemoryVisaSetup(group);
  const hotelIndex = visaSetup.hotelAgreements.findIndex((item) => item.id === hotelId);
  if (hotelIndex === -1) {
    throw new NotFoundException(`Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`);
  }

  const nextHotelAgreements = visaSetup.hotelAgreements.map((agreement, index) =>
    index === hotelIndex ? buildMemoryVisaHotelAgreement(payload, visaSetup.hotelAgreements[hotelIndex].id) : agreement,
  );
  validateHotelAgreementRules(nextHotelAgreements);

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
  const hotelIndex = visaSetup.hotelAgreements.findIndex((item) => item.id === hotelId);
  if (hotelIndex === -1) {
    throw new NotFoundException(`Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`);
  }

  const nextHotelAgreements = visaSetup.hotelAgreements.filter((agreement) => agreement.id !== hotelId);
  validateHotelAgreementRules(nextHotelAgreements);
  visaSetup.hotelAgreements = nextHotelAgreements;
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
  const sorted = [...visaSetup.raudhahAppointments].sort((left, right) => left.date.localeCompare(right.date));
  const primary = sorted[0];

  if (!primary) {
    visaSetup.raudhahAppointments.push(buildMemoryRaudhahAppointment(payload));
  } else {
    const primaryIndex = visaSetup.raudhahAppointments.findIndex((item) => item.id === primary.id);
    visaSetup.raudhahAppointments[primaryIndex] = buildMemoryRaudhahAppointment(payload, primary.id);
  }

  visaSetup.raudhahAppointments.sort((left, right) => left.date.localeCompare(right.date));
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

  const nextDrivers = [...(assignment.drivers ?? [])].sort((left, right) => left.slotNumber - right.slotNumber);
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
      (!normalizedActivity || item.activity.trim().toLowerCase() === normalizedActivity),
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
