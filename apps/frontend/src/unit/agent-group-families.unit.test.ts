import { describe, expect, it } from "vitest";
import { groupAgentFamilies } from "../agent/data/group-families";

describe("Agent group families", () => {
  it("groups children even when they arrive before the parent on another page", () => {
    const child = { id: "c", code: "CHILD", parentGroupId: "p", pax: 10 };
    const parent = { id: "p", code: "PARENT", parentGroupId: null, pax: 20 };
    const families = groupAgentFamilies([child, parent]);
    expect(families).toEqual([{ root: parent, members: [parent, child] }]);
    expect(families[0].members.reduce((sum, group) => sum + group.pax, 0)).toBe(30);
  });
  it("keeps a child with an unavailable parent discoverable", () => {
    const orphan = { id: "c", code: "CHILD", parentGroupId: "unavailable" };
    expect(groupAgentFamilies([orphan])).toEqual([{ root: orphan, members: [orphan] }]);
  });
});
