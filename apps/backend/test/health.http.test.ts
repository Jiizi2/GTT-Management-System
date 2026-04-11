import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { AppModule } from "../src/app.module";

async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  const previousValues = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await fn();
  } finally {
    for (const [key, previousValue] of previousValues.entries()) {
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }
  }
}

async function createTestApp(): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule, {
    logger: false,
  });

  app.setGlobalPrefix("api");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.init();
  return app;
}

describe("Backend HTTP", () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    if (!app) {
      return;
    }

    await app.close();
    app = null;
  });

  it("serves health endpoint through supertest", async () => {
    await withEnv(
      {
        DATA_SOURCE: "memory",
        NODE_ENV: "test",
      },
      async () => {
        app = await createTestApp();

        const response = await request(app.getHttpServer()).get("/api/health").expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.service).toBe("backend");
        expect(response.body.dataSource).toBe("memory");
        expect(response.headers["x-request-id"]).toBeTruthy();
      },
    );
  });

  it("generates OpenAPI document from controller metadata", async () => {
    await withEnv(
      {
        DATA_SOURCE: "memory",
        NODE_ENV: "test",
      },
      async () => {
        app = await createTestApp();

        const document = SwaggerModule.createDocument(
          app,
          new DocumentBuilder().setTitle("Backend Test").setVersion("1.0").build(),
        );
        const operationTags = Object.values(document.paths)
          .flatMap((pathItem) => Object.values(pathItem ?? {}))
          .flatMap((operation) =>
            operation && typeof operation === "object" && "tags" in operation
              ? (((operation as { tags?: string[] }).tags ?? []) as string[])
              : [],
          );

        expect(operationTags).toContain("Auth");
        expect(operationTags).toContain("Groups");
        expect(Object.keys(document.paths).some((path) => path.endsWith("/groups"))).toBe(true);
      },
    );
  });
});
