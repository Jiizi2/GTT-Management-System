/**
 * RETAINED ON PURPOSE - the folder name is misleading.
 *
 * The `new-group` wizard this used to serve was deleted (PR #90); only these
 * helpers survive. They are kept because `validateConnectedAgreementDates` and
 * `getAgreementSaveValidationError` are the ONLY implementation of the
 * Makkah/Madinah agreement date gap SOFT WARNING, which the backend explicitly
 * delegates to the frontend (see the intentionally-empty branch in
 * apps/backend/src/groups/domain/groups.hotel-validation.ts).
 *
 * Current state: no live UI calls them, so the warning renders nowhere. The
 * accompanying smoke tests are the only surviving specification of the rule -
 * roughly ten scenarios covering connected, gapped, and out-of-order stays.
 * Deleting this file would erase that specification.
 *
 * Whoever wires the warning back into the live agreement UI
 * (pages/visa-detail/components/HotelAgreementSection.tsx) should move this
 * module somewhere honest, e.g. shared/agreement-date-validation.ts.
 */
import type {
  BusStatus,
  GroupAgreementHotel,
  GroupData,
  GroupRaudhahStatus,
  ItineraryItem,
  ItineraryPrefill,
  NewGroupAgreementFormState,
  NewGroupItineraryDraft,
  NewGroupRaudhahFormState,
  VisaStatus,
} from "../../../shared/app-domain.js";
import {
  formatScheduleDate,
  formatScheduleTime,
  getLocalIsoDateWithOffset,
  getMinimumBusCountForPax,
  isIsoDateValue,
  musyrifAvatar,
  resolveVisaAgreementNumber,
  shiftIsoDate,
} from "../../../shared/app-domain.js";

type AgreementDateRange = {
  startIso: string;
  endIso: string;
};

type AgreementDateCity = "makkah" | "madinah";

type AgreementDateSegment = AgreementDateRange & {
  city: AgreementDateCity;
};

function hasAgreementFormInput(form: NewGroupAgreementFormState): boolean {
  return [
    form.hotelName.trim(),
    form.agreementNumber.trim(),
    form.pax.trim(),
    form.stayStartIso.trim(),
    form.stayEndIso.trim(),
  ].some(Boolean);
}

function getAgreementFormsWithInput(forms: NewGroupAgreementFormState[]): NewGroupAgreementFormState[] {
  return forms.filter((form) => hasAgreementFormInput(form));
}

export type AgreementDateConnectionValidation = {
  cityWarnings: {
    makkah: string | null;
    madinah: string | null;
  };
  crossCityWarning: string | null;
  hasWarning: boolean;
};

function toAgreementCityLabel(city: AgreementDateCity): "Makkah" | "Madinah" {
  return city === "makkah" ? "Makkah" : "Madinah";
}

