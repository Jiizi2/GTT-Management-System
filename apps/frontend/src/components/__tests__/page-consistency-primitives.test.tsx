import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DetailItem, DetailList } from "../detail-list";
import { SegmentedControl } from "../filter-panel";
import { MetricCard } from "../metric-card";
import { PageHeader } from "../page-header";
import { PageLayout } from "../page-layout";
import { ReadOnlyIndicator } from "../read-only-indicator";
import { StatePanel } from "../state-panel";
import { StatusBadge } from "../status-badge";

describe("page consistency primitives", () => {
  it("renders one shared page hierarchy", () => {
    render(
      <PageLayout width="wide">
        <PageHeader
          eyebrow="Workspace"
          title="Agreement Inbox"
          description="Description"
          actions={<ReadOnlyIndicator />}
        />
        <MetricCard icon="groups" label="Active Groups" value={3} />
      </PageLayout>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Agreement Inbox" })).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(screen.getByText("Active Groups")).toBeInTheDocument();
  });

  it("exposes segmented filters as pressed buttons", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        value="all"
        options={[
          { value: "all", label: "All" },
          { value: "issued", label: "Issued" },
        ]}
        onChange={onChange}
        ariaLabel="Visa status"
      />,
    );
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Issued" }));
    expect(onChange).toHaveBeenCalledWith("issued");
  });

  it("renders consistent state, status, and details", () => {
    render(
      <>
        <StatePanel state="empty" title="Belum ada invoice" description="Invoice akan muncul kemudian." />
        <StatusBadge tone="waiting">Waiting</StatusBadge>
        <DetailList>
          <DetailItem label="Agent" value="JSA" />
        </DetailList>
      </>,
    );
    expect(screen.getByRole("heading", { name: "Belum ada invoice" })).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("JSA")).toBeInTheDocument();
  });
});
