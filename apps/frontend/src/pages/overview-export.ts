import * as Domain from "../shared/app-domain";
import type { GroupData, ItineraryItem } from "../shared/app-domain";

const { escapeHtml, formatScheduleTime, parseDisplayDateToIso, parseTimeForInput } = Domain;

type OverviewTripRow = {
  groupCode: string;
  groupName: string;
  category: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  routeLabel: string;
  flightNumber: string;
  requiresBusLabel: string;
  sortKey: string;
};

function isInactiveGroup(group: GroupData): boolean {
  if (group.tone === "inactive") {
    return true;
  }

  const normalizedStatus = group.status.trim().toLowerCase().replace(/\s+/g, "");
  return normalizedStatus.includes("inactive");
}

function formatDateLabel(isoDate: string, fallbackDate: string, fallbackYear: string): string {
  if (!isoDate) {
    return `${fallbackDate} ${fallbackYear}`.trim();
  }

  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return `${fallbackDate} ${fallbackYear}`.trim();
  }

  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

function resolveTripTime(item: ItineraryItem): string {
  const preferredTime = item.transferByTrain
    ? item.trainDepartureTime?.trim() || item.time?.trim() || ""
    : item.time?.trim() || "";
  const metaTime = parseTimeForInput(item.meta.split("|")[0] ?? "");
  const formatted = formatScheduleTime(preferredTime || metaTime || "");

  return formatted === "TBD" ? "-" : formatted;
}

function resolveRouteLabel(item: ItineraryItem): string {
  const from = item.from?.trim() ?? "";
  const to = item.to?.trim() ?? "";

  if (from && to) {
    return `${from} -> ${to}`;
  }

  if (from || to) {
    return from || to;
  }

  return "-";
}

function buildOverviewTripRows(groups: GroupData[]): OverviewTripRow[] {
  const rows = groups.flatMap((group) =>
    group.itinerary.map((item) => {
      const isoDate = item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
      const timeLabel = resolveTripTime(item);
      const timeKey = timeLabel !== "-" && /^\d{2}:\d{2}$/.test(timeLabel) ? timeLabel : "99:99";
      const safeIsoDate = isoDate && /^\d{4}-\d{2}-\d{2}$/.test(isoDate) ? isoDate : "9999-12-31";

      return {
        groupCode: group.code,
        groupName: group.name,
        category: item.category.trim() || "-",
        title: item.title.trim() || "-",
        dateLabel: formatDateLabel(isoDate, item.date, item.year),
        timeLabel,
        routeLabel: resolveRouteLabel(item),
        flightNumber: item.flightNumber?.trim() || "-",
        requiresBusLabel: item.requiresBus ? "Yes" : "No",
        sortKey: `${safeIsoDate}T${timeKey}|${group.code}`,
      };
    }),
  );

  return rows.sort((left, right) => left.sortKey.localeCompare(right.sortKey));
}

