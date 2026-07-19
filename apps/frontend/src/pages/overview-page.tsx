import { useEffect, useState } from "react";
import * as Domain from "../shared/app-domain";
import type { GroupData } from "../shared/app-domain";
import { PaginationControls } from "../components/pagination-controls";
import { GroupCard } from "../components/group-card";
import { Button } from "../components/button";
import { PageHeroSection } from "../components/page-hero-section";
import { SereneSelect } from "../components/serene-select";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { MetricCard } from "../components/metric-card";
import { AgentFilterSelect } from "../components/agent-filter-select";

const { OVERVIEW_PAGE_SIZE } = Domain;

export function OverviewScreen({
  query,
  filteredGroups,
  isActiveOnly,
  overviewMonthFilter,
  overviewMonthOptions,
  statCards,
  onQueryChange,
  onToggleActiveOnly,
  onOverviewMonthFilterChange,
  onOpenDetail,
  groups = [],
  fixedAgentName,
  showThemeToggle = true,
}: {
  query: string;
  filteredGroups: GroupData[];
  isActiveOnly: boolean;
  overviewMonthFilter: string;
  overviewMonthOptions: Array<{
    value: string;
    label: string;
  }>;
  statCards: Array<{
    label: string;
    value: string;
    subtitle?: string;
    icon: string;
    tone: "primary" | "secondary" | "tertiary";
  }>;
  onQueryChange: (value: string) => void;
  onToggleActiveOnly: (value: boolean) => void;
  onOverviewMonthFilterChange: (value: string) => void;
  onOpenDetail: (groupCode: string) => void;
  groups?: GroupData[];
  fixedAgentName?: string;
  showThemeToggle?: boolean;
}) {
  const hasQuery = query.trim().length > 0;
  const [currentPage, setCurrentPage] = useState(1);
  const [agentFilter, setAgentFilter] = useState("all");
  const agentFilteredGroups =
    agentFilter === "all" ? filteredGroups : filteredGroups.filter((group) => group.agentId === agentFilter);
  const selectedOverviewMonthLabel =
    overviewMonthOptions.find((option) => option.value === overviewMonthFilter)?.label ??
    (overviewMonthFilter === "all" ? "All Months" : overviewMonthFilter);
  const totalPages = Math.max(1, Math.ceil(agentFilteredGroups.length / OVERVIEW_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * OVERVIEW_PAGE_SIZE;
  const paginatedGroups = agentFilteredGroups.slice(pageStartIndex, pageStartIndex + OVERVIEW_PAGE_SIZE);
  const visibleRangeStart = agentFilteredGroups.length === 0 ? 0 : pageStartIndex + 1;
  const visibleRangeEnd =
    agentFilteredGroups.length === 0
      ? 0
      : Math.min(agentFilteredGroups.length, pageStartIndex + paginatedGroups.length);
  const hasGroupsForExport = agentFilteredGroups.length > 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [overviewMonthFilter, query, isActiveOnly, agentFilter]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  const handleExportReport = () => {
    const printableWindow = window.open("", "_blank", "width=1280,height=860");
    if (!printableWindow) {
      window.alert("Popup diblokir browser. Izinkan pop-up lalu coba Export Report lagi.");
      return;
    }

    void import("./overview-export")
      .then(({ exportOverviewReportPdf }) => {
        const exported = exportOverviewReportPdf(
          {
            groups: agentFilteredGroups,
            query,
            isActiveOnly,
            monthLabel: selectedOverviewMonthLabel,
          },
          {
            printWindow: printableWindow,
          },
        );

        if (!exported) {
          if (!printableWindow.closed) {
            printableWindow.close();
          }
          window.alert("Popup diblokir browser. Izinkan pop-up lalu coba Export Report lagi.");
        }
      })
      .catch(() => {
        if (!printableWindow.closed) {
          printableWindow.close();
        }
        window.alert("Gagal menyiapkan report export. Coba lagi.");
      });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <header className="serene-page-toolbar">
        <label className="serene-page-search sm:max-w-xl" aria-label="Search groups">
          <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
            search
          </span>
          <input
            type="text"
            className="serene-page-search-input"
            placeholder="Search groups..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        {showThemeToggle ? <ThemeToggleButton className="sm:ml-auto sm:mr-5" /> : null}
      </header>

      <PageHeroSection
        eyebrow="Operations Overview"
        title="Itinerary Overview"
        description={
          <>
            <span className="sm:hidden">Track your active Umrah groups in real-time.</span>
            <span className="hidden sm:inline">
              Manage your ongoing Umrah groups and track live itinerary status in real-time.
            </span>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_1fr]" aria-label="Weekly summary">
        <article className="serene-card flex min-h-[7rem] flex-col justify-between p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">
                quick_reference
              </span>
            </div>

            <h2 className="font-display text-xl font-extrabold leading-tight tracking-tight text-primary sm:text-2xl">
              Weekly Summary
            </h2>
          </div>

          <p className="mt-2 text-xs font-medium text-on-surface-variant">
            Generate and download weekly itinerary report.
          </p>

          <div className="mt-auto pt-3">
            <Button className="w-full" onClick={handleExportReport} disabled={!hasGroupsForExport}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                download
              </span>
              <span className="sm:hidden">Export</span>
              <span className="hidden sm:inline">Export Report</span>
            </Button>
          </div>
        </article>

        {statCards.map((card) => (
          <MetricCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            supportingText={card.subtitle}
            tone="primary"
          />
        ))}
      </section>

      <section className="serene-summary-strip" aria-label="Search results summary">
        <div className="flex items-end gap-2 text-sm text-on-surface-variant">
          <strong className="text-2xl font-bold leading-none text-on-surface">{agentFilteredGroups.length}</strong>
          <span className="sm:hidden">{agentFilteredGroups.length === 1 ? "group" : "groups"}</span>
          <span className="hidden sm:inline">
            {agentFilteredGroups.length === 1 ? "group displayed" : "groups displayed"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {fixedAgentName ? (
            <div className="relative flex h-9 min-w-[10.5rem] items-center rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 pr-9 text-sm font-bold text-on-surface-variant shadow-sm">
              <span className="truncate">{fixedAgentName}</span>
              <span
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base"
                aria-hidden="true"
              >
                business
              </span>
            </div>
          ) : (
            <AgentFilterSelect value={agentFilter} onChange={setAgentFilter} variant="pill" />
          )}
          <div
            className="inline-flex min-h-9 max-w-full overflow-hidden rounded-xl border border-outline-variant/45 bg-surface-container-lowest shadow-sm"
            aria-label="Overview filters"
          >
            <div className="relative min-w-[10.5rem]">
              <SereneSelect
                className="h-9 w-full border-none bg-transparent pl-3 pr-8 text-sm font-bold text-on-surface-variant outline-none"
                value={overviewMonthFilter}
                onChange={(event) => onOverviewMonthFilterChange(event.target.value)}
                showCaret={false}
                aria-label="Filter overview month"
              >
                {overviewMonthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SereneSelect>
              <span
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant"
                aria-hidden="true"
              >
                calendar_month
              </span>
            </div>

            <button
              type="button"
              className={`inline-flex min-h-9 items-center gap-1.5 border-l border-outline-variant/45 px-2.5 text-sm font-bold leading-none transition ${
                isActiveOnly
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high hover:text-primary"
              }`}
              onClick={() => onToggleActiveOnly(!isActiveOnly)}
              aria-pressed={isActiveOnly}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                filter_alt
              </span>
              <span>Active only</span>
            </button>
          </div>

          {hasQuery ? (
            <button
              type="button"
              className="text-sm font-semibold text-primary transition hover:text-primary/90"
              onClick={() => onQueryChange("")}
            >
              Clear search
            </button>
          ) : (
            <span className="text-xs font-medium text-on-surface-variant/80">
              <span className="sm:hidden">{isActiveOnly ? "Saudi only" : "All visible"}</span>
              <span className="hidden sm:inline">
                {isActiveOnly ? "Showing groups in Saudi only" : "All groups are visible"}
              </span>
            </span>
          )}
        </div>
      </section>

      <section
        className="grid grid-cols-1 gap-6 sm:gap-7 md:grid-cols-2 lg:grid-cols-3"
        style={{ columnGap: "1.5rem", rowGap: "1.5rem" }}
        aria-label="Group itinerary cards"
      >
        {agentFilteredGroups.length > 0 ? (
          paginatedGroups.map((group) => (
            <GroupCard key={group.code} group={group} groups={groups} onOpenDetail={onOpenDetail} />
          ))
        ) : (
          <article className="serene-empty-state col-span-full">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/60" aria-hidden="true">
              search_off
            </span>
            <h2 className="mt-3 text-xl font-bold text-on-surface">No groups found</h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Try another keyword such as a group code, package name, or current status.
            </p>
          </article>
        )}
      </section>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={agentFilteredGroups.length}
        rangeStart={visibleRangeStart}
        rangeEnd={visibleRangeEnd}
        itemLabel="groups"
        onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
      />
    </div>
  );
}
