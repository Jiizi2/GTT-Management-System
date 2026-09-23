import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  makkahHotelWaived: false,
  madinahHotelWaived: false,
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

    expect(container.firstElementChild).toHaveClass(
      "min-w-0",
      "max-w-full",
      "overflow-hidden",
      "grid-cols-[minmax(0,1fr)_5.5rem]",
    );
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
    expect(screen.getByRole("group", { name: "Syarikah summary" })).toHaveClass("visa-compact-syarikah", "min-w-0");
    expect(screen.getByRole("region", { name: "Visa information" })).toBeInTheDocument();
  });
});

describe.each(["desktop", "mobile"] as const)("compact visa rows (%s)", (view) => {
  it.each(["Draft", "Pending", "Issued"] as const)("uses a distinct scoped tone for %s", (visaStatus) => {
    render(
      <VisaTrackingRowGroup
        rowGroup={{ mainRow: { ...row, visaStatus }, followerRows: [] }}
        view={view}
        expanded={false}
        isDarkMode={false}
        groupByCode={new Map([[group.code, group]])}
        durationByGroupCode={new Map([[group.code, group.durationDays]])}
        onToggleExpand={vi.fn()}
        onOpenDetail={vi.fn()}
        onUpdateAgreementStatus={vi.fn()}
      />,
    );
    const badge = screen.getByText(visaStatus, { exact: true });
    expect(badge).toHaveAttribute("data-visa-status", visaStatus);
    expect(badge).toHaveClass("visa-compact-badge");
    if (visaStatus === "Pending") expect(badge).toHaveClass("serene-chip-warning");
    if (visaStatus === "Issued") expect(badge).toHaveClass("serene-chip-complete");
  });
  const children = [12, 8, 15, 10].map((pax, index) => ({
    ...row,
    id: `child-${index}`,
    groupCode: `901700000${index + 2}`,
    groupName: `Child group ${index + 1}`,
    pax,
  }));
  const madinahAgreement = {
    ...agreement,
    id: "madinah-1",
    agreementNumber: "9876543210",
    stayStartIso: "2026-07-29",
    stayEndIso: "2026-08-02",
  };
  const parentGroup = { ...group, visaSetup: { ...group.visaSetup!, madinahHotels: [madinahAgreement] } };
  const groupMap = new Map([
    [group.code, parentGroup],
    ...children.map(
      (child) =>
        [
          child.groupCode,
          {
            ...parentGroup,
            id: child.id,
            code: child.groupCode,
            name: child.groupName,
            pax: child.pax,
            parentGroupId: group.id,
          },
        ] as const,
    ),
  ]);

  function Harness({ readOnly = false, onDetail = vi.fn(), onUpdate = vi.fn(), standalone = false }) {
    const [expanded, setExpanded] = useState(false);
    return (
      <VisaTrackingRowGroup
        rowGroup={{ mainRow: row, followerRows: standalone ? [] : children }}
        view={view}
        expanded={expanded}
        isDarkMode={false}
        groupByCode={groupMap}
        durationByGroupCode={new Map([[group.code, group.durationDays]])}
        onToggleExpand={() => setExpanded((value) => !value)}
        onOpenDetail={onDetail}
        onUpdateAgreementStatus={onUpdate}
        readOnly={readOnly}
      />
    );
  }

  it("keeps family counts visible when closed and expands all four children with keyboard", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const toggle = screen.getByRole("button", { name: `Show 4 child groups for ${row.groupCode}` });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("45 Pax · Total 56 Pax");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).not.toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    toggle.focus();
    await user.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.getAllByText("Child", { exact: true })).toHaveLength(4);
    await user.click(toggle);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(toggle).toHaveFocus();
  });

  it("opens the correct child detail and sends approval changes to its own group and city", async () => {
    const user = userEvent.setup();
    const onDetail = vi.fn();
    const onUpdate = vi.fn();
    render(<Harness onDetail={onDetail} onUpdate={onUpdate} />);
    await user.click(screen.getByRole("button", { name: /Show 4 child groups/ }));
    await user.click(screen.getByRole("button", { name: `View details for group ${children[2].groupCode}` }));
    expect(onDetail).toHaveBeenCalledWith(children[2]);
    await user.click(
      screen.getByRole("button", { name: `Update madinah agreement status for ${children[2].groupCode}` }),
    );
    await user.click(screen.getByRole("option", { name: "Waiting" }));
    expect(onUpdate).toHaveBeenCalledWith(children[2].groupCode, "madinah", "Waiting for Approval");
  });

  it("retains every field, uses city-specific dates, and hides editing controls in read-only mode", () => {
    render(<Harness readOnly />);
    const article = screen.getByRole("article", { name: `Group ${row.groupCode}` });
    for (const text of [
      row.groupCode,
      row.groupName,
      "Pending",
      "Visa Only",
      "Provider",
      agreement.agreementNumber,
      madinahAgreement.agreementNumber,
    ]) {
      expect(within(article).getByText(text, { exact: true })).toBeInTheDocument();
    }
    expect(article.querySelector(".visa-compact-makkah")).toHaveTextContent("25 Jul – 28 Jul");
    expect(article.querySelector(".visa-compact-madinah")).toHaveTextContent("29 Jul – 2 Aug");
    expect(screen.queryByRole("button", { name: /Update .* agreement status/ })).not.toBeInTheDocument();
    expect(within(article).getByRole("button", { name: /View details/ })).toBeInTheDocument();
  });

  it("does not render an accordion or parent label for standalone groups", () => {
    render(<Harness standalone />);
    expect(screen.queryByRole("button", { name: /child groups/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Parent", { exact: true })).not.toBeInTheDocument();
  });

  if (view === "mobile") {
    it("places both agreements in a shared row grid so long names keep dates and approval controls aligned", () => {
      const longMadinahAgreement = {
        ...madinahAgreement,
        agreementNumber: "GROUP KEB 21 SEP 25 PAX ARMASTA",
      };
      const longNameGroup = {
        ...group,
        visaSetup: {
          ...group.visaSetup!,
          madinahHotels: [longMadinahAgreement],
        },
      };
      render(
        <VisaTrackingRowGroup
          rowGroup={{ mainRow: row, followerRows: [] }}
          view="mobile"
          expanded={false}
          isDarkMode={false}
          groupByCode={new Map([[group.code, longNameGroup]])}
          durationByGroupCode={new Map([[group.code, group.durationDays]])}
          onToggleExpand={vi.fn()}
          onOpenDetail={vi.fn()}
          onUpdateAgreementStatus={vi.fn()}
        />,
      );

      const agreements = document.querySelector(".visa-compact-agreements");
      expect(agreements).toBeInTheDocument();
      expect(agreements?.querySelectorAll(".visa-compact-agreement")).toHaveLength(2);
      expect(screen.getByText(longMadinahAgreement.agreementNumber)).toBeInTheDocument();
    });
  }
});
