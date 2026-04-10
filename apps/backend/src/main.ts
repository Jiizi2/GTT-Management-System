import "dotenv/config";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { isOriginAllowed, resolveCorsOrigins } from "./http-origin";
import { resolveRuntimeConfig, resolveStartupErrorMessage } from "./runtime-config";

type CorsOriginCallback = (error: Error | null, allow?: boolean) => void;
type HeaderResponse = {
  setHeader: (name: string, value: string) => void;
};
type NextHandler = () => void;

async function bootstrap(): Promise<void> {
  const { port, dataSource } = resolveRuntimeConfig(process.env);
  const corsOrigins = resolveCorsOrigins(process.env.CORS_ORIGINS);
  const corsSummary = `${corsOrigins.length} origins`;
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
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
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
    response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    response.setHeader("X-Permitted-Cross-Domain-Policies", "none");
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

  await app.listen(port);
  console.log(
    `Backend API ready on http://localhost:${port}/api (dataSource=${dataSource}, cors=${corsSummary})`,
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
