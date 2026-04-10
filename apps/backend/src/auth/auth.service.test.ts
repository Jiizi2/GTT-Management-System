import assert from "node:assert/strict";
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";

const FIXED_NOW_EPOCH_MS = Date.parse("2026-04-09T08:00:00.000Z");
const ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60 * 12;
const REMEMBERED_TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 14;

function withFixedNow<T>(epochMs: number, fn: () => T): T {
  const originalNow = Date.now;
  Date.now = () => epochMs;
  try {
    return fn();
  } finally {
    Date.now = originalNow;
  }
}

function withAuthSecret<T>(secret: string, fn: () => T): T {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    return fn();
  } finally {
    if (previousSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousSecret;
    }
  }
}

function assertThrowsWithMessage(
  fn: () => unknown,
  expectedType: new (...args: any[]) => Error,
  messageRegex: RegExp,
): void {
  assert.throws(fn, (error: unknown) => {
    assert.equal(error instanceof expectedType, true);
    assert.match((error as Error).message, messageRegex);
    return true;
  });
}

async function runCase(name: string, fn: () => void): Promise<void> {
  fn();
  console.log(`PASS ${name}`);
}

function testLoginAndTokenVerificationWithDefaultLifetime(): void {
  withAuthSecret("unit-test-secret", () => {
    withFixedNow(FIXED_NOW_EPOCH_MS, () => {
      const service = new AuthService();
      const response = service.login({
        identifier: "  Dev.SuperAdmin  ",
        password: "DevSuperAdmin#2026",
      });

      assert.equal(response.tokenType, "Bearer");
      assert.equal(response.rememberSession, false);
      assert.equal(response.user.username, "dev.superadmin");

      const expectedExpiresAt = new Date(
        (Math.floor(FIXED_NOW_EPOCH_MS / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS) * 1000,
      ).toISOString();
      assert.equal(response.expiresAt, expectedExpiresAt);

      const verifiedPayload = service.verifyAccessToken(response.accessToken);
      assert.equal(verifiedPayload.id, "dev-super-admin");
      assert.equal(verifiedPayload.username, "dev.superadmin");
      assert.equal(
        verifiedPayload.exp,
        Math.floor(FIXED_NOW_EPOCH_MS / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS,
      );
    });
  });
}

function testLoginWithEmailAndRememberedSessionLifetime(): void {
  withAuthSecret("unit-test-secret", () => {
    withFixedNow(FIXED_NOW_EPOCH_MS, () => {
      const service = new AuthService();
      const response = service.login({
        identifier: "  ADMIN.DEV@GHANIYA.LOCAL  ",
        password: "DevAdmin#2026",
        rememberSession: true,
      });

      assert.equal(response.user.username, "dev.admin");
      assert.equal(response.rememberSession, true);

      const verifiedPayload = service.verifyAccessToken(response.accessToken);
      assert.equal(
        verifiedPayload.exp,
        Math.floor(FIXED_NOW_EPOCH_MS / 1000) + REMEMBERED_TOKEN_LIFETIME_SECONDS,
      );
    });
  });
}

function testLoginRejectsInvalidCredentials(): void {
  withAuthSecret("unit-test-secret", () => {
    const service = new AuthService();
    assertThrowsWithMessage(
      () =>
        service.login({
          identifier: "dev.superadmin",
          password: "wrong-password",
        }),
      UnauthorizedException,
      /Invalid username\/email or password/i,
    );
  });
}

function testVerifyTokenRejectsTamperedSignatureAndExpiredToken(): void {
  withAuthSecret("unit-test-secret", () => {
    withFixedNow(FIXED_NOW_EPOCH_MS, () => {
      const service = new AuthService();
      const response = service.login({
        identifier: "dev.superadmin",
        password: "DevSuperAdmin#2026",
      });

      const [header, payload, signature] = response.accessToken.split(".");
      assert.equal(Boolean(header && payload && signature), true);

      const tamperedPayload = payload.endsWith("A")
        ? `${payload.slice(0, -1)}B`
        : `${payload.slice(0, -1)}A`;
      assertThrowsWithMessage(
        () => service.verifyAccessToken(`${header}.${tamperedPayload}.${signature}`),
        UnauthorizedException,
        /Invalid access token signature/i,
      );

      withFixedNow(
        (Math.floor(FIXED_NOW_EPOCH_MS / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS + 1) * 1000,
        () => {
          assertThrowsWithMessage(
            () => service.verifyAccessToken(response.accessToken),
            UnauthorizedException,
            /Access token has expired/i,
          );
        },
      );
    });
  });
}

function testManagedUsersListAndUpdateRules(): void {
  withAuthSecret("unit-test-secret", () => {
    const service = new AuthService();
    const listedUsers = service.listManagedUsers();
    assert.deepEqual(
      listedUsers.map((user) => user.name),
      ["Hadi Support", "Mila Finance", "Operator Admin"],
    );

    const updated = service.updateManagedUser("usr-2", {
      name: "  Mila Operations  ",
      email: "MILA.OPS@GHANIYATRAVEL.COM",
      roleId: "admin",
    });
    assert.equal(updated.name, "Mila Operations");
    assert.equal(updated.email, "mila.ops@ghaniyatravel.com");
    assert.equal(updated.roleId, "admin");
    assert.equal(Number.isNaN(Date.parse(updated.updatedAt)), false);

    assertThrowsWithMessage(
      () =>
        service.updateManagedUser("usr-3", {
          name: "Hadi Support",
          email: "operator.admin@ghaniyatravel.com",
          roleId: "customer-support",
        }),
      ConflictException,
      /already used by another user/i,
    );

    assertThrowsWithMessage(
      () =>
        service.updateManagedUser("unknown-user", {
          name: "Unknown",
          email: "unknown@example.com",
          roleId: "admin",
        }),
      NotFoundException,
      /not found/i,
    );
  });
}

async function main(): Promise<void> {
  await runCase("auth login and token verification", testLoginAndTokenVerificationWithDefaultLifetime);
  await runCase("auth remembered session lifetime", testLoginWithEmailAndRememberedSessionLifetime);
  await runCase("auth invalid credentials rejection", testLoginRejectsInvalidCredentials);
  await runCase("auth token tamper and expiry validation", testVerifyTokenRejectsTamperedSignatureAndExpiredToken);
  await runCase("managed users listing and update validation", testManagedUsersListAndUpdateRules);
}

void main().catch((error: unknown) => {
  console.error("Auth service test failed:", error);
  process.exitCode = 1;
});
