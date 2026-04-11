import { randomUUID } from "node:crypto";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { AuthModule } from "./auth/auth.module";
import { validateEnvironment } from "./config/env.validation";
import { GroupsModule } from "./groups/groups.module";
import { HealthModule } from "./health/health.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { MasterDataModule } from "./master-data/master-data.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AppThrottlerGuard } from "./throttling/app-throttler.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: "default",
          ttl: configService.getOrThrow<number>("THROTTLE_DEFAULT_TTL_MS"),
          limit: configService.getOrThrow<number>("THROTTLE_DEFAULT_LIMIT"),
          blockDuration: configService.getOrThrow<number>("THROTTLE_DEFAULT_BLOCK_MS"),
        },
      ],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = (configService.get<string>("NODE_ENV") ?? "development").toLowerCase();
        const logLevel =
          (configService.get<string>("LOG_LEVEL") ??
            (nodeEnv === "production" ? "info" : "debug")).toLowerCase();

        return {
          pinoHttp: {
            level: logLevel,
            autoLogging: true,
            redact: {
              paths: [
                "req.headers.authorization",
                "req.headers.cookie",
                "res.headers['set-cookie']",
              ],
              remove: true,
            },
            transport:
              nodeEnv === "production"
                ? undefined
                : {
                    target: "pino-pretty",
                    options: {
                      colorize: true,
                      translateTime: "SYS:standard",
                      ignore: "pid,hostname",
                    },
                  },
            genReqId: (request, response) => {
              const forwardedRequestId = request.headers["x-request-id"];
              const requestId =
                typeof forwardedRequestId === "string" && forwardedRequestId.trim()
                  ? forwardedRequestId.trim()
                  : Array.isArray(forwardedRequestId) &&
                      typeof forwardedRequestId[0] === "string" &&
                      forwardedRequestId[0].trim()
                    ? forwardedRequestId[0].trim()
                    : randomUUID();

              response.setHeader("x-request-id", requestId);
              return requestId;
            },
            customProps: (request) => ({
              requestId: request.id,
            }),
            customSuccessMessage: (request, response) =>
              `${request.method} ${request.url} completed with ${response.statusCode}`,
            customErrorMessage: (request, response) =>
              `${request.method} ${request.url} failed with ${response.statusCode}`,
            customLogLevel: (_, response, error) => {
              if (error || response.statusCode >= 500) {
                return "error";
              }

              if (response.statusCode >= 400) {
                return "warn";
              }

              return "info";
            },
          },
        };
      },
    }),
    AuthModule,
    PrismaModule,
    HealthModule,
    GroupsModule,
    InvoicesModule,
    MasterDataModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
