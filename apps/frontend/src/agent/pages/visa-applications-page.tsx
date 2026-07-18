import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ErrorState, LoadingState } from "../components/data-state";
import type { VisaApplication } from "../data/contracts";
import { formatDate, statusLabel } from "../data/format";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";

type StepState = "completed" | "current" | "pending";
type WorkflowStep = { label: string; completed: boolean; detail: string };
type BlockingIssue = { reason: string; responsible: string; eta: string };

function hasStatus(value: string, accepted: readonly string[]): boolean {
  return accepted.includes(value);
}

function buildWorkflow(application: VisaApplication): WorkflowStep[] {
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

function getBlockingIssue(application: VisaApplication): BlockingIssue | null {
  if (application.documentStatus === "WAITING_DOCUMENT") {
    return {
      reason: "Dokumen atau passport belum lengkap diterima.",
      responsible: "Agent & Visa Team",
      eta: "Menunggu kelengkapan dokumen",
    };
  }
  if (application.documentStatus === "NEED_REVISION") {
    return {
      reason: application.adminNote || "Dokumen membutuhkan perbaikan atau penggantian.",
      responsible: "Agent",
      eta: "Setelah dokumen diperbarui",
    };
  }
  if (application.agreementStatus === "WAITING_APPROVAL") {
    return { reason: "Hotel Agreement belum disetujui.", responsible: "Hotel Team", eta: "Belum tersedia" };
  }
  if (application.nusukStatus !== "GROUP_CREATED") {
    return {
      reason: "Entry jamaah atau pembentukan group Nusuk belum selesai.",
      responsible: "Visa Team",
      eta: "Belum tersedia",
    };
  }
  if (application.paymentStatus === "WAITING_PAYMENT") {
    return {
      reason: "Pembayaran visa belum diterima atau dikonfirmasi.",
      responsible: "Finance / Agent",
      eta: "Setelah pembayaran dikonfirmasi",
    };
  }
  if (application.visaStatus === "PROCESSING") {
    return {
      reason: "Pengajuan sedang diproses oleh pihak Saudi.",
      responsible: "Visa Team",
      eta: "Menunggu hasil pemrosesan",
    };
  }
  return null;
}

function stepState(steps: WorkflowStep[], index: number): StepState {
  if (steps[index].completed) return "completed";
  return steps.findIndex((step) => !step.completed) === index ? "current" : "pending";
}

export function VisaApplicationsPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: agentQueryKeys.visaApplications(principalId),
    queryFn: () => portalGet<VisaApplication[]>(client, "/visa-applications"),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  if (query.isPending) return <LoadingState label="Memuat Visa Process Tracker..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-20 pt-6">
      <header className="serene-page-toolbar pr-14">
        <div>
          <p className="text-xs font-black uppercase tracking-[.16em] text-primary">Core Agent Feature</p>
          <h1 className="mt-1 text-2xl font-extrabold">Visa Process Tracker</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Posisi workflow, hambatan, PIC, dan langkah berikutnya dalam satu tampilan.
          </p>
        </div>
        <button
          type="button"
          className="serene-btn-secondary"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          {query.isFetching ? "Memperbarui..." : "Refresh"}
        </button>
      </header>

      {query.data.length === 0 ? (
        <div className="serene-empty-state">
          <span className="material-symbols-outlined text-4xl">inventory_2</span>
          <h2 className="mt-3 text-xl font-bold">Belum ada proses visa</h2>
          <p className="mt-2 text-sm text-on-surface-variant">
            Tracker muncul setelah tim Ops membuat pengajuan visa untuk agent Anda.
          </p>
        </div>
      ) : (
        <section className="space-y-6" aria-label="Daftar workflow visa">
          {query.data.map((application) => (
            <VisaProcessCard key={application.id} application={application} />
          ))}
        </section>
      )}
    </div>
  );
}

function VisaProcessCard({ application }: { application: VisaApplication }) {
  const steps = buildWorkflow(application);
  const completed = steps.filter((step) => step.completed).length;
  const progress = Math.round((completed / steps.length) * 100);
  const currentIndex = steps.findIndex((step) => !step.completed);
  const currentStep = currentIndex >= 0 ? steps[currentIndex].label : "Completed";
  const blocker = getBlockingIssue(application);

  return (
    <article className="serene-card overflow-hidden rounded-3xl">
      <div className="grid gap-5 border-b border-outline-variant/20 p-5 lg:grid-cols-[1fr_1.2fr] lg:p-7">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-primary">Group / Application</p>
          <h2 className="mt-2 text-2xl font-extrabold">{application.applicationNumber}</h2>
          <p className="mt-1 font-semibold text-on-surface-variant">{application.packageName}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-on-surface-variant">Jamaah</dt>
              <dd className="font-bold">{application.passengerCount} pax</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Keberangkatan</dt>
              <dd className="font-bold">{formatDate(application.departureDate)}</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Current Step</dt>
              <dd className="font-bold text-primary">{currentStep}</dd>
            </div>
            <div>
              <dt className="text-xs text-on-surface-variant">Updated</dt>
              <dd className="font-bold">{formatDate(application.updatedAt)}</dd>
            </div>
          </dl>
        </div>
        <div className="rounded-2xl bg-surface-container-low p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-on-surface-variant">Visa Progress</p>
              <p className="mt-1 text-sm font-bold">
                {completed} / {steps.length} steps completed
              </p>
            </div>
            <strong className="text-3xl text-primary">{progress}%</strong>
          </div>
          <div
            className="mt-4 h-3 overflow-hidden rounded-full bg-surface-container-high"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress visa ${application.applicationNumber}`}
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-4 text-xs text-on-surface-variant">
            Status keseluruhan: <strong className="text-on-surface">{statusLabel(application.status)}</strong>
          </p>
        </div>
      </div>

      {blocker ? (
        <section
          className="m-5 rounded-2xl border border-amber-300/60 bg-amber-50 p-4 text-amber-900 lg:m-7"
          aria-label="Current blocking issue"
        >
          <div className="flex gap-3">
            <span className="material-symbols-outlined">warning</span>
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em]">Current Blocking Issue</p>
              <p className="mt-1 font-bold">{blocker.reason}</p>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs opacity-70">Responsible</dt>
              <dd className="font-bold">{blocker.responsible}</dd>
            </div>
            <div>
              <dt className="text-xs opacity-70">Estimated Resolution</dt>
              <dd className="font-bold">{blocker.eta}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="p-5 pt-0 lg:p-7 lg:pt-0">
        <h3 className="text-lg font-bold">Timeline</h3>
        <ol className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => {
            const state = stepState(steps, index);
            return (
              <li
                key={step.label}
                className={`rounded-2xl border p-4 ${state === "completed" ? "border-primary/25 bg-primary-fixed/35" : state === "current" ? "border-amber-400 bg-amber-50" : "border-outline-variant/25 bg-surface-container-low"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">
                    {state === "completed"
                      ? "check_circle"
                      : state === "current"
                        ? "pending"
                        : "radio_button_unchecked"}
                  </span>
                  <span className="text-[.65rem] font-black uppercase tracking-wider">{state}</span>
                </div>
                <p className="mt-3 font-bold">{step.label}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{step.detail}</p>
              </li>
            );
          })}
        </ol>
        {application.adminNote ? (
          <p className="mt-5 rounded-xl bg-tertiary-fixed p-4 text-sm font-semibold text-on-tertiary-fixed-variant">
            <strong>Catatan tim:</strong> {application.adminNote}
          </p>
        ) : null}
      </section>
    </article>
  );
}
