import { useEffect, useMemo, useRef, useState } from "react";
import * as Domain from "../../../shared/app-domain";
import { buildRaudhahReminderTemplate } from "../../../shared/raudhah-reminder-template.js";
import type { GroupData, GroupRaudhahStatus } from "../../../shared/app-domain";

const {
  buildVisaTrackingRowsFromGroups,
  formatLocalIsoDate,
  isIsoDateValue,
  resolveValidRaudhahAppointments,
  shiftIsoDate,
} = Domain;

export const RAUDHAH_PAGE_SIZE = 12;

export type ReminderSlot = "h2" | "h7" | "h7Upcoming";
export type ReminderSlotStatus = "open" | "upcoming" | "missed";

export type ReminderAppointmentItem = {
  id: string;
  originalAppointmentId: string;
  targetDateIso: string;
  bookingDateIso: string;
  status: GroupRaudhahStatus;
  tasrehPrinted: boolean;
  slotStatus: ReminderSlotStatus;
  daysUntilBooking: number;
};

export type ReminderItem = {
  id: string;
  groupCode: string;
  groupName: string;
  packageName: string;
  musyrifName: string;
  pax: number;
  appointments: ReminderAppointmentItem[];
  slot: ReminderSlot;
  reminderTemplate: string;
};

export type PendingTasrehAction = {
  groupCode: string;
  appointmentId: string;
  targetDateIso: string;
  nextTasrehPrinted: boolean;
};

export type ReminderSectionConfig = {
  title: string;
  subtitle: string;
  emptyCardClassName: string;
  emptyTitle: string;
  emptyDescription: string;
  cardClassName: string;
  codeChipClassName: string;
};

