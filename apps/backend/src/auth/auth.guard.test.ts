import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { AUTH_COOKIE_NAME } from "./auth-cookie";
import { AuthGuard } from "./auth.guard";
import type { AuthService } from "./auth.service";
import type { AuthTokenPayload } from "./auth.types";

type GuardRequest = {
  headers?: {
    authorization?: string;
    cookie?: string;
    origin?: string;
    host?: string;
  };
  method?: string;
  protocol?: string;
  authUser?: AuthTokenPayload;
};

function createExecutionContext(request: GuardRequest): ExecutionContext {
  return {
    getClass: () => class DummyController {},
    getHandler: () => (() => undefined) as (...args: unknown[]) => unknown,
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToHttp: () =>
      ({
        getRequest: () => request,
      }) as any,
    switchToRpc: () => ({} as any),
    switchToWs: () => ({} as any),
    getType: () => "http",
  } as unknown as ExecutionContext;
}

function createReflectorMock(isPublic: boolean): Reflector {
  return {
    getAllAndOverride: () => isPublic,
  } as unknown as Reflector;
}

function createAuthServiceMock(verifyImpl: (token: string) => AuthTokenPayload): AuthService {
  return {
    verifyAccessToken: verifyImpl,
  } as unknown as AuthService;
}

function createResolvedUser(): AuthTokenPayload {
  return {
    id: "dev-super-admin",
    name: "Dev Super Admin",
    username: "dev.superadmin",
    email: "superadmin.dev@ghaniya.local",
    accessTier: "super-admin",
    exp: 4_200_000_000,
    rememberSession: false,
    tokenVersion: 0,
  };
}

describe("AuthGuard", () => {
  runCase("allows public route without authentication", () => {
    const guard = new AuthGuard(
      createReflectorMock(true),
      createAuthServiceMock(() => {
        throw new Error("verifyAccessToken should not be called for public route.");
      }),
    );
    const request: GuardRequest = {};
    const result = guard.canActivate(createExecutionContext(request));
    expect(result).toBe(true);
  });

  runCase("rejects missing authentication", () => {
    const guard = new AuthGuard(
      createReflectorMock(false),
      createAuthServiceMock(() => {
        throw new Error("verifyAccessToken should not be called without credentials.");
      }),
    );
    const request: GuardRequest = {};

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      /Authentication is required/i,
    );
  });

  runCase("rejects non-bearer authorization header", () => {
    const guard = new AuthGuard(
      createReflectorMock(false),
      createAuthServiceMock(() => {
        throw new Error("verifyAccessToken should not be called for invalid scheme.");
      }),
    );
    const request: GuardRequest = {
      headers: {
        authorization: "Basic abc123",
      },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      /must use Bearer token/i,
    );
  });

  runCase("verifies bearer token and attaches auth user", () => {
    let capturedToken = "";
    const resolvedUser = createResolvedUser();

    const guard = new AuthGuard(
      createReflectorMock(false),
      createAuthServiceMock((token) => {
        capturedToken = token;
        return resolvedUser;
      }),
    );
    const request: GuardRequest = {
      headers: {
        authorization: "Bearer token-value-123",
      },
    };

    const result = guard.canActivate(createExecutionContext(request));
    expect(result).toBe(true);
    expect(capturedToken).toBe("token-value-123");
    expect(request.authUser).toEqual(resolvedUser);
  });

  runCase("verifies cookie token on safe method", () => {
    let capturedToken = "";
    const resolvedUser = createResolvedUser();

    const guard = new AuthGuard(
      createReflectorMock(false),
      createAuthServiceMock((token) => {
        capturedToken = token;
        return resolvedUser;
      }),
    );
    const request: GuardRequest = {
      method: "GET",
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=cookie-token-123`,
      },
    };

    const result = guard.canActivate(createExecutionContext(request));
    expect(result).toBe(true);
    expect(capturedToken).toBe("cookie-token-123");
    expect(request.authUser).toEqual(resolvedUser);
  });

  runCase("rejects cookie write without trusted origin", () => {
    const guard = new AuthGuard(
      createReflectorMock(false),
      createAuthServiceMock(() => createResolvedUser()),
    );
    const request: GuardRequest = {
      method: "POST",
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=cookie-token-123`,
        host: "localhost:3001",
      },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      /Origin header is required for cookie-authenticated write requests/i,
    );
  });

  runCase("allows cookie write with trusted origin", () => {
    let capturedToken = "";
    const guard = new AuthGuard(
      createReflectorMock(false),
      createAuthServiceMock((token) => {
        capturedToken = token;
        return createResolvedUser();
      }),
    );
    const request: GuardRequest = {
      method: "POST",
      protocol: "http",
      headers: {
        cookie: `${AUTH_COOKIE_NAME}=cookie-token-456`,
        origin: "http://localhost:3001",
        host: "localhost:3001",
      },
    };

    const result = guard.canActivate(createExecutionContext(request));
    expect(result).toBe(true);
    expect(capturedToken).toBe("cookie-token-456");
  });

  runCase("propagates verifyAccessToken failure", () => {
    const guard = new AuthGuard(
      createReflectorMock(false),
      createAuthServiceMock(() => {
        throw new UnauthorizedException("Invalid access token signature.");
      }),
    );
    const request: GuardRequest = {
      headers: {
        authorization: "Bearer broken-token",
      },
    };

    expect(() => guard.canActivate(createExecutionContext(request))).toThrow(
      /Invalid access token signature/i,
    );
  });
});
