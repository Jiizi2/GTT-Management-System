type GroupSearchDocumentInput = {
  code?: string | null;
  name?: string | null;
  status?: string | null;
  packageName?: string | null;
};

function normalizeSearchSegment(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function compactNormalizedSegment(value: string): string {
  return normalizeSearchSegment(value).replace(/\s+/g, "");
}

export function normalizeGroupSearchTokens(query?: string): string[] {
  if (!query) {
    return [];
  }

  const normalized = normalizeSearchSegment(query);
  if (!normalized) {
    return [];
  }

  const uniqueTokens = new Set<string>();
  normalized.split(" ").forEach((token) => {
    if (token) {
      uniqueTokens.add(token);
    }
  });

  return [...uniqueTokens];
}

export function buildGroupSearchDocument(input: GroupSearchDocumentInput): string {
  const uniqueSegments = new Set<string>();

  [input.code, input.name, input.status, input.packageName].forEach((value) => {
    const trimmedValue = value?.trim() ?? "";
    if (!trimmedValue) {
      return;
    }

    const normalized = normalizeSearchSegment(trimmedValue);
    if (normalized) {
      uniqueSegments.add(normalized);
    }

    const compact = compactNormalizedSegment(trimmedValue);
    if (compact && compact !== normalized) {
      uniqueSegments.add(compact);
    }
  });

  return [...uniqueSegments].join(" ");
}
