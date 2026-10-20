import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentFilterSelect } from "../agent-filter-select";

vi.mock("../../hooks/use-agents-backend", () => ({
  useAgentsQuery: () => ({
    data: [
      { id: "agent-a", code: "A", name: "Agent Alpha", type: "PARTNER", status: "ACTIVE" },
      { id: "agent-b", code: "B", name: "Agent Beta", type: "PARTNER", status: "ACTIVE" },
      { id: "agent-c", code: "C", name: "Agent Inactive", type: "PARTNER", status: "INACTIVE" },
    ],
  }),
}));

describe("AgentFilterSelect", () => {
  it("opens a dropdown containing all active agents", () => {
    render(<AgentFilterSelect value="all" onChange={() => {}} variant="pill" />);

    fireEvent.click(screen.getByRole("button", { name: "Filter by Agent" }));

    expect(screen.getByRole("option", { name: "All Agents" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Agent Alpha" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Agent Beta" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Agent Inactive" })).not.toBeInTheDocument();
  });

  it("returns the selected agent id", () => {
    const onChange = vi.fn();
    render(<AgentFilterSelect value="all" onChange={onChange} variant="field" />);

    fireEvent.click(screen.getByRole("button", { name: "Filter by Agent" }));
    fireEvent.click(screen.getByRole("option", { name: "Agent Beta" }));

    expect(onChange).toHaveBeenCalledWith("agent-b");
  });

  it.each(["toolbar", "field", "pill", "inline"] as const)("searches agent names in the %s variant", (variant) => {
    const onChange = vi.fn();
    render(<AgentFilterSelect value="all" onChange={onChange} variant={variant} />);
    fireEvent.click(screen.getByRole("button", { name: "Filter by Agent" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "bEt" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: "Agent Beta" }));
    expect(onChange).toHaveBeenCalledWith("agent-b");
  });
});
