import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
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

describe("AuthRolesGuard", () => {
  runCase("allows access when no roles are required", () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new AuthRolesGuard(reflector);

    expect(guard.canActivate(createExecutionContext() as never)).toBe(true);
  });

  runCase("rejects when session is not available", () => {
    const reflector = {
      getAllAndOverride: () => ["super-admin"],
    } as unknown as Reflector;
    const guard = new AuthRolesGuard(reflector);

    expect(() => guard.canActivate(createExecutionContext() as never)).toThrow(
      /Session is not available/i,
    );
  });

  runCase("rejects when user lacks required role", () => {
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
      tokenVersion: 0,
    };

    expect(() => guard.canActivate(createExecutionContext(adminUser) as never)).toThrow(
      /Super Admin access is required/i,
    );
  });

  runCase("allows access when user has required role", () => {
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
      tokenVersion: 0,
    };

    expect(guard.canActivate(createExecutionContext(adminUser) as never)).toBe(true);
  });
});
