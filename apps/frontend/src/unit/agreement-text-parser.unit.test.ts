import assert from "node:assert/strict";
import { describe } from "vitest";
import { parseAgreementText } from "../shared/agreement-text-parser.js";
import { runCase } from "../test/run-case.js";

describe("agreement-text-parser", () => {
  runCase("keeps missing values scoped to each sample", async () => {
    const result = parseAgreementText(`Agreement Kayan Alraia Hotel
15762600997977714
Waiting For Approval

Jabal Omar Jumeirah hotel
15762600970307022

16/11/2026 - 19/11/2026`);

    assert.equal(result.items.length, 2);
    assert.deepEqual(result.items[0], {
      city: "",
      hotelName: "Kayan Alraia Hotel",
      agreementNumber: "15762600997977714",
      status: "Waiting for Approval",
      stayStartIso: "",
      stayEndIso: "",
    });
    assert.equal(result.items[1]?.hotelName, "Jabal Omar Jumeirah hotel");
    assert.equal(result.items[1]?.city, "");
    assert.equal(result.items[1]?.status, "");
    assert.equal(result.items[1]?.stayStartIso, "2026-11-16");
    assert.equal(result.items[1]?.stayEndIso, "2026-11-19");
    assert.ok(result.warnings.some((warning) => warning.includes("Agreement 1: periode")));
    assert.ok(result.warnings.some((warning) => warning.includes("Agreement 2: status")));
  });

  runCase("recognizes explicit cities and alternative date separators", async () => {
    const result = parseAgreementText(`Madinah View Hotel
AGR-209944
Approved
01.12.2026 to 04.12.2026`);

    assert.equal(result.items[0]?.city, "madinah");
    assert.equal(result.items[0]?.status, "Approved");
    assert.equal(result.items[0]?.stayStartIso, "2026-12-01");
  });

  runCase("reports missing values without inventing dates", async () => {
    const result = parseAgreementText("Agreement Example Hotel\n123456789");

    assert.equal(result.items[0]?.stayStartIso, "");
    assert.equal(result.items[0]?.status, "");
    assert.ok(result.warnings.some((warning) => warning.includes("periode")));
    assert.ok(result.warnings.some((warning) => warning.includes("status")));
  });

  runCase("rejects impossible calendar dates", async () => {
    const result = parseAgreementText("Example Hotel\n123456789\n31/02/2026 - 04/03/2026");

    assert.equal(result.items[0]?.stayStartIso, "");
    assert.ok(result.warnings.some((warning) => warning.includes("periode")));
  });
});
