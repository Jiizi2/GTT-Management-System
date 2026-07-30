/**
 * Makkah/Madinah hotel agreement date continuity - the SOFT WARNING rule.
 *
 * The backend deliberately does not reject gaps between stay periods (see the
 * intentionally-empty branch in
 * apps/backend/src/groups/domain/groups.hotel-validation.ts); it delegates the
 * warning to the frontend. This module is that implementation. Overlaps are a
 * different matter and are still rejected server-side.
 *
 * Inputs are typed as AgreementStayPeriod so both the persisted
 * GroupAgreementHotel and the wizard's NewGroupAgreementFormState satisfy it -
 * only the two ISO dates are read.
 */
import { isIsoDateValue } from "./app-domain.js";

/** Anything carrying a stay window: persisted agreement or in-progress form. */
export type AgreementStayPeriod = {
  stayStartIso: string;
  stayEndIso: string;
};

type AgreementDateRange = {
  startIso: string;
  endIso: string;
};

export type AgreementDateCity = "makkah" | "madinah";

type AgreementDateSegment = AgreementDateRange & {
  city: AgreementDateCity;
};

export type AgreementDateConnectionValidation = {
  cityWarnings: {
    makkah: string | null;
    madinah: string | null;
  };
  crossCityWarning: string | null;
  hasWarning: boolean;
};

export function toAgreementCityLabel(city: AgreementDateCity): "Makkah" | "Madinah" {
  return city === "makkah" ? "Makkah" : "Madinah";
}

function collectValidAgreementDateRanges(
  forms: readonly AgreementStayPeriod[],
  city: AgreementDateCity,
): AgreementDateSegment[] {
  return forms
    .map((form) => {
      const startIso = form.stayStartIso.trim();
      const endIso = form.stayEndIso.trim();
      return { city, startIso, endIso };
    })
    .filter((range) => isIsoDateValue(range.startIso) && isIsoDateValue(range.endIso) && range.endIso >= range.startIso)
    .sort((left, right) => {
      if (left.startIso === right.startIso) {
        return left.endIso.localeCompare(right.endIso);
      }

      return left.startIso.localeCompare(right.startIso);
    });
}

function mergeAgreementDateRanges(ranges: AgreementDateSegment[]): AgreementDateSegment[] {
  if (ranges.length === 0) {
    return [];
  }

  const mergedRanges: AgreementDateSegment[] = [];
  let currentRange = { ...ranges[0] };

  for (let index = 1; index < ranges.length; index += 1) {
    const nextRange = ranges[index];
    if (nextRange.startIso <= currentRange.endIso) {
      if (nextRange.endIso > currentRange.endIso) {
        currentRange.endIso = nextRange.endIso;
      }
      continue;
    }

    mergedRanges.push(currentRange);
    currentRange = { ...nextRange };
  }

  mergedRanges.push(currentRange);
  return mergedRanges;
}

export function validateConnectedAgreementDates<
  TMakkah extends AgreementStayPeriod,
  TMadinah extends AgreementStayPeriod,
>(
  makkahHotels: readonly TMakkah[],
  madinahHotels: readonly TMadinah[],
): AgreementDateConnectionValidation {
  const sortedSegments = [
    ...mergeAgreementDateRanges(collectValidAgreementDateRanges(makkahHotels, "makkah")),
    ...mergeAgreementDateRanges(collectValidAgreementDateRanges(madinahHotels, "madinah")),
  ].sort((left, right) => {
    if (left.startIso === right.startIso) {
      if (left.endIso === right.endIso) {
        return left.city.localeCompare(right.city);
      }

      return left.endIso.localeCompare(right.endIso);
    }

    return left.startIso.localeCompare(right.startIso);
  });
  let makkahWarning: string | null = null;
  let madinahWarning: string | null = null;
  let crossCityWarning: string | null = null;

  for (let index = 1; index < sortedSegments.length; index += 1) {
    const previousSegment = sortedSegments[index - 1];
    const currentSegment = sortedSegments[index];
    if (previousSegment.endIso === currentSegment.startIso) {
      continue;
    }

    const previousLabel = toAgreementCityLabel(previousSegment.city);
    const currentLabel = toAgreementCityLabel(currentSegment.city);
    const detailMessage = `${previousLabel} Stay End ${previousSegment.endIso} must match ${currentLabel} Stay Start ${currentSegment.startIso}.`;
    if (previousSegment.city === currentSegment.city) {
      if (previousSegment.city === "makkah" && !makkahWarning) {
        makkahWarning = `Makkah agreement dates must be connected. ${detailMessage}`;
      } else if (previousSegment.city === "madinah" && !madinahWarning) {
        madinahWarning = `Madinah agreement dates must be connected. ${detailMessage}`;
      }
      continue;
    }

    if (!crossCityWarning) {
      crossCityWarning = `Makkah and Madinah agreement dates must be connected. ${detailMessage}`;
    }
  }

  return {
    cityWarnings: {
      makkah: makkahWarning,
      madinah: madinahWarning,
    },
    crossCityWarning,
    hasWarning: Boolean(makkahWarning || madinahWarning || crossCityWarning),
  };
}
