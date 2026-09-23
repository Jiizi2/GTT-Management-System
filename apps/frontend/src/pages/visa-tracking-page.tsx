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
  showThemeToggle = true,
}: {
  groups: GroupData[];
  onOpenDetail: (row: VisaTrackingRow) => void;
  onUpdateAgreementStatus: (groupCode: string, city: "makkah" | "madinah", status: AgreementApprovalStatus) => void;
  readOnly?: boolean;
  fixedAgentName?: string;
  showThemeToggle?: boolean;
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
    issuedStatsMonth,
    setIssuedStatsMonth,
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
    issuedStatistics,
    selectedIssuedMonthLabel,
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

        {showThemeToggle ? <ThemeToggleButton className="sm:ml-auto sm:mr-5" /> : null}
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

      <VisaTrackingStats
        actionRequiredCount={actionRequiredCount}
        visaRowsCount={visaRows.length}
        issuedStatistics={issuedStatistics}
        selectedMonthLabel={selectedIssuedMonthLabel}
        unpaidCount={unpaidCount}
      />

      <section
        className="visa-filter-bar"
        aria-label="Visa tracking filters"
      >
        <div className="visa-filter-field">
          <span className="material-symbols-outlined visa-filter-icon" aria-hidden="true">filter_alt</span>
          <SereneSelect
            className="visa-filter-control"
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as VisaFilterId)}
            aria-label="Filter visa record view"
          >
            <option value="all">All Groups ({visaRows.length})</option>
            <option value="not-issued">Not Issued ({notIssuedCount})</option>
            <option value="missing-hotel">Missing Hotel ({missingHotelCount})</option>
            <option value="visa-only">Visa Only ({visaOnlyCount})</option>
            <option value="visa-plus">Visa+ ({visaPlusCount})</option>
            <option value="unpaid">Unpaid ({unpaidCount})</option>
          </SereneSelect>
        </div>

        {fixedAgentName ? (
          <div className="visa-filter-field visa-filter-fixed">
            <span className="material-symbols-outlined visa-filter-icon" aria-hidden="true">business</span>
            <span className="truncate">{fixedAgentName}</span>
          </div>
        ) : (
          <AgentFilterSelect
            value={agentFilter}
            onChange={setAgentFilter}
            variant="inline"
            className="visa-filter-field"
            leadingIcon="business"
          />
        )}

        <div className="visa-filter-field">
          <span className="material-symbols-outlined visa-filter-icon" aria-hidden="true">calendar_month</span>
          <SereneSelect
            className="visa-filter-control"
            value={issuedStatsMonth}
            onChange={(event) => setIssuedStatsMonth(event.target.value)}
            aria-label="Pilih bulan statistik visa issued"
          >
            {issuedMonthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                Issued · {option.label}
              </option>
            ))}
          </SereneSelect>
        </div>

      </section>

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
              <div className="min-w-[980px]">
                <div
                  className="visa-compact-header"
                  style={{ gridTemplateColumns: desktopTableGridTemplate }}
                >
                  <div>Group number / Name</div>
                  <div>Pax</div>
                  <div>Visa status</div>
                  <div>Makkah agreement</div>
                  <div>Madinah agreement</div>
                  <div>Visa type</div>
                  <div>Syarikah</div>
                  <div>Action</div>
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
