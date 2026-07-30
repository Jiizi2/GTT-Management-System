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
import { AgentsService, GTT_DIRECT_AGENT_ID } from "../../agents/agents.service";

@Injectable()
export class HotelAgreementDraftsService {
  constructor(
    @Inject("HotelAgreementDraftRepository")
    private agreementDraftRepo: HotelAgreementDraftRepository,
    private readonly groupsService?: GroupsService,
    private readonly configService?: ConfigService,
    private readonly agentsService?: AgentsService,
  ) {}

  async findAll(query?: string, rawStatus?: string, agentId?: string): Promise<unknown[]> {
    return this.agreementDraftRepo.findAll(query, rawStatus, agentId);
  }

  async create(payload: UpsertHotelAgreementDraftDto): Promise<unknown> {
    const normalized = await this.withActiveAgent(payload);
    return this.agreementDraftRepo.create(normalized);
  }

  async update(
    draftId: string,
    payload: UpsertHotelAgreementDraftDto,
  ): Promise<unknown> {
    const normalized = await this.withActiveAgent(payload);
    return this.agreementDraftRepo.update(draftId, normalized);
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

  private async withActiveAgent(payload: UpsertHotelAgreementDraftDto): Promise<UpsertHotelAgreementDraftDto> {
    const agentId = payload.agentId?.trim() || GTT_DIRECT_AGENT_ID;
    if (this.agentsService) await this.agentsService.assertActive(agentId);
    return { ...payload, agentId };
  }
}
