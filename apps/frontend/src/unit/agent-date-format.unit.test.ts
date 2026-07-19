import assert from "node:assert/strict";
import { describe } from "vitest";
import { normalizeDateOnly } from "../agent/data/format.js";
import { runCase } from "../test/run-case.js";

describe("Portal Agent date normalization", () => {
  runCase("normalizes backend ISO timestamps for issued month filters", () => {
    assert.equal(normalizeDateOnly("2026-06-23T00:00:00.000Z"), "2026-06-23");
    assert.equal(normalizeDateOnly("2026-07-01"), "2026-07-01");
  });

  runCase("rejects missing or unsupported date values", () => {
    assert.equal(normalizeDateOnly(null), undefined);
    assert.equal(normalizeDateOnly(undefined), undefined);
    assert.equal(normalizeDateOnly("23-06-2026"), undefined);
  });
});
