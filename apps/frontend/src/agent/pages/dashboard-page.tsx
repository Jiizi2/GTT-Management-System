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
import { DataBoundary } from "../../components/data-boundary";
import { CalendarSkeleton, ChecklistSkeleton, ListSkeleton, MetricsSkeleton } from "../../components/skeleton";
import { DepartureMonthPicker } from "../components/departure-month-picker";
import { StatusBadge } from "../../components/status-badge";
import { GroupIdentity } from "../../components/group-identity";
import { Icon } from "../../components/icon";
import { MetricCard } from "../../components/metric-card";
import { PageHeader } from "../../components/page-header";
import { PageLayout } from "../../components/page-layout";
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
    queryFn: ({ signal }) => portalGet<Dashboard>(client, "/dashboard", signal),
    staleTime: 30_000,
  });
  const groupsQuery = useQuery({
    queryKey: agentQueryKeys.groups(principalId, "departure-calendar"),
    queryFn: ({ signal }) => getAllAgentGroups(client, "asc", signal),
    staleTime: 30_000,
  });
  const checklistQuery = useQuery({
    queryKey: agentQueryKeys.checklist(principalId),
    queryFn: ({ signal }) => getAgentChecklist(client, groupsQuery.data ?? [], signal),
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
  const dashboard = query.data;
  return (
    <PageLayout width="workspace" className="agent-calendar-dashboard agent-page-layout">
      <PageHeader
        variant="compact"
        title="Dashboard"
        description="Ringkasan perjalanan dan jadwal keberangkatan Anda."
        actions={<span className="font-display text-lg font-extrabold text-on-surface">{monthLabel(month)}</span>}
      />
      <DataBoundary query={query} skeleton={<MetricsSkeleton className="agent-dashboard-stats" variant="compact" metricClassName="agent-dashboard-metric" />} >
      <div className="agent-dashboard-stats" aria-label="Ringkasan statistik">
        <Metric
          label="perjalanan"
          value={
            dashboard?.groups.journeys ?? (groupsQuery.data ? groupAgentFamilies(groupsQuery.data).length : undefined)
          }
          icon="luggage"
          description="Total perjalanan Anda."
        />
        <Metric label="group" value={dashboard?.groups.total} icon="groups" description="Total group yang ditangani." />
        <Metric
          label="jamaah"
          value={dashboard?.groups.totalPax}
          icon="groups"
          description="Total jamaah di seluruh group."
        />
      </div>
      </DataBoundary>
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
                <Icon name="chevron_left" />
              </button>
              <DepartureMonthPicker value={month} currentMonth={today.slice(0, 7)} onChange={chooseMonth} />
              <button
                type="button"
                className="agent-month-arrow"
                aria-label="Bulan berikutnya"
                disabled={month === "9999-12"}
                onClick={() => chooseMonth(shiftCalendarMonth(month, 1))}
              >
                <Icon name="chevron_right" />
              </button>
            </div>
          </div>
          <DataBoundary query={groupsQuery} skeleton={<CalendarSkeleton weeks={days.length / 7} />}>
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
                                        viewTransition
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
          </DataBoundary>
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
            <DataBoundary query={groupsQuery} skeleton={<ListSkeleton rows={3} columns={2} label="Memuat agenda…" />}>
            {agenda.length ? (
              <ul className="agent-departure-agenda" key={`${month}:${selectedDate ?? "all"}`}>
                {agenda.map((journey) => (
                  <AgendaJourney key={journey.root.id} journey={journey} />
                ))}
              </ul>
            ) : (
              <div className="agent-agenda-empty">
                <Icon name="event_upcoming" />
                <h3>{selectedDate ? "Tidak ada keberangkatan" : "Jadwal berikutnya belum tersedia"}</h3>
                <p>
                  Belum ada keberangkatan pada {selectedDate ? departureDateLabel(selectedDate) : monthLabel(month)}.
                </p>
                <Link viewTransition to="/agent/groups">
                  Lihat Perjalanan <Icon name="arrow_forward" />
                </Link>
              </div>
            )}
            </DataBoundary>
          </section>
          <section className="agent-attention-panel" aria-labelledby="agent-attention-title">
            <h2 id="agent-attention-title">Perlu perhatian</h2>
            <p>Group yang perlu ditindaklanjuti berdasarkan data operasional.</p>
            <DataBoundary query={query} skeleton={<ListSkeleton rows={2} columns={2} label="Memuat tindak lanjut…" />}>
            <Attention
              label="Group perlu perhatian visa"
              description="Periksa progres dan kelengkapan dokumen."
              value={dashboard?.attention.visaGroups ?? 0}
              icon="description"
              to="/agent/visa"
              tone="visa"
            />
            <Attention
              label="Group perlu perhatian hotel"
              description="Tinjau kesiapan agreement perjalanan."
              value={dashboard?.attention.hotelGroups ?? 0}
              icon="hotel"
              to="/agent/groups"
              tone="hotel"
            />
            </DataBoundary>
          </section>
        </div>
      </div>
      <section className="agent-dashboard-history" aria-labelledby="agent-history-title">
        <div className="agent-history-heading">
          <h2 id="agent-history-title">H-1 Checklist</h2>
          <Link viewTransition to="/agent/checklist">
            Lihat checklist <Icon name="arrow_forward" />
          </Link>
        </div>
        <p className="agent-history-description">Kesiapan driver untuk perjalanan hari ini, besok, dan lusa.</p>
        <DataBoundary query={checklistQuery.data !== undefined ? checklistQuery : groupsQuery.isError ? { ...groupsQuery, data: undefined } : checklistQuery} skeleton={<ChecklistSkeleton rows={2} />}>
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
                          viewTransition
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
        </DataBoundary>
      </section>
      <p className="agent-dashboard-owner">Ruang kerja {agentName}</p>
    </PageLayout>
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
    <MetricCard
      variant="compact"
      className="agent-dashboard-metric"
      label={label}
      value={value === undefined ? "—" : number.format(value)}
      icon={icon}
      supportingText={description}
    />
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
        viewTransition
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
          <GroupIdentity code={journey.root.code} name={journey.root.name} />
          <span className="agent-agenda-counts">
            <span>
              <Icon name="groups" />
              {number.format(journey.pax)} jamaah
            </span>
            <span>
              <Icon name="groups" />
              {number.format(journey.members.length)} group
            </span>
          </span>
          {journey.dateSource === "journey" ? <span className="agent-date-source">Awal perjalanan</span> : null}
        </div>
        <Icon name="arrow_forward" />
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
    <Link viewTransition to={to} className="agent-attention-row">
      <span className={`agent-attention-icon ${tone}`}>
        <Icon name={icon} />
      </span>
      <span className="agent-attention-copy">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <strong className="agent-attention-value">{number.format(value)}</strong>
      <Icon name="arrow_forward" />
    </Link>
  );
}
