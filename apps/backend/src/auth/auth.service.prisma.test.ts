import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { withEnv } from "../test/with-env";
import { createHmac } from "node:crypto";
import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthUserRole, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  createLegacyScryptPasswordHashForTest,
  hashAuthPassword,
  verifyAuthPassword,
} from "./auth-password";
import { AuthService } from "./auth.service";

type PrismaAuthUserRecord = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: AuthUserRole;
  passwordHash: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaUserWhere = {
  OR?: PrismaUserWhere[];
  id?: string | { not?: string };
  email?: string;
  username?: string;
  role?: AuthUserRole;
  isActive?: boolean;
};

type PrismaMockOptions = {
  users?: PrismaAuthUserRecord[];
  failCreateOnce?: boolean;
  failCreateWithP2002?: boolean;
  failUpdateOnce?: boolean;
};

type PrismaMockState = {
  users: PrismaAuthUserRecord[];
  createCalls: number;
  findUniqueCalls: number;
  updateCalls: number;
};

type PrismaMock = PrismaService & {
  __state: PrismaMockState;
};

function selectFields<T extends object>(
  record: T,
  select: Record<string, unknown> | undefined,
): Record<string, unknown> | T {
  if (!select) {
    return record;
  }

  const result: Record<string, unknown> = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled) {
      result[key] = (record as Record<string, unknown>)[key];
    }
  }

  return result;
}

function matchesWhere(record: PrismaAuthUserRecord, where: PrismaUserWhere | undefined): boolean {
  if (!where) {
    return true;
  }

  if (where.OR && where.OR.length > 0) {
    const matchesAnyOr = where.OR.some((entry) => matchesWhere(record, entry));
    if (!matchesAnyOr) {
      return false;
    }
  }

  if (typeof where.id === "string" && record.id !== where.id) {
    return false;
  }

  if (typeof where.id === "object" && where.id?.not && record.id === where.id.not) {
    return false;
  }

  if (where.email !== undefined && record.email !== where.email) {
    return false;
  }

  if (where.username !== undefined && record.username !== where.username) {
    return false;
  }

  if (where.role !== undefined && record.role !== where.role) {
    return false;
  }

  if (where.isActive !== undefined && record.isActive !== where.isActive) {
    return false;
  }

  return true;
}

function createPrismaUser(overrides: Partial<PrismaAuthUserRecord>): PrismaAuthUserRecord {
  return {
    id: overrides.id ?? "usr-default",
    name: overrides.name ?? "Default User",
    email: overrides.email ?? "default.user@example.com",
    username: overrides.username ?? "default.user",
    role: overrides.role ?? "ADMIN",
    passwordHash:
      overrides.passwordHash === undefined ? hashAuthPassword("Password#2026") : overrides.passwordHash,
    isActive: overrides.isActive ?? true,
    createdAt: overrides.createdAt ?? new Date("2026-04-09T08:00:00.000Z"),
    updatedAt: overrides.updatedAt ?? new Date("2026-04-09T08:00:00.000Z"),
  };
}

