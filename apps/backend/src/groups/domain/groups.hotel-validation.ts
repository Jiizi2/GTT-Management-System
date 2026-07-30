import { BadRequestException } from "@nestjs/common";
import { AgreementCity } from "@prisma/client";
import { CreateGroupDto } from "../dto/create-group.dto";

type HotelAgreementDateSegment = {
  id?: string;
  city: AgreementCity;
  stayStart: string;
  stayEnd: string;
};

type ValidatedHotelAgreementDateSegment = HotelAgreementDateSegment & {
  stayStartMs: number;
  stayEndMs: number;
};

function parseIsoDateToUtcMiddayMs(isoDate: string): number | null {
  const trimmed = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const parsedDate = new Date(`${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.getTime();
}

function toAgreementCityLabel(city: AgreementCity): "Makkah" | "Madinah" {
  return city === AgreementCity.MAKKAH ? "Makkah" : "Madinah";
}

function validateAndSortHotelAgreementDateSegments(
  hotelAgreements: HotelAgreementDateSegment[],
): ValidatedHotelAgreementDateSegment[] {
  return hotelAgreements
    .map((agreement) => {
      const stayStart = agreement.stayStart.trim();
      const stayEnd = agreement.stayEnd.trim();
      const stayStartMs = parseIsoDateToUtcMiddayMs(stayStart);
      const stayEndMs = parseIsoDateToUtcMiddayMs(stayEnd);
      const cityLabel = toAgreementCityLabel(agreement.city);

      if (stayStartMs === null || stayEndMs === null) {
        throw new BadRequestException(
          `${cityLabel} agreement dates must use YYYY-MM-DD format.`,
        );
      }

      if (stayEndMs < stayStartMs) {
        throw new BadRequestException(
          `${cityLabel} agreement end date must be on or after the start date.`,
        );
      }

      return {
        ...agreement,
        stayStart,
        stayEnd,
        stayStartMs,
        stayEndMs,
      };
    })
    .sort((left, right) => {
      if (left.stayStartMs !== right.stayStartMs) {
        return left.stayStartMs - right.stayStartMs;
      }

      if (left.stayEndMs !== right.stayEndMs) {
        return left.stayEndMs - right.stayEndMs;
      }

      return left.city.localeCompare(right.city);
    });
}

function mergeHotelAgreementSegments(
  segments: ValidatedHotelAgreementDateSegment[],
): ValidatedHotelAgreementDateSegment[] {
  if (segments.length === 0) {
    return [];
  }

  const merged: ValidatedHotelAgreementDateSegment[] = [];
  let current = { ...segments[0] };

  for (let index = 1; index < segments.length; index += 1) {
    const next = segments[index];
    if (next.stayStartMs <= current.stayEndMs) {
      if (next.stayEndMs > current.stayEndMs) {
        current.stayEnd = next.stayEnd;
        current.stayEndMs = next.stayEndMs;
      }
      continue;
    }

    merged.push(current);
    current = { ...next };
  }

  merged.push(current);
  return merged;
}

function validateHotelAgreementContinuity(
  hotelAgreements: HotelAgreementDateSegment[],
): void {
  const validatedAndSorted = validateAndSortHotelAgreementDateSegments(
    hotelAgreements,
  );

  const makkahSegments = validatedAndSorted.filter(
    (agreement) => agreement.city === AgreementCity.MAKKAH,
  );
  const madinahSegments = validatedAndSorted.filter(
    (agreement) => agreement.city === AgreementCity.MADINAH,
  );

  const mergedMakkah = mergeHotelAgreementSegments(makkahSegments);
  const mergedMadinah = mergeHotelAgreementSegments(madinahSegments);

  const combinedAndSorted = [...mergedMakkah, ...mergedMadinah].sort(
    (left, right) => left.stayStartMs - right.stayStartMs,
  );

  for (let index = 1; index < combinedAndSorted.length; index += 1) {
    const previous = combinedAndSorted[index - 1];
    const current = combinedAndSorted[index];
    if (current.stayStart !== previous.stayEnd) {
      // INTENTIONALLY EMPTY - this is not an unfinished implementation.
      //
      // A gap between Makkah and Madinah stay periods is a SOFT WARNING by
      // product decision (confirmed 2026-07-30): it must never become a
      // BadRequestException, because operators legitimately save groups whose
      // agreements are not yet contiguous. Overlaps are different and DO throw,
      // in validateHotelAgreementRules above.
      //
      // Displaying the warning is the frontend's job. Caveat for whoever picks
      // this up: the only frontend implementation
      // (validateConnectedAgreementDates / getAgreementSaveValidationError in
      // pages/new-group/helpers/new-group-screen-helpers.ts) was orphaned when
      // the new-group wizard was retired, so the warning currently renders
      // nowhere. The rule is intended but not visible to operators yet.
    }
  }
}

export function validateHotelAgreementRules(
  hotelAgreements: Array<{
    id?: string;
    city: AgreementCity;
    stayStart: string;
    stayEnd: string;
  }>,
  options: { requireMakkah?: boolean } = {},
): void {
  if (hotelAgreements.length === 0) {
    return;
  }

  const validatedAndSorted = validateAndSortHotelAgreementDateSegments(
    hotelAgreements,
  );

  for (let index = 1; index < validatedAndSorted.length; index += 1) {
    const previous = validatedAndSorted[index - 1];
    const current = validatedAndSorted[index];
    if (current.stayStartMs < previous.stayEndMs) {
      const prevCity = toAgreementCityLabel(previous.city);
      const currCity = toAgreementCityLabel(current.city);
      throw new BadRequestException(
        `Stay periods tumpang tindih antara hotel di ${prevCity} (${previous.stayStart} s/d ${previous.stayEnd}) dan ${currCity} (${current.stayStart} s/d ${current.stayEnd}).`,
      );
    }
  }

  validateHotelAgreementContinuity(hotelAgreements);
}

export function validateCreateOrReplaceHotelAgreementRules(
  payload: CreateGroupDto,
): void {
  const agreements = payload.visaSetup?.hotelAgreements ?? [];
  validateHotelAgreementRules(
    agreements.map((agreement, index) => ({
      id: `payload-${index + 1}`,
      city: agreement.city ?? AgreementCity.MAKKAH,
      stayStart: agreement.stayStart,
      stayEnd: agreement.stayEnd,
    })),
  );
}
