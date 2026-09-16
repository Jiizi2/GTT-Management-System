import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { ReadOnlyIndicator } from "../../components/read-only-indicator";
import { StatusBadge } from "../../components/status-badge";
import type { GroupAgreementHotel, GroupData } from "../../shared/app-domain";
import { ErrorState, LoadingState } from "../components/data-state";
import type { VisaApplication, VisaApplicationDocument, VisaApplicationStatus } from "../data/contracts";
import { useAgentGroupData } from "../data/use-agent-group-data";
import { useAgentVisaApplications } from "../data/use-agent-visa-applications";

type Tone = "complete" | "in-progress" | "waiting" | "attention" | "neutral";

const progressCopy: Record<VisaApplicationStatus, { label: string; description: string; tone: Tone }> = {
  WAITING_DOCUMENT: { label: "Menunggu dokumen", description: "Dokumen pengajuan belum lengkap tercatat.", tone: "waiting" },
  NEED_REVISION: { label: "Dokumen perlu revisi", description: "Ada dokumen yang perlu diperbaiki sebelum proses dilanjutkan.", tone: "attention" },
  DOCUMENT_VERIFIED: { label: "Dokumen terverifikasi", description: "Dokumen telah diperiksa dan proses dapat berlanjut.", tone: "in-progress" },
  WAITING_HOTEL_AGREEMENT: { label: "Menunggu hotel agreement", description: "Proses menunggu persetujuan hotel agreement.", tone: "waiting" },
  PASSENGER_ENTERED: { label: "Data jamaah tercatat", description: "Data jamaah telah dimasukkan ke proses visa.", tone: "in-progress" },
  GROUP_CREATED: { label: "Group Nusuk dibuat", description: "Group untuk proses visa telah dibuat di Nusuk.", tone: "in-progress" },
  READY_TO_SEND: { label: "Siap dikirim", description: "Pengajuan siap diteruskan untuk proses visa.", tone: "in-progress" },
  VISA_SUBMITTED: { label: "Visa diajukan", description: "Pengajuan visa telah dikirim.", tone: "in-progress" },
  PAYMENT_COMPLETED: { label: "Pembayaran selesai", description: "Pembayaran pengajuan telah tercatat selesai.", tone: "in-progress" },
  VISA_PROCESSING: { label: "Visa diproses", description: "Pengajuan sedang diproses oleh tim terkait.", tone: "in-progress" },
  VISA_ISSUED: { label: "Visa terbit", description: "Visa telah diterbitkan.", tone: "complete" },
  COMPLETED: { label: "Selesai", description: "Seluruh proses pengajuan visa telah selesai.", tone: "complete" },
};

const documentType: Record<VisaApplicationDocument["type"], string> = {
  PASSPORT: "Paspor",
  VACCINE_CERTIFICATE: "Sertifikat vaksin",
  MANIFEST: "Manifest jamaah",
  PACKAGE_INFORMATION: "Informasi paket",
};

function formatDate(value: string | undefined | null): string {
  if (!value) return "Belum dicatat";
  const normalized = value.slice(0, 10);
  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Belum dicatat";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(parsed);
}

function fallbackProgress(group: GroupData | null) {
  if (group?.visaSetup?.visaStatus === "Issued") return { label: "Visa terbit", description: "Visa telah diterbitkan.", tone: "complete" as const };
  if (group?.visaSetup?.visaStatus === "Pending") return { label: "Visa diproses", description: "Pengajuan visa sedang diproses.", tone: "in-progress" as const };
  return { label: "Persiapan", description: "Data visa masih dalam tahap persiapan.", tone: "waiting" as const };
}

