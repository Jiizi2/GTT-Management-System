import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DepartureMonthPicker } from "../../agent/components/departure-month-picker";

describe("Agent departure month picker", () => {
  it("supports keyboard month selection, restores focus and reopens on the updated value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(<DepartureMonthPicker value="2026-10" currentMonth="2026-10" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Pilih bulan keberangkatan" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const popup = await screen.findByRole("dialog", { name: "Pilih bulan dan tahun keberangkatan" });
    expect(within(popup).getByRole("button", { name: "Oktober 2026" })).toHaveFocus();
    await user.keyboard("{ArrowRight}{Enter}");
    expect(onChange).toHaveBeenCalledWith("2026-11");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    view.rerender(<DepartureMonthPicker value="2027-02" currentMonth="2026-10" onChange={onChange} />);
    await user.click(trigger);
    expect(await screen.findByRole("button", { name: "Februari 2027" })).toHaveAttribute("aria-pressed", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("browses years without changing the calendar, dismisses outside and returns to the current month", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DepartureMonthPicker value="2026-10" currentMonth="2026-12" onChange={onChange} />);
    const trigger = screen.getByRole("button", { name: "Pilih bulan keberangkatan" });
    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: "Tahun berikutnya" }));
    expect(screen.getByRole("button", { name: "Januari 2027" })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(trigger);
    expect(await screen.findByRole("button", { name: "Oktober 2026" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Bulan ini" }));
    expect(onChange).toHaveBeenCalledWith("2026-12");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
