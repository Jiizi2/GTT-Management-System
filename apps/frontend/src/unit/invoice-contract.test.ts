import assert from "node:assert/strict";
import { describe } from "vitest";
import { runCase } from "../test/run-case.js";
import {
  buildInvoicePayload,
  deriveInvoiceState,
  type InvoiceDraftItem,
} from "../pages/invoice/helpers/invoice-page-shared.js";

describe("invoice payload contract alignment", () => {
  const mockClients = [
    {
      id: "client-123",
      name: "Acme Corp",
      sortOrder: 1,
      label: "01. Acme Corp",
    },
  ];

  const defaultValues = {
    selectedClientId: "client-123",
    manualClientName: "",
    selectedGroupCode: "GRP-XYZ",
    issueDateIso: "2026-07-01",
    dueDateIso: "2026-07-15",
    recipientName: "John Doe",
    notes: "Main booking info",
    bankAccount: "bca",
    issuingOffice: "Jakarta",
    address: "Sudirman Street No. 10",
    payments: [],
    items: [
      {
        id: "item-1",
        description: "Umrah Tour Package",
        pax: 2,
        currency: "USD",
        unitPrice: 1500,
      },
    ] as InvoiceDraftItem[],
    invoiceStatus: "Pending",
    version: 3,
  };

  runCase("buildInvoicePayload generates compatible UpdateInvoiceDto fields including version", () => {
    const usdToIdr = 16000;
    const sarToIdr = 4300;

    const derived = deriveInvoiceState({
      items: defaultValues.items,
      usdToIdr,
      sarToIdr,
      payments: defaultValues.payments,
      keepValasCurrency: "IDR",
    });

    const payload = buildInvoicePayload({
      values: defaultValues,
      usdToIdr,
      sarToIdr,
      keepValasCurrency: "IDR",
      derived,
      clients: mockClients,
    });

    // Contract: Mandatory version presence for update
    assert.equal(payload.version, 3);
    assert.equal(typeof payload.version, "number");

    // Contract: Client mappings
    assert.equal(payload.clientId, "client-123");
    assert.equal(payload.clientName, undefined);
    assert.equal(payload.groupCode, "GRP-XYZ");

    // Contract: Dates
    assert.equal(payload.issuedDateIso, "2026-07-01");
    assert.equal(payload.dueDateIso, "2026-07-15");

    // Contract: Amounts
    assert.equal(payload.amount, 2 * 1500 * 16000); // 48,000,000 IDR
    assert.equal(payload.downPaymentIdr, 0);

    // Contract: Items array checks
    assert.equal(payload.items.length, 1);
    const item = payload.items[0];
    assert.equal(item.description, "Umrah Tour Package");
    assert.equal(item.pax, 2);
    assert.equal(item.currency, "USD");
    assert.equal(item.unitPrice, 1500);
    assert.equal(item.totalPrice, 3000);
    assert.equal(item.totalPriceIdr, 48000000);

    // Assert validation constraints matching backend @Min(1) / @IsPositive()
    assert.ok(item.pax >= 1);
    assert.ok(Number.isInteger(item.pax));
    assert.ok(item.unitPrice > 0);
  });

  runCase("buildInvoicePayload preserves cleared address and serializes it as empty string tag", () => {
    const usdToIdr = 16000;
    const sarToIdr = 4300;

    const valuesWithEmptyAddress = {
      ...defaultValues,
      address: "",
    };

    const derived = deriveInvoiceState({
      items: valuesWithEmptyAddress.items,
      usdToIdr,
      sarToIdr,
      payments: valuesWithEmptyAddress.payments,
      keepValasCurrency: "IDR",
    });

    const payload = buildInvoicePayload({
      values: valuesWithEmptyAddress,
      usdToIdr,
      sarToIdr,
      keepValasCurrency: "IDR",
      derived,
      clients: mockClients,
    });

    assert.ok(payload.notes.includes("[Address:]"));
    const match = payload.notes.match(/\[Address:([^\]]*)\]/);
    assert.ok(match);
    assert.equal(decodeURIComponent(match[1]), "");
  });

  runCase("exportInvoicePdf generates a clean two-line layout for payments", async () => {
    let capturedHtml = "";
    
    const mockIframe = {
      style: {},
      contentWindow: {
        document: {
          open: () => {},
          write: (html: string) => {
            capturedHtml = html;
          },
          close: () => {},
        },
      },
    };

    globalThis.window = {
      document: {
        createElement: (tag: string) => {
          if (tag === "iframe") return mockIframe;
          return {};
        },
        body: {
          appendChild: () => {},
        },
      },
      location: {
        origin: "http://localhost:3000",
      },
      setTimeout: (fn: () => void) => fn(),
    } as any;

    const mockPayload = {
      invoiceNumber: "GTT/INV/2026/0001",
      issueDateIso: "2026-07-01",
      dueDateIso: "2026-07-15",
      statusLabel: "Belum Lunas",
      issuingOffice: "Jakarta Office",
      clientName: "Test Client",
      clientCode: "TC",
      address: "Test Address",
      notes: "Test Notes",
      bankAccountLabel: "bca",
      usdToIdr: 16000,
      sarToIdr: 4300,
      currency: "IDR" as const,
      subtotal: 10000000,
      tax: 0,
      totalPayable: 10000000,
      downPayment: 5000000,
      remainingBalance: 5000000,
      items: [
        {
          description: "Test Item",
          pax: 1,
          currency: "IDR" as const,
          unitPrice: 10000000,
          totalPrice: 10000000,
          totalPriceIdr: 10000000,
        },
      ],
      payments: [
        { amount: 1000000, dateIso: "2026-07-02" },
        { amount: 1000000, dateIso: "2026-07-03" },
        { amount: 1000000, dateIso: "2026-07-04" },
        { amount: 1000000, dateIso: "2026-07-05" },
        { amount: 1000000, dateIso: "2026-07-06" },
      ],
    };

    const { exportInvoicePdf } = await import("../pages/invoice-export.js");
    await exportInvoicePdf(mockPayload);

    assert.ok(capturedHtml.includes("Pembayaran #1"));
    assert.ok(capturedHtml.includes("Pembayaran #5"));
    assert.ok(capturedHtml.includes("02 Jul 2026"));
    assert.ok(capturedHtml.includes("06 Jul 2026"));
    
    delete (globalThis as any).window;
  });
});
