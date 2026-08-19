import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BaseTripSection } from "../../pages/add-group-workspace/components/BaseTripSection";
import { createBaseTripDrafts, type BaseTripDraft } from "../../pages/add-group-workspace/helpers/add-group-workspace-helpers";

function BaseTripTransferHarness() {
  const initialTransfer = createBaseTripDrafts("2026-08-01", "2026-08-10").find(
    (draft) => draft.category === "transfer",
  );
  const [drafts, setDrafts] = useState<BaseTripDraft[]>([
    { ...initialTransfer!, isEnabled: true },
  ]);

  return (
    <BaseTripSection
      isBaseTripFormVisible
      currentBaseTripStepIndex={0}
      baseTripDrafts={drafts}
      enabledBaseTripCount={1}
      isGroupReadyForItinerary
      handleJumpToBaseTripStep={vi.fn()}
      updateBaseTripDraftAtIndex={(tripIndex, updater) =>
        setDrafts((current) => current.map((draft, index) => (index === tripIndex ? updater(draft) : draft)))
      }
      handleBaseTripChange={(tripIndex, field, value) =>
        setDrafts((current) =>
          current.map((draft, index) => (index === tripIndex ? { ...draft, [field]: value } : draft)),
        )
      }
      handleBaseTripStepChange={vi.fn()}
      isFirstBaseTripStep
      isLastBaseTripStep
      handleSaveBaseTrips={vi.fn()}
      isBaseTripSaveDisabled={false}
      handleCloseBaseTripForm={vi.fn()}
      isActiveBaseTripInvalid={false}
      saudiCityOptions={["Makkah", "Madinah", "Jeddah"]}
    />
  );
}

describe("BaseTripSection", () => {
  it("allows a transfer trip to switch to high-speed train mode", () => {
    render(<BaseTripTransferHarness />);

    // Train time fields are hidden until the train transport mode is selected.
    expect(screen.queryByText("Train Departure Time")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Train$/i }));

    expect(screen.getByText("Train Departure Time")).toBeInTheDocument();
    expect(screen.getByText("Destination Station Pickup Time")).toBeInTheDocument();
  });
});
