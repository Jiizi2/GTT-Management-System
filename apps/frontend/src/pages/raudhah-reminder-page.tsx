import { useEffect, useMemo, useRef, useState } from "react";
import * as Domain from "../shared/app-domain";
import type { GroupData, GroupRaudhahStatus, VisaTrackingRow } from "../shared/app-domain";
import { ThemeToggleButton } from "../components/theme-toggle-button";

const {
  buildVisaTrackingRowsFromGroups,
  formatLocalIsoDate,
  formatVisaDateWithYear,
  isIsoDateValue,
  resolveValidRaudhahAppointments,
  resolveVisaProvider,
  shiftIsoDate,
} = Domain;

type ReminderSlot = "h2" | "h7";
type ReminderSlotStatus = "open" | "upcoming" | "missed";

type ReminderAppointmentItem = {
  id: string;
  originalAppointmentId: string;
  targetDateIso: string;
  bookingDateIso: string;
  status: GroupRaudhahStatus;
  tasrehPrinted: boolean;
  slotStatus: ReminderSlotStatus;
  daysUntilBooking: number;
};

type ReminderItem = {
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

type ReminderSectionConfig = {
  title: string;
  subtitle: string;
  emptyCardClassName: string;
  emptyTitle: string;
  emptyDescription: string;
  cardClassName: string;
  codeChipClassName: string;
};

type PendingTasrehAction = {
  groupCode: string;
  appointmentId: string;
  targetDateIso: string;
  nextTasrehPrinted: boolean;
};

const reminderSectionConfig: Record<ReminderSlot, ReminderSectionConfig> = {
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
};

function getSectionBadgeAccentClass(slot: ReminderSlot): string {
  if (slot === "h2") {
    return "border border-rose-700/30 bg-rose-600 text-white";
  }

  return "border border-emerald-700/30 bg-emerald-600 text-white";
}

function getSectionDividerAccentClass(slot: ReminderSlot): string {
  if (slot === "h2") {
    return "bg-rose-200";
  }

  return "bg-emerald-200";
}

function parseIsoAtNoon(isoDate: string): Date | null {
  if (!isIsoDateValue(isoDate.trim())) {
    return null;
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function getDaysLeft(targetDateIso: string, todayIso: string): number {
  const targetDate = parseIsoAtNoon(targetDateIso);
  const todayDate = parseIsoAtNoon(todayIso);

  if (!targetDate || !todayDate) {
    return 0;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((targetDate.getTime() - todayDate.getTime()) / millisecondsPerDay);
}

function resolveSlotStatus(daysUntilBooking: number): ReminderSlotStatus {
  if (daysUntilBooking === 0) {
    return "open";
  }

  if (daysUntilBooking > 0) {
    return "upcoming";
  }

  return "missed";
}

function formatSlotStatusLabel(slotStatus: ReminderSlotStatus, daysUntilBooking: number): string {
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

function formatSlotStatusCompactLabel(slotStatus: ReminderSlotStatus, daysUntilBooking: number): string {
  if (slotStatus === "open") {
    return "Open";
  }

  if (slotStatus === "upcoming") {
    return daysUntilBooking === 1 ? "Upcoming 1d" : `Upcoming ${daysUntilBooking}d`;
  }

  const missedDays = Math.abs(daysUntilBooking);
  return missedDays === 1 ? "Missed 1d" : `Missed ${missedDays}d`;
}

function getSlotStatusBadgeClasses(slotStatus: ReminderSlotStatus): string {
  if (slotStatus === "open") {
    return "border-rose-200 bg-rose-100 text-rose-800";
  }

  if (slotStatus === "upcoming") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
}

function shouldShowSlotStatusBadge(slotStatus: ReminderSlotStatus): boolean {
  return slotStatus === "upcoming";
}

function getRaudhahStatusBadgeClasses(status: GroupRaudhahStatus): string {
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

function getTasrehPrintButtonClasses(tasrehPrinted: boolean): string {
  if (tasrehPrinted) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200";
  }

  return "border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-200";
}

function formatReminderHeaderDate(isoDate: string): string {
  if (!isoDate) {
    return "-";
  }

  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoDate;
  }

  return parsedDate
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    })
    .toUpperCase()
    .replace(".", "");
}

function buildRaudhahAgentScheduleLines(
  appointments: Array<{ dateIso: string; status: GroupRaudhahStatus }>,
): string[] {
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
    return ["- [tanggal] -> Free", "- [tanggal] -> After", "- [tanggal] -> Before (sebelum dzuhur)"];
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
        return `- ${days.join(" - ")} -> ${status} (sebelum dzuhur)`;
      }

      return `- ${days.join(" - ")} -> ${status}`;
    })
    .filter((line): line is string => line !== null);

  return lines.length > 0
    ? lines
    : ["- [tanggal] -> Free", "- [tanggal] -> After", "- [tanggal] -> Before (sebelum dzuhur)"];
}

