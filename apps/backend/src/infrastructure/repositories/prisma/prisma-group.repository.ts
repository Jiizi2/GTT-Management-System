import { Injectable, NotFoundException, ConflictException, BadRequestException } from "@nestjs/common";
import {
  AgreementApprovalStatus,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  Prisma,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { GroupRepository } from "../../../domain/repositories/group.repository";
import { CreateGroupDto } from "../../../groups/dto/create-group.dto";
import { UpdateGroupDto } from "../../../groups/dto/update-group.dto";
import {
  UpsertGroupItineraryItemDto,
  ReplaceGroupItineraryDto,
  UpsertGroupVisaHotelDto,
  UpsertGroupRaudhahDto,
} from "../../../groups/dto/group-operations.dto";
import { ConfirmChecklistDriverDto } from "../../../groups/dto/confirm-checklist-driver.dto";
import { ResetChecklistDriverDto } from "../../../groups/dto/reset-checklist-driver.dto";
import {
  FindAllOptions,
  GroupDetailRecord,
  GroupListResult,
  MemoryAuditLog,
  ChecklistAssignmentSyncResult,
  PrismaGroupDetailRecord,
  GroupAuditContext,
  GroupAuditDetail,
} from "../../../groups/groups.service-types";
import {
  groupDetailSelection,
  groupSummarySelection,
  buildGroupWhere,
  resolvePaginationState,
} from "./helpers/prisma-group.helpers";
import {
  validateCreateOrReplaceHotelAgreementRules,
  validateHotelAgreementRules,
} from "../../../groups/domain/groups.hotel-validation";
import { resolveItineraryTitle } from "../../../groups/domain/groups-itinerary-title";
import { buildGroupSearchDocument } from "../../../groups/domain/groups.search-document";
import {
  buildChecklistAssignmentIdentity,
  parseIsoDateOnly,
  toChecklistAssignmentSyncResult,
  toIsoDateOnly,
  toUtcMidnightDate,
  validateTravelDateRangeOrThrow,
} from "../../../groups/domain/groups.shared";
import {
  resolveGroupLifecycleStatus,
  toGroupStatusLabel,
} from "../../../groups/domain/groups.lifecycle-status";
import { randomUUID } from "node:crypto";
import {
  sanitizeAuditPayloadValue,
  buildGroupCreateData,
  buildGroupReplaceData,
} from "./helpers/prisma-group.helpers";

type PrismaParentLinkCurrentGroup = {
  id: string;
  code: string;
};

@Injectable()
export class PrismaGroupRepository implements GroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  private validateCreateOrReplaceTravelDates(payload: CreateGroupDto): void {
    const normalizedArrivalDate = parseIsoDateOnly(payload.arrivalDate);
    const normalizedReturnDate = parseIsoDateOnly(payload.returnDate);
    validateTravelDateRangeOrThrow(normalizedArrivalDate, normalizedReturnDate);
  }

  async findAll(query?: string, options?: FindAllOptions): Promise<GroupListResult> {
    const where = buildGroupWhere(query, options?.filter, options?.activeOnly ?? false, options?.agentId);
    const pageState = resolvePaginationState(options);
    const select = options?.projection === "summary" ? groupSummarySelection : groupDetailSelection;

    if (!pageState) {
      const items = await this.prisma.group.findMany({
        where,
        select,
        orderBy: {
          createdAt: "desc",
        },
      });
      return items;
    }

    const [total, items] = await Promise.all([
      this.prisma.group.count({ where }),
      this.prisma.group.findMany({
        where,
        select,
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

  async findOneByIdOrCode(idOrCode: string): Promise<GroupDetailRecord> {
    let group = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: groupDetailSelection,
    });

    if (!group) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    if (group.parentGroupId) {
      const parent = await this.prisma.group.findFirst({
        where: { id: group.parentGroupId },
        select: {
          musyrif: groupDetailSelection.musyrif,
          nextActivity: groupDetailSelection.nextActivity,
          timeline: groupDetailSelection.timeline,
          itinerary: groupDetailSelection.itinerary,
          notes: groupDetailSelection.notes,
          checklistAssignments: groupDetailSelection.checklistAssignments,
        },
      });

      if (parent) {
        const inheritedFields: Pick<
          PrismaGroupDetailRecord,
          "musyrif" | "nextActivity" | "timeline" | "itinerary" | "notes" | "checklistAssignments"
        > = {
          musyrif: parent.musyrif,
          nextActivity: parent.nextActivity,
          timeline: parent.timeline,
          itinerary: parent.itinerary,
          notes: parent.notes,
          checklistAssignments: parent.checklistAssignments,
        };
        group = {
          ...group,
          ...inheritedFields,
        };
      }
    }

    return group;
  }

  async listAuditLogs(groupCode?: string, limit?: number): Promise<MemoryAuditLog[]> {
    const normalizedCode = groupCode?.trim().toUpperCase();
    const sanitizedLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : undefined;

    const logs = await this.prisma.groupAuditLog.findMany({
      where: normalizedCode
        ? {
            groupCode: normalizedCode,
          }
        : undefined,
      orderBy: {
        createdAt: "desc",
      },
      take: sanitizedLimit,
      select: {
        id: true,
        groupCode: true,
        action: true,
        entity: true,
        payload: true,
        createdAt: true,
      },
    });

    return logs.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity: entry.entity,
      groupCode: entry.groupCode ?? undefined,
      payload:
        entry.payload && typeof entry.payload === "object" && !Array.isArray(entry.payload)
          ? (entry.payload as Record<string, unknown>)
          : {},
      createdAt: entry.createdAt.toISOString(),
    }));
  }

  async writeAuditLog(
    action: string,
    entity: string,
    detail: GroupAuditDetail,
    groupInfo?: GroupAuditContext,
  ): Promise<void> {
    const code = groupInfo?.code || groupInfo?.groupCode || "";
    await this.prisma.groupAuditLog.create({
      data: {
        groupId: groupInfo?.id === undefined ? undefined : groupInfo.id,
        groupCode: code.trim().toUpperCase(),
        action,
        entity,
        payload: sanitizeAuditPayloadValue(detail) as Prisma.InputJsonValue,
      },
    });
  }

  async create(payload: CreateGroupDto): Promise<GroupDetailRecord> {
    this.validateCreateOrReplaceTravelDates(payload);
    validateCreateOrReplaceHotelAgreementRules(payload);

    const normalizedCode = payload.code.trim().toUpperCase();
    const parentGroupId = await this.validateParentGroupLinkWithPrisma({
      requestedParentGroupId: payload.parentGroupId,
      agentId: payload.agentId,
    });
    const normalizedPayload: CreateGroupDto = {
      ...payload,
      parentGroupId,
    };

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.group.create({
          data: buildGroupCreateData(normalizedPayload, normalizedCode),
          select: groupDetailSelection,
        });
        return created;
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(`Group code '${normalizedCode}' already exists.`);
      }
      throw error;
    }
  }

  async replace(idOrCode: string, payload: CreateGroupDto): Promise<GroupDetailRecord> {
    this.validateCreateOrReplaceTravelDates(payload);
    validateCreateOrReplaceHotelAgreementRules(payload);

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
    const parentGroupId = await this.validateParentGroupLinkWithPrisma({
      requestedParentGroupId: payload.parentGroupId,
      agentId: payload.agentId,
      currentGroup: current,
    });
    const normalizedPayload: CreateGroupDto = {
      ...payload,
      parentGroupId,
    };
    const checklistSortOrderHints = new Map<string, number>();
    (normalizedPayload.checklistAssignments ?? []).forEach((assignment) => {
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
        data: buildGroupReplaceData(normalizedPayload, normalizedCode),
        select: groupDetailSelection,
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
        select: groupDetailSelection,
      });
    });
  }

  async update(idOrCode: string, payload: UpdateGroupDto): Promise<GroupDetailRecord> {
    const current = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        lifecycleStatus: true,
        arrivalDate: true,
        returnDate: true,
        packageName: true,
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
    const parentGroupId = await this.validateParentGroupLinkWithPrisma({
      requestedParentGroupId: payload.parentGroupId,
      currentGroup: current,
    });
    const nextLifecycleStatus =
      payload.lifecycleStatus ??
      (payload.status !== undefined ? resolveGroupLifecycleStatus(payload.status) : undefined);
    const nextStatus =
      payload.status?.trim() ??
      (payload.lifecycleStatus ? toGroupStatusLabel(payload.lifecycleStatus) : undefined);

    return this.prisma.group.update({
      where: { id: current.id },
      data: {
        code: nextCode,
        name: payload.name?.trim(),
        status: nextStatus,
        lifecycleStatus: nextLifecycleStatus,
        searchDocument: buildGroupSearchDocument({
          code: nextCode ?? current.code,
          name: payload.name?.trim() ?? current.name,
          status: nextStatus ?? current.status,
          packageName: payload.packageName?.trim() ?? current.packageName,
        }),
        arrivalDate: payload.arrivalDate ? toUtcMidnightDate(nextArrivalDateIso) : undefined,
        returnDate: payload.returnDate ? toUtcMidnightDate(nextReturnDateIso) : undefined,
        tone: payload.tone,
        pax: payload.pax,
        totalBuses: payload.totalBuses,
        packageName: payload.packageName?.trim(),
        durationDays: payload.durationDays,
        parentGroupId,
      },
      select: groupDetailSelection,
    });
  }

  async remove(idOrCode: string): Promise<void> {
    const current = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (!current) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    const childCount = await this.prisma.group.count({
      where: {
        parentGroupId: current.id,
      },
    });
    if (childCount > 0) {
      throw new ConflictException(
        `Group '${current.code}' still has child groups and cannot be deleted. Unlink child groups first.`,
      );
    }

    await this.prisma.group.delete({
      where: {
        id: current.id,
      },
    });
  }

  async reassignAgent(idOrCode: string, agentId: string): Promise<GroupDetailRecord> {
    const group = await this.prisma.group.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }] },
      select: { id: true, code: true, parentGroupId: true, childGroups: { select: { id: true } } },
    });
    if (!group) throw new NotFoundException(`Group '${idOrCode}' not found.`);
    if (group.parentGroupId) throw new BadRequestException("Reassign Agent harus dilakukan dari parent Group.");
    const groupIds = [group.id, ...group.childGroups.map((child) => child.id)];
    await this.prisma.$transaction(async (tx) => {
      const linkedAgreements = await tx.visaHotelAgreement.findMany({
        where: {
          visaSetup: { groupId: { in: groupIds } },
          sourceDraftId: { not: null },
        },
        select: { sourceDraftId: true },
      });
      const sourceDraftIds = linkedAgreements
        .map((agreement) => agreement.sourceDraftId)
        .filter((draftId): draftId is string => Boolean(draftId));

      await tx.group.updateMany({ where: { id: { in: groupIds } }, data: { agentId } });
      await tx.invoice.updateMany({ where: { groupId: { in: groupIds } }, data: { agentId } });
      if (sourceDraftIds.length > 0) {
        await tx.hotelAgreementDraft.updateMany({
          where: { id: { in: sourceDraftIds } },
          data: { agentId },
        });
      }
    });
    return this.findOneByIdOrCode(group.id);
  }

  async addItineraryItem(idOrCode: string, payload: UpsertGroupItineraryItemDto): Promise<GroupDetailRecord> {
    await this.ensureNotChildGroup(idOrCode, "itinerary");
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const requestedSortOrder = payload.sortOrder;
    const maxAttempts = requestedSortOrder === undefined ? 3 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const sortOrder =
        requestedSortOrder ?? (await this.resolveNextPrismaItinerarySortOrder(group.id));
      if (requestedSortOrder !== undefined) {
        const duplicateSortOrder = await this.prisma.itineraryItem.findFirst({
          where: {
            groupId: group.id,
            sortOrder,
          },
          select: { id: true },
        });
        if (duplicateSortOrder) {
          throw new ConflictException(
            `Sort order '${sortOrder}' already exists for this group itinerary.`,
          );
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
            hotelName: payload.hotelName?.trim() || null,
            fromHotelName: payload.fromHotelName?.trim() || null,
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

        return this.findOneByIdOrCode(group.id);
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          if (requestedSortOrder !== undefined) {
            throw new ConflictException(
              `Sort order '${sortOrder}' already exists for this group itinerary.`,
            );
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

  async replaceItinerary(idOrCode: string, payload: ReplaceGroupItineraryDto): Promise<GroupDetailRecord> {
    await this.ensureNotChildGroup(idOrCode, "itinerary");
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const items = payload.itinerary.map((item, index) => ({
      item,
      sortOrder: item.sortOrder ?? index,
    }));
    const sortOrders = items.map(({ sortOrder }) => sortOrder);
    if (new Set(sortOrders).size !== sortOrders.length) {
      throw new BadRequestException("Setiap itinerary item harus memiliki sort order yang unik.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.itineraryItem.deleteMany({
        where: sortOrders.length > 0
          ? { groupId: group.id, sortOrder: { notIn: sortOrders } }
          : { groupId: group.id },
      });

      for (const { item, sortOrder } of items) {
        const data = {
          dateLabel: item.dateLabel.trim(),
          yearLabel: item.yearLabel.trim(),
          category: item.category.trim(),
          categoryKey: item.categoryKey?.trim() || null,
          title: resolveItineraryTitle(item),
          meta: item.meta.trim(),
          icon: item.icon.trim(),
          highlighted: item.highlighted ?? false,
          isoDate: item.isoDate ? toUtcMidnightDate(item.isoDate) : null,
          time: item.time?.trim() || null,
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
        };
        await tx.itineraryItem.upsert({
          where: {
            groupId_sortOrder: {
              groupId: group.id,
              sortOrder,
            },
          },
          create: {
            groupId: group.id,
            sortOrder,
            ...data,
          },
          update: data,
        });
      }
    });

    return this.findOneByIdOrCode(group.id);
  }

  async updateItineraryItem(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<GroupDetailRecord> {
    await this.ensureNotChildGroup(idOrCode, "itinerary");
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
      throw new NotFoundException(
        `Itinerary item '${itemId}' not found in group '${idOrCode}'.`,
      );
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
        throw new ConflictException(
          `Sort order '${sortOrder}' already exists for this group itinerary.`,
        );
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
          hotelName: payload.hotelName?.trim() || null,
          fromHotelName: payload.fromHotelName?.trim() || null,
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(
          `Sort order '${sortOrder}' already exists for this group itinerary.`,
        );
      }
      throw error;
    }

    return this.findOneByIdOrCode(group.id);
  }

  async removeItineraryItem(idOrCode: string, itemId: string): Promise<GroupDetailRecord> {
    await this.ensureNotChildGroup(idOrCode, "itinerary");
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const removed = await this.prisma.itineraryItem.deleteMany({
      where: {
        id: itemId,
        groupId: group.id,
      },
    });

    if (removed.count === 0) {
      throw new NotFoundException(
        `Itinerary item '${itemId}' not found in group '${idOrCode}'.`,
      );
    }

    return this.findOneByIdOrCode(group.id);
  }

  async addVisaHotelAgreement(idOrCode: string, payload: UpsertGroupVisaHotelDto): Promise<GroupDetailRecord> {
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
    validateHotelAgreementRules(nextHotelAgreements, {
      requireMakkah: false,
    });

    await this.prisma.visaHotelAgreement.create({
      data: {
        visaSetupId: visaSetup.id,
        sourceDraftId: payload.sourceDraftId?.trim() || null,
        city: payload.city,
        hotelName: payload.hotelName.trim(),
        agreementNumber: payload.agreementNumber.trim(),
        pax: payload.pax,
        status: payload.status ?? AgreementApprovalStatus.WAITING,
        stayStart: new Date(`${payload.stayStart}T00:00:00.000Z`),
        stayEnd: new Date(`${payload.stayEnd}T00:00:00.000Z`),
      },
    });

    return this.findOneByIdOrCode(group.id);
  }

  async updateVisaHotelAgreement(
    idOrCode: string,
    hotelId: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<GroupDetailRecord> {
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
      throw new NotFoundException(
        `Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`,
      );
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
    validateHotelAgreementRules(nextHotelAgreements, {
      requireMakkah: false,
    });

    await this.prisma.visaHotelAgreement.update({
      where: { id: hotelId },
      data: {
        sourceDraftId: payload.sourceDraftId?.trim() || null,
        city: payload.city,
        hotelName: payload.hotelName.trim(),
        agreementNumber: payload.agreementNumber.trim(),
        pax: payload.pax,
        status: payload.status ?? AgreementApprovalStatus.WAITING,
        stayStart: new Date(`${payload.stayStart}T00:00:00.000Z`),
        stayEnd: new Date(`${payload.stayEnd}T00:00:00.000Z`),
      },
    });

    return this.findOneByIdOrCode(group.id);
  }

  async removeVisaHotelAgreement(idOrCode: string, hotelId: string): Promise<GroupDetailRecord> {
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
      throw new NotFoundException(
        `Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`,
      );
    }

    const nextHotelAgreements = existingHotels
      .filter((hotel) => hotel.id !== hotelId)
      .map((hotel) => ({
        id: hotel.id,
        city: hotel.city,
        stayStart: hotel.stayStart.toISOString().slice(0, 10),
        stayEnd: hotel.stayEnd.toISOString().slice(0, 10),
      }));
    validateHotelAgreementRules(nextHotelAgreements, {
      requireMakkah: false,
    });

    const removed = await this.prisma.visaHotelAgreement.deleteMany({
      where: {
        id: hotelId,
        visaSetup: {
          groupId: group.id,
        },
      },
    });

    if (removed.count === 0) {
      throw new NotFoundException(
        `Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`,
      );
    }

    return this.findOneByIdOrCode(group.id);
  }

  async upsertPrimaryRaudhahAppointment(idOrCode: string, payload: UpsertGroupRaudhahDto): Promise<GroupDetailRecord> {
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

    return this.findOneByIdOrCode(group.id);
  }

  async confirmChecklistDriver(idOrCode: string, payload: ConfirmChecklistDriverDto): Promise<ChecklistAssignmentSyncResult> {
    await this.ensureNotChildGroup(idOrCode, "checklist");
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
    const assignmentIdentity = buildChecklistAssignmentIdentity({
      tripDateIso: normalizedTripDate,
      scheduledTime: normalizedScheduledTime,
      activity: normalizedActivity,
      tripLabel: normalizedTripLabel,
    });

    const syncedAssignment = await this.prisma.$transaction(async (tx) => {
      await this.acquirePrismaTransactionLock(
        tx,
        "checklist-assignment",
        `${group.id}|${assignmentIdentity}`,
      );

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
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
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

    return toChecklistAssignmentSyncResult(group.code, {
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

  async resetChecklistDriver(idOrCode: string, payload: ResetChecklistDriverDto): Promise<ChecklistAssignmentSyncResult> {
    await this.ensureNotChildGroup(idOrCode, "checklist");
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const normalizedTripDate = payload.tripDate.trim().slice(0, 10);
    const normalizedScheduledTime = payload.scheduledTime.trim();
    const normalizedActivity = payload.activity?.trim().toLowerCase();
    const tripDate = new Date(`${normalizedTripDate}T00:00:00.000Z`);

    const resetAssignment = await this.prisma.$transaction(async (tx) => {
      await this.acquirePrismaTransactionLock(
        tx,
        "checklist-assignment-reset",
        `${group.id}|${normalizedTripDate}|${normalizedScheduledTime}|${normalizedActivity ?? "*"}`,
      );

      const assignment = await tx.checklistAssignment.findFirst({
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

    return toChecklistAssignmentSyncResult(group.code, {
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

  private async acquirePrismaTransactionLock(
    prismaClient: Pick<PrismaService, "$executeRaw">,
    namespace: string,
    key: string,
  ): Promise<void> {
    await prismaClient.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${namespace}), hashtext(${key}))
    `;
  }

  private async validateParentGroupLinkWithPrisma(input: {
    requestedParentGroupId?: string | null;
    currentGroup?: PrismaParentLinkCurrentGroup;
    agentId?: string;
  }): Promise<string | null | undefined> {
    if (input.requestedParentGroupId === undefined) {
      return undefined;
    }

    const requestedParentGroupId = input.requestedParentGroupId?.trim() ?? "";
    if (!requestedParentGroupId) {
      return null;
    }

    const currentGroup = input.currentGroup;
    if (
      currentGroup &&
      (requestedParentGroupId === currentGroup.id ||
        requestedParentGroupId.toUpperCase() === currentGroup.code)
    ) {
      throw new ConflictException("A group cannot be linked as its own parent.");
    }

    const parentGroup = await this.prisma.group.findFirst({
      where: {
        OR: [
          { id: requestedParentGroupId },
          { code: requestedParentGroupId.toUpperCase() },
        ],
      },
      select: {
        id: true,
        code: true,
        parentGroupId: true,
        agentId: true,
      },
    });

    if (!parentGroup) {
      throw new NotFoundException(`Parent group '${requestedParentGroupId}' not found.`);
    }

    if (parentGroup.parentGroupId) {
      throw new ConflictException(
        `Group '${parentGroup.code}' is a child group and cannot be used as parent.`,
      );
    }

    if (input.agentId && parentGroup.agentId && parentGroup.agentId !== input.agentId) {
      throw new ConflictException("Parent Group dan Child Group harus berasal dari Agent yang sama.");
    }

    if (currentGroup) {
      const childCount = await this.prisma.group.count({
        where: {
          parentGroupId: currentGroup.id,
        },
      });
      if (childCount > 0) {
        throw new ConflictException(
          `Group '${currentGroup.code}' already has child groups and cannot become a child group.`,
        );
      }
    }

    return parentGroup.id;
  }

  private async ensureNotChildGroup(idOrCode: string, operation: string): Promise<void> {
    const group = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: {
        parentGroupId: true,
        code: true,
      },
    });
    if (group && group.parentGroupId) {
      throw new BadRequestException(
        `Grup '${group.code}' adalah child group. Silakan edit ${operation} pada parent group.`,
      );
    }
  }
}
