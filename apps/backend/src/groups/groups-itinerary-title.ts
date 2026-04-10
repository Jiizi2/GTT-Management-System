type ItineraryTitleSource = {
  title?: string | null;
  category: string;
  categoryKey?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  cityTourCity?: string | null;
};

const knownCategoryKeys = new Set(["arrival", "transfer", "departure", "city-tour"]);

function normalizeCategoryKey(category: string, categoryKey?: string | null): string {
  const trimmedCategoryKey = categoryKey?.trim().toLowerCase();
  if (trimmedCategoryKey && knownCategoryKeys.has(trimmedCategoryKey)) {
    return trimmedCategoryKey;
  }

  const normalizedCategory = category.trim().toLowerCase();
  if (normalizedCategory.includes("arrival")) {
    return "arrival";
  }

  if (normalizedCategory.includes("city tour") || normalizedCategory.includes("tour")) {
    return "city-tour";
  }

  if (normalizedCategory.includes("transfer")) {
    return "transfer";
  }

  if (normalizedCategory.includes("departure")) {
    return "departure";
  }

  return "city-tour";
}

export function formatRouteSummary(category: string, from: string, to: string, cityTourCity = ""): string {
  const trimmedFrom = from.trim();
  const trimmedTo = to.trim();
  const trimmedCityTourCity = cityTourCity.trim();

  if (!trimmedFrom || !trimmedTo) {
    return [trimmedFrom, trimmedTo].filter(Boolean).join(" -> ");
  }

  if (category === "arrival") {
    return `Landing at ${trimmedFrom} and heading to ${trimmedTo}`;
  }

  if (category === "transfer") {
    return `Transfer from ${trimmedFrom} to ${trimmedTo}`;
  }

  if (category === "departure") {
    return `Depart from ${trimmedFrom} to ${trimmedTo}`;
  }

  if (category === "city-tour") {
    if (!trimmedCityTourCity) {
      return `${trimmedFrom} -> ${trimmedTo}`;
    }

    return `City Tour in ${trimmedCityTourCity}: ${trimmedFrom} -> ${trimmedTo}`;
  }

  return `${trimmedFrom} -> ${trimmedTo}`;
}

export function resolveItineraryTitle(source: ItineraryTitleSource): string {
  const trimmedTitle = source.title?.trim();
  if (trimmedTitle) {
    return trimmedTitle;
  }

  const resolvedCategoryKey = normalizeCategoryKey(source.category, source.categoryKey);
  const routeSummary = formatRouteSummary(
    resolvedCategoryKey,
    source.fromLocation?.trim() ?? "",
    source.toLocation?.trim() ?? "",
    source.cityTourCity?.trim() ?? "",
  );

  return routeSummary || source.category.trim() || "Activity detail pending";
}
