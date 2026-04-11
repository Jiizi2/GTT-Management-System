import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { resolveConfiguredDataSource } from "../../config/app-config";
import { PrismaService } from "../../prisma/prisma.service";
import type { ConfirmChecklistDriverDto } from "../dto/confirm-checklist-driver.dto";
import type { CreateGroupDto } from "../dto/create-group.dto";
import type {
  UpsertGroupItineraryItemDto,
  UpsertGroupRaudhahDto,
  UpsertGroupVisaHotelDto,
} from "../dto/group-operations.dto";
import type { ResetChecklistDriverDto } from "../dto/reset-checklist-driver.dto";
import type { UpdateGroupDto } from "../dto/update-group.dto";
import { extractGroupCode, extractGroupId, sanitizeAuditPayloadValue } from "../infrastructure/groups.audit";
import { createDefaultMemoryGroups } from "../infrastructure/groups.memory-store";
import type {
  ChecklistAssignmentSyncResult,
  FindAllOptions,
  MemoryAuditLog,
  MemoryGroupRecord,
  PaginatedGroupList,
} from "../groups.service-types";
import { GroupsCommandService } from "./groups-command.service";
import { GroupsQueryService } from "./groups-query.service";

@Injectable()
export class GroupsService {
  private readonly dataSource: "memory" | "prisma";
  private readonly memoryGroups: MemoryGroupRecord[] = createDefaultMemoryGroups();
  private readonly auditLogs: MemoryAuditLog[] = [];
  private readonly queryService: GroupsQueryService;
  private readonly commandService: GroupsCommandService;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {
    this.dataSource = resolveConfiguredDataSource(this.configService);
    this.queryService = new GroupsQueryService(
      this.prisma,
      this.dataSource,
      this.memoryGroups,
      this.auditLogs,
    );
    this.commandService = new GroupsCommandService(this.prisma, this.dataSource, this.memoryGroups);
  }

  async findAll(
    query?: string,
    options?: FindAllOptions,
  ): Promise<unknown[] | PaginatedGroupList<unknown>> {
    return this.queryService.findAll(query, options);
  }

  async findOneByIdOrCode(idOrCode: string): Promise<unknown> {
    return this.queryService.findOneByIdOrCode(idOrCode);
  }

  async create(payload: CreateGroupDto): Promise<unknown> {
    const created = await this.commandService.create(payload);
    await this.writeAuditLog("group.created", "group", created, {
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
    });
    return created;
  }

  async replace(idOrCode: string, payload: CreateGroupDto): Promise<unknown> {
    const replaced = await this.commandService.replace(idOrCode, payload);
    await this.writeAuditLog("group.replaced", "group", replaced, {
      idOrCode,
      code: payload.code.trim().toUpperCase(),
    });
    return replaced;
  }

  async update(idOrCode: string, payload: UpdateGroupDto): Promise<unknown> {
    const updated = await this.commandService.update(idOrCode, payload);
    await this.writeAuditLog("group.updated", "group", updated, {
      idOrCode,
      updatedFields: Object.keys(payload),
    });
    return updated;
  }

  async remove(idOrCode: string): Promise<void> {
    const existing = await this.queryService.findOneByIdOrCode(idOrCode);
    await this.commandService.remove(idOrCode);
    await this.writeAuditLog("group.deleted", "group", existing, {
      idOrCode,
    });
  }

  async listAuditLogs(groupCode?: string, limit?: number): Promise<MemoryAuditLog[]> {
    return this.queryService.listAuditLogs(groupCode, limit);
  }

  async addItineraryItem(idOrCode: string, payload: UpsertGroupItineraryItemDto): Promise<unknown> {
    const updated = await this.commandService.addItineraryItem(idOrCode, payload);
    await this.writeAuditLog("itinerary.added", "itinerary", updated, {
      idOrCode,
      title: payload.title?.trim() || undefined,
      category: payload.category.trim(),
    });
    return updated;
  }

