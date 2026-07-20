import { ConflictException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import type { PrismaService } from "../prisma/prisma.service";
import { AgentsService } from "./agents.service";

const memoryConfig = {
  get: (key: string) => (key === "DATA_SOURCE" ? "memory" : undefined),
} as ConfigService;

describe("AgentsService delete", () => {
  it("deletes an unused partner agent in memory mode", async () => {
    const service = new AgentsService(memoryConfig, {} as PrismaService);
    const created = await service.create({
      code: "DELETE-ME",
      name: "Delete Me",
    });

    await expect(service.remove(created.id)).resolves.toEqual({
      deleted: true,
      id: created.id,
    });
    await expect(service.findOne(created.id)).rejects.toThrow(/not found/i);
  });

  it("rejects deletion when the agent still owns a group", async () => {
    const service = new AgentsService(memoryConfig, {} as PrismaService);
    const created = await service.create({
      code: "IN-USE",
      name: "Agent In Use",
    });
    created.groupCount = 1;

    await expect(service.remove(created.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await expect(service.findOne(created.id)).resolves.toMatchObject({
      id: created.id,
    });
  });
});
