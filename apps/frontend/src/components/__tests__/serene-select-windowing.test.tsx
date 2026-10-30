import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { SereneSelect } from "../serene-select";

const options = Array.from({ length: 600 }, (_, index) => (
  <option key={index} value={String(index)} disabled={index === 598}>
    Agent {index}
  </option>
));

describe("large select lists", () => {
  it("keeps the selected option accessible and skips disabled options with the keyboard", () => {
    const onChange = vi.fn();
    render(
      <SereneSelect aria-label="Agent" value="599" onChange={onChange}>
        {options}
      </SereneSelect>,
    );
    const trigger = screen.getByRole("button", { name: "Agent" });
    fireEvent.click(trigger);
    expect(screen.getAllByRole("option").length).toBeLessThan(100);
    expect(screen.getByRole("option", { name: "Agent 599" })).toHaveAttribute("aria-posinset", "600");
    expect(screen.getByRole("option", { name: "Agent 599" })).toHaveAttribute("aria-setsize", "600");
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: "Agent 597" })).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ target: { value: "597" } });
  });

  it("allows scrolling to and selecting the last option without mounting the entire list", () => {
    const onChange = vi.fn();
    render(
      <SereneSelect aria-label="Agent" value="0" onChange={onChange}>
        {options}
      </SereneSelect>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Agent" }));
    fireEvent.scroll(screen.getByRole("listbox"), { target: { scrollTop: 24_000 } });
    expect(screen.getAllByRole("option").length).toBeLessThan(100);
    fireEvent.click(screen.getByRole("option", { name: "Agent 599" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ target: { value: "599" } });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("searches all options and preserves selection and keyboard wraparound after reopening", () => {
    function Harness() {
      const [value, setValue] = useState("0");
      return (
        <SereneSelect searchable aria-label="Agent" value={value} onChange={(event) => setValue(event.target.value)}>
          {options}
        </SereneSelect>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Agent" });
    fireEvent.click(trigger);
    fireEvent.scroll(screen.getByRole("listbox"), { target: { scrollTop: 16_000 } });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Agent 599" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("listbox").scrollTop).toBe(0);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(trigger).toHaveTextContent("Agent 599");
    fireEvent.click(trigger);
    const search = screen.getByRole("combobox");
    expect(search).toHaveValue("");
    expect(document.getElementById(search.getAttribute("aria-activedescendant")!)).toHaveTextContent("Agent 599");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(document.getElementById(search.getAttribute("aria-activedescendant")!)).toHaveTextContent("Agent 0");
    fireEvent.keyDown(search, { key: "Enter" });
    expect(trigger).toHaveTextContent("Agent 0");
  });
});