function createPrismaServiceMock(options: PrismaMockOptions = {}): PrismaMock {
  const users = [...(options.users ?? [])];
  let failCreateOnce = Boolean(options.failCreateOnce);
  let failUpdateOnce = Boolean(options.failUpdateOnce);
  const state: PrismaMockState = {
    users,
    createCalls: 0,
    findUniqueCalls: 0,
    updateCalls: 0,
  };

  const mock = {
    __state: state,
    authUser: {
      findFirst: async (args: {
        where?: PrismaUserWhere;
        select?: Record<string, unknown>;
      }) => {
        const found = state.users.find((entry) => matchesWhere(entry, args.where));
        if (!found) {
          return null;
        }

        return selectFields(found, args.select);
      },
      findMany: async (args: {
        select?: Record<string, unknown>;
      }) => {
        const sorted = [...state.users].sort((left, right) => {
          const byName = left.name.localeCompare(right.name);
          if (byName !== 0) {
            return byName;
          }

          return left.createdAt.getTime() - right.createdAt.getTime();
        });

        return sorted.map((entry) => selectFields(entry, args.select));
      },
      findUnique: async (args: {
        where: { id?: string; email?: string; username?: string };
        select?: Record<string, unknown>;
      }) => {
        state.findUniqueCalls += 1;
        const found = state.users.find((entry) => {
          if (args.where.id && entry.id === args.where.id) {
            return true;
          }

          if (args.where.email && entry.email === args.where.email) {
            return true;
          }

          if (args.where.username && entry.username === args.where.username) {
            return true;
          }

          return false;
        });

        if (!found) {
          return null;
        }

        return selectFields(found, args.select);
      },
      create: async (args: {
        data: {
          name: string;
          email: string;
          username: string;
          role: AuthUserRole;
          passwordHash: string | null;
          isActive?: boolean;
        };
        select?: Record<string, unknown>;
      }) => {
        state.createCalls += 1;
        if (failCreateOnce) {
          failCreateOnce = false;
          throw new Error("bootstrap failure");
        }

        const duplicateUsername = state.users.some((entry) => entry.username === args.data.username);
        const duplicateEmail = state.users.some((entry) => entry.email === args.data.email);
        if (duplicateUsername || duplicateEmail || options.failCreateWithP2002) {
          throw new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "unit-test",
          });
        }

        const now = new Date();
        const created: PrismaAuthUserRecord = {
          id: `usr-${state.users.length + 1}`,
          name: args.data.name,
          email: args.data.email,
          username: args.data.username,
          role: args.data.role,
          passwordHash: args.data.passwordHash,
          isActive: args.data.isActive ?? true,
          createdAt: now,
          updatedAt: now,
        };
        state.users.push(created);
        return selectFields(created, args.select);
      },
      update: async (args: {
        where: { id: string };
        data: {
          name?: string;
          email?: string;
          role?: AuthUserRole;
          passwordHash?: string | null;
        };
        select?: Record<string, unknown>;
      }) => {
        state.updateCalls += 1;
        if (failUpdateOnce) {
          failUpdateOnce = false;
          throw new Error("password rehash failure");
        }

        const targetIndex = state.users.findIndex((entry) => entry.id === args.where.id);
        if (targetIndex === -1) {
          throw new NotFoundException(`User '${args.where.id}' not found.`);
        }

        const current = state.users[targetIndex];
        const updated: PrismaAuthUserRecord = {
          ...current,
          name: args.data.name ?? current.name,
          email: args.data.email ?? current.email,
          role: args.data.role ?? current.role,
          passwordHash:
            args.data.passwordHash === undefined ? current.passwordHash : args.data.passwordHash,
          updatedAt: new Date(),
        };
        state.users[targetIndex] = updated;
        return selectFields(updated, args.select);
      },
      delete: async (args: { where: { id: string } }) => {
        const targetIndex = state.users.findIndex((entry) => entry.id === args.where.id);
        if (targetIndex !== -1) {
          state.users.splice(targetIndex, 1);
        }
      },
      count: async (args: { where?: PrismaUserWhere }) => {
        return state.users.filter((entry) => matchesWhere(entry, args.where)).length;
      },
    },
  };

  return mock as unknown as PrismaMock;
}

function createSignature(unsignedToken: string, secret: string): string {
  return createHmac("sha256", secret).update(unsignedToken, "utf8").digest("base64url");
}

