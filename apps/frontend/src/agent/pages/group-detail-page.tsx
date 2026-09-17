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
type ItineraryFocus = "today" | "next" | null;

const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

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
        className="overflow-hidden"
      />

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
        <TripIdentity group={group} />
        <NextActivity group={group} />
      </div>
      <ItinerarySection items={group.itinerary} transportation={transportation} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.55fr)]">
        <VisaAndHotelSection group={group} />
        <NotesSection notes={group.notes} />
      </div>
    </PageLayout>
  );
}

function TripIdentity({ group }: { group: GroupData }) {
  return (
    <section className="serene-section overflow-hidden" aria-labelledby="trip-summary-title">
      <div className="relative bg-surface-container-high p-5 sm:p-6">
        <span className="material-symbols-outlined pointer-events-none absolute -bottom-8 -right-4 rotate-[-8deg] text-[8rem] leading-none text-primary/10" aria-hidden="true">route</span>
        <div className="relative">
          <h2 id="trip-summary-title" className="text-lg font-extrabold text-on-surface">Ringkasan perjalanan</h2>
          <div className="mt-5 grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-3">
            <DatePoint icon="flight_takeoff" label="Berangkat" value={formatDate(group.arrivalDate ?? null)} />
            <div className="flex items-center" aria-hidden="true">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="h-px flex-1 border-t border-dashed border-primary/45" />
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            </div>
            <DatePoint icon="flight_land" label="Kembali" value={formatDate(group.returnDate ?? null)} align="right" />
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          <DetailValue label="Jamaah" value={`${group.pax} jamaah`} icon="groups" />
          <DetailValue label="Paket" value={group.packageName || "Belum dicatat"} icon="luggage" />
          <DetailValue label="Durasi" value={`${group.durationDays} hari`} icon="calendar_month" />
          <DetailValue label="Kebutuhan bus" value={group.totalBuses ? `${group.totalBuses} bus` : "Belum dicatat"} icon="directions_bus" />
        </dl>

        <div className="mt-6 flex flex-col gap-3 border-t border-outline-variant/30 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="material-symbols-outlined" aria-hidden="true">person</span>
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-on-surface-variant">Musyrif perjalanan</p>
              <p className="truncate text-sm font-extrabold text-on-surface">{group.musyrif.name || "Belum ditentukan"}</p>
            </div>
          </div>
          <p className="break-all text-sm font-bold text-primary">{group.musyrif.phone || "Kontak belum dicatat"}</p>
        </div>
      </div>
    </section>
  );
}

