import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AgentShell } from "../../agent/agent-shell";
import type { AgentSession } from "../../agent/auth/agent-session";

vi.mock("../../theme/theme-provider", () => ({
  useThemeMode: () => ({ theme: "light", toggleTheme: vi.fn() }),
}));

vi.mock("../../agent/pages/checklist-page", () => ({
  ChecklistPage: () => <h1>H-1 Checklist</h1>,
}));

vi.mock("../../agent/pages/group-detail-page", () => ({
  GroupDetailPage: () => <h1>Detail perjalanan</h1>,
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
        <MemoryRouter initialEntries={["/agent/checklist"]}>
          <Routes>
            <Route path="/agent/*" element={<AgentShell session={session} />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("heading", { name: "H-1 Checklist" })).toBeInTheDocument();
    const trackerLinks = screen.getAllByRole("link", { name: /Visa Tracking/i });
    expect(trackerLinks).toHaveLength(2);
    for (const link of trackerLinks) {
      expect(link).toHaveAttribute("href", "/agent/visa");
    }
    expect(screen.getAllByRole("link", { name: "Dashboard" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Perjalanan" })).toHaveLength(2);
    expect(screen.queryByRole("link", { name: "Checklist" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buka profil" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Ruang kerja Agent A" })).toHaveTextContent("AA");
    expect(screen.getByRole("region", { name: "Ruang kerja Agent A" })).toHaveTextContent(
      "Dashboard, visa, dan perjalanan dalam satu ruang kerja.",
    );
    for (const label of screen.getAllByText("Perjalanan")) {
      expect(label).not.toHaveClass("opacity-0");
    }
    expect(screen.queryByRole("link", { name: /^Agreement$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Invoice$/i })).not.toBeInTheDocument();
  });

  it("keeps Perjalanan active while viewing a group detail", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/agent/groups/GROUP-1"]}>
          <Routes>
            <Route path="/agent/*" element={<AgentShell session={session} />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Detail perjalanan" })).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Perjalanan" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });
});
