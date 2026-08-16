import assert from "node:assert/strict";
import { describe } from "vitest";
import {
  ANALYTICS_MONTH_WINDOWS,
  buildAnalyticsQueryString,
  visaStageLabel,
} from "../shared/analytics-types.js";
import { runCase } from "../test/run-case.js";

describe("analytics query helpers", () => {
  runCase("includes the months window in the query string", () => {
    assert.equal(buildAnalyticsQueryString(6), "months=6");
    assert.equal(buildAnalyticsQueryString(12), "months=12");
  });

  runCase("appends a concrete agentId but omits the 'all' sentinel", () => {
    assert.equal(buildAnalyticsQueryString(12, "agent-a"), "months=12&agentId=agent-a");
    assert.equal(buildAnalyticsQueryString(12, "all"), "months=12");
    assert.equal(buildAnalyticsQueryString(12, ""), "months=12");
  });

  runCase("exposes only the supported month windows", () => {
    assert.deepEqual([...ANALYTICS_MONTH_WINDOWS], [6, 12, 24]);
  });

  runCase("maps raw visa stages to Indonesian labels and passes unknown ones through", () => {
    assert.equal(visaStageLabel("DRAFT"), "Draft");
    assert.equal(visaStageLabel("PENDING"), "Diproses");
    assert.equal(visaStageLabel("ISSUED"), "Terbit");
    assert.equal(visaStageLabel("SOMETHING_ELSE"), "SOMETHING_ELSE");
  });
});
