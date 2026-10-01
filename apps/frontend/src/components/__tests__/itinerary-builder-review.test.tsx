import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InputItineraryScreen } from "../../pages/add-group-workspace-page";
import type { GroupData } from "../../shared/app-domain";

vi.mock("../../hooks/use-saudi-city-options", () => ({
  useSaudiCityOptions: () => ["Jeddah", "Makkah", "Madinah"],
}));

vi.mock("../../hooks/use-agents-backend", () => ({
  useAgentsQuery: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock("../../components/date-time-pickers", () => {
  const Field = ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => <input value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} />;
  return { DatePickerInput: Field, TimePickerInput: Field };
});

function renderBuilder(onSaveGroup = vi.fn(), onItineraryDraftChange = vi.fn()) {
  render(
    <InputItineraryScreen
      hideHeader
      sectionMode="schedule-only"
      emitIdentityInDraft={false}
      identityDraft={{
        groupCode: "9017000001",
        groupName: "Dummy Trip Lengkap",
        pax: 45,
        totalBuses: 1,
        packageName: "Umrah",
        startDate: "2026-10-03",
        endDate: "2026-10-08",
        musyrifName: "Ahmad",
        musyrifPhone: "+628123456789",
      }}
      itineraryPrefill={{
        startDate: "2026-10-03",
        endDate: "2026-10-08",
        cityHotelNames: { makkah: "Swissotel Al Maqam", madinah: "Jiwar Al Saha" },
        trips: { "base-departure": { date: "2026-10-08", from: "Madinah", hotelName: "Jiwar Al Saha" } },
      }}
      onSaveGroup={onSaveGroup}
      onItineraryDraftChange={onItineraryDraftChange}
    />,
  );
  return { onSaveGroup, onItineraryDraftChange };
}

function completeDeparture() {
  fireEvent.click(screen.getByRole("button", { name: /Step 5: Departure/ }));
  fireEvent.change(screen.getByLabelText("Departure Activity Time"), { target: { value: "20:00" } });
  fireEvent.change(screen.getByLabelText("Hotel Pickup Request Time"), { target: { value: "17:00" } });
}

describe("itinerary builder pre-save review", () => {
  it("reviews only used trips without committing, then saves the same data explicitly", async () => {
    const { onSaveGroup, onItineraryDraftChange } = renderBuilder();
    await screen.findByRole("heading", { name: "5 Base Trips" });
    fireEvent.change(screen.getByLabelText("Time (Optional)"), { target: { value: "08:00" } });
    completeDeparture();
    fireEvent.click(screen.getByRole("button", { name: "Preview Trips" }));

    expect(screen.getByRole("heading", { name: "Full Itinerary" })).toHaveFocus();
    const preview = screen.getByRole("list");
    expect(within(preview).getAllByRole("listitem")).toHaveLength(2);
    expect(within(preview).getByText("08:00 LT")).toBeInTheDocument();
    expect(within(preview).getByText("17:00 LT")).toBeInTheDocument();
    expect(within(preview).getByText("Swissotel Al Maqam")).toBeInTheDocument();
    expect(within(preview).queryByText("City Tour")).not.toBeInTheDocument();
    expect(within(preview).queryByRole("button")).not.toBeInTheDocument();
    expect(onSaveGroup).not.toHaveBeenCalled();
    expect(onItineraryDraftChange.mock.calls.every(([draft]) => draft === null)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Save Trips" }));
    expect(screen.queryByRole("heading", { name: "Full Itinerary" })).not.toBeInTheDocument();
    expect(onSaveGroup).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(onItineraryDraftChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          itinerary: expect.arrayContaining([
            expect.objectContaining({ categoryKey: "arrival", time: "08:00", hotelName: "Swissotel Al Maqam" }),
            expect.objectContaining({ categoryKey: "departure", time: "20:00", hotelPickupRequestTime: "17:00" }),
          ]),
        }),
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Itinerary" }));
    const saved = onSaveGroup.mock.calls[0][0] as GroupData;
    expect(saved.itinerary).toHaveLength(2);
    expect(saved.itinerary[1]).toMatchObject({
      isoDate: "2026-10-08",
      hotelName: "Jiwar Al Saha",
      hotelPickupRequestTime: "17:00",
    });
  });

  it("blocks incomplete review and permits returning to edit without losing values", async () => {
    renderBuilder();
    await screen.findByRole("heading", { name: "5 Base Trips" });
    fireEvent.click(screen.getByRole("button", { name: /Step 5: Departure/ }));
    expect(screen.getByRole("button", { name: "Preview Trips" })).toBeDisabled();
    completeDeparture();
    fireEvent.click(screen.getByRole("button", { name: "Preview Trips" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByLabelText("Hotel Pickup Request Time")).toHaveValue("17:00");
    fireEvent.change(screen.getByLabelText("Hotel Pickup Request Time"), { target: { value: "16:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview Trips" }));
    expect(within(screen.getByRole("list")).getByText("16:30 LT")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Step 1: Arrival/ }));
    expect(screen.queryByRole("heading", { name: "Full Itinerary" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Hotel Name")).toHaveValue("Swissotel Al Maqam");
  });

  it("previews and saves both train segments using the same normalization", async () => {
    const { onSaveGroup } = renderBuilder();
    await screen.findByRole("heading", { name: "5 Base Trips" });
    fireEvent.click(screen.getByRole("button", { name: /Step 3: Transfer/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Use trip" }));
    fireEvent.click(screen.getByRole("button", { name: "Train" }));
    fireEvent.change(screen.getByLabelText("Train Departure Time"), { target: { value: "09:00" } });
    fireEvent.change(screen.getByLabelText("Destination Station Pickup Time"), { target: { value: "11:00" } });
    completeDeparture();
    fireEvent.click(screen.getByRole("button", { name: "Preview Trips" }));
    const preview = screen.getByRole("list");
    expect(within(preview).getAllByRole("listitem")).toHaveLength(4);
    expect(within(preview).getByText("Transfer (Train Departure)")).toBeInTheDocument();
    expect(within(preview).getByText("Transfer (Station Pickup)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save Trips" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Itinerary" }));
    expect(onSaveGroup.mock.calls[0][0].itinerary).toHaveLength(4);
  });
});
