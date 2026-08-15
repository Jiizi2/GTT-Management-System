import { Inject, Injectable } from "@nestjs/common";
import { GroupLifecycleStatus, GroupTone, VisaStatus } from "@prisma/client";
import { AgentsService } from "../agents/agents.service";
import type { GroupRepository } from "../domain/repositories/group.repository";
import type { GroupSummaryRecord } from "../groups/groups.service-types";
import { AnalyticsQueryDto, type AnalyticsMonthWindow } from "./dto/analytics-query.dto";
import type {
  AgentAnalytics,
  AnalyticsRange,
  MonthlyPoint,
  OperationalAnalytics,
  VisaAnalytics,
} from "./analytics.types";

const DEFAULT_WINDOW: AnalyticsMonthWindow = 12;
const PACKAGE_LIMIT = 6;

/** Ops visa pipeline, ordered from earliest to issued. */
const VISA_FUNNEL_ORDER: VisaStatus[] = [VisaStatus.DRAFT, VisaStatus.PENDING, VisaStatus.ISSUED];

type MonthBucket = MonthlyPoint;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function monthKey(value: Date | string): string {
  const date = toDate(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildMonthBuckets(months: number, now: Date): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - offset, 1));
    buckets.push({
      month: monthKey(date),
      label: monthLabel(date.getUTCFullYear(), date.getUTCMonth()),
    });
  }
  return buckets;
}

function buildRange(buckets: MonthBucket[], months: number): AnalyticsRange {
  return {
    months,
    fromMonth: buckets[0]?.month ?? "",
    toMonth: buckets[buckets.length - 1]?.month ?? "",
  };
}

/**
 * Normalize a group's Ops visa status, mirroring the Visa Tracking page: a group
 * with no visa setup yet is treated as DRAFT (every group is a visa row).
 */
function readVisaStatus(group: GroupSummaryRecord): VisaStatus {
  const status = group.visaSetup?.visaStatus;
  if (status === VisaStatus.PENDING || status === VisaStatus.ISSUED) {
    return status;
  }
  return VisaStatus.DRAFT;
}

/**
 * The issued-date ISO (YYYY-MM-DD) if it is a valid calendar date, else null.
 * Matches Visa Tracking, which only trusts `issuedDate` for issued visas and
 * never substitutes the departure date.
 */
