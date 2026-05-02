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

  if ((categoryKey === "arrival" || categoryKey === "departure") && flightNumber) {
    detailSegments.push(`Flight ${flightNumber}`);
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

  if (item.requiresBus) {
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
  }: {
    group: GroupData;
    itineraryItems: ItineraryItem[];
    noteItems: NoteItem[];
    musyrifProfile: Musyrif;
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
  const resolvedTotalBuses = resolveTotalBusCount(group.pax, group.totalBuses);
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
      const { dateLabel, dayLabel } = formatTimelineDate(itemIso);
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
            <td>${escapeHtml(dayLabel)}</td>
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

  const printableHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ghaniya Tour And Travel - ${escapeHtml(group.code)}</title>
    <style>
      :root {
        --ink: #1f2937;
        --muted: #6b7280;
        --line: #d1d5db;
        --surface: #ffffff;
        --soft: #f9fafb;
        --header: #f3f4f6;
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
        padding: 20px;
        background: var(--surface);
        color: var(--ink);
        font-family: Arial, Helvetica, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .doc {
        margin: 0;
        width: 100%;
      }
      .doc-header {
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--line);
      }
      .doc-header h1 {
        margin: 0;
        font-size: 20px;
        line-height: 1.1;
      }
      .doc-header p {
        margin: 4px 0 0;
        font-size: 11px;
        color: var(--muted);
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 6px 8px;
        margin-bottom: 12px;
      }
      .meta-item {
        padding: 6px 8px;
        border: 1px solid var(--line);
        background: var(--soft);
      }
      .meta-label {
        display: block;
        margin-bottom: 3px;
        font-size: 10px;
        font-weight: 700;
        color: var(--muted);
        text-transform: uppercase;
      }
      .meta-value {
        font-size: 12px;
        font-weight: 700;
        overflow-wrap: anywhere;
      }
      .section {
        margin-top: 12px;
      }
      .section h2 {
        margin: 0 0 8px;
        font-size: 18px;
        line-height: 1.15;
      }
      .itinerary-section h2 {
        margin-bottom: 10px;
        font-size: 20px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      th,
      td {
        border: 1px solid var(--line);
        padding: 9px 10px;
        font-size: 12px;
        line-height: 1.45;
        vertical-align: top;
        word-break: break-word;
      }
      th {
        background: var(--header);
        text-align: left;
        font-size: 11px;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      .cell-center {
        text-align: center;
      }
      .notes-list {
        margin: 0;
        padding-left: 18px;
      }
      .notes-list li {
        margin: 0 0 6px;
        font-size: 11px;
        line-height: 1.4;
      }
      .footer {
        margin-top: 18px;
        padding-top: 10px;
        border-top: 1px solid var(--line);
        font-size: 11px;
        color: var(--muted);
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
        <h1>Package Info</h1>
        <p>Ghaniya Tour And Travel</p>
      </header>

      <section class="meta-grid" aria-label="Group summary details">
        <div class="meta-item">
          <span class="meta-label">Primary Group ID</span>
          <div class="meta-value">${escapeHtml(group.code)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Group Name</span>
          <div class="meta-value">${escapeHtml(group.name)}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Pax Count</span>
          <div class="meta-value">${group.pax}</div>
        </div>
        <div class="meta-item">
          <span class="meta-label">Total Bus</span>
          <div class="meta-value">${resolvedTotalBuses}</div>
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
        <h2>Full Itinerary</h2>
        <table aria-label="Full itinerary table">
          <thead>
            <tr>
              <th style="width: 34px;">No</th>
              <th style="width: 72px;">Date</th>
              <th style="width: 68px;">Day</th>
              <th style="width: 58px;">Time</th>
              <th style="width: 90px;">Category</th>
              <th style="width: 130px;">Activity</th>
              <th style="width: 145px;">Route / Summary</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            ${itineraryTimelineRows || '<tr><td class="empty" colspan="8">No itinerary data available.</td></tr>'}
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Operational Notes</h2>
        <ol class="notes-list">
          ${noteRows}
        </ol>
      </section>

      <footer class="footer">
        Document Timestamp: ${escapeHtml(generatedTimestamp)}
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
