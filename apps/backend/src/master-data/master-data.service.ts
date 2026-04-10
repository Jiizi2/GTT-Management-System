import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DEFAULT_MASTER_DATA_OPTIONS,
  MASTER_DATA_CATEGORY_DEFINITIONS,
  MASTER_DATA_VALUE_ALLOWLIST,
  type MasterDataCategoryDefinition,
  type MasterDataSeedOption,
} from "./master-data.defaults";
import { type CreateMasterDataOptionDto } from "./dto/create-master-data-option.dto";
import { type UpdateMasterDataOptionDto } from "./dto/update-master-data-option.dto";

export type MasterDataCategorySummary = MasterDataCategoryDefinition & {
  totalOptions: number;
  activeOptions: number;
};

export type MasterDataOptionItem = {
  id: string;
  categoryKey: string;
  value: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type MemoryMasterDataOption = {
  id: string;
  categoryKey: string;
  value: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  sortOrder: number;
  isActive: boolean;
  createdAtIso: string;
  updatedAtIso: string;
};

type PrismaMasterDataOptionRecord = {
  id: string;
  categoryKey: string;
  value: string;
  label: string;
  description: string | null;
  metadata: Prisma.JsonValue | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeCategoryKey(rawValue: string): string {
  return rawValue.trim().toLowerCase();
}

function normalizeRequiredLabel(rawValue: string): string {
  const normalized = rawValue.trim();
  if (!normalized) {
    throw new BadRequestException("Label is required.");
  }

  return normalized;
}

function normalizeOptionalValue(rawValue: string | undefined): string {
  return rawValue?.trim() ?? "";
}

function createGeneratedValueFromLabel(label: string): string {
  const generated = label
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "_")
    .toUpperCase();

  return generated || "OPTION";
}

function resolveNextSortOrder<T extends { sortOrder: number }>(options: T[]): number {
  const highest = options.reduce((max, option) => Math.max(max, option.sortOrder), 0);
  return highest + 1;
}

function parseMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function isMasterDataTableMissingError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2021") {
    return false;
  }

  const tableName = (error.meta as { table?: unknown } | undefined)?.table;
  return typeof tableName === "string" && tableName.includes("MasterDataOption");
}

function isMasterDataModelMissingError(error: unknown): boolean {
  if (!(error instanceof BadRequestException)) {
    return false;
  }

  const response = error.getResponse();
  const message =
    typeof response === "string"
      ? response
      : typeof response === "object" && response && "message" in response
        ? String((response as { message?: unknown }).message ?? "")
        : "";

  return message.includes("Prisma client belum memuat model MasterDataOption");
}

function mapDefaultOptionToMemory(option: MasterDataSeedOption, index: number): MemoryMasterDataOption {
  const nowIso = new Date().toISOString();
  return {
    id: `mdo-${String(index + 1).padStart(4, "0")}`,
    categoryKey: normalizeCategoryKey(option.categoryKey),
    value: option.value,
    label: option.label,
    description: option.description?.trim() || undefined,
    metadata: option.metadata,
    sortOrder: option.sortOrder,
    isActive: option.isActive ?? true,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
  };
}

