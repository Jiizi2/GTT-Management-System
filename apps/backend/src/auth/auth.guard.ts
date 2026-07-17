import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import {
  isOriginAllowed,
  readHeaderValue,
  resolveCorsOrigins,
  resolveRequestOrigin,
  resolveRequestSourceOrigin,
} from "../http-origin";
import { resolveConfiguredString } from "../config/app-config";
import { extractAuthCookieToken } from "./auth-cookie";
import { AuthService } from "./auth.service";
import { IS_PUBLIC_ROUTE_KEY } from "./auth.public";
import type { AuthTokenPayload } from "./auth.types";

type AuthTransport = "header" | "cookie";

type GuardHeaders = {
  authorization?: string;
  cookie?: string;
  origin?: string;
  referer?: string;
  host?: string;
  "x-forwarded-proto"?: string;
  "x-forwarded-host"?: string;
};

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly allowedOrigins: string[];

  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
    private readonly configService?: ConfigService,
  ) {
    this.allowedOrigins = resolveCorsOrigins(resolveConfiguredString(this.configService, "CORS_ORIGINS"));
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const isPublicRoute = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublicRoute) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers?: GuardHeaders;
      method?: string;
      protocol?: string;
      secure?: boolean;
      socket?: {
        encrypted?: boolean | null;
      };
      authUser?: AuthTokenPayload;
    }>();
    const resolvedAuthentication = this.resolveAuthentication(request);
    if (!resolvedAuthentication) {
      throw new UnauthorizedException("Authentication is required.");
    }

    if (resolvedAuthentication.transport === "cookie") {
      this.assertTrustedOriginForCookieAuth(request);
    }

    const authenticate = (this.authService as AuthService & {
      authenticateAccessToken?: (token: string) => Promise<AuthTokenPayload>;
    }).authenticateAccessToken;
    if (typeof authenticate === "function") {
      return authenticate.call(this.authService, resolvedAuthentication.token).then((authUser) => {
        request.authUser = authUser;
        return true;
      });
    }

    request.authUser = this.authService.verifyAccessToken(resolvedAuthentication.token);
    return true;
  }

  private resolveAuthentication(request: {
    headers?: GuardHeaders;
  }): { token: string; transport: AuthTransport } | null {
    const authorization = request.headers?.authorization?.trim() ?? "";
    if (authorization) {
      const [scheme, token] = authorization.split(/\s+/, 2);
      if (scheme.toLowerCase() !== "bearer" || !token) {
        throw new UnauthorizedException("Authorization header must use Bearer token.");
      }

      return {
        token,
        transport: "header",
      };
    }

    const cookieToken = extractAuthCookieToken(request.headers);
    if (!cookieToken) {
      return null;
    }

    return {
      token: cookieToken,
      transport: "cookie",
    };
  }

  private assertTrustedOriginForCookieAuth(request: {
    headers?: GuardHeaders;
    method?: string;
    protocol?: string;
    secure?: boolean;
    socket?: {
      encrypted?: boolean | null;
    };
  }): void {
    const method = request.method?.trim().toUpperCase() ?? "GET";
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return;
    }

    const requestSourceOrigin = resolveRequestSourceOrigin(request);
    if (!requestSourceOrigin) {
      throw new ForbiddenException(
        "Origin header is required for cookie-authenticated write requests.",
      );
    }

    const requestOrigin = resolveRequestOrigin(request);
    if (requestOrigin && requestSourceOrigin === requestOrigin) {
      return;
    }

    if (isOriginAllowed(requestSourceOrigin, this.allowedOrigins)) {
      return;
    }

    const rawOrigin = readHeaderValue(request.headers, "origin") || requestSourceOrigin;
    throw new ForbiddenException(`Origin '${rawOrigin}' is not allowed.`);
  }
}
