import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { SereneSelect } from "../../components/serene-select";
import { StatusBadge } from "../../components/status-badge";
import type { GroupData } from "../../shared/app-domain";
import { EmptyState, ErrorState, LoadingState } from "../components/data-state";
import type { VisaApplication, VisaApplicationStatus } from "../data/contracts";
import { useAgentGroupData } from "../data/use-agent-group-data";
import { useAgentVisaApplications } from "../data/use-agent-visa-applications";

type FilterId = "all" | "attention" | "process" | "issued";
type Tone = "complete" | "in-progress" | "waiting" | "attention" | "neutral";
type VisaListItem = {
  id: string;
  identity: string;
  code: string;
  name: string;
  pax: number;
  packageName: string;
  status: { label: string; tone: Tone };
  document: { label: string; tone: Tone };
  payment: string;
  bucket: Exclude<FilterId, "all">;
};

const applicationStatus: Record<VisaApplicationStatus, { label: string; tone: Tone }> = {
  WAITING_DOCUMENT: { label: "Menunggu dokumen", tone: "waiting" },
  NEED_REVISION: { label: "Dokumen perlu revisi", tone: "attention" },
  DOCUMENT_VERIFIED: { label: "Dokumen terverifikasi", tone: "in-progress" },
  WAITING_HOTEL_AGREEMENT: { label: "Menunggu hotel agreement", tone: "waiting" },
  PASSENGER_ENTERED: { label: "Data jamaah tercatat", tone: "in-progress" },
  GROUP_CREATED: { label: "Group Nusuk dibuat", tone: "in-progress" },
  READY_TO_SEND: { label: "Siap dikirim", tone: "in-progress" },
  VISA_SUBMITTED: { label: "Visa diajukan", tone: "in-progress" },
  PAYMENT_COMPLETED: { label: "Pembayaran selesai", tone: "in-progress" },
  VISA_PROCESSING: { label: "Visa diproses", tone: "in-progress" },
  VISA_ISSUED: { label: "Visa terbit", tone: "complete" },
  COMPLETED: { label: "Selesai", tone: "complete" },
};

function groupStatus(group: GroupData): { label: string; tone: Tone } {
  if (group.visaSetup?.visaStatus === "Issued") return { label: "Visa terbit", tone: "complete" };
  if (group.visaSetup?.visaStatus === "Pending") return { label: "Visa diproses", tone: "in-progress" };
  return { label: "Persiapan", tone: "waiting" };
}

function documentStatus(application: VisaApplication | null): { label: string; tone: Tone } {
  if (!application) return { label: "Belum dicatat", tone: "neutral" };
  if (application.documentStatus === "VERIFIED") return { label: "Terverifikasi", tone: "complete" };
  if (application.documentStatus === "NEED_REVISION") return { label: "Perlu revisi", tone: "attention" };
  return { label: "Menunggu dokumen", tone: "waiting" };
}

function paymentLabel(group: GroupData | null, application: VisaApplication | null): string {
  if (application) {
    if (application.paymentStatus === "COMPLETED") return "Selesai";
    if (application.paymentStatus === "WAITING_PAYMENT") return "Menunggu pembayaran";
    return "Belum dimulai";
  }
  if (group?.visaSetup?.paymentStatus === "Paid") return "Lunas";
  if (group?.visaSetup?.paymentStatus === "Partial") return "Sebagian";
  if (group?.visaSetup?.paymentStatus === "Unpaid") return "Belum lunas";
  return "Belum dicatat";
}

function toItem(group: GroupData | null, application: VisaApplication | null): VisaListItem {
  const status = application ? applicationStatus[application.status] : groupStatus(group!);
  const document = documentStatus(application);
  const issued = application
    ? application.visaStatus === "ISSUED" || application.visaStatus === "COMPLETED"
    : group?.visaSetup?.visaStatus === "Issued";
  const attention = application
    ? application.documentStatus === "WAITING_DOCUMENT" || application.documentStatus === "NEED_REVISION"
    : group?.visaSetup?.visaStatus === "Draft";
  return {
    id: group?.id ?? application!.id,
    identity: group?.code ?? application!.id,
    code: group?.code ?? application!.applicationNumber,
    name: group?.name ?? application!.group?.name ?? application!.packageName,
    pax: group?.pax ?? application!.passengerCount,
    packageName: group?.packageName || application?.packageName || "Belum dicatat",
    status,
    document,
    payment: paymentLabel(group, application),
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
        description="Pantau progres pengajuan visa dan kesiapan dokumen untuk setiap group Anda."
      />

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
          <div className="hidden grid-cols-[minmax(13rem,1.5fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_auto] gap-4 border-b border-outline-variant/30 bg-surface-container-low px-5 py-3 text-xs font-bold uppercase tracking-[0.08em] text-on-surface-variant lg:grid">
            <span>Group</span><span>Progres visa</span><span>Dokumen</span><span className="sr-only">Aksi</span>
          </div>
          <div className="divide-y divide-outline-variant/30">
            {visibleItems.map((item) => <VisaRow key={item.id} item={item} onOpen={() => navigate(`/agent/visa/${encodeURIComponent(item.identity)}`, { state: { from: `${location.pathname}${location.search}` } })} />)}
          </div>
        </section>
      )}
    </PageLayout>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="flex items-baseline justify-between gap-3 sm:block"><dt className="text-sm text-on-surface-variant">{label}</dt><dd className="mt-1 text-xl font-extrabold text-on-surface tabular-nums">{value}</dd></div>;
}

function VisaRow({ item, onOpen }: { item: VisaListItem; onOpen: () => void }) {
  return (
    <article className="grid min-w-0 gap-4 p-5 lg:grid-cols-[minmax(13rem,1.5fr)_minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_auto] lg:items-center">
      <div className="min-w-0"><p className="break-all text-sm font-extrabold text-primary">{item.code}</p><h2 className="mt-1 break-words text-base font-extrabold text-on-surface">{item.name}</h2><p className="mt-1 text-sm text-on-surface-variant">{item.pax} jamaah · {item.packageName}</p></div>
      <LabeledValue label="Progres visa"><StatusBadge tone={item.status.tone}>{item.status.label}</StatusBadge></LabeledValue>
      <LabeledValue label="Dokumen"><StatusBadge tone={item.document.tone}>{item.document.label}</StatusBadge></LabeledValue>
      <div className="flex flex-wrap items-center gap-3 lg:justify-end"><div className="text-xs text-on-surface-variant lg:hidden">Pembayaran: <strong className="text-on-surface">{item.payment}</strong></div><button type="button" className="serene-btn-secondary min-h-11 shrink-0" onClick={onOpen} aria-label={`Lihat detail visa ${item.code}`}>Lihat detail<span className="material-symbols-outlined text-lg" aria-hidden="true">arrow_forward</span></button></div>
    </article>
  );
}

function LabeledValue({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><p className="mb-1.5 text-xs font-semibold text-on-surface-variant lg:sr-only">{label}</p>{children}</div>;
}

function VisaEmpty({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return <section className="serene-empty-state"><span className="material-symbols-outlined text-4xl text-on-surface-variant/60" aria-hidden="true">search_off</span><h2 className="mt-3 text-xl font-bold text-on-surface">{title}</h2><p className="mt-2 max-w-xl text-sm text-on-surface-variant">{description}</p><div className="mt-5">{action}</div></section>;
}
