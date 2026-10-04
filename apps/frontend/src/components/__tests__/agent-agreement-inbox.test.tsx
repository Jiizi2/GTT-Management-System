import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgreementInboxPage, type AgentAgreementDraft } from "../../agent/pages/agreement-inbox-page";

const { get, write } = vi.hoisted(() => ({ get: vi.fn(), write: vi.fn() }));
vi.mock("../../agent/data/portal-query", () => ({ portalGet: (...args: unknown[]) => get(...args) }));
vi.mock("../../agent/auth/agent-api", async (original) => ({
  ...(await original<object>()),
  agentWrite: (...args: unknown[]) => write(...args),
}));
const draft: AgentAgreementDraft = {
  id: "draft-1",
  city: "MAKKAH",
  hotelName: "Hotel Agent",
  agreementNumber: "AGR-001",
  groupName: "Group Agent",
  pax: 30,
  status: "WAITING",
  stayStart: "2026-10-05",
  stayEnd: "2026-10-08",
  remainingPax: 30,
  assignmentStatus: "Unassigned",
  assignedGroups: [],
  editable: true,
};
function renderPage(initialEntry = "/agent/agreement-inbox") {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <AgreementInboxPage principalId="portal-a" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  get.mockReset().mockResolvedValue([draft]);
  write.mockReset();
});

