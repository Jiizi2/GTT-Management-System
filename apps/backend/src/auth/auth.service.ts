import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthUserRole, Prisma } from "@prisma/client";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  resolveConfiguredBoolean,
  resolveConfiguredDataSource,
  resolveConfiguredNodeEnv,
  resolveConfiguredString,
} from "../config/app-config";
import { PrismaService } from "../prisma/prisma.service";
import {
  createDefaultAuthUserStorageRecordsWithOverrides,
  mapManagedRoleToPrismaRole,
  mapPrismaRoleToAccessTier,
  mapPrismaRoleToManagedRole,
  normalizeAuthEmail,
  normalizeAuthIdentifier,
  requireDefaultAuthUserPasswordOverrides,
} from "./auth-default-users";
import {
  hashAuthPassword,
  hashAuthPasswordAsync,
  isLegacyAuthPasswordHash,
  verifyAuthPasswordAsync,
} from "./auth-password";
import { LoginDto } from "./dto/login.dto";
import {
  type AuthLoginResponse,
  type AuthManagedUser,
  type AuthManagedUserRole,
  type AuthSessionUser,
  type AuthTokenPayload,
} from "./auth.types";

type AuthManagedUserRecord = {
  id: string;
  name: string;
  username: string;
  email: string;
  roleId: AuthManagedUserRole;
  passwordHash: string | null;
  updatedAtEpochMs: number;
};

const TOKEN_TYPE = "Bearer" as const;
const HEADER_TEMPLATE = { alg: "HS256", typ: "JWT" };
const DEFAULT_AUTH_SECRET = "gtt-dev-auth-secret-please-change-in-production";
const MINIMUM_PRODUCTION_AUTH_SECRET_LENGTH = 32;

const ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60 * 12;
const REMEMBERED_ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 14;

function base64UrlEncodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeBase64UrlJson(value: string): unknown {
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  return JSON.parse(decoded) as unknown;
}

function normalizeManagedUserName(value: string): string {
  return value.trim();
}

function normalizeManagedUserEmail(value: string): string {
  return normalizeAuthEmail(value);
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.floor(value);
  return rounded > 0 ? rounded : null;
}

function parseAuthTokenPayload(value: unknown): AuthTokenPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const username = typeof record.username === "string" ? record.username.trim() : "";
  const email = typeof record.email === "string" ? record.email.trim() : "";
  const accessTier =
    record.accessTier === "super-admin" || record.accessTier === "admin"
      ? record.accessTier
      : null;
  const exp = toPositiveInteger(record.exp);
  const rememberSession = typeof record.rememberSession === "boolean" ? record.rememberSession : null;

  if (!id || !name || !username || !email || !accessTier || !exp || rememberSession === null) {
    return null;
  }

  return {
    id,
    name,
    username,
    email,
    accessTier,
    exp,
    rememberSession,
  };
}

function resolveAuthSecret(configService?: ConfigService): string {
  const configured = resolveConfiguredString(configService, "AUTH_SECRET");
  const nodeEnv = resolveConfiguredNodeEnv(configService);

  if (configured) {
    if (nodeEnv === "production" && configured.length < MINIMUM_PRODUCTION_AUTH_SECRET_LENGTH) {
      throw new Error(
        `AUTH_SECRET must be at least ${MINIMUM_PRODUCTION_AUTH_SECRET_LENGTH} characters in production.`,
      );
    }

    if (nodeEnv === "production" && configured === DEFAULT_AUTH_SECRET) {
      throw new Error("AUTH_SECRET must not use the development default value in production.");
    }

    return configured;
  }

  if (nodeEnv === "production") {
    throw new Error("AUTH_SECRET is required in production.");
  }

  return DEFAULT_AUTH_SECRET;
}

function resolveShouldBootstrapPrismaAuthUsers(configService?: ConfigService): boolean {
  const configured = resolveConfiguredBoolean(configService, "AUTH_BOOTSTRAP_DEFAULT_USERS");
  if (configured !== true) {
    return false;
  }

  const nodeEnv = resolveConfiguredNodeEnv(configService);
  if (nodeEnv === "production") {
    throw new Error("AUTH_BOOTSTRAP_DEFAULT_USERS must be false in production.");
  }

  return true;
}

