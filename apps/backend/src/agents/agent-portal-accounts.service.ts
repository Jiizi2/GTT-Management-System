import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AgentPortalAccountAuditAction,
  AgentPortalUserStatus,
  AgentStatus,
  AgentType,
  Prisma,
} from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { hashAuthPasswordAsync } from "../auth/auth-password";
import { resolveConfiguredDataSource } from "../config/app-config";
import { PrismaService } from "../prisma/prisma.service";
import { AgentsService, type AgentRecord } from "./agents.service";

export type AgentPortalAccountView = {
  id: string;
  agentId: string;
  agentCode: string;
  agentName: string;
  displayName: string;
  email: string;
  status: AgentPortalUserStatus;
  mustChangePassword: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type AgentPortalAuthenticationRecord = AgentPortalAccountView & {
  normalizedIdentifier: string;
  passwordHash: string;
  tokenVersion: number;
  agentType: AgentType;
  agentStatus: AgentStatus;
};

type MemoryAgentPortalAccount = AgentPortalAccountView & {
  normalizedIdentifier: string;
  passwordHash: string;
  tokenVersion: number;
};

type AccountActor = { id: string };

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeRequired(value: string): string {
  return value.trim();
}

@Injectable()
export class AgentPortalAccountsService {
  private readonly dataSource: "memory" | "prisma";
  private readonly memoryAccounts: MemoryAgentPortalAccount[] = [];
  private readonly memoryAuditLogs: Array<{
    id: string;
    portalUserId: string;
    agentId: string;
    actorAuthUserId: string;
    action: AgentPortalAccountAuditAction;
    createdAt: string;
  }> = [];

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly agents: AgentsService,
  ) {
    this.dataSource = resolveConfiguredDataSource(config);
  }

  async list(agentId?: string): Promise<AgentPortalAccountView[]> {
    const normalizedAgentId = agentId?.trim() || undefined;
    if (this.dataSource === "memory") {
      return this.memoryAccounts
        .filter((account) => !normalizedAgentId || account.agentId === normalizedAgentId)
        .map((account) => this.toView(account))
        .sort((left, right) => left.displayName.localeCompare(right.displayName));
    }

    const rows = await this.prisma.agentPortalUser.findMany({
      where: normalizedAgentId ? { agentId: normalizedAgentId } : undefined,
      select: {
        id: true,
        agentId: true,
        displayName: true,
        email: true,
        status: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        agent: { select: { code: true, name: true } },
      },
      orderBy: [{ displayName: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      agentCode: row.agent.code,
      agentName: row.agent.name,
      displayName: row.displayName,
      email: row.email,
      status: row.status,
      mustChangePassword: row.mustChangePassword,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async findForAuthentication(identifier: string): Promise<AgentPortalAuthenticationRecord | null> {
    const normalizedIdentifier = normalizeIdentifier(identifier);
    if (this.dataSource === "memory") {
      const account = this.memoryAccounts.find(
        (entry) => entry.normalizedIdentifier === normalizedIdentifier,
      );
      if (!account) return null;
      const agent = await this.agents.findOne(account.agentId);
      return this.toAuthenticationRecord(account, agent);
    }
    return this.findPrismaAuthenticationRecord({ normalizedIdentifier });
  }

  async findForSession(portalUserId: string): Promise<AgentPortalAuthenticationRecord | null> {
    const normalizedId = portalUserId.trim();
    if (this.dataSource === "memory") {
      const account = this.memoryAccounts.find((entry) => entry.id === normalizedId);
      if (!account) return null;
      const agent = await this.agents.findOne(account.agentId);
      return this.toAuthenticationRecord(account, agent);
    }
    return this.findPrismaAuthenticationRecord({ id: normalizedId });
  }

  async create(input: {
    agentId: string;
    displayName: string;
    email: string;
    password: string;
    actor: AccountActor;
  }): Promise<AgentPortalAccountView> {
    const agent = await this.requireEligibleAgent(input.agentId);
    const displayName = normalizeRequired(input.displayName);
    const email = normalizeIdentifier(input.email);
    const passwordHash = await hashAuthPasswordAsync(input.password);

    if (this.dataSource === "memory") {
      if (this.memoryAccounts.some((account) => account.normalizedIdentifier === email)) {
        throw new ConflictException("Portal account identifier is already in use.");
      }
      const now = new Date().toISOString();
      const created: MemoryAgentPortalAccount = {
        id: randomUUID(),
        agentId: agent.id,
        agentCode: agent.code,
        agentName: agent.name,
        displayName,
        email,
        normalizedIdentifier: email,
        passwordHash,
        status: AgentPortalUserStatus.ACTIVE,
        mustChangePassword: true,
        tokenVersion: 0,
        createdAt: now,
        updatedAt: now,
      };
      this.memoryAccounts.push(created);
      this.writeMemoryAudit(created, input.actor, AgentPortalAccountAuditAction.CREATED);
      return this.toView(created);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const eligibleAgent = await tx.agent.findFirst({
          where: {
            id: agent.id,
            type: AgentType.PARTNER,
            status: AgentStatus.ACTIVE,
          },
          select: { id: true },
        });
        if (!eligibleAgent) {
          throw new BadRequestException("Portal accounts require an active Partner Agent.");
        }
        const created = await tx.agentPortalUser.create({
          data: {
            agentId: agent.id,
            displayName,
            email,
            normalizedIdentifier: email,
            passwordHash,
          },
          select: {
            id: true,
            agentId: true,
            displayName: true,
            email: true,
            status: true,
            mustChangePassword: true,
            createdAt: true,
            updatedAt: true,
            agent: { select: { code: true, name: true } },
          },
        });
        await tx.agentPortalAccountAuditLog.create({
          data: {
            portalUserId: created.id,
            agentId: created.agentId,
            actorAuthUserId: input.actor.id,
            action: AgentPortalAccountAuditAction.CREATED,
          },
        });
        return {
          id: created.id,
          agentId: created.agentId,
          agentCode: created.agent.code,
          agentName: created.agent.name,
          displayName: created.displayName,
          email: created.email,
          status: created.status,
          mustChangePassword: created.mustChangePassword,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
        };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Portal account identifier is already in use.");
      }
      throw error;
    }
  }

  async setStatus(
    portalUserId: string,
    status: AgentPortalUserStatus,
    actor: AccountActor,
  ): Promise<AgentPortalAccountView> {
    const current = await this.requireAccount(portalUserId);
    if (status === AgentPortalUserStatus.ACTIVE) {
      await this.requireEligibleAgent(current.agentId);
    }
    const action = status === AgentPortalUserStatus.ACTIVE
      ? AgentPortalAccountAuditAction.ACTIVATED
      : AgentPortalAccountAuditAction.DISABLED;

    if (this.dataSource === "memory") {
      const account = this.memoryAccounts.find((entry) => entry.id === current.id)!;
      account.status = status;
      account.tokenVersion += 1;
      account.updatedAt = new Date().toISOString();
      this.writeMemoryAudit(account, actor, action);
      return this.toView(account);
    }

    return this.prisma.$transaction(async (tx) => {
      if (status === AgentPortalUserStatus.ACTIVE) {
        const eligibleAgent = await tx.agent.findFirst({
          where: {
            id: current.agentId,
            type: AgentType.PARTNER,
            status: AgentStatus.ACTIVE,
          },
          select: { id: true },
        });
        if (!eligibleAgent) {
          throw new BadRequestException("Portal accounts require an active Partner Agent.");
        }
      }
      const updated = await tx.agentPortalUser.update({
        where: { id: current.id },
        data: { status, tokenVersion: { increment: 1 } },
        select: {
          id: true,
          agentId: true,
          displayName: true,
          email: true,
          status: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
          agent: { select: { code: true, name: true } },
        },
      });
      await tx.agentPortalAccountAuditLog.create({
        data: {
          portalUserId: updated.id,
          agentId: updated.agentId,
          actorAuthUserId: actor.id,
          action,
        },
      });
      return {
        id: updated.id,
        agentId: updated.agentId,
        agentCode: updated.agent.code,
        agentName: updated.agent.name,
        displayName: updated.displayName,
        email: updated.email,
        status: updated.status,
        mustChangePassword: updated.mustChangePassword,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  async resetPassword(
    portalUserId: string,
    password: string,
    actor: AccountActor,
  ): Promise<AgentPortalAccountView> {
    const current = await this.requireAccount(portalUserId);
    const passwordHash = await hashAuthPasswordAsync(password);
    if (this.dataSource === "memory") {
      const account = this.memoryAccounts.find((entry) => entry.id === current.id)!;
      account.passwordHash = passwordHash;
      account.mustChangePassword = true;
      account.tokenVersion += 1;
      account.updatedAt = new Date().toISOString();
      this.writeMemoryAudit(account, actor, AgentPortalAccountAuditAction.PASSWORD_RESET);
      return this.toView(account);
    }

    return this.updateCredentialWithPrisma(
      current,
      actor,
      AgentPortalAccountAuditAction.PASSWORD_RESET,
      { passwordHash, mustChangePassword: true, tokenVersion: { increment: 1 } },
    );
  }

  async revoke(portalUserId: string, actor: AccountActor): Promise<AgentPortalAccountView> {
    const current = await this.requireAccount(portalUserId);
    if (this.dataSource === "memory") {
      const account = this.memoryAccounts.find((entry) => entry.id === current.id)!;
      account.tokenVersion += 1;
      account.updatedAt = new Date().toISOString();
      this.writeMemoryAudit(account, actor, AgentPortalAccountAuditAction.REVOKED);
      return this.toView(account);
    }
    return this.updateCredentialWithPrisma(
      current,
      actor,
      AgentPortalAccountAuditAction.REVOKED,
      { tokenVersion: { increment: 1 } },
    );
  }

  private async requireEligibleAgent(agentId: string): Promise<AgentRecord> {
    const agent = await this.agents.findOne(agentId.trim());
    if (agent.type !== AgentType.PARTNER || agent.status !== AgentStatus.ACTIVE) {
      throw new BadRequestException("Portal accounts require an active Partner Agent.");
    }
    return agent;
  }

  private async requireAccount(portalUserId: string): Promise<AgentPortalAccountView> {
    const normalizedId = portalUserId.trim();
    if (this.dataSource === "memory") {
      const account = this.memoryAccounts.find((entry) => entry.id === normalizedId);
      if (!account) throw new NotFoundException("Portal account not found.");
      return this.toView(account);
    }
    const account = await this.prisma.agentPortalUser.findUnique({
      where: { id: normalizedId },
      select: {
        id: true,
        agentId: true,
        displayName: true,
        email: true,
        status: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        agent: { select: { code: true, name: true } },
      },
    });
    if (!account) throw new NotFoundException("Portal account not found.");
    return {
      id: account.id,
      agentId: account.agentId,
      agentCode: account.agent.code,
      agentName: account.agent.name,
      displayName: account.displayName,
      email: account.email,
      status: account.status,
      mustChangePassword: account.mustChangePassword,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private async updateCredentialWithPrisma(
    current: AgentPortalAccountView,
    actor: AccountActor,
    action: AgentPortalAccountAuditAction,
    data: Prisma.AgentPortalUserUpdateInput,
  ): Promise<AgentPortalAccountView> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.agentPortalUser.update({
        where: { id: current.id },
        data,
        select: {
          id: true,
          agentId: true,
          displayName: true,
          email: true,
          status: true,
          mustChangePassword: true,
          createdAt: true,
          updatedAt: true,
          agent: { select: { code: true, name: true } },
        },
      });
      await tx.agentPortalAccountAuditLog.create({
        data: {
          portalUserId: updated.id,
          agentId: updated.agentId,
          actorAuthUserId: actor.id,
          action,
        },
      });
      return {
        id: updated.id,
        agentId: updated.agentId,
        agentCode: updated.agent.code,
        agentName: updated.agent.name,
        displayName: updated.displayName,
        email: updated.email,
        status: updated.status,
        mustChangePassword: updated.mustChangePassword,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  private async findPrismaAuthenticationRecord(
    where: { id: string } | { normalizedIdentifier: string },
  ): Promise<AgentPortalAuthenticationRecord | null> {
    const account = await this.prisma.agentPortalUser.findUnique({
      where,
      select: {
        id: true,
        agentId: true,
        displayName: true,
        email: true,
        normalizedIdentifier: true,
        passwordHash: true,
        status: true,
        mustChangePassword: true,
        tokenVersion: true,
        createdAt: true,
        updatedAt: true,
        agent: { select: { code: true, name: true, type: true, status: true } },
      },
    });
    if (!account) return null;
    return {
      id: account.id,
      agentId: account.agentId,
      agentCode: account.agent.code,
      agentName: account.agent.name,
      displayName: account.displayName,
      email: account.email,
      normalizedIdentifier: account.normalizedIdentifier,
      passwordHash: account.passwordHash,
      status: account.status,
      mustChangePassword: account.mustChangePassword,
      tokenVersion: account.tokenVersion,
      agentType: account.agent.type,
      agentStatus: account.agent.status,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private writeMemoryAudit(
    account: MemoryAgentPortalAccount,
    actor: AccountActor,
    action: AgentPortalAccountAuditAction,
  ): void {
    this.memoryAuditLogs.unshift({
      id: randomUUID(),
      portalUserId: account.id,
      agentId: account.agentId,
      actorAuthUserId: actor.id,
      action,
      createdAt: new Date().toISOString(),
    });
  }

  private toView(account: MemoryAgentPortalAccount): AgentPortalAccountView {
    return {
      id: account.id,
      agentId: account.agentId,
      agentCode: account.agentCode,
      agentName: account.agentName,
      displayName: account.displayName,
      email: account.email,
      status: account.status,
      mustChangePassword: account.mustChangePassword,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }

  private toAuthenticationRecord(
    account: MemoryAgentPortalAccount,
    agent: AgentRecord,
  ): AgentPortalAuthenticationRecord {
    return {
      ...this.toView(account),
      normalizedIdentifier: account.normalizedIdentifier,
      passwordHash: account.passwordHash,
      tokenVersion: account.tokenVersion,
      agentType: agent.type,
      agentStatus: agent.status,
    };
  }
}
