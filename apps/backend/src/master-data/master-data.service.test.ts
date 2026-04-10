import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { MasterDataService } from "./master-data.service";

async function runCase(name: string, fn: () => void | Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

async function testListOptionsRequiresCategoryKey(): Promise<void> {
  const service = new MasterDataService({} as PrismaService);

  await assert.rejects(
    () => service.listOptions("" as unknown as string),
    (error: unknown) => {
      assert.equal(error instanceof BadRequestException, true);
      assert.match((error as Error).message, /categoryKey is required/i);
      return true;
    },
  );
}

async function main(): Promise<void> {
  await runCase("master data list options requires categoryKey", testListOptionsRequiresCategoryKey);
}

void main().catch((error: unknown) => {
  console.error("Master data service test failed:", error);
  process.exitCode = 1;
});
