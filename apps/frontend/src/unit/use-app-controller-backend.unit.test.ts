import assert from "node:assert/strict";
import { describe } from "vitest";
import { createGroupIdentityInBackend, fetchGroupsFromBackend, updateGroupInBackend } from "../hooks/use-app-controller-backend.js";
import { formatScheduleDate, getLocalIsoDateWithOffset } from "../shared/app-domain.js";
import type { GroupData } from "../shared/app-domain.js";
import { runCase } from "../test/run-case.js";
import { withMockFetch } from "../test/with-mock-fetch.js";
import { withApiBaseOverride } from "../test/with-api-base-override.js";

async function testFetchGroupsMarksCompletedItineraryAsInactive(): Promise<void> {
  const arrivalIso = getLocalIsoDateWithOffset(-3);
  const departureIso = getLocalIsoDateWithOffset(-1);
  const arrivalDate = formatScheduleDate(arrivalIso);
  const departureDate = formatScheduleDate(departureIso);

  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () =>
        new Response(
          JSON.stringify([
            {
              code: "9017001003",
              name: "Draft Visa Missing Hotel Group",
              status: "Active",
              lifecycleStatus: "ACTIVE",
              tone: "ACTIVE",
              pax: 30,
              packageName: "Umrah Regular",
              durationDays: 3,
              arrivalDate: arrivalIso,
              returnDate: departureIso,
              itinerary: [
                {
                  sortOrder: 0,
                  dateLabel: arrivalDate.date,
                  yearLabel: arrivalDate.year,
                  category: "Arrival",
                  categoryKey: "arrival",
                  title: "Arrival JED Airport",
                  meta: "08:00 | JED Airport -> Makkah Hotel",
                  icon: "flight_land",
                  isoDate: arrivalIso,
                  time: "08:00",
                  fromLocation: "JED Airport",
                  toLocation: "Makkah Hotel",
                },
                {
                  sortOrder: 1,
                  dateLabel: departureDate.date,
                  yearLabel: departureDate.year,
                  category: "Departure",
                  categoryKey: "departure",
                  title: "Departure MED Airport",
                  meta: "18:00 | Madinah Hotel -> MED Airport",
                  icon: "flight_takeoff",
                  isoDate: departureIso,
                  time: "18:00",
                  fromLocation: "Madinah Hotel",
                  toLocation: "MED Airport",
                },
              ],
            },
          ]),
          { status: 200 },
        ),
      async (calls) => {
        const groups = await fetchGroupsFromBackend();

        assert.equal(String(calls[0].input), "http://127.0.0.1:4100/api/groups?projection=detail");
        assert.equal(groups.length, 1);
        assert.equal(groups[0]?.lifecycleStatus, "ACTIVE");
        assert.equal(groups[0]?.tone, "inactive");
        assert.equal(groups[0]?.status, "In Active");
      },
    );
  });
}

async function testCreateGroupIdentityPostsMinimalWorkspace(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () =>
        new Response(
          JSON.stringify({
            code: "G-IDENTITY",
            name: "Nusuk Identity",
            status: "Entry Only",
            tone: "ACTIVE",
            pax: 25,
            totalBuses: 1,
            packageName: "Nusuk Package",
            durationDays: 7,
            arrivalDate: "2099-01-01",
            returnDate: "2099-01-07",
            itinerary: [],
            timeline: [],
            notes: [],
          }),
          { status: 201 },
        ),
      async (calls) => {
        const group = await createGroupIdentityInBackend({
          groupCode: " g-identity ",
          groupName: " Nusuk Identity ",
          packageName: " Nusuk Package ",
          pax: 25,
          totalBuses: 1,
          arrivalDate: "2099-01-01",
          returnDate: "2099-01-07",
          musyrifName: " Ust Identity ",
          musyrifPhone: " 081234 ",
        });

        assert.equal(String(calls[0].input), "http://127.0.0.1:4100/api/groups/identity");
        assert.equal(calls[0].init?.method, "POST");
        const body = JSON.parse(String(calls[0].init?.body)) as {
          code?: string;
          name?: string;
          musyrif?: { name?: string; phone?: string };
        };
        assert.equal(body.code, "G-IDENTITY");
        assert.equal(body.name, "Nusuk Identity");
        assert.equal(body.musyrif?.name, "Ust Identity");
        assert.equal(body.musyrif?.phone, "081234");
        assert.equal(group.code, "G-IDENTITY");
        assert.equal(group.status, "Entry Only");
        assert.equal(group.itinerary.length, 0);
      },
    );
  });
}

async function testFetchGroupsRejectsInvalidBackendShape(): Promise<void> {
  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () => new Response(JSON.stringify([{ name: "Missing Code" }]), { status: 200 }),
      async () => {
        await assert.rejects(
          () => fetchGroupsFromBackend(),
          /Backend fetch failed: invalid backend response/,
        );
      },
    );
  });
}

async function testUpdateGroupUsesPatchPayload(): Promise<void> {
  const group: GroupData = {
    code: " new-code ",
    name: " Updated Group ",
    status: "Active",
    tone: "active",
    pax: 28,
    totalBuses: 1,
    packageName: "Regular",
    durationDays: 8,
    arrivalDate: "2099-02-01",
    returnDate: "2099-02-08",
    parentGroupId: null,
    timeline: [{ date: "01 Feb", title: "Arrival" }],
    itinerary: [
      {
        date: "01 Feb",
        year: "2099",
        category: "Arrival",
        title: "Arrival JED Airport",
        meta: "08:00 | JED Airport -> Makkah Hotel",
        icon: "flight_land",
        isoDate: "2099-02-01",
        time: "08:00",
      },
    ],
    notes: ["Do not send through PATCH"],
    musyrif: {
      name: "Ust Update",
      phone: "08123456789",
      avatar: "https://example.com/avatar.png",
    },
  };

  await withApiBaseOverride("http://127.0.0.1:4100/api", async () => {
    await withMockFetch(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      async (calls) => {
        await updateGroupInBackend("OLD-CODE", group);

        assert.equal(String(calls[0].input), "http://127.0.0.1:4100/api/groups/OLD-CODE");
        assert.equal(calls[0].init?.method, "PATCH");
        const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
        assert.equal(body.code, "NEW-CODE");
        assert.equal(body.name, "Updated Group");
        assert.equal(body.tone, "ACTIVE");
        assert.equal(body.parentGroupId, null);
        assert.equal("itinerary" in body, false);
        assert.equal("notes" in body, false);
        assert.equal("musyrif" in body, false);
      },
    );
  });
}

describe("use-app-controller-backend", () => {
  runCase("fetch groups marks completed itinerary as inactive", testFetchGroupsMarksCompletedItineraryAsInactive);
  runCase("create group identity posts minimal workspace", testCreateGroupIdentityPostsMinimalWorkspace);
  runCase("update group uses PATCH payload without nested detail", testUpdateGroupUsesPatchPayload);
  runCase("fetch groups rejects invalid backend shape", testFetchGroupsRejectsInvalidBackendShape);
});
