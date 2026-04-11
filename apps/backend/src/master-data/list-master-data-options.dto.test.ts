import assert from "node:assert/strict";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ListMasterDataOptionsDto } from "./dto/list-master-data-options.dto";

async function runCase(name: string, fn: () => void): Promise<void> {
  fn();
  console.log(`PASS ${name}`);
}

function testAcceptsBooleanLikeQueryValues(): void {
  const dto = plainToInstance(ListMasterDataOptionsDto, {
    categoryKey: "airline",
    includeInactive: "true",
  });
  const errors = validateSync(dto);

  assert.equal(errors.length, 0);
  assert.equal(dto.includeInactive, true);
}

function testRejectsInvalidBooleanLikeQueryValues(): void {
  const dto = plainToInstance(ListMasterDataOptionsDto, {
    categoryKey: "airline",
    includeInactive: "abc",
  });
  const errors = validateSync(dto);

  assert.equal(errors.some((error) => error.property === "includeInactive"), true);
}

async function main(): Promise<void> {
  await runCase("master data option query accepts boolean strings", testAcceptsBooleanLikeQueryValues);
  await runCase("master data option query rejects invalid boolean strings", testRejectsInvalidBooleanLikeQueryValues);
}

void main().catch((error: unknown) => {
  console.error("List master data options DTO test failed:", error);
  process.exitCode = 1;
});
