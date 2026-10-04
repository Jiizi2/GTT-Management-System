import * as Domain from "../shared/app-domain";
import type { GroupData, ItineraryItem } from "../shared/app-domain";

const { escapeHtml, formatScheduleTime, parseDisplayDateToIso, parseTimeForInput, resolveItineraryBusCount } = Domain;

type OverviewTripRow = {
  groupCode: string;
  groupName: string;
  agentName: string;
  category: string;
  title: string;
  isoDate: string;
  timeLabel: string;
  routeLabel: string;
  flightNumber: string;
  busCount: number;
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
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
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
          timeLabel,
          routeLabel: resolveRouteLabel(item),
          flightNumber: item.flightNumber?.trim() || "—",
          busCount: resolveItineraryBusCount(item),
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

  const generatedTimestamp = new Date().toLocaleString("id-ID", {
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
  const busMovementCount = rows.reduce((total, row) => total + row.busCount, 0);
  const scheduledGroupCount = scheduledGroupCodes.size;
  const tripsByDate = new Map<string, OverviewTripRow[]>();
  for (const row of rows) {
    const dailyRows = tripsByDate.get(row.isoDate) ?? [];
    dailyRows.push(row);
    tripsByDate.set(row.isoDate, dailyRows);
  }
  const reportRange = `${formatDateLabel(weekStartIso, "", "")} – ${formatDateLabel(weekEndIso, "", "")}`;
  const scopeLabel = isActiveOnly ? "Group di Saudi" : "Semua group";
  const logoUrl = new URL("/logo-ghaniya-travel-polos.png", window.location.origin).toString();
  const fontsUrl = new URL("/fonts.css", window.location.origin).toString();

  const dailySchedules = [...tripsByDate.entries()]
    .map(([isoDate, dailyRows]) => {
      const dateLabel = new Date(`${isoDate}T12:00:00`).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const tableRows = dailyRows
        .map(
          (row) => `
        <tr>
          <td class="time">${escapeHtml(row.timeLabel)}</td>
          <td>
            <strong class="primary-text">${escapeHtml(row.groupCode)}</strong>
            <span class="secondary-text">${escapeHtml(row.groupName)}</span>
            <span class="tertiary-text">Agent: ${escapeHtml(row.agentName)}</span>
          </td>
          <td>
            <span class="category">${escapeHtml(row.category)}</span>
            <span class="secondary-text activity-title">${escapeHtml(row.title)}</span>
          </td>
          <td class="route">${escapeHtml(row.routeLabel)}</td>
          <td class="center">${escapeHtml(row.flightNumber)}</td>
          <td class="center transport">${row.busCount > 0 ? `${row.busCount} bus` : "—"}</td>
        </tr>`,
        )
        .join("");
      return `
    <section class="daily-schedule">
      <table aria-label="Jadwal ${escapeHtml(dateLabel)}">
        <colgroup><col style="width:9%" /><col style="width:22%" /><col style="width:23%" /><col style="width:26%" /><col style="width:12%" /><col style="width:8%" /></colgroup>
        <thead>
          <tr><th class="day-heading" colspan="6"><div class="day-title"><h2>${escapeHtml(dateLabel)}</h2><span>${dailyRows.length} aktivitas</span></div></th></tr>
          <tr class="column-headings"><th scope="col">Jam</th><th scope="col">Group / Agent</th><th scope="col">Aktivitas</th><th scope="col">Rute</th><th scope="col" class="center">Flight / Train</th><th scope="col" class="center">Bus</th></tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </section>`;
    })
    .join("");

  const printableHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Laporan Operasional Mingguan</title>
  <link rel="stylesheet" href="${escapeHtml(fontsUrl)}" />
  <style>
    :root { --ink:#202020; --muted:#595959; --line:#d6d6d6; }
    * { box-sizing:border-box; }
    body { margin:0; padding:24px; color:var(--ink); background:#fff; font-family:"Inter","Segoe UI",Arial,sans-serif; font-size:10pt; font-weight:400; line-height:1.25; font-variant-numeric:tabular-nums; }
    .report { width:100%; max-width:1040px; margin:0 auto; }
    .masthead { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; padding-bottom:10px; border-bottom:1px solid var(--line); }
    .brand { display:flex; align-items:center; gap:14px; min-width:0; }
    .logo { width:42px; height:52px; object-fit:contain; filter:grayscale(1); }
    .brand-name { margin:0 0 4px; font-size:8pt; font-weight:500; letter-spacing:.12em; text-transform:uppercase; }
    h1 { margin:0; font-family:"Manrope","Inter",sans-serif; font-size:20pt; font-weight:600; line-height:1.2; letter-spacing:-.02em; }
    .period { margin:4px 0 0; color:var(--muted); font-size:11pt; }
    .document-meta { flex-shrink:0; padding-top:3px; text-align:right; color:var(--muted); font-size:8pt; }
    .document-label { font-weight:500; letter-spacing:.08em; text-transform:uppercase; }
    .generated { margin:6px 0 0; }
    .metrics { display:grid; grid-template-columns:repeat(4,1fr); margin:12px 0 6px; }
    .metric { padding:0 14px; text-align:center; }
    .metric + .metric { border-left:1px solid var(--line); }
    .metric-value { display:block; font-size:22pt; font-weight:500; line-height:1.2; }
    .metric-label { display:block; margin-top:3px; color:var(--muted); font-size:8pt; font-weight:500; letter-spacing:.1em; text-transform:uppercase; }
    .metric-note { margin:0 0 10px; color:var(--muted); font-size:8pt; }
    .daily-schedule { margin-top:12px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    thead { display:table-header-group; }
    th { text-align:left; font-weight:500; }
    .day-heading { padding:0 0 5px; }
    .day-title { display:flex; justify-content:space-between; align-items:baseline; gap:16px; }
    .day-title h2 { margin:0; font-family:"Manrope","Inter",sans-serif; font-size:11pt; font-weight:600; }
    .day-title span { flex-shrink:0; color:var(--muted); font-size:9pt; font-weight:400; }
    .column-headings th { padding:4px 8px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); color:var(--muted); font-size:9pt; }
    tbody td { padding:4px 8px; border-bottom:1px solid var(--line); line-height:1.2; vertical-align:middle; overflow-wrap:anywhere; }
    .time { font-size:13pt; font-weight:600; white-space:nowrap; }
    .center { text-align:center; }
    .primary-text,.secondary-text,.tertiary-text { display:block; }
    .primary-text { font-weight:600; }
    .secondary-text { margin-top:1px; color:var(--muted); }
    .tertiary-text { margin-top:1px; color:var(--muted); font-size:9pt; }
    .category,.route { font-weight:500; }
    .transport { white-space:nowrap; }
    .empty { padding:24px 0; border-top:1px solid var(--line); border-bottom:1px solid var(--line); color:var(--muted); }
    .empty h2 { margin:0 0 6px; color:var(--ink); font-size:12pt; font-weight:500; }
    .empty p { margin:0; }
    .footer { display:flex; justify-content:space-between; gap:20px; margin-top:4px; padding-top:4px; border-top:1px solid var(--line); color:var(--muted); font-size:8pt; overflow-wrap:anywhere; }
    .footer p { margin:0; }
    .footer p:last-child { max-width:36%; text-align:right; }
    @page { size:A4 landscape; margin:10mm 11mm; @bottom-right { content:"Halaman " counter(page); font-family:"Inter",Arial,sans-serif; font-size:8pt; color:#595959; } }
    @media print { body { padding:0; } .report { max-width:none; } tr,.masthead,.metrics,.empty { break-inside:avoid; } thead { break-inside:avoid; } .footer { break-inside:avoid; } }
  </style>
</head>
<body>
  <main class="report">
    <header class="masthead">
      <div class="brand"><img class="logo" src="${escapeHtml(logoUrl)}" alt="Ghaniya Travel" /><div><p class="brand-name">Ghaniya Tour & Travel</p><h1>Laporan Operasional Mingguan</h1><p class="period">${escapeHtml(reportRange)}</p></div></div>
      <div class="document-meta"><span class="document-label">Internal Operations</span><p class="generated">Dicetak: ${escapeHtml(generatedTimestamp)}</p></div>
    </header>
    <section class="metrics" aria-label="Ringkasan minggu berjalan">
      <div class="metric"><strong class="metric-value">${scheduledGroupCount}</strong><span class="metric-label">Group</span></div>
      <div class="metric"><strong class="metric-value">${totalPilgrims}</strong><span class="metric-label">Jamaah</span></div>
      <div class="metric"><strong class="metric-value">${rows.length}</strong><span class="metric-label">Aktivitas</span></div>
      <div class="metric"><strong class="metric-value">${busMovementCount}</strong><span class="metric-label">Pergerakan bus</span></div>
    </section>
    <p class="metric-note">Jamaah dihitung per group yang memiliki jadwal minggu ini; pergerakan bus dijumlahkan per aktivitas.</p>
    ${dailySchedules || `<section class="empty"><h2>Belum ada aktivitas minggu ini</h2><p>Tidak ada jadwal pada ${escapeHtml(reportRange)} untuk filter yang dipilih.</p></section>`}
    <footer class="footer"><p>Sumber: Overview · ${escapeHtml(monthLabel)} · ${escapeHtml(scopeLabel)}${normalizedQuery ? ` · Pencarian: ${escapeHtml(normalizedQuery)}` : ""} · Group nonaktif dikecualikan${skippedInactiveCount ? ` (${skippedInactiveCount})` : ""}</p><p>PT. Ghaniya Zilia Rahman · Dokumen operasional internal</p></footer>
  </main>
</body>
</html>`;

  printableWindow.document.open();
  printableWindow.document.write(printableHtml);
  printableWindow.document.close();
  schedulePrint(printableWindow);
  return true;
}
