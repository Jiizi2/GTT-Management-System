import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  function renderActions(overrides: Partial<HotelAgreementDraft> = {}, deletePending = false) {
    const currentDraft = { ...draft, ...overrides };
    const onDeleteRequest = vi.fn();
    render(
      <AgreementDraftTable
        drafts={[currentDraft]}
        linkedGroupCode=""
        assignmentGroupCodes={{}}
        onAssignmentGroupCodeChange={vi.fn()}
        onAssignToGroup={vi.fn()}
        onUnassignFromGroup={vi.fn()}
        onStartEdit={vi.fn()}
        onDeleteRequest={onDeleteRequest}
        onStatusChange={vi.fn()}
        statusChangePending={false}
        deleteDraftMutationPending={deletePending}
        assignDraftMutationPending={false}
        unassignDraftMutationPending={false}
      />,
    );
    return { currentDraft, onDeleteRequest };
  }

  it("opens delete actions outside the row, closes after selection, and passes the original draft", async () => {
    const user = userEvent.setup();
    const { currentDraft, onDeleteRequest } = renderActions();
    const trigger = screen.getByRole("button", { name: "Tindakan lain untuk agreement AGR-001" });
    await user.click(trigger);
    const menu = screen.getByRole("group", { name: "Tindakan lain untuk agreement AGR-001" });
    expect(menu.parentElement).toBe(document.body);
    await user.click(screen.getByRole("button", { name: "Delete draft" }));
    expect(onDeleteRequest).toHaveBeenCalledExactlyOnceWith(currentDraft);
    expect(menu).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it.each(["Assigned", "Partially Assigned"] as const)(
    "keeps deletion disabled for %s agreements",
    async (assignmentStatus) => {
      const user = userEvent.setup();
      const { onDeleteRequest } = renderActions({ assignmentStatus });
      await user.click(screen.getByRole("button", { name: "Tindakan lain untuk agreement AGR-001" }));
      const deleteButton = screen.getByRole("button", { name: "Delete draft" });
      expect(deleteButton).toBeDisabled();
      expect(deleteButton).toHaveAttribute("title", "Lepas agreement dari group sebelum menghapus.");
      await user.click(deleteButton);
      expect(onDeleteRequest).not.toHaveBeenCalled();
    },
  );

  it("keeps deletion disabled while a delete request is pending", async () => {
    renderActions({}, true);
    await userEvent.click(screen.getByRole("button", { name: "Tindakan lain untuk agreement AGR-001" }));
    expect(screen.getByRole("button", { name: "Delete draft" })).toBeDisabled();
  });

  it("keeps linked groups closed by default and lets the user toggle it", () => {
    vi.useFakeTimers();
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
    expect(screen.getByText("Linked Groups (0)").closest(".serene-disclosure-grid")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    act(() => vi.advanceTimersByTime(380));
    expect(screen.queryByText("Linked Groups (0)")).not.toBeInTheDocument();
    vi.useRealTimers();
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
    expect(
      Array.from(container.querySelectorAll(".material-symbols-outlined")).some(
        (icon) => icon.textContent === "mosque",
      ),
    ).toBe(true);
  });
});
