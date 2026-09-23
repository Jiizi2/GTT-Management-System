import { jsPDF } from "jspdf";
import autoTable, { type RowInput, type UserOptions } from "jspdf-autotable";
import * as Domain from "../shared/app-domain";
import type { GroupData, ItineraryItem, Musyrif, NoteItem } from "../shared/app-domain";

const {
  inferCategoryKey,
  inferCityTourCity,
  parseDisplayDateToIso,
  parseTimeForInput,
  resolveTotalBusCount,
  resolveTransportMode,
} = Domain;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const PAGE_MARGIN = 12;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const PRIMARY: [number, number, number] = [35, 116, 49];
const PRIMARY_DARK: [number, number, number] = [37, 89, 54];
const PRIMARY_SOFT: [number, number, number] = [234, 243, 236];
const SURFACE_SOFT: [number, number, number] = [245, 248, 246];
const INK: [number, number, number] = [21, 24, 20];
const MUTED: [number, number, number] = [74, 84, 77];
const OUTLINE: [number, number, number] = [211, 220, 213];

type PdfWithLastTable = jsPDF & { lastAutoTable?: { finalY: number } };

type ExportOptions = {
  /** Passing null skips the logo, which is useful for deterministic tests. */
  logoDataUrl?: string | null;
  save?: (document: jsPDF, fileName: string) => void;
};

function resolveItemIsoDate(item: ItineraryItem): string {
  return item.isoDate ?? parseDisplayDateToIso(item.date, item.year);
}

function formatDocumentDate(isoDate: string): string {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDocumentTime(value?: string): string {
  const trimmedValue = value?.trim() ?? "";
  if (!trimmedValue) return "";
  if (/^\d{2}:\d{2}$/.test(trimmedValue)) return trimmedValue;
  return parseTimeForInput(trimmedValue) ?? trimmedValue;
}

function inferCarrierCode(flightNumber?: string): string {
  return flightNumber?.trim().match(/^([A-Za-z]{2,3})(?=[\s-]*\d)/)?.[1]?.toUpperCase() ?? "";
}

function formatActivityLabel(item: ItineraryItem, categoryKey: string): string {
  if (categoryKey === "arrival") return "Arrival";
  if (categoryKey === "city-tour") return "City Tour";
  if (categoryKey === "transfer") return "Transfer";
  if (categoryKey === "departure") return "Departure";
  return item.category.trim();
}

function cleanFileName(value: string): string {
  const cleaned = value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-");
  return cleaned || "group";
}

async function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read logo."));
    reader.readAsDataURL(blob);
  });
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const response = await fetch("/logo-ghaniya-travel-polos.png");
    if (!response.ok) return null;
    return await readBlobAsDataUrl(await response.blob());
  } catch {
    return null;
  }
}

function drawDocumentHeader(
  document: jsPDF,
  groupNumbers: string,
  generatedTimestamp: string,
  logoDataUrl: string | null,
): number {
  if (logoDataUrl) {
    try {
      document.addImage(logoDataUrl, "PNG", PAGE_MARGIN, 9, 18, 18, undefined, "FAST");
    } catch {
      // The brand text remains available if an installation serves an invalid logo.
    }
  }

  const brandX = logoDataUrl ? PAGE_MARGIN + 22 : PAGE_MARGIN;
  document.setFont("helvetica", "bold");
  document.setFontSize(13);
  document.setTextColor(...INK);
  document.text("Ghaniya Tour & Travel", brandX, 16);
  document.setFontSize(6.5);
  document.setTextColor(...PRIMARY);
  document.text("OPERATIONS & GROUND SERVICES", brandX, 21);

  document.setFontSize(18);
  document.setTextColor(...PRIMARY_DARK);
  document.text("Package Information", PAGE_WIDTH - PAGE_MARGIN, 15, { align: "right" });
  document.setFontSize(8);
  document.text(groupNumbers, PAGE_WIDTH - PAGE_MARGIN, 21, { align: "right", maxWidth: 78 });
  document.setFont("helvetica", "normal");
  document.setFontSize(6.5);
  document.setTextColor(...MUTED);
  document.text(`Generated ${generatedTimestamp} WIB`, PAGE_WIDTH - PAGE_MARGIN, 26, { align: "right" });

  document.setDrawColor(...PRIMARY);
  document.setLineWidth(0.7);
  document.line(PAGE_MARGIN, 31, PAGE_WIDTH - PAGE_MARGIN, 31);
  return 37;
}

function ensureSectionSpace(document: jsPDF, y: number, requiredHeight = 25): number {
  if (y + requiredHeight <= PAGE_HEIGHT - 15) return y;
  document.addPage();
  return PAGE_MARGIN;
}

