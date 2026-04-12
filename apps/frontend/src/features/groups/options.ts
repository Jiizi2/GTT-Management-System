import type {
  ChecklistDriverDraft,
  ChecklistDriverProfile,
  GroupData,
  InputItineraryFormState,
  InputItineraryItem,
  NewGroupAgreementFormState,
  NewGroupRaudhahFormState,
  NoteFormState,
  NoteItem,
  ScheduleFormState,
} from "../../shared/app-domain-types.js";

export const groups: GroupData[] = [];

export const scheduleTypeOptions = [
  { value: "arrival", cardLabel: "Arrival", modalLabel: "Arrival", icon: "flight_land" },
  { value: "city-tour", cardLabel: "City Tour", modalLabel: "City Tour", icon: "tour" },
  { value: "transfer", cardLabel: "Transfer", modalLabel: "Transfer", icon: "airport_shuttle" },
  { value: "departure", cardLabel: "Departure", modalLabel: "Departure", icon: "flight_takeoff" },
] as const;

export const saudiCityOptions = [
  "Makkah",
  "Madinah",
  "Jeddah",
  "Riyadh",
  "Taif",
  "Abha",
  "Tabuk",
  "Dammam",
  "Khobar",
  "Buraidah",
  "AlUla",
  "Yanbu",
  "Hail",
  "Jubail",
  "Najran",
  "Jazan",
  "Al Ahsa",
  "Qassim",
] as const;

const SAUDI_CITY_OPTIONS_STORAGE_KEY = "gtt-master-saudi-city-options-v1";

function normalizeSaudiCityOptionsList(options: readonly string[]): string[] {
  return Array.from(
    new Set(
      options
        .map((city) => city.trim())
        .filter((city) => city.length > 0),
    ),
  );
}

function readPersistedSaudiCityOptions(): string[] | null {
  if (typeof window === "undefined") {
    return null;
  }

  const runtimeOptions = (window as { __GTT_SAUDI_CITY_OPTIONS__?: unknown }).__GTT_SAUDI_CITY_OPTIONS__;
  if (Array.isArray(runtimeOptions)) {
    const normalizedRuntime = normalizeSaudiCityOptionsList(
      runtimeOptions.filter((entry): entry is string => typeof entry === "string"),
    );
    if (normalizedRuntime.length > 0) {
      return normalizedRuntime;
    }
  }

  try {
    const rawStorageValue = window.localStorage.getItem(SAUDI_CITY_OPTIONS_STORAGE_KEY);
    if (!rawStorageValue) {
      return null;
    }

    const parsed = JSON.parse(rawStorageValue) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    const normalizedStored = normalizeSaudiCityOptionsList(
      parsed.filter((entry): entry is string => typeof entry === "string"),
    );
    return normalizedStored.length > 0 ? normalizedStored : null;
  } catch {
    return null;
  }
}

export function getSaudiCityOptions(): string[] {
  return readPersistedSaudiCityOptions() ?? [...saudiCityOptions];
}

export function registerSaudiCityOptions(options: readonly string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizeSaudiCityOptionsList(options);
  if (normalized.length === 0) {
    return;
  }

  (window as { __GTT_SAUDI_CITY_OPTIONS__?: string[] }).__GTT_SAUDI_CITY_OPTIONS__ = normalized;
  try {
    window.localStorage.setItem(SAUDI_CITY_OPTIONS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage write errors.
  }
}

export const OVERVIEW_PAGE_SIZE = 9;
export const CHECKLIST_PAGE_SIZE = 6;
export const VISA_PAGE_SIZE = 15;
export const MAX_PAX_PER_BUS = 50;

export function getMinimumBusCountForPax(pax: number): number {
  const safePax = Number.isFinite(pax) && pax > 0 ? pax : 1;
  return Math.max(1, Math.ceil(safePax / MAX_PAX_PER_BUS));
}

export function resolveTotalBusCount(pax: number, requestedTotalBuses?: number): number {
  const minimumBusCount = getMinimumBusCountForPax(pax);
  if (!Number.isFinite(requestedTotalBuses) || !requestedTotalBuses || requestedTotalBuses < 1) {
    return minimumBusCount;
  }

  return Math.max(minimumBusCount, Math.floor(requestedTotalBuses));
}

export function createInitialInputItineraryForm(): InputItineraryFormState {
  return {
    date: "",
    time: "",
    category: scheduleTypeOptions[1].value,
    hotelName: "",
    fromHotelName: "",
    from: "",
    to: "",
    cityTourCity: "",
    flightNumber: "",
    requiresBus: true,
    notes: "",
    transferByTrain: false,
    trainDepartureTime: "",
    destinationPickupTime: "",
    hotelPickupRequestTime: "",
  };
}

export function createNewGroupAgreementForm(city: "makkah" | "madinah"): NewGroupAgreementFormState {
  return {
    id: `${city}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    hotelName: "",
    agreementNumber: "",
    pax: "",
    status: "Waiting for Approval",
    stayStartIso: "",
    stayEndIso: "",
  };
}

export function createNewGroupRaudhahForm(): NewGroupRaudhahFormState {
  return {
    id: `raudhah-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dateIso: "",
    status: "Free",
    tasrehPrinted: false,
  };
}

export function sortInputItineraryItems(items: InputItineraryItem[]): InputItineraryItem[] {
  return [...items].sort((left, right) => {
    const leftKey = `${left.date}T${left.time || "00:00"}`;
    const rightKey = `${right.date}T${right.time || "00:00"}`;
    return leftKey.localeCompare(rightKey);
  });
}

export function createInitialScheduleForm(): ScheduleFormState {
  return {
    category: scheduleTypeOptions[1].value,
    date: "",
    time: "",
    flightNumber: "",
    hotelName: "",
    fromHotelName: "",
    from: "",
    to: "",
    cityTourCity: "",
    note: "",
    highlighted: false,
    transferByTrain: false,
    trainDepartureTime: "",
    destinationPickupTime: "",
    hotelPickupRequestTime: "",
  };
}

export function createInitialNoteForm(): NoteFormState {
  return {
    text: "",
    pinned: false,
  };
}

export function createEmptyChecklistDriverProfile(): ChecklistDriverProfile {
  return {
    name: "",
    phone: "",
    plateNumber: "",
  };
}

export function createEmptyChecklistDraft(): ChecklistDriverDraft {
  return createEmptyChecklistDriverProfile();
}

export function createNoteItems(notes: string[], groupCode: string): NoteItem[] {
  return notes.map((note, index) => ({
    id: `${groupCode}-note-${index}`,
    text: note,
    pinned: false,
  }));
}

export function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: "smooth" });
}
