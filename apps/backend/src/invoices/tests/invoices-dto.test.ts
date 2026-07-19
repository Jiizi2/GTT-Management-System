import { describe, expect, it } from "vitest";
import { validateDto } from "./dto-validation.helper";
import { CreateInvoiceDto } from "../dto/create-invoice.dto";
import { UpdateInvoiceDto } from "../dto/update-invoice.dto";
import { PaginationDto } from "../dto/pagination.dto";
import { InvoiceStatus } from "@prisma/client";

describe("DTO Validation", () => {
  describe("CreateInvoiceDto", () => {
    it("should pass validation with a valid payload", async () => {
      const payload = {
        agentId: "agent_gtt_direct",
        clientName: "Client A",
        issuedDate: "2026-04-12",
        amount: 100000,
        status: InvoiceStatus.PENDING,
        items: [
          {
            description: "Item 1",
            pax: 2,
            currency: "IDR",
            unitPrice: 50000,
            totalPrice: 100000,
            totalPriceIdr: 100000,
          },
        ],
      };

      const errors = await validateDto(CreateInvoiceDto, payload);
      expect(errors.length).toBe(0);
    });

    it("should reject a negative amount", async () => {
      const payload = {
        clientName: "Client A",
        issuedDate: "2026-04-12",
        amount: -500,
      };

      const errors = await validateDto(CreateInvoiceDto, payload);
      expect(errors.length).toBeGreaterThan(0);
      const amountError = errors.find((e) => e.property === "amount");
      expect(amountError).toBeDefined();
    });

    it("should reject a negative downPaymentIdr", async () => {
      const payload = {
        clientName: "Client A",
        issuedDate: "2026-04-12",
        amount: 100000,
        downPaymentIdr: -10,
      };

      const errors = await validateDto(CreateInvoiceDto, payload);
      expect(errors.length).toBeGreaterThan(0);
      const dpError = errors.find((e) => e.property === "downPaymentIdr");
      expect(dpError).toBeDefined();
    });

    it("should reject non-date strings for issuedDate", async () => {
      const payload = {
        clientName: "Client A",
        issuedDate: "not-a-date",
        amount: 100000,
      };

      const errors = await validateDto(CreateInvoiceDto, payload);
      expect(errors.length).toBeGreaterThan(0);
      const dateError = errors.find((e) => e.property === "issuedDate");
      expect(dateError).toBeDefined();
    });

    it("should reject non-date strings for dueDate", async () => {
      const payload = {
        clientName: "Client A",
        issuedDate: "2026-04-12",
        dueDate: "not-a-date",
        amount: 100000,
      };

      const errors = await validateDto(CreateInvoiceDto, payload);
      expect(errors.length).toBeGreaterThan(0);
      const dateError = errors.find((e) => e.property === "dueDate");
      expect(dateError).toBeDefined();
    });

    it("should reject invalid status enums", async () => {
      const payload = {
        clientName: "Client A",
        issuedDate: "2026-04-12",
        amount: 100000,
        status: "UNKNOWN_STATUS",
      };

      const errors = await validateDto(CreateInvoiceDto, payload);
      expect(errors.length).toBeGreaterThan(0);
      const statusError = errors.find((e) => e.property === "status");
      expect(statusError).toBeDefined();
    });

    it("should validate nested items constraints", async () => {
      const payload = {
        clientName: "Client A",
        issuedDate: "2026-04-12",
        amount: 100000,
        items: [
          {
            description: "",
            pax: 0,
            currency: "USD",
            unitPrice: -50,
            totalPrice: 0,
            totalPriceIdr: 0,
          },
        ],
      };

      const errors = await validateDto(CreateInvoiceDto, payload);
      expect(errors.length).toBeGreaterThan(0);
      const itemsError = errors.find((e) => e.property === "items");
      expect(itemsError).toBeDefined();
    });
  });

  describe("UpdateInvoiceDto", () => {
    it("should pass validation with a valid update payload", async () => {
      const payload = {
        amount: 250000,
        version: 1,
      };

      const errors = await validateDto(UpdateInvoiceDto, payload);
      expect(errors.length).toBe(0);
    });

    it("should fail validation if version is missing", async () => {
      const payload = {
        amount: 250000,
      };

      const errors = await validateDto(UpdateInvoiceDto, payload);
      expect(errors.length).toBeGreaterThan(0);
      const versionError = errors.find((e) => e.property === "version");
      expect(versionError).toBeDefined();
    });
  });

  describe("PaginationDto", () => {
    it("should pass validation with valid page and limit values", async () => {
      const payload = {
        page: "2",
        limit: "15",
      };

      const errors = await validateDto(PaginationDto, payload);
      expect(errors.length).toBe(0);
    });

    it("should reject a page value less than 1", async () => {
      const payload = {
        page: 0,
        limit: 10,
      };

      const errors = await validateDto(PaginationDto, payload);
      expect(errors.length).toBeGreaterThan(0);
      const pageError = errors.find((e) => e.property === "page");
      expect(pageError).toBeDefined();
    });

    it("should reject a limit value greater than 100", async () => {
      const payload = {
        page: 1,
        limit: 105,
      };

      const errors = await validateDto(PaginationDto, payload);
      expect(errors.length).toBeGreaterThan(0);
      const limitError = errors.find((e) => e.property === "limit");
      expect(limitError).toBeDefined();
    });
  });
});
