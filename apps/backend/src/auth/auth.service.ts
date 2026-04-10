import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { LoginDto } from "./dto/login.dto";
import {
  type AuthLoginResponse,
  type AuthManagedUser,
  type AuthManagedUserRole,
  type AuthSessionUser,
  type AuthTokenPayload,
} from "./auth.types";

type AuthDevAccount = AuthSessionUser & {
  password: string;
};

type AuthManagedUserRecord = {
  id: string;
  name: string;
  email: string;
  roleId: AuthManagedUserRole;
  updatedAtEpochMs: number;
};

const TOKEN_TYPE = "Bearer" as const;
const HEADER_TEMPLATE = { alg: "HS256", typ: "JWT" };

const ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60 * 12;
const REMEMBERED_ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60 * 24 * 14;

function base64UrlEncodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeBase64UrlJson(value: string): unknown {
  const decoded = Buffer.from(value, "base64url").toString("utf8");
  return JSON.parse(decoded) as unknown;
}

function safeCompareText(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeManagedUserName(value: string): string {
  return value.trim();
}

function normalizeManagedUserEmail(value: string): string {
  return value.trim().toLowerCase();
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

  if (!id || !name || !username || !email || !accessTier || !exp) {
    return null;
  }

  return {
    id,
    name,
    username,
    email,
    accessTier,
    exp,
  };
}

function resolveAuthSecret(): string {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) {
    return configured;
  }

  return "gtt-dev-auth-secret-please-change-in-production";
}

function createDefaultDevAccounts(): AuthDevAccount[] {
  return [
    {
      id: "dev-super-admin",
      name: "Dev Super Admin",
      username: "dev.superadmin",
      email: "superadmin.dev@ghaniya.local",
      accessTier: "super-admin",
      password: process.env.DEV_AUTH_SUPERADMIN_PASSWORD?.trim() || "DevSuperAdmin#2026",
    },
    {
      id: "dev-admin",
      name: "Dev Admin",
      username: "dev.admin",
      email: "admin.dev@ghaniya.local",
      accessTier: "admin",
      password: process.env.DEV_AUTH_ADMIN_PASSWORD?.trim() || "DevAdmin#2026",
    },
  ];
}

function createDefaultManagedUsers(): AuthManagedUserRecord[] {
  const now = Date.now();
  return [
    {
      id: "usr-1",
      name: "Operator Admin",
      email: "operator.admin@ghaniyatravel.com",
      roleId: "admin",
      updatedAtEpochMs: now,
    },
    {
      id: "usr-2",
      name: "Mila Finance",
      email: "mila.finance@ghaniyatravel.com",
      roleId: "finance-manager",
      updatedAtEpochMs: now,
    },
    {
      id: "usr-3",
      name: "Hadi Support",
      email: "hadi.support@ghaniyatravel.com",
      roleId: "customer-support",
      updatedAtEpochMs: now,
    },
  ];
}

@Injectable()
export class AuthService {
  private readonly authSecret = resolveAuthSecret();
  private readonly accounts = createDefaultDevAccounts();
  private readonly managedUsers = createDefaultManagedUsers();

  login(payload: LoginDto): AuthLoginResponse {
    const identifier = normalizeIdentifier(payload.identifier);
    const password = payload.password;
    const rememberSession = Boolean(payload.rememberSession);

    const account = this.accounts.find((entry) => {
      return (
        normalizeIdentifier(entry.username) === identifier ||
        normalizeIdentifier(entry.email) === identifier
      );
    });

    if (!account || !safeCompareText(account.password, password)) {
      throw new UnauthorizedException("Invalid username/email or password.");
    }

    const tokenLifetimeSeconds = rememberSession
      ? REMEMBERED_ACCESS_TOKEN_LIFETIME_SECONDS
      : ACCESS_TOKEN_LIFETIME_SECONDS;
    const expiresAtEpochSeconds = Math.floor(Date.now() / 1000) + tokenLifetimeSeconds;
    const tokenPayload: AuthTokenPayload = {
      id: account.id,
      name: account.name,
      username: account.username,
      email: account.email,
      accessTier: account.accessTier,
      exp: expiresAtEpochSeconds,
    };

    const accessToken = this.signToken(tokenPayload);

    return {
      accessToken,
      tokenType: TOKEN_TYPE,
      expiresAt: new Date(expiresAtEpochSeconds * 1000).toISOString(),
      rememberSession,
      user: {
        id: account.id,
        name: account.name,
        username: account.username,
        email: account.email,
        accessTier: account.accessTier,
      },
    };
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

  listManagedUsers(): AuthManagedUser[] {
    return this.managedUsers
      .map((user) => this.toManagedUser(user))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  updateManagedUser(
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
      updatedAt: new Date(user.updatedAtEpochMs).toISOString(),
    };
  }
}
