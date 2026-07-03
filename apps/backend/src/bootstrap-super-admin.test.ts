import { describe, expect } from "vitest";
import { runCase } from "./test/run-case";
import {
  buildBootstrapSuperAdminHelpText,
  deriveBootstrapUsername,
  parseBootstrapSuperAdminOptions,
  resolveBootstrapSuperAdminInput,
} from "./bootstrap-super-admin";

describe("BootstrapSuperAdmin", () => {
  runCase("parses options", () => {
    const parsed = parseBootstrapSuperAdminOptions([
      "--name",
      "Owner",
      "--email=owner@example.com",
      "--password",
      "StrongPassword#2026",
      "--username=owner.root",
    ]);

    expect(parsed.name).toBe("Owner");
    expect(parsed.email).toBe("owner@example.com");
    expect(parsed.password).toBe("StrongPassword#2026");
    expect(parsed.username).toBe("owner.root");
  });

  runCase("derives usernames", () => {
    expect(deriveBootstrapUsername("Owner Name")).toBe("owner.name");
    expect(deriveBootstrapUsername("___")).toBe("user");
  });

  runCase("resolves env fallbacks", () => {
    const resolved = resolveBootstrapSuperAdminInput([], {
      BOOTSTRAP_SUPERADMIN_NAME: "Initial Owner",
      BOOTSTRAP_SUPERADMIN_EMAIL: "Owner@Example.com",
      BOOTSTRAP_SUPERADMIN_PASSWORD: "StrongPassword#2026",
    });

    expect(resolved).toBeTruthy();
    expect(resolved?.name).toBe("Initial Owner");
    expect(resolved?.email).toBe("owner@example.com");
    expect(resolved?.username).toBe("owner");
  });

  runCase("rejects short password", () => {
    expect(() =>
      resolveBootstrapSuperAdminInput([
        "--name",
        "Owner",
        "--email",
        "owner@example.com",
        "--password",
        "short",
      ]),
    ).toThrow(/at least 12 characters/i);
  });

  runCase("rejects missing values", () => {
    expect(() =>
      resolveBootstrapSuperAdminInput([
        "--name",
        "Owner",
        "--password",
        "StrongPassword#2026",
      ]),
    ).toThrow(/email is required/i);
  });

  runCase("supports help flag", () => {
    const resolved = resolveBootstrapSuperAdminInput(["--help"]);
    expect(resolved).toBeNull();
    expect(buildBootstrapSuperAdminHelpText()).toMatch(/Bootstrap the first persistent super-admin/i);
  });
});
