import { escapeHtml } from "../shared/app-domain";
import type { GroupData, VisaFilterId, VisaTrackingRow } from "../shared/app-domain";

type VisaExportRow = {
  groupCode: string;
  groupName: string;
  totalPax: number;
  visaServiceType: string;
};

function resolveVisaFilterLabel(filter: VisaFilterId): string {
  if (filter === "not-issued") {
    return "Not Issued";
  }

  if (filter === "missing-hotel") {
    return "Missing Hotel";
  }

  if (filter === "unpaid") {
    return "Unpaid";
  }

  return "All Groups";
}

function resolveVisaServiceType(group: GroupData | undefined): string {
  return group?.visaSetup?.busStatus === "Visa+" ? "Visa+" : "Visa Only";
}

function buildVisaExportRows(rows: VisaTrackingRow[], groups: GroupData[]): VisaExportRow[] {
  const groupByCode = new Map(groups.map((group) => [group.code, group] as const));

  return rows.map((row) => ({
    groupCode: row.groupCode,
    groupName: row.groupName,
    totalPax: row.pax,
    visaServiceType: resolveVisaServiceType(groupByCode.get(row.groupCode)),
  }));
}

export function exportVisaTrackingReportPdf({
  rows,
  groups,
  query,
  activeFilter,
  issuedMonthLabel,
}: {
  rows: VisaTrackingRow[];
  groups: GroupData[];
  query: string;
  activeFilter: VisaFilterId;
  issuedMonthLabel: string;
}, options: { printWindow?: Window | null } = {}): boolean {
  const reusableWindow = options.printWindow;
  const printableWindow =
    reusableWindow && !reusableWindow.closed
      ? reusableWindow
      : window.open("", "_blank", "width=1120,height=760");
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
  const exportRows = buildVisaExportRows(rows, groups);
  const normalizedQuery = query.trim();
  const filterLabel = resolveVisaFilterLabel(activeFilter);
  const tableRows = exportRows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.groupCode)}</td>
          <td>${escapeHtml(row.groupName)}</td>
          <td class="cell-center">${row.totalPax}</td>
          <td class="cell-center">${escapeHtml(row.visaServiceType)}</td>
        </tr>`,
    )
    .join("");

  const printableHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Visa Tracking Report</title>
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
        max-width: 1040px;
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
        size: A4 portrait;
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
          <h1>Visa Tracking Report</h1>
          <p>Ghaniya Tour & Travel - Visa Tracking</p>
          <div class="meta">
            <div class="meta-item"><strong>Generated:</strong> ${escapeHtml(generatedTimestamp)}</div>
            <div class="meta-item"><strong>Rows:</strong> ${exportRows.length}</div>
            <div class="meta-item"><strong>Filter:</strong> ${escapeHtml(filterLabel)}</div>
            <div class="meta-item"><strong>Month:</strong> ${escapeHtml(issuedMonthLabel)}</div>
            <div class="meta-item"><strong>Query:</strong> ${escapeHtml(normalizedQuery || "-")}</div>
          </div>
        </div>
      </section>

      <table aria-label="Visa tracking export table">
        <thead>
          <tr>
            <th style="width: 140px">Group Number</th>
            <th>Group Name</th>
            <th style="width: 96px">Total Pax</th>
            <th style="width: 140px">Visa Type</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td class="empty" colspan="4">No visa tracking rows for the current filter.</td></tr>'}
        </tbody>
      </table>

      <p class="foot">Columns included: Group Number, Group Name, Total Pax, and Visa Type.</p>
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
