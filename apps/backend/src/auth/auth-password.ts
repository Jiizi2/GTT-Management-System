import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_HASH_SCHEME = "scrypt";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_OPTIONS = {
  N: 16_384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024,
};

function derivePasswordKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, SCRYPT_KEY_LENGTH, SCRYPT_OPTIONS) as Buffer;
}

export function hashAuthPassword(password: string): string {
  if (!password) {
    throw new Error("Password cannot be empty.");
  }

  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derivedKey = derivePasswordKey(password, salt);
  return `${PASSWORD_HASH_SCHEME}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

export function verifyAuthPassword(password: string, storedHash: string): boolean {
  if (!password || !storedHash) {
    return false;
  }

  const hashParts = storedHash.split("$");
  if (hashParts.length !== 3) {
    return false;
  }

  const [scheme, encodedSalt, encodedKey] = hashParts;
  if (scheme !== PASSWORD_HASH_SCHEME || !encodedSalt || !encodedKey) {
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

  const derivedKey = derivePasswordKey(password, salt);
  if (derivedKey.length !== expectedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expectedKey);
}
