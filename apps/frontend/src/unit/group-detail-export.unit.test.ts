import { afterEach, describe, expect, it, vi } from "vitest";
import type { GroupData, ItineraryItem, Musyrif } from "../shared/app-domain";
import { exportGroupDetailPdf } from "../pages/group-detail-export";

function createItineraryItem(overrides: Partial<ItineraryItem>): ItineraryItem {
  return {
    date: "01 Oct",
    year: "2026",
    isoDate: "2026-10-01",
    time: "08:00",
    category: "Transfer",
    categoryKey: "transfer",
    title: "Transfer",
    meta: "",
    icon: "route",
    from: "Jeddah Airport",
    to: "Madinah Hotel",
    requiresBus: true,
    ...overrides,
  };
}

describe("exportGroupDetailPdf", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates a downloadable PDF with selectable text", async () => {
    const group = {
      code: "GRP-204",
      name: "Kaba Tour Group",
      status: "Active",
      tone: "active",
      pax: 60,
      totalBuses: 2,
      visaSetup: {
        visaStatus: "Issued",
        syarikah: "",
        paymentStatus: "Paid",
        flightLegs: [
          {
            id: "onward-1",
            direction: "ONWARD",
            sortOrder: 0,
            departureAirportCode: "CGK",
            arrivalAirportCode: "DOH",
            departureDate: "2026-10-01",
            departureTime: "08:00",
            arrivalDate: "2026-10-01",
            arrivalTime: "12:00",
            carrierCode: "QR",
            flightNumber: "QR-955",
            remarks: "Transit",
          },
          {
            id: "onward-2",
            direction: "ONWARD",
            sortOrder: 1,
            departureAirportCode: "DOH",
            arrivalAirportCode: "JED",
            departureDate: "2026-10-01",
            departureTime: "14:00",
            arrivalDate: "2026-10-01",
            arrivalTime: "16:30",
            carrierCode: "QR",
            flightNumber: "QR-1188",
            remarks: "",
          },
          {
            id: "return-1",
            direction: "RETURN",
            sortOrder: 0,
            departureAirportCode: "JED",
            arrivalAirportCode: "CGK",
            departureDate: "2026-10-07",
            departureTime: "20:00",
            arrivalDate: "2026-10-08",
            arrivalTime: "10:00",
            carrierCode: "GA",
            flightNumber: "GA-981",
            remarks: "",
          },
        ],
        makkahHotels: [
          {
            id: "hotel-makkah",
            hotelName: "Olayan Ajyad",
            agreementNumber: "AGR-MKK-2026-00001234",
            pax: 60,
            status: "Approved",
            stayStartIso: "2026-10-04",
            stayEndIso: "2026-10-07",
          },
        ],
        madinahHotels: [],
        raudhahAppointments: [{ id: "raudhah-1", dateIso: "2026-10-02", status: "Free" }],
      },
    } as GroupData;
    const itineraryItems = [
      createItineraryItem({
        category: "Arrival",
        categoryKey: "arrival",
        transportMode: "flight",
        flightNumber: "WY 673",
        from: "Jeddah",
        to: "Makkah",
        hotelName: "Company Masyan AlMashaer Hotel",
        requiresBus: false,
      }),
      createItineraryItem({ time: "13:00", from: "Makkah", to: "Madinah" }),
      createItineraryItem({
        isoDate: "2026-10-03",
        category: "City Tour Madinah",
        categoryKey: "city-tour",
        from: "Madinah Hotel",
        to: "Masjid Quba",
        cityTourCity: "Madinah",
      }),
      createItineraryItem({
        isoDate: "2026-10-07",
        category: "Departure",
        categoryKey: "departure",
        transportMode: "flight",
        flightNumber: "WY 676",
        from: "Madinah",
        to: "Jeddah",
        hotelName: "Winner Inn Al Khair Hotel",
        requiresBus: false,
      }),
    ];
    const musyrifProfile = { name: "Ahmad", phone: "+62 812 0000", avatar: "" } satisfies Musyrif;

    let pdfSource = "";
    let savedFileName = "";
    const result = await exportGroupDetailPdf(
      { group, itineraryItems, noteItems: [], musyrifProfile },
      {
        logoDataUrl: null,
        save: (document, fileName) => {
          pdfSource = document.output();
          savedFileName = fileName;
        },
      },
    );

    expect(result).toBe(true);
    expect(savedFileName).toBe("Package Information - GRP-204.pdf");
    expect(pdfSource.startsWith("%PDF-")).toBe(true);
    expect(pdfSource).toContain("Package Information");
    expect(pdfSource).toContain("GRP-204");
    expect(pdfSource).toContain("Kaba Tour Group");
    expect(pdfSource).toContain("AGR-MKK-2026-00001234");
    expect(pdfSource).toContain("2 BUSES");
    expect(pdfSource).toContain("QR-955");
    expect(pdfSource).toContain("City Tour");
    expect(pdfSource).not.toContain("Company Masyan AlMashaer Hotel");
    expect(pdfSource).not.toContain("Winner Inn Al Khair Hotel");
    expect(pdfSource).not.toContain("DBL");
    expect(pdfSource).not.toContain("TRP");
    expect(pdfSource).not.toContain("QUAD");
  });
});
