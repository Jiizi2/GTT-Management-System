import { describe, expect, it, vi } from "vitest";
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
    expect(writtenHtml).toContain("Weekly Operations Report");
    expect(writtenHtml).toContain("Included this week");
    expect(writtenHtml).not.toContain("Excluded older month");
    vi.unstubAllGlobals();
  });
});
