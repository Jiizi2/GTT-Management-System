import assert from "node:assert/strict";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { MasterDataService } from "./master-data.service";

async function runCase(name: string, fn: () => void | Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previousValues = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, previousValue] of previousValues.entries()) {
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }
  }
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

async function testPrismaMissingClientFallsBackToMemoryOutsideProduction(): Promise<void> {
  await withEnv(
    {
      DATA_SOURCE: "prisma",
      NODE_ENV: "test",
    },
    async () => {
      const service = new MasterDataService({} as PrismaService);
      const options = await service.listOptions("invoice-status", true);

      assert.equal(options.length >= 4, true);
      assert.equal(options.some((option) => option.value === "Pending"), true);
    },
  );
}

async function testPrismaMissingTableFailsFastInProduction(): Promise<void> {
  await withEnv(
    {
      DATA_SOURCE: "prisma",
      NODE_ENV: "production",
    },
    async () => {
      const prisma = {
        masterDataOption: {
          upsert: async () => {
            throw new Prisma.PrismaClientKnownRequestError("missing table", {
              code: "P2021",
              clientVersion: "unit-test",
              meta: {
                table: "public.MasterDataOption",
              },
            });
          },
        },
      } as unknown as PrismaService;

      const service = new MasterDataService(prisma);

      await assert.rejects(
        () => service.listOptions("invoice-status"),
        (error: unknown) => {
          assert.equal(error instanceof InternalServerErrorException, true);
          assert.match((error as Error).message, /MasterDataOption/i);
          assert.match((error as Error).message, /db:migrate:backend/i);
          return true;
        },
      );
    },
  );
}

async function main(): Promise<void> {
  await runCase("master data list options requires categoryKey", testListOptionsRequiresCategoryKey);
  await runCase(
    "master data prisma missing client falls back outside production",
    testPrismaMissingClientFallsBackToMemoryOutsideProduction,
  );
  await runCase(
    "master data prisma missing table fails fast in production",
    testPrismaMissingTableFailsFastInProduction,
  );
}

void main().catch((error: unknown) => {
  console.error("Master data service test failed:", error);
  process.exitCode = 1;
});
