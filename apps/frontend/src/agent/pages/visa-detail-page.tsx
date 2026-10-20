import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageLayout } from "../../components/page-layout";
import { PageHeader } from "../../components/page-header";
import { Button } from "../../components/button";
import { DetailItem } from "../../components/detail-list";
import { Icon } from "../../components/icon";
import { ReadOnlyIndicator } from "../../components/read-only-indicator";
import { StatusBadge } from "../../components/status-badge";
import type { GroupAgreementHotel, GroupData } from "../../shared/app-domain";
import { ErrorState, LoadingState } from "../components/data-state";
import type { VisaApplication, VisaApplicationDocument } from "../data/contracts";
import { useAgentGroupData } from "../data/use-agent-group-data";
import { useAgentVisaApplications } from "../data/use-agent-visa-applications";
import { buildVisaProcessStages, currentVisaProcessStage, type VisaProcessStage } from "../data/visa-process";
import { AgentVisaFlights } from "../components/agent-visa-flights";

const documentType: Record<VisaApplicationDocument["type"], string> = {
  PASSPORT: "Paspor",
  VACCINE_CERTIFICATE: "Sertifikat vaksin",
  MANIFEST: "Manifest jamaah",
  PACKAGE_INFORMATION: "Informasi paket",
};
const expectedDocumentTypes = Object.keys(documentType) as VisaApplicationDocument["type"][];

export function formatVisaDate(value: string | undefined | null): string {
  if (!value) return "Belum tercatat";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Belum tercatat";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(parsed);
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
      (item) =>
        item.id === identity ||
        item.applicationNumber === identity ||
        item.group?.code === identity ||
        item.groupId === identity,
    ) ?? null;
  const group =
    groupsQuery.data?.find(
      (item) =>
        item.code === identity ||
        item.id === identity ||
        item.id === application?.groupId ||
        item.code === application?.group?.code,
    ) ?? null;
  const from = (location.state as { from?: unknown } | null)?.from;
  const backTarget = typeof from === "string" && from.startsWith("/agent/visa") ? from : "/agent/visa";
  const number = application?.nusukGroupNumber?.trim() || group?.code || application?.applicationNumber;

  useEffect(() => {
    if (number) document.title = `${number} | Visa Tracking Portal Agent`;
  }, [number]);

  const retry = () => void Promise.all([groupsQuery.refetch(), applicationsQuery.refetch()]);
  if (groupsQuery.isPending || applicationsQuery.isPending) return <LoadingState label="Memuat detail visa..." />;
  if (groupsQuery.isError || applicationsQuery.isError) return <ErrorState retry={retry} />;
  if (!group && !application) {
    return (
      <PageLayout>
        <Button variant="secondary" className="w-fit" onClick={() => navigate(backTarget, { viewTransition: true })}>
          <Icon name="arrow_back" />
          Kembali ke Visa Tracking
        </Button>
        <PageHeader
          variant="compact"
          title="Detail visa tidak ditemukan"
          description="Data mungkin tidak tersedia atau bukan bagian dari akun Agent ini."
        />
      </PageLayout>
    );
  }

  const name = group?.name ?? application?.group?.name ?? application?.packageName;
  const pax = group?.pax ?? application?.passengerCount;
  const familyRole = group?.parentGroupId
    ? "Child"
    : group?.id && groupsQuery.data?.some((member) => member.parentGroupId === group.id)
      ? "Parent"
      : null;
  const startDate = application?.departureDate || group?.arrivalDate;
  const returnDate = group?.returnDate || application?.returnDate;
  return (
    <PageLayout width="workspace" className="agent-visa-detail-page agent-visa-admin-aligned agent-page-layout">
      <Button
        variant="secondary"
        className="visa-detail-back w-fit"
        onClick={() => navigate(backTarget, { viewTransition: true })}
      >
        <Icon name="arrow_back" />
        Kembali ke Visa Tracking
      </Button>
      <PageHeader
        variant="detail"
        className="visa-detail-header"
        title={<span className="break-all tabular-nums">{number}</span>}
        description={<strong className="break-words text-on-surface">{name}</strong>}
        actions={
          <>
            <ReadOnlyIndicator label="Hanya lihat" />
            {group ? (
              <Link
                viewTransition
                className="visa-detail-primary-action"
                to={`/agent/groups/${encodeURIComponent(group.code)}`}
                state={{ from: "/agent/visa" }}
              >
                <Icon name="travel_explore" />
                Detail perjalanan
              </Link>
            ) : null}
          </>
        }
      >
        <div className="visa-detail-meta">
          {familyRole ? <span className="visa-detail-role">{familyRole}</span> : null}
          <span className="visa-detail-pax">{pax} Pax Total</span>
          <span>
            {formatVisaDate(startDate)} {"\u2013"} {formatVisaDate(returnDate)}
          </span>
          <span>{group?.packageName || application?.packageName || "Paket belum tercatat"}</span>
        </div>
      </PageHeader>
      <VisaWorkflow key={group?.id ?? application?.id ?? identity} application={application} group={group} />
    </PageLayout>
  );
}

