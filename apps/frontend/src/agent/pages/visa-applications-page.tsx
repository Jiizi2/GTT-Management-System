import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorState, LoadingState } from "../components/data-state";
import type { VisaApplication, VisaApplicationDocumentType } from "../data/contracts";
import { formatDate, statusLabel } from "../data/format";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";

type StepState = "completed" | "current" | "pending";
type WorkflowStep = { label: string; completed: boolean; detail: string };
type BlockingIssue = {
  reason: string;
  responsible: string;
  eta: string;
  tone: "attention" | "waiting";
};
type WorklistFilter = "all" | "attention" | "completed";

const requiredDocumentTypes: VisaApplicationDocumentType[] = [
  "PASSPORT",
  "VACCINE_CERTIFICATE",
  "MANIFEST",
  "PACKAGE_INFORMATION",
];

const documentLabels: Record<VisaApplicationDocumentType, string> = {
  PASSPORT: "Passport",
  VACCINE_CERTIFICATE: "Vaccine Certificate",
  MANIFEST: "Manifest",
  PACKAGE_INFORMATION: "Package Information",
};

function hasStatus(value: string, accepted: readonly string[]): boolean {
  return accepted.includes(value);
}

export function buildWorkflow(application: VisaApplication): WorkflowStep[] {
  const documentReceived = application.documentStatus !== "WAITING_DOCUMENT";
  const documentVerified = application.documentStatus === "VERIFIED";
  const nusukEntered = hasStatus(application.nusukStatus, ["PASSENGER_ENTERED", "GROUP_CREATED"]);
  const agreementApproved = application.agreementStatus === "APPROVED";
  const readyToSend =
    application.visaStatus !== "NOT_STARTED" ||
    hasStatus(application.status, [
      "READY_TO_SEND",
      "VISA_SUBMITTED",
      "PAYMENT_COMPLETED",
      "VISA_PROCESSING",
      "VISA_ISSUED",
      "COMPLETED",
    ]);
  const paymentCompleted = application.paymentStatus === "COMPLETED";
  const visaSubmitted = hasStatus(application.visaStatus, ["SUBMITTED", "PROCESSING", "ISSUED", "COMPLETED"]);
  const visaIssued = hasStatus(application.visaStatus, ["ISSUED", "COMPLETED"]);

  return [
    { label: "Passport Received", completed: documentReceived, detail: statusLabel(application.documentStatus) },
    { label: "Verification", completed: documentVerified, detail: statusLabel(application.documentStatus) },
    { label: "Nusuk Entry", completed: nusukEntered, detail: statusLabel(application.nusukStatus) },
    { label: "Hotel Agreement", completed: agreementApproved, detail: statusLabel(application.agreementStatus) },
    { label: "Ready To Send", completed: readyToSend, detail: statusLabel(application.visaStatus) },
    { label: "Payment Visa", completed: paymentCompleted, detail: statusLabel(application.paymentStatus) },
    { label: "Visa Submitted", completed: visaSubmitted, detail: statusLabel(application.visaStatus) },
    { label: "Visa Issued", completed: visaIssued, detail: statusLabel(application.visaStatus) },
  ];
}

export function getBlockingIssue(application: VisaApplication): BlockingIssue | null {
  if (application.documentStatus === "WAITING_DOCUMENT") {
    return {
      reason: "Dokumen atau passport belum lengkap diterima.",
      responsible: "Agent & Visa Team",
      eta: "Menunggu kelengkapan dokumen",
      tone: "attention",
    };
  }
  if (application.documentStatus === "NEED_REVISION") {
    return {
      reason: application.adminNote || "Dokumen membutuhkan perbaikan atau penggantian.",
      responsible: "Agent",
      eta: "Setelah dokumen diperbarui",
      tone: "attention",
    };
  }
  if (application.agreementStatus === "WAITING_APPROVAL") {
    return {
      reason: "Hotel Agreement belum disetujui.",
      responsible: "Hotel Team",
      eta: "Belum tersedia",
      tone: "attention",
    };
  }
  if (application.nusukStatus !== "GROUP_CREATED") {
    return {
      reason: "Entry jamaah atau pembentukan group Nusuk belum selesai.",
      responsible: "Visa Team",
      eta: "Belum tersedia",
      tone: "waiting",
    };
  }
  if (application.paymentStatus === "WAITING_PAYMENT") {
    return {
      reason: "Pembayaran visa belum diterima atau dikonfirmasi.",
      responsible: "Finance / Agent",
      eta: "Setelah pembayaran dikonfirmasi",
      tone: "attention",
    };
  }
  if (application.visaStatus === "PROCESSING") {
    return {
      reason: "Pengajuan sedang diproses oleh pihak Saudi.",
      responsible: "Visa Team",
      eta: "Menunggu hasil pemrosesan",
      tone: "waiting",
    };
  }
  return null;
}

