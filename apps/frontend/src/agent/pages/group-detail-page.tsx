import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState, ResourceErrorState, StatusChip } from "../components/data-state";
import type { GroupDetail, HotelAgreement, ItineraryItem, TransportationItem, VisaFacet } from "../data/contracts";
import { formatDate, statusLabel } from "../data/format";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";

function FacetState({
  pending,
  error,
  empty,
  children,
}: {
  pending: boolean;
  error: boolean;
  empty: boolean;
  children: React.ReactNode;
}) {
  if (pending) return <LoadingState />;
  if (error) return <ErrorState />;
  if (empty) return <EmptyState title="Data belum tersedia" />;
  return <>{children}</>;
}

function DetailField({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl bg-surface-container-low p-3.5">
      <span className="material-symbols-outlined text-xl text-primary">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[10px] font-black uppercase tracking-[.12em] text-on-surface-variant/70">{label}</dt>
        <dd className="mt-1 break-words text-sm font-bold text-on-surface">{value}</dd>
      </div>
    </div>
  );
}

function tripRoute(item: ItineraryItem): string {
  return [item.fromLocation, item.toLocation].filter(Boolean).join(" → ");
}

export function GroupDetailPage({ principalId }: { principalId: string }) {
  const client = useQueryClient();
  const identity = useParams().identity ?? "";
  const baseKey = agentQueryKeys.group(principalId, identity);
  const query = useQuery({
    queryKey: baseKey,
    queryFn: () => portalGet<GroupDetail>(client, `/groups/${encodeURIComponent(identity)}`),
    staleTime: 60_000,
  });
  const facet = <T,>(name: string) => ({
    queryKey: [...baseKey, name],
    queryFn: () => portalGet<T>(client, `/groups/${encodeURIComponent(identity)}/${name}`),
    staleTime: 60_000,
  });
  const itinerary = useQuery(facet<ItineraryItem[]>("itinerary"));
  const visa = useQuery(facet<VisaFacet>("visa"));
  const hotels = useQuery(facet<HotelAgreement[]>("hotel-agreements"));
  const transport = useQuery(facet<TransportationItem[]>("transportation"));

  if (query.isPending) return <LoadingState label="Memuat detail group..." />;
  if (query.isError) return <ResourceErrorState error={query.error} retry={() => void query.refetch()} />;

  const group = query.data;
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-0 pb-20 pt-4 sm:px-2 lg:px-4">
      <header className="serene-page-toolbar pr-14">
        <Link className="inline-flex items-center gap-2 text-sm font-bold text-primary" to="/agent/overview">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Back to Overview
        </Link>
      </header>

      <section className="serene-hero relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.18em] text-primary">Group Detail</p>
            <h1 className="mt-2 break-words font-display text-4xl font-extrabold tracking-tight text-primary sm:text-5xl">
              {group.code}
            </h1>
            <p className="mt-2 text-lg font-bold text-on-surface">{group.name}</p>
            <p className="mt-2 text-sm text-on-surface-variant">
              {formatDate(group.arrivalDate)} – {formatDate(group.returnDate)} · {group.durationDays} hari
            </p>
          </div>
          <StatusChip value={group.lifecycleStatus} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.45fr_.85fr]">
        <article className="serene-card rounded-3xl p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <span className="material-symbols-outlined">info</span>
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-primary">Identity</p>
              <h2 className="text-xl font-extrabold">Group Information</h2>
            </div>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <DetailField icon="tag" label="Nomor Group" value={group.code} />
            <DetailField icon="groups" label="Total Jamaah" value={`${group.pax} Pax`} />
            <DetailField icon="inventory_2" label="Package" value={group.packageName || "Belum diisi"} />
            <DetailField icon="directions_bus" label="Total Bus" value={group.totalBuses ?? "Belum diisi"} />
          </dl>
        </article>

        <article className="serene-card rounded-3xl p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
              <span className="material-symbols-outlined">person</span>
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-secondary">Coordinator</p>
              <h2 className="text-xl font-extrabold">Musyrif</h2>
            </div>
          </div>
          {group.musyrif ? (
            <div className="flex items-center gap-4 rounded-2xl bg-surface-container-low p-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-fixed text-xl font-extrabold text-primary">
                {group.musyrif.avatar ? (
                  <img className="h-full w-full object-cover" src={group.musyrif.avatar} alt="" />
                ) : (
                  group.musyrif.name.slice(0, 1)
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-extrabold">{group.musyrif.name}</p>
                <p className="mt-1 text-sm text-on-surface-variant">{group.musyrif.phone || "Nomor belum tersedia"}</p>
              </div>
            </div>
          ) : (
            <EmptyState title="Musyrif belum ditentukan" />
          )}
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.45fr_.85fr]">
        <article className="serene-card rounded-3xl p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-primary">Travel Schedule</p>
              <h2 className="mt-1 text-2xl font-extrabold">Full Itinerary & Trips</h2>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {itinerary.data?.length ?? group.itinerary.length} trips
            </span>
          </div>
          <FacetState pending={itinerary.isPending} error={itinerary.isError} empty={!itinerary.data?.length}>
            <ol className="space-y-0">
              {itinerary.data?.map((item, index) => (
                <li key={item.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3">
                  <div className="relative flex justify-center">
                    {index < (itinerary.data?.length ?? 0) - 1 ? (
                      <span className="absolute top-6 h-full w-px bg-outline-variant/35" />
                    ) : null}
                    <span className="relative z-10 mt-2 h-3 w-3 rounded-full bg-primary ring-4 ring-primary/10" />
                  </div>
                  <article className="mb-4 rounded-2xl bg-surface-container-low p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[.12em] text-primary">
                          {item.category}
                        </p>
                        <h3 className="mt-1 font-extrabold">{item.title}</h3>
                      </div>
                      <time className="rounded-lg bg-surface-container-lowest px-2.5 py-1 text-xs font-bold text-on-surface-variant">
                        {item.dateLabel}
                        {item.time ? ` · ${item.time}` : ""}
                      </time>
                    </div>
                    {tripRoute(item) ? (
                      <p className="mt-3 text-sm font-semibold text-on-surface-variant">{tripRoute(item)}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
                      {item.flightNumber ? (
                        <span>
                          Flight: <b>{item.flightNumber}</b>
                        </span>
                      ) : null}
                      {item.hotelName ? (
                        <span>
                          Hotel: <b>{item.hotelName}</b>
                        </span>
                      ) : null}
                      {item.requiresBus ? <span>Bus required</span> : null}
                    </div>
                  </article>
                </li>
              ))}
            </ol>
          </FacetState>
        </article>

        <article className="serene-card h-fit rounded-3xl p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-tertiary">notes</span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.15em] text-tertiary">Information</p>
              <h2 className="text-xl font-extrabold">Notes</h2>
            </div>
          </div>
          {group.notes.length ? (
            <ul className="space-y-3">
              {group.notes.map((note) => (
                <li
                  key={note.id}
                  className={`rounded-2xl p-4 text-sm leading-relaxed ${note.pinned ? "bg-tertiary-fixed text-on-tertiary-fixed-variant" : "bg-surface-container-low text-on-surface-variant"}`}
                >
                  {note.pinned ? (
                    <span className="mb-2 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider">
                      <span className="material-symbols-outlined text-sm">keep</span>Pinned
                    </span>
                  ) : null}
                  {note.text}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Belum ada notes" />
          )}
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <article className="serene-card rounded-3xl p-5">
          <h2 className="mb-4 text-lg font-extrabold">Visa Group</h2>
          <FacetState pending={visa.isPending} error={visa.isError} empty={!visa.data?.status}>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>Status</span>
                {visa.data?.status ? <StatusChip value={visa.data.status} /> : null}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Tanggal terbit</span>
                <b>{formatDate(visa.data?.issuedDate ?? null)}</b>
              </div>
            </div>
          </FacetState>
        </article>
        <article className="serene-card rounded-3xl p-5">
          <h2 className="mb-4 text-lg font-extrabold">Hotel Agreements</h2>
          <FacetState pending={hotels.isPending} error={hotels.isError} empty={!hotels.data?.length}>
            <div className="space-y-3">
              {hotels.data?.map((hotel) => (
                <div className="rounded-xl bg-surface-container-low p-3" key={hotel.id}>
                  <div className="flex justify-between gap-2">
                    <b>{hotel.hotelName}</b>
                    <StatusChip value={hotel.status} />
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {statusLabel(hotel.city)} · {hotel.pax} pax
                  </p>
                </div>
              ))}
            </div>
          </FacetState>
        </article>
        <article className="serene-card rounded-3xl p-5">
          <h2 className="mb-4 text-lg font-extrabold">Transportation</h2>
          <FacetState pending={transport.isPending} error={transport.isError} empty={!transport.data?.length}>
            <div className="space-y-3">
              {transport.data?.map((item) => (
                <div className="rounded-xl bg-surface-container-low p-3" key={item.id}>
                  <div className="flex justify-between gap-2">
                    <b>{item.activity}</b>
                    <StatusChip value={item.status} />
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {formatDate(item.tripDate)} · {item.verifiedDriverCount}/{item.requiredBusCount} driver
                  </p>
                </div>
              ))}
            </div>
          </FacetState>
        </article>
      </section>
    </div>
  );
}
