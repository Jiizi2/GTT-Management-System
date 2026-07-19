import * as Domain from "../shared/app-domain";
import type { GroupData, ItineraryItem } from "../shared/app-domain";

const { escapeHtml, formatScheduleTime, parseDisplayDateToIso, parseTimeForInput } = Domain;

type OverviewTripRow = {
  groupCode: string;
  groupName: string;
  agentName: string;
  category: string;
  title: string;
  isoDate: string;
  dateLabel: string;
  timeLabel: string;
  routeLabel: string;
  flightNumber: string;
  requiresBus: boolean;
  sortKey: string;
};

function isInactiveGroup(group: GroupData): boolean {
  if (group.tone === "inactive") return true;
  return group.status.trim().toLowerCase().replace(/\s+/g, "").includes("inactive");
}

function formatDateLabel(isoDate: string, fallbackDate: string, fallbackYear: string): string {
  if (!isoDate) return `${fallbackDate} ${fallbackYear}`.trim();
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return `${fallbackDate} ${fallbackYear}`.trim();
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function resolveTripTime(item: ItineraryItem): string {
  const preferredTime = item.transferByTrain
    ? item.trainDepartureTime?.trim() || item.time?.trim() || ""
    : item.time?.trim() || "";
  const metaTime = parseTimeForInput(item.meta.split("|")[0] ?? "");
  const formatted = formatScheduleTime(preferredTime || metaTime || "");
  return formatted === "TBD" ? "TBD" : formatted;
}

function resolveRouteLabel(item: ItineraryItem): string {
  const from = item.from?.trim() ?? "";
  const to = item.to?.trim() ?? "";
  if (from && to) return `${from} → ${to}`;
  return from || to || "—";
}

function buildOverviewTripRows(groups: GroupData[]): OverviewTripRow[] {
  return groups
    .flatMap((group) =>
      group.itinerary.map((item) => {
        const isoDate = item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
        const timeLabel = resolveTripTime(item);
        const timeKey = /^\d{2}:\d{2}$/.test(timeLabel) ? timeLabel : "99:99";
        const safeIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : "9999-12-31";
        return {
          groupCode: group.code,
          groupName: group.name,
          agentName: group.agent?.name?.trim() || "Unassigned",
          category: item.category.trim() || "Other",
          title: item.title.trim() || "Untitled activity",
          isoDate: safeIsoDate === "9999-12-31" ? "" : safeIsoDate,
          dateLabel: formatDateLabel(isoDate, item.date, item.year),
          timeLabel,
          routeLabel: resolveRouteLabel(item),
          flightNumber: item.flightNumber?.trim() || "—",
          requiresBus: Boolean(item.requiresBus),
          sortKey: `${safeIsoDate}T${timeKey}|${group.code}`,
        };
      }),
    )
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey));
}

