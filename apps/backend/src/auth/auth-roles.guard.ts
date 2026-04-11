import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_ROLES_KEY } from "./auth.roles";
import type { AuthAccessTier, AuthTokenPayload } from "./auth.types";

function resolveForbiddenMessage(requiredRoles: AuthAccessTier[]): string {
  if (requiredRoles.length === 1 && requiredRoles[0] === "super-admin") {
    return "Super Admin access is required.";
  }

  const formattedRoles = requiredRoles.map((role) => role.replace(/-/g, " "));
  return `One of the following roles is required: ${formattedRoles.join(", ")}.`;
}

@Injectable()
export class AuthRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AuthAccessTier[]>(AUTH_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      authUser?: AuthTokenPayload;
    }>();
    const authUser = request.authUser;

    if (!authUser) {
      throw new UnauthorizedException("Session is not available.");
    }

    if (!requiredRoles.includes(authUser.accessTier)) {
      throw new ForbiddenException(resolveForbiddenMessage(requiredRoles));
    }

    return true;
  }
}
