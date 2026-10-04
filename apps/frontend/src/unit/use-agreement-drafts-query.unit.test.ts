import assert from "node:assert/strict";
import { describe } from "vitest";
import { fetchAgreementDraftsFromBackend, saveAgreementDraftInBackend } from "../hooks/use-agreement-drafts-query.js";
import type { HotelAgreementDraftFormState } from "../shared/app-domain.js";
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
  runCase("reads Muassasah and uses Assigned for linked drafts with remaining pax", async () => {
    await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
      await withMockFetch(async () => new Response(JSON.stringify([{ id: "draft-1", muassasahId: "muassasah-1", muassasahName: "Master Muassasah", assignmentStatus: "ASSIGNED", remainingPax: 5, assignedGroups: [{ groupCode: "GROUP-1", pax: 5 }] }]), { status: 200 }), async () => {
        const [draft] = await fetchAgreementDraftsFromBackend();
        assert.equal(draft.muassasahId, "muassasah-1");
        assert.equal(draft.muassasahName, "Master Muassasah");
        assert.equal(draft.assignmentStatus, "Assigned");
      });
    });
  });
  runCase("saves, clears and preserves omitted Muassasah", async () => {
    const form: HotelAgreementDraftFormState = { city: "makkah", agentId: "agent-1", groupName: "Group", hotelName: "Hotel", agreementNumber: "AGR-1", pax: "10", status: "Approved", stayStartIso: "2026-10-10", stayEndIso: "2026-10-15", notes: "" };
    await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
      for (const [selection, expected] of [["muassasah-1", "muassasah-1"], ["", null], [undefined, undefined]] as const) {
        await withMockFetch(async ({ init }) => {
          const payload = JSON.parse(String(init?.body));
          assert.equal(payload.muassasahId, expected);
          if (expected === undefined) assert.equal(Object.hasOwn(payload, "muassasahId"), false);
          return new Response(JSON.stringify({ id: "draft-1", muassasahId: payload.muassasahId }), { status: 200 });
        }, async () => { await saveAgreementDraftInBackend({ draftId: "draft-1", draft: { ...form, muassasahId: selection } }); });
      }
    });
  });
  runCase(
    "fetch agreement drafts rejects invalid backend shape",
    testFetchAgreementDraftsRejectsInvalidBackendShape,
  );
});
