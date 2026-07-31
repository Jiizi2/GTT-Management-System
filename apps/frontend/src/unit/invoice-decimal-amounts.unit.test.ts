import assert from "node:assert/strict";
import { describe } from "vitest";
import { clampMoney, formatMoney, roundMoney, sumMoney } from "../shared/money.js";
import {
  buildInvoiceRatesTag,
  parseInvoiceRatesTag,
  stripInvoiceMetadataTags,
} from "../shared/invoice-notes-tags.js";
import {
  calculateSubtotalInCurrency,
  deriveInvoiceState,
  formatCurrencyLabel,
  formatNumberInput,
  parseNumberInput,
  resolveExchangeRatesFromRow,
  resolveInvoiceDisplayTotals,
} from "../pages/invoice/helpers/invoice-page-shared.js";
import { runCase } from "../test/run-case.js";

describe("invoice decimal amounts", () => {
  runCase("rounds to the DECIMAL(12,2) precision of the column, not to whole units", () => {
    assert.equal(roundMoney(468.75), 468.75);
    assert.equal(roundMoney(505.2), 505.2);
    // Binary representation error must not leak into the stored value.
    assert.equal(roundMoney(1.005), 1.01);
    assert.equal(roundMoney(505.204), 505.2);
    assert.equal(clampMoney(-12.5), 0);
  });

  runCase("sums money without accumulating per-term floating point error", () => {
    // 505.20 is not exactly representable; over enough terms the sum drifts off
    // the value the DECIMAL column would hold.
    const sevenDeposits = Array<number>(7).fill(505.2);
    assert.notEqual(
      sevenDeposits.reduce((total, value) => total + value, 0),
      3536.4,
    );
    assert.equal(sumMoney(sevenDeposits), 3536.4);
    assert.equal(sumMoney([468.75, 505.2, 1.1, 2.2]), 977.25);
  });

  runCase("formats decimals for SAR/USD and omits the subunit for IDR", () => {
    assert.equal(formatMoney(468.75, "SAR", "en-US"), "SAR 468.75");
    assert.equal(formatMoney(125, "USD", "en-US"), "USD 125.00");
    assert.equal(formatMoney(1980468.75, "IDR"), "IDR 1.980.469");
    assert.equal(formatCurrencyLabel(505.2, "SAR"), "SAR 505.20");
  });

  runCase("keeps a half-typed decimal parseable so the input can reach the cents", () => {
    // The controlled input re-renders on every keystroke. If a trailing
    // separator did not survive parse -> format, the comma would be erased the
    // moment it is typed and decimals would be unreachable.
    assert.equal(parseNumberInput("468,"), 468);
    assert.equal(formatNumberInput(parseNumberInput("468,75")), "468,75");
    assert.equal(formatNumberInput(505.2), "505,2");
    // A third decimal cannot be stored, so it must not be displayed either.
    assert.equal(formatNumberInput(505.204), "505,2");
    assert.equal(formatNumberInput(1980468.75, "IDR"), "1.980.469");
  });

  runCase("round-trips a decimal exchange rate through the notes tag", () => {
    const tag = buildInvoiceRatesTag(15845.5, 4225.25);
    assert.equal(tag, "[Rates:USD=15845.5,SAR=4225.25]");
    assert.deepEqual(parseInvoiceRatesTag(tag), { usdToIdr: 15845.5, sarToIdr: 4225.25 });
    // Integer rates keep their existing on-disk shape.
    assert.equal(buildInvoiceRatesTag(15845, 4225), "[Rates:USD=15845,SAR=4225]");
    assert.deepEqual(resolveExchangeRatesFromRow({ notes: tag }), { usdToIdr: 15845.5, sarToIdr: 4225.25 });
  });

  runCase("strips a decimal rate tag so it never reaches the printed invoice", () => {
    const notes = "Transfer via BSI.\n[Rates:USD=15845.5,SAR=4225.25]\n[BankAccount:bsi]\n[NoDueDate:true]";
    assert.equal(stripInvoiceMetadataTags(notes), "Transfer via BSI.");
    assert.ok(!stripInvoiceMetadataTags(notes).includes("Rates"));
  });

  runCase("carries a 468.75 SAR unit price through the workspace derivation", () => {
    const derived = deriveInvoiceState({
      items: [{ id: "line-1", description: "Deposit", pax: 1, currency: "SAR", unitPrice: 468.75 }],
      payments: [{ amount: 468.75, dateIso: "2026-07-31" }],
      usdToIdr: 15845,
      sarToIdr: 4225,
      keepValasCurrency: "SAR",
    });

    assert.equal(derived.items[0].totalPrice, 468.75);
    assert.equal(derived.items[0].totalPriceIdr, 1980468.75);
    assert.equal(derived.paymentSummary.subtotal, 468.75);
    assert.equal(derived.paymentSummary.totalPaid, 468.75);
    assert.equal(derived.paymentSummary.remainingBalance, 0);
    // Paying the exact amount must read as Paid, not leave a rounding residue.
    assert.equal(derived.previewStatus, "Paid");
  });

  runCase("converts back to a valas total without rounding the customer up", () => {
    const subtotal = calculateSubtotalInCurrency(
      [{ id: "line-1", description: "Deposit", pax: 1, currency: "IDR", unitPrice: 1980468.75 }],
      "SAR",
      15845,
      4225,
    );
    // Math.ceil used to bill this as 469 SAR.
    assert.equal(subtotal, 468.75);
  });

  runCase("shows a stored decimal invoice in its billing currency", () => {
    const totals = resolveInvoiceDisplayTotals({
      id: "inv-1",
      invoiceNumber: "GTT/INV/2026/0001",
      clientId: "client-1",
      agentId: "agent_gtt_direct",
      agentName: "GTT Direct",
      clientName: "Yassir",
      clientLabel: "01. Yassir",
      clientInitials: "Y",
      issuedDateIso: "2026-07-01",
      dueDateIso: "2026-07-31",
      amount: 2134230,
      downPaymentIdr: 0,
      status: "Pending",
      monthKey: "2026-07",
      notes: "[KeepValasTotal:SAR]\n[Rates:USD=15845,SAR=4225]",
      items: [
        {
          description: "Deposit",
          pax: 1,
          currency: "SAR",
          unitPrice: 505.2,
          totalPrice: 505.2,
          totalPriceIdr: 2134230,
        },
      ],
    });

    assert.equal(totals.currency, "SAR");
    assert.equal(totals.subtotal, 505.2);
    assert.equal(totals.remainingBalance, 505.2);
  });
});
