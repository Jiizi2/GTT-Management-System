import { ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

// Import from dist so Swagger/Nest decorator metadata matches the compiled backend runtime.
const { AppModule } = require("../dist/app.module.js") as { AppModule: any };

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

describe("MasterData Controller HTTP Integration", () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
  });

  it("should enforce authentication and authorization rules on master-data endpoints", async () => {
    await withEnv(
      {
        DATA_SOURCE: "memory",
        NODE_ENV: "test",
        AUTH_BOOTSTRAP_DEFAULT_USERS: "true",
      },
      async () => {
        app = await createTestApp();
        
        // Force matching Host and Origin to pass CORS/CSRF guards
        const targetHost = "localhost:3000";
        const targetOrigin = "http://localhost:3000";
        const targetCategory = "invoice-client-name";
        
        // Use a unique label to avoid conflicts with shared state or concurrent test runs
        const randomSuffix = Math.floor(Math.random() * 1000000);
        const randomLabel = `Surabaya-${randomSuffix}`;

        // 1. Authenticate as superadmin
        const superadminLogin = await request(app.getHttpServer())
          .post("/api/auth/login")
          .send({
            identifier: "dev.superadmin",
            password: "DevSuperAdmin#2026",
            rememberSession: false,
          })
          .expect(200);

        const superadminCookie = superadminLogin.headers["set-cookie"]?.[0]?.split(";")?.[0] ?? "";
        expect(superadminCookie).toBeTruthy();

        // 2. Authenticate as normal admin
        const adminLogin = await request(app.getHttpServer())
          .post("/api/auth/login")
          .send({
            identifier: "dev.admin",
            password: "DevAdmin#2026",
            rememberSession: false,
          })
          .expect(200);

        const adminCookie = adminLogin.headers["set-cookie"]?.[0]?.split(";")?.[0] ?? "";
        expect(adminCookie).toBeTruthy();

        // 3. GET /api/master-data/categories (authenticated as superadmin)
        const categoriesRes = await request(app.getHttpServer())
          .get("/api/master-data/categories")
          .set("Cookie", superadminCookie)
          .expect(200);
        expect(Array.isArray(categoriesRes.body)).toBe(true);
        expect(categoriesRes.body.length).toBeGreaterThan(0);
        expect(categoriesRes.body[0]).toHaveProperty("key");

        // 4. GET /api/master-data/options (authenticated as admin)
        const optionsRes = await request(app.getHttpServer())
          .get(`/api/master-data/options?categoryKey=${targetCategory}`)
          .set("Cookie", adminCookie)
          .expect(200);
        expect(Array.isArray(optionsRes.body)).toBe(true);
        expect(optionsRes.body.length).toBeGreaterThan(0);
        expect(optionsRes.body[0].categoryKey).toBe(targetCategory);

        // 5. POST /api/master-data/options (restricted to superadmin, should block admin with 403)
        const newOptionPayload = {
          categoryKey: targetCategory,
          label: randomLabel,
        };
        await request(app.getHttpServer())
          .post("/api/master-data/options")
          .set("Cookie", adminCookie)
          .set("Host", targetHost)
          .set("Origin", targetOrigin)
          .send(newOptionPayload)
          .expect(403); // Forbidden for admin role

        // Should allow superadmin
        const createdOptionRes = await request(app.getHttpServer())
          .post("/api/master-data/options")
          .set("Cookie", superadminCookie)
          .set("Host", targetHost)
          .set("Origin", targetOrigin)
          .send(newOptionPayload);
        
        if (createdOptionRes.status !== 201) {
          console.error("403 ERROR BODY:", createdOptionRes.body);
        }
        expect(createdOptionRes.status).toBe(201);
        expect(createdOptionRes.body.label).toBe(randomLabel);
        expect(createdOptionRes.body.isActive).toBe(true);

        const optionId = createdOptionRes.body.id;

        // 6. PATCH /api/master-data/options/:optionId (restricted to superadmin, should block admin with 403)
        const patchPayload = {
          label: `${randomLabel} Kota`,
          isActive: false,
        };
        await request(app.getHttpServer())
          .patch(`/api/master-data/options/${optionId}`)
          .set("Cookie", adminCookie)
          .set("Host", targetHost)
          .set("Origin", targetOrigin)
          .send(patchPayload)
          .expect(403);

        const patchedRes = await request(app.getHttpServer())
          .patch(`/api/master-data/options/${optionId}`)
          .set("Cookie", superadminCookie)
          .set("Host", targetHost)
          .set("Origin", targetOrigin)
          .send(patchPayload)
          .expect(200);
        expect(patchedRes.body.label).toBe(`${randomLabel} Kota`);
        expect(patchedRes.body.isActive).toBe(false);

        // 7. Validation error check (invalid DTO values)
        await request(app.getHttpServer())
          .post("/api/master-data/options")
          .set("Cookie", superadminCookie)
          .set("Host", targetHost)
          .set("Origin", targetOrigin)
          .send({
            categoryKey: "  ", // invalid empty
            label: randomLabel,
          })
          .expect(400);
      },
    );
  });
});
