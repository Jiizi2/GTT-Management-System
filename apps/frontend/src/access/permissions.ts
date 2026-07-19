import type { AuthSessionUser } from "../shared/auth-session";
import type { AgentPrincipal } from "../agent/auth/agent-session";

export const PERMISSIONS = {
  overviewRead: "overview.read",
  groupsRead: "groups.read",
  visaTrackingRead: "visa-tracking.read",
  checklistRead: "checklist.read",
  profileRead: "profile.read",
  operationsWrite: "operations.write",
  accessManage: "access.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export type AppPrincipal =
  | { kind: "internal"; id: string; permissions: ReadonlySet<Permission> }
  | { kind: "agent"; id: string; agentId: string; permissions: ReadonlySet<Permission> };

const AGENT_READ_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.overviewRead,
  PERMISSIONS.groupsRead,
  PERMISSIONS.visaTrackingRead,
  PERMISSIONS.checklistRead,
  PERMISSIONS.profileRead,
];
const INTERNAL_PERMISSIONS: readonly Permission[] = [
  ...AGENT_READ_PERMISSIONS,
  PERMISSIONS.operationsWrite,
  PERMISSIONS.accessManage,
];

export function createInternalPrincipal(user: AuthSessionUser): AppPrincipal {
  return { kind: "internal", id: user.id, permissions: new Set(INTERNAL_PERMISSIONS) };
}

export function createAgentPrincipal(user: AgentPrincipal): AppPrincipal {
  return {
    kind: "agent",
    id: user.portalUserId,
    agentId: user.agentId,
    permissions: new Set(AGENT_READ_PERMISSIONS),
  };
}

export function can(principal: AppPrincipal, permission: Permission): boolean {
  return principal.permissions.has(permission);
}
