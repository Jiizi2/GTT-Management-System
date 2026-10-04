import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { PageLayout } from "../../components/page-layout";
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
        <button type="button" className="serene-btn-secondary min-h-11 w-fit" onClick={() => navigate(backTarget)}>
          <Icon name="arrow_back" />
          Kembali ke Visa Tracking
        </button>
        <section className="serene-empty-state">
          <h1 className="text-xl font-bold text-on-surface">Detail visa tidak ditemukan</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Data mungkin tidak tersedia atau bukan bagian dari akun Agent ini.
          </p>
        </section>
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
    <div className="agent-visa-detail-page">
      <button type="button" className="visa-detail-back" onClick={() => navigate(backTarget)}>
        <Icon name="arrow_back" />
        Kembali ke Visa Tracking
      </button>
      <header className="visa-detail-header">
        <h1>{number}</h1>
        <p className="visa-detail-group-name">{name}</p>
        <div className="visa-detail-meta">
          {familyRole ? <span className="visa-detail-role">{familyRole}</span> : null}
          <span>{pax} jamaah</span>
          <span className="visa-detail-readonly">
            <Icon name="visibility" />
            Hanya lihat
          </span>
        </div>
        <p className="visa-detail-trip">
          <Icon name="calendar_today" />
          <span>
            {application?.departureDate ? "Keberangkatan" : "Awal perjalanan"}: {formatVisaDate(startDate)}
            <span className="visa-detail-trip-separator"> · </span>Kepulangan: {formatVisaDate(returnDate)}
          </span>
          <span className="visa-detail-package">
            {group?.packageName || application?.packageName || "Paket belum tercatat"}
          </span>
        </p>
      </header>
      <VisaWorkflow key={group?.id ?? application?.id ?? identity} application={application} group={group} />
      <AgentVisaFlights visa={group?.visaSetup} />
    </div>
  );
}

