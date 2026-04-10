import assert from "node:assert/strict";
import {
  buildDashboardPath,
  buildGroupDetailPath,
  buildLoginPath,
  buildVisaDetailPath,
  isLoginRoute,
  resolveDashboardRouteFromPathname,
} from "../shared/app-route.js";

function runCase(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runCase("routes overview paths to canonical overview", () => {
  const route = resolveDashboardRouteFromPathname("/");
  assert.equal(route.activeNav, "overview");
  assert.equal(route.canonicalPath, "/overview");
});

runCase("routes group detail paths to canonical group detail", () => {
  const route = resolveDashboardRouteFromPathname("/groups/901794508/");
  assert.equal(route.activeNav, "overview");
  assert.equal(route.selectedGroupCode, "901794508");
  assert.equal(route.canonicalPath, "/groups/901794508");
});

runCase("routes visa detail paths to canonical visa detail", () => {
  const route = resolveDashboardRouteFromPathname("/visa/901794508");
  assert.equal(route.activeNav, "visa");
  assert.equal(route.selectedVisaGroupCode, "901794508");
  assert.equal(route.canonicalPath, "/visa/901794508");
});

runCase("recognizes login route from query parameter", () => {
  assert.equal(isLoginRoute("/dashboard", "screen=login"), true);
  assert.equal(isLoginRoute("/login", ""), true);
  assert.equal(isLoginRoute("/auth/login", ""), true);
});

runCase("builds canonical dashboard paths", () => {
  assert.equal(buildDashboardPath("overview"), "/overview");
  assert.equal(buildDashboardPath("new-group"), "/new-group");
  assert.equal(buildGroupDetailPath("901794508"), "/groups/901794508");
  assert.equal(buildVisaDetailPath("901794508"), "/visa/901794508");
  assert.equal(buildLoginPath(), "/login");
});
