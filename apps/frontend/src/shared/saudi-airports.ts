export type SaudiAirport = { code: string; city: string; aliases?: readonly string[] };

// Airport/city pairs: https://www.acl-uk.org/faqs/ and https://www.tibahairports.com/en/.
// Keep IATA codes in storage; city names are display values, not hotel destinations.
export const SAUDI_AIRPORTS: readonly SaudiAirport[] = [
  { code: "JED", city: "Jeddah" },
  { code: "MED", city: "Madinah", aliases: ["Medina", "Madeena", "Al Madinah", "Al-Madinah"] },
  { code: "RUH", city: "Riyadh" },
  { code: "DMM", city: "Dammam" },
  { code: "TIF", city: "Taif", aliases: ["Ta'if"] },
  { code: "YNB", city: "Yanbu" },
  { code: "ULH", city: "AlUla", aliases: ["Al-Ula", "Al Ula"] },
  { code: "AHB", city: "Abha" },
  { code: "ABT", city: "Al Baha", aliases: ["Al Bahah", "Al-Baha"] },
  { code: "AJF", city: "Al Jouf", aliases: ["Al-Jawf", "Al Jawf"] },
  { code: "AQI", city: "Qaisumah", aliases: ["Hafar Al-Batin"] },
  { code: "BHH", city: "Bisha" },
  { code: "DWD", city: "Dawadmi" },
  { code: "EAM", city: "Najran" },
  { code: "EJH", city: "Al Wajh" },
  { code: "ELQ", city: "Qassim", aliases: ["Gassim", "Buraidah"] },
  { code: "GIZ", city: "Jazan", aliases: ["Jizan", "Gizan"] },
  { code: "HAS", city: "Hail", aliases: ["Ha'il", "Ha’il"] },
  { code: "HOF", city: "Al Ahsa", aliases: ["Al-Hofuf", "Hofuf"] },
  { code: "NUM", city: "Neom Bay" },
  { code: "RAE", city: "Arar" },
  { code: "RAH", city: "Rafha" },
  { code: "RSI", city: "Red Sea" },
  { code: "SHW", city: "Sharurah" },
  { code: "TUI", city: "Turaif" },
  { code: "TUU", city: "Tabuk" },
  { code: "URY", city: "Qurayyat", aliases: ["Gurayat"] },
  { code: "WAE", city: "Wadi al-Dawasir" },
];

export function findSaudiAirport(value?: string): SaudiAirport | undefined {
  const normalized = (value ?? "")
    .trim()
    .replace(/\s+(?:international\s+)?airport$/i, "")
    .toUpperCase();
  return SAUDI_AIRPORTS.find((airport) =>
    [airport.code, airport.city, ...(airport.aliases ?? [])].some((alias) => alias.toUpperCase() === normalized),
  );
}
