import type { AuthUserRole } from "@prisma/client";
import { hashAuthPassword } from "./auth-password";
import type { AuthAccessTier, AuthManagedUserRole } from "./auth.types";

export type DefaultAuthUserSeed = {
  name: string;
  username: string;
  email: string;
  roleId: AuthManagedUserRole;
  password: string | null;
};

export type DefaultAuthUserStorageRecord = {
  name: string;
  username: string;
  email: string;
  role: AuthUserRole;
  passwordHash: string | null;
  isActive: boolean;
};

type DefaultAuthUserPasswordOverrides = {
  superAdminPassword?: string;
  adminPassword?: string;
};

function normalizeOptionalPassword(value: string | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized || null;
}

export function requireDefaultAuthUserPasswordOverrides(
  passwordOverrides?: DefaultAuthUserPasswordOverrides,
): Required<DefaultAuthUserPasswordOverrides> {
  const superAdminPassword = normalizeOptionalPassword(passwordOverrides?.superAdminPassword);
  const adminPassword = normalizeOptionalPassword(passwordOverrides?.adminPassword);
  if (!superAdminPassword || !adminPassword) {
    const missingVariables: string[] = [];
    if (!superAdminPassword) {
      missingVariables.push("DEV_AUTH_SUPERADMIN_PASSWORD");
    }

    if (!adminPassword) {
      missingVariables.push("DEV_AUTH_ADMIN_PASSWORD");
    }

    throw new Error(
      `${missingVariables.join(" and ")} must be set before seeding or bootstrapping Prisma auth users.`,
    );
  }

  return {
    superAdminPassword,
    adminPassword,
  };
}

export function normalizeAuthUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeAuthEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeAuthIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

export function mapManagedRoleToPrismaRole(roleId: AuthManagedUserRole): AuthUserRole {
  if (roleId === "super-admin") {
    return "SUPER_ADMIN";
  }

  if (roleId === "admin") {
    return "ADMIN";
  }

  if (roleId === "finance-manager") {
    return "FINANCE_MANAGER";
  }

  return "CUSTOMER_SUPPORT";
}

export function mapPrismaRoleToManagedRole(role: AuthUserRole): AuthManagedUserRole {
  if (role === "SUPER_ADMIN") {
    return "super-admin";
  }

  if (role === "ADMIN") {
    return "admin";
  }

  if (role === "FINANCE_MANAGER") {
    return "finance-manager";
  }

  return "customer-support";
}

export function mapPrismaRoleToAccessTier(role: AuthUserRole): AuthAccessTier | null {
  if (role === "SUPER_ADMIN") {
    return "super-admin";
  }

  if (role === "ADMIN") {
    return "admin";
  }

  return null;
}

export function createDefaultAuthUserSeeds(
  passwordOverrides?: DefaultAuthUserPasswordOverrides,
): DefaultAuthUserSeed[] {
  const defaults: DefaultAuthUserSeed[] = [
    {
      name: "Dev Super Admin",
      username: "dev.superadmin",
      email: "superadmin.dev@ghaniya.local",
      roleId: "super-admin",
      password: normalizeOptionalPassword(passwordOverrides?.superAdminPassword),
    },
    {
      name: "Dev Admin",
      username: "dev.admin",
      email: "admin.dev@ghaniya.local",
      roleId: "admin",
      password: normalizeOptionalPassword(passwordOverrides?.adminPassword),
    },
  ];

  return defaults.map((entry) => ({
    ...entry,
    username: normalizeAuthUsername(entry.username),
    email: normalizeAuthEmail(entry.email),
  }));
}

export function createDefaultAuthUserStorageRecords(): DefaultAuthUserStorageRecord[] {
  return createDefaultAuthUserStorageRecordsWithOverrides(
    requireDefaultAuthUserPasswordOverrides(),
  );
}

export function createDefaultAuthUserStorageRecordsWithOverrides(
  passwordOverrides?: DefaultAuthUserPasswordOverrides,
): DefaultAuthUserStorageRecord[] {
  return createDefaultAuthUserSeeds(passwordOverrides).map((entry) => ({
    name: entry.name.trim(),
    username: normalizeAuthUsername(entry.username),
    email: normalizeAuthEmail(entry.email),
    role: mapManagedRoleToPrismaRole(entry.roleId),
    passwordHash: entry.password ? hashAuthPassword(entry.password) : null,
    isActive: true,
  }));
}
