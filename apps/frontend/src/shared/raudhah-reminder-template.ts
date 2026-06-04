import { isIsoDateValue, shiftIsoDate, type GroupRaudhahStatus } from "./app-domain.js";

type ReminderAppointment = {
  dateIso: string;
  status: GroupRaudhahStatus;
};

type BuildRaudhahReminderTemplateArgs = {
  groupCode: string;
  groupName: string;
  totalPax: number;
  packageName: string;
  departureIso: string;
  providerName?: string | null;
  coordinatorName?: string | null;
  appointments: ReminderAppointment[];
  bookingDateIsos?: string[];
  groupDetailLine?: string;
};

const MONTH_ABBREVIATIONS_UPPER = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
const MONTH_NAMES_UPPER = [
  "JANUARI",
  "FEBRUARI",
  "MARET",
  "APRIL",
  "MEI",
  "JUNI",
  "JULI",
  "AGUSTUS",
  "SEPTEMBER",
  "OKTOBER",
  "NOVEMBER",
  "DESEMBER",
];
const FALLBACK_AGENT_SCHEDULE_LINES = [
  "* [tanggal] → Free",
  "* [tanggal] → After",
  "* [tanggal] → Before (sebelum dzuhur)",
];

function parseIsoAtNoon(isoDate: string): Date | null {
  const normalizedIso = isoDate.trim();
  if (!isIsoDateValue(normalizedIso)) {
    return null;
  }

  const parsedDate = new Date(`${normalizedIso}T12:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function joinWithAmpersand(parts: string[]): string {
  if (parts.length === 0) {
    return "";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  if (parts.length === 2) {
    return `${parts[0]} & ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(", ")} & ${parts[parts.length - 1]}`;
}

function formatReminderHeaderDate(isoDate: string): string {
  const parsedDate = parseIsoAtNoon(isoDate);
  if (!parsedDate) {
    return isoDate || "-";
  }

  return `${parsedDate.getDate()} ${MONTH_ABBREVIATIONS_UPPER[parsedDate.getMonth()]}`;
}

function formatBookingDateSummary(bookingDateIsos: string[]): string {
  const parsedDates = Array.from(
    new Map(
      bookingDateIsos
        .map((isoDate) => isoDate.trim())
        .map((isoDate) => {
          const parsedDate = parseIsoAtNoon(isoDate);
          return parsedDate ? [isoDate, parsedDate] : null;
        })
        .filter((entry): entry is [string, Date] => entry !== null),
    ).values(),
  ).sort((left, right) => left.getTime() - right.getTime());

  if (parsedDates.length === 0) {
    return "[tanggal]";
  }

  const firstDate = parsedDates[0];
  const isSameMonthAndYear = parsedDates.every(
    (date) => date.getMonth() === firstDate.getMonth() && date.getFullYear() === firstDate.getFullYear(),
  );

  if (isSameMonthAndYear) {
    return `${joinWithAmpersand(parsedDates.map((date) => date.getDate().toString()))} ${MONTH_NAMES_UPPER[firstDate.getMonth()]}`;
  }

  const hasMultipleYears = new Set(parsedDates.map((date) => date.getFullYear())).size > 1;
  return joinWithAmpersand(
    parsedDates.map((date) => {
      const yearSuffix = hasMultipleYears ? ` ${date.getFullYear()}` : "";
      return `${date.getDate()} ${MONTH_NAMES_UPPER[date.getMonth()]}${yearSuffix}`;
    }),
  );
}

function buildRaudhahAgentScheduleLines(appointments: ReminderAppointment[]): string[] {
  const parsedAppointments = appointments
    .map((appointment) => {
      const parsedDate = parseIsoAtNoon(appointment.dateIso);
      if (!parsedDate) {
        return null;
      }

      return {
        day: parsedDate.getDate(),
        status: appointment.status,
      };
    })
    .filter(
      (
        appointment,
      ): appointment is {
        day: number;
        status: GroupRaudhahStatus;
      } => appointment !== null,
    );

  if (parsedAppointments.length === 0) {
    return FALLBACK_AGENT_SCHEDULE_LINES;
  }

  const statusOrder: GroupRaudhahStatus[] = ["Free", "After", "Before"];
  const lines = statusOrder
    .map((status) => {
      const days = Array.from(
        new Set(
          parsedAppointments
            .filter((appointment) => appointment.status === status)
            .map((appointment) => appointment.day),
        ),
      ).sort((left, right) => left - right);

      if (days.length === 0) {
        return null;
      }

      if (status === "Before") {
        return `* ${days.join(" - ")} → ${status} (sebelum dzuhur)`;
      }

      return `* ${days.join(" - ")} → ${status}`;
    })
    .filter((line): line is string => line !== null);

  return lines.length > 0 ? lines : FALLBACK_AGENT_SCHEDULE_LINES;
}

function resolveBookingDateIsos(args: BuildRaudhahReminderTemplateArgs): string[] {
  if ((args.bookingDateIsos ?? []).length > 0) {
    return args.bookingDateIsos ?? [];
  }

  return args.appointments.flatMap((appointment) => [
    shiftIsoDate(appointment.dateIso, -7),
    shiftIsoDate(appointment.dateIso, -2),
  ]);
}

function resolveGroupDetailLine(args: BuildRaudhahReminderTemplateArgs): string {
  const customLine = args.groupDetailLine?.trim();
  if (customLine) {
    return customLine;
  }

  return `${args.groupCode} → Ikhwan ... Pax | Akhwat ... pax`;
}

export function buildRaudhahReminderTemplate(args: BuildRaudhahReminderTemplateArgs): string {
  const providerName = args.providerName?.trim() || "Provider pending";
  const coordinatorName = (args.coordinatorName?.trim() || "PIC").toUpperCase();
  const bookingDateSummary = formatBookingDateSummary(resolveBookingDateIsos(args));

  return [
    `📢 Reminder Booking Raudhah GROUP ${args.totalPax} PAX ${args.groupName.toUpperCase()} ${formatReminderHeaderDate(args.departureIso)} (${coordinatorName})`,
    "",
    `🔹 Syarikah: ${providerName}`,
    `📅 Perkiraan jadwal yang buka: ${bookingDateSummary}`,
    "",
    "📋 Detail Group:",
    resolveGroupDetailLine(args),
    "",
    "🕌 Jadwal Raudhah Agent:",
    ...buildRaudhahAgentScheduleLines(args.appointments),
  ].join("\n");
}
