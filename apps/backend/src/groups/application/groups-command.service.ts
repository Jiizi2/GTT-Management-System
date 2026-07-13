import { Injectable, Inject } from "@nestjs/common";
import { GroupRepository } from "../../domain/repositories/group.repository";
import { CreateGroupDto } from "../dto/create-group.dto";
import { UpdateGroupDto } from "../dto/update-group.dto";
import {
  UpsertGroupItineraryItemDto,
  UpsertGroupVisaHotelDto,
  UpsertGroupRaudhahDto,
} from "../dto/group-operations.dto";
import { ConfirmChecklistDriverDto } from "../dto/confirm-checklist-driver.dto";
import { ResetChecklistDriverDto } from "../dto/reset-checklist-driver.dto";
import { GroupDetailRecord, ChecklistAssignmentSyncResult } from "../groups.service-types";

@Injectable()
export class GroupsCommandService {
  constructor(
    @Inject("GroupRepository") private readonly groupRepo: GroupRepository,
  ) {}

  async create(payload: CreateGroupDto): Promise<GroupDetailRecord> {
    return this.groupRepo.create(payload);
  }

  async replace(idOrCode: string, payload: CreateGroupDto): Promise<GroupDetailRecord> {
    return this.groupRepo.replace(idOrCode, payload);
  }

  async update(idOrCode: string, payload: UpdateGroupDto): Promise<GroupDetailRecord> {
    return this.groupRepo.update(idOrCode, payload);
  }

  async remove(idOrCode: string): Promise<void> {
    return this.groupRepo.remove(idOrCode);
  }

  async addItineraryItem(idOrCode: string, payload: UpsertGroupItineraryItemDto): Promise<GroupDetailRecord> {
    return this.groupRepo.addItineraryItem(idOrCode, payload);
  }

  async updateItineraryItem(
    idOrCode: string,
    itemId: string,
    payload: UpsertGroupItineraryItemDto,
  ): Promise<GroupDetailRecord> {
    return this.groupRepo.updateItineraryItem(idOrCode, itemId, payload);
  }

  async removeItineraryItem(idOrCode: string, itemId: string): Promise<GroupDetailRecord> {
    return this.groupRepo.removeItineraryItem(idOrCode, itemId);
  }

  async addVisaHotelAgreement(idOrCode: string, payload: UpsertGroupVisaHotelDto): Promise<GroupDetailRecord> {
    return this.groupRepo.addVisaHotelAgreement(idOrCode, payload);
  }

  async updateVisaHotelAgreement(
    idOrCode: string,
    hotelId: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<GroupDetailRecord> {
    return this.groupRepo.updateVisaHotelAgreement(idOrCode, hotelId, payload);
  }

  async removeVisaHotelAgreement(idOrCode: string, hotelId: string): Promise<GroupDetailRecord> {
    return this.groupRepo.removeVisaHotelAgreement(idOrCode, hotelId);
  }

  async upsertPrimaryRaudhahAppointment(idOrCode: string, payload: UpsertGroupRaudhahDto): Promise<GroupDetailRecord> {
    return this.groupRepo.upsertPrimaryRaudhahAppointment(idOrCode, payload);
  }

  async confirmChecklistDriver(idOrCode: string, payload: ConfirmChecklistDriverDto): Promise<ChecklistAssignmentSyncResult> {
    return this.groupRepo.confirmChecklistDriver(idOrCode, payload);
  }

  async resetChecklistDriver(idOrCode: string, payload: ResetChecklistDriverDto): Promise<ChecklistAssignmentSyncResult> {
    return this.groupRepo.resetChecklistDriver(idOrCode, payload);
  }
}
