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

export function exportGroupDetailPdf({
  group,
  itineraryItems,
  noteItems,
  musyrifProfile,
}: {
  group: GroupData;
  itineraryItems: ItineraryItem[];
  noteItems: NoteItem[];
  musyrifProfile: Musyrif;
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
  const fontsCssUrl = new URL("/fonts.css", window.location.origin).toString();
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
      const badgeClass =
        categoryKey === "arrival"
          ? "badge-arrival"
          : categoryKey === "city-tour"
            ? "badge-tour"
            : categoryKey === "transfer"
              ? "badge-transfer"
              : categoryKey === "departure"
                ? "badge-departure"
                : "badge-default";
      const dotClass =
        categoryKey === "arrival"
          ? "dot-arrival"
          : categoryKey === "city-tour"
            ? "dot-tour"
            : categoryKey === "transfer"
              ? "dot-transfer"
              : categoryKey === "departure"
                ? "dot-departure"
                : "dot-default";
      const badgeIcon =
        categoryKey === "arrival"
          ? "check_circle"
          : categoryKey === "city-tour"
            ? "map"
            : categoryKey === "transfer"
              ? "train"
              : categoryKey === "departure"
                ? "flight_takeoff"
                : "event";
      const badgeLabel = categoryKey === "city-tour" && cityTourCity ? `City Tour / ${cityTourCity}` : item.category;
      const activityHeading = formatItineraryActivityHeading(item, categoryKey, item.category);
      const compactSummary = formatItineraryCompactSummary(item, categoryKey);
      const detailText = formatItinerarySupportDetail(item, categoryKey, resolvePdfFallbackHotels(item, categoryKey));
      const timeSource = item.transferByTrain ? item.trainDepartureTime || item.time || "" : item.time || "";
      const timelineTime = formatTime24(timeSource);

      return `
          <article class="timeline-item">
            <div class="timeline-date-col">
              <span class="timeline-date">${escapeHtml(dateLabel)}</span>
              <span class="timeline-day">${escapeHtml(dayLabel)}</span>
              <div class="timeline-line${index === sortedItinerary.length - 1 ? " is-last" : ""}">
                <span class="timeline-dot ${dotClass}"></span>
              </div>
            </div>
            <div class="timeline-content">
              <div class="timeline-top">
                <span class="timeline-badge ${badgeClass}">
                  <span class="material-symbols-outlined">${badgeIcon}</span>
                  <span>${escapeHtml(badgeLabel)}</span>
                </span>
                <div class="timeline-time-box">
                  <span class="timeline-time-value">${escapeHtml(timelineTime)}</span>
                </div>
              </div>
              <h4 class="timeline-title-text">${escapeHtml(activityHeading)}</h4>
              <p class="timeline-route">${escapeHtml(compactSummary)}</p>
              ${detailText ? `<p class="timeline-detail">${escapeHtml(detailText)}</p>` : ""}
            </div>
          </article>
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
  const guidelineIcons = ["groups", "confirmation_number", "badge"];
  const noteRows = noteHighlightItems
    .map((text, index) => {
      const icon = guidelineIcons[index] ?? "info";
      return `
          <article class="guideline-item${index === 1 ? " is-middle" : ""}">
            <span class="material-symbols-outlined">${icon}</span>
            <p>${escapeHtml(text)}</p>
          </article>
        `;
    })
    .join("");

  const printableHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ghaniya Tour And Travel - ${escapeHtml(group.code)}</title>
    <link href="${escapeHtml(fontsCssUrl)}" rel="stylesheet" />
    <style>
      :root {
        --on-surface: #1b1a17;
        --on-surface-variant: #495247;
        --primary: #2e7d32;
        --primary-container: #3b8f40;
        --secondary-container: #d9efd9;
        --tertiary-fixed: #f6d9de;
        --tertiary-text: #74273e;
        --error-container: #f9ddd8;
        --error-text: #7e251f;
        --surface: #fcfaf5;
        --surface-low: #f6f2e9;
        --surface-lowest: #fffdf9;
        --outline: #b1b8a8;
      }
      * {
        box-sizing: border-box;
      }
      @page {
        size: A4 portrait;
        margin: 0;
      }
      html,
      body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: var(--on-surface);
        font-family: "Inter", Arial, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        display: block;
      }
      .material-symbols-outlined {
        font-family: "Material Symbols Outlined";
        font-size: 24px;
        font-style: normal;
        font-weight: normal;
        line-height: 1;
        letter-spacing: normal;
        text-transform: none;
        display: inline-block;
        white-space: nowrap;
        word-wrap: normal;
        direction: ltr;
        font-variation-settings:
          "FILL" 0,
          "wght" 400,
          "GRAD" 0,
          "opsz" 24;
        font-feature-settings: "liga";
        -webkit-font-feature-settings: "liga";
        -webkit-font-smoothing: antialiased;
        font-synthesis: none;
        vertical-align: middle;
      }
      .doc {
        width: 210mm;
        min-height: 297mm;
        height: auto;
        margin: 0;
        background: var(--surface-lowest);
        display: flex;
        flex-direction: column;
        overflow: visible;
      }
      .doc-header {
        flex: 0 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding: 12px 16px 10px;
        margin-bottom: 10px;
        border-bottom: 2px solid rgba(13, 99, 27, 0.2);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .brand-icon {
        width: 34px;
        height: 34px;
        border-radius: 9px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--primary);
        color: #ffffff;
      }
      .brand-title {
        margin: 0;
        color: var(--primary);
        font-family: "Manrope", sans-serif;
        font-size: 15px;
        font-weight: 800;
        letter-spacing: -0.02em;
        text-transform: uppercase;
      }
      .brand-sub {
        margin: 2px 0 0;
        color: var(--on-surface-variant);
        font-size: 8px;
        font-weight: 600;
        letter-spacing: 0.2em;
        text-transform: uppercase;
      }
      .doc-title {
        text-align: right;
      }
      .doc-title h1 {
        margin: 0;
        font-family: "Manrope", sans-serif;
        font-size: 24px;
        font-weight: 800;
        letter-spacing: -0.03em;
        text-transform: uppercase;
        line-height: 1;
      }
      .doc-title p {
        margin: 6px 0 0;
        color: var(--primary);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .group-summary {
        flex: 0 0 auto;
        margin: 0 16px 10px;
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid rgba(191, 202, 186, 0.45);
        background: rgba(245, 243, 239, 0.55);
      }
      .group-summary-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.08fr) minmax(0, 1.12fr);
        gap: 14px;
        align-items: start;
      }
      .group-summary-identity {
        min-width: 0;
      }
      .small-label {
        display: block;
        margin-bottom: 4px;
        color: var(--on-surface-variant);
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .group-code {
        margin: 0;
        color: var(--primary);
        font-family: "Manrope", sans-serif;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.1;
        font-size: clamp(20px, 2.6vw, 28px);
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .group-name {
        margin: 5px 0 0;
        color: var(--on-surface);
        font-size: 12px;
        font-weight: 700;
        line-height: 1.3;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .group-summary-detail-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px 10px;
      }
      .group-summary-detail-card {
        min-width: 0;
        padding: 2px 0 0;
      }
      .group-summary-detail-card .small-label {
        margin-bottom: 5px;
      }
      .group-summary-detail-value,
      .group-summary-detail-sub {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .group-summary-detail-value {
        -webkit-line-clamp: 1;
        color: var(--on-surface);
        font-size: 11px;
        font-weight: 800;
        line-height: 1.15;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .group-summary-detail-sub {
        -webkit-line-clamp: 1;
        margin-top: 3px;
        color: var(--on-surface-variant);
        font-size: 8px;
        font-weight: 600;
        line-height: 1.2;
      }
      .timeline-section {
        flex: 0 0 auto;
        margin: 0 16px 8px;
      }
      .timeline-head {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 8px;
      }
      .timeline-head h3 {
        margin: 0;
        font-family: "Manrope", sans-serif;
        font-size: 18px;
        font-weight: 800;
        letter-spacing: -0.02em;
        text-transform: uppercase;
      }
      .timeline-head-line {
        height: 1px;
        flex: 1;
        background: rgba(191, 202, 186, 0.8);
      }
      .timeline-wrap {
        margin-left: 4px;
      }
      .timeline-item {
        display: flex;
        gap: 14px;
      }
      .timeline-date-col {
        width: 82px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 1px;
      }
      .timeline-date {
        font-family: "Manrope", sans-serif;
        font-size: 16px;
        font-weight: 800;
        line-height: 1.05;
      }
      .timeline-day {
        margin-top: 3px;
        color: var(--on-surface-variant);
        font-size: 8px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .timeline-line {
        position: relative;
        width: 1px;
        flex: 1;
        margin-top: 8px;
        background: var(--outline);
      }
      .timeline-line.is-last {
        background: transparent;
      }
      .timeline-dot {
        position: absolute;
        top: 0;
        left: 50%;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        transform: translate(-50%, 0);
        border: 3px solid var(--surface-lowest);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.16);
      }
      .dot-arrival {
        background: var(--primary);
      }
      .dot-tour {
        background: #476644;
      }
      .dot-transfer {
        background: #923357;
      }
      .dot-departure {
        background: #ba1a1a;
      }
      .dot-default {
        background: var(--on-surface-variant);
      }
      .timeline-content {
        flex: 1 1 auto;
        min-width: 0;
        padding-bottom: 10px;
      }
      .timeline-item:last-child .timeline-content {
        padding-bottom: 0;
      }
      .timeline-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }
      .timeline-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 8px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .timeline-badge .material-symbols-outlined {
        font-size: 12px;
      }
      .badge-arrival {
        background: #cbffc2;
        color: #005312;
      }
      .badge-tour {
        background: var(--secondary-container);
        color: #304e2e;
      }
      .badge-transfer {
        background: var(--tertiary-fixed);
        color: var(--tertiary-text);
      }
      .badge-departure {
        background: var(--error-container);
        color: var(--error-text);
      }
      .badge-default {
        background: var(--surface-low);
        color: var(--on-surface-variant);
      }
      .timeline-time-box {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 8px;
        border-radius: 8px;
        background: #eae8e4;
      }
      .timeline-time-value {
        color: var(--on-surface);
        font-size: 11px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .timeline-title-text {
        margin: 6px 0 0;
        color: var(--on-surface);
        font-family: "Manrope", sans-serif;
        font-size: 16px;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.15;
      }
      .timeline-route {
        margin: 4px 0 0;
        color: var(--on-surface-variant);
        font-size: 11px;
        font-weight: 600;
        line-height: 1.3;
        overflow-wrap: anywhere;
      }
      .timeline-detail {
        margin: 4px 0 0;
        color: var(--on-surface-variant);
        font-size: 10px;
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
      .empty-row {
        margin: 0;
        color: var(--on-surface-variant);
        font-size: 11px;
        font-weight: 600;
      }
      .guideline-section {
        flex: 0 0 auto;
        margin: 0 16px 6px;
        padding-top: 8px;
        border-top: 1px solid rgba(191, 202, 186, 0.6);
      }
      .guideline-section h3 {
        margin: 0 0 8px;
        color: var(--on-surface);
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .guideline-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px;
      }
      .guideline-item {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        padding: 0 2px;
      }
      .guideline-item.is-middle {
        border-left: 1px solid rgba(191, 202, 186, 0.55);
        border-right: 1px solid rgba(191, 202, 186, 0.55);
      }
      .guideline-item .material-symbols-outlined {
        color: var(--primary);
        font-size: 14px;
        flex-shrink: 0;
      }
      .guideline-item p {
        margin: 0;
        color: var(--on-surface);
        font-size: 10px;
        font-weight: 600;
        line-height: 1.3;
      }
      .guideline-raudhah {
        margin-top: 6px;
        padding: 6px 8px;
        border-radius: 10px;
        border: 1px solid rgba(191, 202, 186, 0.65);
        background: rgba(245, 243, 239, 0.65);
        display: flex;
        align-items: flex-start;
        gap: 6px;
      }
      .guideline-raudhah .material-symbols-outlined {
        color: var(--primary);
        font-size: 14px;
        flex-shrink: 0;
      }
      .guideline-raudhah p {
        margin: 0;
        color: var(--on-surface);
        font-size: 10px;
        font-weight: 600;
        line-height: 1.3;
      }
      .guideline-raudhah strong {
        color: var(--on-surface);
        font-weight: 800;
      }
      .doc-footer {
        flex: 0 0 auto;
        margin: 0 16px 8px;
        padding-top: 8px;
        border-top: 1px solid #eceee7;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 14px;
      }
      .foot-label {
        color: #9aa091;
        font-size: 7px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .foot-value {
        margin-top: 4px;
        color: #5e6458;
        font-size: 9px;
        font-weight: 700;
      }
      .foot-right {
        text-align: right;
      }
      .signature-line {
        margin-top: 8px;
        margin-left: auto;
        width: 110px;
        border-bottom: 1px solid #d8ddd0;
      }
      .copyright {
        color: var(--on-surface-variant);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        opacity: 0.4;
      }
      @media screen and (max-width: 900px) {
        .doc-header {
          flex-direction: column;
          align-items: flex-start;
        }
        .doc-title {
          text-align: left;
        }
        .group-summary-layout {
          grid-template-columns: 1fr;
        }
        .group-summary-detail-grid {
          grid-template-columns: 1fr 1fr;
        }
      }
      @media print {
        html,
        body {
          width: 100%;
          min-height: 100%;
          height: auto;
          margin: 0;
          padding: 0;
          overflow: visible;
          background: #ffffff;
        }
        body {
          display: block;
        }
        .doc {
          width: 210mm;
          min-height: 297mm;
          height: auto;
          max-width: none;
          overflow: visible;
          box-shadow: none;
          border: 0;
          padding: 0;
        }
        .doc-header {
          flex-direction: row;
          align-items: flex-start;
        }
        .doc-title {
          margin-left: auto;
          text-align: right;
        }
        .group-summary-layout {
          grid-template-columns: minmax(0, 1.08fr) minmax(0, 1.12fr);
        }
        .group-summary-detail-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .doc-header,
        .group-summary,
        .guideline-section,
        .doc-footer,
        .timeline-item {
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .print-hidden {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="doc">
      <header class="doc-header">
        <div class="brand">
          <span class="brand-icon material-symbols-outlined">mosque</span>
          <div>
            <p class="brand-title">Ghaniya Tour And Travel</p>
            <p class="brand-sub">GTT Operations Desk</p>
          </div>
        </div>
        <div class="doc-title">
          <h1>Package Info</h1>
        </div>
      </header>

      <section class="group-summary">
        <div class="group-summary-layout">
          <article class="group-summary-identity">
          <span class="small-label">Primary Group ID</span>
          <h2 class="group-code">${escapeHtml(group.code)}</h2>
          <p class="group-name">${escapeHtml(group.name)}</p>
          </article>
          <div class="group-summary-detail-grid" aria-label="Group summary details">
            <article class="group-summary-detail-card">
              <span class="small-label">Pax Count</span>
              <span class="group-summary-detail-value">${group.pax}</span>
              <span class="group-summary-detail-sub">${resolvedTotalBuses} Bus</span>
            </article>
            <article class="group-summary-detail-card">
              <span class="small-label">Musyrif</span>
              <span class="group-summary-detail-value">${escapeHtml(musyrifProfile.name)}</span>
              <span class="group-summary-detail-sub">${escapeHtml(musyrifProfile.phone)}</span>
            </article>
            <article class="group-summary-detail-card">
              <span class="small-label">Depart</span>
              <span class="group-summary-detail-value">${escapeHtml(departDateLabel)}</span>
              <span class="group-summary-detail-sub">Flight In ${escapeHtml(arrivalFlightNumber)}</span>
            </article>
            <article class="group-summary-detail-card">
              <span class="small-label">Return</span>
              <span class="group-summary-detail-value">${escapeHtml(returnDateLabel)}</span>
              <span class="group-summary-detail-sub">Flight Out ${escapeHtml(returnFlightNumber)}</span>
            </article>
          </div>
        </div>
      </section>

      <section class="timeline-section">
        <div class="timeline-head">
          <h3>Full Itinerary</h3>
          <div class="timeline-head-line"></div>
        </div>
        <div class="timeline-wrap">
          ${itineraryTimelineRows || '<p class="empty-row">No itinerary data available.</p>'}
        </div>
      </section>

      <section class="guideline-section">
        <h3>Crucial Operational Guidelines</h3>
        <div class="guideline-grid">
          ${noteRows}
        </div>
        <div class="guideline-raudhah">
          <span class="material-symbols-outlined">event_available</span>
          <p><strong>Raudhah Dates:</strong> ${escapeHtml(raudhahDateSummary)}</p>
        </div>
      </section>

      <footer class="doc-footer">
        <div>
          <div class="foot-label">Document Timestamp</div>
          <div class="foot-value">${escapeHtml(generatedTimestamp)}</div>
        </div>
        <div class="foot-right">
          <div class="foot-label">Office Signature / Seal</div>
          <div class="signature-line"></div>
        </div>
      </footer>
    </main>
    <div class="copyright print-hidden">(c) 2026 Ghaniya Tour and Travel | Confidential Package Info</div>
  </body>
</html>`;

  printableWindow.document.open();
  printableWindow.document.write(printableHtml);
  printableWindow.document.close();

  schedulePrint(printableWindow);

  return true;
}