export function getCurrentStepLabels(steps: WorkflowStep[]): string[] {
  if (!steps[0].completed) return [steps[0].label];
  if (!steps[1].completed) return [steps[1].label];
  const parallel = steps
    .slice(2, 4)
    .filter((step) => !step.completed)
    .map((step) => step.label);
  if (parallel.length > 0) return parallel;
  const next = steps.slice(4).find((step) => !step.completed);
  return next ? [next.label] : [];
}

function stepState(step: WorkflowStep, currentLabels: readonly string[]): StepState {
  if (step.completed) return "completed";
  return currentLabels.includes(step.label) ? "current" : "pending";
}

function workflowProgress(application: VisaApplication) {
  const steps = buildWorkflow(application);
  const completed = steps.filter((step) => step.completed).length;
  return { steps, completed, progress: Math.round((completed / steps.length) * 100) };
}

function applicationNeedsAttention(application: VisaApplication): boolean {
  return getBlockingIssue(application)?.tone === "attention";
}

function compactApplicationNumber(value: string): string {
  return value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-7)}` : value;
}

export function VisaApplicationsPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<WorklistFilter>("all");
  const query = useQuery({
    queryKey: agentQueryKeys.visaApplications(principalId),
    queryFn: () => portalGet<VisaApplication[]>(client, "/visa-applications"),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const applications = query.data ?? [];
  const filteredApplications = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return applications.filter((application) => {
      const { progress } = workflowProgress(application);
      const matchesFilter =
        filter === "all" ||
        (filter === "attention" && applicationNeedsAttention(application)) ||
        (filter === "completed" && progress === 100);
      const matchesSearch =
        !needle ||
        [application.applicationNumber, application.packageName, application.departureCity]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      return matchesFilter && matchesSearch;
    });
  }, [applications, filter, search]);
  const selected = applications.find((application) => application.id === selectedId) ?? filteredApplications[0];
  const completedCount = applications.filter((application) => workflowProgress(application).progress === 100).length;
  const attentionCount = applications.filter(applicationNeedsAttention).length;
  const onTrackCount = Math.max(0, applications.length - completedCount - attentionCount);

  if (query.isPending) return <LoadingState label="Memuat Visa Process Tracker..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;

  return (
    <div className="mx-auto max-w-[96rem] space-y-5 px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <header className="serene-page-toolbar pr-14">
        <div className="min-w-0">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Visa Operations</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Visa Process Tracker</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Workflow, hambatan, PIC, dan kesiapan dokumen dalam satu workspace.
          </p>
        </div>
        <button
          type="button"
          className="serene-btn-secondary"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <span className={`material-symbols-outlined text-lg ${query.isFetching ? "animate-spin" : ""}`}>refresh</span>
          <span className="hidden sm:inline">{query.isFetching ? "Memperbarui..." : "Refresh"}</span>
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Visa process summary">
        <SummaryCard icon="folder_open" label="Active Applications" value={applications.length} tone="primary" />
        <SummaryCard icon="schedule" label="On Track" value={onTrackCount} tone="info" />
        <SummaryCard icon="report" label="Need Attention" value={attentionCount} tone="warning" />
        <SummaryCard icon="verified" label="Visa Issued" value={completedCount} tone="success" />
      </section>

      {applications.length === 0 ? (
        <div className="serene-empty-state">
          <span className="material-symbols-outlined text-4xl">inventory_2</span>
          <h2 className="mt-3 text-xl font-bold">Belum ada proses visa</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Tracker muncul setelah tim Ops membuat pengajuan visa untuk agent Anda.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside
            className="serene-card overflow-hidden rounded-3xl xl:sticky xl:top-5"
            aria-label="Visa application worklist"
          >
            <div className="border-b border-outline-variant/25 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">Group Worklist</p>
                  <h2 className="mt-1 text-lg font-extrabold">Your Applications</h2>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-extrabold text-primary">
                  {filteredApplications.length}
                </span>
              </div>
              <label className="serene-page-search mt-4" aria-label="Search visa applications">
                <span className="material-symbols-outlined text-on-surface-variant/60">search</span>
                <input
                  className="serene-page-search-input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search group or package..."
                />
              </label>
              <div className="mt-3 grid grid-cols-3 rounded-xl bg-surface-container-low p-1">
                {(["all", "attention", "completed"] as WorklistFilter[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`rounded-lg px-2 py-2 text-[11px] font-extrabold transition ${filter === value ? "bg-surface-container-lowest text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"}`}
                    onClick={() => setFilter(value)}
                  >
                    {value === "all" ? "All" : value === "attention" ? "Attention" : "Issued"}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[36rem] space-y-2 overflow-y-auto p-3">
              {filteredApplications.length ? (
                filteredApplications.map((application) => (
                  <WorklistCard
                    key={application.id}
                    application={application}
                    selected={selected?.id === application.id}
                    onSelect={() => setSelectedId(application.id)}
                  />
                ))
              ) : (
                <div className="px-3 py-10 text-center">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">search_off</span>
                  <p className="mt-2 text-sm font-bold">Tidak ada aplikasi yang cocok.</p>
                </div>
              )}
            </div>
          </aside>

          {selected ? <VisaProcessWorkspace application={selected} /> : null}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  tone: "primary" | "info" | "warning" | "success";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    info: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  };
  return (
    <article className="serene-card flex items-center gap-3 rounded-2xl p-4 sm:p-5">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </span>
      <div className="min-w-0">
        <strong className="block text-2xl font-extrabold leading-none">{value}</strong>
        <span className="mt-1 block text-[9px] font-bold uppercase leading-tight tracking-[0.08em] text-on-surface-variant sm:text-xs">
          {label}
        </span>
      </div>
    </article>
  );
}

function WorklistCard({
  application,
  selected,
  onSelect,
}: {
  application: VisaApplication;
  selected: boolean;
  onSelect: () => void;
}) {
  const { completed, steps, progress } = workflowProgress(application);
  const blocker = getBlockingIssue(application);
  const currentLabels = getCurrentStepLabels(steps);
  return (
    <button
      type="button"
      className={`w-full rounded-2xl border p-3.5 text-left transition ${selected ? "border-primary/40 bg-primary/8 shadow-sm" : "border-outline-variant/25 bg-surface-container-lowest hover:border-primary/25 hover:bg-surface-container-low"}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-on-surface" title={application.applicationNumber}>
            {compactApplicationNumber(application.applicationNumber)}
          </p>
          <p className="mt-1 truncate text-xs font-medium text-on-surface-variant">{application.packageName}</p>
        </div>
        <span
          className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${blocker?.tone === "attention" ? "bg-amber-100 text-amber-800" : progress === 100 ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}
        >
          {progress}%
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-container-high">
        <div
          className={`h-full rounded-full ${blocker?.tone === "attention" ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-on-surface-variant">
        <span>
          {completed}/{steps.length} steps
        </span>
        <span>{application.passengerCount} pax</span>
      </div>
      <div
        className={`mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-bold ${blocker?.tone === "attention" ? "bg-amber-50 text-amber-800" : "bg-surface-container-low text-on-surface-variant"}`}
      >
        <span className="material-symbols-outlined text-sm">
          {blocker?.tone === "attention" ? "warning" : "arrow_forward"}
        </span>
        <span className="truncate">{(blocker?.reason ?? currentLabels.join(" & ")) || "Process completed"}</span>
      </div>
    </button>
  );
}

function VisaProcessWorkspace({ application }: { application: VisaApplication }) {
  const { steps, completed, progress } = workflowProgress(application);
  const currentLabels = getCurrentStepLabels(steps);
  const currentStep = currentLabels.length ? currentLabels.join(" & ") : "Completed";
  const blocker = getBlockingIssue(application);
  const documentsByType = new Map(application.documents.map((document) => [document.type, document]));
  const missingDocuments = requiredDocumentTypes.filter((type) => !documentsByType.has(type)).length;
  const revisionDocuments = application.documents.filter((document) =>
    ["NEED_REVISION", "REJECTED"].includes(document.status),
  ).length;

  return (
    <section className="min-w-0 space-y-5" aria-label={`Visa workflow ${application.applicationNumber}`}>
      <article className="serene-card overflow-hidden rounded-3xl">
        <div className="relative overflow-hidden bg-primary px-5 py-6 text-on-primary sm:px-7">
          <span className="material-symbols-outlined absolute -bottom-8 -right-5 text-[9rem] text-on-primary/10">
            travel_explore
          </span>
          <div className="relative grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-surface-container-lowest/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]">
                  Selected Application
                </span>
                <span className="rounded-lg bg-surface-container-lowest/15 px-2.5 py-1 text-[10px] font-bold">
                  Updated {formatDate(application.updatedAt)}
                </span>
              </div>
              <h2 className="mt-4 break-words font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
                {application.applicationNumber}
              </h2>
              <p className="mt-1 text-sm font-semibold text-on-primary/80">
                {application.packageName} · {application.passengerCount} pax
              </p>
              <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-on-primary/65">
                    Current Step
                  </span>
                  <strong className="mt-1 block">{currentStep}</strong>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-on-primary/65">
                    Departure
                  </span>
                  <strong className="mt-1 block">{formatDate(application.departureDate)}</strong>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-on-primary/65">
                    Destination
                  </span>
                  <strong className="mt-1 block">{application.departureCity}</strong>
                </div>
              </div>
            </div>
            <div className="flex min-w-[12rem] items-center gap-4 rounded-2xl bg-surface-container-lowest/12 p-4 backdrop-blur-sm">
              <strong className="text-4xl font-black">{progress}%</strong>
              <div>
                <p className="text-xs font-black uppercase tracking-wider">Visa Progress</p>
                <p className="mt-1 text-xs font-semibold text-on-primary/75">
                  {completed} of {steps.length} steps complete
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="p-5 sm:p-7" aria-labelledby="workflow-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-primary">End-to-end Workflow</p>
              <h3 id="workflow-heading" className="mt-1 text-xl font-extrabold">
                Visa Journey
              </h3>
            </div>
            <span className="rounded-lg bg-surface-container-low px-2.5 py-1 text-xs font-bold text-on-surface-variant">
              {statusLabel(application.status)}
            </span>
          </div>
          <div className="mt-6 hidden overflow-x-auto pb-2 sm:block">
            <ol className="grid grid-cols-8" style={{ minWidth: "704px" }}>
              {steps.map((step, index) => {
                const state = stepState(step, currentLabels);
                return <WorkflowNode key={step.label} step={step} state={state} last={index === steps.length - 1} />;
              })}
            </ol>
          </div>
          <ol className="mt-5 space-y-0 sm:hidden">
            {steps.map((step, index) => {
              const state = stepState(step, currentLabels);
              return (
                <MobileWorkflowNode key={step.label} step={step} state={state} last={index === steps.length - 1} />
              );
            })}
          </ol>
        </section>
      </article>

      <section
        className={`rounded-3xl border p-5 sm:p-6 ${blocker?.tone === "attention" ? "border-amber-300 bg-amber-50 text-amber-950" : "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100"}`}
        aria-label="Current process status"
      >
        <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
          <div className="flex gap-3">
            <span
              className={`material-symbols-outlined mt-0.5 ${blocker?.tone === "attention" ? "text-amber-600" : "text-sky-600"}`}
            >
              {blocker?.tone === "attention" ? "warning" : "hourglass_top"}
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em]">
                {blocker?.tone === "attention" ? "Current Blocking Issue" : "Current Process"}
              </p>
              <h3 className="mt-1 text-lg font-extrabold">{blocker?.reason ?? "Seluruh proses visa telah selesai."}</h3>
              {application.adminNote ? (
                <p className="mt-2 text-sm font-semibold opacity-75">Catatan tim: {application.adminNote}</p>
              ) : null}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-white/55 p-4 text-sm dark:bg-black/10">
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider opacity-60">Responsible</dt>
              <dd className="mt-1 font-extrabold">{blocker?.responsible ?? "Visa Team"}</dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider opacity-60">ETA</dt>
              <dd className="mt-1 font-extrabold">{blocker?.eta ?? "Completed"}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <article className="serene-card rounded-3xl p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">Readiness Check</p>
              <h3 className="mt-1 text-xl font-extrabold">Required Documents</h3>
            </div>
            <div className="flex gap-2">
              <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                {missingDocuments} missing
              </span>
              <span className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                {revisionDocuments} revision
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {requiredDocumentTypes.map((type) => {
              const document = documentsByType.get(type);
              const ready = document && ["VERIFIED", "APPROVED"].includes(document.status);
              const revision = document && ["NEED_REVISION", "REJECTED"].includes(document.status);
              return (
                <div key={type} className="flex items-start gap-3 rounded-2xl bg-surface-container-low p-4">
                  <span
                    className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ready ? "bg-emerald-100 text-emerald-700" : revision ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {ready ? "check_circle" : revision ? "error" : document ? "schedule" : "upload_file"}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold">{documentLabels[type]}</p>
                    <p className="mt-1 truncate text-xs font-semibold text-on-surface-variant">
                      {document ? statusLabel(document.status) : "Not uploaded"}
                    </p>
                    {document?.reviewNote ? <p className="mt-2 text-xs text-rose-700">{document.reviewNote}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <article className="serene-card rounded-3xl p-5 sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-primary">Application Detail</p>
          <h3 className="mt-1 text-xl font-extrabold">Process Information</h3>
          <dl className="mt-5 space-y-4">
            <DetailRow label="Provider" value={application.providerName || "Belum ditentukan"} />
            <DetailRow label="Nusuk Group" value={application.nusukGroupNumber || "Belum tersedia"} />
            <DetailRow label="Nusuk Reference" value={application.nusukReferenceNumber || "Belum tersedia"} />
            <DetailRow
              label="Travel Period"
              value={`${formatDate(application.departureDate)} – ${formatDate(application.returnDate)}`}
            />
            <DetailRow
              label="Submitted"
              value={application.submittedAt ? formatDate(application.submittedAt) : "Belum dikirim"}
            />
          </dl>
        </article>
      </section>
    </section>
  );
}

function WorkflowNode({ step, state, last }: { step: WorkflowStep; state: StepState; last: boolean }) {
  const circleClass =
    state === "completed"
      ? "border-primary bg-primary text-on-primary"
      : state === "current"
        ? "border-amber-500 bg-amber-100 text-amber-800"
        : "border-outline-variant bg-surface-container-lowest text-on-surface-variant";
  return (
    <li className="relative min-w-0 px-1 text-center">
      {!last ? (
        <span
          className={`absolute left-1/2 top-[1.15rem] h-0.5 w-full ${state === "completed" ? "bg-primary" : "bg-outline-variant/45"}`}
          aria-hidden="true"
        />
      ) : null}
      <div className="relative z-10 mx-auto flex w-fit flex-col items-center">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 ${circleClass}`}>
          <span className="material-symbols-outlined text-lg">
            {state === "completed" ? "check" : state === "current" ? "more_horiz" : "circle"}
          </span>
        </span>
        <span
          className={`mt-3 text-[10px] font-black uppercase tracking-wider ${state === "current" ? "text-amber-700" : state === "completed" ? "text-primary" : "text-on-surface-variant/60"}`}
        >
          {state}
        </span>
        <strong className="mt-1 text-xs leading-tight text-on-surface">{step.label}</strong>
        <span className="mt-1 text-[10px] leading-tight text-on-surface-variant">{step.detail}</span>
      </div>
    </li>
  );
}

