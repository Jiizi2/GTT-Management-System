import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { assertAgentPortalReadRequest } from "./agent-portal-request-policy";

describe("assertAgentPortalReadRequest", () => {
  it("accepts a read request without caller-controlled scope", () => {
    expect(() => assertAgentPortalReadRequest({ query: {}, headers: {} })).not.toThrow();
  });

  it.each([
    { query: { agentId: "other" } },
    { query: { nested: { agent_id: "other" } } },
    { headers: { "x-agent-id": "other" } },
    { body: { filter: { agentId: "other" } } },
  ])("rejects tenant selector substitution", (request) => {
    expect(() => assertAgentPortalReadRequest(request)).toThrow(BadRequestException);
  });

  it("rejects unsupported query parameters", () => {
    expect(() => assertAgentPortalReadRequest({ query: { debug: "1" } })).toThrow(
      "This Agent Portal route does not accept query parameters.",
    );
  });
});
