import { Injectable, Inject } from "@nestjs/common";
import { HotelAgreementDraftRepository } from "../../domain/repositories/hotel-agreement-draft.repository";
import {
  UpsertHotelAgreementDraftDto,
  AssignHotelAgreementDraftDto,
} from "../dto/hotel-agreement-draft.dto";

import { GroupsService } from "./groups.service";
import { resolveConfiguredDataSource } from "../../config/app-config";
import { ConfigService } from "@nestjs/config";

import { PrismaHotelAgreementDraftRepository } from "../../infrastructure/repositories/prisma/prisma-hotel-agreement-draft.repository";
import { MemoryHotelAgreementDraftRepository } from "../../infrastructure/repositories/memory/memory-hotel-agreement-draft.repository";

@Injectable()
export class HotelAgreementDraftsService {
  constructor(
    @Inject("HotelAgreementDraftRepository")
    private agreementDraftRepo: HotelAgreementDraftRepository,
    private readonly groupsService?: GroupsService,
    private readonly configService?: ConfigService,
  ) {}

  get memoryDrafts() {
    if (this.agreementDraftRepo && "memoryDrafts" in this.agreementDraftRepo) {
      return (this.agreementDraftRepo as any).memoryDrafts;
    }
    return undefined;
  }

  async findAll(query?: string, rawStatus?: string): Promise<unknown[]> {
    return this.agreementDraftRepo.findAll(query, rawStatus);
  }

  async create(payload: UpsertHotelAgreementDraftDto): Promise<unknown> {
    return this.agreementDraftRepo.create(payload);
  }

  async update(
    draftId: string,
    payload: UpsertHotelAgreementDraftDto,
  ): Promise<unknown> {
    return this.agreementDraftRepo.update(draftId, payload);
  }

  async remove(draftId: string): Promise<void> {
    return this.agreementDraftRepo.remove(draftId);
  }

  async assign(
    draftId: string,
    payload: AssignHotelAgreementDraftDto,
  ): Promise<unknown> {
    return this.agreementDraftRepo.assign(draftId, payload);
  }

  async unassign(draftId: string, groupCode?: string): Promise<unknown> {
    return this.agreementDraftRepo.unassign(draftId, groupCode);
  }
}
