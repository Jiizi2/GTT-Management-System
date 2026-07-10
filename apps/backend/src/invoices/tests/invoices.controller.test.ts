import { describe, expect, it, vi } from "vitest";
import { InvoicesController } from "../invoices.controller";
import { InvoicesService } from "../invoices.service";
import { InvoiceStatus } from "@prisma/client";
import { CreateInvoiceDto } from "../dto/create-invoice.dto";
import { UpdateInvoiceDto } from "../dto/update-invoice.dto";
import { MethodNotAllowedException } from "@nestjs/common";

describe("InvoicesController", () => {
  const mockInvoiceListItem = {
    id: "inv-1",
    invoiceNumber: "GTT/INV/2026/0001",
    clientId: "cli-1",
    clientName: "Client A",
    clientLabel: "01. Client A",
    clientInitials: "CA",
    issuedDateIso: "2026-04-12",
    dueDateIso: "2026-04-26",
    amount: 100000,
    downPaymentIdr: 0,
    status: "Pending" as const,
    monthKey: "2026-04",
    version: 1,
  };

  const mockClientListItem = {
    id: "cli-1",
    name: "Client A",
    sortOrder: 1,
    label: "01. Client A",
  };

  const mockResponse = {
    setHeader: vi.fn(),
  };

  const createMockService = () => {
    return {
      findAll: vi.fn().mockResolvedValue([mockInvoiceListItem]),
      findAllPaginated: vi.fn().mockResolvedValue({
        data: [mockInvoiceListItem],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      }),
      listClients: vi.fn().mockResolvedValue([mockClientListItem]),
      create: vi.fn().mockResolvedValue(mockInvoiceListItem),
      update: vi.fn().mockResolvedValue(mockInvoiceListItem),
      delete: vi.fn().mockResolvedValue(undefined),
      backfillLegacyItems: vi.fn().mockResolvedValue({
        processed: 10,
        success: 9,
        failed: 1,
        anomalies: [],
      }),
    } as unknown as InvoicesService;
  };

  it("should fetch all invoices without pagination", async () => {
    const service = createMockService();
    const controller = new InvoicesController(service);

    const result = await controller.findAll({}, mockResponse);

    expect(service.findAll).toHaveBeenCalled();
    expect(result).toEqual([mockInvoiceListItem]);
    expect(mockResponse.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, private");
  });

  it("should fetch all invoices with pagination", async () => {
    const service = createMockService();
    const controller = new InvoicesController(service);

    const paginationDto = { page: 1, limit: 10 };
    const result = await controller.findAll(paginationDto, mockResponse);

    expect(service.findAllPaginated).toHaveBeenCalledWith(paginationDto);
    expect(result).toEqual({
      data: [mockInvoiceListItem],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    expect(mockResponse.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, private");
  });

  it("should list all invoice clients", async () => {
    const service = createMockService();
    const controller = new InvoicesController(service);

    const result = await controller.listClients(mockResponse);

    expect(service.listClients).toHaveBeenCalled();
    expect(result).toEqual([mockClientListItem]);
    expect(mockResponse.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, private");
  });

  it("should create an invoice", async () => {
    const service = createMockService();
    const controller = new InvoicesController(service);

    const payload: CreateInvoiceDto = {
      clientName: "Client A",
      issuedDate: "2026-04-12",
      amount: 100000,
      status: InvoiceStatus.PENDING,
    };

    const result = await controller.create(payload);

    expect(service.create).toHaveBeenCalledWith(payload);
    expect(result).toEqual(mockInvoiceListItem);
  });

  it("should update an invoice", async () => {
    const service = createMockService();
    const controller = new InvoicesController(service);

    const payload: UpdateInvoiceDto = {
      amount: 200000,
      version: 1,
    };

    const result = await controller.update("inv-1", payload);

    expect(service.update).toHaveBeenCalledWith("inv-1", payload);
    expect(result).toEqual(mockInvoiceListItem);
  });

  it("should delete invoice by id", async () => {
    const service = createMockService();
    const controller = new InvoicesController(service);

    await controller.remove("inv-1");

    expect(service.delete).toHaveBeenCalledWith("inv-1");
  });

  it("should trigger backfill for legacy items", async () => {
    const service = createMockService();
    const controller = new InvoicesController(service);

    const result = await controller.backfill();

    expect(service.backfillLegacyItems).toHaveBeenCalled();
    expect(result).toEqual({
      processed: 10,
      success: 9,
      failed: 1,
      anomalies: [],
    });
  });
});
