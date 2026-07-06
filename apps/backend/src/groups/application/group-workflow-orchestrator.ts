import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CreateGroupDto } from "../dto/create-group.dto";
import type { UpdateGroupDto } from "../dto/update-group.dto";
import {
  validateCreateOrReplaceHotelAgreementRules,
} from "../domain/groups.hotel-validation";
import { buildGroupSearchDocument } from "../domain/groups.search-document";
import {
  buildChecklistAssignmentIdentity,
  parseIsoDateOnly,
  toIsoDateOnly,
  toUtcMidnightDate,
  validateTravelDateRangeOrThrow,
} from "../domain/groups.shared";
import {
  resolveGroupLifecycleStatus,
  toGroupStatusLabel,
} from "../domain/groups.lifecycle-status";
import {
  createInMemory,
  removeFromMemory,
  replaceInMemory,
  updateInMemory,
} from "../infrastructure/groups.memory-store";
import { groupDetailSelection } from "../infrastructure/groups.prisma-include";
import {
  buildGroupCreateData,
  buildGroupReplaceData,
} from "../infrastructure/groups.prisma-write-builders";
import type {
  GroupDetailRecord,
  MemoryGroupRecord,
  PrismaGroupDetailRecord,
} from "../groups.service-types";

type PrismaParentLinkCurrentGroup = {
  id: string;
  code: string;
};

export class GroupWorkflowOrchestrator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSource: "memory" | "prisma",
    private readonly memoryGroups: MemoryGroupRecord[],
  ) {}

  async create(payload: CreateGroupDto): Promise<GroupDetailRecord> {
    this.validateCreateOrReplaceTravelDates(payload);
    validateCreateOrReplaceHotelAgreementRules(payload);

    if (this.dataSource === "prisma") {
      return this.createWithPrisma(payload);
    }

    return createInMemory(this.memoryGroups, payload);
  }

  async replace(idOrCode: string, payload: CreateGroupDto): Promise<GroupDetailRecord> {
    this.validateCreateOrReplaceTravelDates(payload);
    validateCreateOrReplaceHotelAgreementRules(payload);

    if (this.dataSource === "prisma") {
      return this.replaceWithPrisma(idOrCode, payload);
    }

    return replaceInMemory(this.memoryGroups, idOrCode, payload);
  }

  async update(idOrCode: string, payload: UpdateGroupDto): Promise<GroupDetailRecord> {
    if (this.dataSource === "prisma") {
      return this.updateWithPrisma(idOrCode, payload);
    }

    return updateInMemory(this.memoryGroups, idOrCode, payload);
  }

  async remove(idOrCode: string): Promise<void> {
    if (this.dataSource === "prisma") {
      await this.removeWithPrisma(idOrCode);
      return;
    }

    removeFromMemory(this.memoryGroups, idOrCode);
  }

  private validateCreateOrReplaceTravelDates(payload: CreateGroupDto): void {
    const normalizedArrivalDate = parseIsoDateOnly(payload.arrivalDate);
    const normalizedReturnDate = parseIsoDateOnly(payload.returnDate);
    validateTravelDateRangeOrThrow(normalizedArrivalDate, normalizedReturnDate);
  }

  private async createWithPrisma(payload: CreateGroupDto): Promise<PrismaGroupDetailRecord> {
    const normalizedCode = payload.code.trim().toUpperCase();
    const parentGroupId = await this.validateParentGroupLinkWithPrisma({
      requestedParentGroupId: payload.parentGroupId,
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
        throw new ConflictException(
          `Group code '${normalizedCode}' already exists.`,
        );
      }

      throw error;
    }
  }

  private async replaceWithPrisma(idOrCode: string, payload: CreateGroupDto): Promise<PrismaGroupDetailRecord> {
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
        throw new ConflictException(
          `Group code '${normalizedCode}' already exists.`,
        );
      }
    }

    const legacyItinerarySortOrderById = new Map<string, number>(
      current.itinerary.map((item) => [item.id, item.sortOrder]),
    );
    const parentGroupId = await this.validateParentGroupLinkWithPrisma({
      requestedParentGroupId: payload.parentGroupId,
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

      const legacySortOrder =
        legacyItinerarySortOrderById.get(legacyItineraryId);
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

        const mappedItineraryId =
          newItineraryIdBySortOrder.get(mappedSortOrder);
        if (
          !mappedItineraryId ||
          assignment.itineraryItemId === mappedItineraryId
        ) {
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

  private async updateWithPrisma(idOrCode: string, payload: UpdateGroupDto): Promise<PrismaGroupDetailRecord> {
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
    const nextLifecycleStatus = payload.lifecycleStatus ?? (payload.status !== undefined ? resolveGroupLifecycleStatus(payload.status) : undefined);
    const nextStatus = payload.status?.trim() ?? (payload.lifecycleStatus ? toGroupStatusLabel(payload.lifecycleStatus) : undefined);

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
        arrivalDate: payload.arrivalDate
          ? toUtcMidnightDate(nextArrivalDateIso)
          : undefined,
        returnDate: payload.returnDate
          ? toUtcMidnightDate(nextReturnDateIso)
          : undefined,
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

  private async validateParentGroupLinkWithPrisma(input: {
    requestedParentGroupId?: string | null;
    currentGroup?: PrismaParentLinkCurrentGroup;
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
      },
    });

    if (!parentGroup) {
      throw new NotFoundException(
        `Parent group '${requestedParentGroupId}' not found.`,
      );
    }

    if (parentGroup.parentGroupId) {
      throw new ConflictException(
        `Group '${parentGroup.code}' is a child group and cannot be used as parent.`,
      );
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

  private async removeWithPrisma(idOrCode: string): Promise<void> {
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
}
