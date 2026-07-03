import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
import { GroupLifecycleStatus, GroupTone } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { CreateGroupDto } from "../dto/create-group.dto";
import { GroupsService } from "../application/groups.service";

type ContractGroupRecord = {
  id: string;
  code: string;
  name: string;
  status: string;
  lifecycleStatus: GroupLifecycleStatus;
  searchDocument: string;
  arrivalDate: Date;
  returnDate: Date;
  tone: GroupTone;
  pax: number;
  totalBuses?: number | null;
  packageName: string;
  durationDays: number;
  parentGroupId?: string | null;
  musyrif: unknown;
  nextActivity: unknown;
  timeline: unknown[];
  itinerary: unknown[];
  notes: unknown[];
  visaSetup?: unknown;
  checklistAssignments: unknown[];
  createdAt: Date;
  updatedAt: Date;
};

type ContractAuditLogRecord = {
  id: string;
  groupCode?: string | null;
  action: string;
  entity: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

type ContractHarness = {
  service: GroupsService;
  restore: () => void;
};

type ContractAdapter = {
  name: string;
  createHarness: () => Promise<ContractHarness>;
};

function createGroupPayload(overrides: Partial<CreateGroupDto> = {}): CreateGroupDto {
  return {
    code: "CTR-BASE",
    name: "Contract Base",
    status: "Active",
    arrivalDate: "2026-04-10",
    returnDate: "2026-04-18",
    pax: 40,
    packageName: "Contract Package",
    durationDays: 9,
    timeline: [],
    itinerary: [],
    notes: [],
    checklistAssignments: [],
    ...overrides,
  };
}

function restoreDataSource(previous: string | undefined): void {
  if (previous === undefined) {
    delete process.env.DATA_SOURCE;
    return;
  }

  process.env.DATA_SOURCE = previous;
}

async function createMemoryHarness(): Promise<ContractHarness> {
  const previous = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "memory";
  const service = new GroupsService({} as PrismaService);

  const existingGroups = await service.findAll();
  if (Array.isArray(existingGroups)) {
    for (const group of existingGroups) {
      const code = (group as { code?: unknown }).code;
      if (typeof code === "string" && code.trim()) {
        await service.remove(code);
      }
    }
  }

  return {
    service,
    restore: () => restoreDataSource(previous),
  };
}

function normalizeCodeLookup(value: string): string {
  return value.trim().toUpperCase();
}

function buildContractPrismaRecord(data: Record<string, unknown>, index: number): ContractGroupRecord {
  const now = new Date(Date.UTC(2026, 0, 1, 0, 0, index));
  return {
    id: `contract-prisma-group-${index + 1}`,
    code: String(data.code),
    name: String(data.name),
    status: String(data.status),
    lifecycleStatus: (data.lifecycleStatus as GroupLifecycleStatus | undefined) ?? GroupLifecycleStatus.ACTIVE,
    searchDocument: String(data.searchDocument ?? ""),
    arrivalDate: data.arrivalDate as Date,
    returnDate: data.returnDate as Date,
    tone: (data.tone as GroupTone | undefined) ?? GroupTone.ACTIVE,
    pax: Number(data.pax),
    totalBuses: data.totalBuses as number | null | undefined,
    packageName: String(data.packageName),
    durationDays: Number(data.durationDays),
    parentGroupId: (data.parentGroupId as string | null | undefined) ?? null,
    musyrif: null,
    nextActivity: null,
    timeline: [],
    itinerary: [],
    notes: [],
    visaSetup: undefined,
    checklistAssignments: [],
    createdAt: now,
    updatedAt: now,
  };
}

function matchesSearchDocumentCondition(group: ContractGroupRecord, condition: unknown): boolean {
  if (!condition || typeof condition !== "object") {
    return true;
  }

  const contains = (condition as { contains?: unknown }).contains;
  if (typeof contains !== "string") {
    return true;
  }

  return group.searchDocument.toLowerCase().includes(contains.toLowerCase());
}

function matchesWhere(group: ContractGroupRecord, where: unknown): boolean {
  if (!where || typeof where !== "object") {
    return true;
  }

  const record = where as Record<string, unknown>;

  if (Array.isArray(record.AND)) {
    return record.AND.every((condition) => matchesWhere(group, condition));
  }

  if (Array.isArray(record.OR)) {
    return record.OR.some((condition) => matchesWhere(group, condition));
  }

  if (typeof record.id === "string") {
    return group.id === record.id;
  }

  if (typeof record.code === "string") {
    return group.code === normalizeCodeLookup(record.code);
  }

  if (record.tone) {
    return group.tone === record.tone;
  }

  if (record.searchDocument) {
    return matchesSearchDocumentCondition(group, record.searchDocument);
  }

  return true;
}

function createContractPrismaService(): PrismaService {
  const groups: ContractGroupRecord[] = [];
  const auditLogs: ContractAuditLogRecord[] = [];

  const groupModel = {
    count: async (args: { where?: unknown } = {}) => groups.filter((group) => matchesWhere(group, args.where)).length,
    create: async (args: { data: Record<string, unknown> }) => {
      const group = buildContractPrismaRecord(args.data, groups.length);
      groups.unshift(group);
      return group;
    },
    findFirst: async (args: { where?: unknown } = {}) => groups.find((group) => matchesWhere(group, args.where)) ?? null,
    findMany: async (args: { where?: unknown; skip?: number; take?: number } = {}) => {
      const matched = groups
        .filter((group) => matchesWhere(group, args.where))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      const start = args.skip ?? 0;
      const end = typeof args.take === "number" ? start + args.take : undefined;
      return matched.slice(start, end);
    },
    findUnique: async (args: { where?: { code?: string; id?: string } } = {}) => {
      const code = args.where?.code;
      const id = args.where?.id;
      return groups.find((group) => (code ? group.code === normalizeCodeLookup(code) : group.id === id)) ?? null;
    },
    update: async (args: { where: { id: string }; data: Record<string, unknown> }) => {
      const group = groups.find((entry) => entry.id === args.where.id);
      if (!group) {
        throw new Error(`Contract Prisma group '${args.where.id}' not found.`);
      }

      for (const [key, value] of Object.entries(args.data)) {
        if (value !== undefined) {
          (group as unknown as Record<string, unknown>)[key] = value;
        }
      }
      group.updatedAt = new Date(group.updatedAt.getTime() + 1_000);
      return group;
    },
  };

  const groupAuditLogModel = {
    create: async (args: { data: { groupCode?: string | null; action: string; entity: string; payload?: unknown } }) => {
      const entry: ContractAuditLogRecord = {
        id: `contract-prisma-audit-${auditLogs.length + 1}`,
        groupCode: args.data.groupCode,
        action: args.data.action,
        entity: args.data.entity,
        payload:
          args.data.payload && typeof args.data.payload === "object" && !Array.isArray(args.data.payload)
            ? (args.data.payload as Record<string, unknown>)
            : {},
        createdAt: new Date(Date.UTC(2026, 0, 1, 1, 0, auditLogs.length)),
      };
      auditLogs.unshift(entry);
      return entry;
    },
    findMany: async (args: { where?: { groupCode?: string }; take?: number } = {}) => {
      const groupCode = args.where?.groupCode;
      const matched = groupCode ? auditLogs.filter((entry) => entry.groupCode === groupCode) : [...auditLogs];
      return typeof args.take === "number" ? matched.slice(0, args.take) : matched;
    },
  };

  return {
    group: groupModel,
    groupAuditLog: groupAuditLogModel,
    $transaction: async <T>(callback: (transactionClient: { group: typeof groupModel }) => Promise<T>) =>
      callback({ group: groupModel }),
  } as unknown as PrismaService;
}

async function createPrismaHarness(): Promise<ContractHarness> {
  const previous = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "prisma";

  return {
    service: new GroupsService(createContractPrismaService()),
    restore: () => restoreDataSource(previous),
  };
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function getItems(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }

  const items = (result as { items?: unknown }).items;
  return Array.isArray(items) ? items : [];
}

async function runGroupsContract(adapter: ContractAdapter): Promise<void> {
  const { service, restore } = await adapter.createHarness();

  try {
    const created = (await service.create(
      createGroupPayload({
        code: " ctr-alpha ",
        name: " Contract Alpha ",
        packageName: " Contract Gold ",
      }),
    )) as { code?: string; name?: string; arrivalDate?: unknown; returnDate?: unknown };

    expect(created.code).toBe("CTR-ALPHA");
    expect(created.name).toBe("Contract Alpha");
    expect(toIsoDate(created.arrivalDate)).toBe("2026-04-10");
    expect(toIsoDate(created.returnDate)).toBe("2026-04-18");

    await service.create(
      createGroupPayload({
        code: "CTR-BETA",
        name: "Contract Beta",
        status: "Inactive",
        tone: GroupTone.INACTIVE,
      }),
    );

    const updated = (await service.update("ctr-alpha", {
      name: " Contract Alpha Updated ",
      status: "Completed",
      returnDate: "2026-04-19",
    })) as { code?: string; name?: string; status?: string; returnDate?: unknown };

    expect(updated.code).toBe("CTR-ALPHA");
    expect(updated.name).toBe("Contract Alpha Updated");
    expect(updated.status).toBe("Completed");
    expect(toIsoDate(updated.returnDate)).toBe("2026-04-19");

    await expect(
      () => service.update("CTR-ALPHA", { arrivalDate: "2026-04-20", returnDate: "2026-04-19" })
    ).rejects.toThrow(/Return date must be on or after arrival date/i);

    const paged = (await service.findAll(undefined, { page: 1, pageSize: 1 })) as {
      items?: unknown[];
      total?: number;
      page?: number;
      pageSize?: number;
    };
    expect(Array.isArray(paged.items)).toBe(true);
    expect(paged.total).toBe(2);
    expect(paged.page).toBe(1);
    expect(paged.pageSize).toBe(1);

    const searched = await service.findAll("contract alpha updated");
    expect(getItems(searched).length).toBe(1);

    const activeOnly = await service.findAll(undefined, { activeOnly: true });
    expect(
      getItems(activeOnly).map((group) => (group as { code?: string }).code),
    ).toEqual(["CTR-ALPHA"]);

    const logs = await service.listAuditLogs("CTR-ALPHA");
    expect(
      logs.some((entry) => entry.action === "group.created"),
    ).toBe(true);
    expect(
      logs.some((entry) => entry.action === "group.updated"),
    ).toBe(true);
  } finally {
    restore();
  }
}

describe("GroupsAdapterContract", () => {
  const adapters: ContractAdapter[] = [
    { name: "memory", createHarness: createMemoryHarness },
    { name: "prisma", createHarness: createPrismaHarness },
  ];

  for (const adapter of adapters) {
    runCase(`groups adapter contract (${adapter.name})`, () => runGroupsContract(adapter));
  }
});