function collectValidAgreementDateRanges(
  forms: NewGroupAgreementFormState[],
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

export function validateConnectedAgreementDates(
  makkahHotels: NewGroupAgreementFormState[],
  madinahHotels: NewGroupAgreementFormState[],
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

function getAgreementFieldValidationError(city: AgreementDateCity, forms: NewGroupAgreementFormState[]): string | null {
  const populatedForms = getAgreementFormsWithInput(forms);
  for (const form of populatedForms) {
    const agreementIndex = forms.findIndex((entry) => entry.id === form.id);
    const hotelNumber = agreementIndex >= 0 ? agreementIndex + 1 : populatedForms.indexOf(form) + 1;
    const cityLabel = toAgreementCityLabel(city);
    const labelPrefix = `${cityLabel} hotel ${hotelNumber}`;
    const hotelName = form.hotelName.trim();
    const agreementNumber = form.agreementNumber.trim();
    const pax = form.pax.trim();
    const stayStartIso = form.stayStartIso.trim();
    const stayEndIso = form.stayEndIso.trim();

    if (!hotelName) {
      return `${labelPrefix}: hotel name wajib diisi.`;
    }

    if (!agreementNumber) {
      return `${labelPrefix}: agreement number wajib diisi.`;
    }

    if (!pax) {
      return `${labelPrefix}: total pax wajib diisi.`;
    }

    const parsedPax = Number.parseInt(pax, 10);
    if (!Number.isInteger(parsedPax) || parsedPax <= 0) {
      return `${labelPrefix}: total pax harus lebih dari 0.`;
    }

    if (!stayStartIso) {
      return `${labelPrefix}: stay start wajib diisi.`;
    }

    if (!isIsoDateValue(stayStartIso)) {
      return `${labelPrefix}: stay start tidak valid.`;
    }

    if (!stayEndIso) {
      return `${labelPrefix}: stay end wajib diisi.`;
    }

    if (!isIsoDateValue(stayEndIso)) {
      return `${labelPrefix}: stay end tidak valid.`;
    }

    if (stayEndIso < stayStartIso) {
      return `${labelPrefix}: stay end tidak boleh sebelum stay start.`;
    }
  }

  return null;
}

export function getAgreementSaveValidationError(
  makkahHotels: NewGroupAgreementFormState[],
  madinahHotels: NewGroupAgreementFormState[],
): string | null {
  const populatedMakkahHotels = getAgreementFormsWithInput(makkahHotels);
  const populatedMadinahHotels = getAgreementFormsWithInput(madinahHotels);
  const hasAnyAgreementInput = populatedMakkahHotels.length > 0 || populatedMadinahHotels.length > 0;

  if (!hasAnyAgreementInput) {
    return "Isi agreement hotel terlebih dahulu sebelum menekan save.";
  }

  const makkahFieldError = getAgreementFieldValidationError("makkah", makkahHotels);
  if (makkahFieldError) {
    return makkahFieldError;
  }

  const madinahFieldError = getAgreementFieldValidationError("madinah", madinahHotels);
  if (madinahFieldError) {
    return madinahFieldError;
  }

  const connectionValidation = validateConnectedAgreementDates(populatedMakkahHotels, populatedMadinahHotels);
  return (
    connectionValidation.cityWarnings.makkah ??
    connectionValidation.cityWarnings.madinah ??
    connectionValidation.crossCityWarning
  );
}

export function buildAgreementItineraryPrefill(
  makkahHotels: NewGroupAgreementFormState[],
  madinahHotels: NewGroupAgreementFormState[],
): ItineraryPrefill | null {
  const populatedAndSortedMakkahHotels = getAgreementFormsWithInput(makkahHotels).sort((left, right) =>
    left.stayStartIso.localeCompare(right.stayStartIso),
  );
  const populatedAndSortedMadinahHotels = getAgreementFormsWithInput(madinahHotels).sort((left, right) =>
    left.stayStartIso.localeCompare(right.stayStartIso),
  );
  const firstMakkah = populatedAndSortedMakkahHotels[0];
  const firstMadinah = populatedAndSortedMadinahHotels[0];
  const isValidIso = (value: string) => isIsoDateValue(value.trim());
  const makkahStart = isValidIso(firstMakkah?.stayStartIso ?? "") ? firstMakkah.stayStartIso.trim() : "";
  const makkahEnd = isValidIso(firstMakkah?.stayEndIso ?? "") ? firstMakkah.stayEndIso.trim() : "";
  const madinahStart = isValidIso(firstMadinah?.stayStartIso ?? "") ? firstMadinah.stayStartIso.trim() : "";
  const madinahEnd = isValidIso(firstMadinah?.stayEndIso ?? "") ? firstMadinah.stayEndIso.trim() : "";
  const allStarts = [makkahStart, madinahStart].filter(Boolean).sort();
  const allEnds = [makkahEnd, madinahEnd].filter(Boolean).sort();
  const suggestedStart = allStarts[0] || "";
  const suggestedEnd = allEnds.at(-1) || "";
  const makkahHotelName = firstMakkah?.hotelName.trim() || "Makkah Hotel";
  const madinahHotelName = firstMadinah?.hotelName.trim() || "Madinah Hotel";

  const hasAgreementHint = Boolean(
    suggestedStart || suggestedEnd || firstMakkah?.hotelName.trim() || firstMadinah?.hotelName.trim(),
  );
  if (!hasAgreementHint) {
    return null;
  }

  return {
    startDate: suggestedStart || undefined,
    endDate: suggestedEnd || undefined,
    cityHotelNames: {
      makkah: makkahHotelName,
      madinah: madinahHotelName,
    },
    trips: {
      "base-arrival": {
        date: makkahStart || suggestedStart || undefined,
        hotelName: makkahHotelName,
        from: "Jeddah Airport",
        to: makkahHotelName,
      },
      "base-city-tour-first": {
        date: makkahStart ? shiftIsoDate(makkahStart, 1) : undefined,
        hotelName: makkahHotelName,
        from: makkahHotelName,
        to: "Masjidil Haram",
        cityTourCity: "Makkah",
      },
      "base-transfer": {
        date: madinahStart || undefined,
        hotelName: madinahHotelName,
        from: makkahHotelName,
        to: madinahHotelName,
      },
      "base-city-tour-second": {
        date: madinahStart ? shiftIsoDate(madinahStart, 1) : undefined,
        hotelName: madinahHotelName,
        from: madinahHotelName,
        to: "Masjid Nabawi",
        cityTourCity: "Madinah",
      },
      "base-departure": {
        date: madinahEnd || suggestedEnd || undefined,
        hotelName: madinahHotelName,
        from: madinahHotelName,
        to: "Madinah Airport",
        hotelPickupRequestTime: "17:00",
      },
    },
  };
}

export function normalizeAgreementForms(
  forms: NewGroupAgreementFormState[],
  city: "makkah" | "madinah",
  paxValue: number,
  groupCode: string,
): GroupAgreementHotel[] {
  const defaultStart = city === "makkah" ? getLocalIsoDateWithOffset(0) : getLocalIsoDateWithOffset(3);
  const defaultEnd = city === "makkah" ? getLocalIsoDateWithOffset(2) : getLocalIsoDateWithOffset(6);
  const populatedForms = forms.filter((form) =>
    [
      form.hotelName.trim(),
      form.agreementNumber.trim(),
      form.pax.trim(),
      form.stayStartIso.trim(),
      form.stayEndIso.trim(),
    ].some(Boolean),
  );
  const sourceForms = populatedForms.length > 0 ? populatedForms : [forms[0]];

  return sourceForms.map((form, index) => {
    const parsedHotelPax = Number.parseInt(form.pax, 10);
    const normalizedPax =
      Number.isFinite(parsedHotelPax) && parsedHotelPax >= 0 ? parsedHotelPax : index === 0 ? paxValue : 0;
    const startIso = isIsoDateValue(form.stayStartIso.trim()) ? form.stayStartIso.trim() : defaultStart;
    const defaultCityEnd = city === "makkah" ? shiftIsoDate(startIso, 2) : defaultEnd;
    const rawEndIso = isIsoDateValue(form.stayEndIso.trim()) ? form.stayEndIso.trim() : defaultCityEnd;
    const endIso = rawEndIso < startIso ? startIso : rawEndIso;

    return {
      id: form.id,
      sourceDraftId: form.sourceDraftId?.trim() || undefined,
      hotelName: form.hotelName.trim() || (city === "makkah" ? "Makkah Main Hotel" : "Madinah Main Hotel"),
      agreementNumber: form.agreementNumber.trim() || resolveVisaAgreementNumber({ groupCode }, undefined, city),
      pax: normalizedPax,
      status: form.status,
      stayStartIso: startIso,
      stayEndIso: endIso,
    };
  });
}

type BuildNewGroupPayloadArgs = {
  resolvedGroupCode: string;
  resolvedGroupName: string;
  safePax: number;
  visaStatus: VisaStatus;
  syarikahName: string;
  busStatus?: BusStatus;
  paymentStatus: "Paid" | "Unpaid";
  makkahHotels: NewGroupAgreementFormState[];
  madinahHotels: NewGroupAgreementFormState[];
  raudhahDates: NewGroupRaudhahFormState[];
  itineraryDraft: NewGroupItineraryDraft | null;
};

export function buildNewGroupPayload({
  resolvedGroupCode,
  resolvedGroupName,
  safePax,
  visaStatus,
  syarikahName,
  busStatus,
  paymentStatus,
  makkahHotels,
  madinahHotels,
  raudhahDates,
  itineraryDraft,
}: BuildNewGroupPayloadArgs): GroupData {
  const normalizedGroupCode = resolvedGroupCode;
  const normalizedGroupName = resolvedGroupName;
  const normalizedMakkahHotels = normalizeAgreementForms(makkahHotels, "makkah", safePax, normalizedGroupCode);
  const normalizedMadinahHotels = normalizeAgreementForms(madinahHotels, "madinah", safePax, normalizedGroupCode);
  const itineraryStartIso =
    itineraryDraft?.startDate?.trim() && isIsoDateValue(itineraryDraft.startDate.trim())
      ? itineraryDraft.startDate.trim()
      : null;
  const itineraryEndIso =
    itineraryDraft?.endDate?.trim() && isIsoDateValue(itineraryDraft.endDate.trim())
      ? itineraryDraft.endDate.trim()
      : null;

  const allStartDates = [...normalizedMakkahHotels, ...normalizedMadinahHotels]
    .map((hotel) => hotel.stayStartIso)
    .filter((isoDate) => isIsoDateValue(isoDate));
  const allEndDates = [...normalizedMakkahHotels, ...normalizedMadinahHotels]
    .map((hotel) => hotel.stayEndIso)
    .filter((isoDate) => isIsoDateValue(isoDate));

  const groupStartIso = allStartDates.sort()[0] ?? itineraryStartIso ?? getLocalIsoDateWithOffset(0);
  const groupEndIso = allEndDates.sort().at(-1) ?? itineraryEndIso ?? shiftIsoDate(groupStartIso, 7);
  const safeGroupEndIso = groupEndIso < groupStartIso ? groupStartIso : groupEndIso;

  const firstMakkahHotel = normalizedMakkahHotels[0];
  const firstMadinahHotel = normalizedMadinahHotels[0];
  const arrivalIso = firstMakkahHotel?.stayStartIso ?? groupStartIso;
  const transferIso =
    firstMadinahHotel?.stayStartIso && firstMadinahHotel.stayStartIso >= arrivalIso
      ? firstMadinahHotel.stayStartIso
      : shiftIsoDate(arrivalIso, 3);
  const departureIso = firstMadinahHotel?.stayEndIso ?? safeGroupEndIso;

  const buildItineraryItem = ({
    isoDate,
    time,
    category,
    categoryKey,
    title,
    meta,
    icon,
    hotelName,
    from,
    to,
    highlighted,
    requiresBus,
    hotelPickupRequestTime,
  }: {
    isoDate: string;
    time: string;
    category: string;
    categoryKey: string;
    title: string;
    meta: string;
    icon: string;
    from: string;
    to: string;
    highlighted?: boolean;
    requiresBus?: boolean;
    hotelName?: string;
    hotelPickupRequestTime?: string;
  }): ItineraryItem => {
    const formattedDate = formatScheduleDate(isoDate);

    return {
      date: formattedDate.date,
      year: formattedDate.year,
      category,
      categoryKey,
      title,
      meta,
      icon,
      highlighted,
      isoDate,
      time,
      hotelName,
      from,
      to,
      requiresBus,
      hotelPickupRequestTime,
    };
  };

  const itinerary = [
    buildItineraryItem({
      isoDate: arrivalIso,
      time: "10:00",
      category: "Arrival",
      categoryKey: "arrival",
      title: "Arrival and transfer to Makkah hotel",
      meta: `${formatScheduleTime("10:00")} | ${firstMakkahHotel?.hotelName ?? "Makkah Hotel"}`,
      icon: "flight_land",
      hotelName: firstMakkahHotel?.hotelName ?? "Makkah Hotel",
      from: "JED Airport",
      to: firstMakkahHotel?.hotelName ?? "Makkah",
      highlighted: true,
      requiresBus: true,
    }),
    buildItineraryItem({
      isoDate: transferIso,
      time: "08:00",
      category: "Transfer",
      categoryKey: "transfer",
      title: "Transfer from Makkah to Madinah",
      meta: `${formatScheduleTime("08:00")} | Route 40`,
      icon: "airport_shuttle",
      hotelName: firstMadinahHotel?.hotelName ?? "Madinah Hotel",
      from: firstMakkahHotel?.hotelName ?? "Makkah",
      to: firstMadinahHotel?.hotelName ?? "Madinah",
      requiresBus: true,
    }),
    buildItineraryItem({
      isoDate: departureIso,
      time: "20:00",
      category: "Departure",
      categoryKey: "departure",
      title: "Departure to airport",
      meta: `${formatScheduleTime("20:00")} | Final departure | Hotel pickup request ${formatScheduleTime("17:00")}`,
      icon: "flight_takeoff",
      hotelName: firstMadinahHotel?.hotelName ?? "Madinah Hotel",
      from: firstMadinahHotel?.hotelName ?? "Madinah",
      to: "MED Airport",
      requiresBus: true,
      hotelPickupRequestTime: "17:00",
    }),
  ].sort((left, right) =>
    `${left.isoDate ?? ""}T${left.time ?? ""}`.localeCompare(`${right.isoDate ?? ""}T${right.time ?? ""}`),
  );

  const firstTimelineItem = itinerary[0];
  const secondTimelineItem = itinerary[1] ?? itinerary[itinerary.length - 1];
  const firstTimelineDate = firstTimelineItem
    ? formatScheduleDate(firstTimelineItem.isoDate ?? groupStartIso)
    : formatScheduleDate(groupStartIso);
  const secondTimelineDate = secondTimelineItem
    ? formatScheduleDate(secondTimelineItem.isoDate ?? safeGroupEndIso)
    : formatScheduleDate(safeGroupEndIso);
  const primaryNextActivityItem = itinerary.find((item) => item.highlighted) ?? itinerary[0];
  const primaryNextActivityDate = primaryNextActivityItem
    ? formatScheduleDate(primaryNextActivityItem.isoDate ?? groupStartIso)
    : firstTimelineDate;
  const primaryNextActivityTime = primaryNextActivityItem?.time?.trim() || secondTimelineItem?.time?.trim() || "09:00";

  const normalizedRaudhahAppointments = raudhahDates
    .map((appointment, index) => {
      const normalizedDateIso = appointment.dateIso.trim();
      if (!isIsoDateValue(normalizedDateIso)) {
        return null;
      }

      return {
        id: appointment.id?.trim() || `${normalizedGroupCode}-raudhah-${index + 1}`,
        dateIso: normalizedDateIso,
        status: appointment.status as GroupRaudhahStatus,
      };
    })
    .filter(
      (
        appointment,
      ): appointment is {
        id: string;
        dateIso: string;
        status: GroupRaudhahStatus;
      } => appointment !== null,
    );

  const draftPackageName = itineraryDraft?.packageName?.trim() || "";
  const resolvedSyarikahName = syarikahName.trim() || "Not assigned";
  const defaultPrimaryNote = "Itinerary drafted by operator and ready for operations review.";
  const itineraryPrimaryNote = itineraryDraft?.notes?.map((note: string) => note.trim()).find(Boolean) ?? "";
  const notes = [
    itineraryPrimaryNote || defaultPrimaryNote,
    `Syarikah provider: ${resolvedSyarikahName}.`,
    `Bus status: ${busStatus === "Visa+" ? "Visa+" : "Visa Only"}.`,
  ];

  const durationDays = Math.max(
    1,
    Math.floor((Date.parse(safeGroupEndIso) - Date.parse(groupStartIso)) / 86_400_000) + 1,
  );

  const mergedItinerary = itineraryDraft?.itinerary?.length ? itineraryDraft.itinerary : itinerary;
  const fallbackTimeline: [GroupData["timeline"][0], GroupData["timeline"][1]] = [
    {
      date: firstTimelineDate.date,
      title: firstTimelineItem?.title ?? "Group setup created",
    },
    {
      date: secondTimelineDate.date,
      title: secondTimelineItem?.title ?? "Operational follow-up",
      isCurrent: true,
      nextActivity: secondTimelineItem?.meta?.trim() || secondTimelineItem?.time?.trim() || "Awaiting operator update",
    },
  ];
  const mergedTimeline = itineraryDraft?.timeline?.length === 2 ? itineraryDraft.timeline : fallbackTimeline;
  const mergedNextActivity = itineraryDraft?.nextActivity ?? {
    title: primaryNextActivityItem?.title ?? firstTimelineItem?.title ?? "Upcoming Activity",
    date: primaryNextActivityDate.date,
    time: formatScheduleTime(primaryNextActivityTime),
    icon: primaryNextActivityItem?.icon ?? firstTimelineItem?.icon ?? "event",
  };
  const mergedDurationDays =
    itineraryDraft?.durationDays && itineraryDraft.durationDays > 0 ? itineraryDraft.durationDays : durationDays;
  const mergedNotes = notes;

  const mergedPackageName = draftPackageName || syarikahName.trim() || "Custom Group Package";
  const mergedTotalBuses =
    itineraryDraft?.totalBuses && itineraryDraft.totalBuses > 0
      ? itineraryDraft.totalBuses
      : getMinimumBusCountForPax(safePax);
  const mergedMusyrifName = itineraryDraft?.musyrifName?.trim() || "Unassigned Musyrif";
  const mergedMusyrifPhone = itineraryDraft?.musyrifPhone?.trim() || "-";
  const issuedDate = visaStatus === "Issued" ? getLocalIsoDateWithOffset(0) : "";

  return {
    code: normalizedGroupCode,
    name: normalizedGroupName,
    status: "Active",
    tone: "active",
    pax: safePax,
    totalBuses: mergedTotalBuses,
    packageName: mergedPackageName,
    durationDays: mergedDurationDays,
    arrivalDate: arrivalIso,
    returnDate: departureIso,
    timeline: mergedTimeline,
    nextActivity: mergedNextActivity,
    itinerary: mergedItinerary,
    notes: mergedNotes,
    musyrif: {
      name: mergedMusyrifName,
      phone: mergedMusyrifPhone,
      avatar: musyrifAvatar,
    },
    visaSetup: {
      visaStatus,
      issuedDate,
      syarikah: resolvedSyarikahName,
      busStatus,
      paymentStatus,
      makkahHotels: normalizedMakkahHotels,
      madinahHotels: normalizedMadinahHotels,
      raudhahAppointments: normalizedRaudhahAppointments,
    },
  };
}
