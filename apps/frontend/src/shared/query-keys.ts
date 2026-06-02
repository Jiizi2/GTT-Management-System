import type { GroupFetchProjection } from "../hooks/use-app-controller-backend";

export const authQueryKeys = {
  session: ["auth", "session"] as const,
};

export const groupQueryKeys = {
  all: ["groups"] as const,
  list: (projection: GroupFetchProjection, activeOnly = false) =>
    ["groups", "list", projection, activeOnly ? "active" : "all"] as const,
  searchRoot: ["groups", "search"] as const,
  search: (query: string, projection: GroupFetchProjection, activeOnly = false) =>
    ["groups", "search", projection, activeOnly ? "active" : "all", query] as const,
};

export const agreementDraftQueryKeys = {
  all: ["agreement-drafts"] as const,
  list: (query: string, status: "all" | "assigned" | "unassigned") =>
    ["agreement-drafts", "list", status, query.trim().toLowerCase()] as const,
};

export const masterDataQueryKeys = {
  all: ["master-data"] as const,
  categories: ["master-data", "categories"] as const,
  optionsRoot: ["master-data", "options"] as const,
  options: (categoryKey: string, includeInactive: boolean) =>
    ["master-data", "options", categoryKey, includeInactive ? "all" : "active"] as const,
};

export const userManagementQueryKeys = {
  all: ["user-management"] as const,
  users: ["user-management", "users"] as const,
};

export const invoiceQueryKeys = {
  all: ["invoices"] as const,
  dashboard: ["invoices", "dashboard"] as const,
};