function buildNusukSlotScheduleLines(appointments: Array<{ dateIso: string }>): string[] {
  const targetDates = Array.from(new Set(appointments.map((appointment) => appointment.dateIso))).sort((left, right) =>
    left.localeCompare(right),
  );

  if (targetDates.length === 0) {
    return ["- Target [tanggal] -> H-7 [tanggal] | H-2 [tanggal]"];
  }

  return targetDates.map((targetDateIso) => {
    const h7BookingDateIso = shiftIsoDate(targetDateIso, -7);
    const h2BookingDateIso = shiftIsoDate(targetDateIso, -2);
    return `- Target ${formatVisaDateWithYear(targetDateIso)} -> H-7 ${formatVisaDateWithYear(
      h7BookingDateIso,
    )} | H-2 ${formatVisaDateWithYear(h2BookingDateIso)}`;
  });
}

function buildReminderTemplate(args: {
  group: GroupData;
  row: VisaTrackingRow;
  appointments: Array<{ dateIso: string; status: GroupRaudhahStatus }>;
}): string {
  const { group, row, appointments } = args;
  const totalPax = group.pax ?? row.pax;
  const providerName = group.visaSetup?.syarikah?.trim() || resolveVisaProvider(row.packageName);
  const reminderCoordinatorName = (group.musyrif?.name?.trim() || "PIC").toUpperCase();
  const reminderHeaderDate = formatReminderHeaderDate(row.departureIso);
  const raudhahAgentScheduleLines = buildRaudhahAgentScheduleLines(appointments);
  const nusukSlotScheduleLines = buildNusukSlotScheduleLines(appointments);

  return [
    `Reminder Booking Raudhah GROUP ${totalPax} PAX ${row.groupName.toUpperCase()} ${reminderHeaderDate} (${reminderCoordinatorName})`,
    "",
    `Syarikah: ${providerName}`,
    "Slot booking Nusuk hanya dibuka pada H-7 dan H-2 dari target date.",
    "Jadwal slot booking:",
    ...nusukSlotScheduleLines,
    "",
    "Detail Group:",
    `${row.groupCode} -> Ikhwan ... Pax | Akhwat ... pax`,
    "",
    "Jadwal Raudhah Agent:",
    ...raudhahAgentScheduleLines,
  ].join("\n");
}

