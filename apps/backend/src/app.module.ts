import { randomUUID } from "node:crypto";
import { Module, RequestMethod } from "@nestjs/common";
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
import { PrismaService } from "./prisma/prisma.service";
import { RuntimeMaintenanceModule } from "./runtime-maintenance/runtime-maintenance.module";
import { AppThrottlerGuard } from "./throttling/app-throttler.guard";
import { AppThrottlerStorage } from "./throttling/app-throttler.storage";
import { RepositoriesModule } from "./infrastructure/repositories/repositories.module";
import { AgentsModule } from "./agents/agents.module";
import { AgentAuthModule } from "./agent-auth/agent-auth.module";
import { AgentPortalReadModule } from "./agent-portal-read/agent-portal-read.module";
import { VisaApplicationsModule } from "./visa-applications/visa-applications.module";

type HttpLogRequest = {
  id?: unknown;
  method?: string;
  url?: string;
  readableAborted?: boolean;
};

type HttpLogResponse = {
  statusCode?: number;
  writableEnded?: boolean;
};

type HttpLogBindings = {
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
};

function toCompactHttpLogBindings(
  request: HttpLogRequest,
  response: HttpLogResponse,
  responseTimeMs?: number,
): HttpLogBindings {
  return {
    requestId:
      typeof request.id === "string" || typeof request.id === "number"
        ? String(request.id)
        : undefined,
    method: request.method,
    path: request.url,
    statusCode: response.statusCode,
    durationMs:
      typeof responseTimeMs === "number" && Number.isFinite(responseTimeMs)
        ? Math.max(0, Math.round(responseTimeMs))
        : undefined,
  };
}

function resolveHttpSuccessMessage(
  request: HttpLogRequest,
  response: HttpLogResponse,
): string {
  if (request.readableAborted || !response.writableEnded) {
    return "aborted";
  }

  return "responded";
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRootAsync({
      imports: [PrismaModule],
      inject: [ConfigService, PrismaService],
      useFactory: (configService: ConfigService, prismaService: PrismaService) => ({
        storage: new AppThrottlerStorage(prismaService, configService),
        throttlers: [
          {
            name: "default",
            ttl: configService.getOrThrow<number>("THROTTLE_DEFAULT_TTL_MS"),
            limit: configService.getOrThrow<number>("THROTTLE_DEFAULT_LIMIT"),
            blockDuration: configService.getOrThrow<number>("THROTTLE_DEFAULT_BLOCK_MS"),
          },
        ],
      }),
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = (configService.get<string>("NODE_ENV") ?? "development").toLowerCase();
        const logLevel =
          (configService.get<string>("LOG_LEVEL") ??
            (nodeEnv === "production" ? "info" : "warn")).toLowerCase();
        const shouldLogSuccessfulHttpRequests =
          configService.get<boolean>("HTTP_LOG_SUCCESS") ?? nodeEnv === "production";
        const shouldIgnoreHttpRequestLog = (request: { url?: string }) =>
          request.url?.startsWith("/api/health") ?? false;

        return {
          forRoutes: [
            {
              path: "*path",
              method: RequestMethod.ALL,
            },
          ],
          pinoHttp: {
            level: logLevel,
            autoLogging: {
              ignore: shouldIgnoreHttpRequestLog,
            },
            quietReqLogger: true,
            quietResLogger: true,
            wrapSerializers: false,
            customProps: () => ({
              context: "HTTP",
            }),
            customAttributeKeys: {
              responseTime: "ms",
            },
            customSuccessObject: (
              request: HttpLogRequest,
              response: HttpLogResponse,
              value: { ms?: number },
            ) => ({
              ...value,
              ...toCompactHttpLogBindings(request, response, value.ms),
            }),
            customErrorObject: (
              request: HttpLogRequest,
              response: HttpLogResponse,
              error: Error,
              value: { ms?: number },
            ) => ({
              ...value,
              ...toCompactHttpLogBindings(request, response, value.ms),
              errorName: error.name,
            }),
            serializers: {
              req: (request: { id?: string; method?: string; url?: string }) => ({
                id: request.id,
                method: request.method,
                url: request.url,
              }),
              res: (response: { statusCode?: number }) => ({
                statusCode: response.statusCode,
              }),
              err: (error: { name?: string; message?: string; code?: string; statusCode?: number }) => ({
                type: error.name,
                message: error.message,
                code: error.code,
                statusCode: error.statusCode,
              }),
            },
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
                      colorizeObjects: false,
                      levelFirst: true,
                      translateTime: "SYS:standard",
                      singleLine: true,
                      messageFormat:
                        "{if context}[{context}] {end}{if action}{action}: {end}{msg}{if requestId} ({requestId}){end}{if method} {method} {path}{end}{if statusCode} -> {statusCode}{end}{if durationMs} ({durationMs} ms){end}",
                      ignore:
                        "pid,hostname,context,action,req,res,ms,requestId,method,path,statusCode,durationMs",
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
            customSuccessMessage: (request, response) =>
              resolveHttpSuccessMessage(request as HttpLogRequest, response as HttpLogResponse),
            customErrorMessage: () => "errored",
            customLogLevel: (request, response, error) => {
              if (error || response.statusCode >= 500) {
                return "error";
              }

              if (response.statusCode >= 400) {
                return "warn";
              }

              if (shouldIgnoreHttpRequestLog(request)) {
                return "silent";
              }

              return shouldLogSuccessfulHttpRequests ? "info" : "silent";
            },
          },
        };
      },
    }),
    AuthModule,
    AgentsModule,
    AgentAuthModule,
    AgentPortalReadModule,
    VisaApplicationsModule,
    PrismaModule,
    RuntimeMaintenanceModule,
    HealthModule,
    GroupsModule,
    InvoicesModule,
    MasterDataModule,
    RepositoriesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
