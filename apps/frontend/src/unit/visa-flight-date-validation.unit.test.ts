import { describe, expect, it } from "vitest";
import { validateFlightDatesAgainstAgreement } from "../shared/visa-flight-date-validation";

const bounds = {
  agreementStartDate: "2026-09-21",
  agreementEndDate: "2026-09-29",
};

describe("visa flight date validation", () => {
  it.each(["2026-09-20", "2026-09-21", "2026-09-22"])("accepts arrival date %s", (arrivalFlightDate) => {
    expect(
      validateFlightDatesAgainstAgreement({ ...bounds, arrivalFlightDate, departureFlightDate: "2026-09-29" }),
    ).toEqual({});
  });

  it.each(["2026-09-29", "2026-09-30"])("accepts departure date %s", (departureFlightDate) => {
    expect(
      validateFlightDatesAgainstAgreement({ ...bounds, arrivalFlightDate: "2026-09-21", departureFlightDate }),
    ).toEqual({});
  });

  it("returns field-specific messages for dates outside the agreement tolerance", () => {
    expect(
      validateFlightDatesAgainstAgreement({
        ...bounds,
        arrivalFlightDate: "2026-09-19",
        departureFlightDate: "2026-10-01",
      }),
    ).toEqual({
      arrival: "Tanggal kedatangan harus antara 20 Sept 2026 dan 22 Sept 2026.",
      departure: "Tanggal kepulangan harus 29 Sept 2026 atau 30 Sept 2026.",
    });
  });
});
