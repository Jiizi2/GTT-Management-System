function readTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readPayloadMessage(payload: unknown): string | null {
  const directPayloadMessage = readTrimmedString(payload);
  if (directPayloadMessage) {
    return directPayloadMessage;
  }

  if (!payload || typeof payload !== "object" || !("message" in payload)) {
    return null;
  }

  const message = (payload as { message?: unknown }).message;
  const directMessage = readTrimmedString(message);
  if (directMessage) {
    return directMessage;
  }

  if (!Array.isArray(message)) {
    return null;
  }

  for (const entry of message) {
    const listMessage = readTrimmedString(entry);
    if (listMessage) {
      return listMessage;
    }
  }

  return null;
}

function readBackendErrorDetail(payload: unknown, fallbackText: string): string | null {
  return readPayloadMessage(payload) ?? readTrimmedString(fallbackText);
}

export function extractBackendErrorMessage(
  status: number,
  payload: unknown,
  fallbackText: string,
  defaultMessage: string,
): string {
  return readBackendErrorDetail(payload, fallbackText) ?? `${defaultMessage} (${status}).`;
}

export function formatBackendRequestError(
  status: number,
  payload: unknown,
  fallbackText: string,
  prefix: string,
): string {
  const detail = readBackendErrorDetail(payload, fallbackText);
  return detail ? `${prefix} (${status}): ${detail}` : `${prefix} (${status}).`;
}
