/**
 * Brand (penerbit) registry for invoices.
 *
 * The invoice PDF used to hardcode a single issuer (PT. Ghaniya Zilia Rahman)
 * across the header, watermark, signature block, footer, title, and the
 * thank-you fallback note. Multiple travel brands now issue invoices, so every
 * issuer-specific value lives here in one place. The brand is stored per invoice
 * as a `[Brand:...]` tag in `notes` (see `invoice-notes-tags.ts`); the absence of
 * a tag means Ghaniya, keeping every existing invoice unchanged.
 */

export type InvoiceBrandId = "ghaniya" | "yahya";

/**
 * Which PDF template a brand prints with.
 * - `classic`: the original gold Ghaniya template (must stay byte-for-byte).
 * - `sultan`: the purple, payment-in-table layout modelled on Sultan Fatih p.1.
 */
export type InvoiceLayout = "classic" | "sultan";

export type InvoiceBrandProfile = {
  id: InvoiceBrandId;
  /** Human label shown in the brand dropdown. */
  label: string;
  /** Legal entity name; also the default beneficiary. */
  brandName: string;
  directorName: string;
  directorTitle: string;
  /** PPIU permit number, rendered as `IZIN PPIU: <izinPpiu>`. */
  izinPpiu: string;
  alamat: string;
  /** Public path to the "polos"/transparent logo (header + watermark). */
  logoFileName: string;
  /** `<title>` of the printable document. */
  documentTitle: string;
  /** Fallback note when the invoice has no human-written note. */
  thankYouNote: string;
  footerText: string;
  /** Short tagline shown on the `sultan` layout (header/footer); omit to hide. */
  tagline?: string;
  /** PDF template used by this brand. */
  layout: InvoiceLayout;
  /** Contact phone shown in the `sultan` header; omit to hide. */
  phone?: string;
  /** Social handle (IG/FB) shown in the `sultan` header; omit to hide. */
  socialHandle?: string;
};

export const DEFAULT_INVOICE_BRAND: InvoiceBrandId = "ghaniya";

export const INVOICE_BRANDS: Record<InvoiceBrandId, InvoiceBrandProfile> = {
  ghaniya: {
    id: "ghaniya",
    label: "Ghaniya Tour & Travel",
    brandName: "PT. Ghaniya Zilia Rahman",
    directorName: "Husein Ghanim",
    directorTitle: "Director",
    izinPpiu: "SK NO U.419 TAHUN 2021",
    alamat:
      "Graha Al Badegel Jl. Hajjah Tutty Alawiyah No.7, RT.2/RW.5, Kalibata, Kec. Pancoran, Kota Jakarta Selatan, Daerah Khusus Ibukota Jakarta",
    logoFileName: "/logo-ghaniya-travel-polos.png",
    documentTitle: "Invoice - Ghaniya Tour & Travel",
    thankYouNote:
      "Thank you for choosing Ghaniya Tour & Travel for your spiritual pilgrimage. We look forward to serving your group.",
    footerText: "© 2026 PT. Ghaniya Zilia Rahman",
    layout: "classic",
  },
  yahya: {
    id: "yahya",
    label: "Yahya Tours",
    brandName: "PT YAHYA TOUR INDONESIA",
    directorName: "ARIF WIBOWO",
    directorTitle: "Direktur",
    // PPIU belum ada ("-"); header memakai Nomor Izin Berusaha (NIB).
    izinPpiu: "2201260076655",
    alamat:
      "Jl. Bunga Rampai I/5/119, Kel. Malaka Jaya, Kec. Duren Sawit, Kota Adm. Jakarta Timur, Provinsi DKI Jakarta, Kode Pos 13460",
    logoFileName: "/logo-yahya-tours-polos.png",
    documentTitle: "Invoice - Yahya Tours",
    thankYouNote:
      "Terima kasih telah mempercayakan perjalanan ibadah Anda kepada Yahya Tours — Everyone Can Umra.",
    footerText: "© 2026 PT YAHYA TOUR INDONESIA",
    tagline: "Everyone Can Umra",
    layout: "sultan",
    // TODO(yahya): isi kontak header bila ada (telp / IG-FB).
    phone: "",
    socialHandle: "",
  },
};

function isInvoiceBrandId(value: string): value is InvoiceBrandId {
  return value === "ghaniya" || value === "yahya";
}

/** Resolve a brand id (from a tag or form field) to its profile; falls back to Ghaniya. */
export function resolveInvoiceBrand(id?: string): InvoiceBrandProfile {
  const normalized = id?.trim().toLowerCase() ?? "";
  if (isInvoiceBrandId(normalized)) {
    return INVOICE_BRANDS[normalized];
  }
  return INVOICE_BRANDS[DEFAULT_INVOICE_BRAND];
}

/** Options for the brand `<select>`, ordered with the default brand first. */
export const invoiceBrandOptions: ReadonlyArray<{ value: InvoiceBrandId; label: string }> = [
  { value: "ghaniya", label: INVOICE_BRANDS.ghaniya.label },
  { value: "yahya", label: INVOICE_BRANDS.yahya.label },
];
