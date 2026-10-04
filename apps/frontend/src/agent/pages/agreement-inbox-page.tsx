import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { StatusBadge } from "../../components/status-badge";
import { PaginationControls } from "../../components/pagination-controls";
import { Badge } from "../../components/badge";
import { AgreementDraftSummary } from "../../pages/agreement-inbox/components/AgreementDraftSummary";
import { AgreementInboxFilters } from "../../pages/agreement-inbox/components/AgreementInboxFilters";
import type { AgreementDraftStatusFilter } from "../../hooks/use-agreement-drafts-query";
import { portalGet } from "../data/portal-query";
import { formatDate } from "../data/format";
import { agentQueryKeys } from "../query/agent-query-boundary";
import { ErrorState, LoadingState } from "../components/data-state";

export type AgentAgreementDraft = {
  muassasahId?: string | null;
  muassasahName?: string | null;
  id: string;
  city: "MAKKAH" | "MADINAH";
  hotelName: string;
  agreementNumber: string;
  groupName: string;
  pax: number;
  status: "WAITING" | "APPROVED" | "REJECTED";
  stayStart: string;
  stayEnd: string;
  remainingPax: number;
  assignmentStatus: string;
  editable: boolean;
  assignedGroups: Array<{ groupCode: string; pax: number; stayStart?: string; stayEnd?: string }>;
};
const approval = { WAITING: "Waiting for Approval", APPROVED: "Approved", REJECTED: "Rejected" } as const;
const muassasahKey = (draft: AgentAgreementDraft) =>
  draft.muassasahId || (draft.muassasahName ? `name:${draft.muassasahName}` : "");
const PAGE_SIZE = 10;

