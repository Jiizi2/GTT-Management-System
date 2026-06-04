import { BadRequestException } from "@nestjs/common";
import { AgreementCity } from "@prisma/client";
import { CreateGroupDto } from "../dto/create-group.dto";
import { DAY_IN_MS } from "../groups.service-types";

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

function addDaysToIsoDate(isoDate: string, days: number): string | null {
  const baseMs = parseIsoDateToUtcMiddayMs(isoDate);
  if (baseMs === null) {
    return null;
  }

  return new Date(baseMs + days * DAY_IN_MS).toISOString().slice(0, 10);
}

function validateCityHotelAgreementContinuity(
  city: AgreementCity,
  hotelAgreements: Array<{ id?: string; stayStart: string; stayEnd: string }>,
): void {
  if (hotelAgreements.length < 2) {
    return;
  }

  const sortedAgreements = [...hotelAgreements].sort((left, right) =>
    left.stayStart.localeCompare(right.stayStart),
  );
  const cityLabel = city === AgreementCity.MAKKAH ? "Makkah" : "Madinah";

  for (let index = 0; index < sortedAgreements.length; index += 1) {
    const current = sortedAgreements[index];
    const currentStartMs = parseIsoDateToUtcMiddayMs(current.stayStart);
    const currentEndMs = parseIsoDateToUtcMiddayMs(current.stayEnd);
    if (currentStartMs === null || currentEndMs === null) {
      throw new BadRequestException(
        `${cityLabel} agreement dates must use YYYY-MM-DD format.`,
      );
    }

    if (currentEndMs < currentStartMs) {
      throw new BadRequestException(
        `${cityLabel} agreement end date must be on or after the start date.`,
      );
    }

    if (index === 0) {
      continue;
    }

    const previous = sortedAgreements[index - 1];
    const expectedNextStart = addDaysToIsoDate(previous.stayEnd, 1);
    if (!expectedNextStart) {
      throw new BadRequestException(
        `${cityLabel} agreement dates must use YYYY-MM-DD format.`,
      );
    }

    if (current.stayStart !== expectedNextStart) {
      throw new BadRequestException(
        `${cityLabel} agreement dates must be consecutive. Expected ${expectedNextStart} after ${previous.stayEnd}.`,
      );
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
    throw new BadRequestException(
      "Makkah agreement is required when hotel agreements are provided.",
    );
  }

  validateCityHotelAgreementContinuity(
    AgreementCity.MAKKAH,
    hotelAgreements.filter(
      (agreement) => agreement.city === AgreementCity.MAKKAH,
    ),
  );
  validateCityHotelAgreementContinuity(
    AgreementCity.MADINAH,
    hotelAgreements.filter(
      (agreement) => agreement.city === AgreementCity.MADINAH,
    ),
  );
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
