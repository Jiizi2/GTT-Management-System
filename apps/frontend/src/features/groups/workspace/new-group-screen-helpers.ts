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
} from "../domain.js";
import { isIsoDateValue, resolveVisaAgreementNumber, shiftIsoDate } from "../../visa/domain.js";
import { musyrifAvatar } from "../../../shared/app-domain.js";

type AgreementDateRange = {
  startIso: string;
  endIso: string;
};

type AgreementDateCity = "makkah" | "madinah";

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
    .filter(
      (range) =>
        isIsoDateValue(range.startIso) &&
        isIsoDateValue(range.endIso) &&
        range.endIso >= range.startIso,
    )
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

export function buildAgreementItineraryPrefill(
  makkahHotels: NewGroupAgreementFormState[],
  madinahHotels: NewGroupAgreementFormState[],
): ItineraryPrefill | null {
  const isValidIso = (value: string) => isIsoDateValue(value.trim());
  const firstMakkah = makkahHotels[0];
  const firstMadinah = madinahHotels[0];
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
    suggestedStart ||
      suggestedEnd ||
      firstMakkah?.hotelName.trim() ||
      firstMadinah?.hotelName.trim(),
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
      Number.isFinite(parsedHotelPax) && parsedHotelPax >= 0
        ? parsedHotelPax
        : index === 0
          ? paxValue
          : 0;
    const startIso = isIsoDateValue(form.stayStartIso.trim()) ? form.stayStartIso.trim() : defaultStart;
    const defaultCityEnd = city === "makkah" ? shiftIsoDate(startIso, 2) : defaultEnd;
    const rawEndIso = isIsoDateValue(form.stayEndIso.trim()) ? form.stayEndIso.trim() : defaultCityEnd;
    const endIso = rawEndIso < startIso ? startIso : rawEndIso;

    return {
      id: form.id,
      hotelName:
        form.hotelName.trim() || (city === "makkah" ? "Makkah Main Hotel" : "Madinah Main Hotel"),
      agreementNumber:
        form.agreementNumber.trim() || resolveVisaAgreementNumber({ groupCode }, undefined, city),
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

  const allStartDates = [...normalizedMakkahHotels, ...normalizedMadinahHotels]
    .map((hotel) => hotel.stayStartIso)
    .filter((isoDate) => isIsoDateValue(isoDate));
  const allEndDates = [...normalizedMakkahHotels, ...normalizedMadinahHotels]
    .map((hotel) => hotel.stayEndIso)
    .filter((isoDate) => isIsoDateValue(isoDate));

  const groupStartIso = allStartDates.sort()[0] ?? getLocalIsoDateWithOffset(0);
  const groupEndIso = allEndDates.sort().at(-1) ?? shiftIsoDate(groupStartIso, 7);
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
  ].sort((left, right) => `${left.isoDate ?? ""}T${left.time ?? ""}`.localeCompare(`${right.isoDate ?? ""}T${right.time ?? ""}`));

  const firstTimelineItem = itinerary[0];
  const secondTimelineItem = itinerary[1] ?? itinerary[itinerary.length - 1];
  const firstTimelineDate = firstTimelineItem ? formatScheduleDate(firstTimelineItem.isoDate ?? groupStartIso) : formatScheduleDate(groupStartIso);
  const secondTimelineDate = secondTimelineItem ? formatScheduleDate(secondTimelineItem.isoDate ?? safeGroupEndIso) : formatScheduleDate(safeGroupEndIso);
  const primaryNextActivityItem = itinerary.find((item) => item.highlighted) ?? itinerary[0];
  const primaryNextActivityDate = primaryNextActivityItem
    ? formatScheduleDate(primaryNextActivityItem.isoDate ?? groupStartIso)
    : firstTimelineDate;
  const primaryNextActivityTime =
    primaryNextActivityItem?.time?.trim() || secondTimelineItem?.time?.trim() || "09:00";

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

  const defaultPrimaryNote = "Itinerary drafted by operator and ready for operations review.";
  const itineraryPrimaryNote = itineraryDraft?.notes?.map((note) => note.trim()).find(Boolean) ?? "";
  const notes = [
    itineraryPrimaryNote || defaultPrimaryNote,
    syarikahName.trim()
      ? `Syarikah provider: ${syarikahName.trim()}.`
      : "Syarikah provider is still pending confirmation.",
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
      nextActivity:
        secondTimelineItem?.meta?.trim() ||
        secondTimelineItem?.time?.trim() ||
        "Awaiting operator update",
    },
  ];
  const mergedTimeline =
    itineraryDraft?.timeline?.length === 2 ? itineraryDraft.timeline : fallbackTimeline;
  const mergedNextActivity = itineraryDraft?.nextActivity ?? {
    title: primaryNextActivityItem?.title ?? firstTimelineItem?.title ?? "Upcoming Activity",
    date: primaryNextActivityDate.date,
    time: formatScheduleTime(primaryNextActivityTime),
    icon: primaryNextActivityItem?.icon ?? firstTimelineItem?.icon ?? "event",
  };
  const mergedDurationDays =
    itineraryDraft?.durationDays && itineraryDraft.durationDays > 0
      ? itineraryDraft.durationDays
      : durationDays;
  const mergedNotes = notes;

  const mergedPackageName =
    itineraryDraft?.packageName?.trim() || syarikahName.trim() || "Custom Group Package";
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
      syarikah: syarikahName.trim(),
      busStatus,
      paymentStatus,
      makkahHotels: normalizedMakkahHotels,
      madinahHotels: normalizedMadinahHotels,
      raudhahAppointments: normalizedRaudhahAppointments,
    },
  };
}
