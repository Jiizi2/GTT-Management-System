import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { SereneSelect } from "../../components/serene-select";
import { StatusBadge } from "../../components/status-badge";
import type { GroupData } from "../../shared/app-domain";
import { EmptyState, ErrorState, LoadingState } from "../components/data-state";
import type { VisaApplication } from "../data/contracts";
import { useAgentGroupData } from "../data/use-agent-group-data";
import { useAgentVisaApplications } from "../data/use-agent-visa-applications";
import { buildVisaProcessStages, currentVisaProcessStage, visaProcessDefinition, type VisaProcessStage } from "../data/visa-process";

type FilterId = "all" | "attention" | "process" | "issued";
type VisaListItem = {
  id: string;
  identity: string;
  code: string;
  name: string;
  pax: number;
  packageName: string;
  currentStage: VisaProcessStage;
  stages: VisaProcessStage[];
  completedStages: number;
  bucket: Exclude<FilterId, "all">;
};

function toItem(group: GroupData | null, application: VisaApplication | null): VisaListItem {
  const stages = buildVisaProcessStages(application, group);
  const currentStage = currentVisaProcessStage(stages);
  const issued = stages.at(-1)?.complete ?? false;
  const attention = stages.some((stage) => stage.tone === "attention") || group?.visaSetup?.visaStatus === "Draft";
  return {
    id: group?.id ?? application!.id,
    identity: group?.code ?? application!.id,
    code: group?.code ?? application!.applicationNumber,
    name: group?.name ?? application!.group?.name ?? application!.packageName,
    pax: group?.pax ?? application!.passengerCount,
    packageName: group?.packageName || application?.packageName || "Belum dicatat",
    currentStage,
    stages,
    completedStages: stages.filter((stage) => stage.complete).length,
    bucket: issued ? "issued" : attention ? "attention" : "process",
  };
}

