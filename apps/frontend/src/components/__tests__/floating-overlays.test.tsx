import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DatePickerInput } from "../date-time-pickers";
import { ResponsiveDisclosure } from "../responsive-disclosure";
import { SereneSelect } from "../serene-select";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("responsive filter disclosure", () => {
  it("floats on desktop, supports a nested calendar, and stays in flow after switching to mobile", async () => {
    let desktop = true;
    const media = new EventTarget();
    Object.defineProperty(media, "matches", { get: () => desktop });
    vi.stubGlobal("matchMedia", () => media);
    const user = userEvent.setup();
    render(
      <ResponsiveDisclosure label="Period filters" summary="Stay Period">
        <DatePickerInput value="2026-10-23" onChange={vi.fn()} inputClassName="test-input" />
      </ResponsiveDisclosure>,
    );
    await user.click(screen.getByText("Stay Period"));
    const panel = await screen.findByRole("group", { name: "Period filters" });
    expect(panel.parentElement).toBe(document.body);
    await waitFor(() => expect(panel).toHaveFocus());
    await user.tab();
    expect(screen.getByRole("dialog", { name: "Select date" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Select date" })).not.toBeInTheDocument();
    expect(panel).toBeInTheDocument();
    act(() => {
      desktop = false;
      media.dispatchEvent(new Event("change"));
    });
    expect(screen.getByRole("group", { name: "Period filters" }).closest("details")).toHaveAttribute("open");
    await user.click(screen.getByText("Stay Period"));
    expect(screen.getByText("Stay Period").closest("details")).not.toHaveAttribute("open");
  });

  it("closes the desktop panel with Escape and returns focus to its summary", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const user = userEvent.setup();
    render(
      <ResponsiveDisclosure label="Period filters" summary="Stay Period">
        <button>Filter</button>
      </ResponsiveDisclosure>,
    );
    await user.click(screen.getByText("Stay Period"));
    const panel = await screen.findByRole("group", { name: "Period filters" });
    await waitFor(() => expect(panel).toHaveFocus());
    await user.keyboard("{Escape}");
    await waitFor(() => expect(panel).not.toBeInTheDocument());
    expect(screen.getByText("Stay Period")).toHaveFocus();
  });
});

describe("limited viewport space", () => {
  function constrainViewport() {
    vi.stubGlobal("innerWidth", 220);
    vi.stubGlobal("innerHeight", 200);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 8,
      y: 100,
      top: 100,
      bottom: 140,
      left: 8,
      right: 108,
      width: 100,
      height: 40,
      toJSON: () => ({}),
    });
  }

  it("keeps the calendar width and height within available space", () => {
    constrainViewport();
    render(<DatePickerInput value="2026-10-23" onChange={vi.fn()} inputClassName="test-input" />);
    fireEvent.click(screen.getByRole("textbox"));
    const popup = screen.getByRole("dialog", { name: "Select date" });
    expect(Number.parseFloat(popup.style.left) + Number.parseFloat(popup.style.width)).toBeLessThanOrEqual(212);
    expect(Number.parseFloat(popup.style.maxHeight)).toBeLessThanOrEqual(84);
  });

  it("keeps select options scrollable within the available space above the trigger", () => {
    constrainViewport();
    render(
      <SereneSelect value="a">
        <option value="a">A</option>
        <option value="b">B</option>
      </SereneSelect>,
    );
    fireEvent.click(screen.getByRole("button"));
    const popup = screen.getByRole("listbox").parentElement!;
    expect(Number.parseFloat(popup.style.maxHeight)).toBeLessThanOrEqual(86);
  });
});
