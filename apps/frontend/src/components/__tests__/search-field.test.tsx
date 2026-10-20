import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SearchField } from "../search-field";

function SearchHarness({ disabled = false }: { disabled?: boolean }) {
  const [value, setValue] = useState("GTT-001");
  return <SearchField label="Cari group" value={value} onChange={setValue} disabled={disabled} />;
}

describe("shared search keyboard interaction", () => {
  it("clears the query from the keyboard and returns focus to the search input", async () => {
    const user = userEvent.setup();
    render(<SearchHarness />);
    await user.tab();
    expect(screen.getByRole("searchbox", { name: "Cari group" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Hapus pencarian" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("searchbox", { name: "Cari group" })).toHaveValue("");
    expect(screen.getByRole("searchbox", { name: "Cari group" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Hapus pencarian" })).not.toBeInTheDocument();
  });

  it("keeps a disabled query intact and skips both controls during keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<SearchHarness disabled />);
    expect(screen.getByRole("searchbox", { name: "Cari group" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hapus pencarian" })).toBeDisabled();
    await user.tab();
    expect(screen.getByRole("searchbox", { name: "Cari group" })).not.toHaveFocus();
    expect(screen.getByRole("searchbox", { name: "Cari group" })).toHaveValue("GTT-001");
  });
});
