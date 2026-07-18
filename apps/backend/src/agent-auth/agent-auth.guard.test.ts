import type { ExecutionContext } from "@nestjs/common";
import { ForbiddenException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import { IS_PUBLIC_ROUTE_KEY } from "../auth/auth.public";
import { AgentAuthGuard } from "./agent-auth.guard";
import type { AgentAuthService } from "./agent-auth.service";
import type { AgentPrincipal } from "./agent-auth.types";
import { IS_AGENT_PORTAL_ROUTE_KEY } from "./agent-portal-route";

function context(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => (() => undefined),
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function reflector(agentRoute: boolean, publicRoute = false): Reflector {
  return {
    getAllAndOverride: (key: string) => {
      if (key === IS_AGENT_PORTAL_ROUTE_KEY) return agentRoute;
      if (key === IS_PUBLIC_ROUTE_KEY) return publicRoute;
      return false;
    },
  } as unknown as Reflector;
}

const principal: AgentPrincipal = {
  portalUserId: "portal-user",
  agentId: "agent-partner",
  displayName: "Partner Operator",
  email: "operator@partner.example",
  agentCode: "PARTNER",
  agentName: "Partner",
  mustChangePassword: false,
  exp: 4_000_000_000,
};

describe("AgentAuthGuard", () => {
  it("does not process internal routes", () => {
    const auth = { authenticateAccessToken: vi.fn() };
    const guard = new AgentAuthGuard(reflector(false), auth as unknown as AgentAuthService);
    expect(guard.canActivate(context({}))).toBe(true);
    expect(auth.authenticateAccessToken).not.toHaveBeenCalled();
  });

  it("allows marked public agent routes without a token", () => {
    const guard = new AgentAuthGuard(
      reflector(true, true),
      { authenticateAccessToken: vi.fn() } as unknown as AgentAuthService,
    );
    expect(guard.canActivate(context({}))).toBe(true);
  });

  it("authenticates and attaches an immutable session-derived principal", async () => {
    const auth = { authenticateAccessToken: vi.fn(async () => principal) };
    const request: Record<string, unknown> = {
      method: "GET",
      headers: { authorization: "Bearer agent-token" },
    };
    const guard = new AgentAuthGuard(reflector(true), auth as unknown as AgentAuthService);

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.agentPrincipal).toEqual(principal);
    expect(auth.authenticateAccessToken).toHaveBeenCalledWith("agent-token");
  });

  it("enforces origin checks for cookie-authenticated writes", () => {
    const guard = new AgentAuthGuard(
      reflector(true),
      { authenticateAccessToken: vi.fn(async () => principal) } as unknown as AgentAuthService,
    );
    const request = {
      method: "POST",
      headers: { cookie: "gtt_agent_session=agent-token", host: "portal.example.com" },
      protocol: "https",
    };
    expect(() => guard.canActivate(context(request))).toThrow(ForbiddenException);
  });
});
