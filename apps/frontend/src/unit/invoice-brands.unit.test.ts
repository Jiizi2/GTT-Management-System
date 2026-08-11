import assert from "node:assert/strict";
import { describe } from "vitest";
import {
  buildInvoiceBrandTag,
  parseInvoiceBrandTag,
  stripInvoiceMetadataTags,
} from "../shared/invoice-notes-tags.js";
import {
  DEFAULT_INVOICE_BRAND,
  INVOICE_BRANDS,
  resolveInvoiceBrand,
} from "../shared/invoice-brands.js";
import { runCase } from "../test/run-case.js";

describe("invoice brands", () => {
  runCase("round-trips the brand tag through build/parse", () => {
    assert.equal(buildInvoiceBrandTag("yahya"), "[Brand:yahya]");
    assert.equal(buildInvoiceBrandTag(" GHANIYA "), "[Brand:ghaniya]");
    assert.equal(parseInvoiceBrandTag("Note\n[Brand:yahya]\n[Rates:USD=1,SAR=1]"), "yahya");
  });

  runCase("returns null when no brand tag is present (implicit default)", () => {
    assert.equal(parseInvoiceBrandTag("Just a note"), null);
    assert.equal(parseInvoiceBrandTag(undefined), null);
  });

  runCase("strips the brand tag so it never leaks onto the printed invoice", () => {
    const notes = "Terima kasih\n[Brand:yahya]\n[BankAccount:yahya_bca]\n[Rates:USD=15845,SAR=4225]";
    assert.equal(stripInvoiceMetadataTags(notes), "Terima kasih");
  });

  runCase("resolves a brand id to its profile and falls back to the default", () => {
    assert.equal(resolveInvoiceBrand("yahya").id, "yahya");
    assert.equal(resolveInvoiceBrand("yahya").brandName, INVOICE_BRANDS.yahya.brandName);
    assert.equal(resolveInvoiceBrand(undefined).id, DEFAULT_INVOICE_BRAND);
    assert.equal(resolveInvoiceBrand("unknown-brand").id, DEFAULT_INVOICE_BRAND);
  });

  runCase("keeps Ghaniya on the classic template and Yahya on the sultan layout", () => {
    // Ghaniya must never switch away from the original gold template.
    assert.equal(resolveInvoiceBrand("ghaniya").layout, "classic");
    assert.equal(resolveInvoiceBrand(undefined).layout, "classic");
    assert.equal(resolveInvoiceBrand("yahya").layout, "sultan");
  });
});
