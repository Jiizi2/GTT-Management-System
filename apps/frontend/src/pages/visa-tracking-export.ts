import { escapeHtml } from "../shared/app-domain";
import type { GroupData, VisaFilterId, VisaTrackingRow } from "../shared/app-domain";
import { formatVisaDateWithYear } from "../shared/visa-domain";

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
    agentLabel = "Semua agent",
  }: {
    rows: VisaTrackingRow[];
    groups: GroupData[];
    query: string;
    activeFilter: VisaFilterId;
    agentLabel?: string;
  },
  options: { printWindow?: Window | null } = {},
): boolean {
  const reusableWindow = options.printWindow;
  const printableWindow =
    reusableWindow && !reusableWindow.closed ? reusableWindow : window.open("", "_blank", "width=1280,height=860");
  if (!printableWindow) return false;

  const generatedTimestamp = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const normalizedQuery = query.trim();
  const totalPax = rows.reduce((total, row) => total + row.pax, 0);
  const issuedCount = rows.filter((row) => row.visaStatus === "Issued").length;
  const paymentAttention = rows.filter((row) => row.paymentStatus !== "Paid").length;
  const logoUrl = new URL("/logo-ghaniya-travel-polos.png", window.location.origin).toString();
  const fontsUrl = new URL("/fonts.css", window.location.origin).toString();
  const groupByCode = new Map(groups.map((group) => [group.code, group]));
  const groupByIdOrCode = new Map<string, GroupData>();
  for (const group of groups) {
    groupByIdOrCode.set(group.code, group);
    if (group.id) groupByIdOrCode.set(group.id, group);
  }
  const exportedCodes = new Set(rows.map((row) => row.groupCode));
  const parentCodes = new Set<string>();
  const parentCodeByChildCode = new Map<string, string>();
  for (const row of rows) {
    const parentId = groupByCode.get(row.groupCode)?.parentGroupId || row.parentGroupId;
    if (!parentId) continue;
    const parentCode = groupByIdOrCode.get(parentId)?.code ?? parentId;
    parentCodeByChildCode.set(row.groupCode, parentCode);
    if (exportedCodes.has(parentCode)) parentCodes.add(parentCode);
  }

  const tableRows = rows
    .map((row) => {
      const group = groupByCode.get(row.groupCode);
      const parentCode = parentCodeByChildCode.get(row.groupCode);
      const isParent = parentCodes.has(row.groupCode);
      const serviceType = group?.visaSetup?.busStatus === "Visa+" ? "Visa+" : "Visa Only";
      const rawSyarikah = group?.visaSetup?.syarikah?.trim() || "";
      const syarikah = !rawSyarikah || rawSyarikah.toLowerCase() === "not assigned" ? "Unassigned" : rawSyarikah;
      const linkedGroupReference = parentCode
        ? `<span class="parent-reference">Terhubung: ${escapeHtml(parentCode)}</span>`
        : "";
      return `
      <tr class="${parentCode ? "child-row" : isParent ? "parent-row" : "standalone-row"}">
        <td class="identity"><div class="group-identity">
          <strong class="group-code">${escapeHtml(row.groupCode)}</strong>${linkedGroupReference}
          <span class="group-name">${escapeHtml(row.groupName)}</span>
          <span class="detail">${escapeHtml(group?.agent?.name?.trim() || "Unassigned")}</span>
        </div></td>
        <td class="pax">${row.pax}</td>
        <td class="travel"><span>Berangkat: ${escapeHtml(formatVisaDateWithYear(row.departureIso))}</span><span class="detail">Pulang: ${escapeHtml(formatVisaDateWithYear(row.returnIso))}</span></td>
        <td><span class="status">${escapeHtml(row.visaStatus)}</span><span class="service-type">${serviceType}</span>${row.visaStatus === "Issued" ? `<span class="detail issued-date">Issued: ${escapeHtml(formatVisaDateWithYear(row.issuedDateIso))}</span>` : ""}</td>
        <td class="provider">${escapeHtml(syarikah)}</td>
        <td><span class="status payment-status">${escapeHtml(row.paymentStatus)}</span></td>
      </tr>`;
    })
    .join("");

  const printableHtml = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Visa Operations Report</title>
  <link rel="stylesheet" href="${escapeHtml(fontsUrl)}" />
  <style>
    :root { color-scheme:light; --brand:#237431; --ink:#151814; --muted:#4a544d; --line:#d8ded9; }
    * { box-sizing:border-box; }
    body { margin:0; padding:24px; color:var(--ink); background:#fff; font-family:"Inter","Segoe UI",Arial,sans-serif; font-size:10pt; line-height:1.35; font-variant-numeric:tabular-nums; }
    .report { width:100%; max-width:1047px; margin:0 auto; }
    .masthead { display:flex; align-items:center; justify-content:space-between; gap:20px; padding-bottom:16px; border-bottom:1px solid var(--brand); }
    .brand { display:flex; align-items:center; gap:12px; min-width:0; }
    .logo { width:34px; height:42px; object-fit:contain; }
    h1 { margin:0; font-family:"Manrope","Inter",sans-serif; font-size:18pt; font-weight:700; line-height:1.2; letter-spacing:-.025em; }
    .document-meta { flex-shrink:0; color:var(--muted); font-size:8.5pt; text-align:right; }
    .report-context { display:flex; justify-content:space-between; align-items:baseline; gap:16px; margin:16px 0; color:var(--muted); font-size:9pt; }
    .scope { overflow-wrap:anywhere; }
    .report-summary { flex-shrink:0; color:var(--ink); font-weight:500; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    thead { display:table-header-group; }
    th { padding:10px 8px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); background:#edf3ee; color:var(--ink); font-size:9pt; font-weight:600; text-align:left; }
    td { padding:10px 8px; border-bottom:1px solid var(--line); vertical-align:top; overflow-wrap:anywhere; }
    tbody tr:nth-child(even) { background:#f7f9f7; }
    .group-code { font-weight:600; }
    .group-name,.detail { display:block; }
    .group-name { margin-top:2px; }
    .detail { margin-top:2px; color:var(--muted); font-size:8.5pt; }
    .parent-reference { margin-left:8px; color:var(--muted); font-size:8pt; }
    .child-row .group-identity { padding-left:12px; }
    .pax { text-align:right; }
    .status { font-weight:600; }
    .service-type { display:block; margin-top:2px; color:var(--muted); font-size:9pt; }
    .travel { font-size:9pt; }
    .empty { padding:24px 8px; text-align:center; color:var(--muted); }
    .footer { margin-top:12px; color:var(--muted); font-size:8pt; }
    ::selection { background:#eaf3ec; color:var(--ink); }
    @page {
      size:A4 landscape; margin:10mm 10mm 15mm;
      @bottom-left { content:"PT. Ghaniya Zilia Rahman"; font-family:"Inter",Arial,sans-serif; font-size:8pt; color:#4a544d; }
      @bottom-right { content:"Halaman " counter(page) " / " counter(pages); font-family:"Inter",Arial,sans-serif; font-size:8pt; color:#4a544d; }
    }
    @media print {
      body { padding:0; }
      .report { max-width:none; }
      tr,.masthead,.report-context { break-inside:avoid; }
      thead { break-inside:avoid; }
      .parent-row { break-after:avoid; }
      .footer { display:none; }
    }
  </style>
</head>
<body>
  <main class="report">
    <header class="masthead">
      <div class="brand"><img class="logo" src="${escapeHtml(logoUrl)}" alt="Ghaniya Travel" /><h1>Visa Operations Report</h1></div>
      <div class="document-meta">${escapeHtml(generatedTimestamp)} WIB</div>
    </header>
    <section class="report-context" aria-label="Cakupan laporan">
      <span class="scope">${escapeHtml(agentLabel)}${activeFilter !== "all" ? ` · Filter: ${escapeHtml(resolveVisaFilterLabel(activeFilter))}` : ""}${normalizedQuery ? ` · Pencarian: ${escapeHtml(normalizedQuery)}` : ""}</span>
      <span class="report-summary">${rows.length} group · ${totalPax} pax · ${issuedCount} issued · ${paymentAttention} belum lunas</span>
    </section>
    <table aria-label="Visa Operations Report">
      <colgroup><col style="width:28%" /><col style="width:6%" /><col style="width:22%" /><col style="width:19%" /><col style="width:13%" /><col style="width:12%" /></colgroup>
      <thead><tr><th scope="col">Group / Agent</th><th scope="col" class="pax">Pax</th><th scope="col">Perjalanan</th><th scope="col">Visa</th><th scope="col">Syarikah</th><th scope="col">Pembayaran</th></tr></thead>
      <tbody>${tableRows || '<tr><td class="empty" colspan="6">Tidak ada data visa tracking untuk filter yang dipilih.</td></tr>'}</tbody>
    </table>
    <footer class="footer">PT. Ghaniya Zilia Rahman</footer>
  </main>
</body>
</html>`;

  printableWindow.document.open();
  printableWindow.document.write(printableHtml);
  printableWindow.document.close();
  schedulePrint(printableWindow);
  return true;
}
