import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AgreementInboxScreen } from "../../pages/agreement-inbox-page";

vi.mock("../../hooks/use-agreement-drafts-query", async (original) => ({
  ...(await original<object>()),
  useAgreementDraftsQuery: () => ({ isLoading: false, isFetching: false, data: Array.from({ length: 10 }, (_, index) => ({
    id: `draft-${index}`, agentId: index % 2 ? "agent-2" : "agent-1", agentName: "Agent", city: "makkah", hotelName: `Hotel ${index}`, agreementNumber: `AGR-${index}`, pax: 10, remainingPax: 10, assignedGroups: [], status: "Approved", stayStartIso: "2026-10-10", stayEndIso: "2026-10-15", notes: "", assignmentStatus: "Unassigned", createdAtIso: "2026-10-03T00:00:00Z", updatedAtIso: "2026-10-03T00:00:00Z", muassasahId: index < 7 ? "muassasah-a" : index < 9 ? "muassasah-b" : undefined, muassasahName: index < 7 ? "Directory A" : index < 9 ? "Directory B" : undefined,
  })) }),
}));
vi.mock("../../hooks/use-directory-backend", () => ({ useMuassasahQuery: () => ({ isLoading: false, isError: false, data: [{ id: "muassasah-a", name: "Directory A", isActive: true }, { id: "muassasah-b", name: "Directory B", isActive: true }] }) }));
vi.mock("../../hooks/use-agents-backend", () => ({ useAgentsQuery: () => ({ data: [{ id: "agent-1", name: "Agent One", status: "ACTIVE" }, { id: "agent-2", name: "Agent Two", status: "ACTIVE" }] }) }));

describe("Agreement Inbox Muassasah filter", () => {
  it("filters directory selections and missing selections, resets pagination and works with Agent and Clear all", async () => {
    const { container } = render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><AgreementInboxScreen /></MemoryRouter></QueryClientProvider>);
    const rows = () => container.querySelectorAll("article");
    const selectMuassasah = async (name: string) => {
      fireEvent.click(screen.getByRole("button", { name: "Filter Muassasah" }));
      fireEvent.click(await screen.findByRole("option", { name }));
    };
    expect(rows()).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    expect(screen.getByText("AGR-9")).toBeInTheDocument();
    await selectMuassasah("Directory A");
    await waitFor(() => expect(rows()).toHaveLength(7));
    expect(screen.getByText("AGR-0")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filter by Agent" }));
    fireEvent.click(await screen.findByRole("option", { name: "Agent One" }));
    await waitFor(() => expect(rows()).toHaveLength(4));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() => expect(rows()).toHaveLength(8));
    expect(screen.getByRole("button", { name: "Filter Muassasah" })).toHaveTextContent("All Muassasah");
    await selectMuassasah("Directory B");
    await waitFor(() => expect(rows()).toHaveLength(2));
    await selectMuassasah("Belum dipilih");
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.getByText("AGR-9")).toBeInTheDocument();
    expect(screen.queryByText("Partially Assigned")).not.toBeInTheDocument();
  });
});
