import { escapeHtml } from "../shared/app-domain";
import type { GroupData, VisaFilterId, VisaPaymentStatus, VisaStatus, VisaTrackingRow } from "../shared/app-domain";

type VisaExportRow = {
  groupCode: string;
  groupName: string;
  agentName: string;
  totalPax: number;
  departureLabel: string;
  returnLabel: string;
  issuedDateLabel: string;
  visaServiceType: string;
  visaStatus: VisaStatus;
  paymentStatus: VisaPaymentStatus;
  syarikah: string;
  makkahVerified: number;
  madinahVerified: number;
};

function resolveVisaFilterLabel(filter: VisaFilterId): string {
  const labels: Record<VisaFilterId, string> = {
    all: "All Groups",
    "not-issued": "Not Issued",
    "missing-hotel": "Missing Hotel",
    unpaid: "Unpaid",
    "visa-only": "Visa Only",
    "visa-plus": "Visa+",
  };
  return labels[filter];
}

function resolveVisaServiceType(group: GroupData | undefined): string {
  return group?.visaSetup?.busStatus === "Visa+" ? "Visa+" : "Visa Only";
}

function formatDate(isoDate: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return "—";
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function buildVisaExportRows(rows: VisaTrackingRow[], groups: GroupData[]): VisaExportRow[] {
  const groupByCode = new Map(groups.map((group) => [group.code, group] as const));
  return rows.map((row) => {
    const group = groupByCode.get(row.groupCode);
    const rawSyarikah = group?.visaSetup?.syarikah?.trim() ?? "";
    return {
      groupCode: row.groupCode,
      groupName: row.groupName,
      agentName: group?.agent?.name?.trim() || "Unassigned",
      totalPax: row.pax,
      departureLabel: formatDate(row.departureIso),
      returnLabel: formatDate(row.returnIso),
      issuedDateLabel: formatDate(row.issuedDateIso),
      visaServiceType: resolveVisaServiceType(group),
      visaStatus: row.visaStatus,
      paymentStatus: row.paymentStatus,
      syarikah: rawSyarikah.toLowerCase() === "not assigned" ? "Unassigned" : rawSyarikah || "Unassigned",
      makkahVerified: row.makkahVerified,
      madinahVerified: row.madinahVerified,
    };
  });
}

function statusClass(status: VisaStatus | VisaPaymentStatus): string {
  if (status === "Issued" || status === "Paid") return "good";
  if (status === "Pending" || status === "Partial") return "warn";
  if (status === "Unpaid") return "danger";
  return "neutral";
}

function coverageClass(verified: number, pax: number): string {
  if (pax > 0 && verified >= pax) return "good";
  if (verified > 0) return "warn";
  return "danger";
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

export function exportVisaTrackingReportPdf(
  {
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
  const exportRows = buildVisaExportRows(rows, groups);
  const normalizedQuery = query.trim();
  const filterLabel = resolveVisaFilterLabel(activeFilter);
  const totalPax = exportRows.reduce((total, row) => total + row.totalPax, 0);
  const issuedGroups = exportRows.filter((row) => row.visaStatus === "Issued").length;
  const paymentAttention = exportRows.filter((row) => row.paymentStatus !== "Paid").length;
  const hotelAttention = exportRows.filter(
    (row) => row.makkahVerified < row.totalPax || row.madinahVerified < row.totalPax,
  ).length;
  const logoUrl = new URL("/logo-ghaniya-travel-polos.png", window.location.origin).toString();
  const fontsUrl = new URL("/fonts.css", window.location.origin).toString();

  const tableRows = exportRows
    .map(
      (row, index) => `
        <tr>
          <td class="number">${index + 1}</td>
          <td><strong class="primary-text">${escapeHtml(row.groupCode)}</strong><span class="secondary-text">${escapeHtml(row.groupName)}</span><span class="tertiary-text">${escapeHtml(row.agentName)}</span></td>
          <td><strong class="primary-text">${row.totalPax} pax</strong><span class="secondary-text">${escapeHtml(row.departureLabel)} → ${escapeHtml(row.returnLabel)}</span></td>
          <td><span class="status ${statusClass(row.visaStatus)}">${escapeHtml(row.visaStatus)}</span><span class="secondary-text">${escapeHtml(row.visaServiceType)}</span><span class="tertiary-text">Issued: ${escapeHtml(row.issuedDateLabel)}</span></td>
          <td><div class="coverage"><span>Makkah</span><strong class="${coverageClass(row.makkahVerified, row.totalPax)}-text">${row.makkahVerified}/${row.totalPax}</strong></div><div class="coverage"><span>Madinah</span><strong class="${coverageClass(row.madinahVerified, row.totalPax)}-text">${row.madinahVerified}/${row.totalPax}</strong></div></td>
          <td><strong class="primary-text">${escapeHtml(row.syarikah)}</strong><span class="tertiary-text">Provider agency</span></td>
          <td class="center"><span class="status ${statusClass(row.paymentStatus)}">${escapeHtml(row.paymentStatus)}</span></td>
        </tr>`,
    )
    .join("");

  const printableHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Visa Control Report</title>
  <link rel="stylesheet" href="${escapeHtml(fontsUrl)}" />
  <style>
    :root { --brand:#087f5b; --brand-dark:#064e3b; --brand-soft:#ecfdf5; --ink:#14211d; --muted:#64748b; --line:#dce5e1; --soft:#f6f9f8; --good:#047857; --good-bg:#d1fae5; --warn:#a16207; --warn-bg:#fef3c7; --danger:#b42318; --danger-bg:#fee4e2; }
    * { box-sizing:border-box; }
    body { margin:0; padding:22px; color:var(--ink); background:#fff; font-family:"Inter","Segoe UI",Arial,sans-serif; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .report { width:100%; max-width:1240px; margin:0 auto; }
    .masthead { display:flex; align-items:center; justify-content:space-between; gap:24px; padding-bottom:18px; border-bottom:3px solid var(--brand); }
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
    .metrics { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; margin-bottom:14px; }
    .metric { position:relative; overflow:hidden; min-height:70px; padding:11px 12px; border:1px solid var(--line); border-radius:10px; background:#fff; }
    .metric::before { content:""; position:absolute; inset:0 auto 0 0; width:3px; background:var(--brand); }
    .metric.attention::before { background:#d97706; }
    .metric-label { color:var(--muted); font-size:8px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; }
    .metric-value { display:block; margin-top:5px; font-family:"Sora",sans-serif; font-size:21px; font-weight:750; color:var(--brand-dark); }
    .metric-note { display:block; margin-top:2px; color:var(--muted); font-size:8px; }
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
    .secondary-text { margin-top:3px; color:#475569; }
    .tertiary-text { margin-top:2px; color:var(--muted); font-size:8px; }
    .status { display:inline-block; padding:3px 6px; border-radius:999px; font-size:7px; font-weight:850; text-transform:uppercase; letter-spacing:.04em; white-space:nowrap; }
    .status.good { color:var(--good); background:var(--good-bg); }
    .status.warn { color:var(--warn); background:var(--warn-bg); }
    .status.danger { color:var(--danger); background:var(--danger-bg); }
    .status.neutral { color:#475569; background:#e9eef3; }
    .coverage { display:flex; align-items:center; justify-content:space-between; gap:6px; padding:2px 0; color:#475569; }
    .good-text { color:var(--good); } .warn-text { color:var(--warn); } .danger-text { color:var(--danger); }
    .empty { padding:24px; text-align:center; color:var(--muted); }
    .legend { display:flex; align-items:center; gap:12px; margin-top:8px; color:var(--muted); font-size:8px; }
    .legend strong { color:#334155; }
    .footer { display:flex; justify-content:space-between; margin-top:10px; padding-top:8px; border-top:1px solid var(--line); color:var(--muted); font-size:8px; }
    @page { size:A4 landscape; margin:10mm 11mm 12mm; }
    @media print { body { padding:0; } .report { max-width:none; } tr,.metric { break-inside:avoid; } }
  </style>
</head>
<body>
  <main class="report">
    <header class="masthead">
      <div class="brand"><img class="logo" src="${escapeHtml(logoUrl)}" alt="Ghaniya Travel" /><div><p class="brand-name">Ghaniya Tour & Travel</p><h1>Visa Control Report</h1></div></div>
      <div class="document-meta"><span class="document-label">Visa Operations</span><p class="generated">Generated ${escapeHtml(generatedTimestamp)}</p></div>
    </header>
    <section class="report-context">
      <div><p class="context-title">Issued statistics month</p><p class="period">${escapeHtml(issuedMonthLabel)}</p></div>
      <div class="filters"><span class="filter-chip">View: ${escapeHtml(filterLabel)}</span>${normalizedQuery ? `<span class="filter-chip">Search: ${escapeHtml(normalizedQuery)}</span>` : ""}</div>
    </section>
    <section class="metrics">
      <div class="metric"><span class="metric-label">Groups in report</span><strong class="metric-value">${exportRows.length}</strong><span class="metric-note">${totalPax} total pilgrims</span></div>
      <div class="metric"><span class="metric-label">Visa issued</span><strong class="metric-value">${issuedGroups}</strong><span class="metric-note">${exportRows.length ? Math.round((issuedGroups / exportRows.length) * 100) : 0}% of listed groups</span></div>
      <div class="metric attention"><span class="metric-label">Hotel attention</span><strong class="metric-value">${hotelAttention}</strong><span class="metric-note">Incomplete pax coverage</span></div>
      <div class="metric attention"><span class="metric-label">Payment attention</span><strong class="metric-value">${paymentAttention}</strong><span class="metric-note">Partial or unpaid</span></div>
    </section>
    <div class="section-heading"><h2>Visa readiness by group</h2><span>${exportRows.length} records · Current filter context</span></div>
    <table aria-label="Visa tracking control report">
      <thead><tr><th style="width:4%">No.</th><th style="width:19%">Group / Agent</th><th style="width:16%">Travel period</th><th style="width:15%">Visa</th><th style="width:15%">Hotel coverage</th><th style="width:18%">Syarikah</th><th style="width:13%">Payment</th></tr></thead>
      <tbody>${tableRows || '<tr><td class="empty" colspan="7">No visa tracking records are available for the selected filters.</td></tr>'}</tbody>
    </table>
    <div class="legend"><strong>Hotel coverage:</strong><span class="good-text">Complete</span><span class="warn-text">Partial</span><span class="danger-text">Missing</span></div>
    <footer class="footer"><span>PT. Ghaniya Zilia Rahman · Confidential operational document</span><span>Visa Tracking · ${escapeHtml(issuedMonthLabel)}</span></footer>
  </main>
</body>
</html>`;

  printableWindow.document.open();
  printableWindow.document.write(printableHtml);
  printableWindow.document.close();
  schedulePrint(printableWindow);
  return true;
}
