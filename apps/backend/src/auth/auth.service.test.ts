import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { withDataSource } from "../test/with-data-source";
import { withAuthSecret } from "../test/with-auth-secret";
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

const FIXED_NOW_EPOCH_MS = Date.parse("2026-04-09T08:00:00.000Z");
const ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60;
const REMEMBERED_TOKEN_LIFETIME_SECONDS = 60 * 60 * 24;

async function withFixedNow<T>(epochMs: number, fn: () => Promise<T>): Promise<T> {
  const originalNow = Date.now;
  Date.now = () => epochMs;
  try {
    return await fn();
  } finally {
    Date.now = originalNow;
  }
}

function createMemoryAuthService(): AuthService {
  return new AuthService({} as PrismaService);
}

describe("AuthService", () => {
  runCase("login and token verification with default lifetime", async () => {
    await withDataSource("memory", async () => {
      await withAuthSecret("unit-test-secret", async () => {
        await withFixedNow(FIXED_NOW_EPOCH_MS, async () => {
          const service = createMemoryAuthService();
          const response = await service.login({
            identifier: "  Dev.SuperAdmin  ",
            password: "DevSuperAdmin#2026",
          });

          expect(response.tokenType).toBe("Bearer");
          expect(response.rememberSession).toBe(false);
          expect(response.user.username).toBe("dev.superadmin");

          const expectedExpiresAt = new Date(
            (Math.floor(FIXED_NOW_EPOCH_MS / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS) * 1000,
          ).toISOString();
          expect(response.expiresAt).toBe(expectedExpiresAt);

          const verifiedPayload = service.verifyAccessToken(response.accessToken);
          expect(verifiedPayload.id).toBe("dev-super-admin");
          expect(verifiedPayload.username).toBe("dev.superadmin");
          expect(verifiedPayload.exp).toBe(
            Math.floor(FIXED_NOW_EPOCH_MS / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS,
          );
        });
      });
    });
  });

  runCase("login with email and remembered session lifetime", async () => {
    await withDataSource("memory", async () => {
      await withAuthSecret("unit-test-secret", async () => {
        await withFixedNow(FIXED_NOW_EPOCH_MS, async () => {
          const service = createMemoryAuthService();
          const response = await service.login({
            identifier: "  ADMIN.DEV@GHANIYA.LOCAL  ",
            password: "DevAdmin#2026",
            rememberSession: true,
          });

          expect(response.user.username).toBe("dev.admin");
          expect(response.rememberSession).toBe(true);

          const verifiedPayload = service.verifyAccessToken(response.accessToken);
          expect(verifiedPayload.exp).toBe(
            Math.floor(FIXED_NOW_EPOCH_MS / 1000) + REMEMBERED_TOKEN_LIFETIME_SECONDS,
          );
        });
      });
    });
  });

  runCase("login rejects invalid credentials", async () => {
    await withDataSource("memory", async () => {
      await withAuthSecret("unit-test-secret", async () => {
        const service = createMemoryAuthService();
        await expect(
          service.login({
            identifier: "dev.superadmin",
            password: "wrong-password",
          }),
        ).rejects.toThrow(/Invalid username\/email or password/i);
      });
    });
  });

  runCase("verify token rejects tampered signature and expired token", async () => {
    await withDataSource("memory", async () => {
      await withAuthSecret("unit-test-secret", async () => {
        await withFixedNow(FIXED_NOW_EPOCH_MS, async () => {
          const service = createMemoryAuthService();
          const response = await service.login({
            identifier: "dev.superadmin",
            password: "DevSuperAdmin#2026",
          });

          const [header, payload, signature] = response.accessToken.split(".");
          expect(Boolean(header && payload && signature)).toBe(true);

          const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<
            string,
            unknown
          >;
          const tamperedPayload = Buffer.from(
            JSON.stringify({
              ...decodedPayload,
              rememberSession: !(decodedPayload.rememberSession === true),
            }),
            "utf8",
          ).toString("base64url");
          expect(() =>
            service.verifyAccessToken(`${header}.${tamperedPayload}.${signature}`),
          ).toThrow(/Invalid access token signature/i);

          await withFixedNow(
            (Math.floor(FIXED_NOW_EPOCH_MS / 1000) + ACCESS_TOKEN_LIFETIME_SECONDS + 1) * 1000,
            async () => {
              expect(() => service.verifyAccessToken(response.accessToken)).toThrow(
                /Access token has expired/i,
              );
            },
          );
        });
      });
    });
  });

  runCase("managed users memory CRUD validation", async () => {
    await withDataSource("memory", async () => {
      await withAuthSecret("unit-test-secret", async () => {
        const service = createMemoryAuthService();
        const listedUsers = await service.listManagedUsers();
        expect(listedUsers.map((user) => user.name)).toEqual([
          "Dev Admin",
          "Dev Super Admin",
        ]);
        expect(listedUsers.every((user) => user.hasPassword === true)).toBe(true);

        const created = await service.createManagedUser({
          name: "  Rina Ops  ",
          email: "Rina.Ops@GhaniyaTravel.com",
          roleId: "customer-support",
        });
        expect(created.name).toBe("Rina Ops");
        expect(created.email).toBe("rina.ops@ghaniyatravel.com");
        expect(created.roleId).toBe("customer-support");
        expect(created.hasPassword).toBe(false);

        const updated = await service.updateManagedUser("dev-admin", {
          name: "  Dev Admin Ops  ",
          email: "ADMIN.DEV@GHANIYA.LOCAL",
          roleId: "admin",
        });
        expect(updated.name).toBe("Dev Admin Ops");
        expect(updated.email).toBe("admin.dev@ghaniya.local");
        expect(updated.roleId).toBe("admin");
        expect(Number.isNaN(Date.parse(updated.updatedAt))).toBe(false);

        await expect(
          service.updateManagedUser("dev-super-admin", {
            name: "Dev Super Admin",
            email: "admin.dev@ghaniya.local",
            roleId: "super-admin",
          }),
        ).rejects.toThrow(/already used by another user/i);

        await expect(
          service.createManagedUser({
            name: "Duplicate",
            email: "admin.dev@ghaniya.local",
            roleId: "admin",
          }),
        ).rejects.toThrow(/already used by another user/i);

        await expect(
          service.updateManagedUser("unknown-user", {
            name: "Unknown",
            email: "unknown@example.com",
            roleId: "admin",
          }),
        ).rejects.toThrow(/not found/i);

        await service.deleteManagedUser(created.id);
        const usersAfterDelete = await service.listManagedUsers();
        expect(usersAfterDelete.some((user) => user.id === created.id)).toBe(false);
      });
    });
  });

  runCase("managed user password provisioning in memory mode", async () => {
    await withDataSource("memory", async () => {
      await withAuthSecret("unit-test-secret", async () => {
        const service = createMemoryAuthService();

        const created = await service.createManagedUser({
          name: "  Rina Access  ",
          email: "Rina.Access@GhaniyaTravel.com",
          roleId: "admin",
          password: "RinaAccess#2026",
        });
        expect(created.hasPassword).toBe(true);

        const createdLogin = await service.login({
          identifier: "rina.access@ghaniyatravel.com",
          password: "RinaAccess#2026",
        });
        expect(createdLogin.user.accessTier).toBe("admin");

        const reset = await service.setManagedUserPassword("dev-admin", "DevAdminReset#2026");
        expect(reset.hasPassword).toBe(true);

        const resetLogin = await service.login({
          identifier: "admin.dev@ghaniya.local",
          password: "DevAdminReset#2026",
        });
        expect(resetLogin.user.accessTier).toBe("admin");
      });
    });
  });
});
