type AuditJsonPrimitive = string | number | boolean | null;
type AuditJsonValue = AuditJsonPrimitive | AuditJsonValue[] | { [key: string]: AuditJsonValue };

export function sanitizeAuditPayloadValue(value: unknown): AuditJsonValue | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeAuditPayloadValue(entry) ?? null);
  }

  if (typeof value === "object") {
    const next: Record<string, AuditJsonValue> = {};
    for (const [key, entry] of Object.entries(value)) {
      const sanitizedEntry = sanitizeAuditPayloadValue(entry);
      if (sanitizedEntry !== undefined) {
        next[key] = sanitizedEntry;
      }
    }
    return next;
  }

  return String(value);
}

export function extractGroupId(group: unknown): string | undefined {
  if (typeof group !== "object" || group === null || !("id" in group)) {
    return undefined;
  }

  const id = (group as { id?: unknown }).id;
  return typeof id === "string" ? id.trim() || undefined : undefined;
}

export function extractGroupCode(group: unknown): string | undefined {
  if (typeof group !== "object" || group === null) {
    return undefined;
  }

  const code =
    "code" in group
      ? (group as { code?: unknown }).code
      : "groupCode" in group
        ? (group as { groupCode?: unknown }).groupCode
        : undefined;
  return typeof code === "string" ? code.trim().toUpperCase() : undefined;
}
