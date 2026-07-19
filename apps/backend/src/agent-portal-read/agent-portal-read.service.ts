import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AgreementApprovalStatus,
  GroupLifecycleStatus,
  VisaStatus,
} from "@prisma/client";
import { resolveConfiguredDataSource } from "../config/app-config";
import type { MemoryGroupRecord } from "../groups/groups.service-types";
import { GroupMemoryStore } from "../infrastructure/repositories/memory/group-memory-store";
import { PrismaService } from "../prisma/prisma.service";
import type { AgentPrincipal } from "../agent-auth/agent-auth.types";
import type { AgentPortalDashboard, AgentPortalProfile } from "./agent-portal-read.types";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(value: Date | string): string {
  return new Date(value).toISOString();
}

function jakartaWindow(now: Date): { start: Date; end: Date } {
  const jakarta = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const start = new Date(
    Date.UTC(jakarta.getUTCFullYear(), jakarta.getUTCMonth(), jakarta.getUTCDate()) - 7 * 60 * 60 * 1000,
  );
  return { start, end: new Date(start.getTime() + 30 * DAY_MS) };
}

function isUpcoming(group: Pick<MemoryGroupRecord, "arrivalDate" | "returnDate">, start: Date, end: Date): boolean {
  return [group.arrivalDate, group.returnDate].some((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return date >= start && date < end;
  });
}

@Injectable()
export class AgentPortalReadService {
  private readonly dataSource: "memory" | "prisma";

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly memoryGroups: GroupMemoryStore,
  ) {
    this.dataSource = resolveConfiguredDataSource(config);
  }

  profile(principal: AgentPrincipal): AgentPortalProfile {
    return {
      account: { displayName: principal.displayName },
      agent: { code: principal.agentCode, name: principal.agentName },
    };
  }

  async dashboard(principal: AgentPrincipal): Promise<AgentPortalDashboard> {
    return this.dataSource === "prisma"
      ? this.dashboardFromPrisma(principal.agentId)
      : this.dashboardFromMemory(principal.agentId);
  }

  private async dashboardFromPrisma(agentId: string): Promise<AgentPortalDashboard> {
    const { start, end } = jakartaWindow(new Date());
    const upcomingWhere = {
      agentId,
      OR: [
        { arrivalDate: { gte: start, lt: end } },
        { returnDate: { gte: start, lt: end } },
      ],
    };
    const [aggregate, lifecycle, upcoming, upcomingGroups, visaGroups, hotelGroups, timeline] =
      await Promise.all([
        this.prisma.group.aggregate({
          where: { agentId },
          _count: { _all: true },
          _sum: { pax: true },
        }),
        this.prisma.group.groupBy({
          by: ["lifecycleStatus"],
          where: { agentId },
          _count: { _all: true },
        }),
        this.prisma.group.count({ where: upcomingWhere }),
        this.prisma.group.findMany({
          where: upcomingWhere,
          orderBy: [{ arrivalDate: "asc" }, { id: "asc" }],
          take: 5,
          select: {
            id: true,
            code: true,
            name: true,
            lifecycleStatus: true,
            arrivalDate: true,
            returnDate: true,
            pax: true,
          },
        }),
        this.prisma.group.count({
          where: {
            agentId,
            OR: [
              { visaSetup: { is: null } },
              { visaSetup: { is: { visaStatus: { not: VisaStatus.ISSUED } } } },
            ],
          },
        }),
        this.prisma.group.count({
          where: {
            agentId,
            OR: [
              { visaSetup: { is: null } },
              { visaSetup: { is: { hotelAgreements: { none: {} } } } },
              {
                visaSetup: {
                  is: { hotelAgreements: { some: { status: { not: AgreementApprovalStatus.APPROVED } } } },
                },
              },
            ],
          },
        }),
        this.prisma.groupTimelineItem.findMany({
          where: { group: { agentId } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 5,
          select: {
            dateLabel: true,
            title: true,
            isCurrent: true,
            group: { select: { id: true, code: true, name: true } },
          },
        }),
      ]);
    const countFor = (status: GroupLifecycleStatus): number =>
      lifecycle.find((row) => row.lifecycleStatus === status)?._count._all ?? 0;

    return {
      groups: {
        total: aggregate._count._all,
        active: countFor(GroupLifecycleStatus.ACTIVE),
        completed: countFor(GroupLifecycleStatus.COMPLETED),
        archived: countFor(GroupLifecycleStatus.ARCHIVED),
        upcoming,
        totalPax: aggregate._sum.pax ?? 0,
      },
      attention: { visaGroups, hotelGroups },
      upcomingGroups: upcomingGroups.map((group) => ({
        ...group,
        arrivalDate: isoDate(group.arrivalDate),
        returnDate: isoDate(group.returnDate),
      })),
      recentTimeline: timeline,
    };
  }

  private dashboardFromMemory(agentId: string): AgentPortalDashboard {
    const { start, end } = jakartaWindow(new Date());
    const owned = this.memoryGroups.groups.filter((group) => group.agentId === agentId);
    const upcoming = owned
      .filter((group) => isUpcoming(group, start, end))
      .sort((left, right) => left.arrivalDate.localeCompare(right.arrivalDate) || left.id.localeCompare(right.id));
    const statusCount = (status: GroupLifecycleStatus): number =>
      owned.filter((group) => (group.lifecycleStatus ?? GroupLifecycleStatus.ACTIVE) === status).length;

    return {
      groups: {
        total: owned.length,
        active: statusCount(GroupLifecycleStatus.ACTIVE),
        completed: statusCount(GroupLifecycleStatus.COMPLETED),
        archived: statusCount(GroupLifecycleStatus.ARCHIVED),
        upcoming: upcoming.length,
        totalPax: owned.reduce((sum, group) => sum + group.pax, 0),
      },
      attention: {
        visaGroups: owned.filter((group) => group.visaSetup?.visaStatus !== VisaStatus.ISSUED).length,
        hotelGroups: owned.filter(
          (group) =>
            !group.visaSetup?.hotelAgreements.length ||
            group.visaSetup.hotelAgreements.some((hotel) => hotel.status !== AgreementApprovalStatus.APPROVED),
        ).length,
      },
      upcomingGroups: upcoming.slice(0, 5).map((group) => ({
        id: group.id,
        code: group.code,
        name: group.name,
        lifecycleStatus: group.lifecycleStatus ?? GroupLifecycleStatus.ACTIVE,
        arrivalDate: isoDate(group.arrivalDate),
        returnDate: isoDate(group.returnDate),
        pax: group.pax,
      })),
      recentTimeline: owned
        .flatMap((group) =>
          (group.timeline ?? []).map((item, index) => ({
            group: { id: group.id, code: group.code, name: group.name },
            dateLabel: item.dateLabel,
            title: item.title,
            isCurrent: item.isCurrent ?? false,
            groupUpdatedAt: group.updatedAt,
            sortOrder: item.sortOrder ?? index,
          })),
        )
        .sort((left, right) =>
          right.groupUpdatedAt.localeCompare(left.groupUpdatedAt) || right.sortOrder - left.sortOrder,
        )
        .slice(0, 5)
        .map(({ groupUpdatedAt: _updatedAt, sortOrder: _sortOrder, ...item }) => item),
    };
  }
}
