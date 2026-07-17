import { useState } from "react";
import type { GroupData, VisaTrackingRow } from "../shared/app-domain";
import { useThemeMode } from "../theme/theme-provider";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { useRaudhahReminder, type PendingTasrehAction } from "./raudhah-reminder/hooks/use-raudhah-reminder";
import { RaudhahReminderSection } from "./raudhah-reminder/components/RaudhahReminderSection";
import { RaudhahReminderConfirmModal } from "./raudhah-reminder/components/RaudhahReminderConfirmModal";
import { AgentFilterSelect } from "../components/agent-filter-select";

export function RaudhahReminderScreen({
  groups,
  onOpenVisaDetail,
  onSetRaudhahTasrehPrinted,
}: {
  groups: GroupData[];
  onOpenVisaDetail: (row: VisaTrackingRow) => void;
  onSetRaudhahTasrehPrinted: (groupCode: string, appointmentId: string, tasrehPrinted: boolean) => void;
}) {
  const { theme } = useThemeMode();
  const isDarkMode = theme === "dark";

  const [agentFilter, setAgentFilter] = useState("all");
  const scopedGroups = agentFilter === "all" ? groups : groups.filter((group) => group.agentId === agentFilter);
  const state = useRaudhahReminder({ groups: scopedGroups });

  const {
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
  } = state;

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

  const handleOpenVisaDetailWithCode = (groupCode: string) => {
    const row = state.visaRows.find((r: VisaTrackingRow) => r.groupCode === groupCode);
    if (row && onOpenVisaDetail) {
      onOpenVisaDetail(row);
    }
  };

  const hasActiveReminders = reminderItems.length > 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 py-4 sm:py-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p
            className={`text-xs font-bold uppercase tracking-[0.2em] ${
              isDarkMode ? "text-primary/85" : "text-sky-700"
            }`}
          >
            Raudhah Monitor
          </p>
          <h2 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-on-surface sm:text-3xl">
            Raudhah Booking Reminders
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            <span className="sm:hidden">Booking reminder H-2, H-7 and print check.</span>
            <span className="hidden sm:inline">
              Monitor booking windows for Raudhah slots: H-2 window, H-7 window, and tasreh print status.
            </span>
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <label className="serene-page-search w-full cursor-text transition focus-within:border-primary/25 focus-within:ring-2 focus-within:ring-primary/15 sm:max-w-xs">
            <span className="material-symbols-outlined text-slate-400" aria-hidden="true">
              search
            </span>
            <input
              type="search"
              className="serene-page-search-input h-full"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search group code, name, musyrif..."
            />
          </label>

          <AgentFilterSelect value={agentFilter} onChange={setAgentFilter} className="w-full sm:w-auto" />

          <ThemeToggleButton className="sm:ml-auto sm:mr-5" />
        </div>
      </header>

      {/* Stats Counter panel */}
      {hasActiveReminders ? (
        <section className="grid gap-3 sm:grid-cols-3" aria-label="Raudhah schedule statistics">
          <div className="serene-stat-card border-rose-200 bg-rose-50/40">
            <span className="material-symbols-outlined text-rose-700" aria-hidden="true">
              alarm_on
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">Booking Open Today</p>
              <strong className="text-xl font-bold text-rose-900">{totalOpenToday} Slots</strong>
            </div>
          </div>

          <div className="serene-stat-card border-emerald-200 bg-emerald-50/40">
            <span className="material-symbols-outlined text-emerald-700" aria-hidden="true">
              pending_actions
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Upcoming Bookings</p>
              <strong className="text-xl font-bold text-emerald-900">{totalUpcoming} Slots</strong>
            </div>
          </div>

          <div className="serene-stat-card border-amber-200 bg-amber-50/40">
            <span className="material-symbols-outlined text-amber-700" aria-hidden="true">
              print_disabled
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Tasreh Not Printed</p>
              <strong className="text-xl font-bold text-amber-900">{totalNotPrinted} Bookings</strong>
            </div>
          </div>
        </section>
      ) : null}

      {!hasActiveReminders ? (
        <article className="serene-card rounded-3xl border border-dashed border-outline-variant/45 p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/60" aria-hidden="true">
            notifications_off
          </span>
          <h2 className="mt-3 text-xl font-bold text-on-surface">No booking reminders found</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Semua grup operasional tidak memiliki jadwal Raudhah aktif, atau tidak ada jadwal booking dalam rentang
            target H-2 s/d H-12.
          </p>
        </article>
      ) : (
        <div className="space-y-8">
          <RaudhahReminderSection
            slot="h2"
            items={paginatedH2Items}
            copiedItemId={copiedItemId}
            isDarkMode={isDarkMode}
            onCopyTemplate={handleCopyTemplate}
            onOpenVisaDetail={handleOpenVisaDetailWithCode}
            onInitiateTasrehAction={setPendingTasrehAction}
            currentPage={h2Page}
            totalPages={h2TotalPages}
            totalItems={h2Items.length}
            rangeStart={h2RangeStart}
            rangeEnd={h2RangeEnd}
            onPageChange={setH2Page}
          />

          <RaudhahReminderSection
            slot="h7"
            items={paginatedH7Items}
            copiedItemId={copiedItemId}
            isDarkMode={isDarkMode}
            onCopyTemplate={handleCopyTemplate}
            onOpenVisaDetail={handleOpenVisaDetailWithCode}
            onInitiateTasrehAction={setPendingTasrehAction}
            currentPage={h7Page}
            totalPages={h7TotalPages}
            totalItems={h7Items.length}
            rangeStart={h7RangeStart}
            rangeEnd={h7RangeEnd}
            onPageChange={setH7Page}
          />

          <RaudhahReminderSection
            slot="h7Upcoming"
            items={paginatedUpcomingItems}
            copiedItemId={copiedItemId}
            isDarkMode={isDarkMode}
            onCopyTemplate={handleCopyTemplate}
            onOpenVisaDetail={handleOpenVisaDetailWithCode}
            onInitiateTasrehAction={setPendingTasrehAction}
            currentPage={upcomingPage}
            totalPages={upcomingTotalPages}
            totalItems={h7UpcomingItems.length}
            rangeStart={upcomingRangeStart}
            rangeEnd={upcomingRangeEnd}
            onPageChange={setUpcomingPage}
          />
        </div>
      )}

      {pendingTasrehAction ? (
        <RaudhahReminderConfirmModal
          pendingAction={pendingTasrehAction}
          onClose={() => setPendingTasrehAction(null)}
          onConfirm={handleConfirmTasrehAction}
        />
      ) : null}
    </div>
  );
}