function createDefaultManagedUsers(configService?: ConfigService): AuthManagedUserRecord[] {
  const now = Date.now();
  const defaultSuperAdminPassword =
    resolveConfiguredString(configService, "DEV_AUTH_SUPERADMIN_PASSWORD") || "DevSuperAdmin#2026";
  const defaultAdminPassword =
    resolveConfiguredString(configService, "DEV_AUTH_ADMIN_PASSWORD") || "DevAdmin#2026";

  return [
    {
      id: "dev-super-admin",
      name: "Dev Super Admin",
      username: "dev.superadmin",
      email: "superadmin.dev@ghaniya.local",
      roleId: "super-admin",
      passwordHash: hashAuthPassword(defaultSuperAdminPassword),
      updatedAtEpochMs: now,
    },
    {
      id: "dev-admin",
      name: "Dev Admin",
      username: "dev.admin",
      email: "admin.dev@ghaniya.local",
      roleId: "admin",
      passwordHash: hashAuthPassword(defaultAdminPassword),
      updatedAtEpochMs: now,
    },
  ];
}

function normalizeUsernameCandidate(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, ".")
    .replace(/[._-]{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");

  return normalized || "user";
}

function mapManagedRoleToAccessTier(roleId: AuthManagedUserRole): AuthSessionUser["accessTier"] | null {
  return mapPrismaRoleToAccessTier(mapManagedRoleToPrismaRole(roleId));
}

@Injectable()
export class AuthService {
  private readonly authSecret: string;
  private readonly dataSource: "memory" | "prisma";
  private readonly shouldBootstrapPrismaAuthUsers: boolean;
  private readonly managedUsers: AuthManagedUserRecord[];
  private prismaBootstrapPromise: Promise<void> | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {
    this.authSecret = resolveAuthSecret(this.configService);
    this.dataSource = resolveConfiguredDataSource(this.configService);
    this.shouldBootstrapPrismaAuthUsers = resolveShouldBootstrapPrismaAuthUsers(this.configService);
    this.managedUsers = createDefaultManagedUsers(this.configService);
  }

  async login(payload: LoginDto): Promise<AuthLoginResponse> {
    if (this.dataSource === "prisma") {
      await this.ensurePrismaAuthUsersSeeded();
      return this.loginWithPrisma(payload);
    }

    return this.loginWithMemory(payload);
  }

  verifyAccessToken(token: string): AuthTokenPayload {
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      throw new UnauthorizedException("Invalid access token format.");
    }

    const [encodedHeader, encodedPayload, providedSignature] = tokenParts;
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.createSignature(unsignedToken);
    const providedSignatureBuffer = Buffer.from(providedSignature, "utf8");
    const expectedSignatureBuffer = Buffer.from(expectedSignature, "utf8");

    if (
      providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
      !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
    ) {
      throw new UnauthorizedException("Invalid access token signature.");
    }

    let headerJson: unknown;
    let payloadJson: unknown;
    try {
      headerJson = decodeBase64UrlJson(encodedHeader);
      payloadJson = decodeBase64UrlJson(encodedPayload);
    } catch {
      throw new UnauthorizedException("Invalid access token payload.");
    }

    if (!headerJson || typeof headerJson !== "object") {
      throw new UnauthorizedException("Invalid access token header.");
    }

    const tokenPayload = parseAuthTokenPayload(payloadJson);
    if (!tokenPayload) {
      throw new UnauthorizedException("Invalid access token claims.");
    }

    const nowEpochSeconds = Math.floor(Date.now() / 1000);
    if (tokenPayload.exp <= nowEpochSeconds) {
      throw new UnauthorizedException("Access token has expired.");
    }

    return tokenPayload;
  }

  async listManagedUsers(): Promise<AuthManagedUser[]> {
    if (this.dataSource === "prisma") {
      await this.ensurePrismaAuthUsersSeeded();
      return this.listManagedUsersWithPrisma();
    }

    return this.listManagedUsersFromMemory();
  }

  async createManagedUser(payload: {
    name: string;
    email: string;
    roleId: AuthManagedUserRole;
    password?: string;
  }): Promise<AuthManagedUser> {
    if (this.dataSource === "prisma") {
      await this.ensurePrismaAuthUsersSeeded();
      return this.createManagedUserWithPrisma(payload);
    }

    return this.createManagedUserInMemory(payload);
  }

  async updateManagedUser(
    userId: string,
    payload: { name: string; email: string; roleId: AuthManagedUserRole },
  ): Promise<AuthManagedUser> {
    if (this.dataSource === "prisma") {
      await this.ensurePrismaAuthUsersSeeded();
      return this.updateManagedUserWithPrisma(userId, payload);
    }

    return this.updateManagedUserInMemory(userId, payload);
  }

  async deleteManagedUser(userId: string): Promise<void> {
    if (this.dataSource === "prisma") {
      await this.ensurePrismaAuthUsersSeeded();
      await this.deleteManagedUserWithPrisma(userId);
      return;
    }

    this.deleteManagedUserInMemory(userId);
  }

  async setManagedUserPassword(userId: string, password: string): Promise<AuthManagedUser> {
    if (this.dataSource === "prisma") {
      await this.ensurePrismaAuthUsersSeeded();
      return this.setManagedUserPasswordWithPrisma(userId, password);
    }

    return this.setManagedUserPasswordInMemory(userId, password);
  }

  private signToken(payload: AuthTokenPayload): string {
    const encodedHeader = base64UrlEncodeJson(HEADER_TEMPLATE);
    const encodedPayload = base64UrlEncodeJson(payload);
    const unsignedToken = `${encodedHeader}.${encodedPayload}`;
    const signature = this.createSignature(unsignedToken);
    return `${unsignedToken}.${signature}`;
  }

  private createSignature(unsignedToken: string): string {
    return createHmac("sha256", this.authSecret)
      .update(unsignedToken, "utf8")
      .digest("base64url");
  }

  private toManagedUser(user: AuthManagedUserRecord): AuthManagedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      hasPassword: Boolean(user.passwordHash),
      updatedAt: new Date(user.updatedAtEpochMs).toISOString(),
    };
  }

  private toManagedUserFromPrisma(user: {
    id: string;
    name: string;
    email: string;
    role: AuthUserRole;
    passwordHash: string | null;
    updatedAt: Date;
  }): AuthManagedUser {
    return {
      id: user.id,
      name: user.name,
      email: normalizeManagedUserEmail(user.email),
      roleId: mapPrismaRoleToManagedRole(user.role),
      hasPassword: Boolean(user.passwordHash),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private buildLoginResponse({
    account,
    rememberSession,
  }: {
    account: AuthSessionUser;
    rememberSession: boolean;
  }): AuthLoginResponse {
    const tokenLifetimeSeconds = rememberSession
      ? REMEMBERED_ACCESS_TOKEN_LIFETIME_SECONDS
      : ACCESS_TOKEN_LIFETIME_SECONDS;
    const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + tokenLifetimeSeconds;
    const tokenPayload: AuthTokenPayload = {
      ...account,
      exp: expiresAtEpochSeconds,
      rememberSession,
    };
    const accessToken = this.signToken(tokenPayload);

    return {
      accessToken,
      tokenType: TOKEN_TYPE,
      expiresAt: new Date(expiresAtEpochSeconds * 1000).toISOString(),
      rememberSession,
      user: account,
    };
  }

  private async loginWithMemory(payload: LoginDto): Promise<AuthLoginResponse> {
    const identifier = normalizeAuthIdentifier(payload.identifier);
    const password = payload.password;
    const rememberSession = Boolean(payload.rememberSession);

    const managedUser = this.managedUsers.find((entry) => {
      return (
        normalizeAuthIdentifier(entry.username) === identifier ||
        normalizeAuthIdentifier(entry.email) === identifier
      );
    });

    if (!managedUser?.passwordHash || !(await verifyAuthPasswordAsync(password, managedUser.passwordHash))) {
      throw new UnauthorizedException("Invalid username/email or password.");
    }

    const accessTier = mapManagedRoleToAccessTier(managedUser.roleId);
    if (!accessTier) {
      throw new UnauthorizedException("Account is not allowed to access dashboard login.");
    }

    return this.buildLoginResponse({
      account: {
        id: managedUser.id,
        name: managedUser.name,
        username: managedUser.username,
        email: managedUser.email,
        accessTier,
      },
      rememberSession,
    });
  }

  private async loginWithPrisma(payload: LoginDto): Promise<AuthLoginResponse> {
    const identifier = normalizeAuthIdentifier(payload.identifier);
    const password = payload.password;
    const rememberSession = Boolean(payload.rememberSession);

    const account = await this.prisma.authUser.findFirst({
      where: {
        isActive: true,
        OR: [{ username: identifier }, { email: identifier }],
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!account?.passwordHash || !(await verifyAuthPasswordAsync(password, account.passwordHash))) {
      throw new UnauthorizedException("Invalid username/email or password.");
    }

    if (isLegacyAuthPasswordHash(account.passwordHash)) {
      await this.upgradeLegacyPasswordHash(account.id, password);
    }

    const accessTier = mapPrismaRoleToAccessTier(account.role);
    if (!accessTier) {
      throw new UnauthorizedException("Account is not allowed to access dashboard login.");
    }

    return this.buildLoginResponse({
      account: {
        id: account.id,
        name: account.name,
        username: account.username,
        email: account.email,
        accessTier,
      },
      rememberSession,
    });
  }

  private listManagedUsersFromMemory(): AuthManagedUser[] {
    return this.managedUsers
      .map((user) => this.toManagedUser(user))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private async listManagedUsersWithPrisma(): Promise<AuthManagedUser[]> {
    const users = await this.prisma.authUser.findMany({
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
        updatedAt: true,
      },
    });

    return users.map((user) => this.toManagedUserFromPrisma(user));
  }

  private async createManagedUserInMemory(payload: {
    name: string;
    email: string;
    roleId: AuthManagedUserRole;
    password?: string;
  }): Promise<AuthManagedUser> {
    const normalizedName = normalizeManagedUserName(payload.name);
    const normalizedEmail = normalizeManagedUserEmail(payload.email);
    if (!normalizedName || !normalizedEmail) {
      throw new ConflictException("Name and email are required.");
    }

    const duplicateEmailOwner = this.managedUsers.find(
      (entry) => normalizeManagedUserEmail(entry.email) === normalizedEmail,
    );
    if (duplicateEmailOwner) {
      throw new ConflictException(`Email '${normalizedEmail}' is already used by another user.`);
    }

    const username = this.allocateMemoryUsername(normalizedEmail);
    const nextUser: AuthManagedUserRecord = {
      id: `usr-${Date.now().toString(36)}`,
      name: normalizedName,
      username,
      email: normalizedEmail,
      roleId: payload.roleId,
      passwordHash: payload.password?.trim()
        ? await hashAuthPasswordAsync(payload.password.trim())
        : null,
      updatedAtEpochMs: Date.now(),
    };
    this.managedUsers.unshift(nextUser);

    return this.toManagedUser(nextUser);
  }

  private async createManagedUserWithPrisma(payload: {
    name: string;
    email: string;
    roleId: AuthManagedUserRole;
    password?: string;
  }): Promise<AuthManagedUser> {
    const normalizedName = normalizeManagedUserName(payload.name);
    const normalizedEmail = normalizeManagedUserEmail(payload.email);
    if (!normalizedName || !normalizedEmail) {
      throw new ConflictException("Name and email are required.");
    }

    const duplicateEmailOwner = await this.prisma.authUser.findUnique({
      where: {
        email: normalizedEmail,
      },
      select: {
        id: true,
      },
    });
    if (duplicateEmailOwner) {
      throw new ConflictException(`Email '${normalizedEmail}' is already used by another user.`);
    }

    const username = await this.allocateUsername(normalizedEmail);
    try {
      const passwordHash = payload.password?.trim()
        ? await hashAuthPasswordAsync(payload.password.trim())
        : null;
      const created = await this.prisma.authUser.create({
        data: {
          name: normalizedName,
          email: normalizedEmail,
          username,
          role: mapManagedRoleToPrismaRole(payload.roleId),
          passwordHash,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          passwordHash: true,
          updatedAt: true,
        },
      });

      return this.toManagedUserFromPrisma(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Username/email already exists.");
      }

      throw error;
    }
  }

  private updateManagedUserInMemory(
    userId: string,
    payload: { name: string; email: string; roleId: AuthManagedUserRole },
  ): AuthManagedUser {
    const normalizedUserId = userId.trim();
    const targetIndex = this.managedUsers.findIndex((user) => user.id === normalizedUserId);
    if (targetIndex === -1) {
      throw new NotFoundException(`User '${userId}' not found.`);
    }

    const normalizedName = normalizeManagedUserName(payload.name);
    const normalizedEmail = normalizeManagedUserEmail(payload.email);
    if (!normalizedName || !normalizedEmail) {
      throw new ConflictException("Name and email are required.");
    }

    const duplicateEmailOwner = this.managedUsers.find(
      (entry, index) => index !== targetIndex && normalizeManagedUserEmail(entry.email) === normalizedEmail,
    );
    if (duplicateEmailOwner) {
      throw new ConflictException(`Email '${normalizedEmail}' is already used by another user.`);
    }

    const current = this.managedUsers[targetIndex];
    const updated: AuthManagedUserRecord = {
      ...current,
      name: normalizedName,
      email: normalizedEmail,
      roleId: payload.roleId,
      updatedAtEpochMs: Date.now(),
    };
    this.managedUsers[targetIndex] = updated;

    return this.toManagedUser(updated);
  }

  private async updateManagedUserWithPrisma(
    userId: string,
    payload: { name: string; email: string; roleId: AuthManagedUserRole },
  ): Promise<AuthManagedUser> {
    const normalizedUserId = userId.trim();
    const normalizedName = normalizeManagedUserName(payload.name);
    const normalizedEmail = normalizeManagedUserEmail(payload.email);
    if (!normalizedName || !normalizedEmail) {
      throw new ConflictException("Name and email are required.");
    }

    const currentUser = await this.prisma.authUser.findUnique({
      where: { id: normalizedUserId },
      select: {
        id: true,
        role: true,
      },
    });
    if (!currentUser) {
      throw new NotFoundException(`User '${userId}' not found.`);
    }

    const duplicateEmailOwner = await this.prisma.authUser.findFirst({
      where: {
        email: normalizedEmail,
        id: {
          not: normalizedUserId,
        },
      },
      select: {
        id: true,
      },
    });
    if (duplicateEmailOwner) {
      throw new ConflictException(`Email '${normalizedEmail}' is already used by another user.`);
    }

    const nextRole = mapManagedRoleToPrismaRole(payload.roleId);
    await this.assertSuperAdminWillRemain({
      currentRole: currentUser.role,
      nextRole,
      deleting: false,
    });

    const updated = await this.prisma.authUser.update({
      where: {
        id: normalizedUserId,
      },
      data: {
        name: normalizedName,
        email: normalizedEmail,
        role: nextRole,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        passwordHash: true,
        updatedAt: true,
      },
    });

    return this.toManagedUserFromPrisma(updated);
  }

  private async setManagedUserPasswordInMemory(
    userId: string,
    password: string,
  ): Promise<AuthManagedUser> {
    const normalizedUserId = userId.trim();
    const targetIndex = this.managedUsers.findIndex((user) => user.id === normalizedUserId);
    if (targetIndex === -1) {
      throw new NotFoundException(`User '${userId}' not found.`);
    }

    const normalizedPassword = password.trim();
    if (!normalizedPassword) {
      throw new ConflictException("Password is required.");
    }

    const current = this.managedUsers[targetIndex];
    const updated: AuthManagedUserRecord = {
      ...current,
      passwordHash: await hashAuthPasswordAsync(normalizedPassword),
      updatedAtEpochMs: Date.now(),
    };
    this.managedUsers[targetIndex] = updated;
    return this.toManagedUser(updated);
  }

  private async setManagedUserPasswordWithPrisma(
    userId: string,
    password: string,
  ): Promise<AuthManagedUser> {
    const normalizedUserId = userId.trim();
    const normalizedPassword = password.trim();
    if (!normalizedPassword) {
      throw new ConflictException("Password is required.");
    }

    try {
      const updated = await this.prisma.authUser.update({
        where: {
          id: normalizedUserId,
        },
        data: {
          passwordHash: await hashAuthPasswordAsync(normalizedPassword),
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          passwordHash: true,
          updatedAt: true,
        },
      });

      return this.toManagedUserFromPrisma(updated);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`User '${userId}' not found.`);
      }

      throw error;
    }
  }

  private deleteManagedUserInMemory(userId: string): void {
    const normalizedUserId = userId.trim();
    const targetIndex = this.managedUsers.findIndex((user) => user.id === normalizedUserId);
    if (targetIndex === -1) {
      throw new NotFoundException(`User '${userId}' not found.`);
    }

    const target = this.managedUsers[targetIndex];
    if (target.roleId === "super-admin") {
      const totalSuperAdmin = this.managedUsers.filter((entry) => entry.roleId === "super-admin").length;
      if (totalSuperAdmin <= 1) {
        throw new ConflictException("At least one Super Admin must remain.");
      }
    }

    this.managedUsers.splice(targetIndex, 1);
  }

  private async deleteManagedUserWithPrisma(userId: string): Promise<void> {
    const normalizedUserId = userId.trim();
    const currentUser = await this.prisma.authUser.findUnique({
      where: { id: normalizedUserId },
      select: {
        id: true,
        role: true,
      },
    });
    if (!currentUser) {
      throw new NotFoundException(`User '${userId}' not found.`);
    }

    await this.assertSuperAdminWillRemain({
      currentRole: currentUser.role,
      nextRole: currentUser.role,
      deleting: true,
    });

    await this.prisma.authUser.delete({
      where: {
        id: normalizedUserId,
      },
    });
  }

  private async assertSuperAdminWillRemain(args: {
    currentRole: AuthUserRole;
    nextRole: AuthUserRole;
    deleting: boolean;
  }): Promise<void> {
    if (args.currentRole !== "SUPER_ADMIN") {
      return;
    }

    const demotingSuperAdmin = !args.deleting && args.nextRole !== "SUPER_ADMIN";
    if (!args.deleting && !demotingSuperAdmin) {
      return;
    }

    const totalSuperAdmin = await this.prisma.authUser.count({
      where: {
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    if (totalSuperAdmin <= 1) {
      throw new ConflictException("At least one Super Admin must remain.");
    }
  }

  private async allocateUsername(normalizedEmail: string): Promise<string> {
    const [emailLocalPart] = normalizedEmail.split("@");
    const baseUsername = normalizeUsernameCandidate(emailLocalPart || "user");
    let candidate = baseUsername;
    let suffix = 1;

    while (true) {
      const existing = await this.prisma.authUser.findUnique({
        where: {
          username: candidate,
        },
        select: {
          id: true,
        },
      });

      if (!existing) {
        return candidate;
      }

      candidate = `${baseUsername}.${suffix}`;
      suffix += 1;
      if (suffix > 1000) {
        throw new ConflictException("Unable to allocate a unique username.");
      }
    }
  }

  private allocateMemoryUsername(normalizedEmail: string): string {
    const [emailLocalPart] = normalizedEmail.split("@");
    const baseUsername = normalizeUsernameCandidate(emailLocalPart || "user");
    const reservedUsernames = new Set<string>([
      ...this.managedUsers.map((entry) => normalizeAuthIdentifier(entry.username)),
    ]);

    let candidate = baseUsername;
    let suffix = 1;
    while (reservedUsernames.has(candidate)) {
      candidate = `${baseUsername}.${suffix}`;
      suffix += 1;
      if (suffix > 1000) {
        throw new ConflictException("Unable to allocate a unique username.");
      }
    }

    return candidate;
  }

  private async ensurePrismaAuthUsersSeeded(): Promise<void> {
    if (this.dataSource !== "prisma" || !this.shouldBootstrapPrismaAuthUsers) {
      return;
    }

    if (!this.prismaBootstrapPromise) {
      this.prismaBootstrapPromise = this.bootstrapPrismaAuthUsers();
    }

    try {
      await this.prismaBootstrapPromise;
    } catch (error: unknown) {
      this.prismaBootstrapPromise = null;
      throw error;
    }
  }

  private async bootstrapPrismaAuthUsers(): Promise<void> {
    const passwordOverrides = requireDefaultAuthUserPasswordOverrides({
      superAdminPassword: resolveConfiguredString(this.configService, "DEV_AUTH_SUPERADMIN_PASSWORD"),
      adminPassword: resolveConfiguredString(this.configService, "DEV_AUTH_ADMIN_PASSWORD"),
    });
    const defaultUsers = createDefaultAuthUserStorageRecordsWithOverrides(passwordOverrides);

    for (const defaultUser of defaultUsers) {
      const existingByUsername = await this.prisma.authUser.findUnique({
        where: {
          username: defaultUser.username,
        },
        select: {
          id: true,
        },
      });
      if (existingByUsername) {
        continue;
      }

      const existingByEmail = await this.prisma.authUser.findUnique({
        where: {
          email: defaultUser.email,
        },
        select: {
          id: true,
        },
      });
      if (existingByEmail) {
        continue;
      }

      await this.prisma.authUser.create({
        data: defaultUser,
      });
    }
  }

  private async upgradeLegacyPasswordHash(userId: string, password: string): Promise<void> {
    try {
      await this.prisma.authUser.update({
        where: {
          id: userId,
        },
        data: {
          passwordHash: await hashAuthPasswordAsync(password),
        },
      });
    } catch {
      // Best-effort migration so a transient write failure does not block login.
    }
  }
}
