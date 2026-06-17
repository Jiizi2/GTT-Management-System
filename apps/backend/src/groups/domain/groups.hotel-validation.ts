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
      // Soft rules: Do not throw BadRequestException for gaps or disconnected dates.
      // The frontend will handle displaying warnings to the user.
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

  const shouldRequireMakkah = options.requireMakkah ?? true;
  const makkahHotels = hotelAgreements.filter(
    (agreement) => agreement.city === AgreementCity.MAKKAH,
  );
  if (shouldRequireMakkah && makkahHotels.length === 0) {
    // Soft rules: Do not throw BadRequestException if Makkah agreement is missing.
    // The frontend will handle displaying warnings to the user.
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
