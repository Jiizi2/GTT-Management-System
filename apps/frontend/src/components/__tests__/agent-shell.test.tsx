import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AgentShell } from "../../agent/agent-shell";
import type { AgentSession } from "../../agent/auth/agent-session";

vi.mock("../../theme/theme-provider", () => ({
  useThemeMode: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

const session: AgentSession = {
  expiresAt: "2026-07-19T00:00:00.000Z",
  user: {
    portalUserId: "portal-1",
    agentId: "agent-1",
    displayName: "Agent User",
    email: "agent@gtt.test",
    agentCode: "AA",
    agentName: "Agent A",
    mustChangePassword: false,
    exp: 1,
  },
};

describe("AgentShell routes", () => {
  it("matches Agent-prefixed routes inside the unified frontend", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/agreements"]}>
          <AgentShell session={session} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "Agreement" })).toBeInTheDocument();
    const trackerLinks = screen.getAllByRole("link", { name: /Visa Process Tracker/i });
    expect(trackerLinks).toHaveLength(2);
    for (const link of trackerLinks) {
      expect(link).toHaveAttribute("href", "/agent/visa-process");
    }
  });
});
