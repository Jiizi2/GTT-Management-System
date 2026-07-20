import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GroupAgreementHotel, GroupData, VisaTrackingRow } from "../../shared/app-domain";
import { AgreementSummaryFields } from "../../pages/visa-detail/components/HotelAgreementSection";
import { VisaTrackingRowGroup } from "../../pages/visa-tracking/components/VisaTrackingRowGroup";

const agreement: GroupAgreementHotel = {
  id: "hotel-1",
  hotelName: "Agreement Swissotel Makkah",
  agreementNumber: "15762600113641841",
  pax: 11,
  status: "Approved",
  stayStartIso: "2026-07-25",
  stayEndIso: "2026-07-28",
};

const row: VisaTrackingRow = {
  id: "visa-row-1",
  groupCode: "480900308615",
  groupName: "VISA ONLY KEB 3 AGUSTUS 11 PAX JSA",
  pax: 11,
  packageName: "PRIVATE",
  issuedDateIso: "",
  departureIso: "2026-07-25",
  returnIso: "2026-08-02",
  visaStatus: "Pending",
  paymentStatus: "Paid",
  raudhahLabel: "Not Set",
  raudhahHint: "",
  raudhahTone: "muted",
  makkahVerified: 11,
  madinahVerified: 0,
};

const group: GroupData = {
  id: "group-1",
  code: row.groupCode,
  name: row.groupName,
  status: "ACTIVE",
  lifecycleStatus: "ACTIVE",
  tone: "active",
  pax: row.pax,
  packageName: row.packageName,
  durationDays: 9,
  arrivalDate: row.departureIso,
  returnDate: row.returnIso,
  timeline: [
    { date: "-", title: "-" },
    { date: "-", title: "-" },
  ],
  nextActivity: { title: "-", date: "-", time: "-", icon: "schedule" },
  itinerary: [],
  notes: [],
  musyrif: { name: "-", phone: "-", avatar: "" },
  visaSetup: {
    visaStatus: row.visaStatus,
    syarikah: "Provider Nusuk dengan nama yang panjang",
    busStatus: "Visa Only",
    paymentStatus: row.paymentStatus,
    makkahHotels: [agreement],
    madinahHotels: [],
    raudhahAppointments: [],
  },
};

describe("mobile visa layouts", () => {
  it("keeps the hotel summary within a shrinking two-column mobile grid", () => {
    const { container } = render(<AgreementSummaryFields agreement={agreement} />);

    expect(container.firstElementChild).toHaveClass("min-w-0", "grid-cols-[minmax(0,1fr)_5.5rem]");
    expect(screen.getByText("25 Jul 2026 - 28 Jul 2026").parentElement).toHaveClass("col-span-2", "min-w-0");
  });

  it("lets long visa-type badges wrap inside the redesigned metadata grid", () => {
    render(
      <VisaTrackingRowGroup
        rowGroup={{ mainRow: row, followerRows: [] }}
        view="mobile"
        expanded={false}
        isDarkMode={false}
        groupByCode={new Map([[group.code, group]])}
        durationByGroupCode={new Map([[group.code, group.durationDays]])}
        onToggleExpand={vi.fn()}
        onOpenDetail={vi.fn()}
        onUpdateAgreementStatus={vi.fn()}
        readOnly
      />,
    );

    expect(screen.getByText("Visa Only")).toHaveClass("max-w-full", "whitespace-normal", "break-words");
    expect(screen.getByRole("group", { name: "Syarikah summary" })).toHaveClass("col-span-2", "min-w-0");
    expect(screen.getByRole("region", { name: "Visa information" })).toBeInTheDocument();
  });
});
