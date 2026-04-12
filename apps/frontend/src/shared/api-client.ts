import { clearAuthSession } from "./auth-session.js";
import { resolveBackendApiBaseUrl } from "./backend-api-base.js";

export type ParsedBackendResponse = {
  payload: unknown;
  responseText: string;
};

function resolveBackendEndpoint(pathOrUrl: string): string {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${resolveBackendApiBaseUrl()}${normalizedPath}`;
}

export async function fetchBackend(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(resolveBackendEndpoint(pathOrUrl), {
    ...init,
    credentials: "include",
    headers: new Headers(init?.headers),
  });

  if (response.status === 401) {
    clearAuthSession();
  }

  return response;
}

export async function parseBackendResponse(response: Response): Promise<ParsedBackendResponse> {
  const responseText = await response.text();
  if (!responseText.trim()) {
    return {
      payload: null,
      responseText,
    };
  }

  try {
    return {
      payload: JSON.parse(responseText) as unknown,
      responseText,
    };
  } catch {
    return {
      payload: responseText,
      responseText,
    };
  }
}

export async function fetchBackendParsed(
  pathOrUrl: string,
  init?: RequestInit,
): Promise<ParsedBackendResponse & { response: Response }> {
  const response = await fetchBackend(pathOrUrl, init);
  const parsedResponse = await parseBackendResponse(response);

  return {
    response,
    ...parsedResponse,
  };
}
