import assert from "node:assert/strict";
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

const FIXED_NOW_EPOCH_MS = Date.parse("2026-04-09T08:00:00.000Z");
const ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60 * 12;
const REMEMBERED_TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 14;

async function withFixedNow<T>(epochMs: number, fn: () => Promise<T>): Promise<T> {
  const originalNow = Date.now;
  Date.now = () => epochMs;
  try {
    return await fn();
  } finally {
    Date.now = originalNow;
  }
}

async function withAuthSecret<T>(secret: string, fn: () => Promise<T>): Promise<T> {
  const previousSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = secret;
  try {
    return await fn();
  } finally {
    if (previousSecret === undefined) {
      delete process.env.AUTH_SECRET;
    } else {
      process.env.AUTH_SECRET = previousSecret;
    }
  }
}

async function withDataSource<T>(dataSource: "memory" | "prisma", fn: () => Promise<T>): Promise<T> {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = dataSource;
  try {
    return await fn();
  } finally {
    if (previousDataSource === undefined) {
      delete process.env.DATA_SOURCE;
    } else {
      process.env.DATA_SOURCE = previousDataSource;
    }
  }
}

async function assertRejectsWithMessage(
  fn: () => Promise<unknown>,
  expectedType: new (...args: any[]) => Error,
  messageRegex: RegExp,
): Promise<void> {
  await assert.rejects(fn, (error: unknown) => {
    assert.equal(error instanceof expectedType, true);
    assert.match((error as Error).message, messageRegex);
    return true;
  });
}

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

function createMemoryAuthService(): AuthService {
  return new AuthService({} as PrismaService);
}