export function exportOverviewReportPdf({
  groups,
  query,
  isActiveOnly,
  summaryMessage,
}: {
  groups: GroupData[];
  query: string;
  isActiveOnly: boolean;
  summaryMessage: string;
}): boolean {
  const printableWindow = window.open("", "_blank", "width=1280,height=860");
  if (!printableWindow) {
    return false;
  }

  const generatedTimestamp = new Date()
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .toUpperCase();
  const exportableGroups = groups.filter((group) => !isInactiveGroup(group));
  const skippedInactiveCount = Math.max(0, groups.length - exportableGroups.length);
  const rows = buildOverviewTripRows(exportableGroups);
  const normalizedQuery = query.trim();
  const scopeLabel =
    isActiveOnly || skippedInactiveCount === 0
      ? isActiveOnly
        ? "Active only"
        : "All groups"
      : "All groups (inactive excluded in PDF)";
  const filterLabel = [
    scopeLabel,
    normalizedQuery ? `Query: "${normalizedQuery}"` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const tableRows = rows
    .map(
      (row, index) => `
        <tr>
          <td class="cell-center">${index + 1}</td>
          <td>${escapeHtml(row.groupCode)}</td>
          <td>${escapeHtml(row.groupName)}</td>
          <td>${escapeHtml(row.dateLabel)}</td>
          <td class="cell-center">${escapeHtml(row.timeLabel)}</td>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(row.title)}</td>
          <td>${escapeHtml(row.routeLabel)}</td>
          <td class="cell-center">${escapeHtml(row.flightNumber)}</td>
          <td class="cell-center">${escapeHtml(row.requiresBusLabel)}</td>
        </tr>`,
    )
    .join("");

  const printableHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Overview Trip Report</title>
    <style>
      :root {
        --ink: #1b1a17;
        --muted: #4b5563;
        --line: #d1d5db;
        --surface: #ffffff;
        --header-bg: #e5e7eb;
        --accent: #2e7d32;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 24px;
        font-family: "Segoe UI", Arial, sans-serif;
        color: var(--ink);
        background: var(--surface);
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .report {
        width: 100%;
        max-width: 1240px;
        margin: 0 auto;
      }
      .header {
        margin-bottom: 16px;
      }
      .title-wrap h1 {
        margin: 0;
        font-size: 28px;
        line-height: 1.1;
        color: var(--accent);
        letter-spacing: -0.02em;
      }
      .title-wrap p {
        margin: 8px 0 0;
        font-size: 13px;
        color: var(--muted);
      }
      .meta {
        margin-top: 10px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        font-size: 12px;
        color: var(--muted);
      }
      .meta-item {
        line-height: 1.45;
      }
      .meta-item strong {
        color: var(--ink);
      }
      .summary {
        margin: 0 0 16px;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #f9fafb;
      }
      .summary p {
        margin: 0;
        font-size: 12px;
        color: var(--muted);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      thead th {
        background: var(--header-bg);
        border: 1px solid var(--line);
        padding: 8px 6px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      tbody td {
        border: 1px solid var(--line);
        padding: 7px 6px;
        font-size: 11px;
        line-height: 1.35;
        vertical-align: top;
        word-break: break-word;
      }
      .cell-center {
        text-align: center;
      }
      .empty {
        text-align: center;
        color: var(--muted);
        padding: 16px 10px;
      }
      .foot {
        margin-top: 12px;
        font-size: 10px;
        color: var(--muted);
      }
      @page {
        size: A4 landscape;
        margin: 12mm;
      }
      @media print {
        body {
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <main class="report">
      <section class="header">
        <div class="title-wrap">
          <h1>Overview Trip Report</h1>
          <p>Ghaniya Tour & Travel - Itinerary Overview</p>
          <div class="meta">
            <div class="meta-item"><strong>Generated:</strong> ${escapeHtml(generatedTimestamp)}</div>
            <div class="meta-item"><strong>Groups:</strong> ${exportableGroups.length}</div>
            <div class="meta-item"><strong>Inactive Skipped:</strong> ${skippedInactiveCount}</div>
            <div class="meta-item"><strong>Total Trips:</strong> ${rows.length}</div>
            <div class="meta-item"><strong>Filter:</strong> ${escapeHtml(filterLabel || "-")}</div>
          </div>
        </div>
      </section>

      <section class="summary">
        <p>${escapeHtml(summaryMessage)}</p>
      </section>

      <table aria-label="Overview trip table">
        <thead>
          <tr>
            <th style="width: 40px">No</th>
            <th style="width: 92px">Group Code</th>
            <th style="width: 170px">Group Name</th>
            <th style="width: 108px">Trip Date</th>
            <th style="width: 66px">Time</th>
            <th style="width: 120px">Category</th>
            <th style="width: 210px">Trip Title</th>
            <th style="width: 220px">Route</th>
            <th style="width: 90px">Flight</th>
            <th style="width: 70px">Bus</th>
          </tr>
        </thead>
        <tbody>
          ${
            tableRows ||
            '<tr><td class="empty" colspan="10">No trip data for the current filter.</td></tr>'
          }
        </tbody>
      </table>

      <p class="foot">This report contains itinerary trip rows from the Overview page filter context.</p>
    </main>
  </body>
</html>`;

  printableWindow.document.open();
  printableWindow.document.write(printableHtml);
  printableWindow.document.close();

  window.setTimeout(() => {
    printableWindow.focus();
    printableWindow.print();
  }, 450);

  return true;
}
