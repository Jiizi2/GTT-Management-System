import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { GroupLifecycleStatus, GroupTone } from "@prisma/client";
import { createStructuredLogger } from "../../logging/create-structured-logger";
import type { ConfirmChecklistDriverDto } from "../dto/confirm-checklist-driver.dto";
import type { CreateGroupIdentityDto } from "../dto/create-group-identity.dto";
import type { CreateGroupDto } from "../dto/create-group.dto";
import type {
  UpsertGroupItineraryItemDto,
  UpsertGroupRaudhahDto,
  UpsertGroupVisaHotelDto,
} from "../dto/group-operations.dto";
import type { ResetChecklistDriverDto } from "../dto/reset-checklist-driver.dto";
import type { UpdateGroupDto } from "../dto/update-group.dto";
import {
  extractGroupCode,
  extractGroupId,
} from "../domain/groups.shared";
import type {
  ChecklistAssignmentSyncResult,
  FindAllOptions,
  GroupDetailRecord,
  GroupListResult,
  MemoryAuditLog,
  MemoryGroupRecord,
} from "../groups.service-types";
import { GroupsCommandService } from "./groups-command.service";
import { GroupsQueryService } from "./groups-query.service";

import { ConfigService } from "@nestjs/config";
import { resolveConfiguredDataSource } from "../../config/app-config";
import { GroupRepository } from "../../domain/repositories/group.repository";

@Injectable()
export class GroupsService {
  public readonly dataSource: "memory" | "prisma";
  private readonly logger = createStructuredLogger(GroupsService.name);
  private readonly queryService: GroupsQueryService;
  private readonly commandService: GroupsCommandService;

  constructor(
    @Inject("GroupRepository") private readonly groupRepo: GroupRepository,
    private readonly configService?: ConfigService,
  ) {
    this.dataSource = resolveConfiguredDataSource(this.configService);

    this.queryService = new GroupsQueryService(this.groupRepo);
    this.commandService = new GroupsCommandService(this.groupRepo);
  }

  async findAll(
    query?: string,
    options?: FindAllOptions,
  ): Promise<GroupListResult> {
    return this.queryService.findAll(query, options);
  }

  async findOneByIdOrCode(idOrCode: string): Promise<GroupDetailRecord> {
    return this.queryService.findOneByIdOrCode(idOrCode);
  }

  async create(payload: CreateGroupDto): Promise<GroupDetailRecord> {
    const created = await this.commandService.create(payload);
    await this.writeAuditLog("group.created", "group", created, {
      code: payload.code.trim().toUpperCase(),
      name: payload.name.trim(),
    });
    this.logMutation("group.created", created, {
      packageName: payload.packageName.trim(),
      pax: payload.pax,
    });
    return created;
  }

  async createIdentity(payload: CreateGroupIdentityDto): Promise<GroupDetailRecord> {
    const createPayload = this.buildIdentityCreatePayload(payload);
    const created = await this.commandService.create(createPayload);
    await this.writeAuditLog("group.identity.created", "group", created, {
      code: createPayload.code,
      name: createPayload.name,
    });
    this.logMutation("group.identity.created", created, {
      packageName: createPayload.packageName,
      pax: createPayload.pax,
    });
    return created;
  }

  async replace(idOrCode: string, payload: CreateGroupDto): Promise<GroupDetailRecord> {
    const replaced = await this.commandService.replace(idOrCode, payload);
    await this.writeAuditLog("group.replaced", "group", replaced, {
      idOrCode,
      code: payload.code.trim().toUpperCase(),
    });
    this.logMutation("group.replaced", replaced, {
      idOrCode,
      packageName: payload.packageName.trim(),
    });
    return replaced;
  }

  async update(idOrCode: string, payload: UpdateGroupDto): Promise<GroupDetailRecord> {
    const updated = await this.commandService.update(idOrCode, payload);
    await this.writeAuditLog("group.updated", "group", updated, {
      idOrCode,
      updatedFields: Object.keys(payload),
    });
    this.logMutation("group.updated", updated, {
      idOrCode,
      updatedFields: Object.keys(payload),
    });
    return updated;
  }

  async remove(idOrCode: string): Promise<void> {
    const existing = await this.queryService.findOneByIdOrCode(idOrCode);
    await this.commandService.remove(idOrCode);
    const auditGroupIdentity = {
      groupCode: extractGroupCode(existing),
    };
    await this.writeAuditLog("group.deleted", "group", auditGroupIdentity, {
      idOrCode,
    });
    this.logMutation("group.deleted", auditGroupIdentity, {
      idOrCode,
    });
  }