@Injectable()
export class MasterDataService {
  private readonly dataSource: "memory" | "prisma";
  private readonly memoryOptions = DEFAULT_MASTER_DATA_OPTIONS.map((option, index) =>
    mapDefaultOptionToMemory(option, index),
  );
  private prismaSeedPromise: Promise<void> | null = null;
  private prismaReadFallbackReason: "missing-table" | "missing-client" | null = null;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    const configuredSource = (process.env.DATA_SOURCE ?? "memory").toLowerCase();
    this.dataSource = configuredSource === "prisma" ? "prisma" : "memory";
  }

  async listCategories(): Promise<MasterDataCategorySummary[]> {
    const countersByCategory = await this.buildCategoryCounters();

    return MASTER_DATA_CATEGORY_DEFINITIONS.map((category) => {
      const counters = countersByCategory.get(category.key) ?? { totalOptions: 0, activeOptions: 0 };
      return {
        ...category,
        totalOptions: counters.totalOptions,
        activeOptions: counters.activeOptions,
      };
    });
  }

  async listOptions(categoryKey: string, includeInactive = false): Promise<MasterDataOptionItem[]> {
    const normalizedCategoryKey = this.assertSupportedCategory(categoryKey);

    if (this.dataSource === "prisma") {
      await this.ensurePrismaDefaultsSeeded();
      if (this.canUsePrismaStorage()) {
        const model = this.getPrismaMasterDataModelOrThrow();
        const options = await model.findMany({
          where: {
            categoryKey: normalizedCategoryKey,
            ...(includeInactive ? {} : { isActive: true }),
          },
          orderBy: [{ sortOrder: "asc" }, { label: "asc" }, { createdAt: "asc" }],
        });

        return options.map((option) => this.mapPrismaOption(option));
      }
    }

    return this.listMemoryOptions(normalizedCategoryKey, includeInactive);
  }

  async createOption(payload: CreateMasterDataOptionDto): Promise<MasterDataOptionItem> {
    const normalizedCategoryKey = this.assertSupportedCategory(payload.categoryKey);
    const normalizedLabel = normalizeRequiredLabel(payload.label);
    const normalizedValue = this.resolveValueForCategory({
      categoryKey: normalizedCategoryKey,
      value: normalizeOptionalValue(payload.value),
      label: normalizedLabel,
    });

    if (this.dataSource === "prisma") {
      await this.ensurePrismaDefaultsSeeded();
      this.assertPrismaStorageWritable();
      const model = this.getPrismaMasterDataModelOrThrow();

      const existingByValue = await model.findUnique({
        where: {
          categoryKey_value: {
            categoryKey: normalizedCategoryKey,
            value: normalizedValue,
          },
        },
        select: {
          id: true,
        },
      });
      if (existingByValue) {
        throw new ConflictException(
          `Option '${normalizedValue}' already exists in category '${normalizedCategoryKey}'.`,
        );
      }

      const sortOrder =
        payload.sortOrder ??
        (await this.resolveNextSortOrderForPrismaCategory(normalizedCategoryKey));

      try {
        const created = await model.create({
          data: {
            categoryKey: normalizedCategoryKey,
            value: normalizedValue,
            label: normalizedLabel,
            description: payload.description?.trim() || null,
            metadata: payload.metadata ?? Prisma.JsonNull,
            sortOrder,
            isActive: payload.isActive ?? true,
          },
        });

        return this.mapPrismaOption(created);
      } catch (error: unknown) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ConflictException(
            `Option '${normalizedValue}' already exists in category '${normalizedCategoryKey}'.`,
          );
        }

        throw error;
      }
    }

    const existingByValue = this.memoryOptions.find(
      (option) =>
        option.categoryKey === normalizedCategoryKey &&
        option.value.trim().toLowerCase() === normalizedValue.toLowerCase(),
    );
    if (existingByValue) {
      throw new ConflictException(
        `Option '${normalizedValue}' already exists in category '${normalizedCategoryKey}'.`,
      );
    }

    const sameCategory = this.memoryOptions.filter((option) => option.categoryKey === normalizedCategoryKey);
    const nowIso = new Date().toISOString();
    const created: MemoryMasterDataOption = {
      id: randomUUID(),
      categoryKey: normalizedCategoryKey,
      value: normalizedValue,
      label: normalizedLabel,
      description: payload.description?.trim() || undefined,
      metadata: payload.metadata,
      sortOrder: payload.sortOrder ?? resolveNextSortOrder(sameCategory),
      isActive: payload.isActive ?? true,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };
    this.memoryOptions.push(created);

    return this.mapMemoryOption(created);
  }

  async updateOption(optionId: string, payload: UpdateMasterDataOptionDto): Promise<MasterDataOptionItem> {
    const normalizedOptionId = optionId.trim();
    if (!normalizedOptionId) {
      throw new BadRequestException("Option id is required.");
    }

    if (this.dataSource === "prisma") {
      await this.ensurePrismaDefaultsSeeded();
      this.assertPrismaStorageWritable();
      const model = this.getPrismaMasterDataModelOrThrow();

      const current = await model.findUnique({
        where: {
          id: normalizedOptionId,
        },
      });
      if (!current) {
        throw new NotFoundException(`Master data option '${optionId}' not found.`);
      }

      const nextValue =
        payload.value !== undefined
          ? this.resolveValueForCategory({
              categoryKey: current.categoryKey,
              value: payload.value,
              label: payload.label ?? current.label,
            })
          : current.value;
      const nextLabel = payload.label !== undefined ? normalizeRequiredLabel(payload.label) : current.label;

      if (nextValue !== current.value) {
        const duplicate = await model.findUnique({
          where: {
            categoryKey_value: {
              categoryKey: current.categoryKey,
              value: nextValue,
            },
          },
          select: {
            id: true,
          },
        });

        if (duplicate && duplicate.id !== current.id) {
          throw new ConflictException(
            `Option '${nextValue}' already exists in category '${current.categoryKey}'.`,
          );
        }
      }

      const updated = await model.update({
        where: {
          id: normalizedOptionId,
        },
        data: {
          value: nextValue,
          label: nextLabel,
          description:
            payload.description !== undefined
              ? payload.description.trim() || null
              : current.description,
          metadata: payload.metadata !== undefined ? payload.metadata : undefined,
          sortOrder: payload.sortOrder ?? current.sortOrder,
          isActive: payload.isActive ?? current.isActive,
        },
      });

      return this.mapPrismaOption(updated);
    }

    const targetIndex = this.memoryOptions.findIndex((option) => option.id === normalizedOptionId);
    if (targetIndex < 0) {
      throw new NotFoundException(`Master data option '${optionId}' not found.`);
    }

    const current = this.memoryOptions[targetIndex];
    const nextLabel = payload.label !== undefined ? normalizeRequiredLabel(payload.label) : current.label;
    const nextValue =
      payload.value !== undefined
        ? this.resolveValueForCategory({
            categoryKey: current.categoryKey,
            value: payload.value,
            label: nextLabel,
          })
        : current.value;

    const duplicate = this.memoryOptions.find(
      (option) =>
        option.id !== current.id &&
        option.categoryKey === current.categoryKey &&
        option.value.trim().toLowerCase() === nextValue.toLowerCase(),
    );
    if (duplicate) {
      throw new ConflictException(
        `Option '${nextValue}' already exists in category '${current.categoryKey}'.`,
      );
    }

    const next: MemoryMasterDataOption = {
      ...current,
      value: nextValue,
      label: nextLabel,
      description:
        payload.description !== undefined ? payload.description.trim() || undefined : current.description,
      metadata: payload.metadata !== undefined ? payload.metadata : current.metadata,
      sortOrder: payload.sortOrder ?? current.sortOrder,
      isActive: payload.isActive ?? current.isActive,
      updatedAtIso: new Date().toISOString(),
    };
    this.memoryOptions[targetIndex] = next;

    return this.mapMemoryOption(next);
  }

  private async buildCategoryCounters(): Promise<
    Map<string, { totalOptions: number; activeOptions: number }>
  > {
    const counters = new Map<string, { totalOptions: number; activeOptions: number }>();

    const options =
      this.dataSource === "prisma"
        ? await this.listAllOptionsWithPrisma()
        : this.memoryOptions.map((option) => this.mapMemoryOption(option));

    for (const option of options) {
      const current = counters.get(option.categoryKey) ?? { totalOptions: 0, activeOptions: 0 };
      current.totalOptions += 1;
      if (option.isActive) {
        current.activeOptions += 1;
      }
      counters.set(option.categoryKey, current);
    }

    return counters;
  }

  private listMemoryOptions(categoryKey: string, includeInactive: boolean): MasterDataOptionItem[] {
    return this.memoryOptions
      .filter(
        (option) =>
          option.categoryKey === categoryKey && (includeInactive ? true : option.isActive),
      )
      .sort((left, right) => {
        const sortOrderDiff = left.sortOrder - right.sortOrder;
        if (sortOrderDiff !== 0) {
          return sortOrderDiff;
        }

        return left.label.localeCompare(right.label);
      })
      .map((option) => this.mapMemoryOption(option));
  }

  private async listAllOptionsWithPrisma(): Promise<MasterDataOptionItem[]> {
    await this.ensurePrismaDefaultsSeeded();
    if (!this.canUsePrismaStorage()) {
      return this.memoryOptions.map((option) => this.mapMemoryOption(option));
    }

    const model = this.getPrismaMasterDataModelOrThrow();
    const options = await model.findMany({
      orderBy: [{ categoryKey: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    });

    return options.map((option) => this.mapPrismaOption(option));
  }

  private mapMemoryOption(option: MemoryMasterDataOption): MasterDataOptionItem {
    return {
      id: option.id,
      categoryKey: option.categoryKey,
      value: option.value,
      label: option.label,
      description: option.description,
      metadata: option.metadata,
      sortOrder: option.sortOrder,
      isActive: option.isActive,
      createdAt: option.createdAtIso,
      updatedAt: option.updatedAtIso,
    };
  }

  private mapPrismaOption(option: PrismaMasterDataOptionRecord): MasterDataOptionItem {
    return {
      id: option.id,
      categoryKey: option.categoryKey,
      value: option.value,
      label: option.label,
      description: option.description ?? undefined,
      metadata: parseMetadata(option.metadata),
      sortOrder: option.sortOrder,
      isActive: option.isActive,
      createdAt: option.createdAt.toISOString(),
      updatedAt: option.updatedAt.toISOString(),
    };
  }

  private resolveValueForCategory({
    categoryKey,
    value,
    label,
  }: {
    categoryKey: string;
    value: string;
    label: string;
  }): string {
    const normalizedRequestedValue = value.trim();
    const fallbackValue = createGeneratedValueFromLabel(label);
    const candidateValue = normalizedRequestedValue || fallbackValue;
    const allowlist = MASTER_DATA_VALUE_ALLOWLIST[categoryKey];

    if (!allowlist) {
      return candidateValue;
    }

    const matchedAllowlistValue = allowlist.find(
      (allowedValue) => allowedValue.toLowerCase() === candidateValue.toLowerCase(),
    );
    if (!matchedAllowlistValue) {
      throw new BadRequestException(
        `Value '${candidateValue}' is not allowed for category '${categoryKey}'. Allowed values: ${allowlist.join(", ")}.`,
      );
    }

    return matchedAllowlistValue;
  }

  private assertSupportedCategory(categoryKey: string): string {
    const normalizedCategoryKey = normalizeCategoryKey(categoryKey);
    const isKnownCategory = MASTER_DATA_CATEGORY_DEFINITIONS.some(
      (category) => category.key === normalizedCategoryKey,
    );

    if (!isKnownCategory) {
      throw new BadRequestException(
        `Unsupported category '${categoryKey}'. Use one of: ${MASTER_DATA_CATEGORY_DEFINITIONS.map((category) => category.key).join(", ")}.`,
      );
    }

    return normalizedCategoryKey;
  }

  private canUsePrismaStorage(): boolean {
    return this.dataSource === "prisma" && this.prismaReadFallbackReason === null;
  }

  private assertPrismaStorageWritable(): void {
    if (this.prismaReadFallbackReason === null) {
      return;
    }

    if (this.prismaReadFallbackReason === "missing-client") {
      throw new BadRequestException(
        "Prisma client belum memuat model MasterDataOption. Jalankan `npm run db:generate --workspace backend`, lalu restart backend.",
      );
    }

    throw new BadRequestException(
      "Tabel MasterDataOption belum ada di database. Jalankan `npm run db:migrate:backend`, lalu restart backend.",
    );
  }

  private getPrismaMasterDataModelOrThrow(): {
    findMany: (args?: unknown) => Promise<PrismaMasterDataOptionRecord[]>;
    findUnique: (args: unknown) => Promise<PrismaMasterDataOptionRecord | null>;
    create: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
    update: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
    upsert: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
    aggregate: (args: unknown) => Promise<{ _max: { sortOrder: number | null } }>;
  } {
    const prismaRecord = this.prisma as unknown as Record<string, unknown>;
    const model = prismaRecord.masterDataOption;

    if (!model || typeof model !== "object") {
      throw new BadRequestException(
        "Prisma client belum memuat model MasterDataOption. Jalankan `npm run db:generate --workspace backend`, lalu restart backend.",
      );
    }

    return model as {
      findMany: (args?: unknown) => Promise<PrismaMasterDataOptionRecord[]>;
      findUnique: (args: unknown) => Promise<PrismaMasterDataOptionRecord | null>;
      create: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
      update: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
      upsert: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
      aggregate: (args: unknown) => Promise<{ _max: { sortOrder: number | null } }>;
    };
  }

  private async resolveNextSortOrderForPrismaCategory(categoryKey: string): Promise<number> {
    const model = this.getPrismaMasterDataModelOrThrow();
    const aggregate = await model.aggregate({
      where: {
        categoryKey,
      },
      _max: {
        sortOrder: true,
      },
    });

    return (aggregate._max.sortOrder ?? 0) + 1;
  }

  private async ensurePrismaDefaultsSeeded(): Promise<void> {
    if (this.dataSource !== "prisma") {
      return;
    }

    if (this.prismaReadFallbackReason !== null) {
      return;
    }

    if (!this.prismaSeedPromise) {
      this.prismaSeedPromise = this.seedPrismaDefaults();
    }

    try {
      await this.prismaSeedPromise;
    } catch (error: unknown) {
      this.prismaSeedPromise = null;

      if (isMasterDataTableMissingError(error)) {
        this.prismaReadFallbackReason = "missing-table";
        console.warn(
          "MasterDataOption table was not found. Falling back to in-memory master data defaults for read operations.",
        );
        return;
      }

      if (isMasterDataModelMissingError(error)) {
        this.prismaReadFallbackReason = "missing-client";
        console.warn(
          "Prisma client does not include MasterDataOption model. Falling back to in-memory master data defaults for read operations.",
        );
        return;
      }

      throw error;
    }
  }

  private async seedPrismaDefaults(): Promise<void> {
    const model = this.getPrismaMasterDataModelOrThrow();

    for (const option of DEFAULT_MASTER_DATA_OPTIONS) {
      await model.upsert({
        where: {
          categoryKey_value: {
            categoryKey: normalizeCategoryKey(option.categoryKey),
            value: option.value,
          },
        },
        update: {
          label: option.label,
          description: option.description ?? null,
          metadata: option.metadata ?? Prisma.JsonNull,
          sortOrder: option.sortOrder,
          isActive: option.isActive ?? true,
        },
        create: {
          categoryKey: normalizeCategoryKey(option.categoryKey),
          value: option.value,
          label: option.label,
          description: option.description ?? null,
          metadata: option.metadata ?? Prisma.JsonNull,
          sortOrder: option.sortOrder,
          isActive: option.isActive ?? true,
        },
      });
    }
  }
}
