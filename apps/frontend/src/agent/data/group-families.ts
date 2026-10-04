type RelatedGroup = { id?: string; code: string; parentGroupId?: string | null };

/** Group only after loading every page, so a child cannot lose its parent at a page boundary. */
export function groupAgentFamilies<T extends RelatedGroup>(groups: T[]): Array<{ root: T; members: T[] }> {
  const byId = new Map(
    groups.flatMap(
      (group) =>
        [
          [group.id ?? group.code, group],
          [group.code, group],
        ] as const,
    ),
  );
  const families = new Map<string, { root: T; members: T[] }>();
  for (const group of groups) {
    const parent = group.parentGroupId ? byId.get(group.parentGroupId) : undefined;
    const root = parent && !parent.parentGroupId ? parent : group;
    const key = root.id ?? root.code;
    if (!families.has(key)) families.set(key, { root, members: [] });
    families.get(key)!.members.push(group);
  }
  return [...families.values()].map((family) => ({
    ...family,
    members: [family.root, ...family.members.filter((member) => member !== family.root)],
  }));
}
