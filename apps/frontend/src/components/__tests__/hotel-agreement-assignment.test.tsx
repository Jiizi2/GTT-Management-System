import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GroupData, HotelAgreementDraft } from "../../shared/app-domain";
import { filterAgreementDrafts } from "../../shared/visa-domain";
import { HotelAgreementSection } from "../../pages/visa-detail/components/HotelAgreementSection";

const { mockVisaDetailContext } = vi.hoisted(() => ({ mockVisaDetailContext: vi.fn() }));

vi.mock("../../pages/visa-detail/context/VisaDetailContext", () => ({
  useVisaDetailContext: mockVisaDetailContext,
}));

const group: GroupData = {
  code: "GROUP-B",
  name: "Second Group",
  status: "ACTIVE",
  tone: "active",
  pax: 7,
  packageName: "PRIVATE",
  durationDays: 5,
  arrivalDate: "2026-06-14",
  returnDate: "2026-06-18",
  timeline: [
    { date: "-", title: "-" },
    { date: "-", title: "-" },
  ],
  nextActivity: { title: "-", date: "-", time: "-", icon: "schedule" },
  itinerary: [],
  notes: [],
  musyrif: { name: "-", phone: "-", avatar: "" },
};

function renderAssignment(city: HotelAgreementDraft["city"], assignedGroupCode = "GROUP-A", remainingPax = 7) {
  const draft: HotelAgreementDraft = {
    id: "shared-draft",
    agentId: "agent-1",
    city,
    agentName: "Agent A",
    hotelName: "Shared Hotel",
    agreementNumber: "AG-SHARED-30",
    pax: 30,
    remainingPax,
    assignedGroups: [
      {
        groupCode: assignedGroupCode,
        pax: 30 - remainingPax,
        stayStartIso: group.arrivalDate,
        stayEndIso: group.returnDate,
      },
    ],
    status: "Approved",
    stayStartIso: group.arrivalDate!,
    stayEndIso: group.returnDate!,
    notes: "",
    assignmentStatus: "Assigned",
    createdAtIso: "2026-06-01T00:00:00Z",
    updatedAtIso: "2026-06-01T00:00:00Z",
  };
  const assignAgreementDraft = vi.fn();
  mockVisaDetailContext.mockReturnValue({
    row: { makkahHotelWaived: false, madinahHotelWaived: false },
    group,
    familyGroups: [group],
    activeGroupCode: group.code,
    totalPax: group.pax,
    makkahAgreements: [],
    madinahAgreements: [],
    availableAgreementDraftsByCity: filterAgreementDrafts([draft], {
      groupArrivalDate: group.arrivalDate,
      groupReturnDate: group.returnDate,
      totalPax: group.pax,
      connectedAgreementKeys: new Set(),
    }),
    assignedDraftByAgreementId: new Map(),
    makkahAssigned: 0,
    madinahAssigned: 0,
    makkahMissing: group.pax,
    madinahMissing: group.pax,
    addingHotelCity: city,
    coverageStartIso: group.arrivalDate,
    coverageEndIso: group.returnDate,
    assigningAgreementDraftId: null,
    assignAgreementDraft,
  });

  render(<HotelAgreementSection />);
  return { draft, assignAgreementDraft };
}

describe("shared hotel agreement assignment", () => {
  it.each(["makkah", "madinah"] as const)(
    "allows assigning an already linked %s agreement to another group",
    (city) => {
      const { draft, assignAgreementDraft } = renderAssignment(city);

      expect(screen.getByText(draft.agreementNumber)).toBeInTheDocument();
      expect(screen.getByText("Pax 7/30")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Assign" });
      expect(button).toBeEnabled();
      fireEvent.click(button);
      expect(assignAgreementDraft).toHaveBeenCalledWith(draft, group.arrivalDate, group.returnDate);
    },
  );

  it.each([6, 0])("hides an agreement with %i remaining pax when the group needs 7", (remainingPax) => {
    const { draft, assignAgreementDraft } = renderAssignment("makkah", "GROUP-A", remainingPax);

    expect(screen.queryByText(draft.agreementNumber)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assign" })).not.toBeInTheDocument();
    expect(assignAgreementDraft).not.toHaveBeenCalled();
  });

  it("prevents assigning the same agreement to its existing group again", () => {
    const { assignAgreementDraft } = renderAssignment("makkah", " group-b ");

    expect(screen.getByText("Sudah di-assign ke grup ini.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign" })).toBeDisabled();
    expect(assignAgreementDraft).not.toHaveBeenCalled();
  });
});
