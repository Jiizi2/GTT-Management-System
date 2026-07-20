import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthUserRole, InvoiceStatus, Prisma } from "@prisma/client";
import {
  resolveConfiguredDataSource,
  resolveConfiguredNodeEnv,
} from "../config/app-config";
import { createStructuredLogger } from "../logging/create-structured-logger";
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

const MASTER_DATA_SEED_MARKER_CATEGORY = "__system";
const MASTER_DATA_SEED_MARKER_VALUE = "defaults-v1";

const INVOICE_STATUS_BY_OPTION_VALUE: Record<string, InvoiceStatus> = {
  pending: InvoiceStatus.PENDING,
  paid: InvoiceStatus.PAID,
  overdue: InvoiceStatus.OVERDUE,
  cancelled: InvoiceStatus.CANCELLED,
};

const AUTH_ROLE_BY_OPTION_VALUE: Record<string, AuthUserRole> = {
  "super-admin": AuthUserRole.SUPER_ADMIN,
  admin: AuthUserRole.ADMIN,
  "finance-manager": AuthUserRole.FINANCE_MANAGER,
  "customer-support": AuthUserRole.CUSTOMER_SUPPORT,
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

function resolveNextSortOrder<T extends { sortOrder: number }>(
  options: T[],
): number {
  const highest = options.reduce(
    (max, option) => Math.max(max, option.sortOrder),
    0,
  );
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
  return (
    typeof tableName === "string" && tableName.includes("MasterDataOption")
  );
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

function mapDefaultOptionToMemory(
  option: MasterDataSeedOption,
  index: number,
): MemoryMasterDataOption {
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
  private readonly nodeEnv: string;
  private readonly logger = createStructuredLogger(MasterDataService.name);
  private readonly memoryOptions = DEFAULT_MASTER_DATA_OPTIONS.map(
    (option, index) => mapDefaultOptionToMemory(option, index),
  );
  private prismaSeedPromise: Promise<void> | null = null;
  private prismaReadFallbackReason: "missing-table" | "missing-client" | null =
    null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {
    this.dataSource = resolveConfiguredDataSource(this.configService);
    this.nodeEnv = resolveConfiguredNodeEnv(this.configService);
  }

  async listCategories(): Promise<MasterDataCategorySummary[]> {
    const countersByCategory = await this.buildCategoryCounters();

    return MASTER_DATA_CATEGORY_DEFINITIONS.map((category) => {
      const counters = countersByCategory.get(category.key) ?? {
        totalOptions: 0,
        activeOptions: 0,
      };
      return {
        ...category,
        totalOptions: counters.totalOptions,
        activeOptions: counters.activeOptions,
      };
    });
  }

  async listOptions(
    categoryKey: string,
    includeInactive = false,
  ): Promise<MasterDataOptionItem[]> {
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
          orderBy: [
            { sortOrder: "asc" },
            { label: "asc" },
            { createdAt: "asc" },
          ],
        });

        return options.map((option) => this.mapPrismaOption(option));
      }
    }

    return this.listMemoryOptions(normalizedCategoryKey, includeInactive);
  }

  async createOption(
    payload: CreateMasterDataOptionDto,
  ): Promise<MasterDataOptionItem> {
    const normalizedCategoryKey = this.assertSupportedCategory(
      payload.categoryKey,
    );
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
        (await this.resolveNextSortOrderForPrismaCategory(
          normalizedCategoryKey,
        ));

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

        this.logMutation("master-data.created", {
          optionId: created.id,
          categoryKey: normalizedCategoryKey,
          value: normalizedValue,
        });
        return this.mapPrismaOption(created);
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
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

    const sameCategory = this.memoryOptions.filter(
      (option) => option.categoryKey === normalizedCategoryKey,
    );
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
    this.logMutation("master-data.created", {
      optionId: created.id,
      categoryKey: normalizedCategoryKey,
      value: normalizedValue,
    });

    return this.mapMemoryOption(created);
  }

  async updateOption(
    optionId: string,
    payload: UpdateMasterDataOptionDto,
  ): Promise<MasterDataOptionItem> {
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
        throw new NotFoundException(
          `Master data option '${optionId}' not found.`,
        );
      }

      const nextValue =
        payload.value !== undefined
          ? this.resolveValueForCategory({
              categoryKey: current.categoryKey,
              value: payload.value,
              label: payload.label ?? current.label,
            })
          : current.value;
      const nextLabel =
        payload.label !== undefined
          ? normalizeRequiredLabel(payload.label)
          : current.label;

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
          metadata:
            payload.metadata !== undefined ? payload.metadata : undefined,
          sortOrder: payload.sortOrder ?? current.sortOrder,
          isActive: payload.isActive ?? current.isActive,
        },
      });

      this.logMutation("master-data.updated", {
        optionId: updated.id,
        categoryKey: updated.categoryKey,
        value: updated.value,
      });
      return this.mapPrismaOption(updated);
    }

    const targetIndex = this.memoryOptions.findIndex(
      (option) => option.id === normalizedOptionId,
    );
    if (targetIndex < 0) {
      throw new NotFoundException(
        `Master data option '${optionId}' not found.`,
      );
    }

    const current = this.memoryOptions[targetIndex];
    const nextLabel =
      payload.label !== undefined
        ? normalizeRequiredLabel(payload.label)
        : current.label;
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
        payload.description !== undefined
          ? payload.description.trim() || undefined
          : current.description,
      metadata:
        payload.metadata !== undefined ? payload.metadata : current.metadata,
      sortOrder: payload.sortOrder ?? current.sortOrder,
      isActive: payload.isActive ?? current.isActive,
      updatedAtIso: new Date().toISOString(),
    };
    this.memoryOptions[targetIndex] = next;
    this.logMutation("master-data.updated", {
      optionId: next.id,
      categoryKey: next.categoryKey,
      value: next.value,
    });

    return this.mapMemoryOption(next);
  }

  async deleteOption(optionId: string): Promise<{ deleted: true; id: string }> {
    const normalizedOptionId = optionId.trim();
    if (!normalizedOptionId) {
      throw new BadRequestException("Option id is required.");
    }

    if (this.dataSource === "prisma") {
      await this.ensurePrismaDefaultsSeeded();
      this.assertPrismaStorageWritable();
      const model = this.getPrismaMasterDataModelOrThrow();
      const current = await model.findUnique({
        where: { id: normalizedOptionId },
      });
      if (
        !current ||
        current.categoryKey === MASTER_DATA_SEED_MARKER_CATEGORY
      ) {
        throw new NotFoundException(
          `Master data option '${optionId}' not found.`,
        );
      }

      const dependencyMessage = await this.findPrismaOptionDependency(current);
      if (dependencyMessage) {
        throw new ConflictException(
          `Data '${current.label}' tidak dapat dihapus karena masih digunakan oleh ${dependencyMessage}.`,
        );
      }

      await model.delete({ where: { id: normalizedOptionId } });
      this.logMutation("master-data.deleted", {
        optionId: current.id,
        categoryKey: current.categoryKey,
        value: current.value,
      });
      return { deleted: true, id: current.id };
    }

    const targetIndex = this.memoryOptions.findIndex(
      (option) => option.id === normalizedOptionId,
    );
    if (targetIndex < 0) {
      throw new NotFoundException(
        `Master data option '${optionId}' not found.`,
      );
    }
    const [deleted] = this.memoryOptions.splice(targetIndex, 1);
    this.logMutation("master-data.deleted", {
      optionId: deleted.id,
      categoryKey: deleted.categoryKey,
      value: deleted.value,
    });
    return { deleted: true, id: deleted.id };
  }

  private async findPrismaOptionDependency(
    option: PrismaMasterDataOptionRecord,
  ): Promise<string | null> {
    const normalizedValue = option.value.trim().toLowerCase();
    switch (option.categoryKey) {
      case "bank-disbursement": {
        const count = await this.prisma.invoice.count({
          where: {
            notes: {
              contains: `[BankAccount:${option.value}]`,
              mode: "insensitive",
            },
          },
        });
        return count > 0 ? `${count} invoice` : null;
      }
      case "invoice-issuing-office": {
        const count = await this.prisma.invoice.count({
          where: {
            notes: {
              contains: `[IssuingOffice:${option.value}]`,
              mode: "insensitive",
            },
          },
        });
        return count > 0 ? `${count} invoice` : null;
      }
      case "invoice-client-name": {
        const count = await this.prisma.invoiceClient.count({
          where: {
            OR: [
              { name: { equals: option.label, mode: "insensitive" } },
              { name: { equals: option.value, mode: "insensitive" } },
            ],
          },
        });
        return count > 0 ? `${count} client invoice` : null;
      }
      case "invoice-status": {
        const status = INVOICE_STATUS_BY_OPTION_VALUE[normalizedValue];
        if (!status) return null;
        const count = await this.prisma.invoice.count({ where: { status } });
        return count > 0 ? `${count} invoice` : null;
      }
      case "user-role":
      case "role-catalog": {
        const role = AUTH_ROLE_BY_OPTION_VALUE[normalizedValue];
        if (!role) return null;
        const count = await this.prisma.authUser.count({ where: { role } });
        return count > 0 ? `${count} user` : null;
      }
      case "saudi-city": {
        const count = await this.prisma.itineraryItem.count({
          where: {
            OR: [
              { cityTourCity: { equals: option.label, mode: "insensitive" } },
              { cityTourCity: { equals: option.value, mode: "insensitive" } },
            ],
          },
        });
        return count > 0 ? `${count} itinerary` : null;
      }
      default:
        return null;
    }
  }

  private async buildCategoryCounters(): Promise<
    Map<string, { totalOptions: number; activeOptions: number }>
  > {
    const counters = new Map<
      string,
      { totalOptions: number; activeOptions: number }
    >();

    const options =
      this.dataSource === "prisma"
        ? await this.listAllOptionsWithPrisma()
        : this.memoryOptions.map((option) => this.mapMemoryOption(option));

    for (const option of options) {
      const current = counters.get(option.categoryKey) ?? {
        totalOptions: 0,
        activeOptions: 0,
      };
      current.totalOptions += 1;
      if (option.isActive) {
        current.activeOptions += 1;
      }
      counters.set(option.categoryKey, current);
    }

    return counters;
  }

  private listMemoryOptions(
    categoryKey: string,
    includeInactive: boolean,
  ): MasterDataOptionItem[] {
    return this.memoryOptions
      .filter(
        (option) =>
          option.categoryKey === categoryKey &&
          (includeInactive ? true : option.isActive),
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

  private mapMemoryOption(
    option: MemoryMasterDataOption,
  ): MasterDataOptionItem {
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

  private mapPrismaOption(
    option: PrismaMasterDataOptionRecord,
  ): MasterDataOptionItem {
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
      (allowedValue) =>
        allowedValue.toLowerCase() === candidateValue.toLowerCase(),
    );
    if (!matchedAllowlistValue) {
      throw new BadRequestException(
        `Value '${candidateValue}' is not allowed for category '${categoryKey}'. Allowed values: ${allowlist.join(", ")}.`,
      );
    }

    return matchedAllowlistValue;
  }

  private assertSupportedCategory(categoryKey: string): string {
    const normalizedCategoryKey = normalizeCategoryKey(categoryKey ?? "");
    if (!normalizedCategoryKey) {
      throw new BadRequestException("categoryKey is required.");
    }

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
    return (
      this.dataSource === "prisma" && this.prismaReadFallbackReason === null
    );
  }

  private shouldAllowPrismaReadFallback(): boolean {
    return this.nodeEnv !== "production";
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

  private createPrismaReadUnavailableError(
    reason: "missing-table" | "missing-client",
  ): InternalServerErrorException {
    if (reason === "missing-client") {
      return new InternalServerErrorException(
        "Prisma client belum memuat model MasterDataOption. Jalankan `npm run db:generate --workspace backend`, lalu restart backend.",
      );
    }

    return new InternalServerErrorException(
      "Tabel MasterDataOption belum ada di database. Jalankan `npm run db:migrate:backend`, lalu restart backend.",
    );
  }

  private getPrismaMasterDataModelOrThrow(): {
    findMany: (args?: unknown) => Promise<PrismaMasterDataOptionRecord[]>;
    findUnique: (args: unknown) => Promise<PrismaMasterDataOptionRecord | null>;
    create: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
    update: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
    delete: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
    upsert: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
    aggregate: (
      args: unknown,
    ) => Promise<{ _max: { sortOrder: number | null } }>;
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
      findUnique: (
        args: unknown,
      ) => Promise<PrismaMasterDataOptionRecord | null>;
      create: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
      update: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
      delete: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
      upsert: (args: unknown) => Promise<PrismaMasterDataOptionRecord>;
      aggregate: (
        args: unknown,
      ) => Promise<{ _max: { sortOrder: number | null } }>;
    };
  }

  private async resolveNextSortOrderForPrismaCategory(
    categoryKey: string,
  ): Promise<number> {
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
        if (!this.shouldAllowPrismaReadFallback()) {
          throw this.createPrismaReadUnavailableError("missing-table");
        }

        this.prismaReadFallbackReason = "missing-table";
        this.logger.warn(
          {
            reason: "missing-table",
          },
          "Master data storage fell back to in-memory reads because the Prisma table is missing.",
        );
        return;
      }

      if (isMasterDataModelMissingError(error)) {
        if (!this.shouldAllowPrismaReadFallback()) {
          throw this.createPrismaReadUnavailableError("missing-client");
        }

        this.prismaReadFallbackReason = "missing-client";
        this.logger.warn(
          {
            reason: "missing-client",
          },
          "Master data storage fell back to in-memory reads because the Prisma client is outdated.",
        );
        return;
      }

      throw error;
    }
  }

  private async seedPrismaDefaults(): Promise<void> {
    const model = this.getPrismaMasterDataModelOrThrow();

    const completedSeed = await model.findUnique({
      where: {
        categoryKey_value: {
          categoryKey: MASTER_DATA_SEED_MARKER_CATEGORY,
          value: MASTER_DATA_SEED_MARKER_VALUE,
        },
      },
    });
    if (completedSeed) {
      return;
    }

    for (const option of DEFAULT_MASTER_DATA_OPTIONS) {
      const existing = await model.findUnique({
        where: {
          categoryKey_value: {
            categoryKey: normalizeCategoryKey(option.categoryKey),
            value: option.value,
          },
        },
      });

      if (!existing) {
        await model.create({
          data: {
            categoryKey: normalizeCategoryKey(option.categoryKey),
            value: option.value,
            label: option.label,
            description: option.description ?? null,
            metadata:
              (option.metadata as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            sortOrder: option.sortOrder,
            isActive: option.isActive ?? true,
          },
        });
      }
    }

    await model.create({
      data: {
        categoryKey: MASTER_DATA_SEED_MARKER_CATEGORY,
        value: MASTER_DATA_SEED_MARKER_VALUE,
        label: "Master data defaults seeded",
        description: null,
        metadata: Prisma.JsonNull,
        sortOrder: 0,
        isActive: false,
      },
    });
  }

  private logMutation(action: string, details: Record<string, unknown>): void {
    this.logger.info(
      {
        action,
        dataSource: this.dataSource,
        ...details,
      },
      "Master data mutation completed.",
    );
  }
}
