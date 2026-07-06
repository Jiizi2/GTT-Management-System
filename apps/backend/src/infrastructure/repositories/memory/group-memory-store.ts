import { Injectable } from "@nestjs/common";
import { createDefaultMemoryGroups } from "../../../groups/infrastructure/groups.memory-store";
import type { MemoryGroupRecord, MemoryAuditLog } from "../../../groups/groups.service-types";

@Injectable()
export class GroupMemoryStore {
  readonly groups: MemoryGroupRecord[] = createDefaultMemoryGroups();
  readonly auditLogs: MemoryAuditLog[] = [];
}
