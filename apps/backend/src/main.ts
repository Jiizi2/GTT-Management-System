import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import express from "express";
import helmet from "helmet";
import { Logger, PinoLogger } from "nestjs-pino";
import { AUTH_COOKIE_NAME } from "./auth/auth-cookie";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./http/api-exception.filter";
import { isOriginAllowed, resolveCorsOrigins } from "./http-origin";
import { resolveStartupErrorMessage } from "./runtime-config";

type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;
type HeaderResponse = {
  setHeader: (name: string, value: string) => void;
};
type NextHandler = () => void;
type StartupSummary = {
  port: number;
  docsUrl: string;
  dataSource: string;
};

const VISIBLE_INFO_LOG_LEVELS = new Set(["trace", "debug", "info"]);

function resolveApplicationLogLevel(configService: ConfigService): string {
  const nodeEnv = (configService.get<string>("NODE_ENV") ?? "development").toLowerCase();
  return (
    configService.get<string>("LOG_LEVEL") ??
    (nodeEnv === "production" ? "info" : "warn")
  ).toLowerCase();
}

function printStartupSummary(summary: StartupSummary): void {
  console.info(
    `[backend] listening on http://localhost:${summary.port}/api | docs: ${summary.docsUrl} | data source: ${summary.dataSource}`,
  );
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  const bootstrapLogger = await app.resolve(PinoLogger);
  bootstrapLogger.setContext("Bootstrap");
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>("PORT");
  const corsOrigins = resolveCorsOrigins(configService.get<string>("CORS_ORIGINS"));

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      permittedCrossDomainPolicies: { permittedPolicies: "none" },
      referrerPolicy: { policy: "no-referrer" },
      xFrameOptions: { action: "deny" },
    }),
  );

  const httpServer = app.getHttpAdapter().getInstance() as {
    disable?: (name: string) => void;
  };
  httpServer.disable?.("x-powered-by");

  app.enableCors({
    origin: (origin: string | undefined, callback: CorsOriginCallback) => {
      if (!origin || isOriginAllowed(origin, corsOrigins)) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          `CORS origin is not allowed: '${origin}'. Allowed origins: ${corsOrigins.join(", ")}`,
        ),
        false,
      );
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.use((_: unknown, response: HeaderResponse, next: NextHandler) => {
    response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
    next();
  });

  app.setGlobalPrefix("api");
  app.use(
    express.json({
      limit: "1mb",
      strict: true,
    }),
  );
  app.use(
    express.urlencoded({
      extended: true,
      limit: "1mb",
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("GTT Backend API")
    .setDescription("Operational backend API for auth, groups, invoices, master data, and health.")
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Bearer token for internal clients and testing flows.",
      },
      "access-token",
    )
    .addCookieAuth(
      AUTH_COOKIE_NAME,
      {
        type: "apiKey",
        in: "cookie",
        description: "HttpOnly browser session cookie used by the dashboard frontend.",
      },
      "auth-cookie",
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, swaggerDocument, {
    useGlobalPrefix: true,
    explorer: true,
    customSiteTitle: "GTT Backend API Docs",
    swaggerOptions: {
      persistAuthorization: true,
    },
    jsonDocumentUrl: "docs/json",
  });

  await app.listen(port);
  const startupSummary: StartupSummary = {
    port,
    docsUrl: `http://localhost:${port}/api/docs`,
    dataSource: configService.get<string>("DATA_SOURCE") ?? "memory",
  };
  bootstrapLogger.info(
    startupSummary,
    "Backend server is ready.",
  );
  if (!VISIBLE_INFO_LOG_LEVELS.has(resolveApplicationLogLevel(configService))) {
    printStartupSummary(startupSummary);
  }
}

bootstrap().catch((error: unknown) => {
  const errorMessage = resolveStartupErrorMessage(error);
  console.error(`Failed to start backend: ${errorMessage}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
