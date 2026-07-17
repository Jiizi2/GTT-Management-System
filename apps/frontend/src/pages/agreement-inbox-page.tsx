import { useState } from "react";
import { DatePickerInput } from "../components/date-time-pickers";
import { PaginationControls } from "../components/pagination-controls";
import { Button } from "../components/button";
import { useAgreementInbox, AGREEMENT_DRAFT_PAGE_SIZE } from "./agreement-inbox/hooks/use-agreement-inbox";
import { AgreementDraftFields } from "./agreement-inbox/components/AgreementDraftFields";
import { AgreementDraftCard } from "./agreement-inbox/components/AgreementDraftCard";
import { AgreementDraftEditModal, DeleteAgreementDraftModal } from "./agreement-inbox/components/AgreementInboxModals";
import type { AgreementDraftStatusFilter } from "../hooks/use-agreement-drafts-query";
import { AgentFilterSelect } from "../components/agent-filter-select";

export function AgreementInboxScreen() {
  const state = useAgreementInbox();

  const {
    linkedGroupCode,
    query,
    setQuery,
    statusFilter,
    agentFilter,
    setAgentFilter,
    setStatusFilter,
    startDateFilter,
    setStartDateFilter,
    endDateFilter,
    setEndDateFilter,
    currentPage,
    setCurrentPage,
    isDraftComposerOpen,
    setIsDraftComposerOpen,
    editingDraft,
    deleteDraftTarget,
    setDeleteDraftTarget,
    assignmentGroupCodes,
    feedback,
    hasDatesSelected,
    isDateRangeInvalid,
    draftsQuery,
    drafts,
    filteredDrafts,
    totalPages,
    paginatedDrafts,
    rangeStart,
    rangeEnd,
    isSaving,
    onSubmit,
    startEditDraft,
    closeEditDraftModal,
    updateDraft,
    requestDeleteDraft,
    updateAssignmentGroupCode,
    assignDraftToGroup,
    deleteDraft,
    unassignDraftFromGroup,
    deleteDraftMutationPending,
    assignDraftMutationPending,
    unassignDraftMutationPending,
    form,
  } = state;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 py-5 sm:py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-primary">Hotel Agreement</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Agreement Inbox</h1>
        </div>

        <div className="flex w-full gap-2 sm:max-w-sm"><label
          className="serene-page-search w-full cursor-text border border-transparent transition focus-within:border-brand-primary/25 focus-within:ring-2 focus-within:ring-brand-primary/15 sm:max-w-sm"
          aria-label="Search agreement drafts"
        >
          <span className="material-symbols-outlined text-slate-400" aria-hidden="true">
            search
          </span>
          <input
            type="search"
            className="serene-page-search-input h-full"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agreement..."
          />
        </label></div>
      </header>

      {feedback ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
            feedback.tone === "success"
              ? "border border-brand-primary/25 bg-brand-primary/12 text-brand-primary"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}
          role="status"
          aria-live="polite"
        >
          {feedback.message}
        </div>
      ) : null}

      {linkedGroupCode ? (
        <section className="rounded-2xl border border-brand-primary/25 bg-brand-primary/12 px-4 py-3 text-brand-primary">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                link
              </span>
              <p className="text-sm font-bold">Target group: {linkedGroupCode}</p>
            </div>
            <span className="inline-flex w-fit rounded-lg bg-surface-container-lowest px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em]">
              Prefilled
            </span>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-surface-container-lowest px-3 py-2.5 shadow-sm sm:px-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900">New Draft Agreement</h2>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="inline-flex items-center gap-1.5"
            onClick={() => setIsDraftComposerOpen((isOpen) => !isOpen)}
            aria-expanded={isDraftComposerOpen}
            aria-controls="agreement-draft-composer"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {isDraftComposerOpen ? "close" : "add"}
            </span>
            <span>{isDraftComposerOpen ? "Close" : "Create Draft"}</span>
          </Button>
        </div>

        {isDraftComposerOpen ? (
          <form
            id="agreement-draft-composer"
            className="mt-4 space-y-4 border-t border-slate-200 pt-4"
            onSubmit={onSubmit}
          >
            <AgreementDraftFields
              control={form.control}
              register={form.register}
              errors={form.formState.errors}
              idPrefix="agreement-draft"
            />

            <div className="flex justify-end">
              <Button
                variant="primary"
                type="submit"
                className="inline-flex items-center gap-1.5"
                disabled={isSaving}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  save
                </span>
                <span>{isSaving ? "Saving..." : "Save Draft"}</span>
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[auto_minmax(11rem,0.7fr)_auto] md:items-end md:justify-between">
          {/* Status Segmented Control */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</span>
            <div className="relative flex items-center bg-slate-100 dark:bg-surface-container-high/65 p-1 rounded-xl w-[278px] h-9">
              {/* Sliding background indicator */}
              <div
                className="absolute top-1 bottom-1 left-1 bg-white dark:bg-surface-container-lowest rounded-lg shadow-sm transition-transform duration-200 ease-out"
                style={{
                  width: "88px",
                  transform: `translateX(${
                    statusFilter === "unassigned"
                      ? "0px"
                      : statusFilter === "assigned"
                      ? "90px"
                      : "180px"
                  })`,
                }}
              />
              {(["unassigned", "assigned", "all"] as AgreementDraftStatusFilter[]).map((filter) => {
                const isActive = statusFilter === filter;
                const label = filter === "all" ? "All" : filter === "assigned" ? "Assigned" : "Unassigned";
                return (
                  <button
                    key={filter}
                    type="button"
                    className={`relative z-10 w-[90px] h-full rounded-lg text-xs font-extrabold transition-colors duration-200 leading-none text-center ${
                      isActive
                        ? "text-brand-primary dark:text-primary"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                    onClick={() => setStatusFilter(filter)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <AgentFilterSelect value={agentFilter} onChange={setAgentFilter} variant="field" />

          {/* Stay Period Filter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stay Period</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DatePickerInput
                id="filter-start-date"
                inputClassName="serene-input serene-input-sm w-36"
                value={startDateFilter}
                onChange={setStartDateFilter}
                placeholder="Start Date"
              />
              <span className="text-slate-400 font-bold text-xs">➔</span>
              <DatePickerInput
                id="filter-end-date"
                inputClassName="serene-input serene-input-sm w-36"
                value={endDateFilter}
                onChange={setEndDateFilter}
                placeholder="End Date"
              />
              {(startDateFilter || endDateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDateFilter("");
                    setEndDateFilter("");
                  }}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-rose-600 transition shadow-sm border border-slate-200"
                  title="Clear stay period"
                  aria-label="Clear stay period"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    close
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {isDateRangeInvalid && (
          <div className="mt-3 text-xs font-semibold text-rose-600 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              error
            </span>
            <span>End Date tidak boleh sebelum Start Date</span>
          </div>
        )}
      </section>

      <section className={`space-y-2 transition-opacity duration-200 ${draftsQuery.isFetching ? "opacity-60" : ""}`}>
        {draftsQuery.isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-surface-container-lowest px-4 py-6 text-sm font-semibold text-slate-600">
            Loading agreement drafts...
          </div>
        ) : null}

        {!draftsQuery.isLoading && filteredDrafts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-surface-container-lowest px-4 py-8 text-center">
            <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">
              inventory_2
            </span>
            <h2 className="mt-2 text-lg font-bold text-slate-900">No agreement drafts found</h2>
          </div>
        ) : null}

        {paginatedDrafts.map((draft) => (
          <AgreementDraftCard
            key={draft.id}
            draft={draft}
            linkedGroupCode={linkedGroupCode}
            assignmentGroupCode={assignmentGroupCodes[draft.id] ?? linkedGroupCode}
            hasDatesSelected={hasDatesSelected}
            isDateRangeInvalid={isDateRangeInvalid}
            startDateFilter={startDateFilter}
            endDateFilter={endDateFilter}
            deleteDraftMutationPending={deleteDraftMutationPending}
            assignDraftMutationPending={assignDraftMutationPending}
            unassignDraftMutationPending={unassignDraftMutationPending}
            onStartEdit={startEditDraft}
            onDeleteRequest={requestDeleteDraft}
            onAssignmentGroupCodeChange={updateAssignmentGroupCode}
            onAssignToGroup={assignDraftToGroup}
            onUnassignFromGroup={unassignDraftFromGroup}
          />
        ))}
      </section>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={drafts.length}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="agreement drafts"
        onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
      />

      {editingDraft ? (
        <AgreementDraftEditModal
          key={editingDraft.id}
          draft={editingDraft}
          isSaving={isSaving}
          onClose={closeEditDraftModal}
          onSave={(values) => void updateDraft(editingDraft, values)}
        />
      ) : null}

      {deleteDraftTarget ? (
        <DeleteAgreementDraftModal
          draft={deleteDraftTarget}
          isDeleting={deleteDraftMutationPending}
          onClose={() => setDeleteDraftTarget(null)}
          onConfirm={() => void deleteDraft(deleteDraftTarget)}
        />
      ) : null}
    </div>
  );
}
