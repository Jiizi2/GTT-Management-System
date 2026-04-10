import { randomUUID } from "node:crypto";
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
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
import { CreateGroupDto } from "./dto/create-group.dto";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateGroupDto } from "./dto/update-group.dto";
import {
  UpsertGroupItineraryItemDto,
  UpsertGroupRaudhahDto,
  UpsertGroupVisaHotelDto,
} from "./dto/group-operations.dto";
import { ConfirmChecklistDriverDto } from "./dto/confirm-checklist-driver.dto";
import { ResetChecklistDriverDto } from "./dto/reset-checklist-driver.dto";
import { groupInclude } from "./groups.prisma-include";
import { resolveItineraryTitle } from "./groups-itinerary-title";
import {
  type ChecklistAssignmentSyncResult,
  type FindAllOptions,
  type GroupListFilter,
  type MemoryAuditLog,
  type MemoryChecklistAssignment,
  type MemoryGroupRecord,
  type MemoryItineraryItem,
  type MemoryRaudhahAppointment,
  type MemoryVisaHotelAgreement,
  type MemoryVisaSetup,
  type PaginatedGroupList,
} from "./groups.service-types";
import {
  validateCreateOrReplaceHotelAgreementRules,
  validateHotelAgreementRules,
} from "./groups.hotel-validation";
import {
  buildMemoryItineraryItem,
  buildMemoryRaudhahAppointment,
  buildMemoryVisaHotelAgreement,
  ensureMemoryVisaSetup,
} from "./groups.memory-builders";
import { buildGroupCreateData, buildGroupReplaceData } from "./groups.prisma-write-builders";
import { buildMemoryGroupPayloadFields } from "./groups.memory-group-payload";

function addUtcDays(baseDate: Date, dayOffset: number): Date {
  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + dayOffset);
  return nextDate;
}

