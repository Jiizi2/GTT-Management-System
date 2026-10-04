import type { GroupFlightLeg, GroupVisaSetup } from "../../shared/app-domain";
import { createLegacyFlightLegs, getFlightLegsByDirection, hasFlightLegContent } from "../../shared/flight-plan";

export function AgentVisaFlights({ visa }: { visa: GroupVisaSetup | undefined }) {
  const recordedLegs = visa?.flightLegs?.filter(hasFlightLegContent) ?? [];
  const legs = recordedLegs.length ? recordedLegs : createLegacyFlightLegs(visa);
  return (
    <section className="visa-flight-section visa-detail-surface" aria-labelledby="visa-flight-title">
      <header>
        <h2 id="visa-flight-title">Detail Penerbangan</h2>
        <p>Rute penerbangan internasional direct atau transit per segmen.</p>
      </header>
      <div className="visa-flight-directions">
        <FlightDirection legs={getFlightLegsByDirection(legs, "ONWARD")} direction="ONWARD" />
        <FlightDirection legs={getFlightLegsByDirection(legs, "RETURN")} direction="RETURN" />
      </div>
    </section>
  );
}

function FlightDirection({ legs, direction }: { legs: GroupFlightLeg[]; direction: "ONWARD" | "RETURN" }) {
  const completeRoute =
    legs.length > 0 && legs.every((leg) => leg.departureAirportCode.trim() && leg.arrivalAirportCode.trim());
  const routeStatus = !legs.length
    ? "Belum tercatat"
    : !completeRoute
      ? "Rute belum lengkap"
      : legs.length === 1
        ? "Direct"
        : `${legs.length} segmen · Transit`;
  const onward = direction === "ONWARD";
  return (
    <section className="visa-flight-direction" aria-label={onward ? "Penerbangan berangkat" : "Penerbangan pulang"}>
      <header>
        <h3>
          <span className="material-symbols-outlined" aria-hidden="true">
            {onward ? "flight_takeoff" : "flight_land"}
          </span>
          <span className="visa-flight-desktop-label">{onward ? "Onward" : "Return"}</span>
          <span className="visa-flight-mobile-label">{onward ? "Berangkat" : "Pulang"}</span>
        </h3>
        <span className="visa-flight-route-status">{routeStatus}</span>
      </header>
      {!legs.length ? (
        <p className="visa-flight-empty">Penerbangan {onward ? "berangkat" : "pulang"} belum tercatat.</p>
      ) : (
        <ol>
          {legs.map((leg, index) => (
            <li key={leg.id ?? `${direction}-${index}`} className="visa-flight-leg">
              {legs.length > 1 ? <span className="visa-flight-segment">Segmen {index + 1}</span> : null}
              <div className="visa-flight-leg-data">
                <div className="visa-flight-route">
                  <strong>
                    {leg.departureAirportCode || "Belum tercatat"}
                    <span className="material-symbols-outlined" aria-hidden="true">
                      arrow_forward
                    </span>
                    {leg.arrivalAirportCode || "Belum tercatat"}
                  </strong>
                  <p>
                    {[leg.carrierCode, leg.flightNumber].filter(Boolean).join(" · ") ||
                      "Nomor penerbangan belum tercatat"}
                  </p>
                </div>
                <dl className="visa-flight-times">
                  <FlightTime label="ETD" date={leg.departureDate} time={leg.departureTime} />
                  <FlightTime label="ETA" date={leg.arrivalDate} time={leg.arrivalTime} />
                </dl>
              </div>
              {leg.remarks ? <p className="visa-flight-remarks">{leg.remarks}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function FlightTime({ label, date, time }: { label: string; date: string; time: string }) {
  const parsed = date ? new Date(`${date.slice(0, 10)}T00:00:00`) : null;
  const formatted =
    parsed && !Number.isNaN(parsed.getTime())
      ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(parsed)
      : null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {formatted || "Tanggal belum tercatat"}
        {time ? ` · ${time}` : " · Waktu belum tercatat"}
      </dd>
    </div>
  );
}