export function AgentVisaDetailPage({
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
  const identity = useParams().identity ?? "";
  const groupsQuery = useAgentGroupData({ principalId, agentId, agentName });
  const applicationsQuery = useAgentVisaApplications(principalId);
  const application =
    applicationsQuery.data?.find(
      (item) => item.id === identity || item.applicationNumber === identity || item.group?.code === identity || item.groupId === identity,
    ) ?? null;
  const group =
    groupsQuery.data?.find(
      (item) => item.code === identity || item.id === identity || item.id === application?.groupId || item.code === application?.group?.code,
    ) ?? null;
  const from = (location.state as { from?: unknown } | null)?.from;
  const backTarget = typeof from === "string" && from.startsWith("/agent/visa") ? from : "/agent/visa";

  useEffect(() => {
    const title = group?.code ?? application?.applicationNumber;
    if (title) document.title = `${title} | Visa Tracking Portal Agent`;
  }, [application?.applicationNumber, group?.code]);

  const retry = () => void Promise.all([groupsQuery.refetch(), applicationsQuery.refetch()]);
  if (groupsQuery.isPending || applicationsQuery.isPending) return <LoadingState label="Memuat detail visa..." />;
  if (groupsQuery.isError || applicationsQuery.isError) return <ErrorState retry={retry} />;

  if (!group && !application) {
    return (
      <PageLayout>
        <button type="button" className="serene-btn-secondary min-h-11 w-fit" onClick={() => navigate("/agent/visa")}>
          <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>Kembali ke Visa Tracking
        </button>
        <section className="serene-empty-state"><span className="material-symbols-outlined text-4xl text-on-surface-variant/60" aria-hidden="true">approval</span><h1 className="mt-3 text-xl font-bold text-on-surface">Detail visa tidak ditemukan</h1><p className="mt-2 text-sm text-on-surface-variant">Data mungkin tidak tersedia atau bukan bagian dari akun Agent ini.</p></section>
      </PageLayout>
    );
  }

  const progress = application ? progressCopy[application.status] : fallbackProgress(group);
  const code = group?.code ?? application!.applicationNumber;
  const name = group?.name ?? application!.group?.name ?? application!.packageName;
  const pax = group?.pax ?? application!.passengerCount;
  const packageName = group?.packageName || application?.packageName || "Belum dicatat";
  const visa = group?.visaSetup;

  return (
    <PageLayout>
      <button type="button" className="serene-btn-secondary min-h-11 w-fit" onClick={() => navigate(backTarget)}>
        <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>Kembali ke Visa Tracking
      </button>

      <PageHeader variant="detail" title={<span className="break-all">{code}</span>} description={<strong className="break-words text-on-surface">{name}</strong>} actions={<ReadOnlyIndicator label="Read-only" />} />

      <section className="serene-section p-5 sm:p-6" aria-labelledby="visa-progress-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0"><h2 id="visa-progress-title" className="text-xl font-extrabold text-on-surface">Progres pengajuan</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-on-surface-variant">{progress.description}</p></div>
          <StatusBadge tone={progress.tone}>{progress.label}</StatusBadge>
        </div>
        <dl className="mt-5 grid gap-x-6 gap-y-4 border-t border-outline-variant/30 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <DetailValue label="Keberangkatan" value={formatDate(group?.arrivalDate ?? application?.departureDate)} />
          <DetailValue label="Kepulangan" value={formatDate(group?.returnDate ?? application?.returnDate)} />
          <DetailValue label="Jamaah" value={`${pax} jamaah`} />
          <DetailValue label="Paket" value={packageName} />
          <DetailValue label="Jenis visa" value={visa?.busStatus ?? "Belum dicatat"} />
          <DetailValue label="Syarikah" value={visa?.syarikah || application?.providerName || "Belum dicatat"} />
          <DetailValue label="Pembayaran" value={paymentLabel(visa?.paymentStatus, application?.paymentStatus)} />
          <DetailValue label="Tanggal terbit" value={formatDate(visa?.issuedDate)} />
        </dl>
      </section>

      <ApplicationSteps application={application} />
      <DocumentSection application={application} />

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Hotel agreement">
        <HotelSection city="Makkah" hotels={visa?.makkahHotels ?? []} />
        <HotelSection city="Madinah" hotels={visa?.madinahHotels ?? []} />
      </section>
    </PageLayout>
  );
}

function ApplicationSteps({ application }: { application: VisaApplication | null }) {
  if (!application) {
    return <section className="serene-section p-5 sm:p-6" aria-labelledby="stage-title"><h2 id="stage-title" className="text-lg font-extrabold text-on-surface">Tahapan proses</h2><p className="mt-3 rounded-xl bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface-variant">Tahapan dokumen, agreement, Nusuk, dan pengajuan belum dicatat pada sumber pengajuan visa.</p></section>;
  }
  const stages = [
    { label: "Dokumen", value: documentStatusLabel(application.documentStatus) },
    { label: "Hotel agreement", value: enumLabel(application.agreementStatus) },
    { label: "Nusuk", value: enumLabel(application.nusukStatus) },
    { label: "Pengajuan visa", value: enumLabel(application.visaStatus) },
  ];
  return <section className="serene-section p-5 sm:p-6" aria-labelledby="stage-title"><h2 id="stage-title" className="text-lg font-extrabold text-on-surface">Tahapan proses</h2><ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{stages.map((stage, index) => <li key={stage.label} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary tabular-nums">{index + 1}</span><div className="min-w-0"><p className="text-xs font-semibold text-on-surface-variant">{stage.label}</p><p className="mt-1 break-words text-sm font-bold text-on-surface">{stage.value}</p></div></li>)}</ol></section>;
}

function DocumentSection({ application }: { application: VisaApplication | null }) {
  const documents = application?.documents ?? [];
  return (
    <section className="serene-section p-5 sm:p-6" aria-labelledby="document-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="document-title" className="text-lg font-extrabold text-on-surface">Dokumen pengajuan</h2><p className="mt-1 text-sm text-on-surface-variant">Dokumen yang sudah tercatat untuk pengajuan ini.</p></div>{application ? <StatusBadge tone={application.documentStatus === "VERIFIED" ? "complete" : application.documentStatus === "NEED_REVISION" ? "attention" : "waiting"}>{documentStatusLabel(application.documentStatus)}</StatusBadge> : null}</div>
      {!application ? <p className="mt-5 rounded-xl bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface-variant">Pengajuan dokumen belum tercatat. Status ini tidak berarti dokumen sudah lengkap.</p> : documents.length === 0 ? <p className="mt-5 rounded-xl bg-surface-container-low p-4 text-sm leading-relaxed text-on-surface-variant">Belum ada dokumen yang tercatat untuk pengajuan ini.</p> : <ul className="mt-5 divide-y divide-outline-variant/30 border-y border-outline-variant/30">{documents.map((document) => <li key={document.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-extrabold text-on-surface">{documentType[document.type]}</p><p className="mt-1 break-all text-sm text-on-surface-variant">{document.originalName}</p>{document.reviewNote ? <p className="mt-2 text-sm text-on-surface-variant">Catatan pemeriksaan: {document.reviewNote}</p> : null}</div><StatusBadge tone={document.status === "VERIFIED" ? "complete" : document.status === "NEED_REVISION" ? "attention" : "waiting"}>{documentStatusLabel(document.status)}</StatusBadge></li>)}</ul>}
    </section>
  );
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-on-surface-variant">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-on-surface">{value}</dd></div>;
}

function HotelSection({ city, hotels }: { city: string; hotels: GroupAgreementHotel[] }) {
  return <article className="serene-section p-5 sm:p-6"><h2 className="text-lg font-extrabold text-on-surface">Hotel {city}</h2>{hotels.length === 0 ? <p className="mt-4 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Belum ada hotel agreement yang tercatat.</p> : <ul className="mt-4 divide-y divide-outline-variant/30 border-y border-outline-variant/30">{hotels.map((hotel) => <li key={hotel.id} className="py-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><strong className="block break-words text-sm text-on-surface">{hotel.hotelName}</strong><p className="mt-1 break-all text-xs text-on-surface-variant">{hotel.agreementNumber || "Nomor agreement belum dicatat"}</p></div><AgreementBadge status={hotel.status} /></div><p className="mt-3 text-xs font-semibold text-on-surface-variant">{formatDate(hotel.stayStartIso)} – {formatDate(hotel.stayEndIso)} · {hotel.pax} jamaah</p></li>)}</ul>}</article>;
}

function AgreementBadge({ status }: { status: GroupAgreementHotel["status"] }) {
  const tone = status === "Approved" ? "complete" : status === "Rejected" ? "attention" : "waiting";
  const label = status === "Approved" ? "Disetujui" : status === "Rejected" ? "Ditolak" : "Menunggu persetujuan";
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function paymentLabel(groupStatus: NonNullable<GroupData["visaSetup"]>["paymentStatus"] | undefined, applicationStatus: VisaApplication["paymentStatus"] | undefined): string {
  if (applicationStatus === "COMPLETED") return "Selesai";
  if (applicationStatus === "WAITING_PAYMENT") return "Menunggu pembayaran";
  if (applicationStatus === "NOT_STARTED") return "Belum dimulai";
  if (groupStatus === "Paid") return "Lunas";
  if (groupStatus === "Partial") return "Sebagian";
  if (groupStatus === "Unpaid") return "Belum lunas";
  return "Belum dicatat";
}

function documentStatusLabel(status: VisaApplication["documentStatus"]): string {
  return status === "VERIFIED" ? "Terverifikasi" : status === "NEED_REVISION" ? "Perlu revisi" : "Menunggu dokumen";
}

function enumLabel(value: string): string {
  const labels: Record<string, string> = { NOT_STARTED: "Belum dimulai", WAITING_APPROVAL: "Menunggu persetujuan", APPROVED: "Disetujui", PASSENGER_ENTRY: "Input jamaah", PASSENGER_ENTERED: "Data jamaah tercatat", GROUP_CREATED: "Group dibuat", READY_TO_SEND: "Siap dikirim", SUBMITTED: "Sudah diajukan", PROCESSING: "Sedang diproses", ISSUED: "Visa terbit", COMPLETED: "Selesai" };
  return labels[value] ?? value.toLowerCase().replaceAll("_", " ");
}
