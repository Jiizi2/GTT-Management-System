import type { NavId } from "./app-domain";

export type DashboardRouteState = {
  activeNav: NavId;
  selectedGroupCode: string | null;
  selectedVisaGroupCode: string | null;
  canonicalPath: string;
};

const DASHBOARD_PATH_BY_NAV: Record<NavId, string> = {
  overview: "/overview",
  input: "/new-group",
  checklist: "/checklist",
  visa: "/visa",
  "agreement-inbox": "/agreement-inbox",
  "new-group": "/new-group",
  invoice: "/invoice",
  "raudhah-reminder": "/raudhah-reminder",
  "user-management": "/user-management",
  "master-data": "/master-data",
  profile: "/profile",
};

function normalizePathname(pathname: string): string {
  const trimmedPathname = pathname.trim();
  if (!trimmedPathname) {
    return "/";
  }

  const withLeadingSlash = trimmedPathname.startsWith("/") ? trimmedPathname : `/${trimmedPathname}`;
  const withoutTrailingSlashes = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlashes || "/";
}

function normalizeRouteCode(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return "";
  }

  try {
    return decodeURIComponent(trimmedValue).trim();
  } catch {
    return trimmedValue;
  }
}

function buildDetailPath(prefix: string, code: string): string {
  const normalizedCode = code.trim();
  if (!normalizedCode) {
    return prefix;
  }

  return `${prefix}/${encodeURIComponent(normalizedCode)}`;
}

export function isLoginRoute(pathname: string, search = ""): boolean {
  const normalizedPathname = normalizePathname(pathname).toLowerCase();
  if (normalizedPathname === "/login" || normalizedPathname === "/auth/login") {
    return true;
  }

  return new URLSearchParams(search).get("screen")?.trim().toLowerCase() === "login";
}

export function buildLoginPath(): string {
  return "/login";
}

export function buildDashboardPath(navId: NavId): string {
  return DASHBOARD_PATH_BY_NAV[navId] ?? "/overview";
}

export function buildGroupDetailPath(groupCode: string): string {
  return buildDetailPath("/groups", groupCode);
}

export function buildGroupItineraryBuilderPath(groupCode: string): string {
  return buildDetailPath("/itinerary-builder", groupCode);
}

export function buildVisaDetailPath(groupCode: string): string {
  return buildDetailPath("/visa", groupCode);
}

export function resolveDashboardRouteFromPathname(pathname: string): DashboardRouteState {
  const normalizedPathname = normalizePathname(pathname);
  const normalizedLowerPathname = normalizedPathname.toLowerCase();

  if (normalizedLowerPathname.startsWith("/itinerary-builder/")) {
    const groupCode = normalizeRouteCode(normalizedPathname.slice("/itinerary-builder/".length).split("/")[0] ?? "");
    if (groupCode) {
      return {
        activeNav: "overview",
        selectedGroupCode: groupCode,
        selectedVisaGroupCode: null,
        canonicalPath: buildGroupItineraryBuilderPath(groupCode),
      };
    }
  }

  if (normalizedLowerPathname.startsWith("/groups/")) {
    const groupCode = normalizeRouteCode(normalizedPathname.slice("/groups/".length).split("/")[0] ?? "");
    if (groupCode) {
      return {
        activeNav: "overview",
        selectedGroupCode: groupCode,
        selectedVisaGroupCode: null,
        canonicalPath: buildGroupDetailPath(groupCode),
      };
    }
  }

  if (normalizedLowerPathname.startsWith("/visa/")) {
    const groupCode = normalizeRouteCode(normalizedPathname.slice("/visa/".length).split("/")[0] ?? "");
    if (groupCode) {
      return {
        activeNav: "visa",
        selectedGroupCode: null,
        selectedVisaGroupCode: groupCode,
        canonicalPath: buildVisaDetailPath(groupCode),
      };
    }
  }

  if (normalizedLowerPathname === "/" || normalizedLowerPathname === "/overview") {
    return {
      activeNav: "overview",
      selectedGroupCode: null,
      selectedVisaGroupCode: null,
      canonicalPath: "/overview",
    };
  }

  if (normalizedLowerPathname === "/checklist") {
    return {
      activeNav: "checklist",
      selectedGroupCode: null,
      selectedVisaGroupCode: null,
      canonicalPath: "/checklist",
    };
  }

  if (normalizedLowerPathname === "/visa") {
    return {
      activeNav: "visa",
      selectedGroupCode: null,
      selectedVisaGroupCode: null,
      canonicalPath: "/visa",
    };
  }

  if (normalizedLowerPathname === "/agreement-inbox") {
    return {
      activeNav: "agreement-inbox",
      selectedGroupCode: null,
      selectedVisaGroupCode: null,
      canonicalPath: "/agreement-inbox",
    };
  }

  if (normalizedLowerPathname === "/input" || normalizedLowerPathname === "/new-group") {
    return {
      activeNav: "new-group",
      selectedGroupCode: null,
      selectedVisaGroupCode: null,
      canonicalPath: "/new-group",
    };
  }

  if (normalizedLowerPathname === "/invoice") {
    return {
      activeNav: "invoice",
      selectedGroupCode: null,
      selectedVisaGroupCode: null,
      canonicalPath: "/invoice",
    };
  }

  if (normalizedLowerPathname === "/raudhah-reminder") {
    return {
      activeNav: "raudhah-reminder",
      selectedGroupCode: null,
      selectedVisaGroupCode: null,
      canonicalPath: "/raudhah-reminder",
    };
  }

  if (normalizedLowerPathname === "/manage-role" || normalizedLowerPathname === "/user-management") {
    return {
      activeNav: "user-management",
      selectedGroupCode: null,
      selectedVisaGroupCode: null,
      canonicalPath: "/user-management",
    };
  }

  if (normalizedLowerPathname === "/master-data") {
    return {
      activeNav: "master-data",
      selectedGroupCode: null,
      selectedVisaGroupCode: null,
      canonicalPath: "/master-data",
    };
  }

  if (normalizedLowerPathname === "/profile") {
    return {
      activeNav: "profile",
      selectedGroupCode: null,
      selectedVisaGroupCode: null,
      canonicalPath: "/profile",
    };
  }

  return {
    activeNav: "overview",
    selectedGroupCode: null,
    selectedVisaGroupCode: null,
    canonicalPath: "/overview",
  };
}