  async updateItineraryItem(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<unknown> {
    const updated = await this.commandService.updateItineraryItem(idOrCode, itemId, payload);
    await this.writeAuditLog("itinerary.updated", "itinerary", updated, {
      idOrCode,
      itemId,
      title: payload.title?.trim() || undefined,
    });
    return updated;
  }

  async removeItineraryItem(idOrCode: string, itemId: string): Promise<unknown> {
    const updated = await this.commandService.removeItineraryItem(idOrCode, itemId);
    await this.writeAuditLog("itinerary.deleted", "itinerary", updated, {
      idOrCode,
      itemId,
    });
    return updated;
  }

  async addVisaHotelAgreement(idOrCode: string, payload: UpsertGroupVisaHotelDto): Promise<unknown> {
    const updated = await this.commandService.addVisaHotelAgreement(idOrCode, payload);
    await this.writeAuditLog("visa.hotel.added", "visaHotelAgreement", updated, {
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
    const updated = await this.commandService.updateVisaHotelAgreement(idOrCode, hotelId, payload);
    await this.writeAuditLog("visa.hotel.updated", "visaHotelAgreement", updated, {
      idOrCode,
      hotelId,
      city: payload.city,
      agreementNumber: payload.agreementNumber.trim(),
    });
    return updated;
  }

  async removeVisaHotelAgreement(idOrCode: string, hotelId: string): Promise<unknown> {
    const updated = await this.commandService.removeVisaHotelAgreement(idOrCode, hotelId);
    await this.writeAuditLog("visa.hotel.deleted", "visaHotelAgreement", updated, {
      idOrCode,
      hotelId,
    });
    return updated;
  }

  async upsertPrimaryRaudhahAppointment(
    idOrCode: string,
    payload: UpsertGroupRaudhahDto,
  ): Promise<unknown> {
    const updated = await this.commandService.upsertPrimaryRaudhahAppointment(idOrCode, payload);
    await this.writeAuditLog("visa.raudhah.upserted", "raudhahAppointment", updated, {
      idOrCode,
      date: payload.date,
      status: payload.status,
      tasrehPrinted: payload.tasrehPrinted ?? false,
    });
    return updated;
  }

  async confirmChecklistDriver(
    idOrCode: string,
    payload: ConfirmChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    const confirmed = await this.commandService.confirmChecklistDriver(idOrCode, payload);
    await this.writeAuditLog("checklist.driver.confirmed", "checklistAssignment", confirmed, {
      idOrCode,
      assignmentId: confirmed.id,
      tripDate: confirmed.tripDate,
      activity: confirmed.activity,
      scheduledTime: confirmed.scheduledTime,
      slotCount: confirmed.drivers.length,
    });
    return confirmed;
  }

  async resetChecklistDriver(
    idOrCode: string,
    payload: ResetChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    const resetResult = await this.commandService.resetChecklistDriver(idOrCode, payload);
    await this.writeAuditLog("checklist.driver.reset", "checklistAssignment", resetResult, {
      idOrCode,
      assignmentId: resetResult.id,
      tripDate: resetResult.tripDate,
      activity: payload.activity?.trim(),
      scheduledTime: resetResult.scheduledTime,
    });
    return resetResult;
  }

  private async writeAuditLog(
    action: string,
    entity: string,
    group: unknown,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (this.dataSource === "prisma") {
      await this.writeAuditLogWithPrisma(action, entity, group, payload);
      return;
    }

    this.pushAuditLog(action, entity, extractGroupCode(group), payload);
  }

  private async writeAuditLogWithPrisma(
    action: string,
    entity: string,
    group: unknown,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.groupAuditLog.create({
      data: {
        groupId: extractGroupId(group),
        groupCode: extractGroupCode(group),
        action,
        entity,
        payload: sanitizeAuditPayloadValue(payload) as Prisma.InputJsonValue,
      },
    });
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
}
