import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { Logger, PinoLogger } from "nestjs-pino";
import { AUTH_COOKIE_NAME } from "./auth/auth-cookie";
import type { RuntimeDataSource } from "./runtime-config";
import { AppModule } from "./app.module";
import { isOriginAllowed, resolveCorsOrigins } from "./http-origin";
import { resolveStartupErrorMessage } from "./runtime-config";

type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;
type HeaderResponse = {
  setHeader: (name: string, value: string) => void;
};
type NextHandler = () => void;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  const bootstrapLogger = app.get(PinoLogger);
  bootstrapLogger.setContext("Bootstrap");
  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>("PORT");
  const dataSource = configService.getOrThrow<RuntimeDataSource>("DATA_SOURCE");
  const corsOrigins = resolveCorsOrigins(configService.get<string>("CORS_ORIGINS"));
  const corsSummary = `${corsOrigins.length} origins`;

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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

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
  bootstrapLogger.info(
    {
      dataSource,
      corsOrigins: corsSummary,
      apiUrl: `http://localhost:${port}/api`,
      docsUrl: `http://localhost:${port}/api/docs`,
    },
    "Backend API ready",
  );
}

bootstrap().catch((error: unknown) => {
  const errorMessage = resolveStartupErrorMessage(error);
  console.error(`Failed to start backend: ${errorMessage}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
