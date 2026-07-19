import { useMemo } from "react";
import type { GroupData } from "../shared/app-domain";
import { PaginationControls } from "../components/pagination-controls";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { useChecklistWorkspace } from "./checklist/hooks/use-checklist-workspace";
import { ChecklistNeedAttentionCard } from "./checklist/components/ChecklistNeedAttentionCard";
import { ChecklistCompletedCard } from "./checklist/components/ChecklistCompletedCard";
import { ChecklistCancelModal } from "./checklist/components/ChecklistCancelModal";
import { AgentFilterSelect } from "../components/agent-filter-select";

export function ChecklistScreen({ groups }: { groups: GroupData[] }) {
  const state = useChecklistWorkspace({ groups });

  const {
    checklistItems,
    groupsByCode,
    groupsWithItineraryCount,
    driverDrafts,
    confirmedDrivers,
    copiedItemId,
    groupCodeQuery,
    setGroupCodeQuery,
    agentFilter,
    setAgentFilter,
    pendingPage,
    setPendingPage,
    completedPage,
    setCompletedPage,
    hasGroupCodeQuery,
    getRequiredDriverCount,
    isChecklistItemCompleted,
    isTwoDaysAwayChecklistItem,
    searchedChecklistItems,
    pendingItems,
    completedItems,
    isClear,
    pendingTotalPages,
    completedTotalPages,
    paginatedPendingItems,
    paginatedCompletedItems,
    pendingRangeStart,
    pendingRangeEnd,
    completedRangeStart,
    completedRangeEnd,
    cancelTargetItem,
    handleDraftChange,
    handleConfirmDriver,
    handleCopyDriver,
    handleCopyTripWithoutDriverName,
    handleOpenCancelConfirm,
    handleCloseCancelConfirm,
    handleConfirmCancelAssignment,
  } = state;

  if (checklistItems.length === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <header className="serene-card rounded-3xl p-5">
          <h2 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">H-1 Checklist</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            <span className="sm:hidden">Driver readiness for next 3 days.</span>
            <span className="hidden sm:inline">
              Driver readiness for trips scheduled today, tomorrow, and the day after tomorrow.
            </span>
          </p>
        </header>

        <article className="serene-card rounded-3xl border border-dashed border-outline-variant/45 p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/60" aria-hidden="true">
            event_busy
          </span>
          <h2 className="mt-3 text-xl font-bold text-on-surface">No upcoming trips in the next 3 days</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            <span className="sm:hidden">No trip scheduled in the next 3 days.</span>
            <span className="hidden sm:inline">
              No itinerary is scheduled for today, tomorrow, and the day after tomorrow.
            </span>
          </p>
          {groupsWithItineraryCount > 0 ? (
            <p className="mt-3 text-xs font-medium text-on-surface-variant">
              Beberapa group punya itinerary, tetapi belum masuk rentang H-1 (hari ini s/d H+2) atau tanggal itinerary
              belum valid.
            </p>
          ) : null}
        </article>
      </div>
    );
  }

  const statusTitle = isClear ? "Clear" : "Not Clear";
  const statusMessage = hasGroupCodeQuery
    ? isClear
      ? "No pending driver assignment found for the searched group number."
      : `${pendingItems.length} searched trips still need driver assignment.`
    : isClear
      ? "All trips for today, tomorrow, and the day after tomorrow already have a verified driver."
      : `${pendingItems.length} trips still do not have a driver assigned in the next 3 days.`;
  const statusMessageMobile = hasGroupCodeQuery
    ? isClear
      ? "No pending driver for this group."
      : `${pendingItems.length} trips still need drivers.`
    : isClear
      ? "All trips already have verified drivers."
      : `${pendingItems.length} trips need driver assignment.`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <section className="serene-page-toolbar" aria-label="Search checklist items">
        <div className="flex min-w-0 flex-1 max-w-xl items-center gap-3">
          <label className="serene-page-search">
            <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              className="serene-page-search-input"
              value={groupCodeQuery}
              onChange={(event) => setGroupCodeQuery(event.target.value)}
              placeholder="Search group number, e.g. 901794508"
            />
          </label>
        </div>
        <ThemeToggleButton className="sm:ml-auto sm:mr-5" />
      </section>

      <header className="serene-card flex flex-col gap-4 rounded-3xl p-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">H-1 Checklist</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            <span className="sm:hidden">Driver readiness for next 3 days.</span>
            <span className="hidden sm:inline">
              Driver readiness for trips scheduled today, tomorrow, and the day after tomorrow.
            </span>
          </p>
        </div>
        <AgentFilterSelect value={agentFilter} onChange={setAgentFilter} variant="field" className="w-full sm:w-56" />
      </header>

      {hasGroupCodeQuery && searchedChecklistItems.length === 0 ? (
        <article className="serene-card rounded-3xl border border-dashed border-outline-variant/45 p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant/60" aria-hidden="true">
            search_off
          </span>
          <h2 className="mt-3 text-xl font-bold text-on-surface">Group number not found</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            <span className="sm:hidden">Try another code or clear search.</span>
            <span className="hidden sm:inline">Try another group code or clear search to see all checklist items.</span>
          </p>
        </article>
      ) : null}

      {isClear ? (
        <section className="checklist-clear-section flex items-start gap-3 rounded-2xl p-4">
          <div
            className="checklist-clear-icon inline-flex h-9 w-9 items-center justify-center rounded-full"
            aria-hidden="true"
          >
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold">{statusTitle}</h3>
            <p className="text-sm opacity-90">
              <span className="sm:hidden">{statusMessageMobile}</span>
              <span className="hidden sm:inline">{statusMessage}</span>
            </p>
          </div>
        </section>
      ) : null}

      {searchedChecklistItems.length > 0 ? (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="checklist-need-heading text-sm font-extrabold uppercase tracking-[0.16em]">
                Need Attention
              </h3>
              <span className="checklist-need-summary-badge rounded-lg px-3 py-1 text-xs font-bold uppercase leading-none tracking-[0.12em]">
                {pendingItems.length} Actions Required
              </span>
              <span className="checklist-section-divider hidden h-px flex-1 sm:block" aria-hidden="true" />
            </div>

            {pendingItems.length > 0 ? (
              <div className="space-y-4">
                {paginatedPendingItems.map((item) => {
                  const draft = driverDrafts[item.id] ?? { name: "", phone: "", plateNumber: "" };
                  const requiredDriverCount = getRequiredDriverCount(item);
                  const assignedDrivers = confirmedDrivers[item.id]?.drivers.slice(0, requiredDriverCount) ?? [];
                  const isComplete = assignedDrivers.length >= requiredDriverCount;
                  const isConfirmDisabled = isComplete || !draft.name.trim() || !draft.phone.trim() || !draft.plateNumber.trim();
                  return (
                    <ChecklistNeedAttentionCard
                      key={item.id}
                      item={item}
                      draft={draft}
                      assignedDrivers={assignedDrivers}
                      requiredDriverCount={requiredDriverCount}
                      isTwoDaysAway={isTwoDaysAwayChecklistItem(item)}
                      groupRecord={groupsByCode.get(item.groupCode.trim().toUpperCase())}
                      copiedItemId={copiedItemId}
                      isConfirmDisabled={isConfirmDisabled}
                      onCopyTripWithoutDriverName={handleCopyTripWithoutDriverName}
                      onDraftChange={handleDraftChange}
                      onConfirmDriver={handleConfirmDriver}
                    />
                  );
                })}
              </div>
            ) : (
              <article className="checklist-need-empty rounded-2xl p-8 text-center">
                <span className="material-symbols-outlined text-3xl text-brand-primary" aria-hidden="true">
                  verified
                </span>
                <h2 className="mt-2 text-lg font-bold text-on-surface">All trips are ready</h2>
                <p className="mt-1 text-sm text-on-surface-variant">
                  <span className="sm:hidden">No pending driver assignment.</span>
                  <span className="hidden sm:inline">There are no pending driver assignments in the next 3 days.</span>
                </p>
              </article>
            )}

            <PaginationControls
              currentPage={pendingPage}
              totalPages={pendingTotalPages}
              totalItems={pendingItems.length}
              rangeStart={pendingRangeStart}
              rangeEnd={pendingRangeEnd}
              itemLabel="pending trips"
              onPageChange={(nextPage) => setPendingPage(Math.max(1, Math.min(pendingTotalPages, nextPage)))}
            />
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="checklist-complete-heading text-sm font-extrabold uppercase tracking-[0.16em]">
                Completed
              </h3>
              <span className="checklist-complete-summary-badge rounded-lg px-3 py-1 text-xs font-bold uppercase leading-none tracking-[0.12em]">
                {completedItems.length} Trips Assigned
              </span>
              <span className="checklist-section-divider hidden h-px flex-1 sm:block" aria-hidden="true" />
            </div>

            <div className="space-y-3">
              {paginatedCompletedItems.map((item) => {
                const assignment = confirmedDrivers[item.id];
                if (!assignment) {
                  return null;
                }
                return (
                  <ChecklistCompletedCard
                    key={item.id}
                    item={item}
                    assignment={assignment}
                    isTwoDaysAway={isTwoDaysAwayChecklistItem(item)}
                    groupRecord={groupsByCode.get(item.groupCode.trim().toUpperCase())}
                    requiredDriverCount={getRequiredDriverCount(item)}
                    copiedItemId={copiedItemId}
                    onOpenCancelConfirm={handleOpenCancelConfirm}
                    onCopyDriver={handleCopyDriver}
                  />
                );
              })}
            </div>

            <PaginationControls
              currentPage={completedPage}
              totalPages={completedTotalPages}
              totalItems={completedItems.length}
              rangeStart={completedRangeStart}
              rangeEnd={completedRangeEnd}
              itemLabel="completed trips"
              onPageChange={(nextPage) => setCompletedPage(Math.max(1, Math.min(completedTotalPages, nextPage)))}
            />
          </section>
        </>
      ) : null}

      {cancelTargetItem ? (
        <ChecklistCancelModal
          cancelTargetItem={cancelTargetItem}
          onClose={handleCloseCancelConfirm}
          onConfirm={handleConfirmCancelAssignment}
        />
      ) : null}
    </div>
  );
}