function NextActivity({ group }: { group: GroupData }) {
  const available = group.itinerary.length > 0 && group.nextActivity.title !== "Belum ada aktivitas";
  return (
    <section className="serene-section overflow-hidden p-0" aria-labelledby="next-activity-title">
      <div className={`relative flex h-full min-h-64 p-5 sm:p-6 ${available ? "bg-primary" : ""}`}>
        <span className={`material-symbols-outlined pointer-events-none absolute -bottom-8 -right-7 text-[9rem] leading-none ${available ? "text-on-primary/10" : "text-primary/10"}`} aria-hidden="true">near_me</span>
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-3">
            <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${available ? "bg-on-primary/15 text-on-primary" : "bg-primary/10 text-primary"}`}>
              <span className="material-symbols-outlined" aria-hidden="true">{available ? group.nextActivity.icon : "event_busy"}</span>
            </span>
            {available ? <span className="rounded-lg bg-on-primary/15 px-2.5 py-1 text-xs font-bold text-on-primary">Agenda terdekat</span> : null}
          </div>
          <h2 id="next-activity-title" className={`mt-5 text-lg font-extrabold ${available ? "text-on-primary" : "text-on-surface"}`}>Aktivitas berikutnya</h2>
          {available ? (
            <>
              <p className="mt-3 break-words text-xl font-extrabold leading-snug text-on-primary">{group.nextActivity.title}</p>
              <p className="mt-auto pt-6 text-sm font-semibold text-on-primary/80">{group.nextActivity.date}{group.nextActivity.time && group.nextActivity.time !== "-" ? ` · ${group.nextActivity.time}` : ""}</p>
            </>
          ) : (
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-on-surface-variant">Belum ada aktivitas yang tercatat dalam itinerary.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function DatePoint({ icon, label, value, align = "left" }: { icon: string; label: string; value: string; align?: "left" | "right" }) {
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : ""}`}>
      <span className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-surface-container-lowest text-primary ${align === "right" ? "ml-auto" : ""}`}>
        <span className="material-symbols-outlined text-xl" aria-hidden="true">{icon}</span>
      </span>
      <p className="text-xs font-semibold text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate text-sm font-extrabold text-on-surface" title={value}>{value}</p>
    </div>
  );
}

function ItinerarySection({ items, transportation }: { items: ItineraryItem[]; transportation: TransportationItem[] }) {
  const matches = matchTransportation(items, transportation);
  const focusStates = getItineraryFocusStates(items);
  return (
    <section className="serene-section overflow-hidden" aria-labelledby="itinerary-title">
      <div className="flex flex-wrap items-end justify-between gap-3 bg-surface-container-high p-5 sm:p-6">
        <div>
          <h2 id="itinerary-title" className="text-xl font-extrabold text-on-surface">Kronologi itinerary</h2>
          <p className="mt-1 hidden text-sm text-on-surface-variant sm:block">Agenda perjalanan secara berurutan.</p>
        </div>
        {items.length > 0 ? (
          <span className="inline-flex min-h-9 items-center gap-2 rounded-xl bg-surface-container-lowest px-3 text-sm font-bold text-on-surface tabular-nums">
            <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">route</span>
            {items.length} aktivitas
          </span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="p-5 sm:p-6"><MissingPanel icon="event_busy" text="Itinerary belum dicatat untuk perjalanan ini." /></div>
      ) : (
        <>
          <ol className="px-5 sm:px-6">{items.map((item, index) => <ItineraryRow key={`${item.isoDate ?? item.date}-${index}`} item={item} index={index} isLast={index === items.length - 1} focus={focusStates[index]} transportation={matches[index] ?? null} />)}</ol>
          <p className="hidden border-t border-outline-variant/30 px-5 py-4 text-xs text-on-surface-variant sm:block sm:px-6">Detail pengemudi mengikuti data yang tersedia dari server.</p>
        </>
      )}
    </section>
  );
}

function ItineraryRow({ item, index, isLast, focus, transportation }: { item: ItineraryItem; index: number; isLast: boolean; focus: ItineraryFocus; transportation: TransportationItem | null }) {
  const facts = [item.time, item.flightNumber, item.from && item.to ? `${item.from} → ${item.to}` : null, item.hotelName, item.transferByTrain ? "Menggunakan kereta" : null].filter(Boolean);
  const focusLabel = focus === "today" ? "Hari ini" : focus === "next" ? "Agenda berikutnya" : null;
  const compactFacts = [item.time, item.flightNumber].filter(Boolean);
  return (
    <li
      className={`relative grid gap-4 py-6 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-6 ${isLast ? "" : "border-b border-outline-variant/30"} ${focus ? "-mx-3 rounded-2xl bg-primary/5 px-3 sm:-mx-4 sm:px-4" : ""}`}
      aria-current={focus === "today" ? "date" : focus === "next" ? "step" : undefined}
    >
      <div className="relative flex gap-3 sm:block">
        <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold tabular-nums ${focus ? "bg-primary text-on-primary" : "bg-primary/10 text-primary"}`}>{index + 1}</span>
        {!isLast ? <span className="absolute left-[1.1rem] top-9 hidden h-[calc(100%+1.5rem)] w-px bg-primary/20 sm:block" aria-hidden="true" /> : null}
        <div className="sm:mt-3">
          <p className="text-sm font-extrabold text-on-surface">{item.date || "Tanggal belum dicatat"}</p>
          {item.year ? <p className="mt-0.5 hidden text-xs text-on-surface-variant sm:block">{item.year}</p> : null}
        </div>
      </div>
      <div className="min-w-0 sm:pt-1">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <span className="material-symbols-outlined text-xl" aria-hidden="true">{item.icon || "event"}</span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="break-words text-lg font-extrabold leading-snug text-on-surface">{item.title}</h3>
              {focusLabel ? <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${focus === "today" ? "bg-primary text-on-primary" : "bg-primary/10 text-primary"}`}><span className="sm:hidden">{focus === "next" ? "Berikutnya" : focusLabel}</span><span className="hidden sm:inline">{focusLabel}</span></span> : null}
            </div>
            {compactFacts.length > 0 ? <p className="mt-1 text-sm text-on-surface-variant sm:hidden">{compactFacts.join(" · ")}</p> : null}
            {facts.length > 0 ? <p className="mt-1 hidden break-words text-sm text-on-surface-variant sm:block">{facts.join(" · ")}</p> : item.meta ? <p className="mt-1 hidden break-words text-sm text-on-surface-variant sm:block">{item.meta}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-primary">{item.category || "Aktivitas"}</span>
              {item.requiresBus ? <span className="hidden sm:inline-flex"><StatusBadge tone="waiting">Perlu bus</StatusBadge></span> : null}
            </div>
          </div>
        </div>
        {item.requiresBus || transportation ? <DriverColumns row={transportation} /> : null}
      </div>
    </li>
  );
}

export function getItineraryFocusStates(items: ItineraryItem[], now = new Date()): ItineraryFocus[] {
  const parts = Object.fromEntries(jakartaDateFormatter.formatToParts(now).map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const dates = items.map((item) => {
    const value = item.isoDate?.slice(0, 10) ?? "";
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  });
  if (dates.some((date) => date === today)) return dates.map((date) => (date === today ? "today" : null));

  let nextIndex = -1;
  let nextDate: string | null = null;
  dates.forEach((date, index) => {
    if (date && date > today && (!nextDate || date < nextDate)) {
      nextDate = date;
      nextIndex = index;
    }
  });
  return dates.map((_, index) => (index === nextIndex ? "next" : null));
}

function DriverColumns({ row }: { row: TransportationItem | null }) {
  const verified = row && row.status === "ASSIGNED" && row.verifiedDriverCount >= row.requiredBusCount;
  const assigned = row?.status === "ASSIGNED";
  const tone: Tone = verified ? "complete" : assigned ? "waiting" : "attention";
  const status = verified ? "Terverifikasi" : assigned ? "Menunggu verifikasi" : "Belum ditugaskan";
  return (
    <div className="mt-4 rounded-xl bg-surface-container-low px-4 py-3" aria-label="Informasi pengemudi">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">directions_bus</span>
          <h4 className="text-sm font-extrabold text-on-surface"><span className="sm:hidden">Armada</span><span className="hidden sm:inline">Armada & pengemudi</span></h4>
          {row ? <span className="text-xs text-on-surface-variant">{row.requiredBusCount} bus</span> : null}
        </div>
        <StatusBadge tone={tone}>{status}</StatusBadge>
      </div>
      <details className="mt-2 sm:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xs font-bold text-primary">
          Detail pengemudi
          <span className="material-symbols-outlined text-lg" aria-hidden="true">expand_more</span>
        </summary>
        <DriverFields row={row} />
      </details>
      <div className="hidden sm:block"><DriverFields row={row} /></div>
    </div>
  );
}

function DriverFields({ row }: { row: TransportationItem | null }) {
  return (
    <>
      <dl className="grid grid-cols-3 gap-3 border-t border-outline-variant/30 pt-3">
        <DriverValue label="Driver" value={row ? "—" : "Belum ditugaskan"} />
        <DriverValue label="Plat" value="—" />
        <DriverValue label="Telepon" value="—" />
      </dl>
      {row ? <p className="mt-2 text-xs text-on-surface-variant">{row.verifiedDriverCount}/{row.requiredBusCount} driver terverifikasi</p> : null}
    </>
  );
}

function DriverValue({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-[11px] font-semibold text-on-surface-variant">{label}</dt><dd className="mt-0.5 truncate text-sm font-bold text-on-surface" title={value}>{value}</dd></div>;
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
    <section className="serene-section overflow-hidden" aria-labelledby="visa-trip-title">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-high p-5 sm:p-6">
        <div>
          <h2 id="visa-trip-title" className="text-lg font-extrabold text-on-surface">Visa dan hotel</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Fakta pendukung yang sudah tersedia untuk perjalanan ini.</p>
        </div>
        {visa ? <StatusBadge tone={visaTone}>{visa.visaStatus === "Issued" ? "Visa terbit" : visa.visaStatus === "Pending" ? "Visa diproses" : "Persiapan visa"}</StatusBadge> : null}
      </div>
      {!visa ? (
        <div className="p-5 sm:p-6"><MissingPanel icon="approval" text="Data visa belum dicatat untuk perjalanan ini." /></div>
      ) : (
        <div className="p-5 sm:p-6">
          <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-3">
            <DetailValue label="Jenis visa" value={visa.busStatus ?? "Belum dicatat"} icon="approval" />
            <DetailValue label="Syarikah" value={visa.syarikah || "Belum dicatat"} icon="apartment" />
            <DetailValue label="Pembayaran" value={visa.paymentStatus === "Paid" ? "Lunas" : visa.paymentStatus === "Partial" ? "Sebagian" : "Belum lunas"} icon="payments" />
          </dl>
          <div className="mt-6 grid border-t border-outline-variant/30 lg:grid-cols-2 lg:divide-x lg:divide-outline-variant/30">
            <HotelSummary city="Makkah" hotels={visa.makkahHotels} />
            <HotelSummary city="Madinah" hotels={visa.madinahHotels} />
          </div>
        </div>
      )}
    </section>
  );
}

function HotelSummary({ city, hotels }: { city: string; hotels: GroupAgreementHotel[] }) {
  return (
    <div className="py-5 lg:px-5 lg:first:pl-0 lg:last:pr-0">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-xl text-primary" aria-hidden="true">hotel</span>
        <h3 className="font-extrabold text-on-surface">Hotel {city}</h3>
      </div>
      {hotels.length === 0 ? (
        <p className="mt-3 text-sm text-on-surface-variant">Hotel agreement belum dicatat.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {hotels.map((hotel) => (
            <li key={hotel.id} className="flex flex-col gap-2 border-t border-outline-variant/30 pt-4 first:border-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-on-surface">{hotel.hotelName}</p>
                <p className="mt-1 break-all text-xs text-on-surface-variant">{hotel.agreementNumber || "Nomor agreement belum dicatat"}</p>
              </div>
              <AgreementStatus status={hotel.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotesSection({ notes }: { notes: string[] }) {
  return (
    <section className="serene-section overflow-hidden" aria-labelledby="notes-title">
      <div className="bg-surface-container-high p-5 sm:p-6">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-lowest text-primary">
          <span className="material-symbols-outlined" aria-hidden="true">notes</span>
        </span>
        <h2 id="notes-title" className="mt-4 text-lg font-extrabold text-on-surface">Catatan perjalanan</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Informasi penting untuk koordinasi group.</p>
      </div>
      {notes.length === 0 ? (
        <div className="p-5 sm:p-6"><MissingPanel icon="notes" text="Belum ada catatan pendukung untuk perjalanan ini." /></div>
      ) : (
        <ul className="divide-y divide-outline-variant/30 px-5 sm:px-6">
          {notes.map((note, index) => (
            <li key={`${note}-${index}`} className="flex gap-3 py-5 text-sm leading-relaxed text-on-surface-variant">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span className="break-words">{note}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AgreementStatus({ status }: { status: GroupAgreementHotel["status"] }) {
  const tone: Tone = status === "Approved" ? "complete" : status === "Rejected" ? "attention" : "waiting";
  const label = status === "Approved" ? "Disetujui" : status === "Rejected" ? "Ditolak" : "Menunggu persetujuan";
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function DetailValue({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className={`min-w-0 ${icon ? "grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3" : ""}`}>
      {icon ? (
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">{icon}</span>
        </span>
      ) : null}
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-on-surface-variant">{label}</dt>
        <dd className="mt-1 break-words text-sm font-bold text-on-surface">{value}</dd>
      </div>
    </div>
  );
}

function MissingPanel({ icon, text }: { icon: string; text: ReactNode }) {
  return <div className="flex items-start gap-3 rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-xl" aria-hidden="true">{icon}</span><p className="leading-relaxed">{text}</p></div>;
}
