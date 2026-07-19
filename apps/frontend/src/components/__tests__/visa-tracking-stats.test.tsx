import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisaTrackingStats } from "../../pages/visa-tracking/components/VisaTrackingStats";

describe("VisaTrackingStats", () => {
  it("shows selected-month and all-time issued totals separately", () => {
    render(
      <VisaTrackingStats
        visaRowsCount={9}
        actionRequiredCount={2}
        unpaidCount={3}
        selectedMonthLabel="Juli 2026"
        issuedStatistics={{
          selectedMonthPax: 25,
          selectedMonthGroups: 2,
          overallPax: 52,
          overallGroups: 4,
          missingIssuedDateGroups: 1,
        }}
      />,
    );

    expect(screen.getByText("Visa Issued")).toBeInTheDocument();
    expect(screen.getByText("Juli 2026")).toBeInTheDocument();
    expect(screen.queryByText(/belum memiliki tanggal terbit/)).not.toBeInTheDocument();
  });
});
