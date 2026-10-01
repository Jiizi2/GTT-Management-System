import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GroupData } from "../../shared/app-domain";
import { GroupItineraryBuilderPage } from "../../pages/group-itinerary-builder-page";

vi.mock("../../pages/add-group-workspace-page", () => ({
  InputItineraryScreen: ({ onSaveGroup }: { onSaveGroup: (group: GroupData) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSaveGroup({
          ...group,
          itinerary: [
            {
              date: "3 Oct",
              year: "2026",
              category: "Arrival",
              title: "Jeddah to Makkah",
              meta: "08:00",
              icon: "flight_land",
            },
          ],
          notes: ["Generated itinerary note"],
        })
      }
    >
      Save itinerary draft
    </button>
  ),
}));

vi.mock("../../components/theme-toggle-button", () => ({
  ThemeToggleButton: () => <button type="button">Theme</button>,
}));

const group: GroupData = {
  code: "9017000001",
  name: "Dummy Trip Lengkap",
  status: "Active",
  tone: "active",
  pax: 45,
  totalBuses: 1,
  packageName: "Umrah Plus Package",
  durationDays: 6,
  arrivalDate: "2026-10-03",
  returnDate: "2026-10-08",
  timeline: [
    { date: "3 Oct", title: "Arrival" },
    { date: "8 Oct", title: "Departure" },
  ],
  nextActivity: { title: "Arrival", date: "3 Oct", time: "08:00", icon: "flight_land" },
  itinerary: [],
  notes: ["Existing group note"],
  musyrif: { name: "Ust. Ahmad", phone: "+628123456789", avatar: "" },
};

describe("GroupItineraryBuilderPage", () => {
  it("shows one page heading and one route back to group detail", () => {
    const onBack = vi.fn();
    render(
      <GroupItineraryBuilderPage group={group} onBack={onBack} onSaveGroup={vi.fn(() => ({ ok: true as const }))} />,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "Itinerary Builder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Group Detail" })).toBeInTheDocument();
    expect(screen.queryByText("Itinerary Workspace")).not.toBeInTheDocument();
    expect(screen.queryByText("No Agreement Prefill")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Group Detail" }));
    expect(onBack).toHaveBeenCalledWith(group.code);
  });

  it("saves itinerary changes without replacing existing group notes", () => {
    const onSaveGroup = vi.fn(() => ({ ok: true }) as const);
    render(<GroupItineraryBuilderPage group={group} onBack={vi.fn()} onSaveGroup={onSaveGroup} />);

    fireEvent.click(screen.getByRole("button", { name: "Save itinerary draft" }));

    expect(onSaveGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: ["Existing group note"],
        itinerary: [expect.objectContaining({ title: "Jeddah to Makkah" })],
      }),
      group.code,
    );
  });
});
