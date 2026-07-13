import { describe, expect } from "vitest";
import { runCase } from "../test/run-case";
import { withEnv } from "../test/with-env";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaService } from "../prisma/prisma.service";
import { MasterDataService } from "./master-data.service";

describe("MasterDataService", () => {
  describe("Category Validation", () => {
    runCase("list options requires categoryKey", async () => {
      const service = new MasterDataService({} as PrismaService);

      await expect(
        service.listOptions("" as unknown as string),
      ).rejects.toThrow(/categoryKey is required/i);
    });

    runCase("list options rejects unsupported category", async () => {
      const service = new MasterDataService({} as PrismaService);

      await expect(
        service.listOptions("invalid-category"),
      ).rejects.toThrow(/Unsupported category/i);
    });

    runCase("list categories returns all defined categories", async () => {
      const service = new MasterDataService({} as PrismaService);
      const categories = await service.listCategories();

      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0]).toHaveProperty("key");
      expect(categories[0]).toHaveProperty("label");
      expect(categories[0]).toHaveProperty("totalOptions");
      expect(categories[0]).toHaveProperty("activeOptions");
    });
  });

  describe("Memory Mode Operations", () => {
    runCase("list options returns default options for invoice-status", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);
        const options = await service.listOptions("invoice-status");

        expect(options.length).toBeGreaterThan(0);
        expect(options[0]).toHaveProperty("id");
        expect(options[0]).toHaveProperty("categoryKey", "invoice-status");
        expect(options[0]).toHaveProperty("value");
        expect(options[0]).toHaveProperty("label");
        expect(options[0]).toHaveProperty("sortOrder");
        expect(options[0]).toHaveProperty("isActive", true);
      });
    });

    runCase("list options filters inactive by default", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);

        // Create an inactive option using a category without allowlist (invoice-issuing-office)
        await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "Inactive Office",
          isActive: false,
        });

        const activeOptions = await service.listOptions("invoice-issuing-office");
        const allOptions = await service.listOptions("invoice-issuing-office", true);

        expect(allOptions.length).toBeGreaterThan(activeOptions.length);
        expect(activeOptions.every((opt) => opt.isActive)).toBe(true);
      });
    });

    runCase("create option with auto-generated value", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);
        const created = await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "New Office",
        });

        expect(created.value).toBe("NEW_OFFICE");
        expect(created.label).toBe("New Office");
        expect(created.isActive).toBe(true);
        expect(created.sortOrder).toBeGreaterThan(0);
      });
    });

    runCase("create option with explicit value", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);
        const created = await service.createOption({
          categoryKey: "invoice-issuing-office",
          value: "CUSTOM_OFFICE",
          label: "Custom Office",
        });

        expect(created.value).toBe("CUSTOM_OFFICE");
        expect(created.label).toBe("Custom Office");
      });
    });

    runCase("create option rejects duplicate value", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);

        await service.createOption({
          categoryKey: "invoice-issuing-office",
          value: "UNIQUE_OFFICE",
          label: "First Office",
        });

        await expect(
          service.createOption({
            categoryKey: "invoice-issuing-office",
            value: "UNIQUE_OFFICE",
            label: "Second Office",
          }),
        ).rejects.toThrow(/already exists/i);
      });
    });

    runCase("create option with description and metadata", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);
        const created = await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "Detailed Office",
          description: "An office with details",
          metadata: { color: "#FF0000", priority: 1 },
        });

        expect(created.description).toBe("An office with details");
        expect(created.metadata).toEqual({ color: "#FF0000", priority: 1 });
      });
    });

    runCase("create option requires non-empty label", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);

        await expect(
          service.createOption({
            categoryKey: "invoice-issuing-office",
            label: "   ",
          }),
        ).rejects.toThrow(/Label is required/i);
      });
    });

    runCase("update option changes label and value", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);
        const created = await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "Original Label",
        });

        const updated = await service.updateOption(created.id, {
          label: "Updated Label",
          value: "UPDATED_VALUE",
        });

        expect(updated.label).toBe("Updated Label");
        expect(updated.value).toBe("UPDATED_VALUE");
        expect(updated.id).toBe(created.id);
      });
    });

    runCase("update option rejects non-existent id", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);

        await expect(
          service.updateOption("non-existent-id", {
            label: "New Label",
          }),
        ).rejects.toThrow(/not found/i);
      });
    });

    runCase("update option rejects duplicate value", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);

        await service.createOption({
          categoryKey: "invoice-issuing-office",
          value: "FIRST_VALUE",
          label: "First Option",
        });

        const second = await service.createOption({
          categoryKey: "invoice-issuing-office",
          value: "SECOND_VALUE",
          label: "Second Option",
        });

        await expect(
          service.updateOption(second.id, {
            value: "FIRST_VALUE",
          }),
        ).rejects.toThrow(/already exists/i);
      });
    });

    runCase("update option can change active status", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);
        const created = await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "Toggle Office",
          isActive: true,
        });

        const deactivated = await service.updateOption(created.id, {
          isActive: false,
        });

        expect(deactivated.isActive).toBe(false);

        const reactivated = await service.updateOption(created.id, {
          isActive: true,
        });

        expect(reactivated.isActive).toBe(true);
      });
    });

    runCase("update option can change sort order", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);
        const created = await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "Sortable Office",
        });

        const updated = await service.updateOption(created.id, {
          sortOrder: 999,
        });

        expect(updated.sortOrder).toBe(999);
      });
    });
  });

  describe("Value Validation", () => {
    runCase("create option validates allowlist before checking duplicates", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);

        // invoice-status has allowlist, and "Pending" already exists as a default
        // The allowlist validation should pass, but duplicate check should fail
        await expect(
          service.createOption({
            categoryKey: "invoice-status",
            value: "PENDING",
            label: "Pending Invoice",
          }),
        ).rejects.toThrow(/already exists/i);
      });
    });

    runCase("create option rejects value not in allowlist", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);

        await expect(
          service.createOption({
            categoryKey: "invoice-status",
            value: "INVALID_VALUE",
            label: "Invalid Value",
          }),
        ).rejects.toThrow(/not allowed for category/i);
      });
    });

    runCase("create option without allowlist accepts any value", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);

        // invoice-issuing-office has no allowlist
        const created = await service.createOption({
          categoryKey: "invoice-issuing-office",
          value: "CUSTOM_OFFICE",
          label: "Custom Office",
        });

        expect(created.value).toBe("CUSTOM_OFFICE");
      });
    });
  });

  describe("Prisma Mode Fallback", () => {
    runCase("prisma missing client falls back outside production", async () => {
      await withEnv(
        {
          DATA_SOURCE: "prisma",
          NODE_ENV: "test",
        },
        async () => {
          const service = new MasterDataService({} as PrismaService);
          const options = await service.listOptions("invoice-status", true);

          expect(options.length >= 4).toBe(true);
          expect(options.some((option) => option.value === "Pending")).toBe(true);
        },
      );
    });

    runCase("prisma missing table fails fast in production", async () => {
      await withEnv(
        {
          DATA_SOURCE: "prisma",
          NODE_ENV: "production",
        },
        async () => {
          const prisma = {
            masterDataOption: {
              findUnique: async () => {
                throw new Prisma.PrismaClientKnownRequestError("missing table", {
                  code: "P2021",
                  clientVersion: "unit-test",
                  meta: {
                    table: "public.MasterDataOption",
                  },
                });
              },
              upsert: async () => {
                throw new Prisma.PrismaClientKnownRequestError("missing table", {
                  code: "P2021",
                  clientVersion: "unit-test",
                  meta: {
                    table: "public.MasterDataOption",
                  },
                });
              },
            },
          } as unknown as PrismaService;

          const service = new MasterDataService(prisma);

          await expect(
            service.listOptions("invoice-status"),
          ).rejects.toThrow(/MasterDataOption/i);
        },
      );
    });

    runCase("prisma create option fails when table missing in production", async () => {
      await withEnv(
        {
          DATA_SOURCE: "prisma",
          NODE_ENV: "production",
        },
        async () => {
          const prisma = {
            masterDataOption: {
              findUnique: async () => {
                throw new Prisma.PrismaClientKnownRequestError("missing table", {
                  code: "P2021",
                  clientVersion: "unit-test",
                  meta: {
                    table: "public.MasterDataOption",
                  },
                });
              },
            },
          } as unknown as PrismaService;

          const service = new MasterDataService(prisma);

          await expect(
            service.createOption({
              categoryKey: "invoice-issuing-office",
              label: "Test Option",
            }),
          ).rejects.toThrow(/MasterDataOption/i);
        },
      );
    });
  });

  describe("Edge Cases", () => {
    runCase("label normalization trims whitespace", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);
        const created = await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "   Trimmed Label   ",
        });

        expect(created.label).toBe("Trimmed Label");
      });
    });

    runCase("value generation handles special characters", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);
        const created = await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "Office with Special!@#$%^&*() Characters",
        });

        expect(created.value).toBe("OFFICE_WITH_SPECIAL_CHARACTERS");
      });
    });

    runCase("value generation handles empty after normalization", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);
        const created = await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "!@#$%",
        });

        expect(created.value).toBe("OPTION");
      });
    });

    runCase("sort order auto-increments", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);

        const first = await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "First Office",
        });

        const second = await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "Second Office",
        });

        expect(second.sortOrder).toBeGreaterThan(first.sortOrder);
      });
    });

    runCase("options sorted by sortOrder then label", async () => {
      await withEnv({ DATA_SOURCE: "memory" }, async () => {
        const service = new MasterDataService({} as PrismaService);

        await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "Zebra Office",
          sortOrder: 1,
        });

        await service.createOption({
          categoryKey: "invoice-issuing-office",
          label: "Alpha Office",
          sortOrder: 1,
        });

        const options = await service.listOptions("invoice-issuing-office");
        const alphaIndex = options.findIndex((opt) => opt.label === "Alpha Office");
        const zebraIndex = options.findIndex((opt) => opt.label === "Zebra Office");

        expect(alphaIndex).toBeLessThan(zebraIndex);
      });
    });
  });
});
