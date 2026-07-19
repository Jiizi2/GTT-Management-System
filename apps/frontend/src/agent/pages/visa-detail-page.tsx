import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { ReadOnlyIndicator } from "../../components/read-only-indicator";
import type { GroupAgreementHotel, GroupData } from "../../shared/app-domain";
import { EmptyState, ErrorState, LoadingState } from "../components/data-state";
import { useAgentGroupData } from "../data/use-agent-group-data";

const visaCopy = {
  Draft: { label: "Persiapan", description: "Data visa masih dalam tahap persiapan." },
  Pending: { label: "Sedang Diproses", description: "Pengajuan visa sedang diproses oleh tim operasional." },
  Issued: { label: "Visa Terbit", description: "Visa sudah diterbitkan." },
} as const;

function formatDate(value: string | undefined): string {
  if (!value) return "Belum tersedia";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(`${value}T00:00:00`),
  );
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
  const identity = useParams().identity ?? "";
  const query = useAgentGroupData({ principalId, agentId, agentName });
  const group = query.data?.find((item) => item.code === identity || item.id === identity) ?? null;

  useEffect(() => {
    if (group) document.title = `${group.code} | Visa Tracking Portal Agent`;
  }, [group]);

  if (query.isPending) return <LoadingState label="Memuat detail visa..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;
  if (!group) return <EmptyState title="Detail visa tidak ditemukan" />;

  const visa = group.visaSetup;
  const status = visaCopy[visa?.visaStatus ?? "Draft"];
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 pb-24 pt-4 sm:px-6 sm:py-6 lg:px-8">
      <button type="button" className="serene-btn-secondary" onClick={() => navigate("/agent/visa")}>
        <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
        Kembali ke Visa Tracking
      </button>

      <PageHeader
        variant="detail"
        eyebrow="Visa Tracking · Portal Agent"
        title={group.code}
        description={<strong className="text-on-surface">{group.name}</strong>}
        actions={<ReadOnlyIndicator label="Read-only" />}
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Ringkasan visa">
        <SummaryCard icon="approval" label="Status Visa" value={status.label} />
        <SummaryCard icon="payments" label="Pembayaran" value={paymentLabel(visa?.paymentStatus)} />
        <SummaryCard icon="confirmation_number" label="Jenis Visa" value={visa?.busStatus ?? "Belum tersedia"} />
        <SummaryCard icon="business" label="Syarikah" value={visa?.syarikah || "Belum tersedia"} />
      </section>

      <section className="serene-section grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-4 sm:p-6" aria-label="Informasi Group visa">
        <DetailValue label="Keberangkatan" value={formatDate(group.arrivalDate)} />
        <DetailValue label="Kepulangan" value={formatDate(group.returnDate)} />
        <DetailValue label="Jamaah" value={`${group.pax} pax`} />
        <DetailValue label="Paket" value={group.packageName || "Belum tersedia"} />
      </section>

      <section className="serene-section p-5 sm:p-6" aria-label="Perkembangan visa">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined" aria-hidden="true">approval</span></span>
          <div><p className="text-xs font-black uppercase tracking-[0.14em] text-on-surface-variant">Perkembangan Visa</p><h2 className="mt-1 text-xl font-extrabold text-on-surface">{status.label}</h2><p className="mt-1 text-sm text-on-surface-variant">{status.description}</p>{visa?.issuedDate ? <p className="mt-2 text-sm font-bold text-on-surface">Tanggal terbit: {formatDate(visa.issuedDate.slice(0, 10))}</p> : null}</div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Hotel Agreement">
        <HotelSection city="Makkah" hotels={visa?.makkahHotels ?? []} />
        <HotelSection city="Madinah" hotels={visa?.madinahHotels ?? []} />
      </section>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <article className="serene-card rounded-2xl p-4"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined text-xl" aria-hidden="true">{icon}</span></span><p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-variant">{label}</p><strong className="mt-1 block text-base text-on-surface">{value}</strong></article>;
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-variant">{label}</dt><dd className="mt-1 text-sm font-bold text-on-surface">{value}</dd></div>;
}

function HotelSection({ city, hotels }: { city: string; hotels: GroupAgreementHotel[] }) {
  return <article className="serene-section p-5 sm:p-6"><div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined" aria-hidden="true">hotel</span></span><div><p className="text-[10px] font-black uppercase tracking-[0.12em] text-on-surface-variant">Hotel Agreement</p><h2 className="text-lg font-extrabold text-on-surface">{city}</h2></div></div>{hotels.length === 0 ? <p className="mt-4 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Belum ada agreement hotel yang tersedia.</p> : <ul className="mt-4 space-y-3">{hotels.map((hotel) => <li key={hotel.id} className="rounded-2xl bg-surface-container-low p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-sm text-on-surface">{hotel.hotelName}</strong><p className="mt-1 text-xs text-on-surface-variant">{hotel.agreementNumber || "Nomor agreement belum tersedia"}</p></div><AgreementBadge status={hotel.status} /></div><p className="mt-3 text-xs font-semibold text-on-surface-variant">{formatDate(hotel.stayStartIso)} – {formatDate(hotel.stayEndIso)} · {hotel.pax} pax</p></li>)}</ul>}</article>;
}

function AgreementBadge({ status }: { status: GroupAgreementHotel["status"] }) {
  const className = status === "Approved" ? "bg-emerald-100 text-emerald-700" : status === "Rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700";
  const label = status === "Approved" ? "Disetujui" : status === "Rejected" ? "Ditolak" : "Menunggu Persetujuan";
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${className}`}>{label}</span>;
}

function paymentLabel(status: NonNullable<GroupData["visaSetup"]>["paymentStatus"] | undefined): string {
  return status === "Paid" ? "Lunas" : status === "Partial" ? "Sebagian" : status === "Unpaid" ? "Belum Lunas" : "Belum tersedia";
}
