import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { SkipThrottle } from "@nestjs/throttler";
import { resolveConfiguredDataSource } from "../config/app-config";
import { Public } from "../auth/auth.public";
import { ApiErrorResponseDto } from "../http/api-error-response.dto";
import { PrismaService } from "../prisma/prisma.service";
import { HealthResponseDto } from "./dto/health-response.dto";
import fs from "node:fs";
import path from "node:path";

const HEALTH_CHECK_TIMEOUT_MS = 1_500;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      reject(new Error("Health check timeout."));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutHandle);
        resolve(value);
      })
      .catch((error: unknown) => {
        clearTimeout(timeoutHandle);
        reject(error);
      });
  });
}

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({
    summary: "Health check backend",
    description: "Mengembalikan status backend dan status koneksi database saat DATA_SOURCE=prisma.",
  })
  @ApiOkResponse({
    description: "Backend sehat dan siap menerima request.",
    type: HealthResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: "Backend hidup tetapi database tidak merespons.",
    type: ApiErrorResponseDto,
  })
  async check() {
    const dataSource = resolveConfiguredDataSource(this.configService);
    const timestamp = new Date().toISOString();

    if (dataSource === "prisma") {
      try {
        await withTimeout(this.prisma.$queryRaw`SELECT 1`, HEALTH_CHECK_TIMEOUT_MS);
        const migrationsDirectory = path.resolve(process.cwd(), "prisma", "migrations");
        const latestMigration = fs.readdirSync(migrationsDirectory, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()
          .at(-1);
        if (!latestMigration) throw new Error("Repository migration metadata is missing.");
        const applied = await withTimeout(
          this.prisma.$queryRaw<Array<{ applied: boolean }>>`
            SELECT EXISTS (
              SELECT 1 FROM "_prisma_migrations"
              WHERE migration_name = ${latestMigration} AND finished_at IS NOT NULL
            ) AS applied
          `,
          HEALTH_CHECK_TIMEOUT_MS,
        );
        if (!applied[0]?.applied) throw new Error("Latest repository migration is not applied.");
      } catch {
        throw new ServiceUnavailableException({
          ok: false,
          service: "backend",
          dataSource,
          database: "down",
          timestamp,
        });
      }
    }

    return {
      ok: true,
      service: "backend",
      dataSource,
      database: dataSource === "prisma" ? "up" : "n/a",
      timestamp,
    };
  }

  @Public()
  @SkipThrottle()
  @Get("live")
  liveness() {
    return {
      ok: true,
      service: "backend",
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @SkipThrottle()
  @Get("ready")
  readiness() {
    return this.check();
  }
}
