import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SkipThrottle } from "@nestjs/throttler";
import { resolveConfiguredDataSource } from "../config/app-config";
import { Public } from "../auth/auth.public";
import { PrismaService } from "../prisma/prisma.service";

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

@Controller("health")
export class HealthController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  async check() {
    const dataSource = resolveConfiguredDataSource(this.configService);
    const timestamp = new Date().toISOString();

    if (dataSource === "prisma") {
      try {
        await withTimeout(this.prisma.$queryRaw`SELECT 1`, HEALTH_CHECK_TIMEOUT_MS);
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
}
