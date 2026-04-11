import {
  Inject,
  Injectable,
  InternalServerErrorException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import {
  resolveConfiguredBoolean,
  resolveConfiguredDataSource,
  resolveConfiguredNodeEnv,
  resolveConfiguredNumber,
} from "../config/app-config";
import { createStructuredLogger } from "../logging/create-structured-logger";
import { PrismaService } from "../prisma/prisma.service";

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;
const DEFAULT_RETENTION_ENABLED = true;
const DEFAULT_RETENTION_INTERVAL_MS = HOUR_IN_MS;
const DEFAULT_GROUP_AUDIT_LOG_RETENTION_DAYS = 180;
const DEFAULT_AUTH_LOGIN_RATE_LIMIT_RETENTION_DAYS = 14;
const DEFAULT_APP_THROTTLE_RETENTION_DAYS = 14;

type DeleteManyResult = {
  count: number;
};

type GroupAuditLogModel = {
  deleteMany: (args: unknown) => Promise<DeleteManyResult>;
};

type AuthLoginRateLimitBucketModel = {
  deleteMany: (args: unknown) => Promise<DeleteManyResult>;
};

type AppThrottleBucketModel = {
  deleteMany: (args: unknown) => Promise<DeleteManyResult>;
};

type RuntimeRetentionPrismaModels = {
  groupAuditLog: GroupAuditLogModel;
  authLoginRateLimitBucket: AuthLoginRateLimitBucketModel;
  appThrottleBucket: AppThrottleBucketModel;
};

type RuntimeRetentionSummary = {
  deletedGroupAuditLogs: number;
  deletedAuthLoginRateLimitBuckets: number;
  deletedAppThrottleBuckets: number;
};

function isMissingPrismaTableError(error: unknown, tableName: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2021") {
    return false;
  }

  const resolvedTableName = (error.meta as { table?: unknown } | undefined)?.table;
  return typeof resolvedTableName === "string" && resolvedTableName.includes(tableName);
}

