import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ChecklistScreen } from "../../pages/checklist-page";
import { useChecklistWorkspace } from "../../pages/checklist/hooks/use-checklist-workspace";
import { buildChecklistItemsFromGroups, type GroupData } from "../../shared/app-domain";
import { ThemeProvider } from "../../theme/theme-provider";

vi.mock("../../hooks/use-agents-backend", () => ({
  useAgentsQuery: () => ({
    data: [
      { id: "agent-a", name: "Agent A", status: "ACTIVE" },
      { id: "agent-b", name: "Agent B", status: "ACTIVE" },
    ],
  }),
}));
vi.mock("../../hooks/use-directory-backend", () => ({ useMuassasahQuery: () => ({ data: [] }) }));

function group(code: string, days = ["2026-10-31", "2026-11-01", "2026-11-02"], name = "Raudhah Family"): GroupData {
  return {
    id: code,
    code,
    name,
    agentId: "agent-a",
    status: "Active",
    tone: "active",
    pax: 40,
    packageName: "Umrah",
    durationDays: 9,
    notes: [],
    musyrif: { name: "-", phone: "-", avatar: "" },
    timeline: [
      { date: "-", title: "-" },
      { date: "-", title: "-" },
    ],
    nextActivity: { title: "-", date: "-", time: "-", icon: "schedule" },
    itinerary: days.map((date) => ({
      date: "-",
      year: "2026",
      isoDate: date,
      time: "09:00",
      category: "Transfer",
      categoryKey: "transfer",
      title: "Makkah to Madinah",
      from: "Makkah",
      to: "Madinah",
      meta: "",
      icon: "directions_bus",
      requiresBus: true,
      busCount: 1,
    })),
  };
}

function readyGroup(code: string, date: string) {
  const data = group(code, [date]);
  const item = buildChecklistItemsFromGroups([data])[0];
  data.checklistAssignments = [
    {
      id: `assignment-${code}`,
      tripDate: item.tripDate,
      activity: item.activity,
      tripLabel: item.trip,
      scheduledTime: item.scheduledTime,
      requiredBusCount: 1,
      transferByTrain: false,
      trainDepartureTime: "",
      stationPickupTime: "",
      status: "Assigned",
      drivers: [{ name: "Ahmed", phone: "+966123", plateNumber: "ABC-123", isVerified: true }],
    },
  ];
  return data;
}

