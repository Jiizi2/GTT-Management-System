import { BadRequestException, ConflictException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AgentPortalAccountAuditAction,
  AgentPortalUserStatus,
  AgentStatus,
  AgentType,
} from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import type { AgentRecord, AgentsService } from "./agents.service";
import { AgentPortalAccountsService } from "./agent-portal-accounts.service";

function createAgent(overrides: Partial<AgentRecord> = {}): AgentRecord {
  return {
    id: "agent_partner",
    code: "PARTNER-1",
    name: "Partner One",
    type: AgentType.PARTNER,
    status: AgentStatus.ACTIVE,
    picName: null,
    phone: null,
    email: null,
    address: null,
    notes: null,
    groupCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMemoryService(agent = createAgent()) {
  const config = { get: vi.fn((key: string) => key === "DATA_SOURCE" ? "memory" : undefined) };
  const agents = { findOne: vi.fn(async () => agent) };
  const service = new AgentPortalAccountsService(
    config as unknown as ConfigService,
    {} as PrismaService,
    agents as unknown as AgentsService,
  );
  return { service, agents };
}

const createInput = {
  agentId: "agent_partner",
  displayName: "Partner Operator",
  email: "Operator@Partner.Example",
  password: "PortalAccount#2026",
  actor: { id: "internal-super-admin" },
};

describe("AgentPortalAccountsService", () => {
  it("provisions an active Partner account without exposing credential metadata", async () => {
    const { service } = createMemoryService();

    const created = await service.create(createInput);

    expect(created).toMatchObject({
      agentId: "agent_partner",
      agentCode: "PARTNER-1",
      displayName: "Partner Operator",
      email: "operator@partner.example",
      status: AgentPortalUserStatus.ACTIVE,
      mustChangePassword: true,
    });
    expect(created).not.toHaveProperty("passwordHash");
    expect(created).not.toHaveProperty("tokenVersion");
    const auditLogs = (service as unknown as { memoryAuditLogs: Array<{ action: string }> }).memoryAuditLogs;
    expect(auditLogs.map((entry) => entry.action)).toEqual([AgentPortalAccountAuditAction.CREATED]);
  });

  it.each([
    createAgent({ type: AgentType.DIRECT }),
    createAgent({ status: AgentStatus.INACTIVE }),
  ])("rejects an ineligible Agent", async (agent) => {
    const { service } = createMemoryService(agent);

    await expect(service.create(createInput)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("normalizes identifiers and rejects duplicates", async () => {
    const { service } = createMemoryService();
    await service.create(createInput);

    await expect(service.create({ ...createInput, email: " operator@partner.example " }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it("disables, resets and revokes while keeping secrets out of responses", async () => {
    const { service } = createMemoryService();
    const created = await service.create(createInput);

    const disabled = await service.setStatus(
      created.id,
      AgentPortalUserStatus.DISABLED,
      createInput.actor,
    );
    const reset = await service.resetPassword(created.id, "Replacement#2026", createInput.actor);
    const revoked = await service.revoke(created.id, createInput.actor);

    expect(disabled.status).toBe(AgentPortalUserStatus.DISABLED);
    expect(reset.mustChangePassword).toBe(true);
    expect(revoked).not.toHaveProperty("passwordHash");
    expect(revoked).not.toHaveProperty("tokenVersion");
    const auditLogs = (service as unknown as { memoryAuditLogs: Array<{ action: string }> }).memoryAuditLogs;
    expect(auditLogs.map((entry) => entry.action)).toEqual([
      AgentPortalAccountAuditAction.REVOKED,
      AgentPortalAccountAuditAction.PASSWORD_RESET,
      AgentPortalAccountAuditAction.DISABLED,
      AgentPortalAccountAuditAction.CREATED,
    ]);
  });

  it("uses one Prisma transaction for account creation and its audit record", async () => {
    const agent = createAgent();
    const createdAt = new Date("2026-07-17T00:00:00.000Z");
    const tx = {
      agent: { findFirst: vi.fn(async (_args: unknown) => ({ id: agent.id })) },
      agentPortalUser: {
        create: vi.fn(async (_args: unknown) => ({
          id: "portal_user_1",
          agentId: agent.id,
          displayName: "Partner Operator",
          email: "operator@partner.example",
          status: AgentPortalUserStatus.ACTIVE,
          mustChangePassword: true,
          createdAt,
          updatedAt: createdAt,
          agent: { code: agent.code, name: agent.name },
        })),
      },
      agentPortalAccountAuditLog: { create: vi.fn(async (_args: unknown) => ({})) },
    };
    const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
    const config = { get: vi.fn((key: string) => key === "DATA_SOURCE" ? "prisma" : undefined) };
    const agents = { findOne: vi.fn(async () => agent) };
    const service = new AgentPortalAccountsService(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
      agents as unknown as AgentsService,
    );

    const created = await service.create(createInput);

    expect(created.id).toBe("portal_user_1");
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.agentPortalAccountAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        portalUserId: "portal_user_1",
        actorAuthUserId: "internal-super-admin",
        action: AgentPortalAccountAuditAction.CREATED,
      }),
    });
    const createCall = tx.agentPortalUser.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createCall.data.passwordHash).toEqual(expect.stringMatching(/^\$2/));
    expect(createCall.data).not.toHaveProperty("password");
  });
});
