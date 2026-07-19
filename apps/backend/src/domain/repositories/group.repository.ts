import { CreateGroupDto } from "../../groups/dto/create-group.dto";
import { UpdateGroupDto } from "../../groups/dto/update-group.dto";
import {
  UpsertGroupItineraryItemDto,
  UpsertGroupVisaHotelDto,
  UpsertGroupRaudhahDto,
} from "../../groups/dto/group-operations.dto";
import { ConfirmChecklistDriverDto } from "../../groups/dto/confirm-checklist-driver.dto";
import { ResetChecklistDriverDto } from "../../groups/dto/reset-checklist-driver.dto";
import {
  FindAllOptions,
  GroupDetailRecord,
  GroupListResult,
  MemoryAuditLog,
  ChecklistAssignmentSyncResult,
} from "../../groups/groups.service-types";

export interface GroupRepository {
  findAll(query?: string, options?: FindAllOptions): Promise<GroupListResult>;
  findOneByIdOrCode(idOrCode: string): Promise<GroupDetailRecord>;
  listAuditLogs(groupCode?: string, limit?: number): Promise<MemoryAuditLog[]>;
  writeAuditLog(
    action: string,
    entity: string,
    detail: any,
    groupInfo?: any,
  ): Promise<void>;
  create(payload: CreateGroupDto): Promise<GroupDetailRecord>;
  replace(idOrCode: string, payload: CreateGroupDto): Promise<GroupDetailRecord>;
  update(idOrCode: string, payload: UpdateGroupDto): Promise<GroupDetailRecord>;
  remove(idOrCode: string): Promise<void>;
  reassignAgent(idOrCode: string, agentId: string): Promise<GroupDetailRecord>;
  addItineraryItem(idOrCode: string, payload: UpsertGroupItineraryItemDto): Promise<GroupDetailRecord>;
  updateItineraryItem(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<GroupDetailRecord>;
  removeItineraryItem(idOrCode: string, itemId: string): Promise<GroupDetailRecord>;
  addVisaHotelAgreement(idOrCode: string, payload: UpsertGroupVisaHotelDto): Promise<GroupDetailRecord>;
  updateVisaHotelAgreement(
    idOrCode: string,
    hotelId: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<GroupDetailRecord>;
  removeVisaHotelAgreement(idOrCode: string, hotelId: string): Promise<GroupDetailRecord>;
  upsertPrimaryRaudhahAppointment(idOrCode: string, payload: UpsertGroupRaudhahDto): Promise<GroupDetailRecord>;
  confirmChecklistDriver(idOrCode: string, payload: ConfirmChecklistDriverDto): Promise<ChecklistAssignmentSyncResult>;
  resetChecklistDriver(idOrCode: string, payload: ResetChecklistDriverDto): Promise<ChecklistAssignmentSyncResult>;
}
