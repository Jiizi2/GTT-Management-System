import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { CreateManagedUserDto } from "./create-managed-user.dto";
import { SetManagedUserPasswordDto } from "./set-managed-user-password.dto";

describe("CreateManagedUserDto Validation", () => {
  runCase("accepts valid payload with strong password", () => {
    const dto = plainToInstance(CreateManagedUserDto, {
      name: "Test User",
      email: "test.user@example.com",
      roleId: "admin",
      password: "StrongPass#2026",
    });
    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });

  runCase("rejects weak password", () => {
    const dto = plainToInstance(CreateManagedUserDto, {
      name: "Test User",
      email: "test.user@example.com",
      roleId: "admin",
      password: "weak",
    });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === "password")).toBe(true);
  });
});

describe("SetManagedUserPasswordDto Validation", () => {
  runCase("accepts strong password", () => {
    const dto = plainToInstance(SetManagedUserPasswordDto, {
      password: "StrongPass#2026",
    });
    const errors = validateSync(dto);
    expect(errors.length).toBe(0);
  });

  runCase("rejects weak password", () => {
    const dto = plainToInstance(SetManagedUserPasswordDto, {
      password: "weak",
    });
    const errors = validateSync(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((error) => error.property === "password")).toBe(true);
  });
});
