import assert from "node:assert/strict";
import { describe } from "vitest";
import { shouldBlockSessionRestore } from "../shared/session-restore.js";
import { runCase } from "../test/run-case.js";

function testBlocksWhenNoSessionSnapshotAndInitialRequestIsPending(): void {
  assert.equal(
    shouldBlockSessionRestore({
      hasSessionSnapshot: false,
      isPending: true,
      isFetching: true,
      isFetchedAfterMount: false,
    }),
    true,
  );
}

function testBlocksWhenNoSessionSnapshotAndInitialBackgroundFetchHasNotSettled(): void {
  assert.equal(
    shouldBlockSessionRestore({
      hasSessionSnapshot: false,
      isPending: false,
      isFetching: true,
      isFetchedAfterMount: false,
    }),
    true,
  );
}

function testDoesNotBlockWhenSessionSnapshotAlreadyExists(): void {
  assert.equal(
    shouldBlockSessionRestore({
      hasSessionSnapshot: true,
      isPending: false,
      isFetching: true,
      isFetchedAfterMount: false,
    }),
    false,
  );
}

function testDoesNotBlockAfterInitialFetchSettlesWithoutSession(): void {
  assert.equal(
    shouldBlockSessionRestore({
      hasSessionSnapshot: false,
      isPending: false,
      isFetching: false,
      isFetchedAfterMount: true,
    }),
    false,
  );
}

describe("session restore", () => {
  runCase("blocks pending initial restore without session snapshot", testBlocksWhenNoSessionSnapshotAndInitialRequestIsPending);
  runCase(
    "blocks background restore without session snapshot before first fetch completes",
    testBlocksWhenNoSessionSnapshotAndInitialBackgroundFetchHasNotSettled,
  );
  runCase("keeps cached session usable while backend validation runs", testDoesNotBlockWhenSessionSnapshotAlreadyExists);
  runCase("stops blocking after the initial restore settles", testDoesNotBlockAfterInitialFetchSettlesWithoutSession);
});
