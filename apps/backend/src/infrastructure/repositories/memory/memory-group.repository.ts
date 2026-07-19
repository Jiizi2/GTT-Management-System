import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { GroupRepository } from "../../../domain/repositories/group.repository";
import { GroupMemoryStore } from "./group-memory-store";
import { CreateGroupDto } from "../../../groups/dto/create-group.dto";
import { UpdateGroupDto } from "../../../groups/dto/update-group.dto";
import {
  UpsertGroupItineraryItemDto,
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
} from "../../../groups/groups.service-types";
import {
  findAllFromMemory,
  paginateGroupItems,
  projectMemoryGroupRecord,
  findOneFromMemory,
  createInMemory,
  replaceInMemory,
  updateInMemory,
  removeFromMemory,
  addItineraryItemInMemory,
  updateItineraryItemInMemory,
  removeItineraryItemInMemory,
  addVisaHotelAgreementInMemory,
  updateVisaHotelAgreementInMemory,
  removeVisaHotelAgreementInMemory,
  upsertPrimaryRaudhahAppointmentInMemory,
  confirmChecklistDriverInMemory,
  resetChecklistDriverInMemory,
} from "./helpers/memory-group.helpers";
import { randomUUID } from "node:crypto";
import { parseIsoDateOnly, validateTravelDateRangeOrThrow } from "../../../groups/domain/groups.shared";
import { validateCreateOrReplaceHotelAgreementRules } from "../../../groups/domain/groups.hotel-validation";

@Injectable()
export class MemoryGroupRepository implements GroupRepository {
  constructor(
    private readonly memoryStore: GroupMemoryStore,
  ) {}

  private validateCreateOrReplaceTravelDates(payload: CreateGroupDto): void {
    const normalizedArrivalDate = parseIsoDateOnly(payload.arrivalDate);
    const normalizedReturnDate = parseIsoDateOnly(payload.returnDate);
    validateTravelDateRangeOrThrow(normalizedArrivalDate, normalizedReturnDate);
  }

  async findAll(query?: string, options?: FindAllOptions): Promise<GroupListResult> {
    const projection = options?.projection ?? "detail";
    const source = findAllFromMemory(
      this.memoryStore.groups,
      query,
      options?.filter,
      options?.activeOnly ?? false,
    ).filter((group) => !options?.agentId || group.agentId === options.agentId)
      .map((group) => projectMemoryGroupRecord(group, projection));
    return paginateGroupItems(source, options);
  }

  async findOneByIdOrCode(idOrCode: string): Promise<GroupDetailRecord> {
    return findOneFromMemory(this.memoryStore.groups, idOrCode);
  }

  async listAuditLogs(groupCode?: string, limit?: number): Promise<MemoryAuditLog[]> {
    const normalizedCode = groupCode?.trim().toUpperCase();
    const sanitizedLimit =
      typeof limit === "number" && Number.isFinite(limit) && limit > 0
        ? Math.floor(limit)
        : undefined;

    let logs = [...this.memoryStore.auditLogs].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
    if (normalizedCode) {
      logs = logs.filter((entry) => entry.groupCode === normalizedCode);
    }
    if (sanitizedLimit) {
      logs = logs.slice(0, sanitizedLimit);
    }
    return logs;
  }

  async writeAuditLog(
    action: string,
    entity: string,
    detail: any,
    groupInfo?: any,
  ): Promise<void> {
    const code = groupInfo?.code || groupInfo?.groupCode || "";
    const entry: MemoryAuditLog = {
      id: `audit-${randomUUID()}`,
      groupCode: code.trim().toUpperCase(),
      action,
      entity,
      payload: typeof detail === "object" ? detail : { value: detail },
      createdAt: new Date().toISOString(),
    };
    this.memoryStore.auditLogs.unshift(entry);
    if (this.memoryStore.auditLogs.length > 500) {
      this.memoryStore.auditLogs.length = 500;
    }
  }

  async create(payload: CreateGroupDto): Promise<GroupDetailRecord> {
    this.validateCreateOrReplaceTravelDates(payload);
    validateCreateOrReplaceHotelAgreementRules(payload);
    this.assertParentAgentMatch(payload);
    return createInMemory(this.memoryStore.groups, payload);
  }

  async replace(idOrCode: string, payload: CreateGroupDto): Promise<GroupDetailRecord> {
    this.validateCreateOrReplaceTravelDates(payload);
    validateCreateOrReplaceHotelAgreementRules(payload);
    this.assertParentAgentMatch(payload);
    return replaceInMemory(this.memoryStore.groups, idOrCode, payload);
  }

