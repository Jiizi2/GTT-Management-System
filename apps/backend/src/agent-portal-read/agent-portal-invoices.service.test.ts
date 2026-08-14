import { InvoiceStatus } from "@prisma/client";
import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { InvoiceMemoryStore } from "../invoices/application/invoice-memory-store";
import { GroupMemoryStore } from "../infrastructure/repositories/memory/group-memory-store";
import type { PrismaService } from "../prisma/prisma.service";
import type { MemoryInvoice } from "../invoices/invoices-helpers";
import { AgentPortalInvoicesService } from "./agent-portal-invoices.service";

const config = (source: "memory" | "prisma") => ({
  get: vi.fn((key: string) => key === "DATA_SOURCE" ? source : undefined),
}) as unknown as ConfigService;

function invoice(id: string, agentId: string, overrides: Partial<MemoryInvoice> = {}): MemoryInvoice {
  return {
    id,
    invoiceNumber: `GTT/INV/2026/${id}`,
    clientId: `client-${id}`,
    agentId,
    issuedDateIso: "2026-07-01",
    dueDateIso: "2026-07-10",
    amount: 99_000_000,
    downPaymentIdr: 50_000_000,
    discountIdr: 0,
    status: InvoiceStatus.PENDING,
    notes: "PRIVATE INVOICE NOTE",
    description: "PRIVATE DESCRIPTION",
    recipientName: "PRIVATE RECIPIENT",
    items: [{ description: "PRIVATE ITEM", pax: 1, currency: "IDR", unitPrice: 1, totalPrice: 1, totalPriceIdr: 1 }],
    version: 7,
    ...overrides,
  };
}

describe("AgentPortalInvoicesService", () => {
  it("returns only tenant invoices through an allowlisted, side-effect-free projection", async () => {
    const store = new InvoiceMemoryStore();
    const owned = invoice("0001", "agent-a");
    store.invoices.push(owned, invoice("0002", "agent-b"));
    const service = new AgentPortalInvoicesService(config("memory"), {} as PrismaService, store, new GroupMemoryStore());

    const before = structuredClone(store.invoices);
    const result = await service.list("agent-a", { page: 1, pageSize: 20, sortBy: "dueDate", sortDirection: "desc" });

    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual({
      id: "0001",
      invoiceNumber: "GTT/INV/2026/0001",
      status: InvoiceStatus.PENDING,
      issuedDate: "2026-07-01T00:00:00.000Z",
      dueDate: "2026-07-10T00:00:00.000Z",
      group: null,
    });
    expect(store.invoices).toEqual(before);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|amount|clientId|agentId|version|recipient/i);
    expect(Object.keys(result.items[0] ?? {})).not.toContain("items");
  });

  it("makes foreign and absent invoice detail indistinguishable", async () => {
    const store = new InvoiceMemoryStore();
    store.invoices.push(invoice("foreign", "agent-b"));
    const service = new AgentPortalInvoicesService(config("memory"), {} as PrismaService, store, new GroupMemoryStore());
    const capture = async (id: string) => service.detail("agent-a", id).catch((error) => ({ status: error.status, message: error.message }));

    expect(await capture("foreign")).toEqual(await capture("missing"));
  });

  it("uses direct and linked-group tenant predicates without invoking a write", async () => {
    const prisma = {
      invoice: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
    };
    const service = new AgentPortalInvoicesService(
      config("prisma"), prisma as unknown as PrismaService, new InvoiceMemoryStore(), new GroupMemoryStore(),
    );

    await service.list("agent-a", { page: 1, pageSize: 20, sortBy: "dueDate", sortDirection: "desc" });

    const expectedWhere = expect.objectContaining({
      agentId: "agent-a",
      OR: [{ groupId: null }, { group: { agentId: "agent-a" } }],
    });
    expect(prisma.invoice.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(prisma.invoice.updateMany).not.toHaveBeenCalled();
  });
});
