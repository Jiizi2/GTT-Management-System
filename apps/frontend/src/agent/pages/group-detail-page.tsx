import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
import { ReadOnlyIndicator } from "../../components/read-only-indicator";
import { StatusBadge } from "../../components/status-badge";
import type { GroupAgreementHotel, GroupData, ItineraryItem } from "../../shared/app-domain";
import { LoadingState, ResourceErrorState } from "../components/data-state";
import type { TransportationItem } from "../data/contracts";
import { formatDate } from "../data/format";
import { useAgentTripDetail } from "../data/use-agent-trip-detail";

type Tone = "complete" | "in-progress" | "waiting" | "attention" | "neutral";

const lifecycleLabel: Record<string, string> = {
  ENTRY_ONLY: "Data awal",
  ACTIVE: "Aktif",
  INACTIVE: "Tidak aktif",
  COMPLETED: "Selesai",
  ARCHIVED: "Diarsipkan",
};

export function GroupDetailPage({
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
  const query = useAgentTripDetail({ principalId, agentId, agentName, identity });
  const from = (location.state as { from?: unknown } | null)?.from;
  const backTarget = typeof from === "string" && from.startsWith("/agent/groups") ? from : "/agent/groups";

  useEffect(() => {
    if (query.data?.group.code) document.title = `${query.data.group.code} | Perjalanan Portal Agent`;
  }, [query.data?.group.code]);

  if (query.isPending) return <LoadingState label="Memuat detail perjalanan..." />;
  if (query.isError) return <ResourceErrorState error={query.error} retry={() => void query.refetch()} />;

  const { group, transportation } = query.data;
  const lifecycle = lifecycleLabel[group.lifecycleStatus ?? ""] ?? group.status;

  return (
    <PageLayout>
      <button type="button" className="serene-btn-secondary min-h-11 w-fit" onClick={() => navigate(backTarget)}>
        <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
        Kembali ke Perjalanan
      </button>

      <PageHeader
        variant="detail"
        title={<span className="break-all">{group.code}</span>}
        description={<strong className="break-words text-on-surface">{group.name}</strong>}
        actions={<><StatusBadge tone={group.lifecycleStatus === "ACTIVE" ? "in-progress" : "neutral"}>{lifecycle}</StatusBadge><ReadOnlyIndicator label="Read-only" /></>}
      />

      <TripIdentity group={group} />
      <NextActivity group={group} />
      <ItinerarySection items={group.itinerary} transportation={transportation} />
      <VisaAndHotelSection group={group} />
      <NotesSection notes={group.notes} />
    </PageLayout>
  );
}

function TripIdentity({ group }: { group: GroupData }) {
  return (
    <section className="serene-section p-5 sm:p-6" aria-labelledby="trip-summary-title">
      <h2 id="trip-summary-title" className="text-lg font-extrabold text-on-surface">Ringkasan perjalanan</h2>
      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailValue label="Keberangkatan" value={formatDate(group.arrivalDate ?? null)} />
        <DetailValue label="Kepulangan" value={formatDate(group.returnDate ?? null)} />
        <DetailValue label="Jamaah" value={`${group.pax} jamaah`} />
        <DetailValue label="Paket" value={group.packageName || "Belum dicatat"} />
        <DetailValue label="Durasi" value={`${group.durationDays} hari`} />
        <DetailValue label="Kebutuhan bus" value={group.totalBuses ? `${group.totalBuses} bus` : "Belum dicatat"} />
        <DetailValue label="Musyrif" value={group.musyrif.name || "Belum ditentukan"} />
        <DetailValue label="Kontak musyrif" value={group.musyrif.phone || "Belum dicatat"} />
      </dl>
    </section>
  );
}

function NextActivity({ group }: { group: GroupData }) {
  const available = group.itinerary.length > 0 && group.nextActivity.title !== "Belum ada aktivitas";
  return (
    <section className="serene-section p-5 sm:p-6" aria-labelledby="next-activity-title">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><span className="material-symbols-outlined" aria-hidden="true">{available ? group.nextActivity.icon : "event_busy"}</span></span>
        <div className="min-w-0"><h2 id="next-activity-title" className="text-lg font-extrabold text-on-surface">Aktivitas berikutnya</h2>{available ? <><p className="mt-2 break-words text-base font-bold text-on-surface">{group.nextActivity.title}</p><p className="mt-1 text-sm text-on-surface-variant">{group.nextActivity.date}{group.nextActivity.time && group.nextActivity.time !== "-" ? ` · ${group.nextActivity.time}` : ""}</p></> : <p className="mt-2 text-sm text-on-surface-variant">Belum ada aktivitas yang tercatat dalam itinerary.</p>}</div>
      </div>
    </section>
  );
}

function ItinerarySection({ items, transportation }: { items: ItineraryItem[]; transportation: TransportationItem[] }) {
  const matches = matchTransportation(items, transportation);
  return (
    <section className="serene-section p-5 sm:p-6" aria-labelledby="itinerary-title">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="itinerary-title" className="text-xl font-extrabold text-on-surface">Kronologi itinerary</h2><p className="mt-1 text-sm text-on-surface-variant">Urutan aktivitas beserta penugasan transportasinya.</p></div>{items.length > 0 ? <span className="text-sm font-bold text-on-surface tabular-nums">{items.length} aktivitas</span> : null}</div>
      {items.length === 0 ? <MissingPanel icon="event_busy" text="Itinerary belum dicatat untuk perjalanan ini." /> : <><ol className="mt-6 divide-y divide-outline-variant/30 border-y border-outline-variant/30">{items.map((item, index) => <ItineraryRow key={`${item.isoDate ?? item.date}-${index}`} item={item} index={index} transportation={matches[index] ?? null} />)}</ol><p className="mt-4 text-xs leading-relaxed text-on-surface-variant">Portal Agent saat ini hanya menerima jumlah dan status verifikasi driver. Nama driver, plat nomor, dan nomor telepon disiapkan di tampilan tetapi belum dibuka oleh kontrak server.</p></>}
    </section>
  );
}

function ItineraryRow({ item, index, transportation }: { item: ItineraryItem; index: number; transportation: TransportationItem | null }) {
  const facts = [item.time, item.flightNumber, item.from && item.to ? `${item.from} → ${item.to}` : null, item.hotelName, item.transferByTrain ? "Menggunakan kereta" : null].filter(Boolean);
  return (
    <li className="grid gap-3 py-5 sm:grid-cols-[2.5rem_8rem_minmax(0,1fr)] sm:gap-4">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary tabular-nums">{index + 1}</span>
      <div><p className="text-sm font-bold text-on-surface">{item.date || "Tanggal belum dicatat"}</p>{item.year ? <p className="mt-0.5 text-xs text-on-surface-variant">{item.year}</p> : null}</div>
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-primary">{item.category || "Aktivitas"}</span>{item.requiresBus ? <StatusBadge tone="waiting">Perlu bus</StatusBadge> : null}</div><h3 className="mt-1 break-words text-base font-extrabold text-on-surface">{item.title}</h3>{facts.length > 0 ? <p className="mt-2 break-words text-sm text-on-surface-variant">{facts.join(" · ")}</p> : item.meta ? <p className="mt-2 break-words text-sm text-on-surface-variant">{item.meta}</p> : null}{item.requiresBus || transportation ? <DriverColumns row={transportation} /> : null}</div>
    </li>
  );
}

function DriverColumns({ row }: { row: TransportationItem | null }) {
  const verified = row && row.status === "ASSIGNED" && row.verifiedDriverCount >= row.requiredBusCount;
  const assigned = row?.status === "ASSIGNED";
  const tone: Tone = verified ? "complete" : assigned ? "waiting" : "attention";
  const status = verified ? "Terverifikasi" : assigned ? "Menunggu verifikasi" : "Belum ditugaskan";
  return (
    <div className="mt-4 rounded-xl bg-surface-container-low p-4" aria-label="Informasi pengemudi">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-extrabold text-on-surface">Informasi pengemudi</h4><StatusBadge tone={tone}>{status}</StatusBadge></div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <DriverValue label="Nama driver" value={row ? "Belum tersedia di Portal Agent" : "Belum ditugaskan"} hint={row ? `${row.verifiedDriverCount} dari ${row.requiredBusCount} driver terverifikasi` : undefined} />
        <DriverValue label="Plat nomor" value="Belum tersedia di Portal Agent" />
        <DriverValue label="Nomor telepon" value="Belum tersedia di Portal Agent" />
      </dl>
    </div>
  );
}

function DriverValue({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-on-surface-variant">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-on-surface">{value}</dd>{hint ? <p className="mt-1 text-xs text-on-surface-variant">{hint}</p> : null}</div>;
}

function matchTransportation(items: ItineraryItem[], rows: TransportationItem[]): Array<TransportationItem | null> {
  const unused = new Set(rows.map((row) => row.id));
  const normalized = (value: string | undefined | null) => value?.trim().toLocaleLowerCase("id-ID") ?? "";
  const dateKey = (value: string | undefined | null) => value?.slice(0, 10) ?? "";
  return items.map((item) => {
    const exact = rows.find((row) => unused.has(row.id) && normalized(row.tripLabel) === normalized(item.title));
    const sameDateAndActivity = rows.find(
      (row) => unused.has(row.id) && dateKey(row.tripDate) === dateKey(item.isoDate) && normalized(row.activity) === normalized(item.category),
    );
    const match = exact ?? sameDateAndActivity ?? null;
    if (match) unused.delete(match.id);
    return match;
  });
}

function VisaAndHotelSection({ group }: { group: GroupData }) {
  const visa = group.visaSetup;
  const visaTone: Tone = visa?.visaStatus === "Issued" ? "complete" : visa?.visaStatus === "Pending" ? "in-progress" : "waiting";
  return (
    <section className="serene-section p-5 sm:p-6" aria-labelledby="visa-trip-title">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="visa-trip-title" className="text-lg font-extrabold text-on-surface">Visa dan hotel</h2><p className="mt-1 text-sm text-on-surface-variant">Fakta pendukung yang sudah tersedia untuk perjalanan ini.</p></div>{visa ? <StatusBadge tone={visaTone}>{visa.visaStatus === "Issued" ? "Visa terbit" : visa.visaStatus === "Pending" ? "Visa diproses" : "Persiapan visa"}</StatusBadge> : null}</div>
      {!visa ? <MissingPanel icon="approval" text="Data visa belum dicatat untuk perjalanan ini." /> : <><dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-3"><DetailValue label="Jenis visa" value={visa.busStatus ?? "Belum dicatat"} /><DetailValue label="Syarikah" value={visa.syarikah || "Belum dicatat"} /><DetailValue label="Pembayaran" value={visa.paymentStatus === "Paid" ? "Lunas" : visa.paymentStatus === "Partial" ? "Sebagian" : "Belum lunas"} /></dl><div className="mt-6 grid gap-4 lg:grid-cols-2"><HotelSummary city="Makkah" hotels={visa.makkahHotels} /><HotelSummary city="Madinah" hotels={visa.madinahHotels} /></div></>}
    </section>
  );
}

function HotelSummary({ city, hotels }: { city: string; hotels: GroupAgreementHotel[] }) {
  return <div className="rounded-xl bg-surface-container-low p-4"><h3 className="font-extrabold text-on-surface">Hotel {city}</h3>{hotels.length === 0 ? <p className="mt-2 text-sm text-on-surface-variant">Hotel agreement belum dicatat.</p> : <ul className="mt-3 space-y-3">{hotels.map((hotel) => <li key={hotel.id} className="flex flex-col gap-2 border-t border-outline-variant/30 pt-3 first:border-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="break-words text-sm font-bold text-on-surface">{hotel.hotelName}</p><p className="mt-1 break-all text-xs text-on-surface-variant">{hotel.agreementNumber || "Nomor agreement belum dicatat"}</p></div><AgreementStatus status={hotel.status} /></li>)}</ul>}</div>;
}

function NotesSection({ notes }: { notes: string[] }) {
  return <section className="serene-section p-5 sm:p-6" aria-labelledby="notes-title"><h2 id="notes-title" className="text-lg font-extrabold text-on-surface">Catatan perjalanan</h2>{notes.length === 0 ? <MissingPanel icon="notes" text="Belum ada catatan pendukung untuk perjalanan ini." /> : <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-on-surface-variant">{notes.map((note, index) => <li key={`${note}-${index}`} className="break-words">{note}</li>)}</ul>}</section>;
}

function AgreementStatus({ status }: { status: GroupAgreementHotel["status"] }) {
  const tone: Tone = status === "Approved" ? "complete" : status === "Rejected" ? "attention" : "waiting";
  const label = status === "Approved" ? "Disetujui" : status === "Rejected" ? "Ditolak" : "Menunggu persetujuan";
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function DetailValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-xs font-semibold text-on-surface-variant">{label}</dt><dd className="mt-1 break-words text-sm font-bold text-on-surface">{value}</dd></div>;
}

function MissingPanel({ icon, text }: { icon: string; text: ReactNode }) {
  return <div className="mt-5 flex items-start gap-3 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-xl" aria-hidden="true">{icon}</span><p className="leading-relaxed">{text}</p></div>;
}
