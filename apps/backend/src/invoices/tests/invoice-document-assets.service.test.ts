import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { InvoiceDocumentAssetsService } from "../invoice-document-assets.service";
import { InvoicesService } from "../invoices.service";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function createActor() {
  return {
    id: "usr-1",
    name: "Admin",
    username: "admin",
    email: "admin@example.com",
    accessTier: "admin" as const,
    exp: 1_900_000_000,
    rememberSession: false,
    tokenVersion: 0,
  };
}

describe("InvoiceDocumentAssetsService", () => {
  it("reads a private PNG for an existing non-cancelled invoice", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gtt-invoice-assets-"));
    temporaryDirectories.push(directory);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from("private-test-payload"),
    ]);
    await writeFile(path.join(directory, "stamp.png"), png);
    const invoicesService = {
      findAll: vi.fn().mockResolvedValue([
        { id: "inv-1", invoiceNumber: "GTT/INV/2026/1", status: "Pending" },
      ]),
    } as unknown as InvoicesService;
    const config = { get: vi.fn().mockReturnValue(directory) } as unknown as ConfigService;
    const service = new InvoiceDocumentAssetsService(invoicesService, config);

    await expect(service.readForInvoice({ invoiceId: "inv-1", kind: "stamp", actor: createActor() }))
      .resolves.toEqual(png);
  });

  it("does not expose assets for missing or cancelled invoices", async () => {
    const config = { get: vi.fn().mockReturnValue("C:\\private") } as unknown as ConfigService;
    const missingService = new InvoiceDocumentAssetsService(
      { findAll: vi.fn().mockResolvedValue([]) } as unknown as InvoicesService,
      config,
    );
    await expect(missingService.readForInvoice({ invoiceId: "missing", kind: "stamp", actor: createActor() }))
      .rejects.toThrow(/not found/i);

    const cancelledService = new InvoiceDocumentAssetsService(
      { findAll: vi.fn().mockResolvedValue([{ id: "inv-1", status: "Cancelled" }]) } as unknown as InvoicesService,
      config,
    );
    await expect(cancelledService.readForInvoice({ invoiceId: "inv-1", kind: "stamp", actor: createActor() }))
      .rejects.toThrow(/cancelled/i);
  });

  it("rejects invalid PNG content", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "gtt-invoice-assets-"));
    temporaryDirectories.push(directory);
    await writeFile(path.join(directory, "signature.png"), "not-a-png");
    const service = new InvoiceDocumentAssetsService(
      { findAll: vi.fn().mockResolvedValue([{ id: "inv-1", invoiceNumber: "INV-1", status: "Paid" }]) } as unknown as InvoicesService,
      { get: vi.fn().mockReturnValue(directory) } as unknown as ConfigService,
    );

    await expect(service.readForInvoice({ invoiceId: "inv-1", kind: "signature", actor: createActor() }))
      .rejects.toThrow(/unavailable or invalid/i);
  });
});