function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toShortDateLabel(value: Date): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${value.getUTCDate()} ${monthNames[value.getUTCMonth()]}`;
}

function parseIsoDateOnly(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new BadRequestException(`Invalid ISO date value '${value}'.`);
  }

  return parsedDate.toISOString().slice(0, 10);
}

function toUtcMidnightDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function validateTravelDateRangeOrThrow(arrivalDateIso: string, returnDateIso: string): void {
  if (returnDateIso < arrivalDateIso) {
    throw new BadRequestException("Return date must be on or after arrival date.");
  }
}

function normalizeChecklistIdentityPart(value: string): string {
  return value.trim().toUpperCase();
}

function buildChecklistAssignmentIdentity({
  tripDateIso,
  scheduledTime,
  activity,
  tripLabel,
}: {
  tripDateIso: string;
  scheduledTime: string;
  activity: string;
  tripLabel: string;
}): string {
  return [
    normalizeChecklistIdentityPart(tripDateIso),
    normalizeChecklistIdentityPart(scheduledTime),
    normalizeChecklistIdentityPart(activity),
    normalizeChecklistIdentityPart(tripLabel),
  ].join("|");
}

function createDefaultMemoryGroups(): MemoryGroupRecord[] {
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

@Injectable()
export class GroupsService {
  private readonly dataSource: "memory" | "prisma";
  private readonly memoryGroups: MemoryGroupRecord[] = createDefaultMemoryGroups();
  private readonly auditLogs: MemoryAuditLog[] = [];

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    const configuredSource = (process.env.DATA_SOURCE ?? "memory").toLowerCase();
    this.dataSource = configuredSource === "prisma" ? "prisma" : "memory";
  }

  async findAll(
    query?: string,
    options?: FindAllOptions,
  ): Promise<unknown[] | PaginatedGroupList<unknown>> {
    if (this.dataSource === "prisma") {
      return this.findAllWithPrisma(query, options);
    }

    const source = this.findAllFromMemory(query, options?.filter);
    return this.paginateInMemory(source, options);
  }

  async findOneByIdOrCode(idOrCode: string): Promise<unknown> {
    if (this.dataSource === "prisma") {
      return this.findOneWithPrisma(idOrCode);
    }

    return this.findOneFromMemory(idOrCode);
  }

  async create(payload: CreateGroupDto): Promise<unknown> {
    this.validateCreateOrReplaceTravelDates(payload);
    validateCreateOrReplaceHotelAgreementRules(payload);

    let created: unknown;
    if (this.dataSource === "prisma") {
      created = await this.createWithPrisma(payload);
    } else {
      created = this.createInMemory(payload);
    }

    this.pushAuditLog("group.created", "group", this.extractGroupCode(created), {
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
    });
    return created;
  }

  async replace(idOrCode: string, payload: CreateGroupDto): Promise<unknown> {
    this.validateCreateOrReplaceTravelDates(payload);
    validateCreateOrReplaceHotelAgreementRules(payload);

    let replaced: unknown;
    if (this.dataSource === "prisma") {
      replaced = await this.replaceWithPrisma(idOrCode, payload);
    } else {
      replaced = this.replaceInMemory(idOrCode, payload);
    }

    this.pushAuditLog("group.replaced", "group", this.extractGroupCode(replaced), {
      idOrCode,
      code: payload.code.trim().toUpperCase(),
    });
    return replaced;
  }

  async update(idOrCode: string, payload: UpdateGroupDto): Promise<unknown> {
    let updated: unknown;
    if (this.dataSource === "prisma") {
      updated = await this.updateWithPrisma(idOrCode, payload);
    } else {
      updated = this.updateInMemory(idOrCode, payload);
    }

    this.pushAuditLog("group.updated", "group", this.extractGroupCode(updated), {
      idOrCode,
      updatedFields: Object.keys(payload),
    });
    return updated;
  }

  async remove(idOrCode: string): Promise<void> {
    const existing = await this.findOneByIdOrCode(idOrCode);
    if (this.dataSource === "prisma") {
      await this.removeWithPrisma(idOrCode);
    } else {
      this.removeFromMemory(idOrCode);
    }

    this.pushAuditLog("group.deleted", "group", this.extractGroupCode(existing), {
      idOrCode,
    });
  }

  listAuditLogs(groupCode?: string, limit?: number): MemoryAuditLog[] {
    const normalizedCode = groupCode?.trim().toUpperCase();
    const sanitizedLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : undefined;

    let logs = [...this.auditLogs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    if (normalizedCode) {
      logs = logs.filter((entry) => entry.groupCode === normalizedCode);
    }

    if (sanitizedLimit) {
      logs = logs.slice(0, sanitizedLimit);
    }

    return logs;
  }

  private validateCreateOrReplaceTravelDates(payload: CreateGroupDto): void {
    const normalizedArrivalDate = parseIsoDateOnly(payload.arrivalDate);
    const normalizedReturnDate = parseIsoDateOnly(payload.returnDate);
    validateTravelDateRangeOrThrow(normalizedArrivalDate, normalizedReturnDate);
  }

  async addItineraryItem(idOrCode: string, payload: UpsertGroupItineraryItemDto): Promise<unknown> {
    const updated =
      this.dataSource === "prisma"
        ? await this.addItineraryItemWithPrisma(idOrCode, payload)
        : this.addItineraryItemInMemory(idOrCode, payload);

    this.pushAuditLog("itinerary.added", "itinerary", this.extractGroupCode(updated), {
      idOrCode,
      title: resolveItineraryTitle(payload),
      category: payload.category.trim(),
    });
    return updated;
  }

  async updateItineraryItem(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<unknown> {
    const updated =
      this.dataSource === "prisma"
        ? await this.updateItineraryItemWithPrisma(idOrCode, itemId, payload)
        : this.updateItineraryItemInMemory(idOrCode, itemId, payload);

    this.pushAuditLog("itinerary.updated", "itinerary", this.extractGroupCode(updated), {
      idOrCode,
      itemId,
      title: resolveItineraryTitle(payload),
    });
    return updated;
  }

  async removeItineraryItem(idOrCode: string, itemId: string): Promise<unknown> {
    const updated =
      this.dataSource === "prisma"
        ? await this.removeItineraryItemWithPrisma(idOrCode, itemId)
        : this.removeItineraryItemInMemory(idOrCode, itemId);

    this.pushAuditLog("itinerary.deleted", "itinerary", this.extractGroupCode(updated), {
      idOrCode,
      itemId,
    });
    return updated;
  }

  async addVisaHotelAgreement(idOrCode: string, payload: UpsertGroupVisaHotelDto): Promise<unknown> {
    const updated =
      this.dataSource === "prisma"
        ? await this.addVisaHotelAgreementWithPrisma(idOrCode, payload)
        : this.addVisaHotelAgreementInMemory(idOrCode, payload);

    this.pushAuditLog("visa.hotel.added", "visaHotelAgreement", this.extractGroupCode(updated), {
      idOrCode,
      city: payload.city,
      agreementNumber: payload.agreementNumber.trim(),
    });
    return updated;
  }

  async updateVisaHotelAgreement(
    idOrCode: string,
    hotelId: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<unknown> {
    const updated =
      this.dataSource === "prisma"
        ? await this.updateVisaHotelAgreementWithPrisma(idOrCode, hotelId, payload)
        : this.updateVisaHotelAgreementInMemory(idOrCode, hotelId, payload);

    this.pushAuditLog("visa.hotel.updated", "visaHotelAgreement", this.extractGroupCode(updated), {
      idOrCode,
      hotelId,
      city: payload.city,
      agreementNumber: payload.agreementNumber.trim(),
    });
    return updated;
  }

  async removeVisaHotelAgreement(idOrCode: string, hotelId: string): Promise<unknown> {
    const updated =
      this.dataSource === "prisma"
        ? await this.removeVisaHotelAgreementWithPrisma(idOrCode, hotelId)
        : this.removeVisaHotelAgreementInMemory(idOrCode, hotelId);

    this.pushAuditLog("visa.hotel.deleted", "visaHotelAgreement", this.extractGroupCode(updated), {
      idOrCode,
      hotelId,
    });
    return updated;
  }

  async upsertPrimaryRaudhahAppointment(
    idOrCode: string,
    payload: UpsertGroupRaudhahDto,
  ): Promise<unknown> {
    const updated =
      this.dataSource === "prisma"
        ? await this.upsertPrimaryRaudhahAppointmentWithPrisma(idOrCode, payload)
        : this.upsertPrimaryRaudhahAppointmentInMemory(idOrCode, payload);

    this.pushAuditLog("visa.raudhah.upserted", "raudhahAppointment", this.extractGroupCode(updated), {
      idOrCode,
      date: payload.date,
      status: payload.status ?? GroupRaudhahStatus.FREE,
      tasrehPrinted: payload.tasrehPrinted ?? false,
    });
    return updated;
  }

  async confirmChecklistDriver(
    idOrCode: string,
    payload: ConfirmChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    const confirmed =
      this.dataSource === "prisma"
        ? await this.confirmChecklistDriverWithPrisma(idOrCode, payload)
        : this.confirmChecklistDriverInMemory(idOrCode, payload);

    this.pushAuditLog(
      "checklist.driver.confirmed",
      "checklistAssignment",
      confirmed.groupCode,
      {
        idOrCode,
        assignmentId: confirmed.id,
        tripDate: confirmed.tripDate,
        activity: confirmed.activity,
        scheduledTime: confirmed.scheduledTime,
        slotCount: confirmed.drivers.length,
      },
    );

    return confirmed;
  }

  async resetChecklistDriver(
    idOrCode: string,
    payload: ResetChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    const resetResult =
      this.dataSource === "prisma"
        ? await this.resetChecklistDriverWithPrisma(idOrCode, payload)
        : this.resetChecklistDriverInMemory(idOrCode, payload);

    this.pushAuditLog(
      "checklist.driver.reset",
      "checklistAssignment",
      resetResult.groupCode,
      {
        idOrCode,
        assignmentId: resetResult.id,
        tripDate: resetResult.tripDate,
        activity: payload.activity?.trim(),
        scheduledTime: resetResult.scheduledTime,
      },
    );

    return resetResult;
  }

  private findAllFromMemory(query?: string, rawFilter?: string): MemoryGroupRecord[] {
    const normalizedQuery = query?.trim().toLowerCase() ?? "";
    const filter = this.normalizeGroupListFilter(rawFilter);
    const source =
      normalizedQuery.length === 0
        ? this.memoryGroups
        : this.memoryGroups.filter((item) =>
            [item.code, item.name, item.status, item.packageName].some((value) =>
              value.toLowerCase().includes(normalizedQuery),
            ),
          );

    const filtered = source.filter((item) => this.matchesMemoryFilter(item, filter));
    return [...filtered].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  private findOneFromMemory(idOrCode: string): MemoryGroupRecord {
    const normalizedCode = idOrCode.trim().toUpperCase();
    const group = this.memoryGroups.find((item) => item.id === idOrCode || item.code === normalizedCode);

    if (!group) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    return group;
  }

  private resolveMemoryGroupIndex(idOrCode: string): number {
    const normalizedCode = idOrCode.trim().toUpperCase();
    return this.memoryGroups.findIndex(
      (item) => item.id === idOrCode || item.code === normalizedCode,
    );
  }

  private createInMemory(payload: CreateGroupDto): MemoryGroupRecord {
    const normalizedCode = payload.code.trim().toUpperCase();
    const existing = this.memoryGroups.find((item) => item.code === normalizedCode);

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

    this.memoryGroups.unshift(record);
    return record;
  }

  private replaceInMemory(idOrCode: string, payload: CreateGroupDto): MemoryGroupRecord {
    const targetIndex = this.resolveMemoryGroupIndex(idOrCode);
    if (targetIndex === -1) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    const current = this.memoryGroups[targetIndex];
    const normalizedCode = payload.code.trim().toUpperCase();
    const hasDuplicate = this.memoryGroups.some(
      (item, index) => index !== targetIndex && item.code === normalizedCode,
    );
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

    this.memoryGroups[targetIndex] = updated;
    return updated;
  }

  private updateInMemory(idOrCode: string, payload: UpdateGroupDto): MemoryGroupRecord {
    const targetIndex = this.resolveMemoryGroupIndex(idOrCode);
    if (targetIndex === -1) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    const current = this.memoryGroups[targetIndex];
    const nextCode = payload.code?.trim().toUpperCase();
    if (nextCode && nextCode !== current.code) {
      const hasDuplicate = this.memoryGroups.some(
        (item, index) => index !== targetIndex && item.code === nextCode,
      );
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

    this.memoryGroups[targetIndex] = updated;
    return updated;
  }

  private removeFromMemory(idOrCode: string): void {
    const targetIndex = this.resolveMemoryGroupIndex(idOrCode);
    if (targetIndex === -1) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    this.memoryGroups.splice(targetIndex, 1);
  }

  private resolvePaginationState(options?: FindAllOptions): { page: number; pageSize: number } | null {
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

  private paginateInMemory<T>(
    items: T[],
    options?: FindAllOptions,
  ): T[] | PaginatedGroupList<T> {
    const pageState = this.resolvePaginationState(options);
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

  private normalizeGroupListFilter(rawFilter?: string): GroupListFilter {
    const normalized = rawFilter?.trim().toLowerCase();
    if (normalized === "not-issued" || normalized === "missing-hotel" || normalized === "unpaid") {
      return normalized;
    }
    return "all";
  }

  private matchesMemoryFilter(item: MemoryGroupRecord, filter: GroupListFilter): boolean {
    if (filter === "all") {
      return true;
    }

    if (filter === "not-issued") {
      return item.visaSetup?.visaStatus !== VisaStatus.ISSUED;
    }

    if (filter === "missing-hotel") {
      return !item.visaSetup || item.visaSetup.hotelAgreements.length === 0;
    }

    return item.visaSetup?.paymentStatus !== VisaPaymentStatus.PAID;
  }

  private buildGroupWhere(query?: string, rawFilter?: string): Prisma.GroupWhereInput | undefined {
    const normalizedQuery = query?.trim();
    const filter = this.normalizeGroupListFilter(rawFilter);
    const conditions: Prisma.GroupWhereInput[] = [];

    if (normalizedQuery && normalizedQuery.length > 0) {
      conditions.push({
        OR: [
          {
            code: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
          {
            name: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
          {
            status: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
          {
            packageName: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
        ],
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
                  none: {},
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

  private pushAuditLog(
    action: string,
    entity: string,
    groupCode: string | undefined,
    payload: Record<string, unknown>,
  ): void {
    const entry: MemoryAuditLog = {
      id: randomUUID(),
      action,
      entity,
      groupCode: groupCode?.trim().toUpperCase(),
      payload,
      createdAt: new Date().toISOString(),
    };

    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 500) {
      this.auditLogs.length = 500;
    }
  }

  private extractGroupCode(group: unknown): string | undefined {
    if (typeof group !== "object" || group === null || !("code" in group)) {
      return undefined;
    }

    const code = (group as { code?: unknown }).code;
    return typeof code === "string" ? code.trim().toUpperCase() : undefined;
  }

  private resolveNextSortOrder(entries: Array<{ sortOrder: number }>): number {
    if (entries.length === 0) {
      return 0;
    }

    return Math.max(...entries.map((entry) => entry.sortOrder)) + 1;
  }

  private addItineraryItemInMemory(
    idOrCode: string,
    payload: UpsertGroupItineraryItemDto,
  ): MemoryGroupRecord {
    const targetIndex = this.resolveMemoryGroupIndex(idOrCode);
    if (targetIndex === -1) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    const group = this.memoryGroups[targetIndex];
    const sortOrder = payload.sortOrder ?? this.resolveNextSortOrder(group.itinerary);
    const conflict = group.itinerary.some((item) => item.sortOrder === sortOrder);
    if (conflict) {
      throw new ConflictException(`Sort order '${sortOrder}' already exists for this group itinerary.`);
    }

    group.itinerary.push(buildMemoryItineraryItem(payload, sortOrder));
    group.itinerary.sort((left, right) => left.sortOrder - right.sortOrder);
    group.updatedAt = new Date().toISOString();
    return group;
  }

  private updateItineraryItemInMemory(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): MemoryGroupRecord {
    const group = this.findOneFromMemory(idOrCode);
    const itemIndex = group.itinerary.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) {
      throw new NotFoundException(`Itinerary item '${itemId}' not found in group '${idOrCode}'.`);
    }

    const current = group.itinerary[itemIndex];
    const sortOrder = payload.sortOrder ?? current.sortOrder;
    const conflict = group.itinerary.some(
      (item, index) => index !== itemIndex && item.sortOrder === sortOrder,
    );
    if (conflict) {
      throw new ConflictException(`Sort order '${sortOrder}' already exists for this group itinerary.`);
    }

    group.itinerary[itemIndex] = buildMemoryItineraryItem(payload, sortOrder, current.id);
    group.itinerary.sort((left, right) => left.sortOrder - right.sortOrder);
    group.updatedAt = new Date().toISOString();
    return group;
  }

  private removeItineraryItemInMemory(idOrCode: string, itemId: string): MemoryGroupRecord {
    const group = this.findOneFromMemory(idOrCode);
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

  private addVisaHotelAgreementInMemory(
    idOrCode: string,
    payload: UpsertGroupVisaHotelDto,
  ): MemoryGroupRecord {
    const group = this.findOneFromMemory(idOrCode);
    const visaSetup = ensureMemoryVisaSetup(group);
    const nextHotelAgreements = [
      ...visaSetup.hotelAgreements,
      buildMemoryVisaHotelAgreement(payload),
    ];
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

  private updateVisaHotelAgreementInMemory(
    idOrCode: string,
    hotelId: string,
    payload: UpsertGroupVisaHotelDto,
  ): MemoryGroupRecord {
    const group = this.findOneFromMemory(idOrCode);
    const visaSetup = ensureMemoryVisaSetup(group);
    const hotelIndex = visaSetup.hotelAgreements.findIndex((item) => item.id === hotelId);
    if (hotelIndex === -1) {
      throw new NotFoundException(`Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`);
    }

    const nextHotelAgreements = visaSetup.hotelAgreements.map((agreement, index) =>
      index === hotelIndex
        ? buildMemoryVisaHotelAgreement(payload, visaSetup.hotelAgreements[hotelIndex].id)
        : agreement,
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

  private removeVisaHotelAgreementInMemory(idOrCode: string, hotelId: string): MemoryGroupRecord {
    const group = this.findOneFromMemory(idOrCode);
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

  private upsertPrimaryRaudhahAppointmentInMemory(
    idOrCode: string,
    payload: UpsertGroupRaudhahDto,
  ): MemoryGroupRecord {
    const group = this.findOneFromMemory(idOrCode);
    const visaSetup = ensureMemoryVisaSetup(group);
    const sorted = [...visaSetup.raudhahAppointments].sort((left, right) =>
      left.date.localeCompare(right.date),
    );
    const primary = sorted[0];

    if (!primary) {
      visaSetup.raudhahAppointments.push(buildMemoryRaudhahAppointment(payload));
    } else {
      const primaryIndex = visaSetup.raudhahAppointments.findIndex((item) => item.id === primary.id);
      visaSetup.raudhahAppointments[primaryIndex] = buildMemoryRaudhahAppointment(
        payload,
        primary.id,
      );
    }

    visaSetup.raudhahAppointments.sort((left, right) => left.date.localeCompare(right.date));
    group.updatedAt = new Date().toISOString();
    return group;
  }

  private confirmChecklistDriverInMemory(
    idOrCode: string,
    payload: ConfirmChecklistDriverDto,
  ): ChecklistAssignmentSyncResult {
    const group = this.findOneFromMemory(idOrCode);
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
    return this.toChecklistAssignmentSyncResult(group.code, assignment);
  }

  private async confirmChecklistDriverWithPrisma(
    idOrCode: string,
    payload: ConfirmChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const normalizedTripDate = payload.tripDate.trim().slice(0, 10);
    const normalizedActivity = payload.activity.trim();
    const normalizedTripLabel = payload.tripLabel.trim();
    const normalizedScheduledTime = payload.scheduledTime.trim();
    const requiredBusCount = Math.max(1, payload.requiredBusCount);
    const transferByTrain = payload.transferByTrain ?? false;
    const trainDepartureTime = payload.trainDepartureTime?.trim() || null;
    const stationPickupTime = payload.stationPickupTime?.trim() || null;
    const normalizedDriver = {
      name: payload.driver.name.trim(),
      phone: payload.driver.phone.trim(),
      plateNumber: payload.driver.plateNumber.trim(),
    };
    const tripDate = new Date(`${normalizedTripDate}T00:00:00.000Z`);

    const syncedAssignment = await this.prisma.$transaction(async (tx) => {
      let assignment = await tx.checklistAssignment.findFirst({
        where: {
          groupId: group.id,
          tripDate,
          scheduledTime: normalizedScheduledTime,
          activity: normalizedActivity,
          tripLabel: normalizedTripLabel,
        },
        include: {
          drivers: {
            orderBy: {
              slotNumber: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!assignment) {
        assignment = await tx.checklistAssignment.create({
          data: {
            groupId: group.id,
            tripDate,
            activity: normalizedActivity,
            tripLabel: normalizedTripLabel,
            requiredBusCount,
            scheduledTime: normalizedScheduledTime,
            transferByTrain,
            trainDepartureTime,
            stationPickupTime,
            status: ChecklistAssignmentStatus.NOT_COMPLETE,
          },
          include: {
            drivers: {
              orderBy: {
                slotNumber: "asc",
              },
            },
          },
        });
      } else {
        assignment = await tx.checklistAssignment.update({
          where: {
            id: assignment.id,
          },
          data: {
            activity: normalizedActivity,
            tripLabel: normalizedTripLabel,
            requiredBusCount,
            transferByTrain,
            trainDepartureTime,
            stationPickupTime,
          },
          include: {
            drivers: {
              orderBy: {
                slotNumber: "asc",
              },
            },
          },
        });
      }

      if (assignment.drivers.length < requiredBusCount) {
        for (
          let slotNumber = assignment.drivers.length + 1;
          slotNumber <= requiredBusCount;
          slotNumber += 1
        ) {
          try {
            await tx.checklistDriver.create({
              data: {
                checklistAssignmentId: assignment.id,
                slotNumber,
                name: normalizedDriver.name,
                phone: normalizedDriver.phone,
                plateNumber: normalizedDriver.plateNumber,
                isVerified: true,
              },
            });
            break;
          } catch (error: unknown) {
            if (
              !(error instanceof Prisma.PrismaClientKnownRequestError) ||
              error.code !== "P2002"
            ) {
              throw error;
            }
          }
        }
      }

      const refreshed = await tx.checklistAssignment.findUniqueOrThrow({
        where: {
          id: assignment.id,
        },
        include: {
          drivers: {
            orderBy: {
              slotNumber: "asc",
            },
          },
        },
      });

      const nextStatus =
        refreshed.drivers.length >= requiredBusCount
          ? ChecklistAssignmentStatus.ASSIGNED
          : ChecklistAssignmentStatus.NOT_COMPLETE;

      if (refreshed.status === nextStatus) {
        return refreshed;
      }

      return tx.checklistAssignment.update({
        where: {
          id: refreshed.id,
        },
        data: {
          status: nextStatus,
        },
        include: {
          drivers: {
            orderBy: {
              slotNumber: "asc",
            },
          },
        },
      });
    });

    return this.toChecklistAssignmentSyncResult(group.code, {
      id: syncedAssignment.id,
      tripDate: syncedAssignment.tripDate.toISOString().slice(0, 10),
      activity: syncedAssignment.activity,
      tripLabel: syncedAssignment.tripLabel,
      requiredBusCount: syncedAssignment.requiredBusCount,
      scheduledTime: syncedAssignment.scheduledTime,
      transferByTrain: syncedAssignment.transferByTrain,
      trainDepartureTime: syncedAssignment.trainDepartureTime ?? undefined,
      stationPickupTime: syncedAssignment.stationPickupTime ?? undefined,
      status: syncedAssignment.status,
      drivers: syncedAssignment.drivers.map((driver) => ({
        slotNumber: driver.slotNumber,
        name: driver.name,
        phone: driver.phone,
        plateNumber: driver.plateNumber,
        isVerified: driver.isVerified,
      })),
    });
  }

  private resetChecklistDriverInMemory(
    idOrCode: string,
    payload: ResetChecklistDriverDto,
  ): ChecklistAssignmentSyncResult {
    const group = this.findOneFromMemory(idOrCode);
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

    return this.toChecklistAssignmentSyncResult(group.code, assignment);
  }

  private async resetChecklistDriverWithPrisma(
    idOrCode: string,
    payload: ResetChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const normalizedTripDate = payload.tripDate.trim().slice(0, 10);
    const normalizedScheduledTime = payload.scheduledTime.trim();
    const normalizedActivity = payload.activity?.trim().toLowerCase();
    const tripDate = new Date(`${normalizedTripDate}T00:00:00.000Z`);

    const assignment = await this.prisma.checklistAssignment.findFirst({
      where: {
        groupId: group.id,
        tripDate,
        scheduledTime: normalizedScheduledTime,
        ...(normalizedActivity
          ? {
              activity: {
                equals: normalizedActivity,
                mode: "insensitive",
              },
            }
          : {}),
      },
      include: {
        drivers: {
          orderBy: {
            slotNumber: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        `Checklist assignment for '${idOrCode}' on '${normalizedTripDate}' at '${normalizedScheduledTime}' not found.`,
      );
    }

    const resetAssignment = await this.prisma.$transaction(async (tx) => {
      await tx.checklistDriver.deleteMany({
        where: {
          checklistAssignmentId: assignment.id,
        },
      });

      return tx.checklistAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          status: ChecklistAssignmentStatus.NOT_COMPLETE,
        },
        include: {
          drivers: {
            orderBy: {
              slotNumber: "asc",
            },
          },
        },
      });
    });

    return this.toChecklistAssignmentSyncResult(group.code, {
      id: resetAssignment.id,
      tripDate: resetAssignment.tripDate.toISOString().slice(0, 10),
      activity: resetAssignment.activity,
      tripLabel: resetAssignment.tripLabel,
      requiredBusCount: resetAssignment.requiredBusCount,
      scheduledTime: resetAssignment.scheduledTime,
      transferByTrain: resetAssignment.transferByTrain,
      trainDepartureTime: resetAssignment.trainDepartureTime ?? undefined,
      stationPickupTime: resetAssignment.stationPickupTime ?? undefined,
      status: resetAssignment.status,
      drivers: [],
    });
  }

  private toChecklistAssignmentSyncResult(
    groupCode: string,
    assignment: {
      id: string;
      tripDate: string;
      activity: string;
      tripLabel: string;
      requiredBusCount: number;
      scheduledTime: string;
      transferByTrain?: boolean;
      trainDepartureTime?: string;
      stationPickupTime?: string;
      status?: ChecklistAssignmentStatus;
      drivers: Array<{
        slotNumber: number;
        name: string;
        phone: string;
        plateNumber: string;
        isVerified?: boolean;
      }>;
    },
  ): ChecklistAssignmentSyncResult {
    return {
      id: assignment.id,
      groupCode: groupCode.trim().toUpperCase(),
      tripDate: assignment.tripDate,
      activity: assignment.activity,
      tripLabel: assignment.tripLabel,
      requiredBusCount: assignment.requiredBusCount,
      scheduledTime: assignment.scheduledTime,
      transferByTrain: Boolean(assignment.transferByTrain),
      trainDepartureTime: assignment.trainDepartureTime,
      stationPickupTime: assignment.stationPickupTime,
      status: assignment.status ?? ChecklistAssignmentStatus.NOT_COMPLETE,
      drivers: assignment.drivers.map((driver) => ({
        slotNumber: driver.slotNumber,
        name: driver.name,
        phone: driver.phone,
        plateNumber: driver.plateNumber,
        isVerified: Boolean(driver.isVerified),
      })),
    };
  }

  private async resolvePrismaGroupIdentity(idOrCode: string): Promise<{ id: string; code: string }> {
    const group = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (!group) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    return group;
  }

  private async resolveOrCreatePrismaVisaSetup(groupId: string): Promise<{ id: string; groupId: string }> {
    return this.prisma.visaSetup.upsert({
      where: {
        groupId,
      },
      update: {},
      create: {
        groupId,
        visaStatus: VisaStatus.DRAFT,
        syarikah: "Not assigned",
        paymentStatus: VisaPaymentStatus.UNPAID,
        outstandingAmount: new Prisma.Decimal(0),
      },
      select: {
        id: true,
        groupId: true,
      },
    });
  }

  private async resolveNextPrismaItinerarySortOrder(groupId: string): Promise<number> {
    const latest = await this.prisma.itineraryItem.findFirst({
      where: {
        groupId,
      },
      select: {
        sortOrder: true,
      },
      orderBy: {
        sortOrder: "desc",
      },
    });

    return latest ? latest.sortOrder + 1 : 0;
  }

  private async addItineraryItemWithPrisma(
    idOrCode: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<unknown> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const requestedSortOrder = payload.sortOrder;
    const maxAttempts = requestedSortOrder === undefined ? 3 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const sortOrder = requestedSortOrder ?? (await this.resolveNextPrismaItinerarySortOrder(group.id));
      if (requestedSortOrder !== undefined) {
        const duplicateSortOrder = await this.prisma.itineraryItem.findFirst({
          where: {
            groupId: group.id,
            sortOrder,
          },
          select: { id: true },
        });
        if (duplicateSortOrder) {
          throw new ConflictException(`Sort order '${sortOrder}' already exists for this group itinerary.`);
        }
      }

      try {
        await this.prisma.itineraryItem.create({
          data: {
            groupId: group.id,
            sortOrder,
            dateLabel: payload.dateLabel.trim(),
            yearLabel: payload.yearLabel.trim(),
            category: payload.category.trim(),
            categoryKey: payload.categoryKey?.trim() || null,
            title: resolveItineraryTitle(payload),
            meta: payload.meta.trim(),
            icon: payload.icon.trim(),
            highlighted: payload.highlighted ?? false,
            isoDate: payload.isoDate ? new Date(`${payload.isoDate}T00:00:00.000Z`) : null,
            time: payload.time?.trim() || null,
            flightNumber: payload.flightNumber?.trim() || null,
            fromLocation: payload.fromLocation?.trim() || null,
            toLocation: payload.toLocation?.trim() || null,
            cityTourCity: payload.cityTourCity?.trim() || null,
            requiresBus: payload.requiresBus ?? false,
            notes: payload.notes?.trim() || null,
            transferByTrain: payload.transferByTrain ?? false,
            trainDepartureTime: payload.trainDepartureTime?.trim() || null,
            destinationPickupTime: payload.destinationPickupTime?.trim() || null,
            hotelPickupRequestTime: payload.hotelPickupRequestTime?.trim() || null,
          },
        });

        return this.findOneWithPrisma(group.id);
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          if (requestedSortOrder !== undefined) {
            throw new ConflictException(`Sort order '${sortOrder}' already exists for this group itinerary.`);
          }

          if (attempt < maxAttempts - 1) {
            continue;
          }

          throw new ConflictException(
            "Unable to allocate itinerary sort order due to concurrent updates. Please retry.",
          );
        }

        throw error;
      }
    }

    throw new ConflictException("Unable to create itinerary item. Please retry.");
  }

  private async updateItineraryItemWithPrisma(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<unknown> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const existing = await this.prisma.itineraryItem.findFirst({
      where: {
        id: itemId,
        groupId: group.id,
      },
      select: {
        id: true,
        sortOrder: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Itinerary item '${itemId}' not found in group '${idOrCode}'.`);
    }

    const sortOrder = payload.sortOrder ?? existing.sortOrder;
    if (sortOrder !== existing.sortOrder) {
      const duplicateSortOrder = await this.prisma.itineraryItem.findFirst({
        where: {
          groupId: group.id,
          sortOrder,
          id: {
            not: itemId,
          },
        },
        select: { id: true },
      });
      if (duplicateSortOrder) {
        throw new ConflictException(`Sort order '${sortOrder}' already exists for this group itinerary.`);
      }
    }

    try {
      await this.prisma.itineraryItem.update({
        where: { id: itemId },
        data: {
          sortOrder,
          dateLabel: payload.dateLabel.trim(),
          yearLabel: payload.yearLabel.trim(),
          category: payload.category.trim(),
          categoryKey: payload.categoryKey?.trim() || null,
          title: resolveItineraryTitle(payload),
          meta: payload.meta.trim(),
          icon: payload.icon.trim(),
          highlighted: payload.highlighted ?? false,
          isoDate: payload.isoDate ? new Date(`${payload.isoDate}T00:00:00.000Z`) : null,
          time: payload.time?.trim() || null,
          flightNumber: payload.flightNumber?.trim() || null,
          fromLocation: payload.fromLocation?.trim() || null,
          toLocation: payload.toLocation?.trim() || null,
          cityTourCity: payload.cityTourCity?.trim() || null,
          requiresBus: payload.requiresBus ?? false,
          notes: payload.notes?.trim() || null,
          transferByTrain: payload.transferByTrain ?? false,
          trainDepartureTime: payload.trainDepartureTime?.trim() || null,
          destinationPickupTime: payload.destinationPickupTime?.trim() || null,
          hotelPickupRequestTime: payload.hotelPickupRequestTime?.trim() || null,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(`Sort order '${sortOrder}' already exists for this group itinerary.`);
      }

      throw error;
    }

    return this.findOneWithPrisma(group.id);
  }

  private async removeItineraryItemWithPrisma(idOrCode: string, itemId: string): Promise<unknown> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const removed = await this.prisma.itineraryItem.deleteMany({
      where: {
        id: itemId,
        groupId: group.id,
      },
    });

    if (removed.count === 0) {
      throw new NotFoundException(`Itinerary item '${itemId}' not found in group '${idOrCode}'.`);
    }

    return this.findOneWithPrisma(group.id);
  }

  private async addVisaHotelAgreementWithPrisma(
    idOrCode: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<unknown> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const visaSetup = await this.resolveOrCreatePrismaVisaSetup(group.id);
    const existingHotels = await this.prisma.visaHotelAgreement.findMany({
      where: {
        visaSetupId: visaSetup.id,
      },
      select: {
        id: true,
        city: true,
        stayStart: true,
        stayEnd: true,
      },
    });
    const nextHotelAgreements = [
      ...existingHotels.map((hotel) => ({
        id: hotel.id,
        city: hotel.city,
        stayStart: hotel.stayStart.toISOString().slice(0, 10),
        stayEnd: hotel.stayEnd.toISOString().slice(0, 10),
      })),
      {
        id: randomUUID(),
        city: payload.city,
        stayStart: payload.stayStart,
        stayEnd: payload.stayEnd,
      },
    ];
    validateHotelAgreementRules(nextHotelAgreements);

    await this.prisma.visaHotelAgreement.create({
      data: {
        visaSetupId: visaSetup.id,
        city: payload.city,
        hotelName: payload.hotelName.trim(),
        agreementNumber: payload.agreementNumber.trim(),
        pax: payload.pax,
        status: payload.status ?? AgreementApprovalStatus.WAITING,
        stayStart: new Date(`${payload.stayStart}T00:00:00.000Z`),
        stayEnd: new Date(`${payload.stayEnd}T00:00:00.000Z`),
      },
    });

    return this.findOneWithPrisma(group.id);
  }

  private async updateVisaHotelAgreementWithPrisma(
    idOrCode: string,
    hotelId: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<unknown> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const existingHotels = await this.prisma.visaHotelAgreement.findMany({
      where: {
        visaSetup: {
          groupId: group.id,
        },
      },
      select: {
        id: true,
        city: true,
        stayStart: true,
        stayEnd: true,
      },
    });
    const existing = existingHotels.find((hotel) => hotel.id === hotelId);

    if (!existing) {
      throw new NotFoundException(`Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`);
    }

    const nextHotelAgreements = existingHotels.map((hotel) =>
      hotel.id === hotelId
        ? {
            id: hotel.id,
            city: payload.city,
            stayStart: payload.stayStart,
            stayEnd: payload.stayEnd,
          }
        : {
            id: hotel.id,
            city: hotel.city,
            stayStart: hotel.stayStart.toISOString().slice(0, 10),
            stayEnd: hotel.stayEnd.toISOString().slice(0, 10),
          },
    );
    validateHotelAgreementRules(nextHotelAgreements);

    await this.prisma.visaHotelAgreement.update({
      where: { id: hotelId },
      data: {
        city: payload.city,
        hotelName: payload.hotelName.trim(),
        agreementNumber: payload.agreementNumber.trim(),
        pax: payload.pax,
        status: payload.status ?? AgreementApprovalStatus.WAITING,
        stayStart: new Date(`${payload.stayStart}T00:00:00.000Z`),
        stayEnd: new Date(`${payload.stayEnd}T00:00:00.000Z`),
      },
    });

    return this.findOneWithPrisma(group.id);
  }

  private async removeVisaHotelAgreementWithPrisma(
    idOrCode: string,
    hotelId: string,
  ): Promise<unknown> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const existingHotels = await this.prisma.visaHotelAgreement.findMany({
      where: {
        visaSetup: {
          groupId: group.id,
        },
      },
      select: {
        id: true,
        city: true,
        stayStart: true,
        stayEnd: true,
      },
    });
    const target = existingHotels.find((hotel) => hotel.id === hotelId);
    if (!target) {
      throw new NotFoundException(`Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`);
    }

    const nextHotelAgreements = existingHotels
      .filter((hotel) => hotel.id !== hotelId)
      .map((hotel) => ({
        id: hotel.id,
        city: hotel.city,
        stayStart: hotel.stayStart.toISOString().slice(0, 10),
        stayEnd: hotel.stayEnd.toISOString().slice(0, 10),
      }));
    validateHotelAgreementRules(nextHotelAgreements);

    const removed = await this.prisma.visaHotelAgreement.deleteMany({
      where: {
        id: hotelId,
        visaSetup: {
          groupId: group.id,
        },
      },
    });

    if (removed.count === 0) {
      throw new NotFoundException(`Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`);
    }

    return this.findOneWithPrisma(group.id);
  }

  private async upsertPrimaryRaudhahAppointmentWithPrisma(
    idOrCode: string,
    payload: UpsertGroupRaudhahDto,
  ): Promise<unknown> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const visaSetup = await this.resolveOrCreatePrismaVisaSetup(group.id);
    const primary = await this.prisma.raudhahAppointment.findFirst({
      where: {
        visaSetupId: visaSetup.id,
      },
      orderBy: {
        date: "asc",
      },
      select: {
        id: true,
      },
    });

    if (primary) {
      await this.prisma.raudhahAppointment.update({
        where: {
          id: primary.id,
        },
        data: {
          date: new Date(`${payload.date}T00:00:00.000Z`),
          status: payload.status ?? GroupRaudhahStatus.FREE,
          tasrehPrinted: payload.tasrehPrinted ?? false,
        },
      });
    } else {
      await this.prisma.raudhahAppointment.create({
        data: {
          visaSetupId: visaSetup.id,
          date: new Date(`${payload.date}T00:00:00.000Z`),
          status: payload.status ?? GroupRaudhahStatus.FREE,
          tasrehPrinted: payload.tasrehPrinted ?? false,
        },
      });
    }

    return this.findOneWithPrisma(group.id);
  }

  private async findAllWithPrisma(
    query?: string,
    options?: FindAllOptions,
  ): Promise<unknown[] | PaginatedGroupList<unknown>> {
    const where = this.buildGroupWhere(query, options?.filter);
    const pageState = this.resolvePaginationState(options);

    if (!pageState) {
      return this.prisma.group.findMany({
        where,
        include: groupInclude,
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    const [total, items] = await Promise.all([
      this.prisma.group.count({ where }),
      this.prisma.group.findMany({
        where,
        include: groupInclude,
        orderBy: {
          createdAt: "desc",
        },
        skip: (pageState.page - 1) * pageState.pageSize,
        take: pageState.pageSize,
      }),
    ]);

    return {
      items,
      total,
      page: pageState.page,
      pageSize: pageState.pageSize,
    };
  }

  private async findOneWithPrisma(idOrCode: string) {
    const group = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      include: groupInclude,
    });

    if (!group) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    return group;
  }

  private async createWithPrisma(payload: CreateGroupDto) {
    const normalizedCode = payload.code.trim().toUpperCase();

    try {
      return await this.prisma.group.create({
        data: buildGroupCreateData(payload, normalizedCode),
        include: groupInclude,
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(`Group code '${normalizedCode}' already exists.`);
      }

      throw error;
    }
  }

  private async replaceWithPrisma(idOrCode: string, payload: CreateGroupDto) {
    const current = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: {
        id: true,
        code: true,
        itinerary: {
          select: {
            id: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!current) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    const normalizedCode = payload.code.trim().toUpperCase();
    if (normalizedCode !== current.code) {
      const duplicate = await this.prisma.group.findUnique({
        where: { code: normalizedCode },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== current.id) {
        throw new ConflictException(`Group code '${normalizedCode}' already exists.`);
      }
    }

    const legacyItinerarySortOrderById = new Map<string, number>(
      current.itinerary.map((item) => [item.id, item.sortOrder]),
    );
    const checklistSortOrderHints = new Map<string, number>();
    (payload.checklistAssignments ?? []).forEach((assignment) => {
      const legacyItineraryId = assignment.itineraryItemId?.trim();
      if (!legacyItineraryId) {
        return;
      }

      const legacySortOrder = legacyItinerarySortOrderById.get(legacyItineraryId);
      if (legacySortOrder === undefined) {
        return;
      }

      const identity = buildChecklistAssignmentIdentity({
        tripDateIso: parseIsoDateOnly(assignment.tripDate),
        scheduledTime: assignment.scheduledTime,
        activity: assignment.activity,
        tripLabel: assignment.tripLabel,
      });
      checklistSortOrderHints.set(identity, legacySortOrder);
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.checklistAssignment.deleteMany({
        where: {
          groupId: current.id,
        },
      });
      await tx.itineraryItem.deleteMany({
        where: {
          groupId: current.id,
        },
      });
      await tx.groupTimelineItem.deleteMany({
        where: {
          groupId: current.id,
        },
      });
      await tx.groupNote.deleteMany({
        where: {
          groupId: current.id,
        },
      });
      await tx.nextActivity.deleteMany({
        where: {
          groupId: current.id,
        },
      });
      await tx.musyrif.deleteMany({
        where: {
          groupId: current.id,
        },
      });
      await tx.visaSetup.deleteMany({
        where: {
          groupId: current.id,
        },
      });

      const replaced = await tx.group.update({
        where: { id: current.id },
        data: buildGroupReplaceData(payload, normalizedCode),
        include: groupInclude,
      });

      if (checklistSortOrderHints.size === 0) {
        return replaced;
      }

      const newItineraryIdBySortOrder = new Map<number, string>(
        replaced.itinerary.map((item) => [item.sortOrder, item.id]),
      );

      const relinkOperations: Array<Promise<unknown>> = [];
      replaced.checklistAssignments.forEach((assignment) => {
        const identity = buildChecklistAssignmentIdentity({
          tripDateIso: toIsoDateOnly(assignment.tripDate),
          scheduledTime: assignment.scheduledTime,
          activity: assignment.activity,
          tripLabel: assignment.tripLabel,
        });
        const mappedSortOrder = checklistSortOrderHints.get(identity);
        if (mappedSortOrder === undefined) {
          return;
        }

        const mappedItineraryId = newItineraryIdBySortOrder.get(mappedSortOrder);
        if (!mappedItineraryId || assignment.itineraryItemId === mappedItineraryId) {
          return;
        }

        relinkOperations.push(
          tx.checklistAssignment.update({
            where: {
              id: assignment.id,
            },
            data: {
              itineraryItemId: mappedItineraryId,
            },
          }),
        );
      });

      if (relinkOperations.length === 0) {
        return replaced;
      }

      await Promise.all(relinkOperations);
      return tx.group.findUniqueOrThrow({
        where: {
          id: current.id,
        },
        include: groupInclude,
      });
    });
  }

  private async updateWithPrisma(idOrCode: string, payload: UpdateGroupDto) {
    const current = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: {
        id: true,
        code: true,
        arrivalDate: true,
        returnDate: true,
      },
    });

    if (!current) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    const nextCode = payload.code?.trim().toUpperCase();
    if (nextCode && nextCode !== current.code) {
      const duplicate = await this.prisma.group.findUnique({
        where: { code: nextCode },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== current.id) {
        throw new ConflictException(`Group code '${nextCode}' already exists.`);
      }
    }

    const nextArrivalDateIso = payload.arrivalDate
      ? parseIsoDateOnly(payload.arrivalDate)
      : current.arrivalDate.toISOString().slice(0, 10);
    const nextReturnDateIso = payload.returnDate
      ? parseIsoDateOnly(payload.returnDate)
      : current.returnDate.toISOString().slice(0, 10);
    validateTravelDateRangeOrThrow(nextArrivalDateIso, nextReturnDateIso);

    return this.prisma.group.update({
      where: { id: current.id },
      data: {
        code: nextCode,
        name: payload.name?.trim(),
        status: payload.status?.trim(),
        arrivalDate: payload.arrivalDate ? toUtcMidnightDate(nextArrivalDateIso) : undefined,
        returnDate: payload.returnDate ? toUtcMidnightDate(nextReturnDateIso) : undefined,
        tone: payload.tone,
        pax: payload.pax,
        totalBuses: payload.totalBuses,
        packageName: payload.packageName?.trim(),
        durationDays: payload.durationDays,
      },
      include: groupInclude,
    });
  }

  private async removeWithPrisma(idOrCode: string): Promise<void> {
    const current = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: {
        id: true,
      },
    });

    if (!current) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    await this.prisma.group.delete({
      where: {
        id: current.id,
      },
    });
  }
}

