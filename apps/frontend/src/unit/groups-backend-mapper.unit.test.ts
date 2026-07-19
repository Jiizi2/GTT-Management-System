import { describe, expect, it } from "vitest";
import { mapBackendGroupToFrontend } from "../hooks/groups-backend-mapper";
import type { BackendGroupRecord } from "../hooks/groups-contract";

describe("groups backend mapper", () => {
  it("restores Visa+ from legacy identity notes using the backend enum format", () => {
    const mapped = mapBackendGroupToFrontend({
      code: "GROUP-VISA-PLUS",
      name: "Visa Plus Group",
      status: "Entry Only",
      tone: "ACTIVE",
      pax: 20,
      packageName: "Umrah",
      durationDays: 7,
      notes: [{ sortOrder: 0, text: "Bus status: VISA_PLUS" }],
    } as BackendGroupRecord);

    expect(mapped?.visaSetup?.busStatus).toBe("Visa+");
  });
});
