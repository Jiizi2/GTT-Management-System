import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";
import { IS_PUBLIC_ROUTE_KEY } from "./auth.public";
import type { AuthTokenPayload } from "./auth.types";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublicRoute = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublicRoute) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers?: { authorization?: string };
      authUser?: AuthTokenPayload;
    }>();
    const authorization = request.headers?.authorization?.trim() ?? "";
    if (!authorization) {
      throw new UnauthorizedException("Authorization header is required.");
    }

    const [scheme, token] = authorization.split(/\s+/, 2);
    if (scheme.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("Authorization header must use Bearer token.");
    }

    request.authUser = this.authService.verifyAccessToken(token);
    return true;
  }
}