export const reminderSectionConfig: Record<ReminderSlot, ReminderSectionConfig> = {
  h2: {
    title: "Slot H-2",
    subtitle: "BOOKING WINDOW DUA HARI SEBELUM TARGET",
    emptyCardClassName: "border-outline-variant/55 bg-surface-container-low text-on-surface-variant",
    emptyTitle: "No H-2 reminders right now",
    emptyDescription: "Belum ada target date yang punya slot booking H-2.",
    cardClassName: "border-outline-variant/45 bg-surface-container-lowest",
    codeChipClassName: "border-rose-200 bg-rose-50 text-rose-700",
  },
  h7: {
    title: "Slot H-7",
    subtitle: "BOOKING WINDOW TUJUH HARI SEBELUM TARGET",
    emptyCardClassName: "border-outline-variant/55 bg-surface-container-low text-on-surface-variant",
    emptyTitle: "No H-7 reminders right now",
    emptyDescription: "Belum ada target date yang punya slot booking H-7.",
    cardClassName: "border-outline-variant/45 bg-surface-container-lowest",
    codeChipClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  h7Upcoming: {
    title: "Upcoming H-7",
    subtitle: "TARGET H-8 SAMPAI H-12",
    emptyCardClassName: "border-outline-variant/55 bg-surface-container-low text-on-surface-variant",
    emptyTitle: "No upcoming H-7 reminders",
    emptyDescription: "Belum ada target date pada rentang H-8 sampai H-12.",
    cardClassName: "border-outline-variant/45 bg-surface-container-lowest",
    codeChipClassName: "border-sky-200 bg-sky-50 text-sky-700",
  },
};

export const MAX_H7_UPCOMING_TARGET_DAYS = 12;

export function getSectionBadgeAccentClass(slot: ReminderSlot, isDarkMode: boolean): string {
  if (isDarkMode) {
    if (slot === "h2") {
      return "border border-tertiary/40 bg-tertiary/30 text-white";
    }

    if (slot === "h7") {
      return "border border-primary/40 bg-primary/30 text-white";
    }

    return "border border-secondary/40 bg-secondary/28 text-white";
  }

  if (slot === "h2") {
    return "border border-rose-700/30 bg-rose-600 text-white";
  }

  if (slot === "h7") {
    return "border border-emerald-700/30 bg-emerald-600 text-white";
  }

  return "border border-sky-700/30 bg-sky-600 text-white";
}

export function getSectionDividerAccentClass(slot: ReminderSlot, isDarkMode: boolean): string {
  if (isDarkMode) {
    if (slot === "h2") {
      return "bg-tertiary/35";
    }

    if (slot === "h7") {
      return "bg-primary/35";
    }

    return "bg-secondary/35";
  }

  if (slot === "h2") {
    return "bg-rose-200";
  }

  if (slot === "h7") {
    return "bg-emerald-200";
  }

  return "bg-sky-200";
}

export function parseIsoAtNoon(isoDate: string): Date | null {
  if (!isIsoDateValue(isoDate.trim())) {
    return null;
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export function getDaysLeft(targetDateIso: string, todayIso: string): number {
  const targetDate = parseIsoAtNoon(targetDateIso);
  const todayDate = parseIsoAtNoon(todayIso);

  if (!targetDate || !todayDate) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((targetDate.getTime() - todayDate.getTime()) / millisecondsPerDay);
}

export function resolveSlotStatus(daysUntilBooking: number): ReminderSlotStatus {
  if (daysUntilBooking === 0) {
    return "open";
  }

  if (daysUntilBooking > 0) {
    return "upcoming";
  }

  return "missed";
}

export function formatSlotStatusLabel(slotStatus: ReminderSlotStatus, daysUntilBooking: number): string {
  if (slotStatus === "open") {
    return "Open Today";
  }

  if (slotStatus === "upcoming") {
    if (daysUntilBooking === 1) {
      return "Upcoming (1 day)";
    }

    return `Upcoming (${daysUntilBooking} days)`;
  }

  const missedDays = Math.abs(daysUntilBooking);
  if (missedDays === 1) {
    return "Missed (1 day)";
  }

  return `Missed (${missedDays} days)`;
}

export function formatSlotStatusCompactLabel(slotStatus: ReminderSlotStatus, daysUntilBooking: number): string {
  if (slotStatus === "open") {
    return "Open";
  }

  if (slotStatus === "upcoming") {
    return daysUntilBooking === 1 ? "Upcoming 1d" : `Upcoming ${daysUntilBooking}d`;
  }

  const missedDays = Math.abs(daysUntilBooking);
  return missedDays === 1 ? "Missed 1d" : `Missed ${missedDays}d`;
}

export function getSlotStatusBadgeClasses(slotStatus: ReminderSlotStatus): string {
  if (slotStatus === "open") {
    return "border-rose-200 bg-rose-100 text-rose-800";
  }

  if (slotStatus === "upcoming") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
}

export function shouldShowSlotStatusBadge(slotStatus: ReminderSlotStatus): boolean {
  return slotStatus === "upcoming";
}

export function getRaudhahStatusBadgeClasses(status: GroupRaudhahStatus): string {
  if (status === "After") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "Before") {
    return "border-amber-200 bg-amber-100 text-amber-800";
  }

  if (status === "Free") {
    return "border-slate-300 bg-slate-100 text-slate-700";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
}

export function getTasrehPrintButtonClasses(tasrehPrinted: boolean): string {
  if (tasrehPrinted) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
  }

  return "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200";
}

export function resolveGroupAppointments(group: GroupData): Array<{
  id: string;
  dateIso: string;
  status: GroupRaudhahStatus;
  tasrehPrinted: boolean;
}> {
  return resolveValidRaudhahAppointments(group).map((appointment) => ({
    id: appointment.id,
    dateIso: appointment.dateIso,
    status: appointment.status,
    tasrehPrinted: Boolean(appointment.tasrehPrinted),
  }));
}

export function countSlotStatuses(appointments: ReminderAppointmentItem[]): {
  open: number;
  upcoming: number;
  notPrinted: number;
} {
  return appointments.reduce(
    (accumulator, appointment) => {
      if (appointment.slotStatus === "open") {
        accumulator.open += 1;
      } else if (appointment.slotStatus === "upcoming") {
        accumulator.upcoming += 1;
      } else if (!appointment.tasrehPrinted) {
        accumulator.notPrinted += 1;
      }
      return accumulator;
    },
    { open: 0, upcoming: 0, notPrinted: 0 },
  );
}

export function formatReminderCardStatusLabel(summary: { open: number; upcoming: number; notPrinted: number }): string {
  if (summary.open > 0) {
    return `${summary.open} Open Today`;
  }

  if (summary.notPrinted > 0) {
    return "Not Printed";
  }

  return `${summary.upcoming} Upcoming`;
}

export function getReminderCardStatusClass(
  summary: { open: number; upcoming: number; notPrinted: number },
  isDarkMode: boolean,
): string {
  if (isDarkMode) {
    return "text-white";
  }

  if (summary.open > 0) {
    return "text-rose-700";
  }

  if (summary.notPrinted > 0) {
    return "text-amber-700";
  }

  return "text-emerald-700";
}

export function getSlotLabel(slot: ReminderSlot): string {
  if (slot === "h2") {
    return "H-2";
  }

  if (slot === "h7") {
    return "H-7";
  }

  return "Upcoming H-7";
}

export function useRaudhahReminder({
  groups,
}: {
  groups: GroupData[];
}) {
  const todayIso = useMemo(() => formatLocalIsoDate(new Date()), []);
  const visaRows = useMemo(() => buildVisaTrackingRowsFromGroups(groups), [groups]);
  const groupByCode = useMemo(() => new Map(groups.map((group) => [group.code, group])), [groups]);

  const [query, setQuery] = useState("");
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const copiedItemTimerRef = useRef<any | null>(null);

  const [h2Page, setH2Page] = useState(1);
  const [h7Page, setH7Page] = useState(1);
  const [upcomingPage, setUpcomingPage] = useState(1);

  const normalizedQuery = query.trim().toLowerCase();

  const reminderItems = useMemo<ReminderItem[]>(() => {
    const list: ReminderItem[] = [];

    visaRows.forEach((row) => {
      const group = groupByCode.get(row.groupCode);
      if (!group) {
        return;
      }

      const appointments = resolveGroupAppointments(group);
      const h2Appointments: ReminderAppointmentItem[] = [];
      const h7Appointments: ReminderAppointmentItem[] = [];
      const upcomingH7Appointments: ReminderAppointmentItem[] = [];

      appointments.forEach((appointment) => {
        if (appointment.status === "Free") {
          return;
        }

        const targetDateIso = appointment.dateIso;
        const h2BookingDate = shiftIsoDate(targetDateIso, -2);
        const h7BookingDate = shiftIsoDate(targetDateIso, -7);

        const h2DaysLeft = getDaysLeft(h2BookingDate, todayIso);
        const h7DaysLeft = getDaysLeft(h7BookingDate, todayIso);

        const isH2Included = h2DaysLeft <= 0;
        const isH7Included = h7DaysLeft <= 0;
        const isUpcomingH7Included = h7DaysLeft > 0 && h7DaysLeft <= MAX_H7_UPCOMING_TARGET_DAYS - 7;

        if (isH2Included) {
          h2Appointments.push({
            id: `${row.groupCode}-h2-${appointment.id}`,
            originalAppointmentId: appointment.id,
            targetDateIso,
            bookingDateIso: h2BookingDate,
            status: appointment.status,
            tasrehPrinted: appointment.tasrehPrinted,
            slotStatus: resolveSlotStatus(h2DaysLeft),
            daysUntilBooking: h2DaysLeft,
          });
        }

        if (isH7Included) {
          h7Appointments.push({
            id: `${row.groupCode}-h7-${appointment.id}`,
            originalAppointmentId: appointment.id,
            targetDateIso,
            bookingDateIso: h7BookingDate,
            status: appointment.status,
            tasrehPrinted: appointment.tasrehPrinted,
            slotStatus: resolveSlotStatus(h7DaysLeft),
            daysUntilBooking: h7DaysLeft,
          });
        } else if (isUpcomingH7Included) {
          upcomingH7Appointments.push({
            id: `${row.groupCode}-h7Upcoming-${appointment.id}`,
            originalAppointmentId: appointment.id,
            targetDateIso,
            bookingDateIso: h7BookingDate,
            status: appointment.status,
            tasrehPrinted: appointment.tasrehPrinted,
            slotStatus: resolveSlotStatus(h7DaysLeft),
            daysUntilBooking: h7DaysLeft,
          });
        }
      });

      const musyrifName = group.musyrif?.name || "-";

      if (h2Appointments.length > 0) {
        const item: ReminderItem = {
          id: `${row.groupCode}-h2`,
          groupCode: row.groupCode,
          groupName: row.groupName,
          packageName: row.packageName,
          musyrifName,
          pax: row.pax,
          appointments: h2Appointments,
          slot: "h2",
          reminderTemplate: "",
        };
        item.reminderTemplate = buildRaudhahReminderTemplate({
          groupCode: row.groupCode,
          groupName: row.groupName,
          totalPax: row.pax,
          packageName: row.packageName,
          departureIso: row.departureIso,
          providerName: group.visaSetup?.syarikah || "Provider pending",
          coordinatorName: musyrifName,
          appointments: h2Appointments.map((app) => ({
            dateIso: app.targetDateIso,
            status: app.status,
          })),
        });
        list.push(item);
      }

      if (h7Appointments.length > 0) {
        const item: ReminderItem = {
          id: `${row.groupCode}-h7`,
          groupCode: row.groupCode,
          groupName: row.groupName,
          packageName: row.packageName,
          musyrifName,
          pax: row.pax,
          appointments: h7Appointments,
          slot: "h7",
          reminderTemplate: "",
        };
        item.reminderTemplate = buildRaudhahReminderTemplate({
          groupCode: row.groupCode,
          groupName: row.groupName,
          totalPax: row.pax,
          packageName: row.packageName,
          departureIso: row.departureIso,
          providerName: group.visaSetup?.syarikah || "Provider pending",
          coordinatorName: musyrifName,
          appointments: h7Appointments.map((app) => ({
            dateIso: app.targetDateIso,
            status: app.status,
          })),
        });
        list.push(item);
      }

      if (upcomingH7Appointments.length > 0) {
        const item: ReminderItem = {
          id: `${row.groupCode}-h7Upcoming`,
          groupCode: row.groupCode,
          groupName: row.groupName,
          packageName: row.packageName,
          musyrifName,
          pax: row.pax,
          appointments: upcomingH7Appointments,
          slot: "h7Upcoming",
          reminderTemplate: "",
        };
        item.reminderTemplate = buildRaudhahReminderTemplate({
          groupCode: row.groupCode,
          groupName: row.groupName,
          totalPax: row.pax,
          packageName: row.packageName,
          departureIso: row.departureIso,
          providerName: group.visaSetup?.syarikah || "Provider pending",
          coordinatorName: musyrifName,
          appointments: upcomingH7Appointments.map((app) => ({
            dateIso: app.targetDateIso,
            status: app.status,
          })),
        });
        list.push(item);
      }
    });

    return list;
  }, [visaRows, groupByCode, todayIso]);

  const searchedReminderItems = useMemo(() => {
    if (!normalizedQuery) {
      return reminderItems;
    }

    return reminderItems.filter((item) =>
      [item.groupCode, item.groupName, item.packageName, item.musyrifName].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [reminderItems, normalizedQuery]);

  const h2Items = useMemo(() => searchedReminderItems.filter((item) => item.slot === "h2"), [searchedReminderItems]);
  const h7Items = useMemo(() => searchedReminderItems.filter((item) => item.slot === "h7"), [searchedReminderItems]);
  const h7UpcomingItems = useMemo(
    () => searchedReminderItems.filter((item) => item.slot === "h7Upcoming"),
    [searchedReminderItems],
  );

  const h2TotalPages = Math.max(1, Math.ceil(h2Items.length / RAUDHAH_PAGE_SIZE));
  const h7TotalPages = Math.max(1, Math.ceil(h7Items.length / RAUDHAH_PAGE_SIZE));
  const upcomingTotalPages = Math.max(1, Math.ceil(h7UpcomingItems.length / RAUDHAH_PAGE_SIZE));

  const h2StartIndex = (h2Page - 1) * RAUDHAH_PAGE_SIZE;
  const h7StartIndex = (h7Page - 1) * RAUDHAH_PAGE_SIZE;
  const upcomingStartIndex = (upcomingPage - 1) * RAUDHAH_PAGE_SIZE;

  const paginatedH2Items = h2Items.slice(h2StartIndex, h2StartIndex + RAUDHAH_PAGE_SIZE);
  const paginatedH7Items = h7Items.slice(h7StartIndex, h7StartIndex + RAUDHAH_PAGE_SIZE);
  const paginatedUpcomingItems = h7UpcomingItems.slice(upcomingStartIndex, upcomingStartIndex + RAUDHAH_PAGE_SIZE);

  const h2RangeStart = h2Items.length === 0 ? 0 : h2StartIndex + 1;
  const h2RangeEnd = h2Items.length === 0 ? 0 : Math.min(h2Items.length, h2StartIndex + paginatedH2Items.length);
  const h7RangeStart = h7Items.length === 0 ? 0 : h7StartIndex + 1;
  const h7RangeEnd = h7Items.length === 0 ? 0 : Math.min(h7Items.length, h7StartIndex + paginatedH7Items.length);
  const upcomingRangeStart = h7UpcomingItems.length === 0 ? 0 : upcomingStartIndex + 1;
  const upcomingRangeEnd =
    h7UpcomingItems.length === 0 ? 0 : Math.min(h7UpcomingItems.length, upcomingStartIndex + paginatedUpcomingItems.length);

  const totalOpenToday = useMemo(() => {
    return reminderItems.reduce((total, item) => {
      const openCount = item.appointments.filter((app) => app.slotStatus === "open").length;
      return total + openCount;
    }, 0);
  }, [reminderItems]);

  const totalUpcoming = useMemo(() => {
    return reminderItems.reduce((total, item) => {
      const upcomingCount = item.appointments.filter((app) => app.slotStatus === "upcoming").length;
      return total + upcomingCount;
    }, 0);
  }, [reminderItems]);

  const totalNotPrinted = useMemo(() => {
    return reminderItems.reduce((total, item) => {
      if (item.slot === "h7Upcoming") {
        return total;
      }
      const notPrintedCount = item.appointments.filter((app) => app.slotStatus !== "upcoming" && !app.tasrehPrinted).length;
      return total + notPrintedCount;
    }, 0);
  }, [reminderItems]);

  useEffect(() => {
    setH2Page(1);
    setH7Page(1);
    setUpcomingPage(1);
  }, [query]);

  useEffect(() => {
    setH2Page((previousPage) => Math.min(previousPage, h2TotalPages));
  }, [h2TotalPages]);

  useEffect(() => {
    setH7Page((previousPage) => Math.min(previousPage, h7TotalPages));
  }, [h7TotalPages]);

  useEffect(() => {
    setUpcomingPage((previousPage) => Math.min(previousPage, upcomingTotalPages));
  }, [upcomingTotalPages]);

  useEffect(
    () => () => {
      if (copiedItemTimerRef.current !== null) {
        window.clearTimeout(copiedItemTimerRef.current);
        copiedItemTimerRef.current = null;
      }
    },
    [],
  );

  const handleCopyTemplate = async (item: ReminderItem) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.reminderTemplate);
      }
    } catch {
      // fallback
    }

    setCopiedItemId(item.id);
    if (copiedItemTimerRef.current !== null) {
      window.clearTimeout(copiedItemTimerRef.current);
    }

    copiedItemTimerRef.current = window.setTimeout(() => {
      setCopiedItemId((current) => (current === item.id ? null : current));
      copiedItemTimerRef.current = null;
    }, 1600);
  };

  return {
    query,
    setQuery,
    copiedItemId,
    h2Page,
    setH2Page,
    h7Page,
    setH7Page,
    upcomingPage,
    setUpcomingPage,
    reminderItems,
    searchedReminderItems,
    h2Items,
    h7Items,
    h7UpcomingItems,
    h2TotalPages,
    h7TotalPages,
    upcomingTotalPages,
    paginatedH2Items,
    paginatedH7Items,
    paginatedUpcomingItems,
    h2RangeStart,
    h2RangeEnd,
    h7RangeStart,
    h7RangeEnd,
    upcomingRangeStart,
    upcomingRangeEnd,
    totalOpenToday,
    totalUpcoming,
    totalNotPrinted,
    handleCopyTemplate,
    visaRows,
  };
}
