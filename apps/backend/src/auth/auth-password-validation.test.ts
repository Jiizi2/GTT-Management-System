import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { validatePasswordStrength } from "./auth-password-validation";

describe("validatePasswordStrength", () => {
  runCase("accepts strong password", () => {
    const result = validatePasswordStrength("StrongPass#2026");
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  runCase("rejects password less than 12 characters", () => {
    const result = validatePasswordStrength("Str1#");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must be at least 12 characters");
  });

  runCase("rejects password without uppercase letter", () => {
    const result = validatePasswordStrength("strongpass#2026");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain uppercase letter");
  });

  runCase("rejects password without lowercase letter", () => {
    const result = validatePasswordStrength("STRONGPASS#2026");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain lowercase letter");
  });

  runCase("rejects password without number", () => {
    const result = validatePasswordStrength("StrongPass###");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain number");
  });

  runCase("rejects password without special character", () => {
    const result = validatePasswordStrength("StrongPass2026");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain special character");
  });
});