@Injectable()
export class RuntimeRetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = createStructuredLogger(RuntimeRetentionService.name);
  private readonly dataSource: "memory" | "prisma";
  private readonly nodeEnv: string;
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private readonly groupAuditLogRetentionDays: number;
  private readonly authLoginRateLimitRetentionDays: number;
  private readonly appThrottleRetentionDays: number;
  private readonly now: () => number;
  private timer: NodeJS.Timeout | null = null;
  private disabledReason: "missing-client" | "missing-table" | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
    @Optional()
    @Inject("RUNTIME_RETENTION_OPTIONS")
    options?: Partial<{
      now: () => number;
    }>,
  ) {
    this.dataSource = resolveConfiguredDataSource(this.configService);
    this.nodeEnv = resolveConfiguredNodeEnv(this.configService);
    this.enabled =
      resolveConfiguredBoolean(this.configService, "RUNTIME_RETENTION_ENABLED") ??
      DEFAULT_RETENTION_ENABLED;
    this.intervalMs = Math.max(
      60_000,
      resolveConfiguredNumber(
        this.configService,
        "RUNTIME_RETENTION_INTERVAL_MS",
        DEFAULT_RETENTION_INTERVAL_MS,
      ),
    );
    this.groupAuditLogRetentionDays = Math.max(
      1,
      resolveConfiguredNumber(
        this.configService,
        "GROUP_AUDIT_LOG_RETENTION_DAYS",
        DEFAULT_GROUP_AUDIT_LOG_RETENTION_DAYS,
      ),
    );
    this.authLoginRateLimitRetentionDays = Math.max(
      1,
      resolveConfiguredNumber(
        this.configService,
        "AUTH_LOGIN_RATE_LIMIT_RETENTION_DAYS",
        DEFAULT_AUTH_LOGIN_RATE_LIMIT_RETENTION_DAYS,
      ),
    );
    this.appThrottleRetentionDays = Math.max(
      1,
      resolveConfiguredNumber(
        this.configService,
        "APP_THROTTLE_BUCKET_RETENTION_DAYS",
        DEFAULT_APP_THROTTLE_RETENTION_DAYS,
      ),
    );
    this.now = options?.now ?? (() => Date.now());
  }

  async onModuleInit(): Promise<void> {
    if (this.dataSource !== "prisma" || !this.enabled) {
      return;
    }

    await this.runCleanupNow("startup");
    if (this.disabledReason !== null) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runCleanupNow("scheduled");
    }, this.intervalMs);
    this.timer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runCleanupNow(trigger: "startup" | "scheduled" | "manual" = "manual"): Promise<void> {
    if (this.dataSource !== "prisma" || !this.enabled || this.disabledReason !== null) {
      return;
    }

    try {
      const result = await this.cleanupRuntimeData();
      if (
        result.deletedGroupAuditLogs > 0 ||
        result.deletedAuthLoginRateLimitBuckets > 0 ||
        result.deletedAppThrottleBuckets > 0
      ) {
        this.logger.info(
          {
            action: "runtime-retention.cleanup.completed",
            trigger,
            dataSource: this.dataSource,
            ...result,
          },
          "Runtime retention cleanup deleted stale rows.",
        );
        return;
      }

      this.logger.debug(
        {
          action: "runtime-retention.cleanup.completed",
          trigger,
          dataSource: this.dataSource,
          ...result,
        },
        "Runtime retention cleanup finished without deleting rows.",
      );
    } catch (error: unknown) {
      const missingClientError = this.isMissingClientModelError(error);
      const missingTableError =
        isMissingPrismaTableError(error, "GroupAuditLog") ||
        isMissingPrismaTableError(error, "AuthLoginRateLimitBucket") ||
        isMissingPrismaTableError(error, "AppThrottleBucket");

      if (missingClientError || missingTableError) {
        const reason = missingClientError ? "missing-client" : "missing-table";
        if (this.nodeEnv === "production") {
          throw this.createUnavailableStorageError(reason);
        }

        this.disabledReason = reason;
        this.logger.warn(
          {
            action: "runtime-retention.cleanup.disabled",
            reason,
          },
          "Runtime retention cleanup is disabled because Prisma storage is not ready yet.",
        );
        return;
      }

      if (trigger === "startup" && this.nodeEnv === "production") {
        throw error;
      }

      this.logger.warn(
        {
          action: "runtime-retention.cleanup.failed",
          trigger,
          error,
        },
        "Runtime retention cleanup failed.",
      );
    }
  }

  private async cleanupRuntimeData(): Promise<RuntimeRetentionSummary> {
    const nowEpochMs = this.now();
    const models = this.getPrismaModelsOrThrow();
    const groupAuditCutoff = new Date(nowEpochMs - this.groupAuditLogRetentionDays * DAY_IN_MS);
    const authLoginCutoff = new Date(nowEpochMs - this.authLoginRateLimitRetentionDays * DAY_IN_MS);
    const appThrottleCutoff = new Date(nowEpochMs - this.appThrottleRetentionDays * DAY_IN_MS);

    const [groupAuditLogResult, authLoginRateLimitResult, appThrottleResult] = await Promise.all([
      models.groupAuditLog.deleteMany({
        where: {
          createdAt: {
            lt: groupAuditCutoff,
          },
        },
      }),
      models.authLoginRateLimitBucket.deleteMany({
        where: {
          lastSeenAt: {
            lt: authLoginCutoff,
          },
        },
      }),
      models.appThrottleBucket.deleteMany({
        where: {
          lastSeenAt: {
            lt: appThrottleCutoff,
          },
        },
      }),
    ]);

    return {
      deletedGroupAuditLogs: groupAuditLogResult.count,
      deletedAuthLoginRateLimitBuckets: authLoginRateLimitResult.count,
      deletedAppThrottleBuckets: appThrottleResult.count,
    };
  }

  private getPrismaModelsOrThrow(): RuntimeRetentionPrismaModels {
    const prismaRecord = this.prisma as unknown as Record<string, unknown>;
    const groupAuditLog = prismaRecord.groupAuditLog;
    const authLoginRateLimitBucket = prismaRecord.authLoginRateLimitBucket;
    const appThrottleBucket = prismaRecord.appThrottleBucket;

    if (
      !groupAuditLog ||
      typeof groupAuditLog !== "object" ||
      !authLoginRateLimitBucket ||
      typeof authLoginRateLimitBucket !== "object" ||
      !appThrottleBucket ||
      typeof appThrottleBucket !== "object"
    ) {
      throw new InternalServerErrorException(
        "Prisma client belum memuat model runtime retention. Jalankan `npm run db:generate --workspace backend`, lalu restart backend.",
      );
    }

    return {
      groupAuditLog: groupAuditLog as GroupAuditLogModel,
      authLoginRateLimitBucket: authLoginRateLimitBucket as AuthLoginRateLimitBucketModel,
      appThrottleBucket: appThrottleBucket as AppThrottleBucketModel,
    };
  }

  private isMissingClientModelError(error: unknown): boolean {
    if (!(error instanceof InternalServerErrorException)) {
      return false;
    }

    const response = error.getResponse();
    const message =
      typeof response === "string"
        ? response
        : typeof response === "object" && response && "message" in response
          ? String((response as { message?: unknown }).message ?? "")
          : "";

    return message.includes("Prisma client belum memuat model runtime retention");
  }

  private createUnavailableStorageError(
    reason: "missing-client" | "missing-table",
  ): InternalServerErrorException {
    if (reason === "missing-client") {
      return new InternalServerErrorException(
        "Prisma client belum memuat model runtime retention. Jalankan `npm run db:generate --workspace backend`, lalu restart backend.",
      );
    }

    return new InternalServerErrorException(
      "Tabel runtime retention belum lengkap di database. Jalankan `npm run db:migrate:backend`, lalu restart backend.",
    );
  }
}