function MobileWorkflowNode({ step, state, last }: { step: WorkflowStep; state: StepState; last: boolean }) {
  const circleClass =
    state === "completed"
      ? "border-primary bg-primary text-on-primary"
      : state === "current"
        ? "border-amber-500 bg-amber-100 text-amber-800"
        : "border-outline-variant bg-surface-container-lowest text-on-surface-variant";
  return (
    <li className={`relative flex gap-3 pb-4 ${state === "current" ? "rounded-2xl bg-amber-50 p-3" : "px-3"}`}>
      {!last ? (
        <span
          className={`absolute bottom-0 left-[1.78rem] top-9 w-0.5 ${state === "completed" ? "bg-primary" : "bg-outline-variant/45"}`}
          aria-hidden="true"
        />
      ) : null}
      <span
        className={`relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${circleClass}`}
      >
        <span className="material-symbols-outlined text-lg">
          {state === "completed" ? "check" : state === "current" ? "more_horiz" : "circle"}
        </span>
      </span>
      <div className="min-w-0 pt-0.5">
        <span
          className={`text-[10px] font-black uppercase tracking-wider ${state === "current" ? "text-amber-700" : state === "completed" ? "text-primary" : "text-on-surface-variant/60"}`}
        >
          {state}
        </span>
        <p className="mt-0.5 font-extrabold text-on-surface">{step.label}</p>
        <p className="mt-0.5 text-xs text-on-surface-variant">{step.detail}</p>
      </div>
    </li>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-outline-variant/20 pb-3 last:border-0 last:pb-0">
      <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
      <dd className="max-w-[65%] text-right text-sm font-extrabold text-on-surface">{value}</dd>
    </div>
  );
}
