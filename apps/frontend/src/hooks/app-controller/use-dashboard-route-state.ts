import { useCallback, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  buildDashboardPath,
  buildGroupDetailPath,
  buildVisaDetailPath,
  resolveDashboardRouteFromPathname,
} from "../../shared/app-route";
import { scrollToTop, type NavId, type SessionAccessTier, type VisaTrackingRow } from "../../shared/app-domain";

function normalizePathname(pathname: string): string {
  const trimmedPathname = pathname.trim() || "/";
  return trimmedPathname.replace(/\/+$/, "") || "/";
}

export function useDashboardRouteState(sessionAccessTier: SessionAccessTier) {
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = useMemo(() => resolveDashboardRouteFromPathname(location.pathname), [location.pathname]);

  useEffect(() => {
    if (normalizePathname(location.pathname) === routeState.canonicalPath) {
      return;
    }

    navigate(routeState.canonicalPath, { replace: true, flushSync: true });
  }, [location.pathname, navigate, routeState.canonicalPath]);

  useEffect(() => {
    if (routeState.activeNav !== "user-management" && routeState.activeNav !== "master-data") {
      return;
    }

    if (sessionAccessTier !== "super-admin") {
      navigate(buildDashboardPath("overview"), { replace: true, flushSync: true });
      scrollToTop();
    }
  }, [navigate, routeState.activeNav, sessionAccessTier]);

  const navigateToPath = useCallback(
    (pathname: string, { replace = false }: { replace?: boolean } = {}) => {
      const normalizedNextPath = normalizePathname(pathname);
      if (normalizePathname(location.pathname) === normalizedNextPath) {
        return;
      }

      navigate(normalizedNextPath, { replace, flushSync: true });
      scrollToTop();
    },
    [location.pathname, navigate],
  );

  const navigateToOverview = useCallback(
    (options?: { replace?: boolean }) => {
      navigateToPath(buildDashboardPath("overview"), options);
    },
    [navigateToPath],
  );

  const navigateToGroupDetail = useCallback(
    (groupCode: string, options?: { replace?: boolean }) => {
      navigateToPath(buildGroupDetailPath(groupCode.trim()), options);
    },
    [navigateToPath],
  );

  const navigateToVisaTracking = useCallback(
    (options?: { replace?: boolean }) => {
      navigateToPath(buildDashboardPath("visa"), options);
    },
    [navigateToPath],
  );

  const navigateToVisaDetail = useCallback(
    (groupCode: string, options?: { replace?: boolean }) => {
      navigateToPath(buildVisaDetailPath(groupCode.trim()), options);
    },
    [navigateToPath],
  );

  const navigateToNewGroup = useCallback(
    (options?: { replace?: boolean }) => {
      navigateToPath(buildDashboardPath("new-group"), options);
    },
    [navigateToPath],
  );

  const handleNavigate = useCallback(
    (navId: NavId) => {
      const normalizedNavId = navId === "input" ? "new-group" : navId;
      if (
        (normalizedNavId === "user-management" || normalizedNavId === "master-data") &&
        sessionAccessTier !== "super-admin"
      ) {
        return;
      }

      navigateToPath(buildDashboardPath(normalizedNavId));
    },
    [navigateToPath, sessionAccessTier],
  );

  const handleOpenDetail = useCallback(
    (groupCode: string) => {
      navigateToGroupDetail(groupCode);
    },
    [navigateToGroupDetail],
  );

  const handleBackToOverview = useCallback(() => {
    navigateToOverview({ replace: true });
  }, [navigateToOverview]);

  const handleOpenVisaDetail = useCallback(
    (row: VisaTrackingRow) => {
      navigateToVisaDetail(row.groupCode);
    },
    [navigateToVisaDetail],
  );

  const handleBackToVisaTracking = useCallback(() => {
    navigateToVisaTracking({ replace: true });
  }, [navigateToVisaTracking]);

  const handleOpenNewGroup = useCallback(() => {
    navigateToNewGroup();
  }, [navigateToNewGroup]);

  return {
    activeNav: routeState.activeNav,
    selectedGroupCode: routeState.selectedGroupCode,
    selectedVisaGroupCode: routeState.selectedVisaGroupCode,
    handleNavigate,
    handleOpenDetail,
    handleBackToOverview,
    handleOpenVisaDetail,
    handleBackToVisaTracking,
    handleOpenNewGroup,
    navigateToOverview,
    navigateToGroupDetail,
    navigateToVisaTracking,
    navigateToVisaDetail,
    navigateToNewGroup,
  };
}
