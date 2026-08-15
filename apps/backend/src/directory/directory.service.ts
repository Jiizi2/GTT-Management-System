import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { resolveConfiguredDataSource } from "../config/app-config";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateDriverDto,
  CreateMuassasahDto,
  UpdateDriverDto,
  UpdateMuassasahDto,
} from "./dto/directory.dto";

export type MuassasahRecord = {
  id: string;
  name: string;
  isActive: boolean;
  driverCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type DriverRecord = {
  id: string;
  name: string;
  phone: string | null;
  plateNumber: string | null;
  isActive: boolean;
  muassasahId: string | null;
  muassasahName: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

const trimOrNull = (value?: string | null): string | null => value?.trim() || null;

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

@Injectable()
export class DirectoryService {
  private readonly dataSource: "memory" | "prisma";
  private readonly memoryMuassasah: Array<Omit<MuassasahRecord, "driverCount">> = [];
  private readonly memoryDrivers: Array<Omit<DriverRecord, "muassasahName">> = [];

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.dataSource = resolveConfiguredDataSource(config);
  }

  // ----- Muassasah -----

  async listMuassasah(query?: string): Promise<MuassasahRecord[]> {
    const needle = query?.trim().toLowerCase();
    if (this.dataSource === "memory") {
      return this.memoryMuassasah
        .filter((item) => !needle || item.name.toLowerCase().includes(needle))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((item) => ({
          ...item,
          driverCount: this.memoryDrivers.filter((driver) => driver.muassasahId === item.id).length,
        }));
    }
    const rows = await this.prisma.muassasah.findMany({
      where: needle ? { name: { contains: needle, mode: "insensitive" } } : undefined,
      include: { _count: { select: { drivers: true } } },
      orderBy: [{ name: "asc" }],
    });
    return rows.map(({ _count, ...row }) => ({ ...row, driverCount: _count.drivers }));
  }

  async createMuassasah(payload: CreateMuassasahDto): Promise<MuassasahRecord> {
    const name = payload.name.trim();
    if (this.dataSource === "memory") {
      if (this.memoryMuassasah.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        throw new ConflictException(`Muassasah '${name}' already exists.`);
      }
      const now = new Date().toISOString();
      const created = { id: randomUUID(), name, isActive: true, createdAt: now, updatedAt: now };
      this.memoryMuassasah.push(created);
      return { ...created, driverCount: 0 };
    }
    try {
      const created = await this.prisma.muassasah.create({ data: { name } });
      return { ...created, driverCount: 0 };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) throw new ConflictException(`Muassasah '${name}' already exists.`);
      throw error;
    }
  }

  async updateMuassasah(id: string, payload: UpdateMuassasahDto): Promise<MuassasahRecord> {
    const name = payload.name?.trim();
    const data = {
      ...(name ? { name } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    };
    if (this.dataSource === "memory") {
      const existing = this.memoryMuassasah.find((item) => item.id === id);
      if (!existing) throw new NotFoundException(`Muassasah '${id}' not found.`);
      if (name && this.memoryMuassasah.some((item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase())) {
        throw new ConflictException(`Muassasah '${name}' already exists.`);
      }
      Object.assign(existing, data, { updatedAt: new Date().toISOString() });
      return { ...existing, driverCount: this.memoryDrivers.filter((d) => d.muassasahId === id).length };
    }
    try {
      const updated = await this.prisma.muassasah.update({
        where: { id },
        data,
        include: { _count: { select: { drivers: true } } },
      });
      const { _count, ...row } = updated;
      return { ...row, driverCount: _count.drivers };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) throw new ConflictException(`Muassasah '${name}' already exists.`);
      throw error;
    }
  }

  async removeMuassasah(id: string): Promise<{ deleted: true; id: string }> {
    if (this.dataSource === "memory") {
      const index = this.memoryMuassasah.findIndex((item) => item.id === id);
      if (index === -1) throw new NotFoundException(`Muassasah '${id}' not found.`);
      this.memoryMuassasah.splice(index, 1);
      for (const driver of this.memoryDrivers) {
        if (driver.muassasahId === id) driver.muassasahId = null;
      }
      return { deleted: true, id };
    }
    await this.prisma.muassasah.delete({ where: { id } }).catch((error) => {
      throw new NotFoundException(`Muassasah '${id}' not found.`);
    });
    return { deleted: true, id };
  }

  // ----- Drivers -----

  private muassasahNameFromMemory(muassasahId: string | null): string | null {
    if (!muassasahId) return null;
    return this.memoryMuassasah.find((item) => item.id === muassasahId)?.name ?? null;
  }

  async listDrivers(query?: string, muassasahId?: string): Promise<DriverRecord[]> {
    const needle = query?.trim().toLowerCase();
    const scopedMuassasahId = muassasahId?.trim() || undefined;
    if (this.dataSource === "memory") {
      return this.memoryDrivers
        .filter((driver) => !scopedMuassasahId || driver.muassasahId === scopedMuassasahId)
        .filter(
          (driver) =>
            !needle ||
            `${driver.name} ${driver.phone ?? ""} ${driver.plateNumber ?? ""}`.toLowerCase().includes(needle),
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((driver) => ({ ...driver, muassasahName: this.muassasahNameFromMemory(driver.muassasahId) }));
    }
    const rows = await this.prisma.driver.findMany({
      where: {
        ...(scopedMuassasahId ? { muassasahId: scopedMuassasahId } : {}),
        ...(needle
          ? {
              OR: [
                { name: { contains: needle, mode: "insensitive" } },
                { phone: { contains: needle, mode: "insensitive" } },
                { plateNumber: { contains: needle, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { muassasah: { select: { name: true } } },
      orderBy: [{ name: "asc" }],
    });
    return rows.map(({ muassasah, ...row }) => ({ ...row, muassasahName: muassasah?.name ?? null }));
  }

  private async assertMuassasahExists(muassasahId: string | null | undefined): Promise<string | null> {
    const id = muassasahId?.trim() || null;
    if (!id) return null;
    if (this.dataSource === "memory") {
      if (!this.memoryMuassasah.some((item) => item.id === id)) {
        throw new NotFoundException(`Muassasah '${id}' not found.`);
      }
      return id;
    }
    const found = await this.prisma.muassasah.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`Muassasah '${id}' not found.`);
    return id;
  }

  async createDriver(payload: CreateDriverDto): Promise<DriverRecord> {
    const name = payload.name.trim();
    const muassasahId = await this.assertMuassasahExists(payload.muassasahId);
    const data = {
      name,
      phone: trimOrNull(payload.phone),
      plateNumber: trimOrNull(payload.plateNumber),
      muassasahId,
    };
    if (this.dataSource === "memory") {
      const now = new Date().toISOString();
      const created = { id: randomUUID(), ...data, isActive: true, createdAt: now, updatedAt: now };
      this.memoryDrivers.push(created);
      return { ...created, muassasahName: this.muassasahNameFromMemory(muassasahId) };
    }
    const created = await this.prisma.driver.create({
      data,
      include: { muassasah: { select: { name: true } } },
    });
    const { muassasah, ...row } = created;
    return { ...row, muassasahName: muassasah?.name ?? null };
  }

  async updateDriver(id: string, payload: UpdateDriverDto): Promise<DriverRecord> {
    const muassasahId =
      payload.muassasahId !== undefined ? await this.assertMuassasahExists(payload.muassasahId) : undefined;
    const data = {
      ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
      ...(payload.phone !== undefined ? { phone: trimOrNull(payload.phone) } : {}),
      ...(payload.plateNumber !== undefined ? { plateNumber: trimOrNull(payload.plateNumber) } : {}),
      ...(muassasahId !== undefined ? { muassasahId } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    };
    if (this.dataSource === "memory") {
      const existing = this.memoryDrivers.find((driver) => driver.id === id);
      if (!existing) throw new NotFoundException(`Driver '${id}' not found.`);
      Object.assign(existing, data, { updatedAt: new Date().toISOString() });
      return { ...existing, muassasahName: this.muassasahNameFromMemory(existing.muassasahId) };
    }
    const updated = await this.prisma.driver
      .update({ where: { id }, data, include: { muassasah: { select: { name: true } } } })
      .catch(() => {
        throw new NotFoundException(`Driver '${id}' not found.`);
      });
    const { muassasah, ...row } = updated;
    return { ...row, muassasahName: muassasah?.name ?? null };
  }

  async removeDriver(id: string): Promise<{ deleted: true; id: string }> {
    if (this.dataSource === "memory") {
      const index = this.memoryDrivers.findIndex((driver) => driver.id === id);
      if (index === -1) throw new NotFoundException(`Driver '${id}' not found.`);
      this.memoryDrivers.splice(index, 1);
      return { deleted: true, id };
    }
    await this.prisma.driver.delete({ where: { id } }).catch(() => {
      throw new NotFoundException(`Driver '${id}' not found.`);
    });
    return { deleted: true, id };
  }

  /**
   * Silently records a driver typed on the H-1 checklist into the directory.
   * De-dupes by case-insensitive name within the same muassasah: updates the
   * contact details if found, otherwise creates a new entry. Best-effort — the
   * caller must not let a directory hiccup block the checklist save.
   */
  async upsertDriverFromCheckin(input: {
    name: string;
    phone?: string | null;
    plateNumber?: string | null;
    muassasahId?: string | null;
  }): Promise<DriverRecord | null> {
    const name = input.name?.trim();
    if (!name) return null;
    const muassasahId = input.muassasahId?.trim() || null;
    const phone = trimOrNull(input.phone);
    const plateNumber = trimOrNull(input.plateNumber);

    if (this.dataSource === "memory") {
      if (muassasahId && !this.memoryMuassasah.some((item) => item.id === muassasahId)) {
        return null;
      }
      const existing = this.memoryDrivers.find(
        (driver) => driver.muassasahId === muassasahId && driver.name.toLowerCase() === name.toLowerCase(),
      );
      if (existing) {
        if (phone) existing.phone = phone;
        if (plateNumber) existing.plateNumber = plateNumber;
        existing.updatedAt = new Date().toISOString();
        return { ...existing, muassasahName: this.muassasahNameFromMemory(muassasahId) };
      }
      return this.createDriver({ name, phone: phone ?? undefined, plateNumber: plateNumber ?? undefined, muassasahId: muassasahId ?? undefined });
    }

    if (muassasahId) {
      const exists = await this.prisma.muassasah.findUnique({ where: { id: muassasahId }, select: { id: true } });
      if (!exists) return null;
    }
    const existing = await this.prisma.driver.findFirst({
      where: { muassasahId: muassasahId ?? null, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) {
      const updated = await this.prisma.driver.update({
        where: { id: existing.id },
        data: { ...(phone ? { phone } : {}), ...(plateNumber ? { plateNumber } : {}) },
        include: { muassasah: { select: { name: true } } },
      });
      const { muassasah, ...row } = updated;
      return { ...row, muassasahName: muassasah?.name ?? null };
    }
    return this.createDriver({ name, phone: phone ?? undefined, plateNumber: plateNumber ?? undefined, muassasahId: muassasahId ?? undefined });
  }
}
