import { clearAuthSession } from "./auth-session.js";
import { resolveBackendApiBaseUrl } from "./backend-api-base.js";

export type ParsedBackendResponse = {
  payload: unknown;
  responseText: string;
};

const AUTH_PROBE_PATHS = ["/auth/login", "/auth/session"];

function resolveBackendEndpoint(pathOrUrl: string): string {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${resolveBackendApiBaseUrl()}${normalizedPath}`;
}

export async function fetchBackend(pathOrUrl: string, init?: RequestInit): Promise<Response> {
  const endpoint = resolveBackendEndpoint(pathOrUrl);
  const response = await fetch(endpoint, {
    ...init,
    credentials: "include",
    headers: new Headers(init?.headers),
  });

  const endpointPath = new URL(endpoint, "http://localhost").pathname.replace(/\/+$/, "");
  const isAuthProbe = AUTH_PROBE_PATHS.some((path) => endpointPath.endsWith(path));
  if (response.status === 401 && !isAuthProbe) {
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
