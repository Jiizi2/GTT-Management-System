import * as Domain from "../shared/app-domain";
import type { GroupData, ItineraryItem, Musyrif, NoteItem } from "../shared/app-domain";

const {
  escapeHtml,
  formatScheduleTime,
  inferCategoryKey,
  inferCityTourCity,
  normalizeAgreementCityKey,
  parseDisplayDateToIso,
  parseTimeForInput,
  resolveTotalBusCount,
  resolveTransportMode,
  TRANSPORT_MODE_META,
} = Domain;

function formatItineraryActivityHeading(item: ItineraryItem, categoryKey: string, fallbackLabel: string): string {
  if (categoryKey !== "transfer") {
    return fallbackLabel;
  }

  const normalizedCategory = item.category.toLowerCase();
  if (normalizedCategory.includes("train departure")) {
    return "Transfer (Train Departure)";
  }

  if (normalizedCategory.includes("station pickup")) {
    return "Transfer (Station Pickup)";
  }

  return fallbackLabel;
}

function formatItineraryCompactSummary(item: ItineraryItem, categoryKey: string): string {
  const trimmedFrom = item.from?.trim() ?? "";
  const trimmedTo = item.to?.trim() ?? "";

  if (categoryKey === "city-tour") {
    const cityTourCity = inferCityTourCity(item).trim();
    if (cityTourCity) {
      return `City Tour ${cityTourCity}`;
    }
  }

  if (trimmedFrom && trimmedTo) {
    return `${trimmedFrom} -> ${trimmedTo}`;
  }

  if (trimmedFrom || trimmedTo) {
    return [trimmedFrom, trimmedTo].filter(Boolean).join(" -> ");
  }

  const trimmedTitle = item.title.trim();
  return trimmedTitle || "Activity detail pending";
}

function formatItinerarySupportDetail(
  item: ItineraryItem,
  categoryKey: string,
  options?: {
    fallbackHotelName?: string;
    fallbackFromHotelName?: string;
  },
): string {
  const detailSegments: string[] = [];
  const flightNumber = item.flightNumber?.trim() ?? "";
  const trimmedFrom = item.from?.trim() ?? "";
  const trimmedTo = item.to?.trim() ?? "";
  const inferredFromHotelName = /hotel/i.test(trimmedFrom) ? trimmedFrom : "";
  const inferredToHotelName = /hotel/i.test(trimmedTo) ? trimmedTo : "";
  const fallbackHotelName = options?.fallbackHotelName?.trim() ?? "";
  const fallbackFromHotelName = options?.fallbackFromHotelName?.trim() ?? "";
  const fromHotelName = item.fromHotelName?.trim() || inferredFromHotelName || fallbackFromHotelName;
  const hotelName =
    item.hotelName?.trim() ||
    (categoryKey === "transfer"
      ? inferredToHotelName
      : inferredFromHotelName || inferredToHotelName || fallbackHotelName);
  const stationPickupTime = item.destinationPickupTime?.trim() ?? "";
  const hotelPickupRequestTime = item.hotelPickupRequestTime?.trim() ?? "";
  const notes = item.notes?.trim() ?? "";

  const transportMode = resolveTransportMode(item);

  if (categoryKey === "arrival" || categoryKey === "departure") {
    if (transportMode === "flight" && flightNumber) {
      detailSegments.push(`Flight ${flightNumber}`);
    } else if (transportMode !== "flight") {
      detailSegments.push(TRANSPORT_MODE_META[transportMode].label);
    }
  } else if (categoryKey === "transfer") {
    detailSegments.push(transportMode === "train" ? "Train" : "Bus");
  }

  if (categoryKey === "transfer" && (fromHotelName || hotelName)) {
    if (fromHotelName && hotelName) {
      detailSegments.push(`Hotel ${fromHotelName} -> ${hotelName}`);
    } else {
      detailSegments.push(`Hotel ${fromHotelName || hotelName}`);
    }
  } else if (hotelName) {
    detailSegments.push(`Hotel ${hotelName}`);
  }

  if (item.transferByTrain && stationPickupTime) {
    detailSegments.push(`Pickup ${formatScheduleTime(stationPickupTime)}`);
  }

  if (categoryKey === "departure" && hotelPickupRequestTime) {
    detailSegments.push(`Hotel pickup ${formatScheduleTime(hotelPickupRequestTime)}`);
  }

  if (categoryKey === "city-tour" && item.requiresBus) {
    detailSegments.push("Requires Bus");
  }

  if (notes) {
    detailSegments.push(notes.length > 72 ? `${notes.slice(0, 69).trimEnd()}...` : notes);
  }

  if (detailSegments.length > 0) {
    return detailSegments.join(" | ");
  }

  const fallbackSegments = item.meta
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (fallbackSegments.length === 0) {
    return "";
  }

  if (parseTimeForInput(fallbackSegments[0])) {
    fallbackSegments.shift();
  }

  return fallbackSegments.join(" | ");
}

