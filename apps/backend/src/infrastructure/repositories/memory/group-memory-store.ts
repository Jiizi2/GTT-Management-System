import { Injectable } from "@nestjs/common";
import { createDefaultMemoryGroups } from "./helpers/memory-group.helpers";
import type { MemoryGroupRecord, MemoryAuditLog } from "../../../groups/groups.service-types";

@Injectable()
export class GroupMemoryStore {
  readonly groups: MemoryGroupRecord[] = createDefaultMemoryGroups();
  readonly auditLogs: MemoryAuditLog[] = [];
}
