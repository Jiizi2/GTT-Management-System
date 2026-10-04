import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { Dashboard } from "../data/contracts";
import { getAllAgentGroups } from "../data/all-groups-query";
import { groupAgentFamilies } from "../data/group-families";
import {
  calendarDays,
  departureDateLabel,
  departureJourneys,
  jakartaToday,
  monthLabel,
  shiftCalendarMonth,
  type DepartureJourney,
} from "../data/departure-calendar";
import { portalGet } from "../data/portal-query";
import { agentQueryKeys } from "../query/agent-query-boundary";
import { ErrorState, LoadingState } from "../components/data-state";
import { DepartureMonthPicker } from "../components/departure-month-picker";
import { StatusBadge } from "../../components/status-badge";
import { formatDate } from "../data/format";
import { checklistDateRange, checklistInRange, checklistReady, getAgentChecklist } from "../data/h1-checklist";
const number = new Intl.NumberFormat("id-ID");
const weekdays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
export function DashboardPage({ principalId, agentName }: { principalId: string; agentName: string }) {
  const client = useQueryClient();
  const [today] = useState(jakartaToday);
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const query = useQuery({
    queryKey: agentQueryKeys.dashboard(principalId),
    queryFn: () => portalGet<Dashboard>(client, "/dashboard"),
    staleTime: 30_000,
  });
  const groupsQuery = useQuery({
    queryKey: agentQueryKeys.groups(principalId, "departure-calendar"),
    queryFn: () => getAllAgentGroups(client),
    staleTime: 30_000,
  });
  const checklistQuery = useQuery({
    queryKey: agentQueryKeys.checklist(principalId),
    queryFn: () => getAgentChecklist(client, groupsQuery.data ?? []),
    enabled: groupsQuery.isSuccess,
    staleTime: 30_000,
  });
  const checklist = useMemo(() => {
    const range = checklistDateRange(today);
    return (checklistQuery.data ?? [])
      .filter((row) => checklistInRange(row, range))
      .sort((a, b) => Number(checklistReady(a)) - Number(checklistReady(b)));
  }, [checklistQuery.data, today]);
  const readyCount = checklist.filter(checklistReady).length;
  const departures = useMemo(() => departureJourneys(groupsQuery.data ?? []), [groupsQuery.data]);
  const journeys = departures.filter((journey) => journey.date.startsWith(month));
  const agenda = selectedDate ? journeys.filter((journey) => journey.date === selectedDate) : journeys;
  const days = calendarDays(month);
  const chooseMonth = (next: string) => {
    setMonth(next);
    setSelectedDate(null);
  };
  const selectDate = (date: string) => setSelectedDate((selected) => (selected === date ? null : date));
  if (query.isPending) return <LoadingState label="Memuat dashboard..." />;
  if (query.isError) return <ErrorState retry={() => void query.refetch()} />;
  const dashboard = query.data;
  return (
    <div className="agent-calendar-dashboard">
      <div className="agent-dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Ringkasan perjalanan dan jadwal keberangkatan Anda.</p>
        </div>
        <p className="agent-dashboard-period">{monthLabel(month)}</p>
      </div>
      <dl className="agent-dashboard-stats" aria-label="Ringkasan statistik">
        <Metric
          label="perjalanan"
          value={
            dashboard.groups.journeys ?? (groupsQuery.data ? groupAgentFamilies(groupsQuery.data).length : undefined)
          }
          icon="luggage"
          description="Total perjalanan Anda."
        />
        <Metric label="group" value={dashboard.groups.total} icon="groups" description="Total group yang ditangani." />
        <Metric
          label="jamaah"
          value={dashboard.groups.totalPax}
          icon="groups"
          description="Total jamaah di seluruh group."
        />
      </dl>
      <div className="agent-dashboard-workspace">
        <section className="agent-calendar-panel" aria-labelledby="departure-calendar-title">
          <div className="agent-calendar-header">
            <div>
              <h2 id="departure-calendar-title">Kalender keberangkatan</h2>
              <p>Jadwal keberangkatan group pada bulan ini.</p>
            </div>
            <div className="agent-month-controls">
              <button
                type="button"
                className="agent-month-arrow"
                aria-label="Bulan sebelumnya"
                disabled={month === "1000-01"}
                onClick={() => chooseMonth(shiftCalendarMonth(month, -1))}
              >
                <Icon icon="chevron_left" />
              </button>
              <DepartureMonthPicker value={month} currentMonth={today.slice(0, 7)} onChange={chooseMonth} />
              <button
                type="button"
                className="agent-month-arrow"
                aria-label="Bulan berikutnya"
                disabled={month === "9999-12"}
                onClick={() => chooseMonth(shiftCalendarMonth(month, 1))}
              >
                <Icon icon="chevron_right" />
              </button>
            </div>
          </div>
          {groupsQuery.isPending ? (
            <LoadingState label="Memuat jadwal keberangkatan…" />
          ) : groupsQuery.isError ? (
            <ErrorState retry={() => void groupsQuery.refetch()} />
          ) : (
            <>
              <div className="agent-calendar-grid">
                <table aria-label={`Kalender keberangkatan ${monthLabel(month)}`}>
                  <thead>
                    <tr>
                      {weekdays.map((day) => (
                        <th key={day} scope="col">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: days.length / 7 }, (_, week) => (
                      <tr key={week}>
                        {days.slice(week * 7, week * 7 + 7).map((day) => {
                          const events = journeys.filter((journey) => journey.date === day.date);
                          return (
                            <td
                              key={day.date}
                              className={`${!day.inMonth ? "is-adjacent" : ""} ${day.date === selectedDate ? "is-selected" : ""}`}
                            >
                              {day.inMonth ? (
                                <>
                                  <button
                                    type="button"
                                    className="agent-calendar-day"
                                    aria-label={`Lihat jadwal ${departureDateLabel(day.date)}`}
                                    aria-pressed={selectedDate === day.date}
                                    aria-current={day.date === today ? "date" : undefined}
                                    onClick={() => selectDate(day.date)}
                                  >
                                    {day.day}
                                  </button>
                                  <div className="agent-calendar-events">
                                    {events.slice(0, 2).map((journey) => (
                                      <Link
                                        key={journey.root.id}
                                        to={`/agent/groups/${encodeURIComponent(journey.root.code)}`}
                                        state={{ from: "/agent/overview" }}
                                        className="agent-calendar-event"
                                        aria-label={`Buka ${journey.root.name}, ${journey.root.code}, ${departureDateLabel(journey.date)}, ${journey.pax} jamaah${journey.dateSource === "journey" ? ", tanggal awal perjalanan" : ""}`}
                                      >
                                        <span className="agent-event-dot" aria-hidden="true" />
                                        <span>
                                          {journey.root.code} · {number.format(journey.pax)}
                                        </span>
                                      </Link>
                                    ))}
                                    {events.length > 2 ? (
                                      <button
                                        type="button"
                                        className="agent-calendar-more"
                                        onClick={() => selectDate(day.date)}
                                        aria-label={`Lihat semua ${events.length} perjalanan pada ${departureDateLabel(day.date)}`}
                                      >
                                        +{events.length - 2} lainnya
                                      </button>
                                    ) : null}
                                  </div>
                                </>
                              ) : null}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {journeys.some((journey) => journey.dateSource === "journey") ? (
                <p className="agent-calendar-note">
                  Tanggal awal perjalanan digunakan saat jadwal penerbangan belum tersedia.
                </p>
              ) : null}
              {journeys.length === 0 ? (
                <p className="agent-calendar-note">Belum ada jadwal pada {monthLabel(month)}.</p>
              ) : null}
            </>
          )}
        </section>
        <div className="agent-dashboard-sidebar">
          <section className="agent-agenda-panel" aria-labelledby="departure-agenda-title">
            <div className="agent-agenda-header">
              <h2 id="departure-agenda-title">{month < today.slice(0, 7) ? "Jadwal bulan ini" : "Jadwal mendatang"}</h2>
              <p>{selectedDate ? departureDateLabel(selectedDate) : "Daftar keberangkatan pada bulan ini."}</p>
              {selectedDate ? (
                <button type="button" className="agent-text-button" onClick={() => setSelectedDate(null)}>
                  Semua tanggal
                </button>
              ) : null}
            </div>
            {groupsQuery.isPending ? (
              <LoadingState label="Memuat agenda…" />
            ) : groupsQuery.isError ? (
              <p className="agent-calendar-note">Jadwal belum dapat dimuat. Coba kembali melalui kalender.</p>
            ) : agenda.length ? (
              <ul className="agent-departure-agenda" key={`${month}:${selectedDate ?? "all"}`}>
                {agenda.map((journey) => (
                  <AgendaJourney key={journey.root.id} journey={journey} />
                ))}
              </ul>
            ) : (
              <div className="agent-agenda-empty">
                <Icon icon="event_upcoming" />
                <h3>{selectedDate ? "Tidak ada keberangkatan" : "Jadwal berikutnya belum tersedia"}</h3>
                <p>
                  Belum ada keberangkatan pada {selectedDate ? departureDateLabel(selectedDate) : monthLabel(month)}.
                </p>
                <Link to="/agent/groups">
                  Lihat Perjalanan <Icon icon="arrow_forward" />
                </Link>
              </div>
            )}
          </section>
          <section className="agent-attention-panel" aria-labelledby="agent-attention-title">
            <h2 id="agent-attention-title">Perlu perhatian</h2>
            <p>Group yang perlu ditindaklanjuti berdasarkan data operasional.</p>
            <Attention
              label="Group perlu perhatian visa"
              description="Periksa progres dan kelengkapan dokumen."
              value={dashboard.attention.visaGroups}
              icon="description"
              to="/agent/visa"
              tone="visa"
            />
            <Attention
              label="Group perlu perhatian hotel"
              description="Tinjau kesiapan agreement perjalanan."
              value={dashboard.attention.hotelGroups}
              icon="hotel"
              to="/agent/groups"
              tone="hotel"
            />
          </section>
        </div>
      </div>
      <section className="agent-dashboard-history" aria-labelledby="agent-history-title">
        <div className="agent-history-heading">
          <h2 id="agent-history-title">H-1 Checklist</h2>
          <Link to="/agent/checklist">
            Lihat checklist <Icon icon="arrow_forward" />
          </Link>
        </div>
        <p className="agent-history-description">Kesiapan driver untuk perjalanan hari ini, besok, dan lusa.</p>
        {groupsQuery.isError || checklistQuery.isError ? (
          <ErrorState retry={() => void (groupsQuery.isError ? groupsQuery.refetch() : checklistQuery.refetch())} />
        ) : groupsQuery.isPending || checklistQuery.isPending ? (
          <LoadingState label="Memuat checklist H-1…" />
        ) : (
          <>
            <dl className="agent-lifecycle-summary" aria-label="Kesiapan H-1">
              {[
                { label: "Perlu perhatian", value: checklist.length - readyCount },
                { label: "Siap", value: readyCount },
                { label: "Jadwal", value: checklist.length },
              ].map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{number.format(item.value)}</dd>
                </div>
              ))}
            </dl>
            {checklist.length ? (
              <ol className="agent-recent-timeline">
                {checklist.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <div>
                      <p>
                        {item.group.code} · {formatDate(item.tripDate)}
                        {item.scheduledTime ? ` · ${item.scheduledTime}` : ""}
                      </p>
                      <strong>
                        <Link
                          to={`/agent/groups/${encodeURIComponent(item.group.code)}`}
                          state={{ from: "/agent/overview" }}
                        >
                          {item.activity} · {item.tripLabel}
                        </Link>
                      </strong>
                      <span>{item.group.name}</span>
                      <div className="agent-checklist-readiness">
                        <StatusBadge tone={checklistReady(item) ? "complete" : "attention"}>
                          {checklistReady(item) ? "Siap" : "Perlu perhatian"}
                        </StatusBadge>
                        <span>
                          {item.verifiedDriverCount}/{item.requiredBusCount} driver terverifikasi
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="agent-history-empty">Tidak ada jadwal checklist untuk hari ini, besok, atau lusa.</p>
            )}
          </>
        )}
      </section>
      <p className="agent-dashboard-owner">Ruang kerja {agentName}</p>
    </div>
  );
}
function Icon({ icon }: { icon: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {icon}
    </span>
  );
}
function Metric({
  label,
  value,
  icon,
  description,
}: {
  label: string;
  value: number | undefined;
  icon: string;
  description: string;
}) {
  return (
    <div className="agent-dashboard-metric">
      <span className="agent-metric-icon">
        <Icon icon={icon} />
      </span>
      <div>
        <div className="agent-metric-value">
          <dd>{value === undefined ? "—" : number.format(value)}</dd>
          <dt>{label}</dt>
        </div>
        <p>{description}</p>
      </div>
    </div>
  );
}
function AgendaJourney({ journey }: { journey: DepartureJourney }) {
  const date = new Date(`${journey.date}T12:00:00Z`);
  const shortMonth = new Intl.DateTimeFormat("id-ID", { month: "short", year: "numeric", timeZone: "UTC" }).format(
    date,
  );
  const dayName = new Intl.DateTimeFormat("id-ID", { weekday: "short", timeZone: "UTC" }).format(date);
  return (
    <li>
      <Link
        to={`/agent/groups/${encodeURIComponent(journey.root.code)}`}
        state={{ from: "/agent/overview" }}
        className="agent-agenda-journey"
        aria-label={`Lihat perjalanan ${journey.root.code}, ${journey.root.name}, ${departureDateLabel(journey.date)}${journey.dateSource === "journey" ? ", tanggal awal perjalanan" : ""}`}
      >
        <time dateTime={journey.date} className="agent-agenda-date">
          <strong>{Number(journey.date.slice(8))}</strong>
          <span>{shortMonth}</span>
          <span>{dayName}</span>
        </time>
        <div className="agent-agenda-details">
          <span className="agent-agenda-code">{journey.root.code}</span>
          <strong>{journey.root.name}</strong>
          <span className="agent-agenda-counts">
            <span>
              <Icon icon="groups" />
              {number.format(journey.pax)} jamaah
            </span>
            <span>
              <Icon icon="groups" />
              {number.format(journey.members.length)} group
            </span>
          </span>
          {journey.dateSource === "journey" ? <span className="agent-date-source">Awal perjalanan</span> : null}
        </div>
        <Icon icon="arrow_forward" />
      </Link>
    </li>
  );
}
function Attention({
  label,
  description,
  value,
  icon,
  to,
  tone,
}: {
  label: string;
  description: string;
  value: number;
  icon: string;
  to: string;
  tone: string;
}) {
  return (
    <Link to={to} className="agent-attention-row">
      <span className={`agent-attention-icon ${tone}`}>
        <Icon icon={icon} />
      </span>
      <span className="agent-attention-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <strong className="agent-attention-value">{number.format(value)}</strong>
      <Icon icon="arrow_forward" />
    </Link>
  );
}
