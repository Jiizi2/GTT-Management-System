import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GroupData, ItineraryItem } from "../shared/app-domain";
import { exportOverviewReportPdf } from "../pages/overview-export";

function toLocalIsoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function createTrip(title: string, isoDate: string): ItineraryItem {
  return {
    id: title,
    title,
    category: "Transfer",
    categoryKey: "transfer",
    date: isoDate,
    year: isoDate.slice(0, 4),
    isoDate,
    time: "09:00",
    meta: "09:00",
    from: "Makkah",
    to: "Madinah",
    flightNumber: "",
    requiresBus: true,
    icon: "route",
  } as ItineraryItem;
}

describe("exportOverviewReportPdf", () => {
  it("only includes itinerary rows from the current Monday-to-Sunday week", () => {
    vi.stubGlobal("window", {
      location: { origin: "http://localhost" },
      setTimeout: (callback: () => void) => {
        callback();
        return 1;
      },
    });
    const today = new Date();
    const daysSinceMonday = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysSinceMonday);
    const outsideWeek = new Date(monday);
    outsideWeek.setDate(monday.getDate() - 20);

    const group = {
      code: "GRP-WEEKLY",
      name: "Weekly Group",
      status: "Active",
      tone: "active",
      pax: 40,
      itinerary: [
        createTrip("Included this week", toLocalIsoDate(monday)),
        createTrip("Excluded older month", toLocalIsoDate(outsideWeek)),
      ],
    } as GroupData;

    let writtenHtml = "";
    const printWindow = {
      closed: false,
      focus: vi.fn(),
      print: vi.fn(),
      addEventListener: vi.fn(),
      document: {
        open: vi.fn(),
        write: vi.fn((html: string) => {
          writtenHtml = html;
        }),
        close: vi.fn(),
      },
    } as unknown as Window;

    const result = exportOverviewReportPdf(
      {
        groups: [group],
        query: "",
        isActiveOnly: true,
        monthLabel: "All Months",
      },
      { printWindow },
    );

    expect(result).toBe(true);
    expect(writtenHtml).toContain("Laporan Operasional Mingguan");
    expect(writtenHtml).toContain("Included this week");
    expect(writtenHtml).not.toContain("Excluded older month");
    vi.unstubAllGlobals();
  });
});

function captureReport(groups: GroupData[], query = ""): Document {
  vi.stubGlobal("window", {
    location: { origin: "http://localhost" },
    setTimeout: vi.fn(),
  });
  let html = "";
  const printWindow = {
    closed: false,
    addEventListener: vi.fn(),
    document: {
      open: vi.fn(),
      write: (value: string) => {
        html = value;
      },
      close: vi.fn(),
    },
  } as unknown as Window;
  exportOverviewReportPdf({ groups, query, isActiveOnly: true, monthLabel: "All Months" }, { printWindow });
  return new JSDOM(html).window.document;
}

describe("overview report daily schedules", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("groups by date, sorts times, excludes inactive groups and counts each group's pax once", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00"));
    const group = {
      code: "GTT-001",
      name: "Weekly Group",
      status: "Active",
      tone: "active",
      pax: 40,
      itinerary: [
        { ...createTrip("Tuesday activity", "2026-09-29"), busCount: 2 },
        { ...createTrip("Monday afternoon", "2026-09-28"), time: "14:00", busCount: 1 },
        { ...createTrip("Monday morning", "2026-09-28"), time: "08:00", busCount: 2 },
        createTrip("Next week", "2026-10-05"),
      ],
    } as GroupData;
    const inactiveGroup = {
      ...group,
      code: "INACTIVE",
      tone: "inactive",
      pax: 100,
      itinerary: [createTrip("Inactive activity", "2026-09-28")],
    } as GroupData;
    const document = captureReport([group, inactiveGroup]);
    const schedules = document.querySelectorAll(".daily-schedule");
    expect(schedules).toHaveLength(2);
    expect(schedules[0].querySelector("h2")?.textContent).toContain("Senin, 28 September 2026");
    expect(schedules[1].querySelector("h2")?.textContent).toContain("Selasa, 29 September 2026");
    expect([...schedules[0].querySelectorAll(".activity-title")].map((cell) => cell.textContent)).toEqual([
      "Monday morning",
      "Monday afternoon",
    ]);
    expect([...document.querySelectorAll(".metric-value")].map((cell) => cell.textContent)).toEqual([
      "1",
      "40",
      "3",
      "5",
    ]);
    expect(document.body.textContent).not.toContain("Inactive activity");
    expect(document.body.textContent).not.toContain("Next week");
    expect(document.querySelector(".footer")?.textContent).toContain("Group nonaktif dikecualikan (1)");
  });

  it("renders an explicit weekly empty state without daily tables", () => {
    const document = captureReport([]);
    expect(document.querySelector(".empty h2")?.textContent).toBe("Belum ada aktivitas minggu ini");
    expect(document.querySelectorAll("table")).toHaveLength(0);
    expect([...document.querySelectorAll(".metric-value")].map((cell) => cell.textContent)).toEqual([
      "0",
      "0",
      "0",
      "0",
    ]);
  });

  it("keeps record and search content as text, including long values and HTML characters", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T12:00:00"));
    const title = '<script>alert("activity")</script>';
    const query = '<img src=x onerror="alert(1)">';
    const document = captureReport(
      [
        {
          code: "GTT-001",
          name: "Group & Agent <One>",
          status: "Active",
          tone: "active",
          pax: 40,
          itinerary: [createTrip(title, "2026-09-28")],
        } as GroupData,
      ],
      query,
    );
    expect(document.querySelector(".activity-title")?.textContent).toBe(title);
    expect(document.querySelector(".footer")?.textContent).toContain(query);
    expect(document.querySelector(".secondary-text")?.textContent).toBe("Group & Agent <One>");
    expect(document.querySelectorAll("script, .footer img")).toHaveLength(0);
  });
});
