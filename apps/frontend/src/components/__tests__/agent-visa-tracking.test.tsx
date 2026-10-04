import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { GroupData } from "../../shared/app-domain";
import type { VisaApplication } from "../../agent/data/contracts";
import { AgentVisaDetailPage } from "../../agent/pages/visa-detail-page";
import { AgentVisaTrackingPage } from "../../agent/pages/visa-tracking-page";

const { useAgentGroupDataMock, useAgentVisaApplicationsMock } = vi.hoisted(() => ({
  useAgentGroupDataMock: vi.fn(),
  useAgentVisaApplicationsMock: vi.fn(),
}));

vi.mock("../../agent/data/use-agent-group-data", () => ({
  useAgentGroupData: (...args: unknown[]) => useAgentGroupDataMock(...args),
}));

vi.mock("../../agent/data/use-agent-visa-applications", () => ({
  useAgentVisaApplications: (...args: unknown[]) => useAgentVisaApplicationsMock(...args),
}));

const group: GroupData = {
  id: "group-a",
  code: "480900308615",
  name: "VISA ONLY KEB 3 AGUSTUS 11 PAX JSA",
  status: "ACTIVE",
  lifecycleStatus: "ACTIVE",
  tone: "active",
  pax: 11,
  packageName: "PRIVATE",
  durationDays: 9,
  arrivalDate: "2026-08-03",
  returnDate: "2026-08-11",
  timeline: [
    { date: "-", title: "-" },
    { date: "-", title: "-" },
  ],
  nextActivity: { title: "-", date: "-", time: "-", icon: "schedule" },
  itinerary: [],
  notes: [],
  musyrif: { name: "-", phone: "-", avatar: "" },
  visaSetup: {
    visaStatus: "Issued",
    issuedDate: "2026-07-30",
    syarikah: "Provider A",
    busStatus: "Visa Only",
    paymentStatus: "Paid",
    makkahHotels: [
      {
        id: "hotel-a",
        hotelName: "Hotel Makkah",
        agreementNumber: "AGR-001",
        pax: 11,
        status: "Approved",
        stayStartIso: "2026-08-03",
        stayEndIso: "2026-08-07",
      },
    ],
    madinahHotels: [],
    raudhahAppointments: [],
  },
};

const application: VisaApplication = {
  id: "application-a",
  applicationNumber: "VSA-2026-001",
  agentId: "agent-a",
  groupId: "group-a",
  departureDate: "2026-08-03T00:00:00.000Z",
  returnDate: "2026-08-11T00:00:00.000Z",
  departureCity: "Jakarta",
  providerName: "Provider A",
  packageName: "PRIVATE",
  passengerCount: 11,
  status: "NEED_REVISION",
  documentStatus: "NEED_REVISION",
  agreementStatus: "APPROVED",
  nusukStatus: "PASSENGER_ENTERED",
  paymentStatus: "WAITING_PAYMENT",
  visaStatus: "PROCESSING",
  nusukGroupNumber: null,
  nusukReferenceNumber: null,
  submittedAt: null,
  completedAt: null,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-02T00:00:00.000Z",
  group: {
    id: "group-a",
    code: group.code,
    name: group.name,
    arrivalDate: "2026-08-03T00:00:00.000Z",
    returnDate: "2026-08-11T00:00:00.000Z",
    pax: 11,
    packageName: "PRIVATE",
    agentId: "agent-a",
  },
  documents: [
    {
      id: "document-a",
      type: "PASSPORT",
      originalName: "passport-jamaah-dengan-nama-file-yang-sangat-panjang.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1200,
      status: "NEED_REVISION",
      reviewNote: "Halaman identitas kurang jelas.",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-02T00:00:00.000Z",
    },
  ],
};

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}

