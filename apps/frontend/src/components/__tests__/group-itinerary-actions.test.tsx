import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useGroupDetailDashboard } from "../../pages/group-detail/hooks/use-group-detail-dashboard";
import type { GroupData, ItineraryItem } from "../../shared/app-domain";

function trip(date: string, title: string): ItineraryItem {
  return {
    date: date.slice(-2),
    year: "2026",
    isoDate: date,
    category: "arrival",
    title,
    from: "Jeddah",
    to: "Makkah",
    time: "09:00",
    hotelName: "Hotel Makkah",
    meta: "09:00",
    icon: "flight_land",
    highlighted: false,
  };
}

describe("itinerary actions after data updates", () => {
  it("edits and deletes the current itinerary after rows have changed position", () => {
    const group: GroupData = {
      id: "group",
      code: "GROUP",
      name: "Group jamaah",
      status: "active",
      lifecycleStatus: "ACTIVE",
      tone: "active",
      pax: 30,
      totalBuses: 1,
      packageName: "Umrah",
      durationDays: 12,
      arrivalDate: "2026-10-30",
      returnDate: "2026-11-10",
      itinerary: [trip("2026-10-30", "Arrival awal"), trip("2026-10-31", "Arrival berikutnya")],
      musyrif: { name: "Ahmad", phone: "1234", avatar: "" },
      notes: [],
      timeline: [
        { date: "30 Okt", title: "Arrival" },
        { date: "10 Nov", title: "Return" },
      ],
      checklistAssignments: [],
      nextActivity: { title: "Arrival", date: "2026-10-30", time: "09:00", icon: "flight_land" },
    };
    const onSaveGroup = vi.fn(() => ({ ok: true as const }));
    const { result, rerender } = renderHook(
      ({ value }) =>
        useGroupDetailDashboard({
          group: value,
          groups: [],
          onBack: vi.fn(),
          onDeleteGroup: vi.fn(),
          onSaveGroup,
          onPatchGroup: vi.fn(() => ({ ok: true as const })),
        }),
      {
        initialProps: { value: group },
        wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>,
      },
    );

    const updatedGroup = { ...group, itinerary: [trip("2026-10-29", "Arrival tambahan"), ...group.itinerary] };
    rerender({ value: updatedGroup });
    act(() => result.current.handleOpenEditModal(1));
    expect(result.current.editScheduleForm?.date).toBe("2026-10-30");
    act(() => result.current.handleEditFieldChange("notes", "Catatan terbaru"));
    act(() => result.current.handleSaveEditedSchedule());
    expect(onSaveGroup).toHaveBeenLastCalledWith(
      expect.objectContaining({
        itinerary: expect.arrayContaining([
          expect.objectContaining({ isoDate: "2026-10-30", notes: "Catatan terbaru" }),
        ]),
      }),
      "GROUP",
    );
    act(() => result.current.handleOpenDeleteModal(0));
    expect(result.current.deletingItem?.title).toBe("Arrival tambahan");
    act(() => result.current.handleConfirmDelete());
    expect(result.current.itineraryItems).toHaveLength(2);
    expect(result.current.itineraryItems.every((item) => item.title !== "Arrival tambahan")).toBe(true);
  });
});