function getCurrentWeekIsoRange(referenceDate = new Date()): { startIso: string; endIso: string } {
  const baseDate = new Date(referenceDate);
  const daysSinceMonday = (baseDate.getDay() + 6) % 7;
  const weekStart = new Date(baseDate);
  weekStart.setDate(baseDate.getDate() - daysSinceMonday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const toLocalIsoDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return { startIso: toLocalIsoDate(weekStart), endIso: toLocalIsoDate(weekEnd) };
}

function schedulePrint(printableWindow: Window): void {
  let printed = false;
  const print = () => {
    if (printed || printableWindow.closed) return;
    printed = true;
    printableWindow.focus();
    printableWindow.print();
  };
  const fontsReady = printableWindow.document.fonts?.ready;
  if (fontsReady) void fontsReady.then(() => window.setTimeout(print, 120)).catch(print);
  printableWindow.addEventListener("load", () => window.setTimeout(print, 120), { once: true });
  window.setTimeout(print, 900);
}

export function exportOverviewReportPdf(
  {
    groups,
    query,
    isActiveOnly,
    monthLabel,
  }: {
    groups: GroupData[];
    query: string;
    isActiveOnly: boolean;
    monthLabel: string;
  },
  options: { printWindow?: Window | null } = {},
): boolean {
  const reusableWindow = options.printWindow;
  const printableWindow =
    reusableWindow && !reusableWindow.closed ? reusableWindow : window.open("", "_blank", "width=1280,height=860");
  if (!printableWindow) return false;

  const generatedTimestamp = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const exportableGroups = groups.filter((group) => !isInactiveGroup(group));
  const skippedInactiveCount = Math.max(0, groups.length - exportableGroups.length);
  const { startIso: weekStartIso, endIso: weekEndIso } = getCurrentWeekIsoRange();
  const rows = buildOverviewTripRows(exportableGroups).filter(
    (row) => row.isoDate >= weekStartIso && row.isoDate <= weekEndIso,
  );
  const normalizedQuery = query.trim();
  const scheduledGroupCodes = new Set(rows.map((row) => row.groupCode));
  const totalPilgrims = exportableGroups
    .filter((group) => scheduledGroupCodes.has(group.code))
    .reduce((total, group) => total + group.pax, 0);
  const busMovementCount = rows.filter((row) => row.requiresBus).length;
  const activeDays = new Set(rows.map((row) => row.isoDate).filter(Boolean)).size;
  const scheduledGroupCount = scheduledGroupCodes.size;
  const tripsByDate = new Map<string, number>();
  for (const row of rows) tripsByDate.set(row.isoDate, (tripsByDate.get(row.isoDate) ?? 0) + 1);
  const peakDay = [...tripsByDate.entries()].sort(
    ([leftDate, leftCount], [rightDate, rightCount]) => rightCount - leftCount || leftDate.localeCompare(rightDate),
  )[0];
  const reportRange = `${formatDateLabel(weekStartIso, "", "")} – ${formatDateLabel(weekEndIso, "", "")}`;
  const weeklyInsight = rows.length
    ? `${rows.length} trips are scheduled across ${scheduledGroupCount} groups and ${activeDays} active days this week.${
        peakDay ? ` Peak day is ${formatDateLabel(peakDay[0], "", "")} with ${peakDay[1]} trips.` : ""
      }`
    : `No trips are scheduled between ${reportRange}.`;
  const scopeLabel = isActiveOnly ? "Active groups" : "All groups";
  const logoUrl = new URL("/logo-ghaniya-travel-polos.png", window.location.origin).toString();
  const fontsUrl = new URL("/fonts.css", window.location.origin).toString();

  const tableRows = rows
    .map(
      (row, index) => `
        <tr>
          <td class="number">${index + 1}</td>
          <td>
            <strong class="primary-text">${escapeHtml(row.groupCode)}</strong>
            <span class="secondary-text">${escapeHtml(row.groupName)}</span>
            <span class="tertiary-text">${escapeHtml(row.agentName)}</span>
          </td>
          <td>
            <strong class="primary-text">${escapeHtml(row.dateLabel)}</strong>
            <span class="time-chip">${escapeHtml(row.timeLabel)}</span>
          </td>
          <td>
            <span class="category-chip">${escapeHtml(row.category)}</span>
            <span class="secondary-text activity-title">${escapeHtml(row.title)}</span>
          </td>
          <td class="route">${escapeHtml(row.routeLabel)}</td>
          <td class="center"><strong>${escapeHtml(row.flightNumber)}</strong></td>
          <td class="center"><span class="transport ${row.requiresBus ? "bus" : "none"}">${row.requiresBus ? "Bus required" : "No bus"}</span></td>
        </tr>`,
    )
    .join("");

  const printableHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Weekly Operations Report</title>
  <link rel="stylesheet" href="${escapeHtml(fontsUrl)}" />
  <style>
    :root { --brand:#087f5b; --brand-dark:#064e3b; --brand-soft:#ecfdf5; --ink:#14211d; --muted:#64748b; --line:#dce5e1; --soft:#f6f9f8; }
    * { box-sizing:border-box; }
    body { margin:0; padding:22px; color:var(--ink); background:#fff; font-family:"Inter","Segoe UI",Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .report { width:100%; max-width:1240px; margin:0 auto; }
    .masthead { display:flex; align-items:center; justify-content:space-between; gap:24px; padding:0 0 18px; border-bottom:3px solid var(--brand); }
    .brand { display:flex; align-items:center; gap:14px; }
    .logo { width:54px; height:54px; object-fit:contain; }
    .brand-name { margin:0; color:var(--brand-dark); font-size:12px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:3px 0 0; font-family:"Sora","Segoe UI",sans-serif; font-size:25px; line-height:1.15; letter-spacing:-.025em; }
    .document-meta { text-align:right; }
    .document-label { display:inline-block; padding:5px 9px; border-radius:999px; color:var(--brand-dark); background:var(--brand-soft); font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; }
    .generated { margin:8px 0 0; color:var(--muted); font-size:10px; }
    .report-context { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; padding:16px 0 13px; }
    .context-title { margin:0 0 4px; font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--brand); }
    .period { margin:0; font-size:17px; font-weight:750; }
    .filters { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:6px; }
    .filter-chip { padding:5px 8px; border:1px solid var(--line); border-radius:7px; background:var(--soft); color:#475569; font-size:9px; font-weight:650; }
    .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-bottom:13px; }
    .metric { position:relative; overflow:hidden; min-height:70px; padding:11px 12px; border:1px solid var(--line); border-radius:10px; background:#fff; }
    .metric::before { content:""; position:absolute; inset:0 auto 0 0; width:3px; background:var(--brand); }
    .metric-label { color:var(--muted); font-size:8px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
    .metric-value { display:block; margin-top:5px; font-family:"Sora",sans-serif; font-size:21px; font-weight:750; color:var(--brand-dark); }
    .metric-note { display:block; margin-top:2px; color:var(--muted); font-size:8px; }
    .insight { display:flex; align-items:flex-start; gap:9px; margin-bottom:14px; padding:9px 11px; border-radius:9px; background:var(--brand-soft); color:#315c4e; font-size:9px; line-height:1.5; }
    .insight-mark { flex:0 0 auto; width:17px; height:17px; border-radius:5px; background:var(--brand); color:#fff; text-align:center; line-height:17px; font-weight:900; }
    .section-heading { display:flex; justify-content:space-between; align-items:center; margin:0 0 7px; }
    .section-heading h2 { margin:0; font-size:12px; letter-spacing:.05em; text-transform:uppercase; }
    .section-heading span { color:var(--muted); font-size:9px; }
    table { width:100%; border-collapse:separate; border-spacing:0; table-layout:fixed; border:1px solid var(--line); border-radius:9px; overflow:hidden; }
    thead { display:table-header-group; }
    thead th { padding:8px 7px; border-bottom:1px solid var(--line); background:var(--brand-dark); color:#fff; font-size:8px; text-align:left; text-transform:uppercase; letter-spacing:.08em; }
    tbody tr:nth-child(even) { background:var(--soft); }
    tbody td { padding:8px 7px; border-bottom:1px solid #e8eeeb; font-size:9px; line-height:1.35; vertical-align:middle; overflow-wrap:anywhere; }
    tbody tr:last-child td { border-bottom:0; }
    .number,.center { text-align:center; }
    .primary-text,.secondary-text,.tertiary-text { display:block; }
    .primary-text { font-size:9px; }
    .secondary-text { margin-top:2px; color:#475569; }
    .tertiary-text { margin-top:2px; color:var(--muted); font-size:8px; }
    .time-chip,.category-chip,.transport { display:inline-block; margin-top:4px; padding:2px 5px; border-radius:5px; font-size:7px; font-weight:800; }
    .time-chip { color:var(--brand-dark); background:var(--brand-soft); }
    .category-chip { margin:0; color:#075985; background:#e0f2fe; text-transform:uppercase; letter-spacing:.04em; }
    .activity-title { margin-top:4px; }
    .route { font-weight:650; color:#334155; }
    .transport.bus { color:#92400e; background:#fef3c7; }
    .transport.none { color:#64748b; background:#eef2f6; }
    .empty { padding:24px; text-align:center; color:var(--muted); }
    .footer { display:flex; justify-content:space-between; margin-top:10px; padding-top:8px; border-top:1px solid var(--line); color:var(--muted); font-size:8px; }
    @page { size:A4 landscape; margin:10mm 11mm 12mm; }
    @media print { body { padding:0; } .report { max-width:none; } tr,.metric { break-inside:avoid; } }
  </style>
</head>
<body>
  <main class="report">
    <header class="masthead">
      <div class="brand"><img class="logo" src="${escapeHtml(logoUrl)}" alt="Ghaniya Travel" /><div><p class="brand-name">Ghaniya Tour & Travel</p><h1>Weekly Operations Report</h1></div></div>
      <div class="document-meta"><span class="document-label">Internal Operations</span><p class="generated">Generated ${escapeHtml(generatedTimestamp)}</p></div>
    </header>
    <section class="report-context">
      <div><p class="context-title">Weekly reporting period</p><p class="period">${escapeHtml(reportRange)}</p></div>
      <div class="filters"><span class="filter-chip">${escapeHtml(scopeLabel)}</span><span class="filter-chip">Source view: ${escapeHtml(monthLabel)}</span>${normalizedQuery ? `<span class="filter-chip">Search: ${escapeHtml(normalizedQuery)}</span>` : ""}${skippedInactiveCount ? `<span class="filter-chip">${skippedInactiveCount} inactive excluded</span>` : ""}</div>
    </section>
    <section class="metrics">
      <div class="metric"><span class="metric-label">Groups with trips</span><strong class="metric-value">${scheduledGroupCount}</strong><span class="metric-note">This week</span></div>
      <div class="metric"><span class="metric-label">Pilgrims</span><strong class="metric-value">${totalPilgrims}</strong><span class="metric-note">Total pax</span></div>
      <div class="metric"><span class="metric-label">Scheduled trips</span><strong class="metric-value">${rows.length}</strong><span class="metric-note">Across ${activeDays} active days</span></div>
      <div class="metric"><span class="metric-label">Bus movements</span><strong class="metric-value">${busMovementCount}</strong><span class="metric-note">Transport required</span></div>
    </section>
    <aside class="insight"><span class="insight-mark">i</span><span>${escapeHtml(weeklyInsight)}</span></aside>
    <div class="section-heading"><h2>Trip schedule</h2><span>Chronological order · ${rows.length} records</span></div>
    <table aria-label="Overview trip schedule">
      <thead><tr><th style="width:4%">No.</th><th style="width:17%">Group / Agent</th><th style="width:12%">Schedule</th><th style="width:20%">Activity</th><th style="width:24%">Route</th><th style="width:10%">Flight / Train</th><th style="width:13%">Transport</th></tr></thead>
      <tbody>${tableRows || '<tr><td class="empty" colspan="7">No trip data is available for the selected filters.</td></tr>'}</tbody>
    </table>
    <footer class="footer"><span>PT. Ghaniya Zilia Rahman · Confidential operational document</span><span>Weekly Report · ${escapeHtml(reportRange)}</span></footer>
  </main>
</body>
</html>`;

  printableWindow.document.open();
  printableWindow.document.write(printableHtml);
  printableWindow.document.close();
  schedulePrint(printableWindow);
  return true;
}