function schedulePrint(printableWindow: Window): void {
  let printTriggered = false;
  const triggerPrint = () => {
    if (printTriggered || printableWindow.closed) {
      return;
    }

    printTriggered = true;
    printableWindow.focus();
    printableWindow.print();
  };

  try {
    printableWindow.addEventListener(
      "load",
      () => {
        window.setTimeout(triggerPrint, 180);
      },
      { once: true },
    );
  } catch {
    // Some popup handles expose a restricted event API.
  }

  try {
    const fontReady = printableWindow.document.fonts?.ready;
    if (fontReady) {
      void fontReady
        .then(() => {
          window.setTimeout(triggerPrint, 120);
        })
        .catch(() => {
          // Ignore font-loading failures and fall back to the timeout below.
        });
    }
  } catch {
    // Some popup handles expose a restricted document.fonts API.
  }

  window.setTimeout(triggerPrint, 1800);
}

export function exportGroupDetailPdf(
  {
    group,
    itineraryItems,
    noteItems,
    musyrifProfile,
    familyGroups = [],
  }: {
    group: GroupData;
    itineraryItems: ItineraryItem[];
    noteItems: NoteItem[];
    musyrifProfile: Musyrif;
    familyGroups?: GroupData[];
  },
  options: { printWindow?: Window | null } = {},
): boolean {
  const reusableWindow = options.printWindow;
  const printableWindow =
    reusableWindow && !reusableWindow.closed ? reusableWindow : window.open("", "_blank", "width=1120,height=760");
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

  const logoUrl = new URL("/logo-ghaniya-travel-polos.png", window.location.origin).toString();
  const appCssUrl = new URL("/index.css", window.location.origin).toString();
  const fontsCssUrl = new URL("/fonts.css", window.location.origin).toString();

  const sortedItinerary = [...itineraryItems].sort((left, right) => {
    const leftIso = left.isoDate ?? parseDisplayDateToIso(left.date, left.year);
    const rightIso = right.isoDate ?? parseDisplayDateToIso(right.date, right.year);
    const leftKey = `${leftIso}T${left.time ?? "00:00"}`;
    const rightKey = `${rightIso}T${right.time ?? "00:00"}`;
    return leftKey.localeCompare(rightKey);
  });

  const formatLongDate = (isoDate: string): string => {
    if (!isoDate) {
      return "-";
    }

    const date = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return isoDate.toUpperCase();
    }

    return date
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .toUpperCase();
  };

  const formatTimelineDate = (isoDate: string): { dateLabel: string; dayLabel: string } => {
    if (!isoDate) {
      return { dateLabel: "-", dayLabel: "-" };
    }

    const date = new Date(`${isoDate}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      return { dateLabel: isoDate.toUpperCase(), dayLabel: "-" };
    }

    return {
      dateLabel: date
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        })
        .toUpperCase(),
      dayLabel: date.toLocaleDateString("en-US", { weekday: "long" }),
    };
  };

  const formatTime24 = (value: string): string => {
    if (!value) {
      return "TBD";
    }

    if (/^\d{2}:\d{2}$/.test(value)) {
      return value;
    }

    const parsed = parseTimeForInput(value);
    if (parsed) {
      return parsed;
    }

    return value;
  };

  const fallbackStartIso =
    sortedItinerary[0]?.isoDate ??
    (sortedItinerary[0] ? parseDisplayDateToIso(sortedItinerary[0].date, sortedItinerary[0].year) : "");
  const fallbackEndIso =
    sortedItinerary.length > 0
      ? (sortedItinerary[sortedItinerary.length - 1]?.isoDate ??
        parseDisplayDateToIso(
          sortedItinerary[sortedItinerary.length - 1].date,
          sortedItinerary[sortedItinerary.length - 1].year,
        ))
      : "";
  const arrivalItem = sortedItinerary.find((item) => inferCategoryKey(item) === "arrival");
  const returnItem = [...sortedItinerary].reverse().find((item) => inferCategoryKey(item) === "departure");
  const returnIso =
    returnItem?.isoDate ?? (returnItem ? parseDisplayDateToIso(returnItem.date, returnItem.year) : fallbackEndIso);
  const arrivalFlightNumber = arrivalItem?.flightNumber?.trim() || "-";
  const returnFlightNumber = returnItem?.flightNumber?.trim() || "-";
  const cityHotelNames = {
    makkah: group.visaSetup?.makkahHotels[0]?.hotelName?.trim() ?? "",
    madinah: group.visaSetup?.madinahHotels[0]?.hotelName?.trim() ?? "",
  };
  const resolveHotelNameByCity = (cityInput: string): string => {
    const cityKey = normalizeAgreementCityKey(cityInput);
    if (!cityKey) {
      return "";
    }

    return cityHotelNames[cityKey]?.trim() ?? "";
  };
  const resolvePdfFallbackHotels = (
    item: ItineraryItem,
    categoryKey: string,
  ): { fallbackHotelName: string; fallbackFromHotelName: string } => {
    const fallbackFromHotelName = categoryKey === "transfer" ? resolveHotelNameByCity(item.from ?? "") : "";

    if (categoryKey === "departure") {
      return {
        fallbackHotelName: resolveHotelNameByCity(item.from ?? ""),
        fallbackFromHotelName,
      };
    }

    if (categoryKey === "arrival" || categoryKey === "transfer") {
      return {
        fallbackHotelName: resolveHotelNameByCity(item.to ?? ""),
        fallbackFromHotelName,
      };
    }

    if (categoryKey === "city-tour") {
      return {
        fallbackHotelName:
          resolveHotelNameByCity(item.cityTourCity ?? "") ||
          resolveHotelNameByCity(item.from ?? "") ||
          resolveHotelNameByCity(item.to ?? ""),
        fallbackFromHotelName,
      };
    }

    return {
      fallbackHotelName: "",
      fallbackFromHotelName,
    };
  };
  const raudhahDateLabels = Array.from(
    new Set(
      (group.visaSetup?.raudhahAppointments ?? [])
        .map((appointment) => formatLongDate(appointment.dateIso?.trim() ?? ""))
        .filter((value) => value && value !== "-"),
    ),
  );
  const raudhahDateSummary = raudhahDateLabels.length > 0 ? raudhahDateLabels.join(" | ") : "NOT SET";

  const itineraryTimelineRows = sortedItinerary
    .map((item, index) => {
      const itemIso = item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
      const { dateLabel } = formatTimelineDate(itemIso);
      const categoryKey = inferCategoryKey(item);
      const cityTourCity = categoryKey === "city-tour" ? inferCityTourCity(item) : "";
      const badgeLabel = categoryKey === "city-tour" && cityTourCity ? `City Tour / ${cityTourCity}` : item.category;
      const activityHeading = formatItineraryActivityHeading(item, categoryKey, item.category);
      const compactSummary = formatItineraryCompactSummary(item, categoryKey);
      const detailText = formatItinerarySupportDetail(item, categoryKey, resolvePdfFallbackHotels(item, categoryKey));
      const timeSource = item.transferByTrain ? item.trainDepartureTime || item.time || "" : item.time || "";
      const timelineTime = formatTime24(timeSource);

      return `
          <tr>
            <td class="cell-center">${index + 1}</td>
            <td>${escapeHtml(dateLabel)}</td>
            <td class="cell-center">${escapeHtml(timelineTime)}</td>
            <td>${escapeHtml(badgeLabel)}</td>
            <td>${escapeHtml(activityHeading)}</td>
            <td>${escapeHtml(compactSummary)}</td>
            <td>${escapeHtml(detailText || "-")}</td>
          </tr>
        `;
    })
    .join("");
  const departDateLabel = formatLongDate(fallbackStartIso);
  const returnDateLabel = formatLongDate(returnIso);

  const defaultGuidelines = [
    "Gather in lobby 30 mins before every scheduled activity.",
    "Nusuk permits are required for Raudhah. Monitor your app daily.",
    "Keep Visa and Passport in hand luggage during all transit points.",
  ];
  const noteHighlightItems =
    noteItems.length > 0
      ? noteItems.slice(0, 3).map((note) => `${note.text}${note.pinned ? " (Pinned)" : ""}`)
      : defaultGuidelines;
  const noteRows = noteHighlightItems.map((text) => `<li>${escapeHtml(text)}</li>`).join("");

  const allGroupCodes = familyGroups.length > 0
    ? familyGroups.map((g) => g.code).join(" - ")
    : group.code;

  const totalPaxCount = familyGroups.length > 0
    ? familyGroups.reduce((acc, g) => acc + g.pax, 0)
    : group.pax;

  const printableHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ghaniya Tour And Travel - ${escapeHtml(group.code)}</title>
    <link rel="preload" as="style" href="${escapeHtml(fontsCssUrl)}" />
    <link rel="preload" as="style" href="${escapeHtml(appCssUrl)}" />
    <link rel="preload" as="image" href="${escapeHtml(logoUrl)}" />
    <link rel="stylesheet" href="${escapeHtml(fontsCssUrl)}" />
    <link rel="stylesheet" href="${escapeHtml(appCssUrl)}" />
    <style>
      :root {
        --ghaniya-gold: #b8860b;
        --ghaniya-gold-light: #faf8f2;
        --ghaniya-gold-soft: rgba(184, 134, 11, 0.15);
        --ink: #1f2937;
        --ink-dark: #111111;
        --muted: #6b7280;
        --line: #e2e8f0;
        --surface: #ffffff;
        --soft: #f8fafc;
      }
      * {
        box-sizing: border-box;
      }
      @page {
        size: A4 portrait;
        margin: 12mm;
      }
      body {
        margin: 0;
        padding: 10px;
        background: var(--surface);
        color: var(--ink);
        font-family: 'Inter', 'Manrope', -apple-system, BlinkMacSystemFont, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .doc {
        margin: 0;
        width: 100%;
      }
      .doc-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 16px;
        border-bottom: 2px solid var(--ghaniya-gold);
        margin-bottom: 20px;
      }
      .header-left {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .header-logo {
        height: 52px;
        width: auto;
        object-fit: contain;
      }
      .brand-info {
        display: flex;
        flex-direction: column;
      }
      .brand-name {
        font-family: 'Outfit', 'Inter', sans-serif;
        font-size: 16px;
        font-weight: 800;
        color: var(--ink-dark);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        line-height: 1.2;
      }
      .brand-tagline {
        font-family: 'Manrope', 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 600;
        color: var(--ghaniya-gold);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-top: 2px;
      }
      .header-right {
        text-align: right;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
      .doc-title {
        font-family: 'Outfit', 'Inter', sans-serif;
        font-size: 18px;
        font-weight: 800;
        color: var(--ghaniya-gold);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        line-height: 1.2;
      }
      .group-code-badge {
        display: inline-block;
        margin-top: 4px;
        padding: 4px 10px;
        font-size: 11px;
        font-weight: 700;
        background: var(--ghaniya-gold-light);
        border: 1px solid var(--ghaniya-gold-soft);
        color: var(--ink-dark);
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        line-height: 1;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px 10px;
        margin-bottom: 20px;
      }
      .meta-item {
        padding: 8px 10px;
        border: 1px solid var(--line);
        border-left: 3px solid var(--ghaniya-gold);
        background: var(--soft);
        border-radius: 4px;
      }
      .meta-label {
        display: block;
        margin-bottom: 4px;
        font-size: 9px;
        font-weight: 700;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .meta-value {
        font-size: 12px;
        font-weight: 700;
        color: var(--ink-dark);
        overflow-wrap: anywhere;
        line-height: 1.25;
      }
      .section {
        margin-top: 20px;
      }
      .section-header {
        border-bottom: 1px solid var(--line);
        padding-bottom: 6px;
        margin-bottom: 12px;
      }
      .section-header h2 {
        margin: 0;
        font-family: 'Outfit', 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 800;
        color: var(--ink-dark);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        position: relative;
        display: inline-block;
      }
      .section-header h2::after {
        content: '';
        position: absolute;
        bottom: -7px;
        left: 0;
        width: 100%;
        height: 3px;
        background: var(--ghaniya-gold);
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        margin-bottom: 8px;
      }
      th,
      td {
        border: 1px solid var(--line);
        padding: 8px 10px;
        font-size: 11.5px;
        line-height: 1.4;
        vertical-align: top;
        word-break: break-word;
      }
      th {
        background-color: var(--ghaniya-gold-light) !important;
        color: var(--ink-dark) !important;
        font-weight: 700;
        font-size: 10px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        border-bottom: 2px solid var(--ghaniya-gold);
        text-align: left;
      }
      tr:nth-child(even) {
        background-color: var(--soft);
      }
      .cell-center {
        text-align: center;
      }
      .notes-card {
        background: var(--ghaniya-gold-light);
        border: 1px solid var(--ghaniya-gold-soft);
        border-radius: 6px;
        padding: 14px 18px;
      }
      .notes-list {
        margin: 0;
        padding-left: 18px;
      }
      .notes-list li {
        margin: 0 0 6px;
        font-size: 11.5px;
        line-height: 1.5;
        color: var(--ink);
      }
      .notes-list li:last-child {
        margin-bottom: 0;
      }
      .footer {
        margin-top: 24px;
        padding-top: 10px;
        border-top: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        font-size: 9.5px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .empty {
        text-align: center;
        color: var(--muted);
      }
      @media print {
        body {
          padding: 0;
        }
      }
      @media screen and (max-width: 900px) {
        .meta-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    </style>
  </head>
  <body>
    <main class="doc">
      <header class="doc-header">
        <div class="header-left">
          <img src="${escapeHtml(logoUrl)}" alt="Ghaniya Tour & Travel" class="header-logo" decoding="sync" fetchpriority="high" />
          <div class="brand-info">
            <div class="brand-name">Ghaniya Tour & Travel</div>
            <div class="brand-tagline">Spiritual Pilgrimage & Services</div>
          </div>
        </div>
        <div class="header-right">
          <div class="doc-title">Group Detail Overview</div>
          <div class="group-code-badge">${escapeHtml(group.code)}</div>
        </div>
      </header>

      <section class="meta-grid" aria-label="Group summary details">
        <div class="meta-item">
          <span class="meta-label">Group Code(s)</span>
          <div class="meta-value">${escapeHtml(allGroupCodes)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Group Name</span>
          <div class="meta-value">${escapeHtml(group.name)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Pax Count</span>
          <div class="meta-value">${totalPaxCount}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Musyrif</span>
          <div class="meta-value">${escapeHtml(musyrifProfile.name)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Musyrif Phone</span>
          <div class="meta-value">${escapeHtml(musyrifProfile.phone)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Depart</span>
          <div class="meta-value">${escapeHtml(departDateLabel)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Flight In</span>
          <div class="meta-value">${escapeHtml(arrivalFlightNumber)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Return</span>
          <div class="meta-value">${escapeHtml(returnDateLabel)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Flight Out</span>
          <div class="meta-value">${escapeHtml(returnFlightNumber)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Raudhah Dates</span>
          <div class="meta-value">${escapeHtml(raudhahDateSummary)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Generated</span>
          <div class="meta-value">${escapeHtml(generatedTimestamp)}</div>
        </div>
      </section>

      <section class="section itinerary-section">
        <div class="section-header">
          <h2>Full Itinerary</h2>
        </div>
        <table aria-label="Full itinerary table">
          <thead>
            <tr>
              <th style="width: 34px;">No</th>
              <th style="width: 80px;">Date</th>
              <th style="width: 60px;">Time</th>
              <th style="width: 100px;">Category</th>
              <th style="width: 140px;">Activity</th>
              <th style="width: 160px;">Route / Summary</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${itineraryTimelineRows || '<tr><td class="empty" colspan="7">No itinerary data available.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="section">
        <div class="section-header">
          <h2>Operational Notes</h2>
        </div>
        <div class="notes-card">
          <ol class="notes-list">
            ${noteRows}
          </ol>
        </div>
      </section>

      <footer class="footer">
        <span>Generated: ${escapeHtml(generatedTimestamp)}</span>
        <span>Ghaniya Tour & Travel</span>
      </footer>
    </main>
  </body>
</html>`;

  printableWindow.document.open();
  printableWindow.document.write(printableHtml);
  printableWindow.document.close();

  schedulePrint(printableWindow);

  return true;
}
