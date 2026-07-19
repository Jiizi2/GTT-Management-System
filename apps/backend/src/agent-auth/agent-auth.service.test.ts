import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AgentPortalUserStatus, AgentStatus, AgentType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { AgentPortalAccountsService } from "../agents/agent-portal-accounts.service";
import type { AgentRecord, AgentsService } from "../agents/agents.service";
import { AuthService } from "../auth/auth.service";
import type { PrismaService } from "../prisma/prisma.service";
import { AgentAuthService } from "./agent-auth.service";
import { AGENT_TOKEN_AUDIENCE, AGENT_TOKEN_ISSUER } from "./agent-auth.types";

function config(values: Record<string, unknown>): ConfigService {
  return { get: vi.fn((key: string) => values[key]) } as unknown as ConfigService;
}

function partnerAgent(): AgentRecord {
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
  };
}

async function fixture() {
  const agent = partnerAgent();
  const runtimeConfig = config({
    DATA_SOURCE: "memory",
    NODE_ENV: "test",
    AUTH_SECRET: "internal-unit-secret",
    AGENT_AUTH_SECRET: "agent-unit-secret",
  });
  const agents = { findOne: vi.fn(async () => agent) };
  const accounts = new AgentPortalAccountsService(
    runtimeConfig,
    {} as PrismaService,
    agents as unknown as AgentsService,
  );
  const created = await accounts.create({
    agentId: agent.id,
    displayName: "Partner Operator",
    email: "operator@partner.example",
    password: "PortalAccount#2026",
    actor: { id: "internal-super-admin" },
  });
  const auth = new AgentAuthService(accounts, runtimeConfig, new JwtService());
  return { agent, accounts, created, auth, runtimeConfig };
}

describe("AgentAuthService", () => {
  it("issues a minimal audience-bound token and resolves a session principal", async () => {
    const { auth, created } = await fixture();

    const login = await auth.login(" OPERATOR@PARTNER.EXAMPLE ", "PortalAccount#2026");
    const decoded = new JwtService().decode(login.accessToken) as Record<string, unknown>;
    const principal = await auth.authenticateAccessToken(login.accessToken);

    expect(decoded).toMatchObject({
      sub: created.id,
      principalType: "agent",
      agentId: "agent_partner",
      aud: AGENT_TOKEN_AUDIENCE,
      iss: AGENT_TOKEN_ISSUER,
    });
    expect(decoded).not.toHaveProperty("email");
    expect(decoded).not.toHaveProperty("displayName");
    expect(principal).toMatchObject({
      portalUserId: created.id,
      agentId: "agent_partner",
      agentCode: "PARTNER-1",
    });
  });

  it("rejects generic invalid credentials and inactive account or Agent", async () => {
    const { auth, accounts, created, agent } = await fixture();
    await expect(auth.login("missing@example.com", "wrong"))
      .rejects.toThrow("Invalid identifier or password.");

    await accounts.setStatus(created.id, AgentPortalUserStatus.DISABLED, { id: "admin" });
    await expect(auth.login("operator@partner.example", "PortalAccount#2026"))
      .rejects.toThrow("Invalid identifier or password.");

    await accounts.setStatus(created.id, AgentPortalUserStatus.ACTIVE, { id: "admin" });
    agent.status = AgentStatus.INACTIVE;
    await expect(auth.login("operator@partner.example", "PortalAccount#2026"))
      .rejects.toThrow("Invalid identifier or password.");
  });

  it("rejects a session immediately after tokenVersion revocation", async () => {
    const { auth, accounts, created } = await fixture();
    const login = await auth.login("operator@partner.example", "PortalAccount#2026");

    await accounts.revoke(created.id, { id: "admin" });

    await expect(auth.authenticateAccessToken(login.accessToken)).rejects.toThrow(/revoked/i);
  });

  it("mutually rejects internal and agent tokens", async () => {
    const { auth, runtimeConfig } = await fixture();
    const agentLogin = await auth.login("operator@partner.example", "PortalAccount#2026");
    const internal = new AuthService({} as PrismaService, runtimeConfig, new JwtService());
    const internalLogin = await internal.login({
      identifier: "dev.superadmin",
      password: "DevSuperAdmin#2026",
    });

    expect(() => auth.verifyAccessToken(internalLogin.accessToken)).toThrow(/invalid or expired/i);
    expect(() => internal.verifyAccessToken(agentLogin.accessToken)).toThrow(/invalid access token/i);
  });
});
