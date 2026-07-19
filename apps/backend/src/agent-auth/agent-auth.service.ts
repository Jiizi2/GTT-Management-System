import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AgentPortalUserStatus, AgentStatus, AgentType } from "@prisma/client";
import { AgentPortalAccountsService } from "../agents/agent-portal-accounts.service";
import { verifyAuthPasswordAsync } from "../auth/auth-password";
import {
  resolveConfiguredNodeEnv,
  resolveConfiguredString,
} from "../config/app-config";
import { createStructuredLogger } from "../logging/create-structured-logger";
import {
  AGENT_TOKEN_AUDIENCE,
  AGENT_TOKEN_ISSUER,
  type AgentLoginResult,
  type AgentPrincipal,
  type AgentTokenPayload,
} from "./agent-auth.types";

const DEFAULT_AGENT_AUTH_SECRET = "gtt-dev-agent-auth-secret-change-before-production";
const TOKEN_LIFETIME_SECONDS = 60 * 60;

function resolveAgentAuthSecret(config?: ConfigService): string {
  const configured = resolveConfiguredString(config, "AGENT_AUTH_SECRET");
  const nodeEnv = resolveConfiguredNodeEnv(config);
  if (configured) {
    if (nodeEnv === "production" && configured.length < 32) {
      throw new Error("AGENT_AUTH_SECRET must be at least 32 characters in production.");
    }
    return configured;
  }
  if (nodeEnv === "production") {
    throw new Error("AGENT_AUTH_SECRET is required in production.");
  }
  return DEFAULT_AGENT_AUTH_SECRET;
}

function parseTokenPayload(value: unknown): AgentTokenPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.sub !== "string" || !record.sub.trim() ||
    record.principalType !== "agent" ||
    typeof record.agentId !== "string" || !record.agentId.trim() ||
    typeof record.tokenVersion !== "number" || !Number.isInteger(record.tokenVersion) ||
    record.aud !== AGENT_TOKEN_AUDIENCE ||
    record.iss !== AGENT_TOKEN_ISSUER ||
    typeof record.iat !== "number" || !Number.isInteger(record.iat) ||
    typeof record.exp !== "number" || !Number.isInteger(record.exp)
  ) return null;
  return record as unknown as AgentTokenPayload;
}

@Injectable()
export class AgentAuthService {
  private readonly secret: string;
  private readonly logger = createStructuredLogger(AgentAuthService.name);

  constructor(
    private readonly accounts: AgentPortalAccountsService,
    private readonly config?: ConfigService,
    private readonly jwt: JwtService = new JwtService(),
  ) {
    this.secret = resolveAgentAuthSecret(config);
  }

  async login(identifier: string, password: string): Promise<AgentLoginResult> {
    const account = await this.accounts.findForAuthentication(identifier);
    if (!this.isEligible(account) || !(await verifyAuthPasswordAsync(password, account.passwordHash))) {
      this.logger.warn({ action: "agent.auth.login.failed" }, "Agent portal login failed.");
      throw new UnauthorizedException("Invalid identifier or password.");
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + TOKEN_LIFETIME_SECONDS;
    const accessToken = this.jwt.sign(
      {
        principalType: "agent",
        agentId: account.agentId,
        tokenVersion: account.tokenVersion,
      },
      {
        secret: this.secret,
        algorithm: "HS256",
        subject: account.id,
        audience: AGENT_TOKEN_AUDIENCE,
        issuer: AGENT_TOKEN_ISSUER,
        expiresIn: TOKEN_LIFETIME_SECONDS,
        header: { alg: "HS256", typ: "JWT" },
      },
    );
    const principal = this.toPrincipal(account, expiresAt);
    this.logger.info(
      { action: "agent.auth.login.succeeded", portalUserId: account.id, agentId: account.agentId },
      "Agent portal login succeeded.",
    );
    return { accessToken, expiresAt: new Date(expiresAt * 1000).toISOString(), principal };
  }

  verifyAccessToken(token: string): AgentTokenPayload {
    let decoded: unknown;
    try {
      decoded = this.jwt.verify(token, {
        secret: this.secret,
        algorithms: ["HS256"],
        audience: AGENT_TOKEN_AUDIENCE,
        issuer: AGENT_TOKEN_ISSUER,
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired agent access token.");
    }
    const payload = parseTokenPayload(decoded);
    if (!payload) throw new UnauthorizedException("Invalid agent access token claims.");
    return payload;
  }

  async authenticateAccessToken(token: string): Promise<AgentPrincipal> {
    const payload = this.verifyAccessToken(token);
    const account = await this.accounts.findForSession(payload.sub);
    if (
      !this.isEligible(account) ||
      account.id !== payload.sub ||
      account.agentId !== payload.agentId ||
      account.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException("Agent access token has been revoked.");
    }
    return this.toPrincipal(account, payload.exp);
  }

  private isEligible(
    account: Awaited<ReturnType<AgentPortalAccountsService["findForSession"]>>,
  ): account is NonNullable<Awaited<ReturnType<AgentPortalAccountsService["findForSession"]>>> {
    return Boolean(
      account &&
      account.status === AgentPortalUserStatus.ACTIVE &&
      account.agentType === AgentType.PARTNER &&
      account.agentStatus === AgentStatus.ACTIVE,
    );
  }

  private toPrincipal(
    account: NonNullable<Awaited<ReturnType<AgentPortalAccountsService["findForSession"]>>>,
    exp: number,
  ): AgentPrincipal {
    return {
      portalUserId: account.id,
      agentId: account.agentId,
      displayName: account.displayName,
      email: account.email,
      agentCode: account.agentCode,
      agentName: account.agentName,
      mustChangePassword: account.mustChangePassword,
      exp,
    };
  }
}
