import { compare, compareSync, hash, hashSync } from "bcrypt";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const BCRYPT_COST_ROUNDS = 12;
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;
const LEGACY_PASSWORD_HASH_SCHEME = "scrypt";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

function deriveLegacyPasswordKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS) as Buffer;
}

function verifyLegacyScryptPassword(password: string, storedHash: string): boolean {
  const hashParts = storedHash.split("$");
  if (hashParts.length !== 3) {
    return false;
  }

  const [scheme, encodedSalt, encodedKey] = hashParts;
  if (scheme !== LEGACY_PASSWORD_HASH_SCHEME || !encodedSalt || !encodedKey) {
    return false;
  }

  let salt: Buffer;
  let expectedKey: Buffer;
  try {
    salt = Buffer.from(encodedSalt, "base64url");
    expectedKey = Buffer.from(encodedKey, "base64url");
  } catch {
    return false;
  }

  if (salt.length === 0 || expectedKey.length === 0) {
    return false;
  }

  const derivedKey = deriveLegacyPasswordKey(password, salt);
  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedKey);
}

function isBcryptHash(storedHash: string): boolean {
  return BCRYPT_HASH_PATTERN.test(storedHash);
}

export function isLegacyAuthPasswordHash(storedHash: string): boolean {
  return storedHash.startsWith(`${LEGACY_PASSWORD_HASH_SCHEME}$`);
}

export function hashAuthPassword(password: string): string {
  if (!password) {
    throw new Error("Password cannot be empty.");
  }

  return hashSync(password, BCRYPT_COST_ROUNDS);
}

export async function hashAuthPasswordAsync(password: string): Promise<string> {
  if (!password) {
    throw new Error("Password cannot be empty.");
  }

  return hash(password, BCRYPT_COST_ROUNDS);
}

export function verifyAuthPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) {
    return false;
  }

  if (isBcryptHash(storedHash)) {
    try {
      return compareSync(password, storedHash);
    } catch {
      return false;
    }
  }

  return verifyLegacyScryptPassword(password, storedHash);
}

export async function verifyAuthPasswordAsync(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) {
    return false;
  }

  if (isBcryptHash(storedHash)) {
    try {
      return await compare(password, storedHash);
    } catch {
      return false;
    }
  }

  return verifyLegacyScryptPassword(password, storedHash);
}

export function createLegacyScryptPasswordHashForTest(password: string): string {
  if (!password) {
    throw new Error("Password cannot be empty.");
  }

  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derivedKey = deriveLegacyPasswordKey(password, salt);
  return `${LEGACY_PASSWORD_HASH_SCHEME}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}
