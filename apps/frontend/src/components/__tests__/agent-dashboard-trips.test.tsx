import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../agent/pages/dashboard-page";
import { TripsPage } from "../../agent/pages/trips-page";
import type { Dashboard, GroupSummary } from "../../agent/data/contracts";

const { portalGetMock, getAllAgentGroupsMock } = vi.hoisted(() => ({
  portalGetMock: vi.fn(),
  getAllAgentGroupsMock: vi.fn(),
}));

vi.mock("../../agent/data/portal-query", () => ({
  portalGet: (...args: unknown[]) => portalGetMock(...args),
}));

vi.mock("../../agent/data/all-groups-query", () => ({
  getAllAgentGroups: (...args: unknown[]) => getAllAgentGroupsMock(...args),
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
  });

  it("renders server-authoritative Dashboard statistics without loading the group index", async () => {
    portalGetMock.mockResolvedValue(dashboard);
    renderPage(<DashboardPage principalId="portal-1" agentName="Agent A" />);

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("19")).toBeInTheDocument();
    expect(screen.getByText("721")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Buka Perjalanan/i })).toHaveAttribute("href", "/agent/groups");
    expect(screen.getByRole("link", { name: /Lihat Visa Tracking/i })).toHaveAttribute("href", "/agent/visa");
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
});