export function buildAgentVisaItems(groups: GroupData[], applications: VisaApplication[]): VisaListItem[] {
  const applicationsByGroup = new Map(
    applications.filter((item) => item.groupId).map((item) => [item.groupId as string, item]),
  );
  const matched = new Set<string>();
  const groupItems = groups.map((group) => {
    const application =
      (group.id && applicationsByGroup.get(group.id)) ||
      applications.find((item) => item.group?.code === group.code) ||
      null;
    if (application) matched.add(application.id);
    return toItem(group, application);
  });
  const unlinked = applications.filter((item) => !matched.has(item.id)).map((item) => toItem(null, item));
  return [...groupItems, ...unlinked];
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
  const groupsQuery = useAgentGroupData({ principalId, agentId, agentName });
  const applicationsQuery = useAgentVisaApplications(principalId);
  const query = params.get("q") ?? "";
  const filter = (params.get("status") as FilterId | null) ?? "all";
  const items = useMemo(
    () => buildAgentVisaItems(groupsQuery.data ?? [], applicationsQuery.data ?? []),
    [applicationsQuery.data, groupsQuery.data],
  );
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    return items.filter(
      (item) =>
        (filter === "all" || item.bucket === filter) &&
        (!needle || `${item.code} ${item.name} ${item.packageName}`.toLocaleLowerCase("id-ID").includes(needle)),
    );
  }, [filter, items, query]);

  useEffect(() => {
    if (!(["all", "attention", "process", "issued"] as string[]).includes(filter)) {
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

  if (groupsQuery.isPending || applicationsQuery.isPending) return <LoadingState label="Memuat Visa Tracking..." />;
  if (groupsQuery.isError || applicationsQuery.isError) return <ErrorState retry={retry} />;

  const counts = {
    attention: items.filter((item) => item.bucket === "attention").length,
    process: items.filter((item) => item.bucket === "process").length,
    issued: items.filter((item) => item.bucket === "issued").length,
  };
  const hasFilters = Boolean(query.trim()) || filter !== "all";

  return (
    <PageLayout>
      <PageHeader
        title="Visa Tracking"
        description="Pantau posisi setiap group dari pengiriman dokumen hingga visa issued."
      />

      <ProcessOverview />

      <section className="serene-section p-4 sm:p-5" aria-label="Ringkasan dan filter visa">
        <dl className="grid gap-3 border-b border-outline-variant/30 pb-4 sm:grid-cols-3">
          <Summary label="Perlu perhatian" value={counts.attention} />
          <Summary label="Sedang diproses" value={counts.process} />
          <Summary label="Visa terbit" value={counts.issued} />
        </dl>
        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_14rem]">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-on-surface">Cari group</span>
            <span className="serene-page-search min-h-11">
              <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">search</span>
              <input type="search" className="serene-page-search-input h-full" placeholder="Kode atau nama group" value={query} onChange={(event) => updateParam("q", event.target.value)} />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-on-surface">Status progres</span>
            <SereneSelect className="h-11 w-full rounded-xl border border-outline-variant/45 bg-surface-container-lowest px-3 text-sm font-semibold text-on-surface" value={filter} onChange={(event) => updateParam("status", event.target.value)}>
              <option value="all">Semua status ({items.length})</option>
              <option value="attention">Perlu perhatian ({counts.attention})</option>
              <option value="process">Sedang diproses ({counts.process})</option>
              <option value="issued">Visa terbit ({counts.issued})</option>
            </SereneSelect>
          </label>
        </div>
        <div className="mt-4 flex min-h-11 flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-4">
          <p className="text-sm text-on-surface-variant" aria-live="polite"><strong className="text-on-surface tabular-nums">{visibleItems.length}</strong> pengajuan ditampilkan</p>
          {hasFilters && visibleItems.length > 0 ? <button type="button" className="serene-btn-secondary min-h-11" onClick={resetFilters}>Reset filter</button> : null}
        </div>
      </section>

      {items.length === 0 ? (
        <EmptyState title="Belum ada pengajuan visa">Group atau pengajuan yang ditugaskan kepada akun Agent ini akan muncul di sini.</EmptyState>
      ) : visibleItems.length === 0 ? (
        <VisaEmpty title="Tidak ada pengajuan yang sesuai" description="Ubah kata pencarian atau filter status untuk melihat pengajuan lainnya." action={<button type="button" className="serene-btn-secondary min-h-11" onClick={resetFilters}>Reset filter</button>} />
      ) : (
        <section className="serene-section overflow-hidden p-0" aria-label="Daftar pengajuan visa">
          <div className="hidden grid-cols-[minmax(13rem,1.35fr)_minmax(10rem,0.8fr)_minmax(13rem,1fr)_auto] gap-4 border-b border-outline-variant/30 bg-surface-container-low px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant lg:grid">
            <span>Group</span><span>Tahap saat ini</span><span>Progres proses</span><span className="sr-only">Aksi</span>
          </div>
          <div className="divide-y divide-outline-variant/30">
            {visibleItems.map((item) => <VisaRow key={item.id} item={item} onOpen={() => navigate(`/agent/visa/${encodeURIComponent(item.identity)}`, { state: { from: `${location.pathname}${location.search}` } })} />)}
          </div>
        </section>
      )}
    </PageLayout>
  );
}

function ProcessOverview() {
  return (
    <section className="serene-section p-5 sm:p-6" aria-labelledby="visa-process-title">
      <h2 id="visa-process-title" className="text-lg font-extrabold text-on-surface">Alur proses visa</h2>
      <p className="mt-1 max-w-3xl text-sm leading-relaxed text-on-surface-variant">Setiap pengajuan bergerak melalui empat tahap utama berikut.</p>
      <ol className="mt-5 grid border-y border-outline-variant/30 sm:grid-cols-2 lg:grid-cols-4">
        {visaProcessDefinition.map((stage, index) => (
          <li key={stage.label} className="flex gap-3 border-b border-outline-variant/30 py-4 last:border-b-0 sm:border-b-0 sm:px-4 lg:border-r lg:first:pl-0 lg:last:border-r-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary tabular-nums">{index + 1}</span>
            <div className="min-w-0"><h3 className="text-sm font-extrabold text-on-surface">{stage.label}</h3><p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{stage.description}</p></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="flex items-baseline justify-between gap-3 sm:block"><dt className="text-sm text-on-surface-variant">{label}</dt><dd className="mt-1 text-xl font-extrabold text-on-surface tabular-nums">{value}</dd></div>;
}

function VisaRow({ item, onOpen }: { item: VisaListItem; onOpen: () => void }) {
  return (
    <article className="grid min-w-0 gap-4 p-5 lg:grid-cols-[minmax(13rem,1.35fr)_minmax(10rem,0.8fr)_minmax(13rem,1fr)_auto] lg:items-center">
      <div className="min-w-0"><p className="break-all text-sm font-extrabold text-primary">{item.code}</p><h2 className="mt-1 break-words text-base font-extrabold text-on-surface">{item.name}</h2><p className="mt-1 text-sm text-on-surface-variant">{item.pax} jamaah · {item.packageName}</p></div>
      <LabeledValue label="Tahap saat ini"><p className="mb-2 text-sm font-bold text-on-surface">{item.currentStage.label}</p><StatusBadge tone={item.currentStage.tone}>{item.currentStage.status}</StatusBadge></LabeledValue>
      <ProcessSummary stages={item.stages} completed={item.completedStages} />
      <div className="flex items-center lg:justify-end"><button type="button" className="serene-btn-secondary min-h-11 shrink-0" onClick={onOpen} aria-label={`Lihat detail visa ${item.code}`}>Lihat detail<span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_forward</span></button></div>
    </article>
  );
}

function ProcessSummary({ stages, completed }: { stages: VisaProcessStage[]; completed: number }) {
  return (
    <div className="min-w-0" aria-label={`${completed} dari 4 tahap selesai`}>
      <p className="mb-2 text-xs font-semibold text-on-surface-variant"><span className="lg:sr-only">Progres proses: </span>{completed} dari 4 tahap selesai</p>
      <ol className="grid grid-cols-4 gap-1" aria-hidden="true">
        {stages.map((stage) => <li key={stage.id} className={`h-2 rounded-full ${stage.complete ? "bg-primary" : stage.tone === "attention" ? "bg-error" : stage.tone === "in-progress" ? "bg-tertiary" : "bg-outline-variant/45"}`} />)}
      </ol>
    </div>
  );
}

function LabeledValue({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><p className="mb-1.5 text-xs font-semibold text-on-surface-variant lg:sr-only">{label}</p>{children}</div>;
}

function VisaEmpty({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return <section className="serene-empty-state"><span className="material-symbols-outlined text-4xl text-on-surface-variant/60" aria-hidden="true">search_off</span><h2 className="mt-3 text-xl font-bold text-on-surface">{title}</h2><p className="mt-2 max-w-xl text-sm text-on-surface-variant">{description}</p><div className="mt-5">{action}</div></section>;
}
