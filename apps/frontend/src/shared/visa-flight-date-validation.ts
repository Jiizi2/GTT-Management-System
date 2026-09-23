import type { GroupAgreementHotel } from "./app-domain-types";
import { formatVisaDateWithYear, isIsoDateValue } from "./app-domain";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function addIsoDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function resolveFlightAgreementDateBounds(agreements: GroupAgreementHotel[]): {
  agreementStartDate: string;
  agreementEndDate: string;
} {
  const starts = agreements.map((agreement) => agreement.stayStartIso.trim()).filter(isIsoDateValue).sort();
  const ends = agreements.map((agreement) => agreement.stayEndIso.trim()).filter(isIsoDateValue).sort();
  return {
    agreementStartDate: starts[0] ?? "",
    agreementEndDate: ends[ends.length - 1] ?? "",
  };
}

export function validateFlightDatesAgainstAgreement({
  arrivalFlightDate,
  departureFlightDate,
  agreementStartDate,
  agreementEndDate,
}: {
  arrivalFlightDate: string;
  departureFlightDate: string;
  agreementStartDate?: string;
  agreementEndDate?: string;
}): { arrival?: string; departure?: string } {
  const errors: { arrival?: string; departure?: string } = {};

  if (isIsoDateValue(arrivalFlightDate) && agreementStartDate && isIsoDateValue(agreementStartDate)) {
    const earliestArrival = addIsoDays(agreementStartDate, -1);
    const latestArrival = addIsoDays(agreementStartDate, 1);
    if (arrivalFlightDate < earliestArrival || arrivalFlightDate > latestArrival) {
      errors.arrival = `Tanggal kedatangan harus antara ${formatVisaDateWithYear(earliestArrival)} dan ${formatVisaDateWithYear(latestArrival)}.`;
    }
  }

  if (isIsoDateValue(departureFlightDate) && agreementEndDate && isIsoDateValue(agreementEndDate)) {
    const latestDeparture = addIsoDays(agreementEndDate, 1);
    if (departureFlightDate < agreementEndDate || departureFlightDate > latestDeparture) {
      errors.departure = `Tanggal kepulangan harus ${formatVisaDateWithYear(agreementEndDate)} atau ${formatVisaDateWithYear(latestDeparture)}.`;
    }
  }

  return errors;
}
