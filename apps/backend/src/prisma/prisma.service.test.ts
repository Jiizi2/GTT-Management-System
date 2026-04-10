import assert from "node:assert/strict";
import { PrismaService } from "./prisma.service";

type AsyncVoid = () => Promise<void>;

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

function createServiceMock() {
  const state = {
    connectCalls: 0,
    disconnectCalls: 0,
  };

  const service = Object.create(PrismaService.prototype) as PrismaService;
  (service as PrismaService & { $connect: AsyncVoid }).$connect = async () => {
    state.connectCalls += 1;
  };
  (service as PrismaService & { $disconnect: AsyncVoid }).$disconnect = async () => {
    state.disconnectCalls += 1;
  };

  return { service, state };
}

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
}

async function testOnModuleInitSkipsConnectForNonPrismaDataSource(): Promise<void> {
  await withEnv({ DATA_SOURCE: undefined }, async () => {
    const { service, state } = createServiceMock();
    await service.onModuleInit();
    assert.equal(state.connectCalls, 0);
  });

  await withEnv({ DATA_SOURCE: "memory" }, async () => {
    const { service, state } = createServiceMock();
    await service.onModuleInit();
    assert.equal(state.connectCalls, 0);
  });
}

async function testOnModuleInitConnectsForPrismaDataSource(): Promise<void> {
  await withEnv({ DATA_SOURCE: "PRISMA" }, async () => {
    const { service, state } = createServiceMock();
    await service.onModuleInit();
    assert.equal(state.connectCalls, 1);
  });
}

async function testOnModuleDestroySkipsDisconnectForNonPrismaDataSource(): Promise<void> {
  await withEnv({ DATA_SOURCE: undefined }, async () => {
    const { service, state } = createServiceMock();
    await service.onModuleDestroy();
    assert.equal(state.disconnectCalls, 0);
  });

  await withEnv({ DATA_SOURCE: "memory" }, async () => {
    const { service, state } = createServiceMock();
    await service.onModuleDestroy();
    assert.equal(state.disconnectCalls, 0);
  });
}

async function testOnModuleDestroyDisconnectsForPrismaDataSource(): Promise<void> {
  await withEnv({ DATA_SOURCE: "prisma" }, async () => {
    const { service, state } = createServiceMock();
    await service.onModuleDestroy();
    assert.equal(state.disconnectCalls, 1);
  });
}

async function main(): Promise<void> {
  await runCase("prisma service onModuleInit skips non-prisma datasource", testOnModuleInitSkipsConnectForNonPrismaDataSource);
  await runCase("prisma service onModuleInit connects for prisma datasource", testOnModuleInitConnectsForPrismaDataSource);
  await runCase("prisma service onModuleDestroy skips non-prisma datasource", testOnModuleDestroySkipsDisconnectForNonPrismaDataSource);
  await runCase("prisma service onModuleDestroy disconnects for prisma datasource", testOnModuleDestroyDisconnectsForPrismaDataSource);
}

main().catch((error: unknown) => {
  console.error("Prisma service test failed:", error);
  throw error;
});
