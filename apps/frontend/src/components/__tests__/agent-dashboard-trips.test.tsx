import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../agent/pages/dashboard-page";
import { getItineraryFocusStates, GroupDetailPage } from "../../agent/pages/group-detail-page";
import { TripsPage } from "../../agent/pages/trips-page";
import type { Dashboard, GroupSummary, TransportationItem } from "../../agent/data/contracts";
import type { GroupData } from "../../shared/app-domain";

const { portalGetMock, getAllAgentGroupsMock, useAgentTripDetailMock } = vi.hoisted(() => ({
  portalGetMock: vi.fn(),
  getAllAgentGroupsMock: vi.fn(),
  useAgentTripDetailMock: vi.fn(),
}));

vi.mock("../../agent/data/portal-query", () => ({
  portalGet: (...args: unknown[]) => portalGetMock(...args),
}));

vi.mock("../../agent/data/all-groups-query", () => ({
  getAllAgentGroups: (...args: unknown[]) => getAllAgentGroupsMock(...args),
}));

vi.mock("../../agent/data/use-agent-trip-detail", () => ({
  useAgentTripDetail: (...args: unknown[]) => useAgentTripDetailMock(...args),
}));

const dashboard: Dashboard = {
  groups: { total: 19, active: 12, completed: 4, archived: 1, upcoming: 2, totalPax: 721 },
  attention: { visaGroups: 3, hotelGroups: 2 },
  upcomingGroups: [],
  recentTimeline: [],
};

function group(index: number): GroupSummary {
  return {
    id: `group-${index}`,
    code: `GTT-${String(index).padStart(3, "0")}`,
    name: `Perjalanan Umrah ${index}`,
    lifecycleStatus: index % 2 === 0 ? "ACTIVE" : "ENTRY_ONLY",
    arrivalDate: `2026-${index < 10 ? "10" : "11"}-${String((index % 20) + 1).padStart(2, "0")}`,
    returnDate: `2026-${index < 10 ? "10" : "11"}-${String((index % 20) + 2).padStart(2, "0")}`,
    pax: 30 + index,
    packageName: "Paket Umrah",
    totalBuses: 1,
    musyrif: null,
    notes: [],
    itinerary:
      index === 1
        ? []
        : [
            {
              id: `item-${index}`,
              sortOrder: 1,
              dateLabel: "10 Okt",
              yearLabel: "2026",
              category: "FLIGHT",
              title: "Penerbangan menuju Jeddah",
              isoDate: "2026-10-10",
              time: "08:00",
              flightNumber: "GA-001",
              hotelName: null,
              fromHotelName: null,
              fromLocation: "Jakarta",
              toLocation: "Jeddah",
              cityTourCity: null,
              requiresBus: true,
              transferByTrain: false,
              trainDepartureTime: null,
              destinationPickupTime: null,
              hotelPickupRequestTime: null,
            },
          ],
  };
}

function detailGroup(overrides: Partial<GroupData> = {}): GroupData {
  return {
    id: "group-2",
    agentId: "agent-1",
    code: "GTT-002",
    name: "Perjalanan Umrah 2",
    status: "ACTIVE",
    lifecycleStatus: "ACTIVE",
    tone: "active",
    pax: 32,
    totalBuses: 1,
    packageName: "Paket Umrah",
    durationDays: 9,
    arrivalDate: "2026-10-10",
    returnDate: "2026-10-18",
    timeline: [
      { date: "10 Okt", title: "Penerbangan menuju Jeddah", isCurrent: true },
      { date: "11 Okt", title: "Check-in hotel" },
    ],
    nextActivity: { title: "Penerbangan menuju Jeddah", date: "10 Okt", time: "08:00", icon: "flight" },
    itinerary: [{
      date: "10 Okt",
      year: "2026",
      category: "Penerbangan",
      title: "Penerbangan menuju Jeddah",
      meta: "08:00 | Jakarta → Jeddah",
      icon: "flight",
      isoDate: "2026-10-10",
      time: "08:00",
      flightNumber: "GA-001",
      from: "Jakarta",
      to: "Jeddah",
      requiresBus: true,
    }],
    notes: ["Pastikan jamaah berkumpul tiga jam sebelum keberangkatan."],
    musyrif: { name: "Ustadz Ahmad", phone: "+628123456789", avatar: "" },
    visaSetup: {
      visaStatus: "Pending",
      syarikah: "Provider A",
      busStatus: "Visa+",
      paymentStatus: "Partial",
      makkahHotels: [{ id: "hotel-1", hotelName: "Hotel Makkah", agreementNumber: "AGR-001", pax: 32, status: "Approved", stayStartIso: "2026-10-11", stayEndIso: "2026-10-14" }],
      madinahHotels: [],
      raudhahAppointments: [],
    },
    ...overrides,
  };
}

