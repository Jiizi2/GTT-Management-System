import { useState } from "react";
import type { AgreementApprovalStatus, GroupData, VisaTrackingRow, VisaFilterId } from "../shared/app-domain";
import { AgentFilterSelect } from "../components/agent-filter-select";
import { PaginationControls } from "../components/pagination-controls";
import { PageHeroSection } from "../components/page-hero-section";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { Button } from "../components/button";
import { SereneSelect } from "../components/serene-select";
import { useThemeMode } from "../theme/theme-provider";
import { useVisaTracking, desktopTableGridTemplate, getVisaRowGroupKey } from "./visa-tracking/hooks/use-visa-tracking";
import { VisaTrackingStats } from "./visa-tracking/components/VisaTrackingStats";
import { VisaTrackingRowGroup } from "./visa-tracking/components/VisaTrackingRowGroup";

export function VisaTrackingScreen({
  groups,
  onOpenDetail,
  onUpdateAgreementStatus,
  readOnly = false,
  fixedAgentName,
}: {
  groups: GroupData[];
  onOpenDetail: (row: VisaTrackingRow) => void;
  onUpdateAgreementStatus: (groupCode: string, city: "makkah" | "madinah", status: AgreementApprovalStatus) => void;
  readOnly?: boolean;
  fixedAgentName?: string;
}) {
  const { theme } = useThemeMode();
  const isDarkMode = theme === "dark";

  const [agentFilter, setAgentFilter] = useState("all");
  const scopedGroups = agentFilter === "all" ? groups : groups.filter((group) => group.agentId === agentFilter);
  const state = useVisaTracking({ groups: scopedGroups });

  const {
    query,
    setQuery,
    activeFilter,
    setActiveFilter,
    issuedMonthFilter,
    setIssuedMonthFilter,
    currentPage,
    setCurrentPage,
    expandedRowGroupKeys,
    visaRows,
    groupByCode,
    durationByGroupCode,
    filteredGroupedRows,
    issuedMonthOptions,
    notIssuedCount,
    missingHotelCount,
    unpaidCount,
    visaOnlyCount,
    visaPlusCount,
    issuedPaxCount,
    hasRowsForExport,
    actionRequiredCount,
    totalPages,
    paginatedRows,
    rangeStart,
    rangeEnd,
    handleExportPdf,
    toggleRowGroup,
  } = state;

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <header className="serene-page-toolbar">
        <div className="flex min-w-0 flex-1 max-w-xl items-center gap-3">
          <label className="serene-page-search" aria-label="Search groups">
            <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              className="serene-page-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search groups..."
            />
          </label>
        </div>

        <ThemeToggleButton className="sm:ml-auto sm:mr-5" />
      </header>

      <PageHeroSection
        eyebrow="Visa Control Board"
        title="Visa Tracking"
        description={
          <>
            <span className="sm:hidden">Monitor visa status, agreement, and payment.</span>
            <span className="hidden sm:inline">
              Monitor group agreement numbers, visa issuance, and payment progress in one board.
            </span>
          </>
        }
        className="backdrop-blur"
        actions={
          <Button
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            onClick={handleExportPdf}
            disabled={!hasRowsForExport}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              picture_as_pdf
            </span>
            <span className="sm:hidden">Export PDF</span>
            <span className="hidden sm:inline">Export to PDF</span>
          </Button>
        }
      />

      <section className="flex flex-wrap items-center gap-2" aria-label="Visa tracking filters">
        <div className="relative flex items-center bg-slate-100 dark:bg-surface-container-high/65 p-1 rounded-xl w-full sm:w-[720px] h-9">
          {/* Sliding background indicator */}
          <div
            className="absolute top-1 bottom-1 bg-white dark:bg-surface-container-lowest rounded-lg shadow-sm transition-all duration-200 ease-out"
            style={{
              width: "calc(16.666% - 5px)",
              left:
                activeFilter === "all"
                  ? "3px"
                  : activeFilter === "not-issued"
                    ? "calc(16.666% + 2px)"
                    : activeFilter === "missing-hotel"
                      ? "calc(33.333% + 2px)"
                      : activeFilter === "visa-only"
                        ? "calc(50% + 2px)"
                        : activeFilter === "visa-plus"
                          ? "calc(66.666% + 2px)"
                          : "calc(83.333% + 2px)",
            }}
          />
          {(["all", "not-issued", "missing-hotel", "visa-only", "visa-plus", "unpaid"] as VisaFilterId[]).map(
            (filter) => {
              const isActive = activeFilter === filter;
              let label = "";
              let count = 0;
              if (filter === "all") {
                label = "All Groups";
                count = visaRows.length;
              } else if (filter === "not-issued") {
                label = "Not Issued";
                count = notIssuedCount;
              } else if (filter === "missing-hotel") {
                label = "Missing Hotel";
                count = missingHotelCount;
              } else if (filter === "visa-only") {
                label = "Visa Only";
                count = visaOnlyCount;
              } else if (filter === "visa-plus") {
                label = "Visa+";
                count = visaPlusCount;
              } else {
                label = "Unpaid";
                count = unpaidCount;
              }
              return (
                <button
                  key={filter}
                  type="button"
                  className={`relative z-10 flex-1 h-full rounded-lg text-xs font-extrabold transition-colors duration-200 leading-none text-center ${
                    isActive
                      ? "text-brand-primary dark:text-primary"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                  onClick={() => setActiveFilter(filter)}
                >
                  <span className="sm:hidden">
                    {filter === "all"
                      ? "All"
                      : filter === "not-issued"
                        ? "Pending"
                        : filter === "missing-hotel"
                          ? "No Hotel"
                          : filter === "visa-only"
                            ? "Visa Only"
                            : filter === "visa-plus"
                              ? "Visa+"
                              : "Unpaid"}{" "}
                    ({count})
                  </span>
                  <span className="hidden sm:inline">
                    {label} ({count})
                  </span>
                </button>
              );
            },
          )}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
          {fixedAgentName ? (
            <div className="relative flex h-9 min-w-[10.5rem] flex-1 items-center rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 pr-9 text-sm font-bold text-on-surface-variant shadow-sm sm:flex-none">
              <span className="truncate">{fixedAgentName}</span>
              <span className="pointer-events-none absolute right-3 material-symbols-outlined text-base">business</span>
            </div>
          ) : (
            <AgentFilterSelect
              value={agentFilter}
              onChange={setAgentFilter}
              variant="pill"
              className="flex-1 sm:flex-none"
            />
          )}
          <div className="relative min-w-[10.5rem] flex-1 sm:min-w-[11rem] sm:flex-none">
            <SereneSelect
              className="serene-select-pill h-9 w-full pr-9"
              value={issuedMonthFilter}
              onChange={(event) => setIssuedMonthFilter(event.target.value)}
              showCaret={false}
              aria-label="Filter visa month"
            >
              <option value="all">All Months</option>
              {issuedMonthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SereneSelect>
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant"
              aria-hidden="true"
            >
              calendar_month
            </span>
          </div>
        </div>
      </section>

      <VisaTrackingStats
        isDarkMode={isDarkMode}
        actionRequiredCount={actionRequiredCount}
        visaRowsCount={visaRows.length}
        issuedPaxCount={issuedPaxCount}
        unpaidCount={unpaidCount}
      />

      {filteredGroupedRows.length === 0 ? (
        <article className="serene-empty-state">
          <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">
            search_off
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-800">No visa records found</h2>
          <p className="mt-2 text-sm text-slate-600">
            <span className="sm:hidden">Try another keyword or filter.</span>
            <span className="hidden sm:inline">Try another keyword or switch your filter to view more groups.</span>
          </p>
        </article>
      ) : (
        <>
          <section className="space-y-3 md:hidden" aria-label="Visa tracking cards">
            {paginatedRows.map((rowGroup) => {
              const rowGroupKey = getVisaRowGroupKey(rowGroup);
              return (
                <VisaTrackingRowGroup
                  key={rowGroupKey}
                  rowGroup={rowGroup}
                  view="mobile"
                  expanded={expandedRowGroupKeys.has(rowGroupKey)}
                  isDarkMode={isDarkMode}
                  groupByCode={groupByCode}
                  durationByGroupCode={durationByGroupCode}
                  onToggleExpand={toggleRowGroup}
                  onOpenDetail={onOpenDetail}
                  onUpdateAgreementStatus={onUpdateAgreementStatus}
                  readOnly={readOnly}
                />
              );
            })}
          </section>

          <section className="serene-table-shell hidden md:block" aria-label="Visa tracking table">
            <div className="overflow-x-auto">
              <div className="min-w-[960px]">
                <div
                  className="grid items-center gap-2.5 border-b border-slate-200 bg-surface-container-low px-5 py-3 text-xs font-semibold uppercase tracking-[0.11em] text-on-surface-variant/80"
                  style={{ gridTemplateColumns: desktopTableGridTemplate }}
                >
                  <div>Group Number</div>
                  <div>Group Name</div>
                  <div className="text-center">Total Pax</div>
                  <div>Makkah Agreement</div>
                  <div>Madinah Agreement</div>
                  <div className="text-center">Visa Status</div>
                  <div className="text-center">Visa Type</div>
                  <div className="text-center">Syarikah</div>
                  <div className="text-center">Actions</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {paginatedRows.map((rowGroup) => {
                    const rowGroupKey = getVisaRowGroupKey(rowGroup);
                    return (
                      <VisaTrackingRowGroup
                        key={rowGroupKey}
                        rowGroup={rowGroup}
                        view="desktop"
                        expanded={expandedRowGroupKeys.has(rowGroupKey)}
                        isDarkMode={isDarkMode}
                        groupByCode={groupByCode}
                        durationByGroupCode={durationByGroupCode}
                        onToggleExpand={toggleRowGroup}
                        onOpenDetail={onOpenDetail}
                        onUpdateAgreementStatus={onUpdateAgreementStatus}
                        readOnly={readOnly}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredGroupedRows.length}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="groups"
        onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
      />
    </div>
  );
}
