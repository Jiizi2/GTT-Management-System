import { describe, expect, it } from "vitest";
import {
  AGENT_AUTH_COOKIE_NAME,
  extractAgentAuthCookieToken,
  serializeAgentAuthCookie,
  serializeExpiredAgentAuthCookie,
} from "./agent-auth-cookie";

describe("agent auth cookie", () => {
  it("uses a distinct host-only HttpOnly cookie scoped to the agent API", () => {
    const cookie = serializeAgentAuthCookie("agent-token", 3600, { secure: true });
    expect(cookie).toContain(`${AGENT_AUTH_COOKIE_NAME}=agent-token`);
    expect(cookie).toContain("Path=/api/agent");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(cookie).not.toContain("Domain=");
  });

  it("extracts and expires only the agent cookie", () => {
    expect(extractAgentAuthCookieToken({ cookie: "gtt_auth_session=internal; gtt_agent_session=agent%20token" }))
      .toBe("agent token");
    expect(serializeExpiredAgentAuthCookie({ secure: false })).toContain("Max-Age=0");
  });
});
