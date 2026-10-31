import type { GroupData } from "../shared/app-domain";
import { PaginationControls } from "../components/pagination-controls";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { useChecklistWorkspace } from "./checklist/hooks/use-checklist-workspace";
import { ChecklistNeedAttentionCard } from "./checklist/components/ChecklistNeedAttentionCard";
import { ChecklistCompletedCard } from "./checklist/components/ChecklistCompletedCard";
import { ChecklistCancelModal } from "./checklist/components/ChecklistCancelModal";
import { AgentFilterSelect } from "../components/agent-filter-select";
import { DataBoundary, type DataQueryState } from "../components/data-boundary";
import { ChecklistSkeleton } from "../components/skeleton";

export function ChecklistScreen({ groups, dataState }: { groups: GroupData[]; dataState?: DataQueryState }) {
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
    dayFilter,
    setDayFilter,
    dayFilterOptions,
    pendingPage,
    setPendingPage,
    completedPage,
    setCompletedPage,
    hasGroupCodeQuery,
    getRequiredDriverCount,
    isTwoDaysAwayChecklistItem,
    searchedChecklistItems,
    pendingItems,
    completedItems,
    pendingGroups,
    completedGroups,
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
  const hasFilters = hasGroupCodeQuery || agentFilter !== "all" || dayFilter !== "all";
  const resultGroupCount = new Set(searchedChecklistItems.map((item) => item.groupCode)).size;
  const hasData = !dataState || dataState.data !== undefined;
  const resetFilters = () => {
    setGroupCodeQuery("");
    setAgentFilter("all");
    setDayFilter("all");
  };

  return (
    <div className="serene-data-reveal mx-auto max-w-7xl space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">H-1 Checklist</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Monitor trip and driver readiness for today, tomorrow, and the day after tomorrow.
          </p>
        </div>
        <ThemeToggleButton />
      </header>

      <section className="serene-card space-y-4 rounded-2xl p-4 sm:p-5" aria-label="Checklist filters">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="block text-sm font-semibold text-on-surface">Find a group</span>
            <input
              type="search"
              className="serene-input w-full"
              value={groupCodeQuery}
              onChange={(event) => setGroupCodeQuery(event.target.value)}
              placeholder="Search group number or name"
            />
          </label>
          <AgentFilterSelect value={agentFilter} onChange={setAgentFilter} variant="field" className="w-full sm:w-56" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Filter by trip day">
          {dayFilterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={dayFilter === option.value}
              onClick={() => setDayFilter(option.value)}
              className={`serene-focus-ring flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                dayFilter === option.value
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high"
              }`}
            >
              <span>{option.label}</span>
              <span className="tabular-nums">
                {hasData ? option.count : "—"}
                <span className="sr-only"> trips</span>
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/30 pt-3">
          <p className="text-sm text-on-surface-variant" role="status" aria-live="polite">
            {hasData ? (
              <>
                <strong className="text-on-surface">{resultGroupCount} groups</strong> · {searchedChecklistItems.length}{" "}
                trips · {pendingItems.length} need attention · {completedItems.length} completed
              </>
            ) : dataState?.isError ? (
              "Checklist unavailable."
            ) : (
              "Loading checklist…"
            )}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="serene-focus-ring min-h-11 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-surface-container-high"
            >
              Reset filters
            </button>
          ) : null}
        </div>
      </section>

      <DataBoundary query={dataState} skeleton={<ChecklistSkeleton />}>
        {searchedChecklistItems.length === 0 ? (
          <article className="serene-card rounded-2xl border border-dashed border-outline-variant/45 p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant" aria-hidden="true">
              {hasFilters ? "search_off" : "event_busy"}
            </span>
            <h2 className="mt-3 text-xl font-bold text-on-surface">
              {hasFilters ? "No trips match your filters" : "No upcoming trips in the next 3 days"}
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              {hasFilters
                ? "Try another day, agent, or group name. Reset filters to see all upcoming trips."
                : "No itinerary is scheduled for today, tomorrow, or the day after tomorrow."}
            </p>
            {!hasFilters && checklistItems.length === 0 && groupsWithItineraryCount > 0 ? (
              <p className="mt-3 text-xs text-on-surface-variant">
                Beberapa group punya itinerary, tetapi belum masuk rentang hari ini s/d H+2 atau tanggalnya belum valid.
              </p>
            ) : null}
          </article>
        ) : (
          <>
            {isClear ? (
              <section className="checklist-clear-section flex items-start gap-3 rounded-2xl p-4">
                <span className="material-symbols-outlined" aria-hidden="true">
                  check_circle
                </span>
                <div>
                  <h2 className="font-bold">Clear</h2>
                  <p className="mt-1 text-sm">All trips matching these filters have assigned drivers.</p>
                </div>
              </section>
            ) : null}
            <section className="space-y-4" aria-label="Need Attention">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="checklist-need-heading text-lg font-bold">Need Attention</h2>
                <span className="checklist-need-summary-badge rounded-lg px-3 py-1 text-xs font-semibold">
                  {pendingGroups.length} groups · {pendingItems.length} trips
                </span>
              </div>
              {pendingGroups.length > 0 ? (
                <div className="serene-data-reveal space-y-4">
                  {paginatedPendingItems.map((item) => {
                    const draft = driverDrafts[item.id] ?? { name: "", phone: "", plateNumber: "" };
                    const requiredDriverCount = getRequiredDriverCount(item);
                    const assignedDrivers = confirmedDrivers[item.id]?.drivers.slice(0, requiredDriverCount) ?? [];
                    const isConfirmDisabled =
                      assignedDrivers.length >= requiredDriverCount ||
                      !draft.name.trim() ||
                      !draft.phone.trim() ||
                      !draft.plateNumber.trim();
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
                <p className="text-sm text-on-surface-variant">No pending driver assignments for these filters.</p>
              )}
              <PaginationControls
                currentPage={pendingPage}
                totalPages={pendingTotalPages}
                totalItems={pendingGroups.length}
                rangeStart={pendingRangeStart}
                rangeEnd={pendingRangeEnd}
                itemLabel="pending groups"
                touchSafe
                onPageChange={(nextPage) => setPendingPage(Math.max(1, Math.min(pendingTotalPages, nextPage)))}
              />
            </section>
            {completedGroups.length > 0 ? (
              <section className="space-y-4" aria-label="Completed">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="checklist-complete-heading text-lg font-bold">Completed</h2>
                  <span className="checklist-complete-summary-badge rounded-lg px-3 py-1 text-xs font-semibold">
                    {completedGroups.length} groups · {completedItems.length} trips assigned
                  </span>
                </div>
                <div className="serene-data-reveal space-y-3">
                  {paginatedCompletedItems.map((item) => {
                    const assignment = confirmedDrivers[item.id];
                    if (!assignment) return null;
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
                  totalItems={completedGroups.length}
                  rangeStart={completedRangeStart}
                  rangeEnd={completedRangeEnd}
                  itemLabel="completed groups"
                  touchSafe
                  onPageChange={(nextPage) => setCompletedPage(Math.max(1, Math.min(completedTotalPages, nextPage)))}
                />
              </section>
            ) : null}
          </>
        )}
      </DataBoundary>
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
