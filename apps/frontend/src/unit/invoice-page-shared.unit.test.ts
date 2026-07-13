import assert from "node:assert/strict";
import { describe } from "vitest";
import {
  isMasterDataClientOptionId,
  mergeInvoiceClientsWithMasterData,
  resolveInvoiceDownPaymentIdr,
  resolveInvoiceOutstandingBalanceLabel,
  resolveBankAccountLabel,
  parseNumberInput,
  resolveExchangeRatesFromRow,
} from "../pages/invoice/helpers/invoice-page-shared.js";
import { runCase } from "../test/run-case.js";

describe("invoice-page-shared", () => {
  runCase("merges master data invoice clients without duplicating existing backend clients", () => {
    const mergedClients = mergeInvoiceClientsWithMasterData(
      [
        {
          id: "client-1",
          name: "Yassir",
          sortOrder: 1,
          label: "01. Yassir",
          groupCode: "9017000001",
          groupName: "Dummy Trip Lengkap",
        },
      ],
      [
        {
          value: "YASSIR",
          label: " Yassir ",
          sortOrder: 1,
          isActive: true,
        },
        {
          value: "UMRAH_CORPORATE",
          label: "Umrah Corporate",
          sortOrder: 2,
          isActive: true,
        },
        {
          value: "VIP_CLIENT",
          label: "VIP Client",
          sortOrder: 3,
          isActive: false,
        },
      ],
    );

    assert.equal(mergedClients.length, 2);
    assert.equal(mergedClients[0].id, "client-1");
    assert.equal(mergedClients[1].name, "Umrah Corporate");
    assert.equal(isMasterDataClientOptionId(mergedClients[1].id), true);
    assert.equal(mergedClients[1].sortOrder, 2);
  });

  runCase("recognizes only synthetic master data invoice client ids", () => {
    assert.equal(isMasterDataClientOptionId("__invoice_client_master_data__:jsa"), true);
    assert.equal(isMasterDataClientOptionId("client-regular"), false);
  });

  runCase("resolves invoice down payment fallback for legacy paid invoices", () => {
    assert.equal(
      resolveInvoiceDownPaymentIdr({
        amount: 76_860_000,
        status: "Paid",
        downPaymentIdr: 0,
      }),
      76_860_000,
    );

    assert.equal(
      resolveInvoiceDownPaymentIdr({
        amount: 76_860_000,
        status: "Pending",
        downPaymentIdr: 50_000_000,
      }),
      50_000_000,
    );
  });

  runCase("resolves outstanding balance label from down payment presence", () => {
    assert.equal(resolveInvoiceOutstandingBalanceLabel(0), "Tagihan");
    assert.equal(resolveInvoiceOutstandingBalanceLabel(1), "Sisa Tagihan");
    assert.equal(resolveInvoiceOutstandingBalanceLabel(1_000_000, 0), "Lunas");
  });

  runCase("resolves bank account label correctly", () => {
    // 1. Resolve using default options
    assert.equal(
      resolveBankAccountLabel("bca"),
      "BCA (IDR) - 035 123 4455",
    );
    assert.equal(
      resolveBankAccountLabel("unknown_bank"),
      "unknown_bank",
    );

    // 2. Resolve using custom options
    const customOptions = [
      { value: "mandiri_custom", label: "Bank Mandiri - 9999" },
    ];
    assert.equal(
      resolveBankAccountLabel("mandiri_custom", customOptions),
      "Bank Mandiri - 9999",
    );
  });

  runCase("parses bank account from invoice notes", () => {
    const extractBankKey = (notes?: string) => {
      const notesRaw = notes ?? "";
      const bankMatch = notesRaw.match(/\[BankAccount:([^\]]+)\]/);
      return bankMatch && bankMatch[1] ? bankMatch[1].trim() : "bsi";
    };

    assert.equal(extractBankKey("Some user notes here\n[BankAccount:bca]"), "bca");
    assert.equal(extractBankKey("No bank account info here"), "bsi"); // fallback
  });

  runCase("parses Indonesian localized numbers in parseNumberInput", () => {
    assert.equal(parseNumberInput("25000"), 25000);
    assert.equal(parseNumberInput("25.000"), 25000);
    assert.equal(parseNumberInput("40.000"), 40000);
    assert.equal(parseNumberInput("2.500.000"), 2500000);
    assert.equal(parseNumberInput("2.5"), 25);
    assert.equal(parseNumberInput("2,5"), 2.5);
    assert.equal(parseNumberInput("15.800,50"), 15800.5);
  });

  runCase("resolves exchange rates from notes and respects explicit 0 values and alternative formats", () => {
    // 1. Tag [Rates:USD=X,SAR=Y]
    const res1 = resolveExchangeRatesFromRow({ notes: "[Rates:USD=16000,SAR=4300]" });
    assert.equal(res1.usdToIdr, 16000);
    assert.equal(res1.sarToIdr, 4300);

    // 2. Tag [ExchangeRate:USD=X,SAR=Y]
    const res2 = resolveExchangeRatesFromRow({ notes: "[ExchangeRate:USD=15500,SAR=4100]" });
    assert.equal(res2.usdToIdr, 15500);
    assert.equal(res2.sarToIdr, 4100);

    // 3. Explicit 0 values
    const res3 = resolveExchangeRatesFromRow({ notes: "[Rates:USD=0,SAR=0]" });
    assert.equal(res3.usdToIdr, 0);
    assert.equal(res3.sarToIdr, 0);
  });
});
