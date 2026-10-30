import { useQuery } from "@tanstack/react-query";
import { fetchBackendParsed } from "../shared/api-client";
import { formatBackendRequestError } from "../shared/api-error";
import {
  buildAnalyticsQueryString,
  type AgentAnalytics,
  type AnalyticsMonthWindow,
  type OperationalAnalytics,
  type VisaAnalytics,
} from "../shared/analytics-types";

export type AnalyticsFilters = {
  months: AnalyticsMonthWindow;
  agentId?: string;
};

function buildAnalyticsPath(resource: string, filters: AnalyticsFilters): string {
  return `/analytics/${resource}?${buildAnalyticsQueryString(filters.months, filters.agentId)}`;
}

async function fetchAnalytics<T>(resource: string, filters: AnalyticsFilters, signal?: AbortSignal): Promise<T> {
  const { response, payload, responseText } = await fetchBackendParsed(buildAnalyticsPath(resource, filters), {
    method: "GET",
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    throw new Error(
      formatBackendRequestError(response.status, payload, responseText, `Analytics ${resource} fetch failed`),
    );
  }
  return payload as T;
}

export function useOperationalAnalyticsQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics", "operational", filters.months, filters.agentId ?? "all"],
    queryFn: ({ signal }) => fetchAnalytics<OperationalAnalytics>("operational", filters, signal),
    staleTime: 60_000,
  });
}

export function useVisaAnalyticsQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics", "visa", filters.months, filters.agentId ?? "all"],
    queryFn: ({ signal }) => fetchAnalytics<VisaAnalytics>("visa", filters, signal),
    staleTime: 60_000,
  });
}

export function useAgentAnalyticsQuery(filters: AnalyticsFilters) {
  return useQuery({
    queryKey: ["analytics", "agents", filters.months, filters.agentId ?? "all"],
    queryFn: ({ signal }) => fetchAnalytics<AgentAnalytics>("agents", filters, signal),
    staleTime: 60_000,
  });
}
