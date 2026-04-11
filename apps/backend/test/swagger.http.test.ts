import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { afterEach, describe, expect, it } from "vitest";
// Import from dist so Swagger/Nest decorator metadata matches the compiled backend runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppModule } = require("../dist/app.module.js") as { AppModule: unknown };

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

describe("Backend Swagger DTO schema", () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    if (!app) {
      return;
    }

    await app.close();
    app = null;
  });

  it("documents auth operations with explicit OpenAPI summaries", async () => {
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
        const loginOperation = document.paths["/api/auth/login"]?.post;
        const sessionOperation = document.paths["/api/auth/session"]?.get;
        const loginResponseSchema =
          loginOperation?.responses?.["200"]?.content?.["application/json"]?.schema;
        const managedUserSchema = document.components?.schemas?.AuthManagedUserResponseDto;

        expect(loginOperation).toBeTruthy();
        expect(loginOperation?.summary).toBe("Login dashboard");
        expect(loginOperation?.description).toContain("HttpOnly cookie");
        expect(sessionOperation?.summary).toBe("Ambil session aktif");
        expect(loginResponseSchema).toEqual({
          $ref: "#/components/schemas/AuthBrowserSessionResponseDto",
        });
        expect(managedUserSchema).toBeTruthy();
      },
    );
  });

  it("documents groups operations with explicit OpenAPI summaries and params", async () => {
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
        const createGroupOperation = document.paths["/api/groups"]?.post;
        const listGroupsOperation = document.paths["/api/groups"]?.get;
        const updateItineraryOperation = document.paths["/api/groups/{idOrCode}/itinerary/{itemId}"]?.patch;
        const listGroupsResponseSchema =
          listGroupsOperation?.responses?.["200"]?.content?.["application/json"]?.schema;

        expect(createGroupOperation).toBeTruthy();
        expect(createGroupOperation?.summary).toBe("Create group");
        expect(createGroupOperation?.description).toContain("itinerary");
        expect(createGroupOperation?.responses?.["201"]?.content?.["application/json"]?.schema).toEqual({
          $ref: "#/components/schemas/GroupDetailResponseDto",
        });
        expect(listGroupsResponseSchema).toEqual({
          oneOf: [
            {
              type: "array",
              items: {
                $ref: "#/components/schemas/GroupSummaryResponseDto",
              },
            },
            {
              type: "array",
              items: {
                $ref: "#/components/schemas/GroupDetailResponseDto",
              },
            },
            {
              $ref: "#/components/schemas/PaginatedGroupSummaryResponseDto",
            },
            {
              $ref: "#/components/schemas/PaginatedGroupDetailResponseDto",
            },
          ],
        });
        expect(updateItineraryOperation).toBeTruthy();
        expect(updateItineraryOperation?.summary).toBe("Update itinerary item");
        expect(updateItineraryOperation?.parameters?.some((parameter) => {
          if (!parameter || typeof parameter !== "object" || !("name" in parameter)) {
            return false;
          }

          return (parameter as { name?: string }).name === "itemId";
        })).toBe(true);
      },
    );
  });
});
