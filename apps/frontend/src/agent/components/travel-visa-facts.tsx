import type { GroupVisaSetup } from "../../shared/app-domain-types";
import { formatDate } from "../data/format";

export function TravelVisaFacts({ visa }: { visa: GroupVisaSetup | undefined }) {
  const flights = visa?.flightLegs ?? [];
  const appointments = visa?.raudhahAppointments ?? [];
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="serene-section p-5 sm:p-6" aria-labelledby="agent-flights-title">
        <h2 id="agent-flights-title" className="text-lg font-extrabold">
          Penerbangan dan transit
        </h2>
        {flights.length === 0 ? (
          <p className="mt-3 text-sm text-on-surface-variant">
            Rincian penerbangan belum dicatat. Jadwal yang tersedia dapat dilihat pada itinerary.
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-outline-variant/30">
            {flights.map((flight, index) => (
              <li key={flight.id ?? index} className="py-4 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold">
                    {flight.departureAirportCode || "Bandara belum dicatat"} →{" "}
                    {flight.arrivalAirportCode || "Bandara belum dicatat"}
                  </h3>
                  <span className="text-xs font-semibold text-on-surface-variant">
                    {flight.direction === "ONWARD" ? "Berangkat" : "Kembali"} · Segmen {flight.sortOrder + 1}
                  </span>
                </div>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Fact label="Nomor penerbangan" value={flight.flightNumber || "Belum dicatat"} />
                  <Fact label="Maskapai" value={flight.carrierCode || "Belum dicatat"} />
                  <Fact
                    label="Keberangkatan"
                    value={`${formatDate(flight.departureDate || null)} · ${flight.departureTime || "Waktu belum dicatat"}`}
                  />
                  <Fact
                    label="Kedatangan"
                    value={`${formatDate(flight.arrivalDate || null)} · ${flight.arrivalTime || "Waktu belum dicatat"}`}
                  />
                </dl>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section className="serene-section p-5 sm:p-6" aria-labelledby="agent-raudhah-title">
        <h2 id="agent-raudhah-title" className="text-lg font-extrabold">
          Raudhah dan tasreh
        </h2>
        {appointments.length === 0 ? (
          <p className="mt-3 text-sm text-on-surface-variant">Jadwal Raudhah belum dicatat untuk group ini.</p>
        ) : (
          <ul className="mt-4 divide-y divide-outline-variant/30">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="py-4 first:pt-0">
                <h3 className="text-sm font-extrabold">{formatDate(appointment.dateIso || null)}</h3>
                <p className="mt-2 text-sm text-on-surface-variant">Status: {appointment.status}</p>
                <p className="mt-1 text-sm font-semibold text-on-surface">
                  {appointment.tasrehPrinted ? "Tasreh sudah dicetak" : "Tasreh belum dicetak"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-on-surface-variant">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}
