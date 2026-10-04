export type HotelAgreementDraftMetadata = {
  muassasahId?: string | null;
  assignmentStatus?: string;
  hasAllocations?: boolean;
  assignedGroups?: readonly unknown[];
};

/** Shared read metadata; this never changes stored approval or allocations. */
export function projectHotelAgreementDraftMetadata(
  draft: HotelAgreementDraftMetadata,
  muassasahNames?: ReadonlyMap<string, string>,
) {
  const muassasahId = draft.muassasahId ?? null;
  const exists = muassasahId !== null && muassasahNames?.has(muassasahId);
  return {
    muassasahId: muassasahNames ? (exists ? muassasahId : null) : muassasahId,
    muassasahName: muassasahId
      ? (muassasahNames?.get(muassasahId) ?? null)
      : null,
    assignmentStatus:
      draft.hasAllocations ||
      draft.assignedGroups?.length ||
      draft.assignmentStatus?.toUpperCase() === "ASSIGNED"
        ? "Assigned"
        : "Unassigned",
  };
}
