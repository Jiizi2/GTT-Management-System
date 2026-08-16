export type AnalyticsRange = {
  months: number;
  fromMonth: string;
  toMonth: string;
};

export type OperationalMonthlyPoint = {
  month: string;
  label: string;
  groups: number;
  pax: number;
};

export type PackageBreakdownItem = {
  name: string;
  groups: number;
  pax: number;
};

export type OperationalAnalytics = {
  range: AnalyticsRange;
  totals: {
    groups: number;
    pax: number;
    activeGroups: number;
    completedGroups: number;
  };
  monthly: OperationalMonthlyPoint[];
  packages: PackageBreakdownItem[];
};

export type VisaFunnelStage = {
  stage: string;
  pax: number;
};

export type VisaMonthlyPoint = {
  month: string;
  label: string;
  issuedPax: number;
};

export type VisaAnalytics = {
  range: AnalyticsRange;
  totals: {
    totalPax: number;
    issuedPax: number;
    notIssuedPax: number;
    issuedRate: number;
    missingIssuedDatePax: number;
  };
  funnel: VisaFunnelStage[];
  monthly: VisaMonthlyPoint[];
};

export type AgentPerformanceRow = {
  agentId: string;
  code: string;
  name: string;
  type: string;
  status: string;
  groups: number;
  pax: number;
  visaIssuedPax: number;
  visaIssuedRate: number;
};

export type AgentAnalytics = {
  range: AnalyticsRange;
  agents: AgentPerformanceRow[];
};

export const ANALYTICS_MONTH_WINDOWS = [6, 12, 24] as const;
export type AnalyticsMonthWindow = (typeof ANALYTICS_MONTH_WINDOWS)[number];

/** Human-readable label for a raw Ops visa status (Group.visaSetup.visaStatus). */
export const VISA_STAGE_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING: "Diproses",
  ISSUED: "Terbit",
};

export function visaStageLabel(stage: string): string {
  return VISA_STAGE_LABELS[stage] ?? stage;
}

/**
 * Build the query string for an analytics request. `agentId` of "all" (or empty)
 * is treated as "no agent filter" and omitted so the backend returns every agent.
 */
export function buildAnalyticsQueryString(months: number, agentId?: string): string {
  const params = new URLSearchParams();
  params.set("months", String(months));
  if (agentId && agentId !== "all") {
    params.set("agentId", agentId);
  }
  return params.toString();
}
