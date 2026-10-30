import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { DataBoundary } from "../data-boundary";
import { ListSkeleton } from "../skeleton";
import { DashboardPage } from "../../agent/pages/dashboard-page";
import { GroupDetailPage } from "../../agent/pages/group-detail-page";
import type { Dashboard, GroupDetail } from "../../agent/data/contracts";

const { portalGet, getAllAgentGroups } = vi.hoisted(() => ({
  portalGet: vi.fn(),
  getAllAgentGroups: vi.fn(),
}));
vi.mock("../../agent/data/portal-query", () => ({ portalGet }));
vi.mock("../../agent/data/all-groups-query", () => ({ getAllAgentGroups }));

function deferred<T>() {
  let resolve!: (data: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderPage(ui: ReactNode, route = "/agent/overview") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return { ...render(ui, { wrapper }), client };
}

function DataView({
  filter,
  fetchRows,
}: {
  filter: string;
  fetchRows: (filter: string, signal: AbortSignal) => Promise<string[]>;
}) {
  const query = useQuery({
    queryKey: ["loading-regression", filter],
    queryFn: ({ signal }) => fetchRows(filter, signal),
  });
  return (
    <>
      <h1>Daftar</h1>
      <button onClick={() => void query.refetch()}>Refresh</button>
      <DataBoundary query={query} skeleton={<ListSkeleton label="Memuat daftar uji" />}>
        {query.data?.length ? (
          <ul>
            {query.data.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        ) : (
          <p>Daftar kosong</p>
        )}
      </DataBoundary>
    </>
  );
}

describe("loading lifecycle", () => {
  beforeEach(() => {
    portalGet.mockReset();
    getAllAgentGroups.mockReset();
  });

  it("shows real pending work, an empty result, then cached content throughout refresh failure and retry", async () => {
    const initial = deferred<string[]>();
    const refresh = deferred<string[]>();
    const fetchRows = vi
      .fn()
      .mockReturnValueOnce(initial.promise)
      .mockResolvedValueOnce(["Data tersimpan"])
      .mockReturnValueOnce(refresh.promise)
      .mockResolvedValueOnce(["Data terbaru"]);
    renderPage(<DataView filter="all" fetchRows={fetchRows} />);
    expect(screen.getByRole("heading", { name: "Daftar" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Memuat daftar uji" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Daftar kosong")).not.toBeInTheDocument();
    await act(async () => initial.resolve([]));
    expect(await screen.findByText("Daftar kosong")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Memuat daftar uji" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Data tersimpan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("Memperbarui data…")).toBeInTheDocument();
    expect(screen.getByText("Data tersimpan")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Memuat daftar uji" })).not.toBeInTheDocument();
    await act(async () => refresh.reject(new Error("Network timeout")));
    expect(await screen.findByText(/Gagal memperbarui/)).toBeInTheDocument();
    expect(screen.getByText("Data tersimpan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(await screen.findByText("Data terbaru")).toBeInTheDocument();
    expect(fetchRows).toHaveBeenCalledTimes(4);
  });

  it("stops skeletons after an initial timeout and offers retry", async () => {
    const request = deferred<string[]>();
    renderPage(<DataView filter="all" fetchRows={vi.fn().mockReturnValue(request.promise)} />);
    await act(async () => request.reject(new Error("Timeout")));
    expect(await screen.findByRole("alert")).toHaveTextContent("Data belum dapat dimuat");
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Memuat daftar uji" })).not.toBeInTheDocument();
    expect(screen.queryByText("Daftar kosong")).not.toBeInTheDocument();
  });

  it("does not label old results as a new filter, ignores late responses, and cancels on unmount", async () => {
    const first = deferred<string[]>();
    const second = deferred<string[]>();
    const third = deferred<string[]>();
    const signals: AbortSignal[] = [];
    const fetchRows = vi.fn((filter: string, signal: AbortSignal) => {
      signals.push(signal);
      return filter === "a" ? first.promise : filter === "b" ? second.promise : third.promise;
    });
    const view = renderPage(<DataView filter="a" fetchRows={fetchRows} />);
    view.rerender(<DataView filter="b" fetchRows={fetchRows} />);
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => second.resolve(["Hasil B"]));
    expect(await screen.findByText("Hasil B")).toBeInTheDocument();
    await act(async () => first.resolve(["Hasil A terlambat"]));
    expect(screen.queryByText("Hasil A terlambat")).not.toBeInTheDocument();
    view.rerender(<DataView filter="c" fetchRows={fetchRows} />);
    expect(screen.queryByText("Hasil B")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Memuat daftar uji" })).toBeInTheDocument();
    view.unmount();
    expect(signals[2]?.aborted).toBe(true);
    expect(fetchRows).toHaveBeenCalledTimes(3);
  });

  it("renders the calendar independently while dashboard totals are pending or failed", async () => {
    const totals = deferred<Dashboard>();
    portalGet.mockReturnValue(totals.promise);
    getAllAgentGroups.mockResolvedValue([]);
    renderPage(<DashboardPage principalId="p" agentName="Agent" />);
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bulan berikutnya" })).toBeEnabled();
    expect(await screen.findByRole("table", { name: /Kalender keberangkatan/ })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Memuat ringkasan…" })).toBeInTheDocument();
    await act(async () => totals.reject(new Error("Dashboard unavailable")));
    expect(screen.getByRole("table", { name: /Kalender keberangkatan/ })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Memuat ringkasan…" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(getAllAgentGroups).toHaveBeenCalledTimes(1);
    expect(portalGet).toHaveBeenCalledTimes(1);
  });

  it("renders identity, hotels, visa and drivers separately on trip details", async () => {
    const visa = deferred<unknown>();
    const hotels = deferred<unknown>();
    const transport = deferred<unknown>();
    const group: GroupDetail = {
      id: "g",
      code: "GROUP-001",
      name: "Perjalanan uji",
      lifecycleStatus: "ACTIVE",
      arrivalDate: "2026-10-30",
      returnDate: "2026-11-05",
      pax: 20,
      packageName: "Umrah",
      totalBuses: 1,
      durationDays: 7,
      musyrif: null,
      notes: [],
      itinerary: [
        {
          id: "i",
          sortOrder: 0,
          dateLabel: "30 Okt",
          yearLabel: "2026",
          category: "Arrival",
          title: "Jeddah ke Makkah",
          isoDate: "2026-10-30",
          time: "10:00",
          flightNumber: null,
          hotelName: null,
          fromHotelName: null,
          fromLocation: "Jeddah",
          toLocation: "Makkah",
          cityTourCity: null,
          requiresBus: true,
          transferByTrain: false,
          trainDepartureTime: null,
          destinationPickupTime: null,
          hotelPickupRequestTime: null,
        },
      ],
    };
    portalGet.mockImplementation((_client, path: string) =>
      path.endsWith("/visa")
        ? visa.promise
        : path.endsWith("/hotel-agreements")
          ? hotels.promise
          : path.endsWith("/transportation")
            ? transport.promise
            : Promise.resolve(group),
    );
    renderPage(
      <Routes>
        <Route
          path="/agent/groups/:identity"
          element={<GroupDetailPage principalId="p" agentId="a" agentName="Agent" />}
        />
      </Routes>,
      "/agent/groups/GROUP-001",
    );
    expect(await screen.findByRole("heading", { name: "GROUP-001" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unduh itinerary PDF" })).toBeDisabled();
    expect(screen.getByRole("status", { name: "Memuat visa…" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Memuat driver dan armada…" })).toBeInTheDocument();
    await act(async () =>
      hotels.resolve([
        {
          id: "h",
          city: "MAKKAH",
          hotelName: "Hotel siap lebih dulu",
          agreementNumber: "AGR",
          pax: 20,
          status: "APPROVED",
          stayStart: null,
          stayEnd: null,
        },
      ]),
    );
    expect(await screen.findByText("Hotel siap lebih dulu")).toBeInTheDocument();
    await act(async () => visa.reject(new Error("Visa timeout")));
    expect(screen.getByText("Hotel siap lebih dulu")).toBeInTheDocument();
    expect(await within(screen.getByRole("region", { name: "Visa dan hotel" })).findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unduh itinerary PDF" })).toBeDisabled();
    await act(async () => transport.resolve([]));
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Memuat driver dan armada…" })).not.toBeInTheDocument(),
    );
    expect(portalGet).toHaveBeenCalledTimes(4);
  });
});
