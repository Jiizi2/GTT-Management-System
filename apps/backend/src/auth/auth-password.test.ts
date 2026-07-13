import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import {
  createLegacyScryptPasswordHashForTest,
  hashAuthPassword,
  hashAuthPasswordAsync,
  verifyAuthPassword,
  verifyAuthPasswordAsync,
} from "./auth-password";

describe("AuthPassword", () => {
  runCase("hashes new passwords with bcrypt", () => {
    const hash = hashAuthPassword("Password#2026");

    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(verifyAuthPassword("Password#2026", hash)).toBe(true);
    expect(verifyAuthPassword("WrongPassword#2026", hash)).toBe(false);
  });

  runCase("verifies legacy scrypt hashes", () => {
    const legacyHash = createLegacyScryptPasswordHashForTest("Legacy#2026");

    expect(verifyAuthPassword("Legacy#2026", legacyHash)).toBe(true);
    expect(verifyAuthPassword("WrongLegacy#2026", legacyHash)).toBe(false);
  });

  runCase("rejects malformed hashes", () => {
    expect(verifyAuthPassword("Password#2026", "")).toBe(false);
    expect(verifyAuthPassword("Password#2026", "not-a-real-hash")).toBe(false);
    expect(verifyAuthPassword("", hashAuthPassword("Password#2026"))).toBe(false);
  });

  runCase("supports async bcrypt helpers", async () => {
    const hash = await hashAuthPasswordAsync("AsyncPassword#2026");

    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    expect(await verifyAuthPasswordAsync("AsyncPassword#2026", hash)).toBe(true);
    expect(await verifyAuthPasswordAsync("WrongAsyncPassword#2026", hash)).toBe(false);
  });
});
