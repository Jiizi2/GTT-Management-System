import {
  getItineraryIsoDate,
  getLocalIsoDateWithOffset,
  parseTimeForInput,
  resolveItineraryBoundaryIsoDates,
} from "../../shared/app-domain-core.js";
import type {
  GroupAgreementHotel,
  GroupData,
  GroupRaudhahAppointment,
  VisaPaymentStatus,
  VisaRaudhahTone,
  VisaStatus,
  VisaTrackingRow,
} from "../../shared/app-domain-types.js";

function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftIsoDate(isoDate: string, days: number): string {
  if (!isoDate) {
    return "";
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  parsedDate.setDate(parsedDate.getDate() + days);
  return formatLocalIsoDate(parsedDate);
}

export function formatVisaShortDate(isoDate: string): string {
  if (!isoDate) {
    return "-";
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function formatVisaLongDate(isoDate: string): string {
  if (!isoDate) {
    return "-";
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  return parsedDate.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function formatVisaDateWithYear(isoDate: string): string {
  if (!isoDate) {
    return "-";
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  return parsedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function buildVisaAgreementNumber(groupCode: string, city: "makkah" | "madinah"): string {
  const digits = groupCode.replace(/[^0-9]/g, "").slice(-6).padStart(6, "0");
  const citySuffix = city === "makkah" ? "65865716" : "77824519";
  return `2026${digits}${citySuffix}`;
}

export function isIsoDateValue(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function resolveValidRaudhahAppointments(
  group: GroupData | undefined,
): GroupRaudhahAppointment[] {
  const fallbackGroupCode = group?.code?.trim() || "group";

  return (group?.visaSetup?.raudhahAppointments ?? [])
    .map((appointment, index) => ({
      id: appointment.id?.trim() || `${fallbackGroupCode}-raudhah-${index + 1}`,
      dateIso: appointment.dateIso.trim(),
      status: appointment.status,
      tasrehPrinted: Boolean(appointment.tasrehPrinted),
    }))
    .filter((appointment) => isIsoDateValue(appointment.dateIso))
    .sort((left, right) => {
      const dateOrder = left.dateIso.localeCompare(right.dateIso);
      if (dateOrder !== 0) {
        return dateOrder;
      }

      return left.id.localeCompare(right.id);
    });
}

export function getGroupAgreementHotelsByCity(
  group: GroupData | undefined,
  city: "makkah" | "madinah",
): GroupAgreementHotel[] {
  if (!group?.visaSetup) {
    return [];
  }

  return city === "makkah" ? group.visaSetup.makkahHotels : group.visaSetup.madinahHotels;
}

export function resolveVisaAgreementNumber(
  row: Pick<VisaTrackingRow, "groupCode">,
  group: GroupData | undefined,
  city: "makkah" | "madinah",
): string {
  const primaryAgreement = getGroupAgreementHotelsByCity(group, city)[0];
  const customAgreementNumber = primaryAgreement?.agreementNumber?.trim();

  if (customAgreementNumber) {
    return customAgreementNumber;
  }

  return buildVisaAgreementNumber(row.groupCode, city);
}

export function resolveVisaAgreementDateRange(
  row: Pick<VisaTrackingRow, "departureIso" | "returnIso">,
  durationDays: number,
  group?: GroupData,
): {
  makkahStartIso: string;
  makkahEndIso: string;
  madinahStartIso: string;
  madinahEndIso: string;
} {
  const normalizedDurationDays = Math.max(1, durationDays || 1);
  const fallbackMakkahStartIso = row.departureIso;
  const fallbackMadinahEndIso =
    row.returnIso && row.returnIso >= fallbackMakkahStartIso
      ? row.returnIso
      : shiftIsoDate(fallbackMakkahStartIso, Math.max(6, normalizedDurationDays - 1));
  const fallbackMakkahStayDays = Math.max(1, Math.min(3, Math.floor(normalizedDurationDays * 0.4)));
  const fallbackMakkahEndCandidate = shiftIsoDate(fallbackMakkahStartIso, fallbackMakkahStayDays);
  const fallbackMakkahEndIso =
    fallbackMakkahEndCandidate > fallbackMadinahEndIso ? fallbackMadinahEndIso : fallbackMakkahEndCandidate;
  const fallbackMadinahStartCandidate = shiftIsoDate(fallbackMakkahEndIso, 1);
  const fallbackMadinahStartIso =
    fallbackMadinahStartCandidate > fallbackMadinahEndIso ? fallbackMadinahEndIso : fallbackMadinahStartCandidate;

  const makkahHotels = getGroupAgreementHotelsByCity(group, "makkah");
  const madinahHotels = getGroupAgreementHotelsByCity(group, "madinah");
  const makkahStartCandidates = makkahHotels
    .map((hotel) => hotel.stayStartIso.trim())
    .filter((isoDate) => isIsoDateValue(isoDate));
  const makkahEndCandidates = makkahHotels
    .map((hotel) => hotel.stayEndIso.trim())
    .filter((isoDate) => isIsoDateValue(isoDate));
  const madinahStartCandidates = madinahHotels
    .map((hotel) => hotel.stayStartIso.trim())
    .filter((isoDate) => isIsoDateValue(isoDate));
  const madinahEndCandidates = madinahHotels
    .map((hotel) => hotel.stayEndIso.trim())
    .filter((isoDate) => isIsoDateValue(isoDate));

  const hasCustomAgreementDates =
    makkahStartCandidates.length > 0 ||
    makkahEndCandidates.length > 0 ||
    madinahStartCandidates.length > 0 ||
    madinahEndCandidates.length > 0;

  if (!hasCustomAgreementDates) {
    return {
      makkahStartIso: fallbackMakkahStartIso,
      makkahEndIso: fallbackMakkahEndIso,
      madinahStartIso: fallbackMadinahStartIso,
      madinahEndIso: fallbackMadinahEndIso,
    };
  }

  const customMakkahStartIso = [...makkahStartCandidates, ...madinahStartCandidates].sort()[0] ?? fallbackMakkahStartIso;
  const customMakkahEndIso = [...makkahEndCandidates].sort().at(-1) ?? fallbackMakkahEndIso;
  const customMadinahStartIso = [...madinahStartCandidates].sort()[0] ?? shiftIsoDate(customMakkahEndIso, 1);
  const customMadinahEndIso = [...madinahEndCandidates, ...makkahEndCandidates].sort().at(-1) ?? fallbackMadinahEndIso;

  const normalizedMakkahEndIso = customMakkahEndIso < customMakkahStartIso ? customMakkahStartIso : customMakkahEndIso;
  const normalizedMadinahStartIso =
    customMadinahStartIso < normalizedMakkahEndIso ? normalizedMakkahEndIso : customMadinahStartIso;
  const normalizedMadinahEndIso =
    customMadinahEndIso < normalizedMadinahStartIso ? normalizedMadinahStartIso : customMadinahEndIso;

  return {
    makkahStartIso: customMakkahStartIso,
    makkahEndIso: normalizedMakkahEndIso,
    madinahStartIso: normalizedMadinahStartIso,
    madinahEndIso: normalizedMadinahEndIso,
  };
}

export function resolveVisaProvider(packageName: string): string {
  const normalizedPackage = packageName.trim().toLowerCase();

  if (normalizedPackage.includes("vip") || normalizedPackage.includes("premium")) {
    return "Al-Tayyar";
  }

  if (normalizedPackage.includes("silver")) {
    return "Rawaf Mina";
  }

  return "Nusuk Services";
}

export function hasMissingHotelAllocation(row: VisaTrackingRow): boolean {
  return row.makkahVerified < row.pax || row.madinahVerified < row.pax;
}

export function isVisaRowActionRequired(row: VisaTrackingRow): boolean {
  return row.visaStatus !== "Issued";
}

export function buildVisaTrackingRowsFromGroups(groups: GroupData[]): VisaTrackingRow[] {
  return groups.map((group, index) => {
    const visaSetup = group.visaSetup;
    const { earliestIsoDate, latestIsoDate } = resolveItineraryBoundaryIsoDates(group.itinerary);
    const configuredArrivalIso = group.arrivalDate?.trim() ?? "";
    const configuredReturnIso = group.returnDate?.trim() ?? "";
    const groupArrivalIso = isIsoDateValue(configuredArrivalIso) ? configuredArrivalIso : "";
    const groupReturnIso = isIsoDateValue(configuredReturnIso) ? configuredReturnIso : "";
    const fallbackDeparture = getLocalIsoDateWithOffset(index % 4);
    const itineraryDepartureIso = groupArrivalIso || earliestIsoDate || fallbackDeparture;
    const resolvedReturnIso = groupReturnIso || latestIsoDate || "";
    const itineraryReturnIso =
      resolvedReturnIso && resolvedReturnIso >= itineraryDepartureIso
        ? resolvedReturnIso
        : shiftIsoDate(itineraryDepartureIso, Math.max(6, group.durationDays - 1));
    const customAgreementDateRange = resolveVisaAgreementDateRange(
      { departureIso: itineraryDepartureIso, returnIso: itineraryReturnIso },
      group.durationDays,
      group,
    );
    const departureIso = customAgreementDateRange.makkahStartIso;
    const returnIso = customAgreementDateRange.madinahEndIso;

    const visaStatus: VisaStatus =
      visaSetup?.visaStatus ?? (index % 6 === 0 ? "Draft" : index % 4 === 0 ? "Pending" : "Issued");
    const paymentStatus: VisaPaymentStatus =
      visaSetup?.paymentStatus ?? (index % 5 === 0 ? "Unpaid" : index % 3 === 0 ? "Partial" : "Paid");
    const configuredIssuedDate = visaSetup?.issuedDate?.trim() ?? "";
    const issuedDateIso =
      visaStatus === "Issued"
        ? isIsoDateValue(configuredIssuedDate)
          ? configuredIssuedDate
          : departureIso
        : "";

    const pax = Math.max(1, group.pax);
    const visaDelayFactor = visaStatus === "Issued" ? 0 : 1;
    const defaultMakkahGap = (index % 5 === 0 ? Math.max(1, Math.ceil(pax * 0.12)) : 0) + visaDelayFactor;
    const defaultMadinahGap = (index % 4 === 0 ? Math.max(1, Math.ceil(pax * 0.18)) : 0) + visaDelayFactor;
    const fallbackMakkahVerified = Math.max(0, pax - Math.min(pax, defaultMakkahGap));
    const fallbackMadinahVerified = Math.max(0, pax - Math.min(pax, defaultMadinahGap));
    const mappedMakkahVerified = visaSetup
      ? Math.min(
          pax,
          Math.max(
            0,
            visaSetup.makkahHotels.reduce((total, hotel) => total + Math.max(0, hotel.pax || 0), 0),
          ),
        )
      : fallbackMakkahVerified;
    const mappedMadinahVerified = visaSetup
      ? Math.min(
          pax,
          Math.max(
            0,
            visaSetup.madinahHotels.reduce((total, hotel) => total + Math.max(0, hotel.pax || 0), 0),
          ),
        )
      : fallbackMadinahVerified;
    const makkahVerified = mappedMakkahVerified;
    const madinahVerified = mappedMadinahVerified;

    const validRaudhahAppointments = resolveValidRaudhahAppointments(group);
    const firstRaudhah =
      validRaudhahAppointments.find((appointment) => appointment.status !== "Free") ??
      validRaudhahAppointments[0];
    const raudhahTone: VisaRaudhahTone =
      !firstRaudhah || firstRaudhah.status === "Free"
        ? "muted"
        : firstRaudhah.status === "Before"
          ? "warn"
          : "good";
    const raudhahLabel =
      !firstRaudhah || firstRaudhah.status === "Free"
        ? "Not Set"
        : `${formatVisaShortDate(firstRaudhah.dateIso)} ${firstRaudhah.status}`;
    const raudhahHint =
      !firstRaudhah || firstRaudhah.status === "Free"
        ? "Appointment pending"
        : firstRaudhah.status === "Before"
          ? "Before 13:00"
          : "After 13:00";

    const outstandingAmount =
      paymentStatus === "Unpaid" ? pax * 280 : paymentStatus === "Partial" ? pax * 120 : 0;

    return {
      id: `${group.code}-visa-${index}`,
      groupCode: group.code,
      groupName: group.name,
      pax,
      packageName: group.packageName,
      issuedDateIso,
      departureIso,
      returnIso,
      visaStatus,
      paymentStatus,
      raudhahLabel,
      raudhahHint,
      raudhahTone,
      makkahVerified,
      madinahVerified,
      outstandingAmount,
    };
  });
}