describe("Agent Agreement Inbox", () => {
  it("reads Admin agreements without creation or revision controls", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Hotel Agent" });
    expect(get).toHaveBeenCalledWith(expect.anything(), "/agreement-drafts");
    expect(screen.queryByRole("button", { name: "Kirim draft" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revisi/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nama hotel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buka detail AGR-001" }));
    expect(write).not.toHaveBeenCalled();
  });
  it.each(["WAITING", "REJECTED", "APPROVED"])(
    "keeps %s read-only even with an editable flag from an older server",
    async (status) => {
      get.mockResolvedValue([{ ...draft, status, editable: true }]);
      renderPage();
      await screen.findByRole("heading", { name: "Hotel Agent" });
      expect(screen.queryByRole("button", { name: /revisi|kirim/i })).not.toBeInTheDocument();
      expect(write).not.toHaveBeenCalled();
    },
  );
  it("shows and searches the Admin-selected Muassasah without adding an Agent input", async () => {
    get.mockResolvedValue([{ ...draft, muassasahId: "muassasah-own", muassasahName: "Muassasah Admin" }]);
    renderPage();
    expect(await screen.findByText("Muassasah Admin")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search agreement drafts"), { target: { value: "muassasah admin" } });
    expect(screen.getByRole("heading", { name: "Hotel Agent" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /muassasah/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /muassasah/i })).not.toBeInTheDocument();
  });
  it("handles older drafts without a Muassasah selection", async () => {
    renderPage();
    expect(await screen.findByText("Belum dipilih")).toBeInTheDocument();
  });
  it("shows allocated drafts without an edit control, with distinct empty search feedback", async () => {
    get.mockResolvedValue([
      {
        ...draft,
        status: "APPROVED",
        editable: false,
        assignedGroups: [{ groupCode: "GTT-001", pax: 30 }],
        remainingPax: 0,
        assignmentStatus: "Assigned",
      },
    ]);
    renderPage("/agent/agreement-inbox?allocation=all");
    await screen.findByRole("heading", { name: "Hotel Agent" });
    expect(screen.queryByRole("button", { name: "Revisi AGR-001" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "GTT-001" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buka detail AGR-001" }));
    expect(screen.getByRole("link", { name: "GTT-001" })).toHaveAttribute("href", "/agent/groups/GTT-001");
    const row = screen.getByRole("heading", { name: "Hotel Agent" }).closest("article")!;
    expect(within(row).queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: /ubah status|link to group|delete|lepas/i }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search agreement drafts"), { target: { value: "tidak ada" } });
    expect(screen.getByRole("heading", { name: "No matching agreements" })).toBeInTheDocument();
  });
  it("refreshes changes made by Admin without sending a write", async () => {
    get
      .mockResolvedValueOnce([draft])
      .mockResolvedValue([
        { ...draft, hotelName: "Hotel Updated by Admin", status: "APPROVED", muassasahName: "Muassasah Updated" },
      ]);
    renderPage();
    await screen.findByRole("heading", { name: "Hotel Agent" });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByRole("heading", { name: "Hotel Updated by Admin" });
    expect(screen.getByText("Muassasah Updated")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(write).not.toHaveBeenCalled();
  });
  it("explains that Admin adds agreements when the inbox is empty", async () => {
    get.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Agreement drafts created by Admin will appear here.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /kirim|revisi/i })).not.toBeInTheDocument();
  });
  it("closes group details when their agreement is removed by a filter", async () => {
    get.mockResolvedValue([
      { ...draft, assignedGroups: [{ groupCode: "GTT-001", pax: 10 }], editable: false },
      { ...draft, id: "draft-2", hotelName: "Hotel Kedua", agreementNumber: "AGR-002" },
    ]);
    renderPage("/agent/agreement-inbox?allocation=all");
    fireEvent.click(await screen.findByRole("button", { name: "Buka detail AGR-001" }));
    expect(screen.getByRole("link", { name: "GTT-001" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search agreement drafts"), { target: { value: "AGR-002" } });
    expect(screen.queryByRole("link", { name: "GTT-001" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    fireEvent.click(screen.getByRole("button", { name: "Filter agreement assignment status" }));
    fireEvent.click(screen.getByRole("option", { name: "All Agreements" }));
    expect(screen.getByRole("button", { name: "Buka detail AGR-001" })).toHaveAttribute("aria-expanded", "false");
  });
  it("uses canonical allocation status when legacy group identities are hidden", async () => {
    get.mockResolvedValue([
      { ...draft, assignmentStatus: "Assigned", assignedGroups: [], remainingPax: 7, editable: false },
    ]);
    renderPage("/agent/agreement-inbox?allocation=all");
    await screen.findByRole("heading", { name: "Hotel Agent" });
    fireEvent.click(screen.getByRole("button", { name: "Filter agreement assignment status" }));
    fireEvent.click(screen.getByRole("option", { name: "Assigned" }));
    expect(screen.getByRole("heading", { name: "Hotel Agent" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revisi AGR-001" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Buka detail AGR-001" }));
    expect(screen.getByText("Linked Groups")).toBeInTheDocument();
    expect(
      screen.getByText("This agreement has group allocations. Group details are not available to this account."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Linked Groups (0)")).not.toBeInTheDocument();
    expect(screen.queryByText("Belum terhubung ke group.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filter agreement assignment status" }));
    fireEvent.click(screen.getByRole("option", { name: "Unassigned" }));
    expect(screen.getByRole("heading", { name: "No matching agreements" })).toBeInTheDocument();
  });

  it("filters scoped Muassasah choices and agreements without a selection", async () => {
    get.mockResolvedValue([
      { ...draft, muassasahId: "m-a", muassasahName: "Directory A" },
      { ...draft, id: "draft-2", hotelName: "Hotel Kedua", muassasahId: "m-b", muassasahName: "Directory B" },
      { ...draft, id: "draft-3", hotelName: "Hotel Ketiga" },
    ]);
    renderPage();
    await screen.findByRole("heading", { name: "Hotel Agent" });
    fireEvent.click(screen.getByRole("button", { name: "Filter Muassasah" }));
    fireEvent.click(screen.getByRole("option", { name: "Directory B" }));
    expect(screen.getByRole("heading", { name: "Hotel Kedua" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hotel Agent" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filter Muassasah" }));
    fireEvent.click(screen.getByRole("option", { name: "Belum dipilih" }));
    expect(screen.getByRole("heading", { name: "Hotel Ketiga" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hotel Kedua" })).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("combines overlapping stay dates with remaining capacity", async () => {
    get.mockResolvedValue([
      { ...draft, remainingPax: 0 },
      { ...draft, id: "draft-2", hotelName: "Hotel Kedua", stayStart: "2026-10-10", stayEnd: "2026-10-13" },
      { ...draft, id: "draft-3", hotelName: "Hotel Ketiga", stayStart: "2026-10-06", stayEnd: "2026-10-09" },
    ]);
    renderPage("/agent/agreement-inbox?allocation=all&startDate=2026-10-07&endDate=2026-10-09&remainingPax=1");
    expect(await screen.findByRole("heading", { name: "Hotel Ketiga" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hotel Agent" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hotel Kedua" })).not.toBeInTheDocument();
    expect(screen.getByText("Period selected")).toBeInTheDocument();
  });

  it("searches cities across assignment states and resets to the Admin default", async () => {
    get.mockResolvedValue([
      draft,
      { ...draft, id: "draft-2", hotelName: "Hotel Madinah", city: "MADINAH", assignmentStatus: "Assigned" },
    ]);
    renderPage();
    await screen.findByRole("heading", { name: "Hotel Agent" });
    fireEvent.change(screen.getByLabelText("Search agreement drafts"), { target: { value: "madinah" } });
    expect(screen.getByRole("heading", { name: "Hotel Madinah" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hotel Agent" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("heading", { name: "Hotel Agent" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Hotel Madinah" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Filter agreement assignment status" })).toHaveTextContent("Unassigned");
  });
});
