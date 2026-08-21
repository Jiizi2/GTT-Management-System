import { useVisaDetailContext } from "../context/VisaDetailContext";
import { resolveGroupFlightDetails } from "../visa-detail-helpers";

function FlightFact({
  label,
  icon,
  flightNumber,
  time,
}: {
  label: string;
  icon: string;
  flightNumber?: string;
  time?: string;
}) {
  const trimmedFlight = flightNumber?.trim() ?? "";
  const trimmedTime = time?.trim() ?? "";
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
        <span className="material-symbols-outlined text-sm" aria-hidden="true">
          {icon}
        </span>
        {label}
      </span>
      <strong className="mt-1 block truncate text-base font-black text-slate-900">
        {trimmedFlight || "Belum diisi"}
      </strong>
      <span className="text-xs font-semibold text-slate-500">{trimmedTime ? `${trimmedTime} LT` : "Jam belum diisi"}</span>
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

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
            flight
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900">Detail Penerbangan</h2>
            <p className="text-xs font-semibold text-slate-500">
              Nomor & jam penerbangan untuk pengajuan MOFA visa. Struktur perjalanan dibuat otomatis di Group Detail.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-2 text-xs font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary sm:py-1.5"
          onClick={openFlightModal}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            edit
          </span>
          <span>Edit Penerbangan</span>
        </button>
      </div>

      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2 sm:gap-0">
        <div className="border-b border-slate-200 pb-3 sm:border-b-0 sm:pr-4">
          <FlightFact
            label="Flight Kedatangan"
            icon="flight_land"
            flightNumber={flight.arrivalFlightNumber}
            time={flight.arrivalTime}
          />
        </div>
        <div className="pt-3 sm:border-l sm:border-slate-200 sm:pl-4 sm:pt-0">
          <FlightFact
            label="Flight Kepulangan"
            icon="flight_takeoff"
            flightNumber={flight.departureFlightNumber}
            time={flight.departureTime}
          />
        </div>
      </div>
    </section>
  );
}