  async listAuditLogs(
    groupCode?: string,
    limit?: number,
  ): Promise<MemoryAuditLog[]> {
    return this.queryService.listAuditLogs(groupCode, limit);
  }

  async addItineraryItem(
    idOrCode: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<GroupDetailRecord> {
    const updated = await this.commandService.addItineraryItem(
      idOrCode,
      payload,
    );
    await this.writeAuditLog("itinerary.added", "itinerary", updated, {
      idOrCode,
      title: payload.title?.trim() || undefined,
      category: payload.category.trim(),
    });
    this.logMutation("itinerary.added", updated, {
      idOrCode,
      category: payload.category.trim(),
    });
    return updated;
  }

  async updateItineraryItem(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<GroupDetailRecord> {
    const updated = await this.commandService.updateItineraryItem(
      idOrCode,
      itemId,
      payload,
    );
    await this.writeAuditLog("itinerary.updated", "itinerary", updated, {
      idOrCode,
      itemId,
      title: payload.title?.trim() || undefined,
    });
    this.logMutation("itinerary.updated", updated, {
      idOrCode,
      itemId,
      category: payload.category.trim(),
    });
    return updated;
  }

  async removeItineraryItem(
    idOrCode: string,
    itemId: string,
  ): Promise<GroupDetailRecord> {
    const updated = await this.commandService.removeItineraryItem(
      idOrCode,
      itemId,
    );
    await this.writeAuditLog("itinerary.deleted", "itinerary", updated, {
      idOrCode,
      itemId,
    });
    this.logMutation("itinerary.deleted", updated, {
      idOrCode,
      itemId,
    });
    return updated;
  }

  async addVisaHotelAgreement(
    idOrCode: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<GroupDetailRecord> {
    const updated = await this.commandService.addVisaHotelAgreement(
      idOrCode,
      payload,
    );
    await this.writeAuditLog(
      "visa.hotel.added",
      "visaHotelAgreement",
      updated,
      {
        idOrCode,
        city: payload.city,
        agreementNumber: payload.agreementNumber.trim(),
      },
    );
    this.logMutation("visa.hotel.added", updated, {
      idOrCode,
      city: payload.city,
    });
    return updated;
  }

  async updateVisaHotelAgreement(
    idOrCode: string,
    hotelId: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<GroupDetailRecord> {
    const updated = await this.commandService.updateVisaHotelAgreement(
      idOrCode,
      hotelId,
      payload,
    );
    await this.writeAuditLog(
      "visa.hotel.updated",
      "visaHotelAgreement",
      updated,
      {
        idOrCode,
        hotelId,
        city: payload.city,
        agreementNumber: payload.agreementNumber.trim(),
      },
    );
    this.logMutation("visa.hotel.updated", updated, {
      idOrCode,
      hotelId,
      city: payload.city,
    });
    return updated;
  }

  async removeVisaHotelAgreement(
    idOrCode: string,
    hotelId: string,
  ): Promise<GroupDetailRecord> {
    const updated = await this.commandService.removeVisaHotelAgreement(
      idOrCode,
      hotelId,
    );
    await this.writeAuditLog(
      "visa.hotel.deleted",
      "visaHotelAgreement",
      updated,
      {
        idOrCode,
        hotelId,
      },
    );
    this.logMutation("visa.hotel.deleted", updated, {
      idOrCode,
      hotelId,
    });
    return updated;
  }

  async upsertPrimaryRaudhahAppointment(
    idOrCode: string,
    payload: UpsertGroupRaudhahDto,
  ): Promise<GroupDetailRecord> {
    const updated = await this.commandService.upsertPrimaryRaudhahAppointment(
      idOrCode,
      payload,
    );
    await this.writeAuditLog(
      "visa.raudhah.upserted",
      "raudhahAppointment",
      updated,
      {
        idOrCode,
        date: payload.date,
        status: payload.status,
        tasrehPrinted: payload.tasrehPrinted ?? false,
      },
    );
    this.logMutation("visa.raudhah.upserted", updated, {
      idOrCode,
      date: payload.date,
      status: payload.status ?? "FREE",
    });
    return updated;
  }

  async confirmChecklistDriver(
    idOrCode: string,
    payload: ConfirmChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    const confirmed = await this.commandService.confirmChecklistDriver(
      idOrCode,
      payload,
    );
    const auditGroupIdentity = {
      groupCode: confirmed.groupCode,
    };
    await this.writeAuditLog(
      "checklist.driver.confirmed",
      "checklistAssignment",
      auditGroupIdentity,
      {
        idOrCode,
        assignmentId: confirmed.id,
        tripDate: confirmed.tripDate,
        activity: confirmed.activity,
        scheduledTime: confirmed.scheduledTime,
        slotCount: confirmed.drivers.length,
      },
    );
    this.logMutation("checklist.driver.confirmed", auditGroupIdentity, {
      idOrCode,
      assignmentId: confirmed.id,
      slotCount: confirmed.drivers.length,
      requiredBusCount: confirmed.requiredBusCount,
    });
    return confirmed;
  }

  async resetChecklistDriver(
    idOrCode: string,
    payload: ResetChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    const resetResult = await this.commandService.resetChecklistDriver(
      idOrCode,
      payload,
    );
    const auditGroupIdentity = {
      groupCode: resetResult.groupCode,
    };
    await this.writeAuditLog(
      "checklist.driver.reset",
      "checklistAssignment",
      auditGroupIdentity,
      {
        idOrCode,
        assignmentId: resetResult.id,
        tripDate: resetResult.tripDate,
        activity: payload.activity?.trim(),
        scheduledTime: resetResult.scheduledTime,
      },
    );
    this.logMutation("checklist.driver.reset", auditGroupIdentity, {
      idOrCode,
      assignmentId: resetResult.id,
      scheduledTime: resetResult.scheduledTime,
    });
    return resetResult;
  }

  private logMutation(
    action: string,
    group: unknown,
    details: Record<string, unknown>,
  ): void {
    this.logger.info(
      {
        action,
        dataSource: this.dataSource,
        groupCode: extractGroupCode(group),
        groupId: extractGroupId(group),
        ...details,
      },
      "Groups mutation completed.",
    );
  }

  private buildIdentityCreatePayload(
    payload: CreateGroupIdentityDto,
  ): CreateGroupDto {
    const normalizedCode = payload.code.trim().toUpperCase();
    const todayIso = new Date().toISOString().slice(0, 10);
    const arrivalDate = payload.arrivalDate?.trim() || todayIso;
    const durationDays = Math.max(1, payload.durationDays ?? 1);
    const returnDate =
      payload.returnDate?.trim() ||
      this.addDaysToIsoDate(arrivalDate, durationDays - 1);
    const groupName = payload.name?.trim() || `Group ${normalizedCode}`;
    const packageName = payload.packageName?.trim() || "Pending Package";

    return {
      code: normalizedCode,
      name: groupName,
      status: "Entry Only",
      lifecycleStatus: GroupLifecycleStatus.ENTRY_ONLY,
      arrivalDate,
      returnDate,
      tone: GroupTone.ACTIVE,
      pax: payload.pax ?? 1,
      totalBuses: payload.totalBuses,
      packageName,
      durationDays,
      musyrif: payload.musyrif
        ? {
            name: payload.musyrif.name.trim(),
            phone: payload.musyrif.phone.trim(),
            avatar: payload.musyrif.avatar.trim(),
          }
        : {
            name: "Unassigned Musyrif",
            phone: "-",
            avatar: "https://i.pravatar.cc/96?img=12",
          },
      nextActivity: {
        title: "Complete group workspace",
        dateLabel: this.formatDateLabel(arrivalDate),
        timeLabel: "09:00",
        icon: "pending_actions",
      },
      timeline: [
        {
          sortOrder: 0,
          dateLabel: this.formatDateLabel(arrivalDate),
          title: "Group identity created",
        },
        {
          sortOrder: 1,
          dateLabel: this.formatDateLabel(returnDate),
          title: "Agreement and itinerary pending",
          isCurrent: true,
          nextActivity: "Link agreement and create itinerary",
        },
      ],
      itinerary: [],
      notes: [
        {
          sortOrder: 0,
          text: "Group workspace created from identity entry. Agreement and itinerary can be linked later.",
        },
        ...(payload.busStatus
          ? [
              {
                sortOrder: 1,
                text: `Bus status: ${payload.busStatus}`,
              },
            ]
          : []),
      ],
      checklistAssignments: [],
    };
  }

  private addDaysToIsoDate(isoDate: string, dayOffset: number): string {
    const parsedDate = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      return new Date().toISOString().slice(0, 10);
    }

    parsedDate.setUTCDate(parsedDate.getUTCDate() + dayOffset);
    return parsedDate.toISOString().slice(0, 10);
  }

  private formatDateLabel(isoDate: string): string {
    const parsedDate = new Date(`${isoDate.slice(0, 10)}T12:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime())) {
      return "-";
    }

    return parsedDate.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  }

  private async writeAuditLog(
    action: string,
    entity: string,
    group: unknown,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.groupRepo.writeAuditLog(action, entity, payload, group);
  }
}
