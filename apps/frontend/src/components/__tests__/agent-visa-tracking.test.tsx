import { fireEvent, render, screen } from "@testing-library/react";
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
  timeline: [{ date: "-", title: "-" }, { date: "-", title: "-" }],
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
    makkahHotels: [{
      id: "hotel-a",
      hotelName: "Hotel Makkah",
      agreementNumber: "AGR-001",
      pax: 11,
      status: "Approved",
      stayStartIso: "2026-08-03",
      stayEndIso: "2026-08-07",
    }],
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
  documents: [{
    id: "document-a",
    type: "PASSPORT",
    originalName: "passport-jamaah-dengan-nama-file-yang-sangat-panjang.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1200,
    status: "NEED_REVISION",
    reviewNote: "Halaman identitas kurang jelas.",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  }],
};

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("Portal Agent Visa Tracking", () => {
  it("opens external visa detail from the View action", () => {
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [group] });
    useAgentVisaApplicationsMock.mockReturnValue({ isPending: false, isError: false, data: [] });
    render(
      <MemoryRouter initialEntries={["/agent/visa"]}>
        <Routes>
          <Route path="/agent/visa" element={<><AgentVisaTrackingPage principalId="portal-a" agentId="agent-a" agentName="JSA" /><LocationProbe /></>} />
          <Route path="/agent/visa/:identity" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "Alur proses visa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pengiriman dokumen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agreement hotel" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upload paspor ke Nusuk" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Visa issued" })).toBeInTheDocument();
    expect(screen.getByText("2 dari 4 tahap selesai")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lihat detail visa 480900308615" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/agent/visa/480900308615");
  });

  it("renders an external-friendly read-only detail without Ops actions", () => {
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [group] });
    useAgentVisaApplicationsMock.mockReturnValue({ isPending: false, isError: false, data: [application] });
    render(
      <MemoryRouter initialEntries={["/agent/visa/480900308615"]}>
        <Routes>
          <Route path="/agent/visa/:identity" element={<AgentVisaDetailPage principalId="portal-a" agentId="agent-a" agentName="JSA" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "480900308615" })).toBeInTheDocument();
    expect(screen.getByText("Hotel Makkah", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Paspor")).toBeInTheDocument();
    expect(screen.getByText("Halaman identitas kurang jelas.", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alur proses visa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pengiriman dokumen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agreement hotel" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Upload paspor ke Nusuk" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Visa issued" })).toBeInTheDocument();
    expect(screen.getByText("Agreement disetujui")).toBeInTheDocument();
    expect(screen.getByText("Data paspor tercatat")).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit Group/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete Group/i })).not.toBeInTheDocument();
  });

  it("distinguishes missing document records from a completed state", () => {
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [group] });
    useAgentVisaApplicationsMock.mockReturnValue({ isPending: false, isError: false, data: [] });
    render(
      <MemoryRouter initialEntries={["/agent/visa/480900308615"]}>
        <Routes>
          <Route path="/agent/visa/:identity" element={<AgentVisaDetailPage principalId="portal-a" agentId="agent-a" agentName="JSA" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Pengajuan dokumen belum tercatat.", { exact: false })).toBeInTheDocument();
    expect(screen.queryByText("Terverifikasi")).not.toBeInTheDocument();
  });

  it("handles a long group identity and empty filter result", () => {
    const longGroup = { ...group, code: "GROUP-IDENTITY-WITH-A-VERY-LONG-CODE-2026-0000000001", name: "Nama group yang sangat panjang untuk memastikan teks tetap dapat dibaca pada layar sempit" };
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
});
