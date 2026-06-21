import type { GroupAgreementHotel, GroupVisaSetup } from "../shared/app-domain";

function parseIsoDateToUtcMiddayMs(isoDate: string): number | null {
  const trimmed = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const parsed = new Date(`${trimmed}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.getTime();
}

function toIsoDateWithAddedDays(isoDate: string, dayOffset: number): string | null {
  const baseMs = parseIsoDateToUtcMiddayMs(isoDate);
  if (baseMs === null) {
    return null;
  }

  return new Date(baseMs + dayOffset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function sortHotelsByStayStart(hotels: GroupAgreementHotel[]): GroupAgreementHotel[] {
  return [...hotels].sort((left, right) => {
    const dateDiff = left.stayStartIso.localeCompare(right.stayStartIso);
    if (dateDiff !== 0) {
      return dateDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function getCityAgreementContinuityError(
  cityLabel: "Makkah" | "Madinah",
  hotels: GroupAgreementHotel[],
): string | null {
  if (hotels.length < 2) {
    return null;
  }

  const sortedHotels = sortHotelsByStayStart(hotels);
  for (let index = 0; index < sortedHotels.length; index += 1) {
    const currentHotel = sortedHotels[index];
    const currentStartMs = parseIsoDateToUtcMiddayMs(currentHotel.stayStartIso);
    const currentEndMs = parseIsoDateToUtcMiddayMs(currentHotel.stayEndIso);
    if (currentStartMs === null || currentEndMs === null) {
      return `Tanggal agreement ${cityLabel} tidak valid.`;
    }

    if (currentEndMs < currentStartMs) {
      return `Tanggal akhir agreement ${cityLabel} harus setelah atau sama dengan tanggal mulai.`;
    }

    if (index === 0) {
      continue;
    }

    const previousHotel = sortedHotels[index - 1];
    const expectedNextStartIso = toIsoDateWithAddedDays(previousHotel.stayEndIso, 1);
    if (!expectedNextStartIso) {
      return `Tanggal agreement ${cityLabel} tidak valid.`;
    }

    if (currentHotel.stayStartIso !== expectedNextStartIso) {
      return `Tanggal agreement ${cityLabel} harus tersambung. Setelah ${previousHotel.stayEndIso} wajib mulai ${expectedNextStartIso}.`;
    }
  }

  return null;
}

export function getVisaAgreementValidationError(visaSetup: GroupVisaSetup): string | null {
  const allHotels = [
    ...visaSetup.makkahHotels.map((h) => ({ ...h, city: "Makkah" as const })),
    ...visaSetup.madinahHotels.map((h) => ({ ...h, city: "Madinah" as const })),
  ];

  const sortedHotels = allHotels.sort((left, right) => {
    const dateDiff = left.stayStartIso.localeCompare(right.stayStartIso);
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return left.stayEndIso.localeCompare(right.stayEndIso);
  });

  for (let index = 1; index < sortedHotels.length; index += 1) {
    const previous = sortedHotels[index - 1];
    const current = sortedHotels[index];
    const previousEndMs = parseIsoDateToUtcMiddayMs(previous.stayEndIso);
    const currentStartMs = parseIsoDateToUtcMiddayMs(current.stayStartIso);

    if (previousEndMs !== null && currentStartMs !== null && currentStartMs < previousEndMs) {
      return `Stay periods tumpang tindih antara hotel di ${previous.city} (${previous.stayStartIso} s/d ${previous.stayEndIso}) dan ${current.city} (${current.stayStartIso} s/d ${current.stayEndIso}).`;
    }
  }

  const totalHotels = visaSetup.makkahHotels.length + visaSetup.madinahHotels.length;
  if (totalHotels > 0 && visaSetup.makkahHotels.length === 0) {
    return "Agreement Makkah wajib diisi minimal 1 hotel.";
  }

  const makkahContinuityError = getCityAgreementContinuityError("Makkah", visaSetup.makkahHotels);
  if (makkahContinuityError) {
    return makkahContinuityError;
  }

  const madinahContinuityError = getCityAgreementContinuityError("Madinah", visaSetup.madinahHotels);
  if (madinahContinuityError) {
    return madinahContinuityError;
  }

  return null;
}