describe("AuthService (Prisma)", () => {
  runCase("prisma login and managed user CRUD", async () => {
    await withEnv(
      {
        DATA_SOURCE: "prisma",
        AUTH_SECRET: "unit-test-secret",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "false",
        NODE_ENV: "test",
      },
      async () => {
        const prisma = createPrismaServiceMock({
          users: [
            createPrismaUser({
              id: "usr-super",
              name: "Super Admin",
              email: "super.admin@example.com",
              username: "super.admin",
              role: "SUPER_ADMIN",
              passwordHash: hashAuthPassword("Super#2026"),
            }),
            createPrismaUser({
              id: "usr-admin",
              name: "Admin User",
              email: "admin.user@example.com",
              username: "admin.user",
              role: "ADMIN",
              passwordHash: hashAuthPassword("Admin#2026"),
            }),
            createPrismaUser({
              id: "usr-finance",
              name: "Finance User",
              email: "finance.user@example.com",
              username: "finance.user",
              role: "FINANCE_MANAGER",
              passwordHash: hashAuthPassword("Finance#2026"),
            }),
            createPrismaUser({
              id: "usr-existing",
              name: "Existing New User",
              email: "existing.new.user@example.com",
              username: "new.user",
              role: "CUSTOMER_SUPPORT",
              passwordHash: null,
            }),
          ],
        });

        const service = new AuthService(prisma);
        const loginResponse = await service.login({
          identifier: "  ADMIN.USER@EXAMPLE.COM  ",
          password: "Admin#2026",
          rememberSession: true,
        });

        expect(loginResponse.user.accessTier).toBe("admin");
        expect(loginResponse.rememberSession).toBe(true);
        expect(loginResponse.tokenType).toBe("Bearer");
        expect(loginResponse.user.email).toBe("admin.user@example.com");

        const managedUsers = await service.listManagedUsers();
        expect(managedUsers.length).toBe(4);
        expect(managedUsers[0].name).toBe("Admin User");
        expect(managedUsers.some((entry) => entry.roleId === "finance-manager")).toBe(true);
        expect(managedUsers.some((entry) => entry.hasPassword === false)).toBe(true);

        const created = await service.createManagedUser({
          name: "  New User  ",
          email: "New.User@example.com",
          roleId: "customer-support",
        });
        expect(created.name).toBe("New User");
        expect(created.email).toBe("new.user@example.com");
        expect(created.roleId).toBe("customer-support");
        expect(created.hasPassword).toBe(false);
        expect(
          prisma.__state.users.some((entry) => entry.username === "new.user.1"),
        ).toBe(true);

        const updated = await service.updateManagedUser(created.id, {
          name: "  New User Updated  ",
          email: "new.user.updated@example.com",
          roleId: "admin",
        });
        expect(updated.name).toBe("New User Updated");
        expect(updated.email).toBe("new.user.updated@example.com");
        expect(updated.roleId).toBe("admin");

        await service.deleteManagedUser(created.id);
        expect(
          prisma.__state.users.some((entry) => entry.id === created.id),
        ).toBe(false);
        expect(prisma.__state.findUniqueCalls > 0).toBe(true);
      },
    );
  });

  runCase("prisma managed user password provisioning", async () => {
    await withEnv(
      {
        DATA_SOURCE: "prisma",
        AUTH_SECRET: "unit-test-secret",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "false",
        NODE_ENV: "test",
      },
      async () => {
        const prisma = createPrismaServiceMock({
          users: [
            createPrismaUser({
              id: "usr-super",
              name: "Super Admin",
              email: "super.admin@example.com",
              username: "super.admin",
              role: "SUPER_ADMIN",
              passwordHash: hashAuthPassword("Super#2026"),
            }),
            createPrismaUser({
              id: "usr-operator",
              name: "Operator Admin",
              email: "operator.admin@example.com",
              username: "operator.admin",
              role: "ADMIN",
              passwordHash: null,
            }),
          ],
        });

        const service = new AuthService(prisma);
        const created = await service.createManagedUser({
          name: "  Access Admin  ",
          email: "Access.Admin@example.com",
          roleId: "admin",
          password: "AccessAdmin#2026",
        });
        expect(created.hasPassword).toBe(true);

        const createdLogin = await service.login({
          identifier: "access.admin@example.com",
          password: "AccessAdmin#2026",
        });
        expect(createdLogin.user.accessTier).toBe("admin");

        const reset = await service.setManagedUserPassword("usr-operator", "Operator#2026");
        expect(reset.hasPassword).toBe(true);

        const resetLogin = await service.login({
          identifier: "operator.admin@example.com",
          password: "Operator#2026",
        });
        expect(resetLogin.user.accessTier).toBe("admin");
      },
    );
  });

  runCase("prisma login upgrades legacy password hash", async () => {
    await withEnv(
      {
        DATA_SOURCE: "prisma",
        AUTH_SECRET: "unit-test-secret",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "false",
        NODE_ENV: "test",
      },
      async () => {
        const legacyHash = createLegacyScryptPasswordHashForTest("Admin#2026");
        const prisma = createPrismaServiceMock({
          users: [
            createPrismaUser({
              id: "usr-admin",
              name: "Admin User",
              email: "admin.user@example.com",
              username: "admin.user",
              role: "ADMIN",
              passwordHash: legacyHash,
            }),
          ],
        });

        const service = new AuthService(prisma);
        const loginResponse = await service.login({
          identifier: "admin.user@example.com",
          password: "Admin#2026",
        });

        expect(loginResponse.user.accessTier).toBe("admin");
        expect(prisma.__state.updateCalls).toBe(1);

        const upgradedHash = prisma.__state.users[0]?.passwordHash ?? "";
        expect(upgradedHash).not.toBe(legacyHash);
        expect(upgradedHash).toMatch(/^\$2[aby]\$\d{2}\$/);
        expect(verifyAuthPassword("Admin#2026", upgradedHash)).toBe(true);
      },
    );
  });

  runCase("prisma login tolerates legacy password rehash failure", async () => {
    await withEnv(
      {
        DATA_SOURCE: "prisma",
        AUTH_SECRET: "unit-test-secret",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "false",
        NODE_ENV: "test",
      },
      async () => {
        const legacyHash = createLegacyScryptPasswordHashForTest("Admin#2026");
        const prisma = createPrismaServiceMock({
          failUpdateOnce: true,
          users: [
            createPrismaUser({
              id: "usr-admin",
              name: "Admin User",
              email: "admin.user@example.com",
              username: "admin.user",
              role: "ADMIN",
              passwordHash: legacyHash,
            }),
          ],
        });

        const service = new AuthService(prisma);
        const loginResponse = await service.login({
          identifier: "admin.user@example.com",
          password: "Admin#2026",
        });

        expect(loginResponse.user.accessTier).toBe("admin");
        expect(prisma.__state.updateCalls).toBe(1);
        expect(prisma.__state.users[0]?.passwordHash).toBe(legacyHash);
      },
    );
  });

  runCase("prisma conflict and protection branches", async () => {
    await withEnv(
      {
        DATA_SOURCE: "prisma",
        AUTH_SECRET: "unit-test-secret",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "false",
        NODE_ENV: "test",
      },
      async () => {
        const prisma = createPrismaServiceMock({
          users: [
            createPrismaUser({
              id: "usr-super",
              name: "Solo Super Admin",
              email: "solo.super@example.com",
              username: "solo.super",
              role: "SUPER_ADMIN",
              passwordHash: hashAuthPassword("Super#2026"),
            }),
            createPrismaUser({
              id: "usr-admin",
              name: "Admin User",
              email: "admin.user@example.com",
              username: "admin.user",
              role: "ADMIN",
              passwordHash: hashAuthPassword("Admin#2026"),
            }),
            createPrismaUser({
              id: "usr-finance",
              name: "Finance User",
              email: "finance.user@example.com",
              username: "finance.user",
              role: "FINANCE_MANAGER",
              passwordHash: hashAuthPassword("Finance#2026"),
            }),
          ],
        });

        const service = new AuthService(prisma);

        await expect(
          service.login({
            identifier: "finance.user@example.com",
            password: "Finance#2026",
          }),
        ).rejects.toThrow(/not allowed/i);

        await expect(
          service.login({
            identifier: "admin.user@example.com",
            password: "wrong-password",
          }),
        ).rejects.toThrow(/invalid username\/email or password/i);

        await expect(
          service.createManagedUser({
            name: " ",
            email: " ",
            roleId: "admin",
          }),
        ).rejects.toThrow(/name and email are required/i);

        await expect(
          service.createManagedUser({
            name: "Duplicate",
            email: "ADMIN.USER@EXAMPLE.COM",
            roleId: "admin",
          }),
        ).rejects.toThrow(/already used by another user/i);

        await expect(
          service.updateManagedUser("missing-id", {
            name: "Missing",
            email: "missing@example.com",
            roleId: "admin",
          }),
        ).rejects.toThrow(/not found/i);

        await expect(
          service.updateManagedUser("usr-admin", {
            name: "Admin Duplicate",
            email: "solo.super@example.com",
            roleId: "admin",
          }),
        ).rejects.toThrow(/already used by another user/i);

        await expect(
          service.updateManagedUser("usr-super", {
            name: "Super Demoted",
            email: "solo.super@example.com",
            roleId: "admin",
          }),
        ).rejects.toThrow(/at least one super admin must remain/i);

        await expect(service.deleteManagedUser("usr-super")).rejects.toThrow(
          /at least one super admin must remain/i,
        );

        await expect(service.deleteManagedUser("missing-id")).rejects.toThrow(
          /not found/i,
        );
      },
    );
  });

  runCase("prisma bootstrap and retry", async () => {
    await withEnv(
      {
        DATA_SOURCE: "prisma",
        AUTH_SECRET: "unit-test-secret",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "true",
        NODE_ENV: "test",
        DEV_AUTH_SUPERADMIN_PASSWORD: undefined,
        DEV_AUTH_ADMIN_PASSWORD: undefined,
      },
      async () => {
        const prisma = createPrismaServiceMock();
        const service = new AuthService(prisma);

        await expect(service.listManagedUsers()).rejects.toThrow(
          /DEV_AUTH_SUPERADMIN_PASSWORD.*DEV_AUTH_ADMIN_PASSWORD/i,
        );
        expect(prisma.__state.createCalls).toBe(0);
      },
    );

    await withEnv(
      {
        DATA_SOURCE: "prisma",
        AUTH_SECRET: "unit-test-secret",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "true",
        DEV_AUTH_SUPERADMIN_PASSWORD: "BootstrapSuper#2026",
        DEV_AUTH_ADMIN_PASSWORD: "BootstrapAdmin#2026",
        NODE_ENV: "test",
      },
      async () => {
        const prisma = createPrismaServiceMock();
        const service = new AuthService(prisma);

        const firstList = await service.listManagedUsers();
        expect(firstList.length).toBe(2);
        expect(prisma.__state.createCalls).toBe(2);

        const secondList = await service.listManagedUsers();
        expect(secondList.length).toBe(2);
        expect(prisma.__state.createCalls).toBe(2);

        const failingPrisma = createPrismaServiceMock({ failCreateOnce: true });
        const failingService = new AuthService(failingPrisma);

        await expect(failingService.listManagedUsers()).rejects.toThrow(
          /bootstrap failure/i,
        );

        const recoveredList = await failingService.listManagedUsers();
        expect(recoveredList.length).toBe(2);
        expect(failingPrisma.__state.createCalls).toBe(3);
      },
    );
  });

  runCase("token validation and environment guards", async () => {
    await withEnv(
      {
        DATA_SOURCE: "memory",
        AUTH_SECRET: "unit-test-secret",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "false",
        NODE_ENV: "test",
      },
      async () => {
        const service = new AuthService({} as PrismaService);
        const validLogin = await service.login({
          identifier: "dev.superadmin",
          password: "DevSuperAdmin#2026",
        });
        expect(validLogin.tokenType).toBe("Bearer");

        expect(() => service.verifyAccessToken("invalid-token")).toThrow(
          /invalid access token format/i,
        );

        const encodedHeader = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString("base64url");
        const invalidPayload = "%%%";
        const invalidPayloadToken = `${encodedHeader}.${invalidPayload}.${createSignature(
          `${encodedHeader}.${invalidPayload}`,
          "unit-test-secret",
        )}`;
        expect(() => service.verifyAccessToken(invalidPayloadToken)).toThrow(
          /invalid access token payload/i,
        );

        const encodedStringHeader = Buffer.from(JSON.stringify("not-an-object"), "utf8").toString("base64url");
        const encodedMinimalPayload = Buffer.from(
          JSON.stringify({
            id: "id-1",
            name: "Name",
            username: "username",
            email: "email@example.com",
            accessTier: "admin",
            exp: Math.floor(Date.now() / 1000) + 60,
          }),
          "utf8",
        ).toString("base64url");
        const invalidHeaderToken = `${encodedStringHeader}.${encodedMinimalPayload}.${createSignature(
          `${encodedStringHeader}.${encodedMinimalPayload}`,
          "unit-test-secret",
        )}`;
        expect(() => service.verifyAccessToken(invalidHeaderToken)).toThrow(
          /invalid access token header/i,
        );

        const encodedInvalidClaimsPayload = Buffer.from(
          JSON.stringify({
            id: "id-1",
            name: "Name",
            username: "username",
            email: "email@example.com",
            accessTier: "admin",
            exp: -100,
          }),
          "utf8",
        ).toString("base64url");
        const invalidClaimsToken = `${encodedHeader}.${encodedInvalidClaimsPayload}.${createSignature(
          `${encodedHeader}.${encodedInvalidClaimsPayload}`,
          "unit-test-secret",
        )}`;
        expect(() => service.verifyAccessToken(invalidClaimsToken)).toThrow(
          /invalid access token claims/i,
        );
      },
    );

    await withEnv(
      {
        DATA_SOURCE: "memory",
        AUTH_SECRET: undefined,
        NODE_ENV: "production",
      },
      async () => {
        expect(() => new AuthService({} as PrismaService)).toThrow(
          /AUTH_SECRET is required in production/i,
        );
      },
    );

    await withEnv(
      {
        DATA_SOURCE: "prisma",
        AUTH_SECRET: "unit-test-secret",
        AUTH_BOOTSTRAP_DEFAULT_USERS: undefined,
        DEV_AUTH_SUPERADMIN_PASSWORD: "UnusedSuper#2026",
        DEV_AUTH_ADMIN_PASSWORD: "UnusedAdmin#2026",
        NODE_ENV: "test",
      },
      async () => {
        const prisma = createPrismaServiceMock({
          users: [
            createPrismaUser({
              id: "usr-admin",
              name: "Admin User",
              email: "admin.user@example.com",
              username: "admin.user",
              role: "ADMIN",
              passwordHash: hashAuthPassword("Admin#2026"),
            }),
          ],
        });

        const service = new AuthService(prisma);
        const response = await service.login({
          identifier: "admin.user@example.com",
          password: "Admin#2026",
        });
        expect(response.user.accessTier).toBe("admin");
        expect(prisma.__state.findUniqueCalls).toBe(0);
        expect(prisma.__state.createCalls).toBe(0);
      },
    );

    await withEnv(
      {
        DATA_SOURCE: "memory",
        AUTH_SECRET: undefined,
        NODE_ENV: "development",
      },
      async () => {
        const service = new AuthService({} as PrismaService);
        const response = await service.login({
          identifier: "dev.admin",
          password: "DevAdmin#2026",
        });
        expect(response.user.accessTier).toBe("admin");
      },
    );
  });
});
