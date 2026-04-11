import assert from "node:assert/strict";
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

async function runCase(name: string, fn: () => void): Promise<void> {
  fn();
  console.log(`PASS ${name}`);
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
  };
}

function testAllowsPublicRouteWithoutAuthentication(): void {
  const guard = new AuthGuard(
    createReflectorMock(true),
    createAuthServiceMock(() => {
      throw new Error("verifyAccessToken should not be called for public route.");
    }),
  );
  const request: GuardRequest = {};
  const result = guard.canActivate(createExecutionContext(request));
  assert.equal(result, true);
}

function testRejectsMissingAuthentication(): void {
  const guard = new AuthGuard(
    createReflectorMock(false),
    createAuthServiceMock(() => {
      throw new Error("verifyAccessToken should not be called without credentials.");
    }),
  );
  const request: GuardRequest = {};

  assert.throws(
    () => guard.canActivate(createExecutionContext(request)),
    (error: unknown) => {
      assert.equal(error instanceof UnauthorizedException, true);
      assert.match((error as Error).message, /Authentication is required/i);
      return true;
    },
  );
}

function testRejectsNonBearerAuthorizationHeader(): void {
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

  assert.throws(
    () => guard.canActivate(createExecutionContext(request)),
    (error: unknown) => {
      assert.equal(error instanceof UnauthorizedException, true);
      assert.match((error as Error).message, /must use Bearer token/i);
      return true;
    },
  );
}

function testVerifiesBearerTokenAndAttachesAuthUser(): void {
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
  assert.equal(result, true);
  assert.equal(capturedToken, "token-value-123");
  assert.deepEqual(request.authUser, resolvedUser);
}

function testVerifiesCookieTokenOnSafeMethod(): void {
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
  assert.equal(result, true);
  assert.equal(capturedToken, "cookie-token-123");
  assert.deepEqual(request.authUser, resolvedUser);
}

function testRejectsCookieWriteWithoutTrustedOrigin(): void {
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

  assert.throws(
    () => guard.canActivate(createExecutionContext(request)),
    (error: unknown) => {
      assert.equal(error instanceof ForbiddenException, true);
      assert.match(
        (error as Error).message,
        /Origin header is required for cookie-authenticated write requests/i,
      );
      return true;
    },
  );
}

function testAllowsCookieWriteWithTrustedOrigin(): void {
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
  assert.equal(result, true);
  assert.equal(capturedToken, "cookie-token-456");
}

function testPropagatesVerifyAccessTokenFailure(): void {
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

  assert.throws(
    () => guard.canActivate(createExecutionContext(request)),
    (error: unknown) => {
      assert.equal(error instanceof UnauthorizedException, true);
      assert.match((error as Error).message, /Invalid access token signature/i);
      return true;
    },
  );
}

async function main(): Promise<void> {
  await runCase("auth guard allows public route", testAllowsPublicRouteWithoutAuthentication);
  await runCase("auth guard rejects missing authentication", testRejectsMissingAuthentication);
  await runCase("auth guard rejects non-bearer authorization", testRejectsNonBearerAuthorizationHeader);
  await runCase("auth guard verifies bearer token and sets authUser", testVerifiesBearerTokenAndAttachesAuthUser);
  await runCase("auth guard verifies cookie token on safe method", testVerifiesCookieTokenOnSafeMethod);
  await runCase("auth guard rejects cookie write without origin", testRejectsCookieWriteWithoutTrustedOrigin);
  await runCase("auth guard allows cookie write with trusted origin", testAllowsCookieWriteWithTrustedOrigin);
  await runCase("auth guard propagates verify error", testPropagatesVerifyAccessTokenFailure);
}

void main().catch((error: unknown) => {
  console.error("Auth guard test failed:", error);
  process.exitCode = 1;
});
