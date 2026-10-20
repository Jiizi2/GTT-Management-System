import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SereneSelect } from "../serene-select";

function renderSelect(onChange = vi.fn()) {
  render(
    <>
      <button>Before select</button>
      <SereneSelect
        searchable
        searchPlaceholder="Cari nama agent..."
        aria-label="Agent"
        value="alpha"
        onChange={onChange}
      >
        <option value="alpha">Agent Alpha</option>
        <option value="disabled" disabled>
          Agent Beta unavailable
        </option>
        <option value="beta">Agent Beta ({"B01"})</option>
        <option value="gamma">Agent Gamma</option>
      </SereneSelect>
      <button>After select</button>
    </>,
  );
  const trigger = screen.getByRole("button", { name: "Agent" });
  fireEvent.click(trigger);
  return { trigger, search: screen.getByRole("combobox"), onChange };
}

describe("searchable SereneSelect", () => {
  it("opens with the full list and focuses search without changing the selected value", () => {
    const { search, onChange } = renderSelect();
    expect(search).toHaveFocus();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    fireEvent.change(search, { target: { value: "  bEtA  " } });
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.queryByRole("option", { name: "Agent Alpha" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agent" })).toHaveTextContent("Agent Alpha");
    expect(onChange).not.toHaveBeenCalled();
    expect(document.getElementById(search.getAttribute("aria-activedescendant")!)).toHaveTextContent(
      "Agent Beta (B01)",
    );
  });

  it("searches the complete option label and returns its original id", async () => {
    const { search, trigger, onChange } = renderSelect();
    fireEvent.change(search, { target: { value: "b01" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.click(screen.getByRole("option", { name: "Agent Beta (B01)" }));
    expect(onChange).toHaveBeenCalledWith({ target: { value: "beta" } });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    fireEvent.click(trigger);
    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getAllByRole("option")).toHaveLength(4);
  });

  it("shows an empty result, ignores Enter, and restores the list when search is cleared", () => {
    const { search, onChange } = renderSelect();
    fireEvent.change(search, { target: { value: "missing" } });
    expect(screen.getByRole("status")).toHaveTextContent("Tidak ada pilihan yang cocok.");
    expect(search).not.toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("allows spaces and selects only enabled filtered options with the keyboard", async () => {
    const user = userEvent.setup();
    const { search, onChange } = renderSelect();
    await user.type(search, "agent b");
    expect(search).toHaveValue("agent b");
    await user.keyboard("{ArrowDown}{ArrowUp}{Enter}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ target: { value: "beta" } });
  });

  it("closes on Escape without changing the value or forwarding Escape to a parent", () => {
    const handleEscape = vi.fn();
    window.addEventListener("keydown", handleEscape);
    try {
      const { search, trigger, onChange } = renderSelect();
      fireEvent.change(search, { target: { value: "beta" } });
      fireEvent.keyDown(search, { key: "Escape" });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      expect(onChange).not.toHaveBeenCalled();
      expect(handleEscape).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener("keydown", handleEscape);
    }
  });

  it.each([false, true])("closes search and restores the trigger before native Tab navigation (shift=%s)", (shift) => {
    const { search, trigger, onChange } = renderSelect();
    fireEvent.keyDown(search, { key: "Tab", shiftKey: shift });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
});
