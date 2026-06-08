import { NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import { groupDetailSelection, groupSummarySelection } from "../infrastructure/groups.prisma-include";
import {
  buildGroupWhere,
  findAllFromMemory,
  paginateGroupItems,
  projectMemoryGroupRecord,
  resolvePaginationState,
} from "../infrastructure/groups.listing";
import { findOneFromMemory } from "../infrastructure/groups.memory-store";
import type {
  FindAllOptions,
  MemoryAuditLog,
  MemoryGroupRecord,
  PaginatedGroupList,
} from "../groups.service-types";

export class GroupsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSource: "memory" | "prisma",
    private readonly memoryGroups: MemoryGroupRecord[],
    private readonly auditLogs: MemoryAuditLog[],
  ) {}

  async findAll(
    query?: string,
    options?: FindAllOptions,
  ): Promise<unknown[] | PaginatedGroupList<unknown>> {
    const projection = options?.projection ?? "detail";
    if (this.dataSource === "prisma") {
      return this.findAllWithPrisma(query, {
        ...options,
        projection,
      });
    }

    const source = findAllFromMemory(this.memoryGroups, query, options?.filter, options?.activeOnly ?? false).map((group) =>
      projectMemoryGroupRecord(group, projection),
    );
    return paginateGroupItems(source, options);
  }

  async findOneByIdOrCode(idOrCode: string): Promise<unknown> {
    if (this.dataSource === "prisma") {
      return this.findOneWithPrisma(idOrCode);
    }

    return findOneFromMemory(this.memoryGroups, idOrCode);
  }

  async listAuditLogs(groupCode?: string, limit?: number): Promise<MemoryAuditLog[]> {
    const normalizedCode = groupCode?.trim().toUpperCase();
    const sanitizedLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : undefined;

    if (this.dataSource === "prisma") {
      return this.listAuditLogsWithPrisma(normalizedCode, sanitizedLimit);
    }

    let logs = [...this.auditLogs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    if (normalizedCode) {
      logs = logs.filter((entry) => entry.groupCode === normalizedCode);
    }

    if (sanitizedLimit) {
      logs = logs.slice(0, sanitizedLimit);
    }

    return logs;
  }

  private async listAuditLogsWithPrisma(
    normalizedCode?: string,
    sanitizedLimit?: number,
  ): Promise<MemoryAuditLog[]> {
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

  private async findAllWithPrisma(
    query?: string,
    options?: FindAllOptions,
  ): Promise<unknown[] | PaginatedGroupList<unknown>> {
    const where = buildGroupWhere(query, options?.filter, options?.activeOnly ?? false);
    const pageState = resolvePaginationState(options);
    const select = options?.projection === "summary" ? groupSummarySelection : groupDetailSelection;

    if (!pageState) {
      return this.prisma.group.findMany({
        where,
        select,
        orderBy: {
          createdAt: "desc",
        },
      });
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

  private async findOneWithPrisma(idOrCode: string) {
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
        group = {
          ...group,
          musyrif: parent.musyrif,
          nextActivity: parent.nextActivity,
          timeline: parent.timeline,
          itinerary: parent.itinerary,
          notes: parent.notes,
          checklistAssignments: parent.checklistAssignments,
        } as any;
      }
    }

    return group;
  }
}
