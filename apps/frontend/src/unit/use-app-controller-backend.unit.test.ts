import assert from "node:assert/strict";
import { describe } from "vitest";
import { fetchGroupsFromBackend } from "../hooks/use-app-controller-backend.js";
import { formatScheduleDate, getLocalIsoDateWithOffset } from "../shared/app-domain.js";
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
        assert.equal(groups[0]?.tone, "inactive");
        assert.equal(groups[0]?.status, "In Active");
      },
    );
  });
}

describe("use-app-controller-backend", () => {
  runCase("fetch groups marks completed itinerary as inactive", testFetchGroupsMarksCompletedItineraryAsInactive);
});