function VisaWorkflow({ application, group }: { application: VisaApplication | null; group: GroupData | null }) {
  const stages = buildVisaProcessStages(application, group);
  const current = currentVisaProcessStage(stages);
  const [expanded, setExpanded] = useState<string[]>(() => (current.id === "nusuk" ? [] : [current.id]));
  const headingButtons = useRef<Record<string, HTMLButtonElement | null>>({});
  const toggle = (id: string) =>
    setExpanded((old) => (old.includes(id) ? old.filter((item) => item !== id) : [...old, id]));
  const reveal = (id: string) => {
    setExpanded((old) => (old.includes(id) ? old : [...old, id]));
    headingButtons.current[id]?.focus({ preventScroll: true });
    headingButtons.current[id]?.scrollIntoView?.({ block: "nearest", behavior: "auto" });
  };
  return (
    <>
      <DocumentAttention application={application} />

      <nav className="visa-stage-overview visa-status-grid" aria-label="Empat tahap visa">
        <ol>
          {stages.map((stage, index) => (
            <li key={stage.id}>
              <button
                type="button"
                className={`visa-stage-shortcut${stage.id === current.id ? " is-current" : ""}`}
                aria-label={`Lihat tahap ${index + 1}: ${stage.label}, ${stage.status}`}
                aria-controls={`visa-panel-${stage.id}`}
                onClick={() => reveal(stage.id)}
              >
                <span className="visa-stage-shortcut-copy">
                  <strong>{["Dokumen", "Agreement hotel", "Nusuk", "Status visa"][index]}</strong>
                  <StatusBadge tone={stage.tone}>{shortStatus(stage)}</StatusBadge>
                </span>
                <span className="visa-status-card-icon" aria-hidden="true">
                  {stage.id === "visa" ? index + 1 : <Icon name={stageIcon(stage.id)} />}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="visa-overview-grid">
        <DocumentReadiness application={application} />
        <VisaFacts application={application} group={group} />
      </div>

      <AgentVisaFlights visa={group?.visaSetup} />

      <section className="visa-agreement-summary" aria-labelledby="visa-agreement-title">
        <h2 id="visa-agreement-title" className="sr-only">
          Agreement hotel
        </h2>
        <HotelData group={group} />
      </section>
      <section className="visa-process-details visa-detail-surface" aria-label="Alur proses visa">
        <header className="visa-section-header visa-process-details-header">
          <div>
            <h2>Rincian proses</h2>
            <p>Buka setiap tahap untuk melihat data sumber dan status lengkap.</p>
          </div>
        </header>
        <ol>
          {stages.map((stage, index) => {
            const open = expanded.includes(stage.id);
            return (
              <li
                key={stage.id}
                className={`visa-process-row is-${stage.id}${stage.id === current.id ? " is-current" : ""}`}
              >
                <h2>
                  <button
                    type="button"
                    id={`visa-stage-${stage.id}`}
                    ref={(element) => {
                      headingButtons.current[stage.id] = element;
                    }}
                    className="visa-process-toggle"
                    aria-expanded={open}
                    aria-controls={`visa-panel-${stage.id}`}
                    onClick={() => toggle(stage.id)}
                  >
                    <StageMarker stage={stage} index={index} />
                    <span className="visa-process-heading">
                      <strong>{stage.label}</strong>
                    </span>
                    <StatusBadge tone={stage.tone} className="visa-process-status">
                      {stage.status}
                    </StatusBadge>
                    <Icon name="expand_more" className={open ? "visa-chevron is-open" : "visa-chevron"} />
                  </button>
                </h2>
                <div id={`visa-panel-${stage.id}`} className="visa-process-panel" hidden={!open}>
                  {stage.id === "document" ? (
                    <a className="visa-process-reference" href="#visa-document-title">
                      Lihat kesiapan dokumen
                      <Icon name="arrow_forward" />
                    </a>
                  ) : null}
                  {stage.id === "agreement" ? (
                    <a className="visa-process-reference" href="#visa-agreement-title">
                      Lihat agreement hotel
                      <Icon name="arrow_forward" />
                    </a>
                  ) : null}
                  {stage.id === "nusuk" ? (
                    <p className="visa-detail-note">
                      {!application
                        ? "Status upload paspor belum tercatat."
                        : application.nusukStatus === "NOT_STARTED"
                          ? "Upload paspor ke Nusuk belum dimulai."
                          : application.nusukStatus === "PASSENGER_ENTRY"
                            ? "Data paspor jamaah sedang diunggah ke Nusuk."
                            : application.nusukStatus === "GROUP_CREATED"
                              ? "Group telah dibuat di Nusuk."
                              : "Data paspor jamaah sudah tercatat di Nusuk."}
                    </p>
                  ) : null}
                  {stage.id === "visa" ? (
                    <dl className="visa-detail-pairs">
                      <DetailValue label="Status visa" value={stage.status} />
                      <DetailValue label="Tanggal terbit" value={formatVisaDate(group?.visaSetup?.issuedDate)} />
                      {application?.submittedAt ? (
                        <DetailValue label="Tanggal pengajuan" value={formatVisaDate(application.submittedAt)} />
                      ) : null}
                      {application?.completedAt ? (
                        <DetailValue label="Tanggal selesai" value={formatVisaDate(application.completedAt)} />
                      ) : null}
                    </dl>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

function DocumentAttention({ application }: { application: VisaApplication | null }) {
  const records = expectedDocumentTypes.map((type) => ({
    type,
    document: application?.documents.find((item) => item.type === type) ?? null,
  }));
  const revisions = records.filter((item) => item.document?.status === "NEED_REVISION");
  const missing = records.filter((item) => !item.document || item.document.status === "WAITING_DOCUMENT");
  const complete = records.every((item) => item.document?.status === "VERIFIED");
  const summary = !application
    ? "Pengajuan dokumen belum tercatat untuk group ini."
    : revisions.length
      ? `${revisions.map((item) => documentType[item.type]).join(", ")} perlu direvisi.`
      : missing.length
        ? `${missing.map((item) => documentType[item.type]).join(", ")} belum siap.`
        : "Seluruh dokumen sudah terverifikasi dan siap digunakan.";

  return (
    <aside className="visa-document-alert" data-tone={complete ? "complete" : "attention"}>
      <span className="visa-document-alert-icon" aria-hidden="true">
        <Icon name={complete ? "check" : "description"} />
      </span>
      <div>
        <strong>{complete ? "Dokumen siap" : "Dokumen perlu perhatian"}</strong>
        <p>{summary}</p>
      </div>
      <a href="#visa-document-title">Lihat kesiapan dokumen</a>
    </aside>
  );
}

function DocumentReadiness({ application }: { application: VisaApplication | null }) {
  const records = expectedDocumentTypes.map((type) => ({
    type,
    document: application?.documents.find((item) => item.type === type) ?? null,
  }));
  const verified = records.filter((item) => item.document?.status === "VERIFIED");
  const revisionCount = records.filter((item) => item.document?.status === "NEED_REVISION").length;
  const waitingCount = records.length - verified.length - revisionCount;

  return (
    <section className="visa-document-readiness visa-detail-surface" aria-labelledby="visa-document-title">
      <header className="visa-section-header">
        <div>
          <h2 id="visa-document-title">Kesiapan dokumen</h2>
          <p>Berkas yang sudah diverifikasi dan yang perlu ditindaklanjuti.</p>
        </div>
        <p className="visa-document-counts" aria-label="Ringkasan kesiapan dokumen">
          <strong>
            {verified.length} dari {records.length} siap
          </strong>
          <span className="sr-only">
            {verified.length} terverifikasi {"\u00b7"} {revisionCount} perlu revisi {"\u00b7"} {waitingCount} belum siap
          </span>
        </p>
      </header>
      {!application ? (
        <p className="visa-detail-note visa-document-empty">
          Pengajuan dokumen belum tercatat. Status ini tidak berarti dokumen sudah lengkap.
        </p>
      ) : null}
      <ul className="visa-document-table">
        {records.map(({ type, document }) => {
          const status = document?.status;
          const statusTone = status === "VERIFIED" ? "complete" : status === "NEED_REVISION" ? "attention" : "neutral";
          return (
            <li key={type}>
              <span className="visa-document-icon" aria-hidden="true">
                <Icon name="description" />
              </span>
              <div className="visa-document-copy">
                <strong>{documentType[type]}</strong>
                <span>{document?.originalName || "Berkas belum tersedia"}</span>
                {document?.reviewNote ? <p>Catatan pemeriksaan: {document.reviewNote}</p> : null}
              </div>
              <StatusBadge tone={statusTone}>{status ? documentStatusLabel(status) : "Belum tersedia"}</StatusBadge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function VisaFacts({ application, group }: { application: VisaApplication | null; group: GroupData | null }) {
  const visa = group?.visaSetup;
  const payment = paymentLabel(visa?.paymentStatus, application?.paymentStatus);
  const paymentState = application?.paymentStatus ?? visa?.paymentStatus;
  const paymentTone =
    paymentState === "COMPLETED" || paymentState === "Paid"
      ? "complete"
      : paymentState === "WAITING_PAYMENT" || paymentState === "Unpaid" || paymentState === "Partial"
        ? "waiting"
        : "neutral";
  const travelLink = group ? (
    <Link
      viewTransition
      className="visa-detail-travel-link"
      to={`/agent/groups/${encodeURIComponent(group.code)}`}
      state={{ from: "/agent/visa" }}
    >
      <Icon name="luggage" />
      Lihat detail perjalanan
      <Icon name="arrow_forward" />
    </Link>
  ) : null;
  return (
    <section className="visa-facts visa-detail-surface" aria-labelledby="visa-facts-title">
      <header className="visa-section-header">
        <div>
          <h2 id="visa-facts-title">Data pengajuan</h2>
          <p>Informasi tercatat untuk group ini.</p>
        </div>
      </header>
      <dl className="visa-facts-list">
        <FactValue label="Jenis visa" value={visa?.busStatus || "Belum tercatat"} />
        <FactValue label="Syarikah" value={visa?.syarikah || application?.providerName || "Belum tercatat"} />
        <FactValue label="Pembayaran" value={<StatusBadge tone={paymentTone}>{payment}</StatusBadge>} />
        <FactValue label="Tanggal terbit" value={formatVisaDate(visa?.issuedDate)} />
      </dl>
      {travelLink}
    </section>
  );
}

function HotelData({ group }: { group: GroupData | null }) {
  const visa = group?.visaSetup;
  return (
    <div className="visa-hotel-grid">
      {(["Makkah", "Madinah"] as const).map((city) => {
        const hotels = city === "Makkah" ? visa?.makkahHotels : visa?.madinahHotels;
        const waived = city === "Makkah" ? visa?.makkahHotelWaived : visa?.madinahHotelWaived;
        return <HotelCityCard key={city} city={city} hotels={hotels ?? []} waived={Boolean(waived)} />;
      })}
    </div>
  );
}

function HotelCityCard({
  city,
  hotels,
  waived,
}: {
  city: "Makkah" | "Madinah";
  hotels: GroupAgreementHotel[];
  waived: boolean;
}) {
  const rejected = hotels.some((hotel) => hotel.status === "Rejected");
  const waiting = hotels.some((hotel) => hotel.status === "Waiting for Approval");
  const tone =
    waived || (hotels.length > 0 && !rejected && !waiting)
      ? "complete"
      : rejected
        ? "attention"
        : waiting
          ? "waiting"
          : "neutral";
  const status = waived
    ? "Tidak diperlukan"
    : rejected
      ? "Ditolak"
      : waiting
        ? "Menunggu"
        : hotels.length
          ? "Disetujui"
          : "Belum tercatat";

  return (
    <section className="visa-hotel-card visa-detail-surface" aria-labelledby={`visa-hotel-${city.toLowerCase()}`}>
      <header>
        <h3 id={`visa-hotel-${city.toLowerCase()}`}>
          <Icon name="apartment" />
          {city}
        </h3>
        <StatusBadge tone={tone}>{status}</StatusBadge>
      </header>
      {waived || !hotels.length ? (
        <div className="visa-hotel-empty">
          <strong>Hotel {city}</strong>
          <p>
            {waived ? "Hotel tidak diperlukan sesuai pengaturan group." : "Belum ada hotel agreement yang tercatat."}
          </p>
        </div>
      ) : (
        <ul>
          {hotels.map((hotel) => (
            <HotelRow key={`${city}-${hotel.id}`} hotel={hotel} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HotelRow({ hotel }: { hotel: GroupAgreementHotel }) {
  const complete = hotel.status === "Approved";
  const label = complete ? "Disetujui" : hotel.status === "Rejected" ? "Ditolak" : "Menunggu persetujuan";
  return (
    <li className="visa-hotel-row">
      <div className="visa-hotel-copy">
        <strong className="visa-hotel-name">{hotel.hotelName}</strong>
        <span>{hotel.agreementNumber || "Nomor agreement belum tercatat"}</span>
      </div>
      <span className="visa-hotel-dates">
        {formatVisaDate(hotel.stayStartIso)} {"\u2013"} {formatVisaDate(hotel.stayEndIso)}
      </span>
      <span className="visa-hotel-pax">{hotel.pax} jamaah</span>
      <StatusBadge
        tone={complete ? "complete" : hotel.status === "Rejected" ? "attention" : "waiting"}
        icon={complete ? "check" : undefined}
      >
        {label}
      </StatusBadge>
    </li>
  );
}

function StageMarker({ stage, index }: { stage: VisaProcessStage; index: number }) {
  return (
    <span className="visa-stage-marker" data-tone={stage.tone} aria-hidden="true">
      {stage.complete ? (
        <Icon name="check" />
      ) : stage.tone === "in-progress" ? (
        <Icon name="schedule" />
      ) : stage.tone === "attention" ? (
        <Icon name="error" />
      ) : (
        index + 1
      )}
    </span>
  );
}
function DetailValue({ label, value }: { label: string; value: React.ReactNode }) {
  return <DetailItem stacked label={label} value={value} />;
}
function FactValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function paymentLabel(
  groupStatus: NonNullable<GroupData["visaSetup"]>["paymentStatus"] | undefined,
  applicationStatus: VisaApplication["paymentStatus"] | undefined,
): string {
  if (applicationStatus === "COMPLETED") return "Selesai";
  if (applicationStatus === "WAITING_PAYMENT") return "Menunggu pembayaran";
  if (applicationStatus === "NOT_STARTED") return "Belum dimulai";
  if (groupStatus === "Paid") return "Lunas";
  if (groupStatus === "Partial") return "Sebagian";
  if (groupStatus === "Unpaid") return "Belum lunas";
  return "Belum tercatat";
}
function documentStatusLabel(status: VisaApplication["documentStatus"]): string {
  return status === "VERIFIED" ? "Terverifikasi" : status === "NEED_REVISION" ? "Perlu revisi" : "Menunggu dokumen";
}
function shortStatus(stage: VisaProcessStage): string {
  const copy: Record<string, string> = {
    "Dokumen terverifikasi": "Terverifikasi",
    "Dokumen perlu revisi": "Perlu revisi",
    "Menunggu dokumen": "Menunggu",
    "Agreement disetujui": "Disetujui",
    "Menunggu persetujuan": "Menunggu",
    "Data paspor tercatat": "Paspor tercatat",
    "Group Nusuk dibuat": "Group dibuat",
    "Upload sedang berlangsung": "Sedang upload",
  };
  return copy[stage.status] ?? stage.status;
}
function stageIcon(id: VisaProcessStage["id"]): string {
  return id === "document" ? "description" : id === "agreement" ? "hotel" : "schedule";
}
