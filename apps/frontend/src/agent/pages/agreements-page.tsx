import { useMemo, useState } from "react";
import { DatePickerInput } from "../../components/date-time-pickers";
import { FilterField, FilterPanel, FixedValueField, SegmentedControl } from "../../components/filter-panel";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { ReadOnlyIndicator } from "../../components/read-only-indicator";
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
    <PageLayout width="wide">
      <PageHeader
        variant="compact"
        eyebrow="Hotel Agreement"
        title="Agreement Inbox"
        description="Pantau agreement hotel yang terhubung dengan group Anda."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <label className="serene-page-search w-full cursor-text sm:w-80">
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
            <ReadOnlyIndicator />
          </div>
        }
      />

      <FilterPanel>
        <div className="grid gap-4 md:grid-cols-[auto_minmax(11rem,0.7fr)_auto] md:items-end md:justify-between">
          <FilterField label="Status">
            <SegmentedControl
              value={statusFilter}
              options={[
                { value: "assigned", label: "Assigned" },
                { value: "all", label: "All" },
              ]}
              onChange={setStatusFilter}
              ariaLabel="Status agreement"
            />
          </FilterField>
          <FixedValueField label="Agent" value={agentName} icon="business" />
          <FilterField label="Stay Period">
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
          </FilterField>
        </div>
        {invalidRange ? (
          <p className="mt-3 text-xs font-semibold text-rose-600">End Date tidak boleh sebelum Start Date.</p>
        ) : null}
      </FilterPanel>

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
    </PageLayout>
  );
}
