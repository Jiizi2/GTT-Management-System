import * as Domain from "../shared/app-domain";
import type { GroupData, ItineraryItem, Musyrif, NoteItem } from "../shared/app-domain";

const {
  escapeHtml,
  formatScheduleTime,
  inferCategoryKey,
  inferCityTourCity,
  parseDisplayDateToIso,
  parseTimeForInput,
  resolveTotalBusCount,
} = Domain;

function formatItineraryActivityHeading(
  item: ItineraryItem,
  categoryKey: string,
  fallbackLabel: string,
): string {
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

function formatItinerarySupportDetail(item: ItineraryItem, categoryKey: string): string {
  const detailSegments: string[] = [];
  const flightNumber = item.flightNumber?.trim() ?? "";
  const stationPickupTime = item.destinationPickupTime?.trim() ?? "";
  const hotelPickupRequestTime = item.hotelPickupRequestTime?.trim() ?? "";
  const notes = item.notes?.trim() ?? "";

  if ((categoryKey === "arrival" || categoryKey === "departure") && flightNumber) {
    detailSegments.push(`Flight ${flightNumber}`);
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
}) {
    const printableWindow = window.open("", "_blank", "width=1120,height=760");
    if (!printableWindow) {
      return;
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
        ? sortedItinerary[sortedItinerary.length - 1]?.isoDate ??
          parseDisplayDateToIso(
            sortedItinerary[sortedItinerary.length - 1].date,
            sortedItinerary[sortedItinerary.length - 1].year,
          )
        : "";
    const arrivalItem = sortedItinerary.find((item) => inferCategoryKey(item) === "arrival");
    const returnItem = [...sortedItinerary]
      .reverse()
      .find((item) => inferCategoryKey(item) === "departure");
    const returnIso =
      returnItem?.isoDate ??
      (returnItem ? parseDisplayDateToIso(returnItem.date, returnItem.year) : fallbackEndIso);
    const arrivalFlightNumber = arrivalItem?.flightNumber?.trim() || "-";
    const returnFlightNumber = returnItem?.flightNumber?.trim() || "-";
    const returnHotelPickupRequestTime = returnItem?.hotelPickupRequestTime?.trim() || "-";
    const resolvedTotalBuses = resolveTotalBusCount(group.pax, group.totalBuses);

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
        const badgeLabel =
          categoryKey === "city-tour" && cityTourCity
            ? `City Tour / ${cityTourCity}`
            : item.category;
        const activityHeading = formatItineraryActivityHeading(item, categoryKey, item.category);
        const compactSummary = formatItineraryCompactSummary(item, categoryKey);
        const detailText = formatItinerarySupportDetail(item, categoryKey);
        const timeSource = item.transferByTrain
          ? item.trainDepartureTime || item.time || ""
          : item.time || "";
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
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Inter:wght@400;500;600;700&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      rel="stylesheet"
    />
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
      body {
        margin: 0;
        min-height: 100vh;
        padding: 44px 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
        background: var(--surface);
        color: var(--on-surface);
        font-family: "Inter", Arial, sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .material-symbols-outlined {
        font-family: "Material Symbols Outlined";
        font-variation-settings:
          "FILL" 0,
          "wght" 400,
          "GRAD" 0,
          "opsz" 24;
        vertical-align: middle;
      }
      .doc {
        width: 100%;
        max-width: 210mm;
        min-height: 297mm;
        background: var(--surface-lowest);
        border: 1px solid #d7d9d3;
        box-shadow: 0 0 40px rgba(0, 0, 0, 0.05);
        padding: 46px 42px 30px;
      }
      .doc-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        padding-bottom: 22px;
        margin-bottom: 26px;
        border-bottom: 2px solid rgba(13, 99, 27, 0.2);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .brand-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
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
        font-size: 18px;
        font-weight: 800;
        letter-spacing: -0.02em;
        text-transform: uppercase;
      }
      .brand-sub {
        margin: 2px 0 0;
        color: var(--on-surface-variant);
        font-size: 10px;
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
        font-size: 30px;
        font-weight: 800;
        letter-spacing: -0.03em;
        text-transform: uppercase;
        line-height: 1;
      }
      .doc-title p {
        margin: 6px 0 0;
        color: var(--primary);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      .group-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(0, 1.6fr) minmax(178px, 1fr);
        gap: 0;
        padding: 18px 20px;
        margin-bottom: 28px;
        border-radius: 12px;
        border: 1px solid rgba(191, 202, 186, 0.45);
        background: rgba(245, 243, 239, 0.55);
      }
      .group-cell {
        padding: 0 14px;
        min-width: 0;
      }
      .group-cell--id,
      .group-cell--meta {
        border-right: 1px solid rgba(191, 202, 186, 0.55);
      }
      .small-label {
        display: block;
        margin-bottom: 6px;
        color: var(--on-surface-variant);
        font-size: 9px;
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
        font-size: clamp(24px, 3.5vw, 34px);
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .group-name {
        margin: 8px 0 0;
        color: var(--on-surface);
        font-size: 14px;
        font-weight: 700;
        line-height: 1.45;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: flex-start;
      }
      .meta-value {
        color: var(--on-surface);
        font-size: 14px;
        font-weight: 700;
        line-height: 1.35;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .meta-sub {
        margin-top: 3px;
        color: var(--on-surface-variant);
        font-size: 11px;
        font-weight: 600;
        line-height: 1.45;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .meta-right {
        text-align: right;
        min-width: 126px;
      }
      .meta-value--pax {
        font-size: 22px;
        font-family: "Manrope", sans-serif;
        font-weight: 800;
      }
      .meta-value--pax span {
        color: var(--on-surface-variant);
        font-size: 11px;
        font-weight: 600;
      }
      .period-stack {
        display: grid;
        gap: 9px;
        align-content: center;
      }
      .period-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }
      .period-label {
        color: var(--on-surface-variant);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        flex-shrink: 0;
        padding-top: 2px;
      }
      .period-value {
        color: var(--on-surface);
        font-size: 11px;
        font-weight: 700;
        text-align: right;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      .timeline-section {
        margin-bottom: 22px;
      }
      .timeline-head {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 18px;
      }
      .timeline-head h3 {
        margin: 0;
        font-family: "Manrope", sans-serif;
        font-size: 24px;
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
        margin-left: 10px;
      }
      .timeline-item {
        display: flex;
        gap: 24px;
      }
      .timeline-date-col {
        width: 96px;
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: 4px;
      }
      .timeline-date {
        font-family: "Manrope", sans-serif;
        font-size: 20px;
        font-weight: 800;
        line-height: 1.05;
      }
      .timeline-day {
        margin-top: 3px;
        color: var(--on-surface-variant);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .timeline-line {
        position: relative;
        width: 1px;
        flex: 1;
        margin-top: 10px;
        background: var(--outline);
      }
      .timeline-line.is-last {
        background: transparent;
      }
      .timeline-dot {
        position: absolute;
        top: 0;
        left: 50%;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        transform: translate(-50%, 0);
        border: 4px solid var(--surface-lowest);
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
        flex: 1;
        padding-bottom: 28px;
      }
      .timeline-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }
      .timeline-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 11px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .timeline-badge .material-symbols-outlined {
        font-size: 14px;
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
        padding: 7px 10px;
        border-radius: 8px;
        background: #eae8e4;
      }
      .timeline-time-value {
        color: var(--on-surface);
        font-size: 13px;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
      }
      .timeline-title-text {
        margin: 10px 0 0;
        color: var(--on-surface);
        font-family: "Manrope", sans-serif;
        font-size: 20px;
        font-weight: 800;
        letter-spacing: -0.03em;
        line-height: 1.22;
      }
      .timeline-route {
        margin: 7px 0 0;
        color: var(--on-surface-variant);
        font-size: 14px;
        font-weight: 600;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      .timeline-detail {
        margin: 8px 0 0;
        color: var(--on-surface-variant);
        font-size: 12px;
        line-height: 1.55;
        overflow-wrap: anywhere;
      }
      .empty-row {
        margin: 0;
        color: var(--on-surface-variant);
        font-size: 13px;
        font-weight: 600;
      }
      .guideline-section {
        margin-top: 8px;
        padding-top: 20px;
        border-top: 1px solid rgba(191, 202, 186, 0.6);
      }
      .guideline-section h3 {
        margin: 0 0 12px;
        color: var(--on-surface);
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .guideline-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .guideline-item {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 2px 6px;
      }
      .guideline-item.is-middle {
        border-left: 1px solid rgba(191, 202, 186, 0.55);
        border-right: 1px solid rgba(191, 202, 186, 0.55);
      }
      .guideline-item .material-symbols-outlined {
        color: var(--primary);
        font-size: 18px;
        flex-shrink: 0;
      }
      .guideline-item p {
        margin: 0;
        color: var(--on-surface);
        font-size: 12px;
        font-weight: 600;
        line-height: 1.55;
      }
      .doc-footer {
        margin-top: 20px;
        padding-top: 14px;
        border-top: 1px solid #eceee7;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 20px;
      }
      .foot-label {
        color: #9aa091;
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .foot-value {
        margin-top: 4px;
        color: #5e6458;
        font-size: 11px;
        font-weight: 700;
      }
      .foot-right {
        text-align: right;
      }
      .signature-line {
        margin-top: 8px;
        margin-left: auto;
        width: 130px;
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
      @media (max-width: 900px) {
        .doc-header {
          flex-direction: column;
          align-items: flex-start;
        }
        .doc-title {
          text-align: left;
        }
        .group-grid {
          grid-template-columns: 1fr;
          gap: 14px;
        }
        .group-cell {
          padding: 0;
        }
        .group-cell--id,
        .group-cell--meta {
          border-right: 0;
          border-bottom: 1px solid rgba(191, 202, 186, 0.55);
          padding-bottom: 12px;
        }
        .meta-right {
          text-align: left;
        }
        .period-value {
          text-align: left;
        }
      }
      @media print {
        body {
          background: #ffffff;
          padding: 0;
        }
        .doc {
          width: 100%;
          max-width: none;
          min-height: auto;
          box-shadow: none;
          border: 0;
          padding: 34px 28px 20px;
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
          <p>Operational v.4.0</p>
        </div>
      </header>

      <section class="group-grid">
        <article class="group-cell group-cell--id">
          <span class="small-label">Primary Group ID</span>
          <h2 class="group-code">${escapeHtml(group.code)}</h2>
          <p class="group-name">${escapeHtml(group.name)}</p>
        </article>

        <article class="group-cell group-cell--meta">
          <div class="meta-grid">
            <div>
              <span class="small-label">Musyrif</span>
              <div class="meta-value">${escapeHtml(musyrifProfile.name)}</div>
              <div class="meta-sub">${escapeHtml(musyrifProfile.phone)}</div>
            </div>
            <div class="meta-right">
              <span class="small-label">Pax Count</span>
              <div class="meta-value meta-value--pax">${group.pax} <span>Travelers</span></div>
              <div class="meta-sub">${resolvedTotalBuses} Bus | ${escapeHtml(group.packageName)}</div>
            </div>
          </div>
        </article>

        <article class="group-cell group-cell--period">
          <div class="period-stack">
            <div class="period-row">
              <span class="period-label">Depart</span>
              <span class="period-value">${escapeHtml(departDateLabel)}</span>
            </div>
            <div class="period-row">
              <span class="period-label">Flight In</span>
              <span class="period-value">${escapeHtml(arrivalFlightNumber)}</span>
            </div>
            <div class="period-row">
              <span class="period-label">Return</span>
              <span class="period-value">${escapeHtml(returnDateLabel)}</span>
            </div>
            <div class="period-row">
              <span class="period-label">Flight Out</span>
              <span class="period-value">${escapeHtml(returnFlightNumber)}</span>
            </div>
            <div class="period-row">
              <span class="period-label">Hotel Pickup</span>
              <span class="period-value">${escapeHtml(
                returnHotelPickupRequestTime === "-"
                  ? "-"
                  : formatScheduleTime(returnHotelPickupRequestTime),
              )}</span>
            </div>
          </div>
        </article>
      </section>

      <section class="timeline-section">
        <div class="timeline-head">
          <h3>Full Itinerary</h3>
          <div class="timeline-head-line"></div>
        </div>
        <div class="timeline-wrap">
          ${
            itineraryTimelineRows || '<p class="empty-row">No itinerary data available.</p>'
          }
        </div>
      </section>

      <section class="guideline-section">
        <h3>Crucial Operational Guidelines</h3>
        <div class="guideline-grid">
          ${noteRows}
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

    window.setTimeout(() => {
      printableWindow.focus();
      printableWindow.print();
    }, 450);
}
