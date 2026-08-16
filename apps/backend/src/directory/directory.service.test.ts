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
    expect(created).toMatchObject({ name: "Daleel Maalem", isActive: true, driverCount: 0, vehicleCount: 0 });

    await expect(() => service.createMuassasah({ name: "daleel maalem" })).rejects.toThrow(/already exists/);
    expect((await service.listMuassasah()).map((m) => m.name)).toEqual(["Daleel Maalem"]);
  });

  it("creates a driver with a note/flag tied to a muassasah and counts it", async () => {
    const service = makeService();
    const m = await service.createMuassasah({ name: "Rawaf Mina" });

    const driver = await service.createDriver({ name: "Yusuf", phone: "123", muassasahId: m.id, note: "Ramah", isProblematic: false });
    expect(driver).toMatchObject({ name: "Yusuf", muassasahId: m.id, muassasahName: "Rawaf Mina", note: "Ramah", isProblematic: false });

    const scoped = await service.listDrivers(undefined, m.id);
    expect(scoped).toHaveLength(1);
    expect((await service.listMuassasah()).find((x) => x.id === m.id)?.driverCount).toBe(1);
  });

  it("creates a vehicle with a problematic flag and counts it under its muassasah", async () => {
    const service = makeService();
    const m = await service.createMuassasah({ name: "Daleel" });

    const vehicle = await service.createVehicle({ plateNumber: " B 1 XYZ ", muassasahId: m.id, isProblematic: true, note: "Kotor" });
    expect(vehicle).toMatchObject({ plateNumber: "B 1 XYZ", muassasahName: "Daleel", isProblematic: true, note: "Kotor" });

    expect(await service.listVehicles(undefined, m.id)).toHaveLength(1);
    expect((await service.listMuassasah()).find((x) => x.id === m.id)?.vehicleCount).toBe(1);
  });

  it("upserts a driver from checkin without duplicating; updates phone", async () => {
    const service = makeService();
    const m = await service.createMuassasah({ name: "Daleel" });

    const first = await service.upsertDriverFromCheckin({ name: "Ali", phone: "111", muassasahId: m.id });
    const second = await service.upsertDriverFromCheckin({ name: "ali", phone: "222", muassasahId: m.id });
    expect(second?.id).toBe(first?.id);
    expect(second).toMatchObject({ phone: "222" });
    expect(await service.listDrivers(undefined, m.id)).toHaveLength(1);
  });

  it("upserts a vehicle from checkin without duplicating by plate within a muassasah", async () => {
    const service = makeService();
    const m = await service.createMuassasah({ name: "Daleel" });

    const first = await service.upsertVehicleFromCheckin({ plateNumber: "B 9 KL", muassasahId: m.id });
    const second = await service.upsertVehicleFromCheckin({ plateNumber: "b 9 kl", muassasahId: m.id });
    expect(second?.id).toBe(first?.id);
    expect(await service.listVehicles(undefined, m.id)).toHaveLength(1);
  });

  it("deleting a muassasah unlinks its drivers and vehicles", async () => {
    const service = makeService();
    const m = await service.createMuassasah({ name: "Temp" });
    await service.createDriver({ name: "Sam", muassasahId: m.id });
    await service.createVehicle({ plateNumber: "B 2 CD", muassasahId: m.id });

    await service.removeMuassasah(m.id);

    expect((await service.listDrivers())[0]).toMatchObject({ muassasahId: null, muassasahName: null });
    expect((await service.listVehicles())[0]).toMatchObject({ muassasahId: null, muassasahName: null });
  });
});