async function testLoginAndTokenVerificationWithDefaultLifetime(): Promise<void> {
  await withDataSource("memory", async () => {
    await withAuthSecret("unit-test-secret", async () => {
      await withFixedNow(FIXED_NOW_EPOCH_MS, async () => {
        const service = createMemoryAuthService();
        const response = await service.login({
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
  });
}

async function testLoginWithEmailAndRememberedSessionLifetime(): Promise<void> {
  await withDataSource("memory", async () => {
    await withAuthSecret("unit-test-secret", async () => {
      await withFixedNow(FIXED_NOW_EPOCH_MS, async () => {
        const service = createMemoryAuthService();
        const response = await service.login({
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
  });
}

async function testLoginRejectsInvalidCredentials(): Promise<void> {
  await withDataSource("memory", async () => {
    await withAuthSecret("unit-test-secret", async () => {
      const service = createMemoryAuthService();
      await assertRejectsWithMessage(
        () =>
          service.login({
            identifier: "dev.superadmin",
            password: "wrong-password",
          }),
        UnauthorizedException,
        /Invalid username\/email or password/i,
      );
    });
  });
}

async function testVerifyTokenRejectsTamperedSignatureAndExpiredToken(): Promise<void> {
  await withDataSource("memory", async () => {
    await withAuthSecret("unit-test-secret", async () => {
      await withFixedNow(FIXED_NOW_EPOCH_MS, async () => {
        const service = createMemoryAuthService();
        const response = await service.login({
          identifier: "dev.superadmin",
          password: "DevSuperAdmin#2026",
        });

        const [header, payload, signature] = response.accessToken.split(".");
        assert.equal(Boolean(header && payload && signature), true);

        const tamperedPayload = payload.endsWith("A")
          ? `${payload.slice(0, -1)}B`
          : `${payload.slice(0, -1)}A`;
        assert.throws(
          () => service.verifyAccessToken(`${header}.${tamperedPayload}.${signature}`),
          (error: unknown) => {
            assert.equal(error instanceof UnauthorizedException, true);
            assert.match((error as Error).message, /Invalid access token signature/i);
            return true;
          },
        );

        await withFixedNow(
          (Math.floor(FIXED_NOW_EPOCH_MS / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS + 1) * 1000,
          async () => {
            assert.throws(
              () => service.verifyAccessToken(response.accessToken),
              (error: unknown) => {
                assert.equal(error instanceof UnauthorizedException, true);
                assert.match((error as Error).message, /Access token has expired/i);
                return true;
              },
            );
          },
        );
      });
    });
  });
}

async function testManagedUsersCrudRulesInMemoryMode(): Promise<void> {
  await withDataSource("memory", async () => {
    await withAuthSecret("unit-test-secret", async () => {
      const service = createMemoryAuthService();
      const listedUsers = await service.listManagedUsers();
      assert.deepEqual(
        listedUsers.map((user) => user.name),
        ["Dev Admin", "Dev Super Admin"],
      );
      assert.equal(listedUsers.every((user) => user.hasPassword === true), true);

      const created = await service.createManagedUser({
        name: "  Rina Ops  ",
        email: "Rina.Ops@GhaniyaTravel.com",
        roleId: "customer-support",
      });
      assert.equal(created.name, "Rina Ops");
      assert.equal(created.email, "rina.ops@ghaniyatravel.com");
      assert.equal(created.roleId, "customer-support");
      assert.equal(created.hasPassword, false);

      const updated = await service.updateManagedUser("dev-admin", {
        name: "  Dev Admin Ops  ",
        email: "ADMIN.DEV@GHANIYA.LOCAL",
        roleId: "admin",
      });
      assert.equal(updated.name, "Dev Admin Ops");
      assert.equal(updated.email, "admin.dev@ghaniya.local");
      assert.equal(updated.roleId, "admin");
      assert.equal(Number.isNaN(Date.parse(updated.updatedAt)), false);

      await assertRejectsWithMessage(
        () =>
          service.updateManagedUser("dev-super-admin", {
            name: "Dev Super Admin",
            email: "admin.dev@ghaniya.local",
            roleId: "super-admin",
          }),
        ConflictException,
        /already used by another user/i,
      );

      await assertRejectsWithMessage(
        () =>
          service.createManagedUser({
            name: "Duplicate",
            email: "admin.dev@ghaniya.local",
            roleId: "admin",
          }),
        ConflictException,
        /already used by another user/i,
      );

      await assertRejectsWithMessage(
        () =>
          service.updateManagedUser("unknown-user", {
            name: "Unknown",
            email: "unknown@example.com",
            roleId: "admin",
          }),
        NotFoundException,
        /not found/i,
      );

      await service.deleteManagedUser(created.id);
      const usersAfterDelete = await service.listManagedUsers();
      assert.equal(
        usersAfterDelete.some((user) => user.id === created.id),
        false,
      );
    });
  });
}

async function testManagedUserPasswordProvisioningInMemoryMode(): Promise<void> {
  await withDataSource("memory", async () => {
    await withAuthSecret("unit-test-secret", async () => {
      const service = createMemoryAuthService();

      const created = await service.createManagedUser({
        name: "  Rina Access  ",
        email: "Rina.Access@GhaniyaTravel.com",
        roleId: "admin",
        password: "RinaAccess#2026",
      });
      assert.equal(created.hasPassword, true);

      const createdLogin = await service.login({
        identifier: "rina.access@ghaniyatravel.com",
        password: "RinaAccess#2026",
      });
      assert.equal(createdLogin.user.accessTier, "admin");

      const reset = await service.setManagedUserPassword("dev-admin", "DevAdminReset#2026");
      assert.equal(reset.hasPassword, true);

      const resetLogin = await service.login({
        identifier: "admin.dev@ghaniya.local",
        password: "DevAdminReset#2026",
      });
      assert.equal(resetLogin.user.accessTier, "admin");
    });
  });
}

async function main(): Promise<void> {
  await runCase("auth login and token verification", testLoginAndTokenVerificationWithDefaultLifetime);
  await runCase("auth remembered session lifetime", testLoginWithEmailAndRememberedSessionLifetime);
  await runCase("auth invalid credentials rejection", testLoginRejectsInvalidCredentials);
  await runCase("auth token tamper and expiry validation", testVerifyTokenRejectsTamperedSignatureAndExpiredToken);
  await runCase("managed users memory CRUD validation", testManagedUsersCrudRulesInMemoryMode);
  await runCase(
    "managed user password provisioning in memory mode",
    testManagedUserPasswordProvisioningInMemoryMode,
  );
}

void main().catch((error: unknown) => {
  console.error("Auth service test failed:", error);
  process.exitCode = 1;
});