function drawSectionTitle(document: jsPDF, title: string, y: number): number {
  const nextY = ensureSectionSpace(document, y);
  document.setFillColor(...PRIMARY);
  document.roundedRect(PAGE_MARGIN, nextY, CONTENT_WIDTH, 8, 2.5, 2.5, "F");
  document.rect(PAGE_MARGIN, nextY + 4, CONTENT_WIDTH, 4, "F");
  document.setFont("helvetica", "bold");
  document.setFontSize(8);
  document.setTextColor(255, 255, 255);
  document.text(title.toUpperCase(), PAGE_MARGIN + 3, nextY + 5.2);
  return nextY + 8;
}

function drawTable(document: jsPDF, y: number, options: UserOptions): number {
  autoTable(document, {
    startY: y,
    margin: { left: PAGE_MARGIN, right: PAGE_MARGIN, bottom: 17 },
    theme: "grid",
    tableWidth: CONTENT_WIDTH,
    showHead: "everyPage",
    rowPageBreak: "avoid",
    styles: {
      font: "helvetica",
      fontSize: 7.2,
      textColor: INK,
      lineColor: OUTLINE,
      lineWidth: 0.12,
      cellPadding: { top: 2.2, right: 2, bottom: 2.2, left: 2 },
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: PRIMARY_SOFT,
      textColor: PRIMARY_DARK,
      fontStyle: "bold",
      fontSize: 6.3,
      minCellHeight: 7,
    },
    alternateRowStyles: { fillColor: SURFACE_SOFT },
    ...options,
  });
  return ((document as PdfWithLastTable).lastAutoTable?.finalY ?? y) + 7;
}

function addFooters(document: jsPDF, groupNumbers: string): void {
  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setDrawColor(...OUTLINE);
    document.setLineWidth(0.2);
    document.line(PAGE_MARGIN, PAGE_HEIGHT - 12, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 12);
    document.setFont("helvetica", "normal");
    document.setFontSize(6.2);
    document.setTextColor(...MUTED);
    document.text("Ghaniya Tour & Travel · Package Information", PAGE_MARGIN, PAGE_HEIGHT - 7.5);
    document.setFont("helvetica", "bold");
    document.setTextColor(...PRIMARY_DARK);
    document.text(`${groupNumbers} · ${page}/${pageCount}`, PAGE_WIDTH - PAGE_MARGIN, PAGE_HEIGHT - 7.5, { align: "right" });
  }
}

