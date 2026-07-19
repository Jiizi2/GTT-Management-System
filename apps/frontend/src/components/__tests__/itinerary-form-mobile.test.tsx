import { fireEvent, render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ManualScheduleModal } from "../../pages/add-group-workspace/components/ManualScheduleModal";
import type { ManualScheduleFormValues } from "../../pages/add-group-workspace/hooks/use-add-group-workspace-form";

const initialValues: ManualScheduleFormValues = {
  date: "2026-07-20",
  time: "08:00",
  category: "arrival",
  hotelName: "Operational Hotel",
  fromHotelName: "",
  from: "JED Airport",
  to: "Makkah",
  cityTourCity: "",
  flightNumber: "SV-827",
  requiresBus: true,
  notes: "Operational notes",
  transferByTrain: false,
  trainDepartureTime: "",
  destinationPickupTime: "",
  hotelPickupRequestTime: "",
};

function ItineraryFormHarness() {
  const scheduleMethods = useForm<ManualScheduleFormValues>({ defaultValues: initialValues });
  const form = scheduleMethods.watch();
  const isTransferByTrain = form.category === "transfer" && form.transferByTrain;
  const handleFormChange = <Key extends keyof ManualScheduleFormValues>(
    field: Key,
    value: ManualScheduleFormValues[Key],
  ) => {
    scheduleMethods.reset({ ...scheduleMethods.getValues(), [field]: value });
  };

  return (
    <ManualScheduleModal
      isScheduleFormVisible
      handleCloseScheduleForm={vi.fn()}
      editingItemId={null}
      handleSaveItem={vi.fn()}
      isFormDisabled={false}
      validationState={{
        showFlightNumberField: form.category === "arrival" || form.category === "departure",
        showHotelNameField: form.category === "arrival" || form.category === "departure",
        showTransferTrainFields: isTransferByTrain,
        showDeparturePickupField: form.category === "departure",
        showCityTourCityField: form.category === "city-tour",
      }}
      form={form}
      scheduleMethods={scheduleMethods}
      handleFormChange={handleFormChange}
      applyManualScheduleDraft={(draft) => scheduleMethods.reset(draft)}
      isGroupReadyForItinerary
      saudiCityOptions={["Makkah", "Madinah", "Jeddah"]}
      showFridayCityTourWarning={false}
    />
  );
}

describe("mobile itinerary form", () => {
  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("uses a full-height mobile workspace with persistent form sections and actions", () => {
    const { container, unmount } = render(<ItineraryFormHarness />);

    const dialog = screen.getByRole("dialog");
    const shell = dialog.querySelector("section");
    expect(shell).toHaveClass("h-[100dvh]", "rounded-none");
    expect(screen.getByRole("heading", { name: "Schedule details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Route & transportation" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Operational notes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add to Timeline" })).toHaveClass("min-h-12");
    expect(document.body.style.overflow).toBe("hidden");
    expect(container).toBeEmptyDOMElement();

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps activity-specific operational fields available when their category is selected", () => {
    render(<ItineraryFormHarness />);

    expect(screen.getByText("Flight Number")).toBeInTheDocument();
    expect(screen.getByText("Hotel Name")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /transfer/i }));
    expect(screen.getByText("Transfer using High-Speed Train (HHR)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /High-Speed Train/i }));
    expect(screen.getByText("Train Departure Time")).toBeInTheDocument();
    expect(screen.getByText("Destination Station Pickup Time")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /city tour/i }));
    expect(screen.getByText("City Tour City")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /departure/i }));
    expect(screen.getByText("Hotel Pickup Request Time")).toBeInTheDocument();
  });
});
