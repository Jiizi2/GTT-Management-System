import assert from "node:assert/strict";
import { describe } from "vitest";
import { resolveGroupDetailRecord } from "../hooks/app-controller/group-record-selectors.js";
import type { GroupData } from "../shared/app-domain.js";
import { runCase } from "../test/run-case.js";

function createGroup(overrides: Partial<GroupData> = {}): GroupData {
  return {
    id: "parent-id",
    code: "PARENT-GD",
    name: "Parent Detail Group",
    status: "Active",
    tone: "active",
    pax: 40,
    totalBuses: 1,
    packageName: "Parent Package",
    durationDays: 5,
    arrivalDate: "2099-01-01",
    returnDate: "2099-01-05",
    timeline: [
      { date: "01 Jan", title: "Parent arrival" },
      { date: "05 Jan", title: "Parent departure", isCurrent: true, nextActivity: "Departure" },
    ],
    nextActivity: {
      title: "Parent arrival",
      date: "01 Jan",
      time: "08:00",
      icon: "flight_land",
    },
    itinerary: [
      {
        date: "01 Jan",
        year: "2099",
        category: "Arrival",
        categoryKey: "arrival",
        title: "Parent shared arrival",
        meta: "08:00 | Parent route",
        icon: "flight_land",
        isoDate: "2099-01-01",
        time: "08:00",
        from: "JED Airport",
        to: "Makkah Hotel",
      },
    ],
    notes: ["Parent shared note"],
    musyrif: {
      name: "Ust Parent",
      phone: "0811111111",
      avatar: "https://example.com/parent.png",
    },
    checklistAssignments: [],
    ...overrides,
  };
}

function testChildDetailInheritsParentOperationalFields(): void {
  const parent = createGroup();
  const child = createGroup({
    id: "child-id",
    code: "CHILD-GD",
    name: "Child Detail Group",
    pax: 7,
    packageName: "Child Package",
    parentGroupId: parent.id,
    itinerary: [],
    notes: ["Child private note should not drive operational detail"],
    musyrif: {
      name: "Child placeholder",
      phone: "-",
      avatar: "https://example.com/child.png",
    },
    visaSetup: {
      visaStatus: "Pending",
      syarikah: "Child Provider",
      paymentStatus: "Partial",
      makkahHotels: [],
      madinahHotels: [],
      raudhahAppointments: [],
    },
  });

  const resolved = resolveGroupDetailRecord(child, [parent, child]);

  assert.ok(resolved);
  assert.equal(resolved.code, "CHILD-GD");
  assert.equal(resolved.name, "Child Detail Group");
  assert.equal(resolved.pax, 7);
  assert.equal(resolved.packageName, "Child Package");
  assert.equal(resolved.visaSetup?.syarikah, "Child Provider");
  assert.equal(resolved.musyrif.name, "Ust Parent");
  assert.deepEqual(
    resolved.itinerary.map((item) => item.title),
    ["Parent shared arrival"],
  );
  assert.deepEqual(resolved.notes, ["Parent shared note"]);
}

function testStandaloneDetailReturnsSameRecord(): void {
  const parent = createGroup();
  assert.equal(resolveGroupDetailRecord(parent, [parent]), parent);
}

describe("group detail selection", () => {
  runCase("child detail inherits parent operational fields", testChildDetailInheritsParentOperationalFields);
  runCase("standalone detail returns the same record", testStandaloneDetailReturnsSameRecord);
});
