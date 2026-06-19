import assert from "node:assert/strict";
import { describe } from "vitest";
import { fetchAgreementDraftsFromBackend } from "../hooks/use-agreement-drafts-query.js";
import { runCase } from "../test/run-case.js";

type FetchFn = typeof fetch;

type FetchCall = {
  input: string | URL | Request;
  init?: RequestInit;
};

function withMockFetch<T>(
  implementation: (call: FetchCall) => Promise<Response>,
  fn: (calls: FetchCall[]) => Promise<T>,
): Promise<T> {
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch as FetchFn;

  (globalThis as { fetch: FetchFn }).fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input, init });
    return implementation({ input, init });
  }) as FetchFn;

  return fn(calls).finally(() => {
    (globalThis as { fetch: FetchFn }).fetch = originalFetch;
  });
}

function withApiBaseOverride<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const key = "__GTT_API_BASE_URL__";
  const holder = globalThis as { [key: string]: unknown };
  const previous = holder[key];

  if (value === undefined) {
    delete holder[key];
  } else {
    holder[key] = value;
  }

  return fn().finally(() => {
    if (previous === undefined) {
      delete holder[key];
    } else {
      holder[key] = previous;
    }
  });
}

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
