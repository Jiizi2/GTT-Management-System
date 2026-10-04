import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AgreementInboxScreen } from "../../pages/agreement-inbox-page";
import { useAgreementInbox } from "../../pages/agreement-inbox/hooks/use-agreement-inbox";
import type { HotelAgreementDraft } from "../../shared/app-domain";

const mocks = vi.hoisted(() => ({ query: vi.fn(), save: vi.fn() }));
vi.mock("../../hooks/use-agreement-drafts-query", async (original) => ({
  ...(await original<object>()),
  useAgreementDraftsQuery: mocks.query,
  saveAgreementDraftInBackend: mocks.save,
}));
vi.mock("../../hooks/use-directory-backend", () => ({
  useMuassasahQuery: () => ({
    data: [
      { id: "muassasah-old", name: "Directory Legacy", isActive: false },
      { id: "muassasah-new", name: "Directory New", isActive: true },
    ],
    isLoading: false,
    isError: false,
  }),
}));
vi.mock("../../hooks/use-agents-backend", () => ({
  useAgentsQuery: () => ({ data: [{ id: "agent-1", name: "Agent One", status: "ACTIVE" }] }),
}));

const rejected: HotelAgreementDraft = {
  id: "rejected-1",
  agentId: "agent-1",
  agentName: "Agent One",
  muassasahId: "muassasah-old",
  muassasahName: "Directory Legacy",
  groupName: "Group One",
  city: "makkah",
  hotelName: "Hotel One",
  agreementNumber: "AGR-OLD",
  pax: 10,
  remainingPax: 0,
  assignedGroups: [{ groupCode: "GROUP-1", pax: 10 }],
  assignmentStatus: "Assigned",
  status: "Rejected",
  stayStartIso: "2026-10-10",
  stayEndIso: "2026-10-15",
  notes: "Original note",
  createdAtIso: "2026-10-03T00:00:00Z",
  updatedAtIso: "2026-10-03T00:00:00Z",
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mocks.query.mockReset().mockReturnValue({ data: [rejected], isLoading: false, isFetching: false });
  mocks.save.mockReset().mockResolvedValue(rejected);
});

describe("Rejected agreements in Unassigned", () => {
  it("keeps rejected linked drafts visible when the stay-period filter is applied", () => {
    const approved = { ...rejected, id: "approved-1", status: "Approved" as const };
    mocks.query.mockReturnValue({ data: [rejected, approved], isLoading: false, isFetching: false });
    const { result } = renderHook(() => useAgreementInbox(), { wrapper });
    expect(result.current.statusFilter).toBe("unassigned");
    expect(mocks.query).toHaveBeenCalledWith("", "unassigned");
    act(() => {
      result.current.setStartDateFilter("2026-10-10");
      result.current.setEndDateFilter("2026-10-15");
    });
    expect(result.current.filteredDrafts).toEqual([rejected]);
    act(() => result.current.setStatusFilter("all"));
    expect(result.current.filteredDrafts).toHaveLength(2);
  });

  it("opens the default inbox draft for editing its number, status and other details", async () => {
    render(<AgreementInboxScreen />, { wrapper });
    expect(screen.getByText("AGR-OLD")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ubah status agreement AGR-OLD" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit agreement AGR-OLD" }));
    expect(screen.getByRole("dialog", { name: "Edit Draft Agreement" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Muassasah draft" })).toHaveTextContent("Directory Legacy");
    fireEvent.click(screen.getByRole("button", { name: "Muassasah draft" }));
    fireEvent.click(await screen.findByRole("option", { name: "Directory New" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Agreement Number" }), { target: { value: "AGR-NEW" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Hotel Name" }), { target: { value: "Revised Hotel" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Pax" }), { target: { value: "12" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), { target: { value: "Revised note" } });
    fireEvent.click(screen.getByRole("button", { name: "Approval Status" }));
    fireEvent.click(await screen.findByRole("option", { name: "Waiting for Approval" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() =>
      expect(mocks.save.mock.calls[0]?.[0]).toEqual({
        draftId: rejected.id,
        draft: {
          agentId: "agent-1",
          muassasahId: "muassasah-new",
          groupName: "Group One",
          city: "makkah",
          agreementNumber: "AGR-NEW",
          hotelName: "Revised Hotel",
          pax: "12",
          status: "Waiting for Approval",
          notes: "Revised note",
          stayStartIso: "2026-10-10",
          stayEndIso: "2026-10-15",
        },
      }),
    );
  });

  it.each([
    { clearMuassasah: false, expectedMuassasahId: "muassasah-old" },
    { clearMuassasah: true, expectedMuassasahId: "" },
  ])("preserves or clears Muassasah when editing (clear: $clearMuassasah)", async ({ clearMuassasah, expectedMuassasahId }) => {
    render(<AgreementInboxScreen />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: "Edit agreement AGR-OLD" }));
    if (clearMuassasah) {
      fireEvent.click(screen.getByRole("button", { name: "Muassasah draft" }));
      fireEvent.click(await screen.findByRole("option", { name: "Belum dipilih" }));
    }
    fireEvent.change(screen.getByRole("textbox", { name: "Notes" }), { target: { value: "Updated note" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(mocks.save.mock.calls[0]?.[0]).toEqual({
      draftId: rejected.id,
      draft: expect.objectContaining({ muassasahId: expectedMuassasahId, notes: "Updated note" }),
    }));
  });
});
