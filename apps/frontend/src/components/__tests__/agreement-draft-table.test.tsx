import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgreementDraftTable } from "../../pages/agreement-inbox/components/AgreementDraftTable";
import type { HotelAgreementDraft } from "../../shared/app-domain";

const draft: HotelAgreementDraft = {
  id: "agreement-1",
  agentId: "agent-1",
  city: "makkah",
  agentName: "Agent One",
  hotelName: "Hotel One",
  agreementNumber: "AGR-001",
  pax: 10,
  remainingPax: 10,
  assignedGroups: [],
  status: "Approved",
  stayStartIso: "2026-10-01",
  stayEndIso: "2026-10-05",
  notes: "",
  assignmentStatus: "Unassigned",
  createdAtIso: "2026-09-01T00:00:00.000Z",
  updatedAtIso: "2026-09-01T00:00:00.000Z",
};

const madinahDraft: HotelAgreementDraft = {
  ...draft,
  id: "agreement-2",
  city: "madinah",
  hotelName: "Hotel Two",
  agreementNumber: "AGR-002",
};

describe("AgreementDraftTable", () => {
  it("keeps linked groups closed by default and lets the user toggle it", () => {
    render(
      <AgreementDraftTable
        drafts={[draft]}
        linkedGroupCode=""
        assignmentGroupCodes={{}}
        onAssignmentGroupCodeChange={vi.fn()}
        onAssignToGroup={vi.fn()}
        onUnassignFromGroup={vi.fn()}
        onStartEdit={vi.fn()}
        onDeleteRequest={vi.fn()}
        onStatusChange={vi.fn()}
        statusChangePending={false}
        deleteDraftMutationPending={false}
        assignDraftMutationPending={false}
        unassignDraftMutationPending={false}
      />,
    );

    expect(screen.queryByText("Linked Groups (0)")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Buka detail AGR-001" }));
    expect(screen.getByText("Linked Groups (0)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tutup detail AGR-001" }));
    expect(screen.queryByText("Linked Groups (0)")).not.toBeInTheDocument();
  });

  it("uses different city icons for Makkah and Madinah", () => {
    const { container } = render(
      <AgreementDraftTable
        drafts={[draft, madinahDraft]}
        linkedGroupCode=""
        assignmentGroupCodes={{}}
        onAssignmentGroupCodeChange={vi.fn()}
        onAssignToGroup={vi.fn()}
        onUnassignFromGroup={vi.fn()}
        onStartEdit={vi.fn()}
        onDeleteRequest={vi.fn()}
        onStatusChange={vi.fn()}
        statusChangePending={false}
        deleteDraftMutationPending={false}
        assignDraftMutationPending={false}
        unassignDraftMutationPending={false}
      />,
    );

    expect(container.querySelector(".material-symbols-outlined")?.textContent).toBe("location_on");
    expect(Array.from(container.querySelectorAll(".material-symbols-outlined")).some((icon) => icon.textContent === "mosque")).toBe(true);
  });
});