const transportation: TransportationItem[] = [{
  id: "transport-1",
  tripDate: "2026-10-10",
  activity: "Penerbangan",
  tripLabel: "Penerbangan menuju Jeddah",
  requiredBusCount: 1,
  scheduledTime: "12:00",
  transferByTrain: false,
  trainDepartureTime: null,
  stationPickupTime: null,
  status: "ASSIGNED",
  assignedDriverCount: 1,
  verifiedDriverCount: 1,
}];

function renderPage(node: React.ReactNode, initialEntry = "/agent/overview") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <span data-testid="location">
      {location.pathname}
      {location.search}
    </span>
  );
}

describe("Agent Dashboard and Perjalanan", () => {
  beforeEach(() => {
    portalGetMock.mockReset();
    getAllAgentGroupsMock.mockReset();
    useAgentTripDetailMock.mockReset();
  });

  it("renders server-authoritative Dashboard statistics without loading the group index", async () => {
    portalGetMock.mockResolvedValue(dashboard);
    renderPage(<DashboardPage principalId="portal-1" agentName="Agent A" />);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("19")).toBeInTheDocument();
    expect(screen.getByText("721")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "5 catatan perhatian" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Perhatian visa/i })).toHaveAttribute("href", "/agent/visa");
    expect(screen.getByRole("link", { name: /Perhatian hotel/i })).toHaveAttribute("href", "/agent/groups");
    expect(screen.getByRole("link", { name: /Buka Perjalanan/i })).toHaveAttribute("href", "/agent/groups");
    expect(screen.getByRole("link", { name: /Lihat Visa Tracking/i })).toHaveAttribute("href", "/agent/visa");
    expect(screen.getByRole("heading", { name: "Jadwal berikutnya belum tersedia" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Belum ada aktivitas itinerary" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Lihat Perjalanan" })).toHaveLength(2);
    expect(portalGetMock).toHaveBeenCalledTimes(1);
    expect(portalGetMock.mock.calls[0]?.[1]).toBe("/dashboard");
    expect(getAllAgentGroupsMock).not.toHaveBeenCalled();
  });

  it("renders and paginates the maximum observed 19-group Perjalanan scenario", async () => {
    getAllAgentGroupsMock.mockResolvedValue(Array.from({ length: 19 }, (_, index) => group(index + 1)));
    renderPage(<TripsPage principalId="portal-1" />, "/agent/groups");

    expect(await screen.findByRole("heading", { name: "Perjalanan" })).toBeInTheDocument();
    expect(
      screen.getByText((_, element) => element?.textContent === "19 perjalanan ditemukan", { selector: "p" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("19 perjalanan, 9 aktif, 760 jamaah")).toBeInTheDocument();
    expect(screen.getByText("19 group perjalanan")).toBeInTheDocument();
    expect(screen.getAllByText("Musyrif")).toHaveLength(6);
    expect(screen.getAllByText("Belum ditugaskan")).toHaveLength(6);
    expect(screen.getAllByRole("button", { name: /Lihat itinerary/i })).toHaveLength(6);
    expect(screen.getByRole("navigation", { name: "perjalanan pagination" })).toBeInTheDocument();
  });

  it("distinguishes an empty filter result from an account with no assigned groups", async () => {
    getAllAgentGroupsMock.mockResolvedValueOnce([group(1)]);
    const first = renderPage(<TripsPage principalId="portal-1" />, "/agent/groups");
    await screen.findByText("GTT-001");
    fireEvent.change(screen.getByPlaceholderText("Kode atau nama group"), { target: { value: "tidak-ada" } });
    expect(await screen.findByRole("heading", { name: "Tidak ada perjalanan yang sesuai" })).toBeInTheDocument();
    first.unmount();

    getAllAgentGroupsMock.mockResolvedValueOnce([]);
    renderPage(<TripsPage principalId="portal-2" />, "/agent/groups");
    expect(await screen.findByRole("heading", { name: "Belum ada perjalanan yang ditugaskan" })).toBeInTheDocument();
  });

  it("opens Group Detail while retaining the current Perjalanan filter URL", async () => {
    getAllAgentGroupsMock.mockResolvedValue([group(2)]);
    renderPage(
      <Routes>
        <Route
          path="/agent/groups"
          element={
            <>
              <TripsPage principalId="portal-1" />
              <LocationProbe />
            </>
          }
        />
        <Route path="/agent/groups/:identity" element={<LocationProbe />} />
      </Routes>,
      "/agent/groups?active=1",
    );

    fireEvent.click(await screen.findByRole("button", { name: "Lihat itinerary" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/agent/groups/GTT-002");
  });

  it("presents complete trip evidence in an Agent-specific read-only sequence", () => {
    useAgentTripDetailMock.mockReturnValue({ isPending: false, isError: false, data: { group: detailGroup(), transportation } });
    renderPage(
      <Routes>
        <Route path="/agent/groups/:identity" element={<GroupDetailPage principalId="portal-1" agentId="agent-1" agentName="Agent A" />} />
      </Routes>,
      "/agent/groups/GTT-002",
    );

    expect(screen.getByRole("heading", { name: "GTT-002" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ringkasan perjalanan" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Aktivitas berikutnya" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Kronologi itinerary" })).toBeInTheDocument();
    expect(screen.getByText("Musyrif perjalanan")).toBeInTheDocument();
    expect(screen.getByText("1 aktivitas")).toBeInTheDocument();
    expect(screen.getByText("Terverifikasi")).toBeInTheDocument();
    expect(screen.getAllByText("1/1 driver terverifikasi")).toHaveLength(2);
    expect(screen.getAllByText("Driver")).toHaveLength(2);
    expect(screen.getAllByText("Plat")).toHaveLength(2);
    expect(screen.getAllByText("Telepon")).toHaveLength(2);
    expect(screen.getAllByText("—")).toHaveLength(6);
    expect(screen.getByText("Detail pengemudi")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Kesiapan transportasi dan H-1" })).not.toBeInTheDocument();
    expect(screen.getByText("Hotel Makkah", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Pastikan jamaah berkumpul tiga jam sebelum keberangkatan.")).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit|Delete|Save/i })).not.toBeInTheDocument();
  });

  it("highlights today's itinerary before falling back to the next schedule", () => {
    const items = detailGroup().itinerary;
    expect(getItineraryFocusStates(items, new Date("2026-10-10T01:00:00.000Z"))).toEqual(["today"]);
    expect(getItineraryFocusStates(items, new Date("2026-10-09T01:00:00.000Z"))).toEqual(["next"]);
    expect(getItineraryFocusStates(items, new Date("2026-10-11T01:00:00.000Z"))).toEqual([null]);
  });

  it("keeps missing itinerary, hotel, and notes visibly incomplete", () => {
    useAgentTripDetailMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        group: detailGroup({
          itinerary: [],
          notes: [],
          nextActivity: { title: "Belum ada aktivitas", date: "-", time: "-", icon: "schedule" },
          visaSetup: { visaStatus: "Draft", syarikah: "", paymentStatus: "Unpaid", makkahHotels: [], madinahHotels: [], raudhahAppointments: [] },
        }),
        transportation: [],
      },
    });
    renderPage(
      <Routes>
        <Route path="/agent/groups/:identity" element={<GroupDetailPage principalId="portal-1" agentId="agent-1" agentName="Agent A" />} />
      </Routes>,
      "/agent/groups/GTT-002",
    );

    expect(screen.getByText("Itinerary belum dicatat untuk perjalanan ini.")).toBeInTheDocument();
    expect(screen.getAllByText("Hotel agreement belum dicatat.")).toHaveLength(2);
    expect(screen.getByText("Belum ada catatan pendukung untuk perjalanan ini.")).toBeInTheDocument();
    expect(screen.queryByText("Informasi pengemudi")).not.toBeInTheDocument();
  });

  it("reserves driver, plate, and phone columns on bus itinerary without an assignment", () => {
    useAgentTripDetailMock.mockReturnValue({ isPending: false, isError: false, data: { group: detailGroup(), transportation: [] } });
    renderPage(
      <Routes>
        <Route path="/agent/groups/:identity" element={<GroupDetailPage principalId="portal-1" agentId="agent-1" agentName="Agent A" />} />
      </Routes>,
      "/agent/groups/GTT-002",
    );
    expect(screen.getByText("Belum ditugaskan", { selector: "span" })).toBeInTheDocument();
    expect(screen.getAllByText("Driver")).toHaveLength(2);
    expect(screen.getAllByText("Plat")).toHaveLength(2);
    expect(screen.getAllByText("Telepon")).toHaveLength(2);
  });
});
