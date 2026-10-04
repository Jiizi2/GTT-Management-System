import { Button } from "../components/button";
import { useAgreementInbox } from "./agreement-inbox/hooks/use-agreement-inbox";
import { AgreementInboxFilters } from "./agreement-inbox/components/AgreementInboxFilters";
import { AgreementDraftTable } from "./agreement-inbox/components/AgreementDraftTable";
import {
  AgreementDraftComposerModal,
  AgreementDraftEditModal,
  DeleteAgreementDraftModal,
} from "./agreement-inbox/components/AgreementInboxModals";
import { AgentFilterSelect } from "../components/agent-filter-select";
import { PaginationControls } from "../components/pagination-controls";
import { PageHeroSection } from "../components/page-hero-section";

export function AgreementInboxScreen() {
  const state = useAgreementInbox();
  const {
    linkedGroupCode, query, setQuery, statusFilter, agentFilter, setAgentFilter, setStatusFilter,
    startDateFilter, setStartDateFilter, endDateFilter, setEndDateFilter, remainingPaxOnly,
    setRemainingPaxOnly, currentPage, setCurrentPage, isDraftComposerOpen, setIsDraftComposerOpen,
    editingDraft, deleteDraftTarget, setDeleteDraftTarget, assignmentGroupCodes, feedback, setFeedback,
    isDateRangeInvalid, draftsQuery, filteredDrafts, totalPages, paginatedDrafts, rangeStart, rangeEnd,
    isSaving, onSubmit, startEditDraft, closeEditDraftModal, updateDraft, updateDraftStatus,
    requestDeleteDraft, updateAssignmentGroupCode, assignDraftToGroup, unassignDraftFromGroup,
    deleteDraft, deleteDraftMutationPending, assignDraftMutationPending, unassignDraftMutationPending,
    createDraftInline, form,
    muassasahFilter, setMuassasahFilter, muassasahOptions, muassasahQuery,
  } = state;

  const hasActiveFilters = query.trim().length > 0 || statusFilter !== "unassigned" || agentFilter !== "all" || muassasahFilter !== "all" ||
    Boolean(startDateFilter || endDateFilter) || remainingPaxOnly;

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("unassigned");
    setAgentFilter("all");
    setMuassasahFilter("all");
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
            size="lg"
            className="min-h-[52px] shrink-0"
            onClick={() => {
              setFeedback(null);
              setIsDraftComposerOpen(true);
            }}
            aria-haspopup="dialog"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              add
            </span>
            <span>New Draft</span>
          </Button>
        }
      />

      {feedback && !isDraftComposerOpen ? (
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
        <AgreementDraftComposerModal
          isSaving={isSaving}
          form={form}
          errorMessage={feedback?.tone === "error" ? feedback.message : undefined}
          onClose={() => setIsDraftComposerOpen(false)}
          onSubmit={onSubmit}
          onSaveDraft={createDraftInline}
        />
      ) : null}

      <AgreementInboxFilters
        query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        agentFilterControl={<div className="flex h-11 items-center rounded-xl border border-outline-variant/45 bg-surface-container-lowest"><AgentFilterSelect value={agentFilter} onChange={setAgentFilter} variant="inline" leadingIcon="groups" menuMaxHeight={264} className="w-full" /></div>}
        muassasahFilter={muassasahFilter} setMuassasahFilter={setMuassasahFilter}
        muassasahOptions={muassasahOptions} muassasahQuery={muassasahQuery}
        startDateFilter={startDateFilter} setStartDateFilter={setStartDateFilter}
        endDateFilter={endDateFilter} setEndDateFilter={setEndDateFilter}
        remainingPaxOnly={remainingPaxOnly} setRemainingPaxOnly={setRemainingPaxOnly}
        isDateRangeInvalid={isDateRangeInvalid} hasActiveFilters={hasActiveFilters} clearFilters={clearFilters}
      />

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

      {editingDraft ? <AgreementDraftEditModal key={editingDraft.id} draft={editingDraft} isSaving={isSaving} onClose={closeEditDraftModal} onSave={(values) => updateDraft(editingDraft, values)} /> : null}
      {deleteDraftTarget ? <DeleteAgreementDraftModal draft={deleteDraftTarget} isDeleting={deleteDraftMutationPending} onClose={() => setDeleteDraftTarget(null)} onConfirm={() => void deleteDraft(deleteDraftTarget)} /> : null}
    </div>
  );
}
