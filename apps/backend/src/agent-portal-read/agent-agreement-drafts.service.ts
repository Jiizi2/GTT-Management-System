import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { HotelAgreementDraftRepository } from "../domain/repositories/hotel-agreement-draft.repository";
import { DirectoryService } from "../directory/directory.service";
import { projectHotelAgreementDraftMetadata } from "../groups/application/hotel-agreement-draft-projection";

type DraftProjection = {
  id: string;
  muassasahId?: string | null;
  city: string;
  hotelName: string;
  agreementNumber: string;
  groupName: string;
  pax: number;
  status: string;
  stayStart: string;
  stayEnd: string;
  remainingPax: number;
  assignedGroups: Array<{
    groupCode: string;
    pax: number;
    stayStart?: string;
    stayEnd?: string;
  }>;
  assignmentStatus: string;
  hasAllocations?: boolean;
};

@Injectable()
export class AgentAgreementDraftsService {
  constructor(
    @Inject("HotelAgreementDraftRepository")
    private readonly repository: HotelAgreementDraftRepository,
    private readonly directory: DirectoryService,
  ) {}

  async list(agentId: string, q?: string) {
    return this.projectMany(await this.repository.findForAgent(agentId, q));
  }
  async detail(agentId: string, id: string) {
    const draft = (await this.repository.findForAgent(agentId)).find(
      (item) => (item as DraftProjection).id === id,
    );
    if (!draft) throw new NotFoundException("RESOURCE_NOT_FOUND");
    return (await this.projectMany([draft]))[0];
  }
  async create(): Promise<never> {
    throw new ForbiddenException("Pembuatan agreement dilakukan oleh Admin.");
  }
  async update(): Promise<never> {
    throw new ForbiddenException("Perubahan agreement dilakukan oleh Admin.");
  }
  private async projectMany(drafts: unknown[]) {
    const muassasahIds = drafts.flatMap((value) => {
      const id = (value as DraftProjection).muassasahId;
      return id ? [id] : [];
    });
    const names = await this.directory.resolveMuassasahNames(muassasahIds);
    return drafts.map((draft) => this.project(draft, names));
  }
  private project(value: unknown, names: ReadonlyMap<string, string>) {
    const draft = value as DraftProjection;
    return {
      id: draft.id,
      city: draft.city,
      hotelName: draft.hotelName,
      agreementNumber: draft.agreementNumber,
      groupName: draft.groupName,
      pax: draft.pax,
      status: draft.status,
      stayStart: draft.stayStart,
      stayEnd: draft.stayEnd,
      remainingPax: draft.remainingPax,
      ...projectHotelAgreementDraftMetadata(draft, names),
      assignedGroups: draft.assignedGroups.map(
        ({ groupCode, pax, stayStart, stayEnd }) => ({
          groupCode,
          pax,
          stayStart,
          stayEnd,
        }),
      ),
      editable: false,
    };
  }
}
