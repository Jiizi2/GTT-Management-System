import { describe, expect, it } from "vitest";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../prisma/prisma.service";
import { DirectoryService } from "./directory.service";

function makeService(): DirectoryService {
  const config = { get: (key: string) => (key === "DATA_SOURCE" ? "memory" : undefined) } as unknown as ConfigService;
  return new DirectoryService(config, {} as unknown as PrismaService);
}

describe("DirectoryService (memory)", () => {
  it("creates and lists muassasah, rejecting duplicates", async () => {
    const service = makeService();
    const created = await service.createMuassasah({ name: " Daleel Maalem " });
    expect(created).toMatchObject({ name: "Daleel Maalem", isActive: true, driverCount: 0 });

    await expect(() => service.createMuassasah({ name: "daleel maalem" })).rejects.toThrow(/already exists/);

    const list = await service.listMuassasah();
    expect(list.map((m) => m.name)).toEqual(["Daleel Maalem"]);
  });

  it("creates a driver tied to a muassasah and filters by it", async () => {
    const service = makeService();
    const m = await service.createMuassasah({ name: "Rawaf Mina" });
    const other = await service.createMuassasah({ name: "Nusuk" });

    const driver = await service.createDriver({ name: "Yusuf", phone: "123", plateNumber: "B 1", muassasahId: m.id });
    expect(driver).toMatchObject({ name: "Yusuf", muassasahId: m.id, muassasahName: "Rawaf Mina" });

    const scoped = await service.listDrivers(undefined, m.id);
    expect(scoped).toHaveLength(1);
    expect(await service.listDrivers(undefined, other.id)).toHaveLength(0);

    const mList = await service.listMuassasah();
    expect(mList.find((x) => x.id === m.id)?.driverCount).toBe(1);
  });

  it("rejects a driver pointing at a missing muassasah", async () => {
    const service = makeService();
    await expect(() => service.createDriver({ name: "Ghost", muassasahId: "nope" })).rejects.toThrow(/not found/);
  });

  it("upserts a driver from checkin: creates once, then updates contact details", async () => {
    const service = makeService();
    const m = await service.createMuassasah({ name: "Daleel" });

    const first = await service.upsertDriverFromCheckin({ name: "Ali", phone: "111", muassasahId: m.id });
    expect(first).toMatchObject({ name: "Ali", phone: "111", muassasahId: m.id });

    const second = await service.upsertDriverFromCheckin({
      name: "ali",
      phone: "222",
      plateNumber: "B 9",
      muassasahId: m.id,
    });
    expect(second?.id).toBe(first?.id);
    expect(second).toMatchObject({ phone: "222", plateNumber: "B 9" });

    expect(await service.listDrivers(undefined, m.id)).toHaveLength(1);
  });

  it("deleting a muassasah unlinks its drivers", async () => {
    const service = makeService();
    const m = await service.createMuassasah({ name: "Temp" });
    await service.createDriver({ name: "Sam", muassasahId: m.id });

    await service.removeMuassasah(m.id);

    const drivers = await service.listDrivers();
    expect(drivers).toHaveLength(1);
    expect(drivers[0]).toMatchObject({ muassasahId: null, muassasahName: null });
  });
});