describe("Portal Agent Visa Tracking", () => {
  it("filters a child without transferring its status to the parent", () => {
    const child = {
      ...group,
      id: "group-child",
      code: "CHILD-001",
      name: "Child tambahan",
      pax: 5,
      parentGroupId: group.id,
    };
    const childApplication = {
      ...application,
      groupId: child.id,
      group: { ...application.group!, id: child.id, code: child.code, name: child.name },
      visaStatus: "NOT_STARTED",
      agreementStatus: "NOT_STARTED",
      nusukStatus: "NOT_STARTED",
    };
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [child, group] });
    useAgentVisaApplicationsMock.mockReturnValue({ isPending: false, isError: false, data: [childApplication] });
    render(
      <MemoryRouter initialEntries={["/agent/visa?status=attention"]}>
        <AgentVisaTrackingPage principalId="portal-a" agentId="agent-a" agentName="JSA" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Perlu perhatian 1" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("16 jamaah")).toBeInTheDocument();
    const parentRow = screen.getByRole("region", { name: `Group ${group.code}` });
    expect(within(parentRow).getByText("Group terhubung")).toBeInTheDocument();
    expect(within(parentRow).getByText("Visa terbit")).toBeInTheDocument();
    expect(within(parentRow).getAllByText("Belum tercatat")).toHaveLength(2);
    const childRow = screen.getByRole("region", { name: "Group CHILD-001" });
    expect(screen.queryByText(/^(Parent|Child)$/)).not.toBeInTheDocument();
    expect(within(childRow).getByText("Perlu revisi")).toBeInTheDocument();
    expect(within(childRow).queryByText("Visa terbit")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Visa terbit 1" }));
    expect(screen.queryByRole("region", { name: "Group CHILD-001" })).not.toBeInTheDocument();
  });

  it("keeps an unlinked application visible with its departure date and detail route", () => {
    const unlinked = { ...application, groupId: null, group: null };
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [] });
    useAgentVisaApplicationsMock.mockReturnValue({ isPending: false, isError: false, data: [unlinked] });
    render(
      <MemoryRouter initialEntries={["/agent/visa"]}>
        <Routes>
          <Route
            path="/agent/visa"
            element={<AgentVisaTrackingPage principalId="portal-a" agentId="agent-a" agentName="JSA" />}
          />
          <Route path="/agent/visa/:identity" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Keberangkatan", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("VSA-2026-001")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lihat detail visa VSA-2026-001" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/agent/visa/application-a");
  });

  it("opens external visa detail from the View action", () => {
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [group] });
    useAgentVisaApplicationsMock.mockReturnValue({ isPending: false, isError: false, data: [] });
    render(
      <MemoryRouter initialEntries={["/agent/visa"]}>
        <Routes>
          <Route
            path="/agent/visa"
            element={
              <>
                <AgentVisaTrackingPage principalId="portal-a" agentId="agent-a" agentName="JSA" />
                <LocationProbe />
              </>
            }
          />
          <Route path="/agent/visa/:identity" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Panduan 4 tahap" }));
    expect(screen.getByRole("heading", { name: "Alur proses visa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pengiriman dokumen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agreement hotel" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upload paspor ke Nusuk" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Visa issued" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "2 dari 4 tahap selesai" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lihat detail visa 480900308615" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/agent/visa/480900308615");
  });

  it("renders an external-friendly read-only detail without Ops actions", () => {
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [group] });
    useAgentVisaApplicationsMock.mockReturnValue({ isPending: false, isError: false, data: [application] });
    render(
      <MemoryRouter initialEntries={["/agent/visa/480900308615"]}>
        <Routes>
          <Route
            path="/agent/visa/:identity"
            element={<AgentVisaDetailPage principalId="portal-a" agentId="agent-a" agentName="JSA" />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "480900308615" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Agreement hotel Agreement disetujui/ }));
    expect(screen.getByText("Hotel Makkah", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Paspor")).toBeInTheDocument();
    expect(screen.getByText("Halaman identitas kurang jelas.", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Alur proses visa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Pengiriman dokumen/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Agreement hotel/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Upload paspor ke Nusuk/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Visa issued/ })).toBeInTheDocument();
    expect(screen.getByText("Agreement disetujui")).toBeInTheDocument();
    expect(screen.getByText("Data paspor tercatat")).toBeInTheDocument();
    expect(screen.getByText("Hanya lihat")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit Group/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete Group/i })).not.toBeInTheDocument();
  });

  it("distinguishes missing document records from a completed state", () => {
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [group] });
    useAgentVisaApplicationsMock.mockReturnValue({ isPending: false, isError: false, data: [] });
    render(
      <MemoryRouter initialEntries={["/agent/visa/480900308615"]}>
        <Routes>
          <Route
            path="/agent/visa/:identity"
            element={<AgentVisaDetailPage principalId="portal-a" agentId="agent-a" agentName="JSA" />}
          />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Pengiriman dokumen Belum tercatat/ }));
    expect(screen.getByText("Pengajuan dokumen belum tercatat.", { exact: false })).toBeVisible();
    expect(screen.queryByText("Terverifikasi")).not.toBeInTheDocument();
  });

  it("handles a long group identity and empty filter result", () => {
    const longGroup = {
      ...group,
      code: "GROUP-IDENTITY-WITH-A-VERY-LONG-CODE-2026-0000000001",
      name: "Nama group yang sangat panjang untuk memastikan teks tetap dapat dibaca pada layar sempit",
    };
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [longGroup] });
    useAgentVisaApplicationsMock.mockReturnValue({ isPending: false, isError: false, data: [] });
    render(
      <MemoryRouter initialEntries={["/agent/visa?q=tidak-ada"]}>
        <AgentVisaTrackingPage principalId="portal-a" agentId="agent-a" agentName="JSA" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Tidak ada pengajuan yang sesuai" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset filter" }));
    expect(screen.getByText(longGroup.code)).toBeInTheDocument();
  });

  it("uses the Nusuk number in the header, reveals a stage and preserves the filtered return URL", () => {
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [group] });
    useAgentVisaApplicationsMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: [{ ...application, nusukGroupNumber: "901700000100000001", nusukReferenceNumber: "INTERNAL-REF" }],
    });
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: `/agent/visa/${group.code}`, state: { from: "/agent/visa?q=JSA&status=attention" } },
        ]}
      >
        <Routes>
          <Route
            path="/agent/visa/:identity"
            element={<AgentVisaDetailPage principalId="portal-a" agentId="agent-a" agentName="JSA" />}
          />
          <Route path="/agent/visa" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("901700000100000001");
    expect(screen.queryByText(/Group number:|Referensi|INTERNAL-REF/)).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Empat tahap visa" }).querySelectorAll("button")).toHaveLength(4);
    const nusuk = screen.getByRole("button", { name: /^Upload paspor ke Nusuk Data paspor tercatat/ });
    expect(nusuk).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: /^Lihat tahap 3:/ }));
    expect(nusuk).toHaveAttribute("aria-expanded", "true");
    expect(nusuk).toHaveFocus();
    fireEvent.click(nusuk);
    expect(nusuk).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(screen.getByRole("button", { name: "Kembali ke Visa Tracking" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/agent/visa?q=JSA&status=attention");
  });

  it("renders an application without a group without fabricating group-only facts", () => {
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [] });
    useAgentVisaApplicationsMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: [{ ...application, groupId: null, group: null }],
    });
    render(
      <MemoryRouter initialEntries={[`/agent/visa/${application.applicationNumber}`]}>
        <Routes>
          <Route
            path="/agent/visa/:identity"
            element={<AgentVisaDetailPage principalId="portal-a" agentId="agent-a" agentName="JSA" />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(application.applicationNumber);
    expect(screen.getByText("Provider A")).toBeInTheDocument();
    expect(screen.getByText("Penerbangan berangkat belum tercatat.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Lihat detail perjalanan/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Raudhah|Tasreh/i)).not.toBeInTheDocument();
  });

  it("shows waived hotels as unnecessary rather than missing agreements", () => {
    useAgentGroupDataMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: [
        {
          ...group,
          visaSetup: {
            ...group.visaSetup!,
            makkahHotelWaived: true,
            madinahHotelWaived: true,
            makkahHotels: [],
            madinahHotels: [],
          },
        },
      ],
    });
    useAgentVisaApplicationsMock.mockReturnValue({ isPending: false, isError: false, data: [] });
    render(
      <MemoryRouter initialEntries={[`/agent/visa/${group.code}`]}>
        <Routes>
          <Route
            path="/agent/visa/:identity"
            element={<AgentVisaDetailPage principalId="portal-a" agentId="agent-a" agentName="JSA" />}
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /^Agreement hotel Hotel tidak diperlukan/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Agreement hotel Hotel tidak diperlukan/ }));
    expect(screen.getAllByText("Hotel tidak diperlukan sesuai pengaturan group.")).toHaveLength(2);
    expect(screen.queryByText("Belum ada hotel agreement yang tercatat.")).not.toBeInTheDocument();
  });
});
