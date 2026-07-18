import type { GroupLifecycleStatus } from "@prisma/client";

export type AgentPortalDashboard = {
  groups: {
    total: number;
    active: number;
    completed: number;
    archived: number;
    upcoming: number;
    totalPax: number;
  };
  attention: {
    visaGroups: number;
    hotelGroups: number;
  };
  upcomingGroups: Array<{
    id: string;
    code: string;
    name: string;
    lifecycleStatus: GroupLifecycleStatus;
    arrivalDate: string;
    returnDate: string;
    pax: number;
  }>;
  recentTimeline: Array<{
    group: { id: string; code: string; name: string };
    dateLabel: string;
    title: string;
    isCurrent: boolean;
  }>;
};

export type AgentPortalProfile = {
  account: { displayName: string };
  agent: { code: string; name: string };
};
