import { useMemo, useState } from "react";
import { DatePickerInput } from "../../components/date-time-pickers";
import { AgreementDraftCard } from "../../pages/agreement-inbox/components/AgreementDraftCard";
import type { HotelAgreementDraft } from "../../shared/app-domain";
import { EmptyState, ErrorState, LoadingState } from "../components/data-state";
import { useAgentGroupData } from "../data/use-agent-group-data";

type StatusFilter = "assigned" | "all";

export function AgreementsPage({
  principalId,
  agentId,
  agentName,
}: {
  principalId: string;
  agentId: string;
  agentName: string;
}) {
  const query = useAgentGroupData({ principalId, agentId, agentName });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("assigned");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const drafts = useMemo<HotelAgreementDraft[]>(() => {
    if (!query.data) return [];
    return query.data.flatMap((group) => {
      const hotels = [
        ...(group.visaSetup?.makkahHotels ?? []).map((hotel) => ({ ...hotel, city: "makkah" as const })),
        ...(group.visaSetup?.madinahHotels ?? []).map((hotel) => ({ ...hotel, city: "madinah" as const })),
      ];
      return hotels.map((hotel) => ({
        id: `${group.id}-${hotel.id}`,
        agentId,
        city: hotel.city,
        agentName,
        hotelName: hotel.hotelName,
        agreementNumber: hotel.agreementNumber || "-",
        pax: hotel.pax,
        remainingPax: 0,
        assignedGroups: [
          { groupCode: group.code, pax: hotel.pax, stayStartIso: hotel.stayStartIso, stayEndIso: hotel.stayEndIso },
        ],
        status: hotel.status,
        stayStartIso: hotel.stayStartIso,
        stayEndIso: hotel.stayEndIso,
        notes: "",
        assignmentStatus: "Assigned",
        createdAtIso: hotel.stayStartIso,
        updatedAtIso: hotel.stayStartIso,
      }));
    });
  }, [agentId, agentName, query.data]);

  const filtered = drafts.filter((draft) => {
    const needle = search.trim().toLowerCase();
    const matchesSearch =
      !needle ||
      [draft.agreementNumber, draft.hotelName, ...draft.assignedGroups!.map((item) => item.groupCode)].some((value) =>
        value.toLowerCase().includes(needle),
      );
    const matchesStart = !startDate || draft.stayEndIso >= startDate;
    const matchesEnd = !endDate || draft.stayStartIso <= endDate;
    return (
      matchesSearch && matchesStart && matchesEnd && (statusFilter === "all" || draft.assignmentStatus === "Assigned")
    );
  });
  const invalidRange = Boolean(startDate && endDate && endDate < startDate);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 py-5 sm:py-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-primary">Hotel Agreement</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Agreement Inbox</h1>
        </div>
        <label className="serene-page-search w-full cursor-text border border-transparent transition focus-within:border-brand-primary/25 focus-within:ring-2 focus-within:ring-brand-primary/15 sm:max-w-sm">
          <span className="material-symbols-outlined text-slate-400" aria-hidden="true">
            search
          </span>
          <input
            type="search"
            className="serene-page-search-input h-full"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search agreement..."
          />
        </label>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-surface-container-lowest px-3 py-2.5 shadow-sm sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Agreement Workspace</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Data ditampilkan dalam mode read-only untuk Agent.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary/12 px-3 py-2 text-xs font-extrabold text-brand-primary">
            <span className="material-symbols-outlined text-base">visibility</span>Read-only
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[auto_minmax(11rem,0.7fr)_auto] md:items-end md:justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Status</span>
            <div className="flex h-9 items-center rounded-xl bg-slate-100 p-1">
              {(["assigned", "all"] as StatusFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className={`h-full w-[90px] rounded-lg text-xs font-extrabold transition ${statusFilter === filter ? "bg-white text-brand-primary shadow-sm" : "text-slate-600"}`}
                  onClick={() => setStatusFilter(filter)}
                >
                  {filter === "assigned" ? "Assigned" : "All"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Agent</span>
            <span className="serene-input serene-input-sm flex items-center font-bold text-slate-700">{agentName}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Stay Period</span>
            <div className="flex flex-wrap items-center gap-2">
              <DatePickerInput
                id="agent-agreement-start"
                inputClassName="serene-input serene-input-sm w-36"
                value={startDate}
                onChange={setStartDate}
                placeholder="Start Date"
              />
              <span className="text-xs font-bold text-slate-400">→</span>
              <DatePickerInput
                id="agent-agreement-end"
                inputClassName="serene-input serene-input-sm w-36"
                value={endDate}
                onChange={setEndDate}
                placeholder="End Date"
              />
            </div>
          </div>
        </div>
        {invalidRange ? (
          <p className="mt-3 text-xs font-semibold text-rose-600">End Date tidak boleh sebelum Start Date.</p>
        ) : null}
      </section>

      {query.isPending ? <LoadingState label="Memuat agreement..." /> : null}
      {query.isError ? <ErrorState retry={() => void query.refetch()} /> : null}
      {!query.isPending && !query.isError && filtered.length === 0 ? (
        <EmptyState title="No agreement drafts found" />
      ) : null}
      <section className="space-y-2">
        {filtered.map((draft) => (
          <AgreementDraftCard
            key={draft.id}
            draft={draft}
            linkedGroupCode=""
            assignmentGroupCode=""
            hasDatesSelected={Boolean(startDate && endDate)}
            isDateRangeInvalid={invalidRange}
            startDateFilter={startDate}
            endDateFilter={endDate}
            deleteDraftMutationPending={false}
            assignDraftMutationPending={false}
            unassignDraftMutationPending={false}
            onStartEdit={() => undefined}
            onDeleteRequest={() => undefined}
            onAssignmentGroupCodeChange={() => undefined}
            onAssignToGroup={() => undefined}
            onUnassignFromGroup={() => undefined}
            readOnly
          />
        ))}
      </section>
    </div>
  );
}
