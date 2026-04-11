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
      password: passwordOverrides?.superAdminPassword?.trim() || "DevSuperAdmin#2026",
    },
    {
      name: "Dev Admin",
      username: "dev.admin",
      email: "admin.dev@ghaniya.local",
      roleId: "admin",
      password: passwordOverrides?.adminPassword?.trim() || "DevAdmin#2026",
    },
    {
      name: "Operator Admin",
      username: "operator.admin",
      email: "operator.admin@ghaniyatravel.com",
      roleId: "admin",
      password: null,
    },
    {
      name: "Mila Finance",
      username: "mila.finance",
      email: "mila.finance@ghaniyatravel.com",
      roleId: "finance-manager",
      password: null,
    },
    {
      name: "Hadi Support",
      username: "hadi.support",
      email: "hadi.support@ghaniyatravel.com",
      roleId: "customer-support",
      password: null,
    },
  ];

  return defaults.map((entry) => ({
    ...entry,
    username: normalizeAuthUsername(entry.username),
    email: normalizeAuthEmail(entry.email),
  }));
}

export function createDefaultAuthUserStorageRecords(): DefaultAuthUserStorageRecord[] {
  return createDefaultAuthUserSeeds().map((entry) => ({
    name: entry.name.trim(),
    username: normalizeAuthUsername(entry.username),
    email: normalizeAuthEmail(entry.email),
    role: mapManagedRoleToPrismaRole(entry.roleId),
    passwordHash: entry.password ? hashAuthPassword(entry.password) : null,
    isActive: true,
  }));
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
