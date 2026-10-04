import type { ReactNode } from "react";
import { DatePickerInput } from "../../../components/date-time-pickers";
import { SereneSelect } from "../../../components/serene-select";
import type { AgreementDraftStatusFilter } from "../../../hooks/use-agreement-drafts-query";

type Props = {
  query: string;
  setQuery: (value: string) => void;
  statusFilter: AgreementDraftStatusFilter;
  setStatusFilter: (value: AgreementDraftStatusFilter) => void;
  agentFilterControl?: ReactNode;
  muassasahFilter: string;
  setMuassasahFilter: (value: string) => void;
  muassasahOptions: Array<{ id: string; name: string }>;
  muassasahQuery?: { isLoading: boolean; isError: boolean; refetch?: () => unknown };
  startDateFilter: string;
  setStartDateFilter: (value: string) => void;
  endDateFilter: string;
  setEndDateFilter: (value: string) => void;
  remainingPaxOnly: boolean;
  setRemainingPaxOnly: (value: boolean) => void;
  isDateRangeInvalid: boolean;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  idPrefix?: string;
};

export function AgreementInboxFilters({
  query,
  setQuery,
  statusFilter,
  setStatusFilter,
  agentFilterControl,
  muassasahFilter,
  setMuassasahFilter,
  muassasahOptions,
  muassasahQuery = { isLoading: false, isError: false },
  startDateFilter,
  setStartDateFilter,
  endDateFilter,
  setEndDateFilter,
  remainingPaxOnly,
  setRemainingPaxOnly,
  isDateRangeInvalid,
  hasActiveFilters,
  clearFilters,
  idPrefix = "filter",
}: Props) {
  return (
    <section
      className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-3 shadow-sm"
      aria-label="Agreement filters"
    >
      <div
        className={`grid gap-2.5 xl:items-center ${agentFilterControl ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(150px,.85fr)_minmax(135px,.65fr)_minmax(160px,.9fr)_minmax(145px,.75fr)_auto]" : "xl:grid-cols-[minmax(0,1.25fr)_minmax(150px,.85fr)_minmax(160px,.9fr)_minmax(145px,.75fr)_auto]"}`}
      >
        <label className="flex h-11 min-w-0 cursor-text items-center gap-2.5 rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 transition focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
          <span className="material-symbols-outlined text-xl text-on-surface-variant/70" aria-hidden="true">
            search
          </span>
          <span className="sr-only">Search agreement drafts</span>
          <input
            type="search"
            aria-label="Search agreement drafts"
            className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-on-surface outline-none"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agreement, hotel, group, or city..."
          />
        </label>
        <label className="relative">
          <span className="sr-only">Assignment status</span>
          <span
            className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-lg text-on-surface-variant"
            aria-hidden="true"
          >
            person
          </span>
          <SereneSelect
            className="serene-select h-11 w-full rounded-xl bg-surface-container-lowest pl-10 pr-8 text-sm font-semibold"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as AgreementDraftStatusFilter)}
            aria-label="Filter agreement assignment status"
          >
            <option value="unassigned">Unassigned</option>
            <option value="assigned">Assigned</option>
            <option value="all">All Agreements</option>
          </SereneSelect>
        </label>
        {agentFilterControl}
        <label className="relative">
          <span className="sr-only">Muassasah</span>
          <span
            className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-lg text-on-surface-variant"
            aria-hidden="true"
          >
            apartment
          </span>
          <SereneSelect
            className="serene-select h-11 w-full rounded-xl bg-surface-container-lowest pl-10 pr-8 text-sm font-semibold"
            value={muassasahFilter}
            onChange={(event) => setMuassasahFilter(event.target.value)}
            disabled={muassasahQuery.isLoading || muassasahQuery.isError}
            aria-label="Filter Muassasah"
          >
            <option value="all">All Muassasah</option>
            {muassasahOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
            <option value="none">Belum dipilih</option>
          </SereneSelect>
        </label>
        <details className="group relative">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-on-surface-variant" aria-hidden="true">
                calendar_month
              </span>
              <span>{startDateFilter || endDateFilter ? "Period selected" : "Stay Period"}</span>
            </span>
            <span
              className="material-symbols-outlined text-lg text-on-surface-variant transition-transform group-open:rotate-180"
              aria-hidden="true"
            >
              expand_more
            </span>
          </summary>
          <div className="z-20 mt-2 grid gap-3 rounded-xl border border-outline-variant/35 bg-surface-container-lowest p-3 shadow-float xl:absolute xl:right-0 xl:w-72">
            <label className="sr-only" htmlFor={`${idPrefix}-start-date`}>
              Start Date
            </label>
            <DatePickerInput
              id={`${idPrefix}-start-date`}
              inputClassName="serene-input serene-input-sm w-full"
              value={startDateFilter}
              onChange={setStartDateFilter}
              placeholder="Start Date"
            />
            <label className="sr-only" htmlFor={`${idPrefix}-end-date`}>
              End Date
            </label>
            <DatePickerInput
              id={`${idPrefix}-end-date`}
              inputClassName="serene-input serene-input-sm w-full"
              value={endDateFilter}
              onChange={setEndDateFilter}
              placeholder="End Date"
            />
            {isDateRangeInvalid ? (
              <p className="text-xs font-semibold text-rose-600">End Date tidak boleh sebelum Start Date.</p>
            ) : null}
            <button
              type="button"
              onClick={() => setRemainingPaxOnly(!remainingPaxOnly)}
              aria-pressed={remainingPaxOnly}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${remainingPaxOnly ? "border-brand-primary/30 bg-brand-primary/10 text-brand-primary" : "border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant hover:border-brand-primary/30 hover:text-brand-primary"}`}
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                {remainingPaxOnly ? "check_box" : "check_box_outline_blank"}
              </span>
              <span>Only agreements with remaining pax</span>
            </button>
          </div>
        </details>
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
          onClick={clearFilters}
          disabled={!hasActiveFilters}
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            restart_alt
          </span>
          <span>Clear all</span>
        </button>
      </div>
      {muassasahQuery.isError ? (
        <p className="mt-2 text-xs font-semibold text-rose-700" role="alert">
          Data Muassasah belum dapat dimuat.{" "}
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => void muassasahQuery.refetch?.()}
          >
            Coba lagi
          </button>
        </p>
      ) : null}
    </section>
  );
}