export function AgreementInboxPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const assigned = (params.get("allocation") ?? "unassigned") as AgreementDraftStatusFilter;
  const muassasah = params.get("muassasah") ?? "all";
  const startDate = params.get("startDate") ?? "";
  const endDate = params.get("endDate") ?? "";
  const remainingPaxOnly = params.get("remainingPax") === "1";
  const hasDatesSelected = Boolean(startDate && endDate);
  const isDateRangeInvalid = hasDatesSelected && startDate > endDate;
  const [page, setPage] = useState(1);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: agentQueryKeys.agreements(principalId),
    queryFn: () => portalGet<AgentAgreementDraft[]>(client, "/agreement-drafts"),
    staleTime: 30_000,
  });
  const muassasahOptions = useMemo(
    () =>
      [
        ...new Map(
          (query.data ?? []).flatMap((draft) =>
            draft.muassasahName
              ? [[muassasahKey(draft), { id: muassasahKey(draft), name: draft.muassasahName }] as const]
              : [],
          ),
        ).values(),
      ].sort((a, b) => a.name.localeCompare(b.name)),
    [query.data],
  );
  const drafts = useMemo(
    () =>
      (query.data ?? []).filter((draft) => {
        const hasAllocation = draft.assignedGroups.length > 0 || draft.assignmentStatus !== "Unassigned";
        const matchesSearch =
          `${draft.agreementNumber} ${draft.hotelName} ${draft.groupName} ${draft.city} ${draft.muassasahName ?? ""} ${draft.assignedGroups.map((group) => group.groupCode).join(" ")}`
            .toLocaleLowerCase("id-ID")
            .includes(search.trim().toLocaleLowerCase("id-ID"));
        return (
          matchesSearch &&
          ((!hasDatesSelected && Boolean(search.trim())) ||
            assigned === "all" ||
            (assigned === "unassigned" ? draft.status === "REJECTED" || !hasAllocation : hasAllocation)) &&
          (muassasah === "all" || (muassasah === "none" ? !muassasahKey(draft) : muassasahKey(draft) === muassasah)) &&
          (!remainingPaxOnly || draft.remainingPax > 0) &&
          (!hasDatesSelected ||
            isDateRangeInvalid ||
            (draft.stayStart.slice(0, 10) <= endDate && draft.stayEnd.slice(0, 10) >= startDate))
        );
      }),
    [
      query.data,
      search,
      assigned,
      muassasah,
      startDate,
      endDate,
      hasDatesSelected,
      isDateRangeInvalid,
      remainingPaxOnly,
    ],
  );
  const totalPages = Math.max(1, Math.ceil(drafts.length / PAGE_SIZE));
  const paginatedDrafts = drafts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => {
    if (
      expandedDraftId &&
      !drafts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).some((draft) => draft.id === expandedDraftId)
    ) {
      setExpandedDraftId(null);
    }
  }, [drafts, page, expandedDraftId]);
  useEffect(() => setPage(1), [search, assigned, muassasah, startDate, endDate, remainingPaxOnly]);
  useEffect(() => setPage((current) => Math.min(current, totalPages)), [totalPages]);
  const updateParam = (key: string, value: string, defaultValue = "all") => {
    const next = new URLSearchParams(params);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const hasFilters =
    Boolean(search.trim() || startDate || endDate) ||
    assigned !== "unassigned" ||
    muassasah !== "all" ||
    remainingPaxOnly;

  return (
    <PageLayout width="workspace" className="agent-page-layout agreement-inbox-screen">
      <PageHeader
        variant="hero"
        className="[&_h1]:text-2xl sm:[&_h1]:text-3xl lg:[&_h1]:text-4xl"
        title="Agreement Inbox"
        description="Review and track hotel agreements for your groups."
      />
      <AgreementInboxFilters
        idPrefix="agent-filter"
        query={search}
        setQuery={(value) => updateParam("q", value)}
        statusFilter={assigned}
        setStatusFilter={(value) => updateParam("allocation", value, "unassigned")}
        muassasahFilter={muassasah}
        setMuassasahFilter={(value) => updateParam("muassasah", value)}
        muassasahOptions={muassasahOptions}
        startDateFilter={startDate}
        setStartDateFilter={(value) => updateParam("startDate", value)}
        endDateFilter={endDate}
        setEndDateFilter={(value) => updateParam("endDate", value)}
        remainingPaxOnly={remainingPaxOnly}
        setRemainingPaxOnly={(value) => updateParam("remainingPax", value ? "1" : "")}
        isDateRangeInvalid={isDateRangeInvalid}
        hasActiveFilters={hasFilters}
        clearFilters={() => setParams({})}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant" aria-live="polite">
          {drafts.length} agreements
        </p>
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            sync
          </span>
          {query.isFetching ? "Loading..." : "Refresh"}
        </button>
      </div>
      {query.isPending ? (
        <LoadingState label="Loading agreement drafts..." />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : drafts.length === 0 ? (
        <section className="serene-empty-state">
          <h2 className="text-lg font-bold">
            {query.data.length === 0 ? "Belum ada agreement" : "No matching agreements"}
          </h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            {query.data.length === 0
              ? "Agreement drafts created by Admin will appear here."
              : "Change your search or clear the filters to view other agreements."}
          </p>
        </section>
      ) : (
        <section
          className="grid gap-3 rounded-2xl lg:block lg:border lg:border-outline-variant/35 lg:bg-surface-container-lowest lg:shadow-sm"
          aria-label="Agreement drafts"
        >
          {paginatedDrafts.map((draft, index) => {
            const expanded = expandedDraftId === draft.id;
            const first = index === 0;
            const last = index === paginatedDrafts.length - 1;
            const detailId = `agent-agreement-details-${draft.id}`;
            const allocationDetailsUnavailable =
              draft.assignedGroups.length === 0 &&
              (draft.assignmentStatus === "Assigned" || draft.assignmentStatus === "Partially Assigned");
            const actionClass =
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 xl:h-9 xl:w-9";
            return (
              <article
                key={draft.id}
                className={`rounded-2xl border border-outline-variant/35 bg-surface-container-lowest shadow-sm lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b-outline-variant/25 lg:shadow-none lg:last:border-b-0 ${first ? "lg:rounded-tl-2xl lg:rounded-tr-2xl" : ""} ${last && !expanded ? "lg:rounded-br-2xl lg:rounded-bl-2xl" : ""}`}
              >
                <AgreementDraftSummary
                  city={draft.city === "MAKKAH" ? "makkah" : "madinah"}
                  hotelName={draft.hotelName}
                  hotelHeading
                  groupName={draft.groupName}
                  agreementNumber={draft.agreementNumber}
                  muassasahName={draft.muassasahName}
                  stayStart={draft.stayStart}
                  stayEnd={draft.stayEnd}
                  pax={draft.pax}
                  remainingPax={draft.remainingPax}
                  expanded={expanded}
                  first={first}
                  last={last}
                  approval={
                    <StatusBadge
                      tone={
                        draft.status === "APPROVED" ? "complete" : draft.status === "REJECTED" ? "attention" : "waiting"
                      }
                    >
                      {approval[draft.status]}
                    </StatusBadge>
                  }
                  assignment={
                    <Badge
                      status={
                        draft.assignmentStatus === "Assigned"
                          ? "success"
                          : draft.assignmentStatus === "Partially Assigned"
                            ? "info"
                            : "warning"
                      }
                    >
                      {draft.assignmentStatus}
                    </Badge>
                  }
                  actions={
                    <div className="flex w-full items-center justify-end gap-1">
                      <button
                        type="button"
                        className={actionClass}
                        aria-label={`${expanded ? "Tutup" : "Buka"} detail ${draft.agreementNumber}`}
                        aria-expanded={expanded}
                        aria-controls={detailId}
                        onClick={() => setExpandedDraftId(expanded ? null : draft.id)}
                      >
                        <span
                          className={`material-symbols-outlined text-xl transition-transform duration-300 motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`}
                          aria-hidden="true"
                        >
                          expand_more
                        </span>
                      </button>
                    </div>
                  }
                />
                {expanded ? (
                  <div
                    id={detailId}
                    className={`rounded-b-2xl border-t border-outline-variant/25 bg-surface-container-low/65 px-4 py-2.5 sm:px-5 lg:rounded-none ${last ? "lg:rounded-br-[15px] lg:rounded-bl-[15px]" : ""}`}
                  >
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <p className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-on-surface">
                        <span className="material-symbols-outlined text-base" aria-hidden="true">
                          groups
                        </span>
                        Linked Groups{allocationDetailsUnavailable ? "" : ` (${draft.assignedGroups.length})`}
                      </p>
                      {draft.groupName ? (
                        <p className="min-w-0 flex-1 truncate text-xs text-on-surface-variant" title={draft.groupName}>
                          Reference group: {draft.groupName}
                        </p>
                      ) : null}
                    </div>
                    {draft.assignedGroups.length ? (
                      <ul className="mt-1 grid gap-x-5 sm:grid-cols-2 xl:grid-cols-3">
                        {draft.assignedGroups.map((group, groupIndex) => (
                          <li
                            key={`${group.groupCode}-${groupIndex}`}
                            className="min-w-0 border-t border-outline-variant/25"
                          >
                            <Link
                              className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm font-semibold text-primary"
                              aria-label={group.groupCode}
                              to={`/agent/groups/${encodeURIComponent(group.groupCode)}`}
                            >
                              <span className="break-all">{group.groupCode}</span>
                              <span className="text-xs font-medium text-on-surface-variant">
                                {group.pax} Pax allocated
                                {group.stayStart && group.stayEnd
                                  ? ` · ${formatDate(group.stayStart)} – ${formatDate(group.stayEnd)}`
                                  : ""}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-on-surface-variant">
                        {allocationDetailsUnavailable
                          ? "This agreement has group allocations. Group details are not available to this account."
                          : "Belum terhubung ke group."}
                      </p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
      {drafts.length > 0 ? (
        <PaginationControls
          currentPage={page}
          totalPages={totalPages}
          totalItems={drafts.length}
          rangeStart={(page - 1) * PAGE_SIZE + 1}
          rangeEnd={Math.min(page * PAGE_SIZE, drafts.length)}
          itemLabel="agreements"
          onPageChange={setPage}
          touchSafe
        />
      ) : null}
    </PageLayout>
  );
}
