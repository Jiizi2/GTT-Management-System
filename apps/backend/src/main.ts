import "dotenv/config";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { resolveRuntimeConfig, resolveStartupErrorMessage } from "./runtime-config";

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function resolveCorsOrigins(rawOrigins: string | undefined): string[] {
  const parsed = (rawOrigins ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (parsed.length === 0) {
    return DEFAULT_CORS_ORIGINS;
  }

  return Array.from(new Set(parsed));
}

async function bootstrap(): Promise<void> {
  const { port, dataSource } = resolveRuntimeConfig(process.env);
  const corsOrigins = resolveCorsOrigins(process.env.CORS_ORIGINS);
  const allowAllOrigins = corsOrigins.includes("*");
  const corsSummary = allowAllOrigins ? "*" : `${corsOrigins.length} origins`;
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowAllOrigins || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error("CORS origin is not allowed."), false);
      },
    },
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