export async function exportGroupDetailPdf(
  {
    group,
    itineraryItems,
    musyrifProfile,
    familyGroups = [],
  }: {
    group: GroupData;
    itineraryItems: ItineraryItem[];
    noteItems: NoteItem[];
    musyrifProfile: Musyrif;
    familyGroups?: GroupData[];
  },
  options: ExportOptions = {},
): Promise<boolean> {
  try {
    const document = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: false });
    document.setProperties({ title: `Package Information - ${group.code}`, author: "Ghaniya Tour & Travel" });

    const relatedGroups = familyGroups.length > 0 ? familyGroups : [group];
    const groupNumbers = relatedGroups.map((item) => item.code.trim()).filter(Boolean).join(" · ");
    const totalPaxCount = relatedGroups.reduce((total, item) => total + item.pax, 0);
    const totalBusCount = resolveTotalBusCount(totalPaxCount, group.totalBuses);
    const busLabel = `${totalBusCount} ${totalBusCount === 1 ? "BUS" : "BUSES"}`;
    const generatedTimestamp = new Date().toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const logoDataUrl = options.logoDataUrl === undefined ? await loadLogoDataUrl() : options.logoDataUrl;

    let y = drawDocumentHeader(document, groupNumbers, generatedTimestamp, logoDataUrl);
    y = drawSectionTitle(document, "Group Detail", y);
    y = drawTable(document, y, {
      head: [["Group Code", "Group Name", "Total Pax", "Tour Leader Indonesia", "Mutawwif Saudi"]],
      body: [[groupNumbers, group.name, String(totalPaxCount), musyrifProfile.name.trim(), ""]],
      columnStyles: {
        0: { cellWidth: 26 }, 1: { cellWidth: 47 }, 2: { cellWidth: 21, halign: "center" },
        3: { cellWidth: 46 }, 4: { cellWidth: 46 },
      },
    });

    const flightBody: RowInput[] = [];
    for (const direction of ["ONWARD", "RETURN"] as const) {
      flightBody.push([{ content: direction, colSpan: 8, styles: {
        fillColor: SURFACE_SOFT, textColor: PRIMARY_DARK, fontStyle: "bold", fontSize: 6.5,
      } }]);
      const legs = (group.visaSetup?.flightLegs ?? [])
        .filter((leg) => leg.direction === direction)
        .sort((left, right) => left.sortOrder - right.sortOrder);
      if (legs.length === 0) flightBody.push(["", "", "", "", "", "", "", ""]);
      legs.forEach((leg) => {
        const flightNumber = leg.flightNumber.trim();
        flightBody.push([
          formatDocumentDate(leg.departureDate), leg.departureAirportCode.trim().toUpperCase(),
          leg.arrivalAirportCode.trim().toUpperCase(), formatDocumentTime(leg.departureTime),
          formatDocumentTime(leg.arrivalTime), leg.carrierCode.trim().toUpperCase() || inferCarrierCode(flightNumber),
          flightNumber, leg.remarks.trim(),
        ]);
      });
    }
    y = drawSectionTitle(document, "Flight Detail", y);
    y = drawTable(document, y, {
      head: [["Date", "From", "To", "ETD", "ETA", "Carrier", "Flight No.", "Remarks"]],
      body: flightBody,
      columnStyles: {
        0: { cellWidth: 22 }, 1: { cellWidth: 15 }, 2: { cellWidth: 15 }, 3: { cellWidth: 16, halign: "center" },
        4: { cellWidth: 16, halign: "center" }, 5: { cellWidth: 20 }, 6: { cellWidth: 23 }, 7: { cellWidth: 59 },
      },
    });

    const hotelBody: RowInput[] = [
      ...(group.visaSetup?.makkahHotels ?? []).map((hotel) => ["MAKKAH", hotel.hotelName.trim(), formatDocumentDate(hotel.stayStartIso.trim()), formatDocumentDate(hotel.stayEndIso.trim()), hotel.agreementNumber.trim()]),
      ...(group.visaSetup?.madinahHotels ?? []).map((hotel) => ["MADINAH", hotel.hotelName.trim(), formatDocumentDate(hotel.stayStartIso.trim()), formatDocumentDate(hotel.stayEndIso.trim()), hotel.agreementNumber.trim()]),
    ];
    y = drawSectionTitle(document, "Hotel", y);
    y = drawTable(document, y, {
      head: [["City", "Hotel", "Check-in", "Check-out", "Agreement No."]],
      body: hotelBody.length > 0 ? hotelBody : [["", "", "", "", ""]],
      columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 54 }, 2: { cellWidth: 28 }, 3: { cellWidth: 28 }, 4: { cellWidth: 52 } },
    });

    const itineraryBody: RowInput[] = [...itineraryItems]
      .sort((left, right) => `${resolveItemIsoDate(left)}T${left.time ?? "00:00"}`.localeCompare(`${resolveItemIsoDate(right)}T${right.time ?? "00:00"}`))
      .map((item) => {
        const categoryKey = inferCategoryKey(item);
        const cityTourCity = categoryKey === "city-tour" ? inferCityTourCity(item).trim() : "";
        const requiresBus = item.requiresBus === true || resolveTransportMode(item) === "bus";
        return [
          formatDocumentDate(resolveItemIsoDate(item)), item.from?.trim() ?? "", item.to?.trim() || cityTourCity,
          formatActivityLabel(item, categoryKey), formatDocumentTime(item.time), requiresBus ? busLabel : "",
        ];
      });
    y = drawSectionTitle(document, "Itinerary", y);
    y = drawTable(document, y, {
      head: [["Date", "From", "To", "Activity", "Time", "Bus"]],
      body: itineraryBody.length > 0 ? itineraryBody : [["", "", "", "", "", ""]],
      columnStyles: {
        0: { cellWidth: 26 }, 1: { cellWidth: 37 }, 2: { cellWidth: 39 }, 3: { cellWidth: 34 },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 28, halign: "center", fillColor: PRIMARY_SOFT, textColor: PRIMARY_DARK, fontStyle: "bold" },
      },
    });

    const raudhahBody: RowInput[] = (group.visaSetup?.raudhahAppointments ?? []).map((appointment) => [
      "", formatDocumentDate(appointment.dateIso.trim()), "",
    ]);
    y = drawSectionTitle(document, "Praying at Raudhah", y);
    drawTable(document, y, {
      head: [["Group", "Date", "Time"]],
      body: raudhahBody.length > 0 ? raudhahBody : [["", "", ""]],
      columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: 63 }, 2: { cellWidth: 63, halign: "center" } },
    });

    addFooters(document, groupNumbers);
    const fileName = `Package Information - ${cleanFileName(group.code)}.pdf`;
    (options.save ?? ((pdf, name) => pdf.save(name)))(document, fileName);
    return true;
  } catch {
    return false;
  }
}
