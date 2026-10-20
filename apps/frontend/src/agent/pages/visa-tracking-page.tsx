import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button, IconButton } from "../../components/button";
import { GroupIdentity } from "../../components/group-identity";
import { Icon } from "../../components/icon";
import { ListToolbar, ResultSummary } from "../../components/list-toolbar";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { SearchField } from "../../components/search-field";
import { SectionHeader } from "../../components/section-header";
import { StatusBadge } from "../../components/status-badge";
import type { GroupData } from "../../shared/app-domain";
import { EmptyState, ErrorState } from "../components/data-state";
import type { VisaApplication } from "../data/contracts";
import { validDateOnly } from "../data/departure-calendar";
import { groupAgentFamilies } from "../data/group-families";
import { useAgentGroupData } from "../data/use-agent-group-data";
import { useAgentVisaApplications } from "../data/use-agent-visa-applications";
import {
  buildVisaProcessStages,
  currentVisaProcessStage,
  visaProcessDefinition,
  type VisaProcessStage,
} from "../data/visa-process";

type FilterId = "all" | "attention" | "process" | "issued";
type VisaListItem = {
  parentGroupId?: string | null;
  id: string;
  identity: string;
  code: string;
  name: string;
  pax: number;
  packageName: string;
  date: string | null;
  dateSource: "departure" | "journey";
  currentStage: VisaProcessStage;
  stages: VisaProcessStage[];
  completedStages: number;
  bucket: Exclude<FilterId, "all">;
};
type VisaFamily = { root: VisaListItem; members: VisaListItem[] };
const filters: Array<{ id: FilterId; label: string; icon: string }> = [
  { id: "all", label: "Semua", icon: "groups" },
  { id: "attention", label: "Perlu perhatian", icon: "warning" },
  { id: "process", label: "Diproses", icon: "schedule" },
  { id: "issued", label: "Visa terbit", icon: "check_circle" },
];
const stageLabels = { document: "Dokumen", agreement: "Agreement", nusuk: "Nusuk", visa: "Visa" };
const compactStatus: Record<string, string> = {
  "Dokumen terverifikasi": "Terverifikasi",
  "Dokumen perlu revisi": "Perlu revisi",
  "Agreement disetujui": "Disetujui",
  "Upload sedang berlangsung": "Sedang upload",
  "Data paspor tercatat": "Data tercatat",
  "Group Nusuk dibuat": "Group dibuat",
  "Visa issued": "Visa terbit",
};
const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function toItem(group: GroupData | null, application: VisaApplication | null): VisaListItem {
  const stages = buildVisaProcessStages(application, group);
  const issued = stages.at(-1)?.complete ?? false;
  const attention = stages.some((stage) => stage.tone === "attention") || group?.visaSetup?.visaStatus === "Draft";
  const departure = validDateOnly(application?.departureDate);
  return {
    id: group?.id ?? application!.id,
    parentGroupId: group?.parentGroupId,
    identity: group?.code ?? application!.id,
    code: group?.code ?? application!.applicationNumber,
    name: group?.name ?? application!.group?.name ?? application!.packageName,
    pax: group?.pax ?? application!.passengerCount,
    packageName: group?.packageName || application?.packageName || "Belum dicatat",
    date: departure ?? validDateOnly(group?.arrivalDate) ?? null,
    dateSource: departure ? "departure" : "journey",
    currentStage: currentVisaProcessStage(stages),
    stages,
    completedStages: stages.filter((stage) => stage.complete).length,
    bucket: issued ? "issued" : attention ? "attention" : "process",
  };
}
export function buildAgentVisaItems(groups: GroupData[], applications: VisaApplication[]): VisaListItem[] {
  const byGroup = new Map(applications.filter((item) => item.groupId).map((item) => [item.groupId as string, item]));
  const matched = new Set<string>();
  const groupItems = groups.map((group) => {
    const application =
      (group.id && byGroup.get(group.id)) || applications.find((item) => item.group?.code === group.code) || null;
    if (application) matched.add(application.id);
    return toItem(group, application);
  });
  return [...groupItems, ...applications.filter((item) => !matched.has(item.id)).map((item) => toItem(null, item))];
}
export function AgentVisaTrackingPage({
  principalId,
  agentId,
  agentName,
}: {
  principalId: string;
  agentId: string;
  agentName: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const [guideOpen, setGuideOpen] = useState(false);
  const groupsQuery = useAgentGroupData({ principalId, agentId, agentName });
  const applicationsQuery = useAgentVisaApplications(principalId);
  const query = params.get("q") ?? "";
  const filter = (params.get("status") as FilterId | null) ?? "all";
  const items = useMemo(
    () => buildAgentVisaItems(groupsQuery.data ?? [], applicationsQuery.data ?? []),
    [applicationsQuery.data, groupsQuery.data],
  );
  const needle = query.trim().toLocaleLowerCase("id-ID");
  const matches = (item: VisaListItem) =>
    (filter === "all" || item.bucket === filter) &&
    (!needle || `${item.code} ${item.name} ${item.packageName}`.toLocaleLowerCase("id-ID").includes(needle));
  const families = groupAgentFamilies(items).filter((family) => family.members.some(matches));
  const counts = {
    all: items.length,
    attention: items.filter((item) => item.bucket === "attention").length,
    process: items.filter((item) => item.bucket === "process").length,
    issued: items.filter((item) => item.bucket === "issued").length,
  };
  const hasFilters = !!needle || filter !== "all";
  useEffect(() => {
    if (!filters.some((item) => item.id === filter)) {
      const next = new URLSearchParams(params);
      next.delete("status");
      setParams(next, { replace: true });
    }
  }, [filter, params, setParams]);
  const updateParam = (key: "q" | "status", value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };
  const resetFilters = () => setParams({}, { replace: true });
  const retry = () => void Promise.all([groupsQuery.refetch(), applicationsQuery.refetch()]);
  const onOpen = (item: VisaListItem) =>
    navigate(`/agent/visa/${encodeURIComponent(item.identity)}`, {
      state: { from: `${location.pathname}${location.search}` },
      viewTransition: true,
    });
  const loading = groupsQuery.isPending || applicationsQuery.isPending;
  return (
    <PageLayout width="workspace" className="agent-visa-page agent-page-layout">
      <PageHeader variant="compact" title="Visa Tracking" description="Pantau progres visa setiap group." />
      {loading ? (
        <section className="agent-visa-loading" aria-busy="true" aria-label="Memuat Visa Tracking">
          <p className="sr-only" role="status">
            Memuat Visa Tracking...
          </p>
          <div className="agent-visa-skeleton-toolbar" />
          <div className="agent-visa-skeleton-family" />
          <div className="agent-visa-skeleton-family" />
        </section>
      ) : groupsQuery.isError || applicationsQuery.isError ? (
        <ErrorState retry={retry} />
      ) : (
        <>
          <ListToolbar
            ariaLabel="Ringkasan dan filter visa"
            footer={
              <ResultSummary onReset={hasFilters && families.length > 0 ? resetFilters : undefined}>
                {items.filter(matches).length} group / pengajuan · {families.length} perjalanan ditampilkan
              </ResultSummary>
            }
          >
            <div className="agent-visa-filters" role="group" aria-label="Status progres">
              {filters.map((item) => (
                <Button
                  variant={filter === item.id ? "primary" : "secondary"}
                  key={item.id}
                  className={`agent-visa-filter ${filter === item.id ? "is-selected" : ""}`}
                  aria-pressed={filter === item.id}
                  onClick={() => updateParam("status", item.id)}
                >
                  <Icon name={item.icon} className={`agent-visa-filter-icon is-${item.id}`} />
                  <span>{item.label}</span>
                  <span className="agent-visa-filter-count">{counts[item.id]}</span>
                </Button>
              ))}
            </div>
            <div className="agent-visa-search-row">
              <SearchField
                label="Cari group"
                value={query}
                placeholder="Cari nama atau kode group"
                onChange={(value) => updateParam("q", value)}
              />
              <Button
                variant="tertiary"
                className="agent-visa-guide-button"
                aria-expanded={guideOpen}
                aria-controls="agent-visa-guide"
                onClick={() => setGuideOpen((open) => !open)}
              >
                <Icon name="description" />
                <span>Panduan 4 tahap</span>
                <Icon name={guideOpen ? "expand_more" : "arrow_forward"} className={guideOpen ? "is-up" : ""} />
              </Button>
            </div>
          </ListToolbar>
          {guideOpen && <ProcessOverview />}
          {items.length === 0 ? (
            <EmptyState title="Belum ada pengajuan visa">
              Group atau pengajuan yang ditugaskan kepada akun Agent ini akan muncul di sini.
            </EmptyState>
          ) : families.length === 0 ? (
            <EmptyState
              icon="search_off"
              title="Tidak ada pengajuan yang sesuai"
              description="Ubah kata pencarian atau filter status untuk melihat pengajuan lainnya."
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  Reset filter
                </Button>
              }
            />
          ) : (
            <section className="agent-visa-journeys" aria-label="Daftar pengajuan visa">
              {families.map((family) => (
                <Journey
                  key={family.root.id}
                  family={family}
                  filtered={hasFilters}
                  filterKey={`${query}:${filter}`}
                  matchingMembers={hasFilters ? family.members.filter(matches) : family.members}
                  onOpen={onOpen}
                />
              ))}
            </section>
          )}
        </>
      )}
    </PageLayout>
  );
}
function Journey({
  family: { root, members },
  matchingMembers,
  filtered,
  filterKey,
  onOpen,
}: {
  family: VisaFamily;
  matchingMembers: VisaListItem[];
  filtered: boolean;
  filterKey: string;
  onOpen: (item: VisaListItem) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => {
    if (filtered) {
      setExpanded(true);
      setMoreOpen(true);
    }
  }, [filtered, filterKey]);
  const children = matchingMembers.filter((item) => item !== root);
  const bodyId = `visa-family-${root.id}`;
  const titleId = `visa-family-title-${root.id}`;
  const hasChildren = members.length > 1;
  return (
    <article className="agent-visa-journey" aria-labelledby={titleId}>
      <header className="agent-visa-journey-heading">
        <span className="agent-visa-avatar">
          <Icon name="groups" />
        </span>
        <div className="agent-visa-journey-identity">
          <h2 id={titleId}>{root.name}</h2>
          <p>
            {root.date ? (
              <span>
                {root.dateSource === "departure" ? "Keberangkatan" : "Awal perjalanan"}{" "}
                <time dateTime={root.date}>{dateFormatter.format(new Date(`${root.date}T12:00:00Z`))}</time>
              </span>
            ) : (
              <span>Jadwal belum tercatat</span>
            )}
            <span>{members.length} group</span>
            <span>{members.reduce((sum, item) => sum + item.pax, 0)} jamaah</span>
          </p>
        </div>
        {members.some((item) => item.bucket === "attention") && (
          <StatusBadge tone="waiting" icon="warning" className="agent-visa-family-attention">
            Perlu perhatian
          </StatusBadge>
        )}
        <IconButton
          icon="expand_more"
          iconClassName={expanded ? "is-up" : ""}
          className="agent-visa-family-toggle"
          aria-label={`${expanded ? "Tutup" : "Buka"} progres ${root.name}`}
          aria-expanded={expanded}
          aria-controls={bodyId}
          onClick={() => setExpanded((open) => !open)}
        />
      </header>
      <div id={bodyId} hidden={!expanded} className={`agent-visa-family-body ${hasChildren ? "has-children" : ""}`}>
        <VisaRow
          item={root}
          role={hasChildren ? "Parent" : undefined}
          context={filtered && !matchingMembers.includes(root)}
          onOpen={onOpen}
        />
        {children[0] && <VisaRow item={children[0]} role="Child" onOpen={onOpen} />}
        {children.length > 1 && (
          <>
            <div id={`${bodyId}-more`} className={`agent-visa-more-children ${moreOpen ? "is-open" : ""}`}>
              {children.slice(1).map((item) => (
                <VisaRow key={item.id} item={item} role="Child" onOpen={onOpen} />
              ))}
            </div>
            <Button
              variant="tertiary"
              className="agent-visa-more-button"
              aria-controls={`${bodyId}-more`}
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
            >
              {moreOpen ? "Sembunyikan group lainnya" : `Lihat ${children.length - 1} group lainnya`}
              <Icon name="expand_more" className={moreOpen ? "is-up" : ""} />
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
function VisaRow({
  item,
  role,
  context = false,
  onOpen,
}: {
  item: VisaListItem;
  role?: "Parent" | "Child";
  context?: boolean;
  onOpen: (item: VisaListItem) => void;
}) {
  const attention = item.stages.find((stage) => stage.tone === "attention");
  return (
    <section
      className={`agent-visa-row ${role === "Child" ? "is-child" : ""} ${context ? "is-context" : ""}`}
      aria-label={`Group ${item.code}`}
    >
      <span className="agent-visa-avatar">
        <Icon name={role === "Parent" || attention ? "groups" : "luggage"} />
      </span>
      <GroupIdentity
        className="agent-visa-group-identity"
        code={item.code}
        metadata={
          <>
            {item.pax} jamaah{context && <span className="agent-visa-context-label">Group terhubung</span>}
          </>
        }
      />
      <ol className="agent-visa-stages" aria-label={`${item.completedStages} dari 4 tahap selesai`}>
        {item.stages.map((stage, index) => (
          <li
            key={stage.id}
            className={`agent-visa-stage is-${stage.tone} ${stage.id === "agreement" && stage.status === "Menunggu persetujuan" ? "is-approval-waiting" : ""}`}
          >
            <span className="agent-visa-stage-marker">
              {stage.complete ? (
                <Icon name="check" />
              ) : stage.tone === "attention" ? (
                <Icon name="warning" />
              ) : stage.tone === "in-progress" ? (
                <Icon name="schedule" />
              ) : (
                index + 1
              )}
            </span>
            <div className="agent-visa-stage-copy">
              <span className="agent-visa-stage-name" title={stage.label}>
                <span className="agent-visa-stage-number">{index + 1}</span>
                {stageLabels[stage.id]}
              </span>
              <span className="agent-visa-stage-status" title={stage.status}>
                {compactStatus[stage.status] ?? stage.status}
              </span>
            </div>
          </li>
        ))}
      </ol>
      <Button
        variant="tertiary"
        className="agent-visa-detail"
        aria-label={`Lihat detail visa ${item.code}`}
        onClick={() => onOpen(item)}
      >
        Lihat detail
        <Icon name="arrow_forward" />
      </Button>
      {attention && (
        <p className="agent-visa-revision">
          <Icon name="warning" />
          {attention.status}.
        </p>
      )}
    </section>
  );
}
function ProcessOverview() {
  return (
    <section id="agent-visa-guide" className="agent-visa-guide" aria-labelledby="visa-process-title">
      <SectionHeader id="visa-process-title" title="Alur proses visa" />
      <ol>
        {visaProcessDefinition.map((stage, index) => (
          <li key={stage.label}>
            <span>{index + 1}</span>
            <div>
              <h3>{stage.label}</h3>
              <p>{stage.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
