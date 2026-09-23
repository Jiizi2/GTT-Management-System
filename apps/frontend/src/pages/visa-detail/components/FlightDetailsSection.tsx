import { useVisaDetailContext } from "../context/VisaDetailContext";
import { formatVisaDateWithYear } from "../../../shared/app-domain";
import { resolveGroupFlightDetails } from "../visa-detail-helpers";
import { getFlightLegsByDirection, hasFlightLegContent } from "../../../shared/flight-plan";
import type { FlightDirection, GroupFlightLeg } from "../../../shared/app-domain";

function FlightLegRow({ leg }: { leg: GroupFlightLeg }) {
  const from = leg.departureAirportCode.trim().toUpperCase();
  const to = leg.arrivalAirportCode.trim().toUpperCase();
  const routeComplete = Boolean(from && to);
  return (
    <li className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <strong className={`text-base font-black tracking-tight ${routeComplete ? "text-slate-900" : "text-slate-500"}`}>
            {from || "—"} <span className="mx-1 text-slate-400">→</span> {to || "—"}
          </strong>
          {!routeComplete ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">Rute belum lengkap</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-600">
          {[leg.carrierCode, leg.flightNumber].filter(Boolean).join(" · ") || "Nomor penerbangan belum diisi"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-slate-600 sm:justify-end">
        <span>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-slate-400">ETD</span>{" "}
          {leg.departureDate ? formatVisaDateWithYear(leg.departureDate) : "—"} · {leg.departureTime || "—"}
        </span>
        <span>
          <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-slate-400">ETA</span>{" "}
          {leg.arrivalDate ? formatVisaDateWithYear(leg.arrivalDate) : "—"} · {leg.arrivalTime || "—"}
        </span>
      </div>
    </li>
  );
}

function FlightDirectionPanel({
  label,
  direction,
  legs,
}: {
  label: string;
  direction: FlightDirection;
  legs: GroupFlightLeg[];
}) {
  const visibleLegs = legs.filter(hasFlightLegContent);
  const hasCompleteRoute = visibleLegs.every(
    (leg) => leg.departureAirportCode.trim() && leg.arrivalAirportCode.trim(),
  );

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-brand-primary" aria-hidden="true">
            {direction === "ONWARD" ? "flight_takeoff" : "flight_land"}
          </span>
          <span className="text-sm font-extrabold text-slate-800">{label}</span>
        </div>
        <span className="text-[11px] font-bold text-slate-500">
          {visibleLegs.length === 0
            ? "Belum diisi"
            : !hasCompleteRoute
              ? "Perlu dilengkapi"
              : visibleLegs.length === 1
                ? "Direct"
                : `${visibleLegs.length} segmen · Transit`}
        </span>
      </div>
      {visibleLegs.length > 0 ? (
        <ol className="divide-y divide-slate-200">
          {visibleLegs.map((leg, index) => <FlightLegRow key={leg.id ?? `${direction}-${index}`} leg={leg} />)}
        </ol>
      ) : (
        <p className="px-4 py-5 text-sm font-medium text-slate-500 sm:px-5">Belum ada rute penerbangan.</p>
      )}
    </div>
  );
}

/**
 * Flight-only section: ops just enters the arrival/departure flight number and
 * time. Saving it (see handleUpdateFlightDetails) auto-generates the base trip
 * structure — arrival, transfer, departure — into the same group record, so it
 * shows up on Group Detail with no separate build step.
 */
export function FlightDetailsSection() {
  const { group, openFlightModal } = useVisaDetailContext();
  const flight = resolveGroupFlightDetails(group);
  const onwardLegs = getFlightLegsByDirection(flight.flightLegs, "ONWARD");
  const returnLegs = getFlightLegsByDirection(flight.flightLegs, "RETURN");

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-surface-container-lowest">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-slate-900">Detail Penerbangan</h2>
          <p className="mt-0.5 text-sm font-medium text-slate-600">
            Rute penerbangan internasional direct atau transit per segmen.
          </p>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg px-3 text-sm font-bold text-brand-primary transition hover:bg-brand-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:min-h-10"
          onClick={openFlightModal}
        >
          Ubah detail
        </button>
      </div>

      <div className="relative border-t border-slate-200 bg-slate-50/60 lg:grid lg:grid-cols-2">
        <div className="border-b border-slate-200 lg:border-b-0">
          <FlightDirectionPanel label="Onward" direction="ONWARD" legs={onwardLegs} />
        </div>
        <div className="lg:border-l lg:border-slate-200">
          <FlightDirectionPanel label="Return" direction="RETURN" legs={returnLegs} />
        </div>
      </div>
    </section>
  );
}
