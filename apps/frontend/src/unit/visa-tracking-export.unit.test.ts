import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { GroupData, VisaTrackingRow } from "../shared/app-domain";
import { exportVisaTrackingReportPdf } from "../pages/visa-tracking-export";

function row(overrides: Partial<VisaTrackingRow> = {}): VisaTrackingRow {
  return {
    id: "row-1",
    groupCode: "GRP-001",
    groupName: "Test Group",
    pax: 20,
    packageName: "Visa Only",
    issuedDateIso: "2026-10-01",
    departureIso: "2026-10-12",
    returnIso: "2026-10-21",
    visaStatus: "Issued",
    paymentStatus: "Paid",
    raudhahLabel: "",
    raudhahHint: "",
    raudhahTone: "muted",
    makkahVerified: 20,
    madinahVerified: 20,
    makkahHotelWaived: false,
    madinahHotelWaived: false,
    ...overrides,
  };
}

function captureReport(
  rows: VisaTrackingRow[],
  groups: GroupData[] = [],
  context: Partial<Parameters<typeof exportVisaTrackingReportPdf>[0]> = {},
) {
  vi.stubGlobal("window", {
    location: { origin: "http://localhost" },
    setTimeout: vi.fn(),
  });
  let html = "";
  const printWindow = {
    closed: false,
    focus: vi.fn(),
    print: vi.fn(),
    addEventListener: vi.fn(),
    document: {
      open: vi.fn(),
      write: vi.fn((value: string) => {
        html = value;
      }),
      close: vi.fn(),
    },
  } as unknown as Window;
  expect(
    exportVisaTrackingReportPdf(
      {
        rows,
        groups,
        query: "",
        activeFilter: "all",
        ...context,
      },
      { printWindow },
    ),
  ).toBe(true);
  return new JSDOM(html.replace(/<style>[\s\S]*?<\/style>/, "")).window.document;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("visa tracking PDF export", () => {
  it("keeps every supplied group and totals pax", () => {
    const doc = captureReport([
      row(),
      row({ id: "older", groupCode: "OLDER", pax: 10, issuedDateIso: "2026-09-20" }),
      row({ id: "pending", groupCode: "PENDING", pax: 5, visaStatus: "Pending" }),
      row({ id: "undated", groupCode: "UNDATED", pax: 7, issuedDateIso: "" }),
    ]);
    expect(doc.querySelector(".report-summary")?.textContent).toBe("4 group · 42 pax · 3 issued · 0 belum lunas");
    expect(doc.querySelectorAll("tbody tr")).toHaveLength(4);
  });

  it("exports paid, partial and unpaid statuses with active filter context", () => {
    const doc = captureReport(
      [
        row({ paymentStatus: "Paid" }),
        row({ groupCode: "PARTIAL", paymentStatus: "Partial" }),
        row({ groupCode: "UNPAID", paymentStatus: "Unpaid" }),
      ],
      [],
      { activeFilter: "unpaid", query: "Matched family" },
    );
    expect([...doc.querySelectorAll(".payment-status")].map((status) => status.textContent?.trim())).toEqual([
      "Paid",
      "Partial",
      "Unpaid",
    ]);
    expect(doc.querySelector(".report-context")?.textContent).toContain("Filter: Unpaid");
    expect(doc.querySelector(".report-context")?.textContent).toContain("Pencarian: Matched family");
    expect(doc.querySelector(".report-summary")?.textContent).toContain("2 belum lunas");
  });

  it("includes travel dates, visa service and provider while preserving a missing issued date", () => {
    const group = {
      code: "GRP-001",
      visaSetup: { busStatus: "Visa+", syarikah: "Contoh Provider" },
    } as GroupData;
    const doc = captureReport([row({ issuedDateIso: "" })], [group]);
    expect(doc.querySelector(".travel")?.textContent).toContain("Berangkat: 12 Oct 2026");
    expect(doc.querySelector(".travel")?.textContent).toContain("Pulang: 21 Oct 2026");
    expect(doc.querySelector(".service-type")?.textContent).toBe("Visa+");
    expect(doc.querySelector(".provider")?.textContent).toBe("Contoh Provider");
    expect(doc.querySelector(".issued-date")?.textContent).toBe("Issued: -");
  });

  it.each(["parent-id", "GRP-001"])(
    "preserves parent/child relationships referenced by %s without double counting pax",
    (parentGroupId) => {
      const rows = [row({ groupCode: "GRP-001", pax: 20 }), row({ groupCode: "GRP-002", pax: 8 })];
      const groups = [
        { id: "parent-id", code: "GRP-001" },
        { code: "GRP-002", parentGroupId },
      ] as GroupData[];
      const doc = captureReport(rows, groups);
      expect(doc.querySelector(".parent-row .group-code")?.textContent).toBe("GRP-001");
      expect(doc.querySelector(".child-row .parent-reference")?.textContent).toBe("Terhubung: GRP-001");
      expect(doc.body.textContent).not.toMatch(/\b(parent|child)\b/i);
      expect(doc.querySelector(".report-summary")?.textContent).toContain("2 group · 28 pax");
      const childOnly = captureReport([rows[1]], groups);
      expect(childOnly.querySelector(".child-row .parent-reference")?.textContent).toBe("Terhubung: GRP-001");
      expect(childOnly.body.textContent).not.toMatch(/\b(parent|child)\b/i);
    },
  );

  it("escapes report content and displays the export timestamp in WIB", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T23:30:00Z"));
    const payload = '<img src=x onerror="alert(1)">';
    const doc = captureReport([row({ groupName: payload })], [], {
      query: payload,
      agentLabel: payload,
    });
    expect(doc.querySelectorAll("img")).toHaveLength(1);
    expect(doc.querySelector(".group-name")?.textContent).toBe(payload);
    expect(doc.querySelector(".report-context")?.textContent).toContain(payload);
    expect(doc.querySelector(".document-meta")?.textContent).toMatch(/01 Okt 2026.*06[.:]30 WIB/);
  });

  it("renders a useful empty state and returns false when the popup is blocked", () => {
    const doc = captureReport([]);
    expect(doc.querySelector(".empty")?.textContent).toContain("Tidak ada data visa tracking");
    expect(doc.querySelector(".report-summary")?.textContent).toBe("0 group · 0 pax · 0 issued · 0 belum lunas");
    vi.stubGlobal("window", { open: vi.fn(() => null) });
    expect(
      exportVisaTrackingReportPdf({
        rows: [],
        groups: [],
        query: "",
        activeFilter: "all",
      }),
    ).toBe(false);
  });
});
