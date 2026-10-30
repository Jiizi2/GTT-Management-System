import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useDashboardGroupRecords } from "../../hooks/app-controller/use-dashboard-group-records";
import { groupQueryKeys } from "../../shared/query-keys";
import type { GroupData } from "../../shared/app-domain";

const { fetchGroups } = vi.hoisted(() => ({ fetchGroups: vi.fn() }));
vi.mock("../../hooks/groups-backend-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../hooks/groups-backend-api")>()),
  fetchGroupsFromBackend: fetchGroups,
}));

const group: GroupData = {
  id: "g",
  code: "GROUP-001",
  name: "Group tersimpan",
  status: "Active",
  tone: "active",
  pax: 20,
  packageName: "Umrah",
  durationDays: 7,
  arrivalDate: "2026-10-30",
  returnDate: "2026-11-05",
  timeline: [
    { date: "-", title: "-" },
    { date: "-", title: "-" },
  ],
  nextActivity: { title: "-", date: "-", time: "-", icon: "schedule" },
  itinerary: [],
  notes: [],
  musyrif: { name: "-", phone: "-", avatar: "" },
};
const options = {
  activeNav: "overview" as const,
  query: "",
  isActiveOnly: false,
  overviewMonthFilter: "all",
  selectedGroupCode: null,
  selectedVisaGroupCode: null,
  allowLocalFallback: false,
  showSyncFeedback: vi.fn(),
  clearQuery: vi.fn(),
  navigateToOverview: vi.fn(),
  navigateToGroupDetail: vi.fn(),
  navigateToVisaTracking: vi.fn(),
  navigateToVisaDetail: vi.fn(),
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("Admin group loading state", () => {
  it("distinguishes initial loading from a successful empty result", async () => {
    let resolve!: (groups: GroupData[]) => void;
    fetchGroups.mockReturnValueOnce(
      new Promise<GroupData[]>((res) => {
        resolve = res;
      }),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useDashboardGroupRecords(options), { wrapper });
    expect(result.current.isGroupRecordsLoading).toBe(true);
    expect(result.current.groupDataState.data).toBeUndefined();
    await act(async () => resolve([]));
    await waitFor(() => expect(result.current.groupDataState.data).toEqual([]));
    expect(result.current.isGroupRecordsLoading).toBe(false);
  });

  it("preserves cached groups and query error state after refresh failure", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(groupQueryKeys.list("summary", false), [group]);
    fetchGroups.mockRejectedValueOnce(new Error("Backend offline"));
    const { result } = renderHook(() => useDashboardGroupRecords(options), { wrapper });
    expect(result.current.groupRecords).toEqual([group]);
    expect(result.current.isGroupRecordsLoading).toBe(false);
    await act(async () => {
      await result.current.groupDataState.refetch();
    });
    await waitFor(() => expect(result.current.groupDataState.isError).toBe(true));
    expect(result.current.groupRecords).toEqual([group]);
    expect(client.getQueryData(groupQueryKeys.list("summary", false))).toEqual([group]);
    expect(client.getQueryState(groupQueryKeys.list("summary", false))?.status).toBe("error");
  });

  it("ends initial loading on failure without inserting a fake empty success", async () => {
    const { client, wrapper } = setup();
    fetchGroups.mockRejectedValueOnce(new Error("Timeout"));
    const { result } = renderHook(() => useDashboardGroupRecords(options), { wrapper });
    await waitFor(() => expect(result.current.groupDataState.isError).toBe(true));
    expect(result.current.isGroupRecordsLoading).toBe(false);
    expect(result.current.groupDataState.data).toBeUndefined();
    expect(client.getQueryData(groupQueryKeys.list("summary", false))).toBeUndefined();
  });
});
