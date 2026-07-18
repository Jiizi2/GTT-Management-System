import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_ROUTE_KEY } from "../auth/auth.public";
import { resolveConfiguredString } from "../config/app-config";
import {
  isOriginAllowed,
  readHeaderValue,
  resolveCorsOrigins,
  resolveRequestOrigin,
  resolveRequestSourceOrigin,
} from "../http-origin";
import { extractAgentAuthCookieToken } from "./agent-auth-cookie";
import { AgentAuthService } from "./agent-auth.service";
import type { AgentPrincipal } from "./agent-auth.types";
import { IS_AGENT_PORTAL_ROUTE_KEY } from "./agent-portal-route";

type AgentAuthRequest = {
  headers?: Record<string, unknown>;
  method?: string;
  protocol?: string;
  secure?: boolean;
  socket?: { encrypted?: boolean | null };
  agentPrincipal?: AgentPrincipal;
};

@Injectable()
export class AgentAuthGuard implements CanActivate {
  private readonly allowedOrigins: string[];

  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AgentAuthService,
    config?: ConfigService,
  ) {
    this.allowedOrigins = resolveCorsOrigins(resolveConfiguredString(config, "CORS_ORIGINS"));
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isAgentRoute = this.reflector.getAllAndOverride<boolean>(IS_AGENT_PORTAL_ROUTE_KEY, targets);
    if (!isAgentRoute) return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE_KEY, targets);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AgentAuthRequest>();
    const authentication = this.resolveAuthentication(request);
    if (!authentication) throw new UnauthorizedException("Agent authentication is required.");
    if (authentication.transport === "cookie") this.assertTrustedOriginForCookieWrite(request);
    return this.auth.authenticateAccessToken(authentication.token).then((principal) => {
      request.agentPrincipal = principal;
      return true;
    });
  }

  private resolveAuthentication(
    request: AgentAuthRequest,
  ): { token: string; transport: "header" | "cookie" } | null {
    const authorization = readHeaderValue(request.headers, "authorization").trim();
    if (authorization) {
      const [scheme, token] = authorization.split(/\s+/, 2);
      if (scheme?.toLowerCase() !== "bearer" || !token) {
        throw new UnauthorizedException("Authorization header must use Bearer token.");
      }
      return { token, transport: "header" };
    }
    const cookieToken = extractAgentAuthCookieToken(request.headers);
    return cookieToken ? { token: cookieToken, transport: "cookie" } : null;
  }

  private assertTrustedOriginForCookieWrite(request: AgentAuthRequest): void {
    const method = request.method?.trim().toUpperCase() ?? "GET";
    if (["GET", "HEAD", "OPTIONS"].includes(method)) return;
    const sourceOrigin = resolveRequestSourceOrigin(request);
    if (!sourceOrigin) {
      throw new ForbiddenException("Origin header is required for cookie-authenticated write requests.");
    }
    const requestOrigin = resolveRequestOrigin(request);
    if (sourceOrigin === requestOrigin || isOriginAllowed(sourceOrigin, this.allowedOrigins)) return;
    throw new ForbiddenException(
      `Origin '${readHeaderValue(request.headers, "origin") || sourceOrigin}' is not allowed.`,
    );
  }
}