  async update(idOrCode: string, payload: UpdateGroupDto): Promise<GroupDetailRecord> {
    return updateInMemory(this.memoryStore.groups, idOrCode, payload);
  }

  async remove(idOrCode: string): Promise<void> {
    removeFromMemory(this.memoryStore.groups, idOrCode);
  }

  async reassignAgent(idOrCode: string, agentId: string): Promise<GroupDetailRecord> {
    const group = findOneFromMemory(this.memoryStore.groups, idOrCode);
    if (group.parentGroupId) throw new BadRequestException("Reassign Agent harus dilakukan dari parent Group.");
    const familyIds = new Set([group.id, ...this.memoryStore.groups.filter((item) => item.parentGroupId === group.id).map((item) => item.id)]);
    this.memoryStore.groups.forEach((item) => { if (familyIds.has(item.id)) item.agentId = agentId; });
    return findOneFromMemory(this.memoryStore.groups, idOrCode);
  }

  async addItineraryItem(idOrCode: string, payload: UpsertGroupItineraryItemDto): Promise<GroupDetailRecord> {
    await this.ensureNotChildGroup(idOrCode, "itinerary");
    return addItineraryItemInMemory(this.memoryStore.groups, idOrCode, payload);
  }

  async updateItineraryItem(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<GroupDetailRecord> {
    await this.ensureNotChildGroup(idOrCode, "itinerary");
    return updateItineraryItemInMemory(this.memoryStore.groups, idOrCode, itemId, payload);
  }

  async removeItineraryItem(idOrCode: string, itemId: string): Promise<GroupDetailRecord> {
    await this.ensureNotChildGroup(idOrCode, "itinerary");
    return removeItineraryItemInMemory(this.memoryStore.groups, idOrCode, itemId);
  }

  async addVisaHotelAgreement(idOrCode: string, payload: UpsertGroupVisaHotelDto): Promise<GroupDetailRecord> {
    return addVisaHotelAgreementInMemory(this.memoryStore.groups, idOrCode, payload);
  }

  async updateVisaHotelAgreement(
    idOrCode: string,
    hotelId: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<GroupDetailRecord> {
    return updateVisaHotelAgreementInMemory(this.memoryStore.groups, idOrCode, hotelId, payload);
  }

  async removeVisaHotelAgreement(idOrCode: string, hotelId: string): Promise<GroupDetailRecord> {
    return removeVisaHotelAgreementInMemory(this.memoryStore.groups, idOrCode, hotelId);
  }

  async upsertPrimaryRaudhahAppointment(idOrCode: string, payload: UpsertGroupRaudhahDto): Promise<GroupDetailRecord> {
    return upsertPrimaryRaudhahAppointmentInMemory(this.memoryStore.groups, idOrCode, payload);
  }

  async confirmChecklistDriver(idOrCode: string, payload: ConfirmChecklistDriverDto): Promise<ChecklistAssignmentSyncResult> {
    await this.ensureNotChildGroup(idOrCode, "checklist");
    return confirmChecklistDriverInMemory(this.memoryStore.groups, idOrCode, payload);
  }

  async resetChecklistDriver(idOrCode: string, payload: ResetChecklistDriverDto): Promise<ChecklistAssignmentSyncResult> {
    await this.ensureNotChildGroup(idOrCode, "checklist");
    return resetChecklistDriverInMemory(this.memoryStore.groups, idOrCode, payload);
  }

  private async ensureNotChildGroup(idOrCode: string, context: string): Promise<void> {
    const group = await this.findOneByIdOrCode(idOrCode);
    if (group.parentGroupId) {
      throw new BadRequestException(
        `Grup '${group.code}' adalah child group. Silakan edit ${context} pada parent group.`,
      );
    }
  }

  private assertParentAgentMatch(payload: CreateGroupDto): void {
    if (!payload.parentGroupId) return;
    const key = payload.parentGroupId.trim().toUpperCase();
    const parent = this.memoryStore.groups.find((group) => group.id === payload.parentGroupId || group.code === key);
    if (parent && parent.agentId !== (payload.agentId?.trim() || "agent_gtt_direct")) {
      throw new BadRequestException("Parent Group dan Child Group harus berasal dari Agent yang sama.");
    }
  }
}
