import { describe, expect, it } from "vitest";
import { PERMISSIONS, can, createAgentPrincipal, createInternalPrincipal } from "../access/permissions";

describe("central permission resolver", () => {
  it("keeps Agent read-only", () => {
    const principal = createAgentPrincipal({
      portalUserId: "p1",
      agentId: "a1",
      displayName: "Agent",
      email: "a@gtt.test",
      agentCode: "A",
      agentName: "Agent A",
      mustChangePassword: false,
      exp: 1,
    });
    expect(can(principal, PERMISSIONS.visaTrackingRead)).toBe(true);
    expect(can(principal, PERMISSIONS.operationsWrite)).toBe(false);
  });

  it("allows internal operations", () => {
    const principal = createInternalPrincipal({
      id: "u1",
      name: "Admin",
      username: "admin",
      email: "admin@gtt.test",
      accessTier: "admin",
    });
    expect(can(principal, PERMISSIONS.operationsWrite)).toBe(true);
  });
});
