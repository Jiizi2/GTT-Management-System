import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { withEnv } from "../test/with-env";
import { PrismaService } from "./prisma.service";

type AsyncVoid = () => Promise<void>;
type AsyncQuery = (query: string, ...values: unknown[]) => Promise<unknown[]>;

function createServiceMock() {
  const state = {
    connectCalls: 0,
    disconnectCalls: 0,
    schemaCheckCalls: 0,
    schemaCheckResult: [] as unknown[],
  };

  const service = Object.create(PrismaService.prototype) as PrismaService;
  const serviceMock = service as unknown as {
    $connect: AsyncVoid;
    $disconnect: AsyncVoid;
    $queryRawUnsafe: AsyncQuery;
  };

  serviceMock.$connect = async () => {
    state.connectCalls += 1;
  };
  serviceMock.$disconnect = async () => {
    state.disconnectCalls += 1;
  };
  serviceMock.$queryRawUnsafe = async () => {
    state.schemaCheckCalls += 1;
    return state.schemaCheckResult;
  };

  return { service, state };
}

describe("PrismaService", () => {
  runCase("onModuleInit skips non-prisma datasource", async () => {
    await withEnv({ DATA_SOURCE: undefined }, async () => {
      const { service, state } = createServiceMock();
      await service.onModuleInit();
      expect(state.connectCalls).toBe(0);
      expect(state.schemaCheckCalls).toBe(0);
    });

    await withEnv({ DATA_SOURCE: "memory" }, async () => {
      const { service, state } = createServiceMock();
      await service.onModuleInit();
      expect(state.connectCalls).toBe(0);
      expect(state.schemaCheckCalls).toBe(0);
    });
  });

  runCase("onModuleInit connects for prisma datasource", async () => {
    await withEnv({ DATA_SOURCE: "PRISMA" }, async () => {
      const { service, state } = createServiceMock();
      await service.onModuleInit();
      expect(state.connectCalls).toBe(1);
      expect(state.schemaCheckCalls).toBe(1);
    });
  });

  runCase("onModuleInit fails when required schema is missing", async () => {
    await withEnv({ DATA_SOURCE: "prisma" }, async () => {
      const { service, state } = createServiceMock();
      state.schemaCheckResult = [
        {
          table_name: "Group",
          column_name: "lifecycleStatus",
        },
      ];

      await expect(
        service.onModuleInit(),
      ).rejects.toThrow(/Prisma database schema is not ready.*Group\.lifecycleStatus.*db:deploy/i);
      expect(state.connectCalls).toBe(1);
      expect(state.schemaCheckCalls).toBe(1);
    });
  });

  runCase("onModuleDestroy skips non-prisma datasource", async () => {
    await withEnv({ DATA_SOURCE: undefined }, async () => {
      const { service, state } = createServiceMock();
      await service.onModuleDestroy();
      expect(state.disconnectCalls).toBe(0);
    });

    await withEnv({ DATA_SOURCE: "memory" }, async () => {
      const { service, state } = createServiceMock();
      await service.onModuleDestroy();
      expect(state.disconnectCalls).toBe(0);
    });
  });

  runCase("onModuleDestroy disconnects for prisma datasource", async () => {
    await withEnv({ DATA_SOURCE: "prisma" }, async () => {
      const { service, state } = createServiceMock();
      await service.onModuleDestroy();
      expect(state.disconnectCalls).toBe(1);
    });
  });
});
