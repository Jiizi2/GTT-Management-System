import type { GroupAgreementHotel, InputItineraryItem, TransportMode } from "./app-domain-types";
import { getScheduleTypeOption, getTransportModeIcon, sortInputItineraryItems } from "./itinerary-domain";

/**
 * Flight data captured in Visa Detail (VisaSetup). The generator uses it to seed
 * the arrival/departure legs without requiring a full itinerary to exist first.
 */
export type VisaFlightInput = {
  arrivalFlightNumber?: string;
  arrivalTime?: string;
  departureFlightNumber?: string;
  departureTime?: string;
};

/**
 * Minimal Visa Detail data needed to derive the base trip structure. All of this
 * is already available on VisaDetailContext (agreements + group arrival/return +
 * the new flight fields), so no itinerary needs to be built by hand first.
 */
export type VisaItineraryInput = {
  arrivalDateIso?: string;
  returnDateIso?: string;
  makkahAgreements: GroupAgreementHotel[];
  madinahAgreements: GroupAgreementHotel[];
  flight?: VisaFlightInput;
};

type AgreementCity = "makkah" | "madinah";

type StayBlock = {
  city: AgreementCity;
  cityLabel: string;
  hotelName: string;
  startIso: string;
  endIso: string;
};

const CITY_LABEL: Record<AgreementCity, string> = {
  makkah: "Makkah",
  madinah: "Madinah",
};

function isValidIsoDate(value?: string): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function normalizeIso(value?: string): string {
  return value?.trim() ?? "";
}

function toCandidateStays(agreements: GroupAgreementHotel[], city: AgreementCity): StayBlock[] {
  return agreements
    .map((agreement) => ({
      city,
      cityLabel: CITY_LABEL[city],
      hotelName: agreement.hotelName?.trim() ?? "",
      startIso: normalizeIso(agreement.stayStartIso),
      endIso: normalizeIso(agreement.stayEndIso),
    }))
    .filter((stay) => isValidIsoDate(stay.startIso) && isValidIsoDate(stay.endIso) && stay.startIso < stay.endIso);
}

function sortStays(stays: StayBlock[]): StayBlock[] {
  return [...stays].sort((left, right) => {
    if (left.startIso !== right.startIso) {
      return left.startIso.localeCompare(right.startIso);
    }
    return left.endIso.localeCompare(right.endIso);
  });
}

/**
 * Merge consecutive stays in the same city into a single block. Multiple
 * agreements covering one city (contiguous or split) then read as one stay so the
 * generated timeline only shows real inter-city transfers.
 */
function coalesceSameCityStays(sorted: StayBlock[]): StayBlock[] {
  const result: StayBlock[] = [];
  for (const stay of sorted) {
    const last = result[result.length - 1];
    if (last && last.city === stay.city) {
      if (stay.endIso > last.endIso) {
        last.endIso = stay.endIso;
      }
      if (!last.hotelName && stay.hotelName) {
        last.hotelName = stay.hotelName;
      }
      continue;
    }
    result.push({ ...stay });
  }
  return result;
}

function makeItem(params: {
  id: string;
  dateIso: string;
  categoryKey: "arrival" | "transfer" | "departure";
  from: string;
  to: string;
  hotelName: string;
  fromHotelName?: string;
  flightNumber: string;
  time: string;
  transportMode: TransportMode;
}): InputItineraryItem {
  const option = getScheduleTypeOption(params.categoryKey);
  return {
    id: params.id,
    date: params.dateIso,
    time: params.time,
    category: option.cardLabel,
    categoryKey: params.categoryKey,
    transportMode: params.transportMode,
    hotelName: params.hotelName || undefined,
    fromHotelName: params.fromHotelName?.trim() || undefined,
    from: params.from,
    to: params.to,
    cityTourCity: "",
    flightNumber: params.flightNumber,
    requiresBus: params.transportMode === "bus",
    notes: "",
    icon: getTransportModeIcon(params.transportMode, params.categoryKey),
    transferByTrain: false,
    trainDepartureTime: "",
    destinationPickupTime: "",
    hotelPickupRequestTime: "",
  };
}

/**
 * Derive the base trip structure (arrival -> stays -> transfers -> departure)
 * purely from Visa Detail data. Cities are ordered by stay start date, so a
 * Madinah-first trip is handled the same as a Makkah-first one. Handles 1, 2, or
 * more than 2 city stays. Gaps/overlaps between agreements are surfaced by the
 * existing agreement-date validation, not here.
 *
 * Returns InputItineraryItem[] ready to feed the existing itinerary builders
 * (buildItineraryFromInputItems etc.). Empty when there is not enough data.
 */
export function buildItineraryFromVisaData(input: VisaItineraryInput): InputItineraryItem[] {
  const stays = coalesceSameCityStays(
    sortStays([
      ...toCandidateStays(input.makkahAgreements ?? [], "makkah"),
      ...toCandidateStays(input.madinahAgreements ?? [], "madinah"),
    ]),
  );

  const arrivalDate = isValidIsoDate(input.arrivalDateIso)
    ? normalizeIso(input.arrivalDateIso)
    : (stays[0]?.startIso ?? "");
  if (!arrivalDate) {
    return [];
  }

  const returnDate = isValidIsoDate(input.returnDateIso)
    ? normalizeIso(input.returnDateIso)
    : (stays[stays.length - 1]?.endIso ?? arrivalDate);

  const firstStay = stays[0];
  const lastStay = stays[stays.length - 1];

  let counter = 0;
  const nextId = (key: string) => `gen-${key}-${counter++}`;
  const items: InputItineraryItem[] = [];

  items.push(
    makeItem({
      id: nextId("arrival"),
      dateIso: arrivalDate,
      categoryKey: "arrival",
      from: "",
      to: firstStay?.cityLabel ?? "",
      hotelName: firstStay?.hotelName ?? "",
      flightNumber: input.flight?.arrivalFlightNumber?.trim() ?? "",
      time: input.flight?.arrivalTime?.trim() ?? "",
      transportMode: "flight",
    }),
  );

  for (let index = 0; index < stays.length - 1; index += 1) {
    const from = stays[index];
    const to = stays[index + 1];
    if (from.city === to.city) {
      continue;
    }
    items.push(
      makeItem({
        id: nextId("transfer"),
        dateIso: to.startIso,
        categoryKey: "transfer",
        from: from.cityLabel,
        to: to.cityLabel,
        hotelName: to.hotelName,
        fromHotelName: from.hotelName,
        flightNumber: "",
        time: "",
        transportMode: "bus",
      }),
    );
  }

  items.push(
    makeItem({
      id: nextId("departure"),
      dateIso: returnDate,
      categoryKey: "departure",
      from: lastStay?.cityLabel ?? "",
      to: "",
      hotelName: lastStay?.hotelName ?? "",
      flightNumber: input.flight?.departureFlightNumber?.trim() ?? "",
      time: input.flight?.departureTime?.trim() ?? "",
      transportMode: "flight",
    }),
  );

  return sortInputItineraryItems(items);
}
