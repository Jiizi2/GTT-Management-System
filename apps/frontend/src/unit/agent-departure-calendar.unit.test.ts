import { describe, expect, it } from "vitest";
import { calendarDays, departureJourneys, shiftCalendarMonth, validDateOnly } from "../agent/data/departure-calendar";
import type { GroupSummary } from "../agent/data/contracts";
describe("Agent departure dates", () => {
  it("keeps date-only keys and rejects impossible dates", () => {
    expect(validDateOnly("2026-10-10T00:00:00.000Z")).toBe("2026-10-10");
    expect(validDateOnly("2026-02-29")).toBeUndefined();
    expect(validDateOnly("2028-02-29")).toBe("2028-02-29");
    expect(validDateOnly("2026-13-01")).toBeUndefined();
    expect(shiftCalendarMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftCalendarMonth("2026-01", -1)).toBe("2025-12");
  });
  it("lays out Monday-first months without losing the last days or leap day", () => {
    expect(calendarDays("2026-10")[3]).toEqual({ date: "2026-10-01", day: 1, inMonth: true });
    expect(calendarDays("2026-08")).toHaveLength(42);
    expect(calendarDays("2028-02").filter((day) => day.inMonth)).toHaveLength(29);
  });
  it("uses outbound flight before arrival, ignores the return flight, and labels a missing flight explicitly", () => {
    const root = {
      id: "parent",
      code: "GTT-001",
      pax: 20,
      arrivalDate: "2026-10-11",
      itinerary: [
        { category: "FLIGHT", isoDate: "2026-10-20" },
        { category: "FLIGHT", isoDate: "2026-10-10" },
      ],
    } as GroupSummary;
    const child = { ...root, id: "child", code: "GTT-002", parentGroupId: "parent", pax: 10 };
    const fallback = { ...root, id: "other", code: "GTT-003", itinerary: [] };
    const rows = departureJourneys([child, fallback, root]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: "2026-10-10", dateSource: "flight", pax: 30 });
    expect(rows[1]).toMatchObject({ date: "2026-10-11", dateSource: "journey" });
  });
});
