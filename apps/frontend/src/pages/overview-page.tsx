import { useEffect, useState } from "react";
import * as Domain from "../shared/app-domain";
import type { GroupData } from "../shared/app-domain";
import { PaginationControls } from "../components/pagination-controls";
import { GroupCard } from "../components/group-card";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { exportOverviewReportPdf } from "./overview-export";

const { OVERVIEW_PAGE_SIZE } = Domain;

function getStatToneClasses(tone: "primary" | "secondary" | "tertiary"): string {
  if (tone === "primary") {
    return "bg-primary text-white shadow-ambient";
  }

  if (tone === "secondary") {
    return "bg-secondary text-white shadow-ambient";
  }

  return "bg-tertiary text-white shadow-ambient";
}

export function OverviewScreen({
  query,
  filteredGroups,
  isActiveOnly,
  statCards,
  summaryMessage,
  onQueryChange,
  onToggleActiveOnly,
  onOpenDetail,
}: {
  query: string;
  filteredGroups: GroupData[];
  isActiveOnly: boolean;
  statCards: Array<{
    label: string;
    value: string;
    subtitle?: string;
    icon: string;
    tone: "primary" | "secondary" | "tertiary";
  }>;
  summaryMessage: string;
  onQueryChange: (value: string) => void;
  onToggleActiveOnly: (value: boolean) => void;
  onOpenDetail: (groupCode: string) => void;
}) {
  const hasQuery = query.trim().length > 0;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / OVERVIEW_PAGE_SIZE));
  const pageStartIndex = (currentPage - 1) * OVERVIEW_PAGE_SIZE;
  const paginatedGroups = filteredGroups.slice(pageStartIndex, pageStartIndex + OVERVIEW_PAGE_SIZE);
  const visibleRangeStart = filteredGroups.length === 0 ? 0 : pageStartIndex + 1;
  const visibleRangeEnd =
    filteredGroups.length === 0 ? 0 : Math.min(filteredGroups.length, pageStartIndex + paginatedGroups.length);
  const hasGroupsForExport = filteredGroups.length > 0;

  useEffect(() => {
    setCurrentPage(1);
  }, [query, isActiveOnly]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <header className="flex items-center gap-3">
        <label
          className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface-container-lowest px-4 shadow-ambient sm:h-14 sm:max-w-xl"
          aria-label="Search groups"
        >
          <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
            search
          </span>
          <input
            type="text"
            className="w-full border-none bg-transparent text-sm font-medium text-on-surface-variant outline-none placeholder:text-on-surface-variant/50"
            placeholder="Search groups..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>

        <ThemeToggleButton className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-lowest hover:text-primary" />
      </header>

      <section className="space-y-2 pt-2">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-on-surface sm:text-4xl lg:text-5xl">
            Itinerary Overview
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant sm:text-base lg:text-lg">
            <span className="sm:hidden">Track your active Umrah groups in real-time.</span>
            <span className="hidden sm:inline">
              Manage your ongoing Umrah groups and track live itinerary status in real-time.
            </span>
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-[0.95fr_1fr_1fr_1fr]" aria-label="Weekly summary">
        <article className="flex min-h-[11rem] flex-col rounded-2xl bg-surface-container-low p-4 shadow-ambient sm:min-h-[12.25rem] sm:p-6">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">
                quick_reference
              </span>
            </div>

            <h2 className="font-display text-2xl font-extrabold leading-[1.05] tracking-tight text-primary sm:text-4xl">
              Weekly
              <br />
              Summary
            </h2>
          </div>

          <button
            type="button"
            className={`mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              hasGroupsForExport
                ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                : "cursor-not-allowed bg-surface-container-high/70 text-on-surface-variant/70"
            }`}
            onClick={() => {
              const exported = exportOverviewReportPdf({
                groups: filteredGroups,
                query,
                isActiveOnly,
                summaryMessage,
              });
              if (!exported) {
                window.alert("Popup diblokir browser. Izinkan pop-up lalu coba Export Report lagi.");
              }
            }}
            disabled={!hasGroupsForExport}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              download
            </span>
            <span className="sm:hidden">Export</span>
            <span className="hidden sm:inline">Export Report</span>
          </button>
        </article>

        {statCards.map((card) => (
          <article
            key={card.label}
            className={`relative min-h-[11rem] overflow-hidden rounded-2xl p-4 sm:min-h-[12.25rem] sm:p-6 ${getStatToneClasses(
              card.tone,
            )}`}
          >
            <span className="block text-xs font-bold uppercase tracking-[0.14em] opacity-80">{card.label}</span>
            <strong className="mt-4 block text-4xl font-extrabold leading-none tracking-tight sm:text-5xl">{card.value}</strong>
            {card.subtitle ? (
              <span className="mt-3 hidden text-xs font-semibold tracking-wide opacity-80 sm:block sm:text-sm">
                {card.subtitle}
              </span>
            ) : null}

            <span
              className="material-symbols-outlined absolute -bottom-1 right-2 text-6xl opacity-20 sm:text-7xl"
              aria-hidden="true"
            >
              {card.icon}
            </span>
          </article>
        ))}
      </section>

      <section
        className="flex flex-col gap-3 rounded-2xl bg-surface-container-low p-4 shadow-ambient sm:flex-row sm:items-center sm:justify-between"
        aria-label="Search results summary"
      >
        <div className="flex items-end gap-2 text-sm text-on-surface-variant">
          <strong className="text-2xl font-bold leading-none text-on-surface">{filteredGroups.length}</strong>
          <span className="sm:hidden">{filteredGroups.length === 1 ? "group" : "groups"}</span>
          <span className="hidden sm:inline">{filteredGroups.length === 1 ? "group displayed" : "groups displayed"}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold leading-none transition ${
                isActiveOnly
                  ? "bg-primary text-white shadow-cta-soft"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest hover:text-primary"
              }`}
            onClick={() => onToggleActiveOnly(!isActiveOnly)}
            aria-pressed={isActiveOnly}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              filter_alt
            </span>
            <span>Active only</span>
          </button>

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
              <span className="hidden sm:inline">{isActiveOnly ? "Showing groups in Saudi only" : "All groups are visible"}</span>
            </span>
          )}
        </div>
      </section>

      <section
        className="grid grid-cols-1 gap-6 sm:gap-7 md:grid-cols-2 lg:grid-cols-3"
        style={{ columnGap: "1.5rem", rowGap: "1.5rem" }}
        aria-label="Group itinerary cards"
      >
        {filteredGroups.length > 0 ? (
          paginatedGroups.map((group) => <GroupCard key={group.code} group={group} onOpenDetail={onOpenDetail} />)
        ) : (
          <article className="col-span-full rounded-2xl bg-surface-container-low p-10 text-center">
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
        totalItems={filteredGroups.length}
        rangeStart={visibleRangeStart}
        rangeEnd={visibleRangeEnd}
        itemLabel="groups"
        onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
      />
    </div>
  );
}

