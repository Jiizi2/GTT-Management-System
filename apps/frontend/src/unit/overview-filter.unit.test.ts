import assert from "node:assert/strict";
import { describe } from "vitest";
import {
  filterOverviewGroups,
  shouldUseRemoteGroupSearch,
} from "../hooks/app-controller/use-dashboard-group-records.js";
import type { GroupData } from "../shared/app-domain.js";
import { runCase } from "../test/run-case.js";

function createOverviewGroup(overrides: Partial<GroupData> = {}): GroupData {
  return {
    id: "parent-id",
    code: "PARENT-GP",
    name: "Parent Group",
    status: "Active",
    tone: "active",
    pax: 40,
    totalBuses: 1,
    packageName: "Umrah Family",
    durationDays: 5,
    arrivalDate: "2099-01-01",
    returnDate: "2099-01-05",
    timeline: [
      {
        date: "01 Jan",
        title: "Arrival",
      },
      {
        date: "05 Jan",
        title: "Departure",
        isCurrent: true,
        nextActivity: "Departure",
      },
    ],
    nextActivity: {
      title: "Arrival",
      date: "01 Jan",
      time: "08:00",
      icon: "flight_land",
    },
    itinerary: [],
    notes: [],
    musyrif: {
      name: "Ust Parent",
      phone: "08123456789",
      avatar: "https://example.com/avatar.png",
    },
    checklistAssignments: [],
    ...overrides,
  };
}

function testOverviewKeepsSearchLocal(): void {
  assert.equal(
    shouldUseRemoteGroupSearch({
      activeNav: "overview",
      usesGroupRecords: true,
      requestedProjection: "summary",
    }),
    false,
  );
  assert.equal(
    shouldUseRemoteGroupSearch({
      activeNav: "new-group",
      usesGroupRecords: true,
      requestedProjection: "summary",
    }),
    true,
  );
  assert.equal(
    shouldUseRemoteGroupSearch({
      activeNav: "visa",
      usesGroupRecords: true,
      requestedProjection: "detail",
    }),
    false,
  );
}

function testChildCodeSearchDisplaysParentCard(): void {
  const parent = createOverviewGroup();
  const child = createOverviewGroup({
    id: "child-id",
    code: "CHILD-GP",
    name: "Child Passenger Block",
    pax: 5,
    parentGroupId: parent.id,
  });

  const filtered = filterOverviewGroups({
    sourceGroups: [parent, child],
    allGroups: [parent, child],
    normalizedQuery: "child-gp",
    isActiveOnly: true,
    shouldFilterByMonth: false,
    overviewMonthFilter: "all",
  });

  assert.deepEqual(
    filtered.map((group) => group.code),
    ["PARENT-GP"],
  );
}

function testChildNameSearchDisplaysParentCard(): void {
  const parent = createOverviewGroup();
  const child = createOverviewGroup({
    id: "child-id",
    code: "CHILD-GP",
    name: "Bandung Family Extension",
    pax: 5,
    parentGroupId: parent.code,
  });

  const filtered = filterOverviewGroups({
    sourceGroups: [parent, child],
    allGroups: [parent, child],
    normalizedQuery: "bandung family",
    isActiveOnly: true,
    shouldFilterByMonth: false,
    overviewMonthFilter: "all",
  });

  assert.deepEqual(
    filtered.map((group) => group.code),
    ["PARENT-GP"],
  );
}

function testActiveOnlyStillExcludesInactiveParent(): void {
  const parent = createOverviewGroup({
    tone: "inactive",
    status: "In Active",
  });
  const child = createOverviewGroup({
    id: "child-id",
    code: "CHILD-GP",
    name: "Child Passenger Block",
    parentGroupId: parent.id,
  });

  const filtered = filterOverviewGroups({
    sourceGroups: [parent, child],
    allGroups: [parent, child],
    normalizedQuery: "child",
    isActiveOnly: true,
    shouldFilterByMonth: false,
    overviewMonthFilter: "all",
  });

  assert.equal(filtered.length, 0);
}

describe("overview filters", () => {
  runCase("overview keeps linked-group search local", testOverviewKeepsSearchLocal);
  runCase("child code search displays parent card", testChildCodeSearchDisplaysParentCard);
  runCase("child name search displays parent card", testChildNameSearchDisplaysParentCard);
  runCase("active only still excludes inactive parent", testActiveOnlyStillExcludesInactiveParent);
});
