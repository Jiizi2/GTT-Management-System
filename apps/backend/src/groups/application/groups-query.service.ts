import { Injectable, Inject } from "@nestjs/common";
import { GroupRepository } from "../../domain/repositories/group.repository";
import {
  FindAllOptions,
  GroupDetailRecord,
  GroupListResult,
  MemoryAuditLog,
} from "../groups.service-types";

@Injectable()
export class GroupsQueryService {
  constructor(
    @Inject("GroupRepository") private readonly groupRepo: GroupRepository,
  ) {}

  async findAll(query?: string, options?: FindAllOptions): Promise<GroupListResult> {
    return this.groupRepo.findAll(query, options);
  }

  async findOneByIdOrCode(idOrCode: string): Promise<GroupDetailRecord> {
    return this.groupRepo.findOneByIdOrCode(idOrCode);
  }

  async listAuditLogs(groupCode?: string, limit?: number): Promise<MemoryAuditLog[]> {
    return this.groupRepo.listAuditLogs(groupCode, limit);
  }
}
