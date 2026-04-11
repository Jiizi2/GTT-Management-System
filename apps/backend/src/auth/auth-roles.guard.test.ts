import assert from "node:assert/strict";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthRolesGuard } from "./auth-roles.guard";
import type { AuthTokenPayload } from "./auth.types";

function createExecutionContext(authUser?: AuthTokenPayload) {
  return {
    getHandler: () => "handler",
    getClass: () => "class",
    switchToHttp: () => ({
      getRequest: () => ({
        authUser,
      }),
    }),
  };
}

async function main(): Promise<void> {
  {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new AuthRolesGuard(reflector);

    assert.equal(guard.canActivate(createExecutionContext() as never), true);
  }

  {
    const reflector = {
      getAllAndOverride: () => ["super-admin"],
    } as unknown as Reflector;
    const guard = new AuthRolesGuard(reflector);

    assert.throws(
      () => guard.canActivate(createExecutionContext() as never),
      (error: unknown) =>
        error instanceof UnauthorizedException &&
        error.message.includes("Session is not available"),
    );
  }

  {
    const reflector = {
      getAllAndOverride: () => ["super-admin"],
    } as unknown as Reflector;
    const guard = new AuthRolesGuard(reflector);

    const adminUser: AuthTokenPayload = {
      id: "usr-admin",
      name: "Admin",
      username: "admin",
      email: "admin@example.com",
      accessTier: "admin",
      exp: Math.floor(Date.now() / 1000) + 60,
      rememberSession: false,
    };

    assert.throws(
      () => guard.canActivate(createExecutionContext(adminUser) as never),
      (error: unknown) =>
        error instanceof ForbiddenException &&
        error.message.includes("Super Admin access is required"),
    );
  }

  {
    const reflector = {
      getAllAndOverride: () => ["admin", "super-admin"],
    } as unknown as Reflector;
    const guard = new AuthRolesGuard(reflector);

    const adminUser: AuthTokenPayload = {
      id: "usr-admin",
      name: "Admin",
      username: "admin",
      email: "admin@example.com",
      accessTier: "admin",
      exp: Math.floor(Date.now() / 1000) + 60,
      rememberSession: false,
    };

    assert.equal(guard.canActivate(createExecutionContext(adminUser) as never), true);
  }
}

void main();
