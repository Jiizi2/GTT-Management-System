import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentsScreen } from "../../pages/agents-page";

vi.mock("../../hooks/use-agents-backend", () => ({
  createAgent: vi.fn(),
  setAgentStatus: vi.fn(),
  updateAgent: vi.fn(),
  useAgentsQuery: () => ({
    data: [
      {
        id: "agent-1",
        code: "AL-FALAH",
        name: "PT Al Falah Travel",
        type: "PARTNER",
        status: "ACTIVE",
        picName: "Ahmad",
        phone: "+62123456789",
        email: "ops@alfalah.test",
        groupCount: 2,
      },
    ],
    isLoading: false,
    isError: false,
  }),
}));

describe("agents page", () => {
  it("membuka formulir edit agent di drawer master data", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AgentsScreen embedded />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Edit PT Al Falah Travel" })[0]);

    expect(screen.getByRole("dialog", { name: "Edit PT Al Falah Travel" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("AL-FALAH")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tutup formulir" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
