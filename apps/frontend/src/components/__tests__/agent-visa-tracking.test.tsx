import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { GroupData } from "../../shared/app-domain";
import { AgentVisaDetailPage } from "../../agent/pages/visa-detail-page";
import { AgentVisaTrackingPage } from "../../agent/pages/visa-tracking-page";

const { useAgentGroupDataMock } = vi.hoisted(() => ({ useAgentGroupDataMock: vi.fn() }));

vi.mock("../../agent/data/use-agent-group-data", () => ({
  useAgentGroupData: (...args: unknown[]) => useAgentGroupDataMock(...args),
}));

vi.mock("../../pages/visa-tracking-page", () => ({
  VisaTrackingScreen: ({ onOpenDetail }: { onOpenDetail: (row: { groupCode: string }) => void }) => (
    <button type="button" onClick={() => onOpenDetail({ groupCode: "480900308615" })}>View</button>
  ),
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

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

describe("Portal Agent Visa Tracking", () => {
  it("opens external visa detail from the View action", () => {
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [group] });
    render(
      <MemoryRouter initialEntries={["/agent/visa"]}>
        <Routes>
          <Route path="/agent/visa" element={<><AgentVisaTrackingPage principalId="portal-a" agentId="agent-a" agentName="JSA" /><LocationProbe /></>} />
          <Route path="/agent/visa/:identity" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/agent/visa/480900308615");
  });

  it("renders an external-friendly read-only detail without Ops actions", () => {
    useAgentGroupDataMock.mockReturnValue({ isPending: false, isError: false, data: [group] });
    render(
      <MemoryRouter initialEntries={["/agent/visa/480900308615"]}>
        <Routes>
          <Route path="/agent/visa/:identity" element={<AgentVisaDetailPage principalId="portal-a" agentId="agent-a" agentName="JSA" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "480900308615" })).toBeInTheDocument();
    expect(screen.getByText("Hotel Makkah")).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit Group/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete Group/i })).not.toBeInTheDocument();
  });
});
