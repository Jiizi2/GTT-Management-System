import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { UpsertGroupItineraryItemDto } from "../dto/group-operations.dto";
import { resolveItineraryTitle } from "../domain/groups-itinerary-title";
import {
  addItineraryItemInMemory,
  removeItineraryItemInMemory,
  updateItineraryItemInMemory,
} from "../infrastructure/groups.memory-store";
import { groupDetailSelection } from "../infrastructure/groups.prisma-include";
import type {
  GroupDetailRecord,
  MemoryGroupRecord,
  PrismaGroupDetailRecord,
} from "../groups.service-types";

export class GroupOperationalCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSource: "memory" | "prisma",
    private readonly memoryGroups: MemoryGroupRecord[],
  ) {}

  async addItineraryItem(
    idOrCode: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<GroupDetailRecord> {
    await this.ensureNotChildGroup(idOrCode, "itinerary");
    if (this.dataSource === "prisma") {
      return this.addItineraryItemWithPrisma(idOrCode, payload);
    }

    return addItineraryItemInMemory(this.memoryGroups, idOrCode, payload);
  }

  async updateItineraryItem(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<GroupDetailRecord> {
    await this.ensureNotChildGroup(idOrCode, "itinerary");
    if (this.dataSource === "prisma") {
      return this.updateItineraryItemWithPrisma(idOrCode, itemId, payload);
    }

    return updateItineraryItemInMemory(
      this.memoryGroups,
      idOrCode,
      itemId,
      payload,
    );
  }

  async removeItineraryItem(
    idOrCode: string,
    itemId: string,
  ): Promise<GroupDetailRecord> {
    await this.ensureNotChildGroup(idOrCode, "itinerary");
    if (this.dataSource === "prisma") {
      return this.removeItineraryItemWithPrisma(idOrCode, itemId);
    }

    return removeItineraryItemInMemory(this.memoryGroups, idOrCode, itemId);
  }

  public async ensureNotChildGroup(
    idOrCode: string,
    operation: string,
  ): Promise<void> {
    if (this.dataSource === "prisma") {
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
        throw new ConflictException(
          `Grup '${group.code}' adalah child group. Silakan edit ${operation} pada parent group.`,
        );
      }
    } else {
      const normalizedCode = idOrCode.trim().toUpperCase();
      const group = this.memoryGroups.find(
        (item) => item.id === idOrCode || item.code === normalizedCode,
      );
      if (group && group.parentGroupId) {
        throw new ConflictException(
          `Grup '${group.code}' adalah child group. Silakan edit ${operation} pada parent group.`,
        );
      }
    }
  }

  private async resolvePrismaGroupIdentity(
    idOrCode: string,
  ): Promise<{ id: string; code: string }> {
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

  private async resolveNextPrismaItinerarySortOrder(
    groupId: string,
  ): Promise<number> {
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

  private async findOneWithPrisma(idOrCode: string): Promise<PrismaGroupDetailRecord> {
    const group = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: groupDetailSelection,
    });

    if (!group) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    return group;
  }

  private async addItineraryItemWithPrisma(
    idOrCode: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<PrismaGroupDetailRecord> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const requestedSortOrder = payload.sortOrder;
    const maxAttempts = requestedSortOrder === undefined ? 3 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const sortOrder =
        requestedSortOrder ??
        (await this.resolveNextPrismaItinerarySortOrder(group.id));
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
            isoDate: payload.isoDate
              ? new Date(`${payload.isoDate}T00:00:00.000Z`)
              : null,
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
            destinationPickupTime:
              payload.destinationPickupTime?.trim() || null,
            hotelPickupRequestTime:
              payload.hotelPickupRequestTime?.trim() || null,
          },
        });

        return this.findOneWithPrisma(group.id);
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
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

    throw new ConflictException(
      "Unable to create itinerary item. Please retry.",
    );
  }

  private async updateItineraryItemWithPrisma(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<PrismaGroupDetailRecord> {
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
          isoDate: payload.isoDate
            ? new Date(`${payload.isoDate}T00:00:00.000Z`)
            : null,
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
          hotelPickupRequestTime:
            payload.hotelPickupRequestTime?.trim() || null,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException(
          `Sort order '${sortOrder}' already exists for this group itinerary.`,
        );
      }

      throw error;
    }

    return this.findOneWithPrisma(group.id);
  }

  private async removeItineraryItemWithPrisma(
    idOrCode: string,
    itemId: string,
  ): Promise<PrismaGroupDetailRecord> {
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

    return this.findOneWithPrisma(group.id);
  }
}