function readIssuedDateIso(group: GroupSummaryRecord): string | null {
  const raw = group.visaSetup?.issuedDate;
  if (!raw) {
    return null;
  }
  const iso = raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly agentsService: AgentsService,
    @Inject("GroupRepository") private readonly groups: GroupRepository,
  ) {}

  private resolveWindow(query: AnalyticsQueryDto): AnalyticsMonthWindow {
    return query.months ?? DEFAULT_WINDOW;
  }

  private async loadGroups(agentId?: string): Promise<GroupSummaryRecord[]> {
    const result = await this.groups.findAll(undefined, {
      projection: "summary",
      agentId: agentId?.trim() || undefined,
    });
    const items = Array.isArray(result) ? result : result.items;
    return items as GroupSummaryRecord[];
  }

  async operational(query: AnalyticsQueryDto): Promise<OperationalAnalytics> {
    const months = this.resolveWindow(query);
    const buckets = buildMonthBuckets(months, new Date());
    const groups = await this.loadGroups(query.agentId);

    const monthlyByKey = new Map<string, { groups: number; pax: number }>();
    for (const bucket of buckets) {
      monthlyByKey.set(bucket.month, { groups: 0, pax: 0 });
    }

    const packagesByName = new Map<string, { groups: number; pax: number }>();
    let activeGroups = 0;
    let completedGroups = 0;
    let totalPax = 0;

    for (const group of groups) {
      const pax = group.pax ?? 0;
      totalPax += pax;

      const isActive =
        group.tone === GroupTone.ACTIVE || group.lifecycleStatus === GroupLifecycleStatus.ACTIVE;
      if (isActive) {
        activeGroups += 1;
      } else {
        completedGroups += 1;
      }

      const key = monthKey(group.arrivalDate);
      const bucket = monthlyByKey.get(key);
      if (bucket) {
        bucket.groups += 1;
        bucket.pax += pax;
      }

      const packageName = group.packageName?.trim() || "Tanpa Paket";
      const pkg = packagesByName.get(packageName) ?? { groups: 0, pax: 0 };
      pkg.groups += 1;
      pkg.pax += pax;
      packagesByName.set(packageName, pkg);
    }

    const packages = [...packagesByName.entries()]
      .map(([name, value]) => ({ name, groups: value.groups, pax: value.pax }))
      .sort((a, b) => b.pax - a.pax || b.groups - a.groups)
      .slice(0, PACKAGE_LIMIT);

    return {
      range: buildRange(buckets, months),
      totals: {
        groups: groups.length,
        pax: totalPax,
        activeGroups,
        completedGroups,
      },
      monthly: buckets.map((bucket) => {
        const value = monthlyByKey.get(bucket.month) ?? { groups: 0, pax: 0 };
        return { month: bucket.month, label: bucket.label, groups: value.groups, pax: value.pax };
      }),
      packages,
    };
  }

  async visa(query: AnalyticsQueryDto): Promise<VisaAnalytics> {
    const months = this.resolveWindow(query);
    const buckets = buildMonthBuckets(months, new Date());
    const groups = await this.loadGroups(query.agentId);

    // Everything is measured in pilgrims (pax), mirroring the Visa Tracking
    // issued statistics. Issued pax are bucketed by their issued-date month
    // (not the departure month), matching that page's month picker.
    const monthlyByKey = new Map<string, { issuedPax: number }>();
    for (const bucket of buckets) {
      monthlyByKey.set(bucket.month, { issuedPax: 0 });
    }

    const funnelPax = new Map<VisaStatus, number>();
    for (const stage of VISA_FUNNEL_ORDER) {
      funnelPax.set(stage, 0);
    }

    let totalPax = 0;
    let issuedPax = 0;
    let missingIssuedDatePax = 0;

    for (const group of groups) {
      const pax = group.pax ?? 0;
      totalPax += pax;

      const status = readVisaStatus(group);
      funnelPax.set(status, (funnelPax.get(status) ?? 0) + pax);

      if (status !== VisaStatus.ISSUED) {
        continue;
      }
      issuedPax += pax;

      const issuedIso = readIssuedDateIso(group);
      if (!issuedIso) {
        missingIssuedDatePax += pax;
        continue;
      }

      const bucket = monthlyByKey.get(issuedIso.slice(0, 7));
      if (bucket) {
        bucket.issuedPax += pax;
      }
    }

    const issuedRate = totalPax > 0 ? Math.round((issuedPax / totalPax) * 1000) / 10 : 0;

    return {
      range: buildRange(buckets, months),
      totals: {
        totalPax,
        issuedPax,
        notIssuedPax: totalPax - issuedPax,
        issuedRate,
        missingIssuedDatePax,
      },
      funnel: VISA_FUNNEL_ORDER.map((stage) => ({ stage, pax: funnelPax.get(stage) ?? 0 })),
      monthly: buckets.map((bucket) => {
        const value = monthlyByKey.get(bucket.month) ?? { issuedPax: 0 };
        return { month: bucket.month, label: bucket.label, issuedPax: value.issuedPax };
      }),
    };
  }

  async agents(query: AnalyticsQueryDto): Promise<AgentAnalytics> {
    const months = this.resolveWindow(query);
    const buckets = buildMonthBuckets(months, new Date());
    const [agents, groups] = await Promise.all([this.agentsService.list(), this.loadGroups(query.agentId)]);

    const statsByAgent = new Map<string, { groups: number; pax: number; visaIssuedPax: number }>();
    for (const group of groups) {
      const agentId = group.agentId;
      if (!agentId) {
        continue;
      }
      const pax = group.pax ?? 0;
      const stats = statsByAgent.get(agentId) ?? { groups: 0, pax: 0, visaIssuedPax: 0 };
      stats.groups += 1;
      stats.pax += pax;
      if (readVisaStatus(group) === VisaStatus.ISSUED) {
        stats.visaIssuedPax += pax;
      }
      statsByAgent.set(agentId, stats);
    }

    const scopedAgents = query.agentId?.trim()
      ? agents.filter((agent) => agent.id === query.agentId?.trim())
      : agents;

    const rows = scopedAgents
      .map((agent) => {
        const stats = statsByAgent.get(agent.id) ?? { groups: 0, pax: 0, visaIssuedPax: 0 };
        // Issuance rate is measured in pilgrims: issued pax over the agent's total pax.
        const visaIssuedRate =
          stats.pax > 0 ? Math.round((stats.visaIssuedPax / stats.pax) * 1000) / 10 : 0;
        return {
          agentId: agent.id,
          code: agent.code,
          name: agent.name,
          type: agent.type,
          status: agent.status,
          groups: stats.groups,
          pax: stats.pax,
          visaIssuedPax: stats.visaIssuedPax,
          visaIssuedRate,
        };
      })
      .sort((a, b) => b.pax - a.pax || b.groups - a.groups || a.name.localeCompare(b.name));

    return {
      range: buildRange(buckets, months),
      agents: rows,
    };
  }
}