function VisaWorkflow({ application, group }: { application: VisaApplication | null; group: GroupData | null }) {
  const stages = buildVisaProcessStages(application, group);
  const current = currentVisaProcessStage(stages);
  const [expanded, setExpanded] = useState<string[]>(() => {
    const initial: string[] = current.id === "nusuk" ? [] : [current.id];
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(min-width: 768px)").matches &&
      current.id !== "agreement"
    )
      initial.push("agreement");
    return initial;
  });
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
      <nav className="visa-stage-overview visa-detail-surface" aria-label="Empat tahap visa">
        <ol>
          {stages.map((stage, index) => (
            <li key={stage.id}>
              <button
                type="button"
                className={`visa-stage-shortcut${stage.id === current.id ? " is-current" : ""}`}
                aria-label={`Lihat tahap ${index + 1}: ${stage.label}, ${stage.status}`}
                aria-controls={`visa-stage-${stage.id}`}
                onClick={() => reveal(stage.id)}
              >
                <StageMarker stage={stage} index={index} />
                <span className="visa-stage-shortcut-copy">
                  <strong>{["Dokumen", "Agreement hotel", "Nusuk", "Visa"][index]}</strong>
                  <span>{shortStatus(stage)}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <VisaFacts application={application} group={group} />
      <section className="visa-process-details visa-detail-surface" aria-label="Alur proses visa">
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
                      <span>{stage.status}</span>
                    </span>
                    <Icon name="expand_more" className={open ? "visa-chevron is-open" : "visa-chevron"} />
                  </button>
                </h2>
                <div id={`visa-panel-${stage.id}`} className="visa-process-panel" hidden={!open}>
                  {stage.id === "document" ? <DocumentData application={application} /> : null}
                  {stage.id === "agreement" ? <HotelData group={group} /> : null}
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

function VisaFacts({ application, group }: { application: VisaApplication | null; group: GroupData | null }) {
  const [open, setOpen] = useState(false);
  const visa = group?.visaSetup;
  const payment = paymentLabel(visa?.paymentStatus, application?.paymentStatus);
  const travelLink = group ? (
    <Link
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
    <section className="visa-facts visa-detail-surface" aria-label="Data pendukung visa">
      <dl className="visa-facts-essential">
        <DetailValue label="Jenis visa" value={visa?.busStatus || "Belum tercatat"} />
        <DetailValue label="Syarikah" value={visa?.syarikah || application?.providerName || "Belum tercatat"} />
      </dl>
      <button
        type="button"
        className="visa-facts-disclosure"
        aria-expanded={open}
        aria-controls="visa-secondary-facts"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="description" />
        <span>
          <strong>Data pendukung</strong>
          <span>Pembayaran · Perjalanan</span>
        </span>
        <Icon name="expand_more" className={open ? "visa-chevron is-open" : "visa-chevron"} />
      </button>
      <div id="visa-secondary-facts" className={`visa-facts-secondary${open ? " is-open" : ""}`}>
        <dl>
          <DetailValue label="Pembayaran" value={<span className="visa-payment-status">{payment}</span>} />
          <DetailValue label="Tanggal terbit" value={formatVisaDate(visa?.issuedDate)} />
        </dl>
        {travelLink}
      </div>
    </section>
  );
}

function DocumentData({ application }: { application: VisaApplication | null }) {
  if (!application)
    return (
      <p className="visa-detail-note">
        Pengajuan dokumen belum tercatat. Status ini tidak berarti dokumen sudah lengkap.
      </p>
    );
  if (!application.documents.length)
    return <p className="visa-detail-note">Belum ada dokumen yang tercatat untuk pengajuan ini.</p>;
  return (
    <ul className="visa-document-list">
      {application.documents.map((document) => (
        <li key={document.id}>
          <div>
            <strong>{documentType[document.type]}</strong>
            <p className="visa-document-name">{document.originalName}</p>
            {document.reviewNote ? (
              <p className="visa-document-review">Catatan pemeriksaan: {document.reviewNote}</p>
            ) : null}
          </div>
          <span
            className="visa-data-status"
            data-tone={
              document.status === "VERIFIED"
                ? "complete"
                : document.status === "NEED_REVISION"
                  ? "attention"
                  : "waiting"
            }
          >
            {documentStatusLabel(document.status)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function HotelData({ group }: { group: GroupData | null }) {
  const visa = group?.visaSetup;
  return (
    <div className="visa-hotel-table" role="table" aria-label="Hotel agreement">
      <div className="visa-hotel-columns" role="row">
        <span role="columnheader">Kota</span>
        <span role="columnheader">Nama hotel</span>
        <span role="columnheader">Nomor agreement</span>
        <span role="columnheader">Tanggal menginap</span>
        <span role="columnheader">Jamaah</span>
        <span role="columnheader">Status</span>
      </div>
      {(["Makkah", "Madinah"] as const).map((city) => {
        const hotels = city === "Makkah" ? visa?.makkahHotels : visa?.madinahHotels;
        const waived = city === "Makkah" ? visa?.makkahHotelWaived : visa?.madinahHotelWaived;
        if (waived || !hotels?.length)
          return (
            <div className="visa-hotel-empty" key={city}>
              <strong>Hotel {city}</strong>
              <p>
                {waived
                  ? "Hotel tidak diperlukan sesuai pengaturan group."
                  : "Belum ada hotel agreement yang tercatat."}
              </p>
            </div>
          );
        return hotels.map((hotel) => <HotelRow key={`${city}-${hotel.id}`} city={city} hotel={hotel} />);
      })}
    </div>
  );
}

function HotelRow({ city, hotel }: { city: string; hotel: GroupAgreementHotel }) {
  const complete = hotel.status === "Approved";
  const label = complete ? "Disetujui" : hotel.status === "Rejected" ? "Ditolak" : "Menunggu persetujuan";
  return (
    <div className="visa-hotel-row" role="row">
      <span className="visa-hotel-city" role="cell">
        {city}
      </span>
      <strong className="visa-hotel-name" role="cell">
        {hotel.hotelName}
      </strong>
      <span className="visa-hotel-agreement" role="cell">
        <span className="visa-mobile-label">Agreement</span>
        {hotel.agreementNumber || "Nomor agreement belum tercatat"}
      </span>
      <span className="visa-hotel-dates" role="cell">
        <span className="visa-mobile-label">Menginap</span>
        {formatVisaDate(hotel.stayStartIso)} – {formatVisaDate(hotel.stayEndIso)}
      </span>
      <span className="visa-hotel-pax" role="cell">
        {hotel.pax} jamaah
      </span>
      <span
        className="visa-data-status"
        data-tone={complete ? "complete" : hotel.status === "Rejected" ? "attention" : "waiting"}
        role="cell"
      >
        {complete ? <Icon name="check" /> : null}
        {label}
      </span>
    </div>
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
function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}
function DetailValue({ label, value }: { label: string; value: React.ReactNode }) {
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