function resolveGroupAppointments(group: GroupData): Array<{
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

function countSlotStatuses(
  appointments: ReminderAppointmentItem[],
): {
  open: number;
  upcoming: number;
} {
  return appointments.reduce(
    (accumulator, appointment) => {
      if (appointment.slotStatus === "open") {
        accumulator.open += 1;
      } else if (appointment.slotStatus === "upcoming") {
        accumulator.upcoming += 1;
      }
      return accumulator;
    },
    { open: 0, upcoming: 0 },
  );
}

function formatReminderCardStatusLabel(summary: { open: number; upcoming: number }): string {
  if (summary.open > 0) {
    return `${summary.open} Open Today`;
  }

  return `${summary.upcoming} Upcoming`;
}

function getReminderCardStatusClass(summary: { open: number; upcoming: number }): string {
  if (summary.open > 0) {
    return "text-rose-700";
  }

  return "text-emerald-700";
}

function getSlotLabel(slot: ReminderSlot): string {
  return slot === "h2" ? "H-2" : "H-7";
}

function ReminderSection({
  slot,
  items,
  copiedItemId,
  onCopyTemplate,
  onOpenVisaDetail,
  onSetRaudhahTasrehPrinted,
}: {
  slot: ReminderSlot;
  items: ReminderItem[];
  copiedItemId: string | null;
  onCopyTemplate: (item: ReminderItem) => Promise<void>;
  onOpenVisaDetail: (groupCode: string) => void;
  onSetRaudhahTasrehPrinted: (
    groupCode: string,
    appointmentId: string,
    tasrehPrinted: boolean,
  ) => void;
}) {
  const config = reminderSectionConfig[slot];
  const [pendingTasrehAction, setPendingTasrehAction] = useState<PendingTasrehAction | null>(null);

  const handleConfirmTasrehAction = () => {
    if (!pendingTasrehAction) {
      return;
    }

    onSetRaudhahTasrehPrinted(
      pendingTasrehAction.groupCode,
      pendingTasrehAction.appointmentId,
      pendingTasrehAction.nextTasrehPrinted,
    );
    setPendingTasrehAction(null);
  };

  return (
    <>
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${getSectionBadgeAccentClass(
              slot,
            )}`}
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              notifications_active
            </span>
            <span>{config.title}</span>
          </div>
          <span className={`h-px flex-1 ${getSectionDividerAccentClass(slot)}`} aria-hidden="true" />
          <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/80">
            {config.subtitle}
          </span>
        </div>

        {items.length === 0 ? (
          <article className={`rounded-2xl border border-dashed p-8 text-center ${config.emptyCardClassName}`}>
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">
              verified
            </span>
            <h3 className="mt-2 text-base font-extrabold">{config.emptyTitle}</h3>
            <p className="mt-1 text-sm">{config.emptyDescription}</p>
          </article>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => {
              const isCopied = copiedItemId === item.id;
              const sortedAppointments = [...item.appointments].sort((left, right) => {
                const bookingOrder = left.bookingDateIso.localeCompare(right.bookingDateIso);
                if (bookingOrder !== 0) {
                  return bookingOrder;
                }

                return left.targetDateIso.localeCompare(right.targetDateIso);
              });
              const cardSummary = countSlotStatuses(item.appointments);

              return (
                <article
                  key={item.id}
                  className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-ambient ${config.cardClassName}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-lg font-extrabold tracking-wide text-slate-800">{item.groupCode}</strong>
                    <span
                      className={`text-[11px] font-extrabold uppercase tracking-[0.12em] ${getReminderCardStatusClass(cardSummary)}`}
                    >
                      {formatReminderCardStatusLabel(cardSummary)}
                    </span>
                  </div>

                  <h4 className="mt-3 truncate text-base font-bold text-on-surface">{item.groupName}</h4>
                  <p className="mt-1 text-xs text-on-surface-variant">{item.pax} Pilgrims</p>

                  <div className="mt-4 border-t border-outline-variant/35 pt-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/75">
                        {sortedAppointments.length > 1 ? "Target Dates" : "Target Date"}
                      </span>
                      {sortedAppointments.length > 1 ? (
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/70">
                          {sortedAppointments.length} entries
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 space-y-2.5">
                      {sortedAppointments.map((appointment) => (
                        <div key={appointment.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">
                                Target Date
                              </span>
                              <strong className="mt-0.5 block text-base font-extrabold leading-tight text-slate-800">
                                {formatVisaDateWithYear(appointment.targetDateIso)}
                              </strong>
                            </div>
                            {shouldShowSlotStatusBadge(appointment.slotStatus) ? (
                              <span
                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold leading-none whitespace-nowrap ${getSlotStatusBadgeClasses(
                                  appointment.slotStatus,
                                )}`}
                              >
                                {formatSlotStatusCompactLabel(appointment.slotStatus, appointment.daysUntilBooking)}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <p className="min-w-0 text-xs font-semibold text-slate-600">
                              Booking Date:{" "}
                              <span className="font-bold text-slate-800">
                                {formatVisaDateWithYear(appointment.bookingDateIso)}
                              </span>
                            </p>
                          <span
                            className={`inline-flex items-center rounded-md border font-bold leading-none whitespace-nowrap ${
                              appointment.status === "After" ? "px-2.5 py-1 text-[11px]" : "px-2 py-0.5 text-[10px]"
                            } ${getRaudhahStatusBadgeClasses(
                              appointment.status,
                            )}`}
                          >
                            {appointment.status}
                          </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-200 bg-white/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Tasreh Print</p>
                    </div>
                    <div className="mt-2 space-y-2">
                      {sortedAppointments.map((appointment) => (
                        <div key={`${appointment.id}-tasreh`} className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700">
                            {formatVisaDateWithYear(appointment.targetDateIso)}
                          </span>
                          <button
                            type="button"
                            aria-pressed={appointment.tasrehPrinted}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-bold leading-none transition ${getTasrehPrintButtonClasses(
                              appointment.tasrehPrinted,
                            )}`}
                            onClick={() =>
                              setPendingTasrehAction({
                                groupCode: item.groupCode,
                                appointmentId: appointment.originalAppointmentId,
                                targetDateIso: appointment.targetDateIso,
                                nextTasrehPrinted: !appointment.tasrehPrinted,
                              })
                            }
                          >
                            <span className="material-symbols-outlined text-sm" aria-hidden="true">
                              {appointment.tasrehPrinted ? "check_circle" : "print"}
                            </span>
                            <span>{appointment.tasrehPrinted ? "Printed" : "Belum Print"}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      className="serene-btn-primary h-9 flex-1 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em]"
                      onClick={() => onOpenVisaDetail(item.groupCode)}
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                        travel_explore
                      </span>
                      <span>Visa</span>
                    </button>
                    <button
                      type="button"
                      className={`inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border px-3 text-[11px] font-bold uppercase tracking-[0.08em] transition ${
                        isCopied
                          ? "border-emerald-200 bg-emerald-100 text-emerald-800"
                          : "border-primary/35 bg-primary-fixed/55 text-primary hover:bg-primary-fixed hover:border-primary/45"
                      }`}
                      onClick={() => {
                        void onCopyTemplate(item);
                      }}
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                        {isCopied ? "check" : "content_copy"}
                      </span>
                      <span>{isCopied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {pendingTasrehAction ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi update status print tasreh"
          onClick={() => setPendingTasrehAction(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-slate-900">Konfirmasi Status Tasreh</h3>
            <p className="mt-2 text-sm text-slate-600">
              Target date <strong>{formatVisaDateWithYear(pendingTasrehAction.targetDateIso)}</strong> akan diubah
              menjadi{" "}
              <strong>{pendingTasrehAction.nextTasrehPrinted ? "Printed" : "Belum Print"}</strong>.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-slate-700 transition hover:bg-slate-200"
                onClick={() => setPendingTasrehAction(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-emerald-800 transition hover:bg-emerald-200"
                onClick={handleConfirmTasrehAction}
              >
                Ya, Simpan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function RaudhahReminderScreen({
  groups,
  onOpenDetail: _onOpenDetail,
  onOpenVisaDetail,
  onSetRaudhahTasrehPrinted,
}: {
  groups: GroupData[];
  onOpenDetail: (groupCode: string) => void;
  onOpenVisaDetail: (row: VisaTrackingRow) => void;
  onSetRaudhahTasrehPrinted: (
    groupCode: string,
    appointmentId: string,
    tasrehPrinted: boolean,
  ) => void;
}) {
  const [query, setQuery] = useState("");
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const todayIso = useMemo(() => formatLocalIsoDate(new Date()), []);
  const syncedAtLabel = useMemo(() => {
    const now = new Date();
    return now.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  useEffect(
    () => () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = null;
      }
    },
    [],
  );

  const visaRows = useMemo(() => buildVisaTrackingRowsFromGroups(groups), [groups]);

  const visaRowByGroupCode = useMemo(
    () =>
      new Map(
        visaRows.map((row) => [
          row.groupCode.toUpperCase(),
          row,
        ] as const),
      ),
    [visaRows],
  );

  const reminderItems = useMemo<ReminderItem[]>(() => {
    const slotOrder: ReminderSlot[] = ["h2", "h7"];
    const slotPriority: Record<ReminderSlot, number> = { h2: 0, h7: 1 };
    const statusPriority: Record<ReminderSlotStatus, number> = { open: 0, upcoming: 1, missed: 2 };

    const resolveNearestRankingValue = (item: ReminderItem): number => {
      const upcomingDays = item.appointments
        .filter((appointment) => appointment.slotStatus === "upcoming")
        .map((appointment) => appointment.daysUntilBooking);
      if (upcomingDays.length > 0) {
        return Math.min(...upcomingDays);
      }

      const missedDays = item.appointments
        .filter((appointment) => appointment.slotStatus === "missed")
        .map((appointment) => Math.abs(appointment.daysUntilBooking));
      if (missedDays.length > 0) {
        return 1000 + Math.min(...missedDays);
      }

      return 9999;
    };

    return groups
      .flatMap((group) => {
        const row = visaRowByGroupCode.get(group.code.toUpperCase());
        if (!row) {
          return [];
        }

        const appointmentEntries = resolveGroupAppointments(group);
        if (appointmentEntries.length === 0) {
          return [];
        }

        const scheduleAppointments = appointmentEntries.map((appointment) => ({
          dateIso: appointment.dateIso,
          status: appointment.status,
        }));
        const reminderTemplate = buildReminderTemplate({
          group,
          row,
          appointments: scheduleAppointments,
        });

        const appointmentsBySlot: Record<ReminderSlot, ReminderAppointmentItem[]> = {
          h2: [],
          h7: [],
        };

        appointmentEntries.forEach((appointment) => {
          const targetDaysLeft = getDaysLeft(appointment.dateIso, todayIso);
          let slot: ReminderSlot | null = null;

          if (targetDaysLeft >= 0 && targetDaysLeft <= 2) {
            slot = "h2";
          } else if (targetDaysLeft >= 0 && targetDaysLeft <= 7) {
            slot = "h7";
          }

          if (!slot) {
            return;
          }

          const h7BookingDateIso = shiftIsoDate(appointment.dateIso, -7);
          const bookingDateIso = slot === "h7" ? h7BookingDateIso : shiftIsoDate(appointment.dateIso, -2);
          const daysUntilBooking = getDaysLeft(bookingDateIso, todayIso);
          const slotStatus = resolveSlotStatus(daysUntilBooking);
          const shouldKeepMissedH2ForTasreh =
            slot === "h2" && slotStatus === "missed" && !appointment.tasrehPrinted;

          if (slotStatus === "missed" && !shouldKeepMissedH2ForTasreh) {
            return;
          }

          appointmentsBySlot[slot].push({
            id: `${group.code}-${appointment.id}-${slot}`,
            originalAppointmentId: appointment.id,
            targetDateIso: appointment.dateIso,
            bookingDateIso,
            status: appointment.status,
            tasrehPrinted: Boolean(appointment.tasrehPrinted),
            slotStatus,
            daysUntilBooking,
          });
        });

        return slotOrder
          .map((slot) => {
            const slotAppointments = appointmentsBySlot[slot].sort((left, right) => {
              const bookingOrder = left.bookingDateIso.localeCompare(right.bookingDateIso);
              if (bookingOrder !== 0) {
                return bookingOrder;
              }

              return left.targetDateIso.localeCompare(right.targetDateIso);
            });

            return {
              id: `${group.code}-reminder-${slot}`,
              groupCode: group.code,
              groupName: group.name,
              packageName: group.packageName,
              musyrifName: group.musyrif?.name ?? "PIC",
              pax: Math.max(1, group.pax),
              appointments: slotAppointments,
              slot,
              reminderTemplate,
            };
          })
          .filter((item) => item.appointments.length > 0);
      })
      .sort((left, right) => {
        if (slotPriority[left.slot] !== slotPriority[right.slot]) {
          return slotPriority[left.slot] - slotPriority[right.slot];
        }

        const leftBestStatus = Math.min(...left.appointments.map((appointment) => statusPriority[appointment.slotStatus]));
        const rightBestStatus = Math.min(...right.appointments.map((appointment) => statusPriority[appointment.slotStatus]));
        if (leftBestStatus !== rightBestStatus) {
          return leftBestStatus - rightBestStatus;
        }

        const leftNearestRankingValue = resolveNearestRankingValue(left);
        const rightNearestRankingValue = resolveNearestRankingValue(right);
        if (leftNearestRankingValue !== rightNearestRankingValue) {
          return leftNearestRankingValue - rightNearestRankingValue;
        }

        return left.groupCode.localeCompare(right.groupCode);
      });
  }, [groups, todayIso, visaRowByGroupCode]);

  const normalizedQuery = query.trim().toLowerCase();
  const hasQuery = normalizedQuery.length > 0;

  const filteredItems = useMemo(
    () =>
      reminderItems.filter((item) => {
        if (!normalizedQuery) {
          return true;
        }

        const slotLabel = getSlotLabel(item.slot);
        return [
          item.groupCode,
          item.groupName,
          item.packageName,
          item.musyrifName,
          slotLabel,
          item.appointments
            .map(
              (appointment) =>
                `${formatVisaDateWithYear(appointment.targetDateIso)} ${formatVisaDateWithYear(
                  appointment.bookingDateIso,
                )} ${appointment.status} ${formatSlotStatusLabel(appointment.slotStatus, appointment.daysUntilBooking)}`,
            )
            .join(" "),
        ].some((value) => value.toLowerCase().includes(normalizedQuery));
      }),
    [normalizedQuery, reminderItems],
  );

  const h2Items = filteredItems.filter((item) => item.slot === "h2");
  const h7Items = filteredItems.filter((item) => item.slot === "h7");

  const slotStatusSummary = useMemo(
    () =>
      filteredItems
        .flatMap((item) => item.appointments)
        .reduce(
          (accumulator, appointment) => {
            if (appointment.slotStatus === "open") {
              accumulator.open += 1;
            } else if (appointment.slotStatus === "upcoming") {
              accumulator.upcoming += 1;
            }
            return accumulator;
          },
          { open: 0, upcoming: 0 },
        ),
    [filteredItems],
  );

  const handleCopyTemplate = async (item: ReminderItem): Promise<void> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(item.reminderTemplate);
      }
    } catch {
      // No-op: keep copied feedback behavior consistent with visa detail page.
    }

    setCopiedItemId(item.id);
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current);
    }

    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedItemId(null);
      copiedTimerRef.current = null;
    }, 1600);
  };

  const handleOpenVisaDetail = (groupCode: string) => {
    const visaRow = visaRowByGroupCode.get(groupCode.toUpperCase());
    if (!visaRow) {
      return;
    }

    onOpenVisaDetail(visaRow);
  };

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex w-full max-w-xl items-center gap-3">
          <label
            className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface-container-lowest px-4 shadow-ambient sm:h-14"
            aria-label="Search reminder groups"
          >
            <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              className="w-full border-none bg-transparent text-sm font-medium text-on-surface-variant outline-none placeholder:text-on-surface-variant/50"
              placeholder="Search group, PIC, target date, or booking slot..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <ThemeToggleButton className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-lowest hover:text-primary sm:hidden" />
        </div>

        {hasQuery ? (
          <button
            type="button"
            className="text-sm font-semibold text-primary transition hover:text-primary/90 sm:ml-auto"
            onClick={() => setQuery("")}
          >
            Clear search
          </button>
        ) : null}
      </header>

      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-surface-container-lowest p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Global Operations</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Raudhah Booking Slots
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Booking Nusuk untuk target tanggal yang sama hanya dibuka pada 2 momen: H-7 dan H-2.
            Board ini memantau kedua slot tersebut per target date.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <span className="material-symbols-outlined text-base text-emerald-700" aria-hidden="true">
            schedule
          </span>
          <span>Last synced: {syncedAtLabel}</span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Booking slot summary">
        <article className="relative overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/55 p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-700">Open Today</p>
          <strong className="mt-2 block text-4xl font-extrabold leading-none text-rose-800">
            {String(slotStatusSummary.open).padStart(2, "0")} Slots
          </strong>
          <p className="mt-2 text-xs font-semibold text-rose-700">Aksi booking Nusuk hari ini</p>
          <span className="material-symbols-outlined absolute right-5 top-5 text-3xl text-rose-600/90" aria-hidden="true">
            today
          </span>
        </article>

        <article className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/55 p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">Upcoming</p>
          <strong className="mt-2 block text-4xl font-extrabold leading-none text-emerald-800">
            {String(slotStatusSummary.upcoming).padStart(2, "0")} Slots
          </strong>
          <p className="mt-2 text-xs font-semibold text-emerald-700">Slot yang belum buka, masih menunggu</p>
          <span className="material-symbols-outlined absolute right-5 top-5 text-3xl text-emerald-700/90" aria-hidden="true">
            event_upcoming
          </span>
        </article>

      </section>

      {filteredItems.length === 0 ? (
        <article className="rounded-3xl border border-dashed border-slate-300 bg-surface-container-lowest p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">
            search_off
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-800">No reminder entries found</h2>
          <p className="mt-2 text-sm text-slate-600">Coba kata kunci lain atau kosongkan pencarian.</p>
        </article>
      ) : (
        <div className="space-y-10">
          <ReminderSection
            slot="h2"
            items={h2Items}
            copiedItemId={copiedItemId}
            onCopyTemplate={handleCopyTemplate}
            onOpenVisaDetail={handleOpenVisaDetail}
            onSetRaudhahTasrehPrinted={onSetRaudhahTasrehPrinted}
          />

          <ReminderSection
            slot="h7"
            items={h7Items}
            copiedItemId={copiedItemId}
            onCopyTemplate={handleCopyTemplate}
            onOpenVisaDetail={handleOpenVisaDetail}
            onSetRaudhahTasrehPrinted={onSetRaudhahTasrehPrinted}
          />
        </div>
      )}
    </div>
  );
}
