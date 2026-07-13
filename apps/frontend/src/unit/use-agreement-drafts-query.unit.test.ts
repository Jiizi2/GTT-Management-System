import assert from "node:assert/strict";
import { describe } from "vitest";
import { fetchAgreementDraftsFromBackend } from "../hooks/use-agreement-drafts-query.js";
import { runCase } from "../test/run-case.js";
import { withMockFetch } from "../test/with-mock-fetch.js";
import { withApiBaseOverride } from "../test/with-api-base-override.js";

async function testFetchAgreementDraftsRejectsInvalidBackendShape(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () => new Response(JSON.stringify([{ hotelName: "Missing Id" }]), { status: 200 }),
      async () => {
        await assert.rejects(
          () => fetchAgreementDraftsFromBackend(),
          /Draft fetch failed: invalid backend response/,
        );
      },
    );
  });
}

describe("use-agreement-drafts-query", () => {
  runCase(
    "fetch agreement drafts rejects invalid backend shape",
    testFetchAgreementDraftsRejectsInvalidBackendShape,
  );
});
