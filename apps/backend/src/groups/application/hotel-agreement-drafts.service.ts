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
import { DirectoryService } from "../../directory/directory.service";
import { projectHotelAgreementDraftMetadata, type HotelAgreementDraftMetadata } from "./hotel-agreement-draft-projection";

@Injectable()
export class HotelAgreementDraftsService {
  constructor(
    @Inject("HotelAgreementDraftRepository")
    private agreementDraftRepo: HotelAgreementDraftRepository,
    private readonly groupsService?: GroupsService,
    private readonly configService?: ConfigService,
    private readonly agentsService?: AgentsService,
    private readonly directoryService?: DirectoryService,
  ) {}

  async findAll(query?: string, rawStatus?: string, agentId?: string): Promise<unknown[]> {
    return this.withMuassasah(await this.agreementDraftRepo.findAll(query, rawStatus, agentId));
  }

  async create(payload: UpsertHotelAgreementDraftDto): Promise<unknown> {
    const normalized = await this.withActiveAgent(payload);
    return (await this.withMuassasah([await this.agreementDraftRepo.create(normalized)]))[0];
  }

  async update(
    draftId: string,
    payload: UpsertHotelAgreementDraftDto,
  ): Promise<unknown> {
    const normalized = await this.withActiveAgent(payload);
    return (await this.withMuassasah([await this.agreementDraftRepo.update(draftId, normalized)]))[0];
  }

  async remove(draftId: string): Promise<void> {
    return this.agreementDraftRepo.remove(draftId);
  }

  async assign(
    draftId: string,
    payload: AssignHotelAgreementDraftDto,
  ): Promise<unknown> {
    return (await this.withMuassasah([await this.agreementDraftRepo.assign(draftId, payload)]))[0];
  }

  async unassign(draftId: string, groupCode?: string): Promise<unknown> {
    return (await this.withMuassasah([await this.agreementDraftRepo.unassign(draftId, groupCode)]))[0];
  }

  private async withActiveAgent(payload: UpsertHotelAgreementDraftDto): Promise<UpsertHotelAgreementDraftDto> {
    const agentId = payload.agentId?.trim() || GTT_DIRECT_AGENT_ID;
    if (this.agentsService) await this.agentsService.assertActive(agentId);
    if (this.directoryService && payload.muassasahId !== undefined) {
      const muassasahId = await this.directoryService.assertMuassasahExists(payload.muassasahId);
      return { ...payload, agentId, muassasahId };
    }
    return { ...payload, agentId };
  }

  private async withMuassasah(drafts: unknown[]): Promise<unknown[]> {
    const muassasahIds = drafts.flatMap((value) => {
      const id = (value as HotelAgreementDraftMetadata).muassasahId;
      return id ? [id] : [];
    });
    const muassasahNames = await this.directoryService?.resolveMuassasahNames(muassasahIds);
    return drafts.map((value) => {
      const draft = value as HotelAgreementDraftMetadata;
      return {
        ...draft,
        ...projectHotelAgreementDraftMetadata(draft, muassasahNames),
      };
    });
  }
}
