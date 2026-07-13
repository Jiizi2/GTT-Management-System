/**
 * Determines if a Saudi city dropdown should be used for a given category and field
 * @param category - The itinerary category (arrival, transfer, departure, etc.)
 * @param field - The field being edited ("from" or "to")
 * @returns true if Saudi city dropdown should be used
 */
export function shouldUseSaudiCityDropdown(
  category: string,
  field: "from" | "to"
): boolean {
  if (category === "arrival" || category === "transfer") {
    return true;
  }

  if (category === "departure" && (field === "from" || field === "to")) {
    return true;
  }

  return false;
}
