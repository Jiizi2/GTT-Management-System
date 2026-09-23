import { DatePickerInput } from "../components/date-time-pickers";
import { Button } from "../components/button";
import { useAgreementInbox } from "./agreement-inbox/hooks/use-agreement-inbox";
import { AgreementDraftFields } from "./agreement-inbox/components/AgreementDraftFields";
import { AgreementDraftTable } from "./agreement-inbox/components/AgreementDraftTable";
import { AgreementDraftEditModal, DeleteAgreementDraftModal } from "./agreement-inbox/components/AgreementInboxModals";
import type { AgreementDraftStatusFilter } from "../hooks/use-agreement-drafts-query";
import { AgentFilterSelect } from "../components/agent-filter-select";
import { SereneSelect } from "../components/serene-select";
import { PaginationControls } from "../components/pagination-controls";
import { AgreementTextImport } from "./agreement-inbox/components/AgreementTextImport";
import { PageHeroSection } from "../components/page-hero-section";

export function AgreementInboxScreen() {
  const state = useAgreementInbox();
  const {
    linkedGroupCode, query, setQuery, statusFilter, agentFilter, setAgentFilter, setStatusFilter,
    startDateFilter, setStartDateFilter, endDateFilter, setEndDateFilter, remainingPaxOnly,
    setRemainingPaxOnly, currentPage, setCurrentPage, isDraftComposerOpen, setIsDraftComposerOpen,
    editingDraft, deleteDraftTarget, setDeleteDraftTarget, assignmentGroupCodes, feedback,
    isDateRangeInvalid, draftsQuery, filteredDrafts, totalPages, paginatedDrafts, rangeStart, rangeEnd,
    isSaving, onSubmit, startEditDraft, closeEditDraftModal, updateDraft, updateDraftStatus,
    requestDeleteDraft, updateAssignmentGroupCode, assignDraftToGroup, unassignDraftFromGroup,
    deleteDraft, deleteDraftMutationPending, assignDraftMutationPending, unassignDraftMutationPending,
    createDraftInline, form,
  } = state;

  const hasActiveFilters = query.trim().length > 0 || statusFilter !== "unassigned" || agentFilter !== "all" ||
    Boolean(startDateFilter || endDateFilter) || remainingPaxOnly;

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("unassigned");
    setAgentFilter("all");
    setStartDateFilter("");
    setEndDateFilter("");
    setRemainingPaxOnly(false);
  };

  return (
    <div className="agreement-inbox-screen mx-auto flex max-w-screen-2xl flex-col gap-5 py-4 sm:py-5">
      <PageHeroSection
        eyebrow="Hotel Agreements"
        title="Agreement Inbox"
        description="Review, assign, and track hotel agreements for all groups and agents."
        actions={
          <Button
            variant="primary"
            size="sm"
            className="shrink-0"
            onClick={() => setIsDraftComposerOpen((isOpen) => !isOpen)}
            aria-expanded={isDraftComposerOpen}
            aria-controls="agreement-draft-composer"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {isDraftComposerOpen ? "close" : "add"}
            </span>
            <span>{isDraftComposerOpen ? "Close Draft" : "New Draft"}</span>
          </Button>
        }
      />

      {feedback ? (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${feedback.tone === "success" ? "border border-brand-primary/25 bg-brand-primary/10 text-brand-primary" : "border border-rose-200 bg-rose-50 text-rose-700"}`} role="status" aria-live="polite">
          {feedback.message}
        </div>
      ) : null}

      {linkedGroupCode ? (
        <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-primary/25 bg-brand-primary/10 px-4 py-3 text-brand-primary">
          <div className="flex min-w-0 items-center gap-2"><span className="material-symbols-outlined text-base" aria-hidden="true">link</span><p className="text-sm font-bold">Target group: {linkedGroupCode}</p></div>
          <span className="rounded-md bg-surface-container-lowest px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em]">Prefilled</span>
        </section>
      ) : null}

      {isDraftComposerOpen ? (
        <section id="agreement-draft-composer" className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
          <div className="mb-5"><h2 className="text-lg font-extrabold text-on-surface">New Agreement Draft</h2><p className="mt-1 text-sm text-on-surface-variant">Paste the usual message, then complete only the missing data.</p></div>
          <AgreementTextImport isSaving={isSaving} onSaveDraft={createDraftInline} onComplete={() => setIsDraftComposerOpen(false)} />
          <details className="group mt-5 border-t border-outline-variant/25 pt-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 text-sm font-bold text-on-surface transition hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 [&::-webkit-details-marker]:hidden">
              <span>Or fill the form manually</span>
              <span className="material-symbols-outlined text-xl text-on-surface-variant transition-transform group-open:rotate-180" aria-hidden="true">expand_more</span>
            </summary>
            <form className="mt-4 space-y-5" onSubmit={onSubmit}>
              <AgreementDraftFields control={form.control} register={form.register} errors={form.formState.errors} idPrefix="agreement-draft" />
              <div className="flex flex-col-reverse gap-2 border-t border-outline-variant/25 pt-4 sm:flex-row sm:justify-end">
                <Button variant="secondary" type="button" onClick={() => setIsDraftComposerOpen(false)} disabled={isSaving}>Cancel</Button>
                <Button variant="primary" type="submit" className="inline-flex items-center gap-1.5" disabled={isSaving}><span className="material-symbols-outlined text-base" aria-hidden="true">save</span><span>{isSaving ? "Saving..." : "Save Draft"}</span></Button>
              </div>
            </form>
          </details>
        </section>
      ) : null}

      <section className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest p-3 shadow-sm" aria-label="Agreement filters">
        <div className="grid gap-2.5 xl:grid-cols-[minmax(300px,1.5fr)_minmax(150px,.7fr)_minmax(165px,.72fr)_minmax(180px,.8fr)_auto] xl:items-center">
          <label className="flex h-11 min-w-0 cursor-text items-center gap-2.5 rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 transition focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
            <span className="material-symbols-outlined text-xl text-on-surface-variant/70" aria-hidden="true">search</span><span className="sr-only">Search agreement drafts</span>
            <input type="search" className="min-w-0 flex-1 border-0 bg-transparent text-sm font-medium text-on-surface outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search agreement, hotel, group, or city..." />
          </label>
          <label className="relative">
            <span className="sr-only">Assignment status</span><span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-lg text-on-surface-variant" aria-hidden="true">person</span>
            <SereneSelect className="serene-select h-11 w-full rounded-xl bg-surface-container-lowest pl-10 pr-8 text-sm font-semibold" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as AgreementDraftStatusFilter)} aria-label="Filter agreement assignment status">
              <option value="unassigned">Unassigned</option><option value="assigned">Assigned</option><option value="all">All Agreements</option>
            </SereneSelect>
          </label>
          <div className="flex h-11 items-center rounded-xl border border-outline-variant/45 bg-surface-container-lowest">
            <AgentFilterSelect value={agentFilter} onChange={setAgentFilter} variant="inline" leadingIcon="groups" menuMaxHeight={264} className="w-full" />
          </div>
          <details className="group relative">
            <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg text-on-surface-variant" aria-hidden="true">calendar_month</span><span>{startDateFilter || endDateFilter ? "Period selected" : "Stay Period"}</span></span>
              <span className="material-symbols-outlined text-lg text-on-surface-variant transition-transform group-open:rotate-180" aria-hidden="true">expand_more</span>
            </summary>
            <div className="z-20 mt-2 grid gap-3 rounded-xl border border-outline-variant/35 bg-surface-container-lowest p-3 shadow-float xl:absolute xl:right-0 xl:w-72">
              <DatePickerInput id="filter-start-date" inputClassName="serene-input serene-input-sm w-full" value={startDateFilter} onChange={setStartDateFilter} placeholder="Start Date" />
              <DatePickerInput id="filter-end-date" inputClassName="serene-input serene-input-sm w-full" value={endDateFilter} onChange={setEndDateFilter} placeholder="End Date" />
              {isDateRangeInvalid ? <p className="text-xs font-semibold text-rose-600">End Date tidak boleh sebelum Start Date.</p> : null}
              <button type="button" onClick={() => setRemainingPaxOnly((value) => !value)} aria-pressed={remainingPaxOnly} className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${remainingPaxOnly ? "border-brand-primary/30 bg-brand-primary/10 text-brand-primary" : "border-outline-variant/45 bg-surface-container-lowest text-on-surface-variant hover:border-brand-primary/30 hover:text-brand-primary"}`}>
                <span className="material-symbols-outlined text-lg" aria-hidden="true">{remainingPaxOnly ? "check_box" : "check_box_outline_blank"}</span><span>Only agreements with remaining pax</span>
              </button>
            </div>
          </details>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40" onClick={clearFilters} disabled={!hasActiveFilters}>
            <span className="material-symbols-outlined text-lg" aria-hidden="true">restart_alt</span><span>Clear all</span>
          </button>
        </div>
      </section>

      <section className={`mt-2 rounded-2xl transition-opacity duration-200 lg:border lg:border-outline-variant/35 lg:bg-surface-container-lowest lg:shadow-sm ${draftsQuery.isFetching ? "opacity-60" : ""}`}>
        {draftsQuery.isLoading ? <div className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest px-4 py-10 text-sm font-semibold text-on-surface-variant shadow-sm lg:rounded-none lg:border-0 lg:shadow-none">Loading agreement drafts...</div> : (
          <AgreementDraftTable drafts={paginatedDrafts} linkedGroupCode={linkedGroupCode} assignmentGroupCodes={assignmentGroupCodes} onAssignmentGroupCodeChange={updateAssignmentGroupCode} onAssignToGroup={(draft) => void assignDraftToGroup(draft)} onUnassignFromGroup={(draft, groupCode) => void unassignDraftFromGroup(draft, groupCode)} onStartEdit={startEditDraft} onDeleteRequest={requestDeleteDraft} onStatusChange={(draft, next) => void updateDraftStatus(draft, next)} statusChangePending={isSaving} deleteDraftMutationPending={deleteDraftMutationPending} assignDraftMutationPending={assignDraftMutationPending} unassignDraftMutationPending={unassignDraftMutationPending} />
        )}
      </section>

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredDrafts.length}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="agreements"
        onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
      />

      {editingDraft ? <AgreementDraftEditModal key={editingDraft.id} draft={editingDraft} isSaving={isSaving} onClose={closeEditDraftModal} onSave={(values) => void updateDraft(editingDraft, values)} /> : null}
      {deleteDraftTarget ? <DeleteAgreementDraftModal draft={deleteDraftTarget} isDeleting={deleteDraftMutationPending} onClose={() => setDeleteDraftTarget(null)} onConfirm={() => void deleteDraft(deleteDraftTarget)} /> : null}
    </div>
  );
}