const wrapper = ({ children }: { children: ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

describe("H-1 checklist filters", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("filters all three days across a month boundary and keeps counts scoped to search and agent", () => {
    const a = group("A");
    const b = { ...group("B", ["2026-11-01"], "Berkah Madinah"), agentId: "agent-b" };
    const groups = [a, b];
    const { result } = renderHook(() => useChecklistWorkspace({ groups }));
    expect(result.current.dayFilterOptions.map((option) => option.count)).toEqual([4, 1, 2, 1]);
    act(() => result.current.setDayFilter("tomorrow"));
    expect(result.current.searchedChecklistItems.map((item) => item.groupCode)).toEqual(["A", "B"]);
    act(() => result.current.setAgentFilter("agent-a"));
    expect(result.current.dayFilterOptions.map((option) => option.count)).toEqual([3, 1, 1, 1]);
    act(() => result.current.setDayFilter("day-after-tomorrow"));
    expect(result.current.searchedChecklistItems[0].tripDate).toBe("2026-11-02");
    act(() => result.current.setDayFilter("today"));
    expect(result.current.searchedChecklistItems[0].tripDate).toBe("2026-10-31");
    act(() => result.current.setGroupCodeQuery("  RAUDHAH  "));
    expect(result.current.searchedChecklistItems).toHaveLength(1);
    act(() => result.current.setGroupCodeQuery("Berkah"));
    expect(result.current.searchedChecklistItems).toHaveLength(0);
    expect(result.current.isClear).toBe(false);
  });

  it("finds a shared trip by a linked child's name or number", () => {
    const parent = group("PARENT", ["2026-10-31"], "Parent Group");
    const child = { ...group("CHILD", [], "Al Haramain"), parentGroupId: "PARENT" };
    const groups = [parent, child];
    const { result } = renderHook(() => useChecklistWorkspace({ groups }));
    expect(result.current.checklistItems).toHaveLength(1);
    act(() => result.current.setGroupCodeQuery("haramain"));
    expect(result.current.searchedChecklistItems[0].groupCodes).toEqual(["PARENT", "CHILD"]);
    act(() => result.current.setGroupCodeQuery("child"));
    expect(result.current.searchedChecklistItems).toHaveLength(1);
  });

  it("resets both group pagination sections when the day changes", () => {
    const groups = [
      ...Array.from({ length: 7 }, (_, i) => group(`P-${i}`, ["2026-10-31"])),
      ...Array.from({ length: 7 }, (_, i) => readyGroup(`C-${i}`, "2026-10-31")),
      group("TOMORROW", ["2026-11-01"]),
    ];
    const { result } = renderHook(() => useChecklistWorkspace({ groups }));
    act(() => {
      result.current.setPendingPage(2);
      result.current.setCompletedPage(2);
    });
    expect(result.current.paginatedPendingGroups).toHaveLength(2);
    expect(result.current.paginatedCompletedGroups).toHaveLength(1);
    act(() => result.current.setDayFilter("tomorrow"));
    expect(result.current.pendingPage).toBe(1);
    expect(result.current.completedPage).toBe(1);
    expect(result.current.paginatedPendingGroups[0].groupCode).toBe("TOMORROW");
  });

  it("shows trip cards and driver controls directly, filters completed trips, and resets a no-results search", () => {
    render(<ChecklistScreen groups={[group("901"), readyGroup("902", "2026-11-01")]} />, { wrapper });
    const attention = screen.getByRole("region", { name: "Need Attention" });
    expect(within(attention).getAllByRole("article")).toHaveLength(3);
    const driverInputs = within(attention).getAllByRole("textbox", { name: "Driver Name" });
    expect(driverInputs).toHaveLength(3);
    driverInputs.forEach((input) => expect(input).toBeVisible());
    expect(within(attention).getAllByRole("button", { name: "Confirm Assignment" })).toHaveLength(3);
    const completed = screen.getByRole("region", { name: "Completed" });
    expect(within(completed).getByText("Ahmed")).toBeVisible();
    expect(within(completed).getByRole("button", { name: "Cancel" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^Today/ }));
    expect(within(attention).getAllByRole("article")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Completed" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Tomorrow/ }));
    expect(screen.getByRole("region", { name: "Completed" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Find a group" }), { target: { value: "unknown" } });
    expect(screen.getByText("No trips match your filters")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Clear" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(screen.getByRole("button", { name: /^All Days/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("region", { name: "Completed" })).toBeInTheDocument();
  });

  it("keeps driver drafts while changing the day", () => {
    const groups = [group("A")];
    const { result } = renderHook(() => useChecklistWorkspace({ groups }));
    const itemId = result.current.checklistItems[0].id;
    act(() => result.current.handleDraftChange(itemId, "name", "Draft Driver"));
    act(() => result.current.setDayFilter("tomorrow"));
    act(() => result.current.setDayFilter("today"));
    expect(result.current.driverDrafts[itemId].name).toBe("Draft Driver");
  });

  it("shows loading and retry states without presenting missing data as an empty schedule", () => {
    const refetch = vi.fn();
    const { rerender } = render(<ChecklistScreen groups={[]} dataState={{ isPending: true }} />, { wrapper });
    expect(screen.getByText("Loading checklist…")).toBeInTheDocument();
    expect(screen.queryByText("No upcoming trips in the next 3 days")).not.toBeInTheDocument();
    rerender(<ChecklistScreen groups={[]} dataState={{ isError: true, refetch }} />);
    expect(screen.getByText("Checklist unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("No upcoming trips in the next 3 days")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
});
