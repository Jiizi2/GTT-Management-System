export type AnalyticsRange = {
  months: number;
  fromMonth: string;
  toMonth: string;
};

export type MonthlyPoint = {
  month: string;
  label: string;
};

export type OperationalMonthlyPoint = MonthlyPoint & {
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

export type VisaMonthlyPoint = MonthlyPoint & {
  issuedPax: number;
};

export type VisaMuassasahBreakdownItem = {
  muassasahId: string | null;
  name: string;
  groups: number;
  totalPax: number;
  issuedGroups: number;
  issuedPax: number;
  notIssuedPax: number;
  issuedRate: number;
};

export type VisaTypeBreakdownItem = {
  visaType: "VISA_ONLY" | "VISA_PLUS";
  label: "Visa Only" | "Visa+";
  groups: number;
  totalPax: number;
  issuedGroups: number;
  issuedPax: number;
  notIssuedPax: number;
  issuedRate: number;
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
  byMuassasah: VisaMuassasahBreakdownItem[];
  byVisaType: VisaTypeBreakdownItem[];
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
