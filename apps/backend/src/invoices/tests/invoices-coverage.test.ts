import { describe, expect, it, vi } from "vitest";
import { InvoiceValidator } from "../domain/invoice-validator";
import { InvoiceNumberGenerator } from "../domain/invoice-number-generator";
import { InvoiceCommandService } from "../application/invoice-command.service";
import { InvoiceQueryService } from "../application/invoice-query.service";
import { Prisma } from "@prisma/client";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { InvoiceMemoryStore } from "../application/invoice-memory-store";
import { PrismaInvoiceRepository } from "../../infrastructure/repositories/prisma/prisma-invoice.repository";

describe("Invoices Service Code Coverage Expansion", () => {
  describe("InvoiceValidator Edge Cases", () => {
    const validator = new InvoiceValidator();

    it("should throw BadRequestException if downPaymentIdr is negative", () => {
      expect(() => validator.validateAmounts({ downPaymentIdr: -10 })).toThrow(
        "Nominal downpayment tidak boleh kurang dari 0."
      );
    });

    it("should throw BadRequestException if amount is negative", () => {
      expect(() => validator.validateAmounts({ amount: -500 })).toThrow(
        "Nominal amount invoice tidak boleh kurang dari 0."
      );
    });

    it("should throw BadRequestException if items is not an array", () => {
      expect(() => validator.validateItems("not-an-array")).toThrow(
        "Format items invoice tidak valid."
      );
    });

    it("should throw BadRequestException if an item is not an object", () => {
      expect(() => validator.validateItems([null])).toThrow(
        "Item invoice tidak valid."
      );
    });

    it("should throw BadRequestException if item description is empty", () => {
      expect(() => validator.validateItems([{ description: "  " }])).toThrow(
        "Uraian item invoice tidak boleh kosong."
      );
    });

    it("should throw BadRequestException if currency is invalid", () => {
      expect(() =>
        validator.validateItems([{ description: "Item 1", currency: "EUR" }])
      ).toThrow("Mata uang item 'EUR' tidak valid.");
    });

    it("should throw BadRequestException if pax is non-integer or <= 0", () => {
      expect(() =>
        validator.validateItems([
          { description: "Item 1", currency: "IDR", pax: 1.5 },
        ])
      ).toThrow("Jumlah PAX item invoice harus berupa bilangan bulat positif.");

      expect(() =>
        validator.validateItems([
          { description: "Item 1", currency: "IDR", pax: -2 },
        ])
      ).toThrow("Jumlah PAX item invoice harus berupa bilangan bulat positif.");
    });

    it("should throw BadRequestException if unitPrice is <= 0", () => {
      expect(() =>
        validator.validateItems([
          { description: "Item 1", currency: "IDR", pax: 1, unitPrice: 0 },
        ])
      ).toThrow("Harga unit item invoice harus lebih dari 0.");
    });

    it("should throw BadRequestException if payments JSON inside notes is invalid", () => {
      expect(() =>
        validator.validatePayments("[Payments:invalid-encoded-json%7F]")
      ).toThrow("Tag pembayaran dalam notes memiliki format JSON yang tidak valid.");
    });

    it("should throw BadRequestException if a payment amount in notes is negative", () => {
      const payments = encodeURIComponent(JSON.stringify([{ amount: -100 }]));
      expect(() => validator.validatePayments(`[Payments:${payments}]`)).toThrow(
        "Tag pembayaran dalam notes memiliki format JSON yang tidak valid."
      );
    });
  });

  describe("InvoiceNumberGenerator Edge Cases", () => {
    const generator = new InvoiceNumberGenerator();

    it("should return null if serial is not found in invoice number", () => {
      expect(generator.extractInvoiceSerial("GTT/INV/2026/")).toBeNull();
      expect(generator.extractInvoiceSerial("MALFORMED-NUMBER")).toBeNull();
    });

    it("should return null if serial value is invalid", () => {
      expect(generator.extractInvoiceSerial("GTT/INV/2026/ABCD")).toBeNull();
    });

    it("should resolve current year if isoDate is not valid", () => {
      const currentYear = new Date().getFullYear().toString();
      expect(generator.extractYearFromIsoDate("invalid-date")).toBe(currentYear);
    });

    it("should fallback to findMany and resolve next serial if latest serial format is malformed", async () => {
      const mockPrismaClient = {
        invoice: {
          findFirst: async () => ({ invoiceNumber: "GTT/INV/2026/MALFORMED" }),
          findMany: async () => [
            { invoiceNumber: "GTT/INV/2026/0002" },
            { invoiceNumber: "GTT/INV/2026/0005" },
          ],
        },
      };

      const result = await generator.generateNextInvoiceNumberWithPrisma("2026", mockPrismaClient as any);
      expect(result).toBe("GTT/INV/2026/0006");
    });
  });

  describe("InvoiceCommandService Retry Lock Mechanism", () => {
    const mockMemoryStore = new InvoiceMemoryStore();
    const mockValidator = new InvoiceValidator();
    const mockGenerator = new InvoiceNumberGenerator();

    it("should retry and succeed if transactions fail up to 2 times with P2002/P2034", async () => {
      let attempts = 0;
      const mockPrisma = {
        invoiceClient: {
          findFirst: async () => null,
          create: async () => ({ id: "cli-1", groupId: null }),
        },
        $executeRaw: async () => 1,
        $transaction: async (cb: any) => {
          attempts += 1;
          if (attempts < 3) {
            throw new Prisma.PrismaClientKnownRequestError("Transaction Lock", {
              code: "P2034",
              clientVersion: "mock",
            });
          }
          return cb({
            invoiceClient: {
              findFirst: async () => null,
              create: async () => ({ id: "cli-1", groupId: null }),
              aggregate: async () => ({
                _max: {
                  sortOrder: 0,
                },
              }),
            },
          });
        },
      } as any;

      const repository = new PrismaInvoiceRepository(mockPrisma);
      const result = await (repository as any).createInvoiceClientWithPrisma("New Client");
      expect(result.id).toBe("cli-1");
      expect(attempts).toBe(3);
    });

    it("should throw BadRequestException if transactions fail 3 times (max attempts exhausted)", async () => {
      const mockPrisma = {
        $executeRaw: async () => 1,
        $transaction: async () => {
          throw new Prisma.PrismaClientKnownRequestError("Transaction Lock", {
            code: "P2034",
            clientVersion: "mock",
          });
        },
      } as any;

      const repository = new PrismaInvoiceRepository(mockPrisma);
      await expect(
        (repository as any).createInvoiceClientWithPrisma("New Client")
      ).rejects.toThrow(
        new BadRequestException("Transaction conflict resolving invoice client. Please try again.")
      );
    });
  });

  describe("InvoiceQueryService & Repository Error Mappings", () => {
    it("should allow duplicate sort orders when listing clients", async () => {
      const mockPrisma = {
        invoiceClient: {
          findMany: async () => [
            { id: "cli-1", name: "Client A", sortOrder: 1 },
            { id: "cli-2", name: "Client B", sortOrder: 1 },
          ],
        },
      } as any;

      const repository = new PrismaInvoiceRepository(mockPrisma);
      const queryService = new InvoiceQueryService(repository);

      const result = await queryService.listClients();
      expect(result).toHaveLength(2);
      expect(result[0].label).toBe("01. Client A");
      expect(result[1].label).toBe("01. Client B");
    });
  });
});
