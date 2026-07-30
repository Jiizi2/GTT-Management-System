import { useCallback, type MutableRefObject } from "react";
import { normalizeGroupStatus } from "../../shared/app-domain";
import type { GroupData } from "../../shared/app-domain";
import {
  createGroupIdentityInBackend,
  createGroupInBackend,
  deleteGroupInBackend,
  replaceGroupInBackend,
  replaceGroupItineraryInBackend,
  updateGroupInBackend,
  type GroupIdentityDraftPayload,
} from "../use-app-controller-backend";
import {
  buildLocalIdentityGroup,
  resolveDashboardSyncFailureMessage,
} from "./group-record-selectors";
import type { GroupRecordsSnapshot, SyncFailureMessage, SyncFeedback } from "./types";

/** Only `mutateAsync` is used, so the dependency is declared structurally. */
type MutationLike<TVariables, TResult> = {
  mutateAsync: (variables: TVariables) => Promise<TResult>;
};

/**
 * Primitives these mutations are built on. Same arrangement as
 * useVisaMutations: the record list, the sync queue, and the rollback snapshots
 * stay owned by useDashboardGroupRecords and are injected, because every
 * mutation group shares them.
 */
export type GroupLifecycleMutationDeps = {
  groupRecordsRef: MutableRefObject<GroupData[]>;
  commitGroupRecords: (updater: (current: GroupData[]) => GroupData[]) => void;
  captureGroupRecordsSnapshot: () => GroupRecordsSnapshot;
  runBackendSync: (args: {
    task: () => Promise<void>;
    successMessage: string;
    failureMessage: SyncFailureMessage;
    rollbackSnapshot?: GroupRecordsSnapshot;
    showSuccess?: boolean;
  }) => void;
  showSyncFeedback: (tone: SyncFeedback["tone"], message: string) => void;
  clearQuery: () => void;
  navigateToOverview: (options?: { replace?: boolean }) => void;
  navigateToGroupDetail: (groupCode: string, options?: { replace?: boolean }) => void;
  navigateToVisaDetail: (groupCode: string, options?: { replace?: boolean }) => void;
  createGroupMutation: MutationLike<
    Parameters<typeof createGroupInBackend>[0],
    Awaited<ReturnType<typeof createGroupInBackend>>
  >;
  createGroupIdentityMutation: MutationLike<
    Parameters<typeof createGroupIdentityInBackend>[0],
    Awaited<ReturnType<typeof createGroupIdentityInBackend>>
  >;
  replaceGroupMutation: MutationLike<
    { groupCode: string; group: GroupData },
    Awaited<ReturnType<typeof replaceGroupInBackend>>
  >;
  replaceGroupItineraryMutation: MutationLike<
    { groupCode: string; group: GroupData },
    Awaited<ReturnType<typeof replaceGroupItineraryInBackend>>
  >;
  updateGroupMutation: MutationLike<
    { groupCode: string; group: GroupData },
    Awaited<ReturnType<typeof updateGroupInBackend>>
  >;
  deleteGroupMutation: MutationLike<
    Parameters<typeof deleteGroupInBackend>[0],
    Awaited<ReturnType<typeof deleteGroupInBackend>>
  >;
};

/**
 * Group lifecycle mutations: create, identity-only create, full replace,
 * itinerary-only replace, partial patch, delete, and the visa-detail save that
 * returns to the visa view instead of the group view.
 */
export function useGroupLifecycleMutations({
  groupRecordsRef,
  commitGroupRecords,
  captureGroupRecordsSnapshot,
  runBackendSync,
  showSyncFeedback,
  clearQuery,
  navigateToOverview,
  navigateToGroupDetail,
  navigateToVisaDetail,
  createGroupMutation,
  createGroupIdentityMutation,
  replaceGroupMutation,
  replaceGroupItineraryMutation,
  updateGroupMutation,
  deleteGroupMutation,
}: GroupLifecycleMutationDeps) {
  const handleDeleteGroup = useCallback(
    (groupCode: string) => {
      const normalizedGroupCode = groupCode.trim().toUpperCase();
      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) =>
        current.filter((group) => group.code.trim().toUpperCase() !== normalizedGroupCode),
      );
      navigateToOverview({ replace: true });

      runBackendSync({
        task: () => deleteGroupMutation.mutateAsync(groupCode),
        successMessage: "Group berhasil dihapus.",
        failureMessage: "Penghapusan group belum berhasil disimpan ke backend.",
        rollbackSnapshot,
        showSuccess: true,
      });
    },
    [captureGroupRecordsSnapshot, commitGroupRecords, deleteGroupMutation, navigateToOverview, runBackendSync],
  );

  const handleSaveInputGroup = useCallback(
    (group: GroupData) => {
      const normalizedGroup = normalizeGroupStatus(group);
      const latestGroupRecords = groupRecordsRef.current;
      const normalizedGroupCode = normalizedGroup.code.trim().toUpperCase();
      const hasDuplicateCode = latestGroupRecords.some(
        (item) => item.code.trim().toUpperCase() === normalizedGroupCode,
      );
      if (hasDuplicateCode) {
        showSyncFeedback("error", "Group number sudah dipakai. Gunakan nomor group yang berbeda.");
        return;
      }

      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => [normalizedGroup, ...current]);
      clearQuery();
      navigateToOverview({ replace: true });

      runBackendSync({
        task: () => createGroupMutation.mutateAsync(normalizedGroup),
        successMessage: "Group baru berhasil disimpan.",
        failureMessage: (error: unknown) =>
          resolveDashboardSyncFailureMessage(error, "Group belum berhasil disimpan ke backend."),
        rollbackSnapshot,
      });
    },
    [
      groupRecordsRef,
      captureGroupRecordsSnapshot,
      clearQuery,
      commitGroupRecords,
      createGroupMutation,
      navigateToOverview,
      runBackendSync,
      showSyncFeedback,
    ],
  );

  const handleSaveGroupIdentity = useCallback(
    (identity: GroupIdentityDraftPayload) => {
      const normalizedGroupCode = identity.groupCode.trim().toUpperCase();
      if (!normalizedGroupCode) {
        showSyncFeedback("error", "Group number tidak boleh kosong.");
        return;
      }

      const hasDuplicateCode = groupRecordsRef.current.some(
        (item) => item.code.trim().toUpperCase() === normalizedGroupCode,
      );
      if (hasDuplicateCode) {
        showSyncFeedback("error", "Group number sudah dipakai. Gunakan nomor group yang berbeda.");
        return;
      }

      const localIdentityGroup = normalizeGroupStatus(buildLocalIdentityGroup(identity));
      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => [localIdentityGroup, ...current]);
      clearQuery();
      navigateToGroupDetail(normalizedGroupCode, { replace: true });

      runBackendSync({
        task: () => createGroupIdentityMutation.mutateAsync(identity).then((backendGroup) => {
          const normalizedBackendGroup = normalizeGroupStatus(backendGroup);
          commitGroupRecords((current) =>
            current.map((group) =>
              group.code.trim().toUpperCase() === normalizedGroupCode ? normalizedBackendGroup : group,
            ),
          );
        }),
        successMessage: "Workspace group berhasil dibuat dari identity entry.",
        failureMessage: (error: unknown) =>
          resolveDashboardSyncFailureMessage(error, "Workspace group belum berhasil disimpan ke backend."),
        rollbackSnapshot,
      });
    },
    [
      groupRecordsRef,
      captureGroupRecordsSnapshot,
      clearQuery,
      commitGroupRecords,
      createGroupIdentityMutation,
      navigateToGroupDetail,
      runBackendSync,
      showSyncFeedback,
    ],
  );

  const handleSaveGroupDetail = useCallback(
    (group: GroupData, sourceGroupCode?: string): { ok: true } | { ok: false; message: string } => {
      const normalizedGroup = normalizeGroupStatus(group);
      const normalizedSourceGroupCode = sourceGroupCode?.trim().toUpperCase();
      const normalizedNextGroupCode = normalizedGroup.code.trim().toUpperCase();
      const normalizedNextGroupName = normalizedGroup.name.trim();
      const nextGroup: GroupData = {
        ...normalizedGroup,
        code: normalizedNextGroupCode,
        name: normalizedNextGroupName,
      };
      if (!normalizedNextGroupCode) {
        return {
          ok: false,
          message: "Group number tidak boleh kosong.",
        };
      }

      if (!normalizedNextGroupName) {
        return {
          ok: false,
          message: "Group name tidak boleh kosong.",
        };
      }

      const hasDuplicateCode = groupRecordsRef.current.some(
        (item) =>
          item.code.trim().toUpperCase() === normalizedNextGroupCode &&
          item.code.trim().toUpperCase() !== normalizedSourceGroupCode,
      );
      if (hasDuplicateCode) {
        return {
          ok: false,
          message: "Group number sudah dipakai oleh group lain.",
        };
      }

      const backendTargetGroupCode = normalizedSourceGroupCode ?? normalizedNextGroupCode;
      const rollbackSnapshot = captureGroupRecordsSnapshot();

      navigateToGroupDetail(nextGroup.code, { replace: true });

      commitGroupRecords((current) => {
        const existingIndex = current.findIndex((item) => item.code === nextGroup.code);
        if (existingIndex !== -1) {
          const next = [...current];
          next[existingIndex] = nextGroup;

          if (normalizedSourceGroupCode && normalizedSourceGroupCode !== nextGroup.code) {
            const sourceIndex = next.findIndex(
              (item, index) => index !== existingIndex && item.code.trim().toUpperCase() === normalizedSourceGroupCode,
            );
            if (sourceIndex !== -1) {
              next.splice(sourceIndex, 1);
            }
          }

          return next;
        }

        if (normalizedSourceGroupCode) {
          const sourceIndex = current.findIndex((item) => item.code.trim().toUpperCase() === normalizedSourceGroupCode);
          if (sourceIndex !== -1) {
            const next = [...current];
            next[sourceIndex] = nextGroup;
            return next;
          }
        }

        return [nextGroup, ...current];
      });

      runBackendSync({
        task: () => replaceGroupMutation.mutateAsync({
          groupCode: backendTargetGroupCode,
          group: nextGroup,
        }),
        successMessage: "Perubahan detail group berhasil disimpan.",
        failureMessage: (error: unknown) =>
          resolveDashboardSyncFailureMessage(error, "Perubahan detail group belum berhasil disimpan ke backend."),
        rollbackSnapshot,
      });
      return { ok: true };
    },
    [
      captureGroupRecordsSnapshot,
      commitGroupRecords,
      groupRecordsRef,
      navigateToGroupDetail,
      replaceGroupMutation,
      runBackendSync,
    ],
  );

  const handleSaveGroupItinerary = useCallback(
    (group: GroupData, sourceGroupCode?: string): { ok: true } | { ok: false; message: string } => {
      const normalizedGroup = normalizeGroupStatus(group);
      const normalizedSourceGroupCode = sourceGroupCode?.trim().toUpperCase();
      const normalizedNextGroupCode = normalizedGroup.code.trim().toUpperCase();
      const normalizedNextGroupName = normalizedGroup.name.trim();
      if (!normalizedNextGroupCode) {
        return { ok: false, message: "Group number tidak boleh kosong." };
      }
      if (!normalizedNextGroupName) {
        return { ok: false, message: "Group name tidak boleh kosong." };
      }

      const nextGroup: GroupData = {
        ...normalizedGroup,
        code: normalizedNextGroupCode,
        name: normalizedNextGroupName,
      };
      const backendTargetGroupCode = normalizedSourceGroupCode ?? normalizedNextGroupCode;
      const rollbackSnapshot = captureGroupRecordsSnapshot();

      navigateToGroupDetail(nextGroup.code, { replace: true });
      commitGroupRecords((current) =>
        current.map((item) =>
          item.code.trim().toUpperCase() === backendTargetGroupCode ? nextGroup : item,
        ),
      );

      runBackendSync({
        task: () => replaceGroupItineraryMutation.mutateAsync({
          groupCode: backendTargetGroupCode,
          group: nextGroup,
        }),
        successMessage: "Itinerary group berhasil disimpan.",
        failureMessage: (error: unknown) =>
          resolveDashboardSyncFailureMessage(error, "Itinerary belum berhasil disimpan ke backend."),
        rollbackSnapshot,
      });
      return { ok: true };
    },
    [captureGroupRecordsSnapshot, commitGroupRecords, navigateToGroupDetail, replaceGroupItineraryMutation, runBackendSync],
  );

  const handlePatchGroupDetail = useCallback(
    (group: GroupData, sourceGroupCode?: string): { ok: true } | { ok: false; message: string } => {
      const normalizedGroup = normalizeGroupStatus(group);
      const normalizedSourceGroupCode = sourceGroupCode?.trim().toUpperCase();
      const normalizedNextGroupCode = normalizedGroup.code.trim().toUpperCase();
      const normalizedNextGroupName = normalizedGroup.name.trim();
      const nextGroup: GroupData = {
        ...normalizedGroup,
        code: normalizedNextGroupCode,
        name: normalizedNextGroupName,
      };
      if (!normalizedNextGroupCode) {
        return {
          ok: false,
          message: "Group number tidak boleh kosong.",
        };
      }

      if (!normalizedNextGroupName) {
        return {
          ok: false,
          message: "Group name tidak boleh kosong.",
        };
      }

      const hasDuplicateCode = groupRecordsRef.current.some(
        (item) =>
          item.code.trim().toUpperCase() === normalizedNextGroupCode &&
          item.code.trim().toUpperCase() !== normalizedSourceGroupCode,
      );
      if (hasDuplicateCode) {
        return {
          ok: false,
          message: "Group number sudah dipakai oleh group lain.",
        };
      }

      const backendTargetGroupCode = normalizedSourceGroupCode ?? normalizedNextGroupCode;
      const rollbackSnapshot = captureGroupRecordsSnapshot();

      navigateToGroupDetail(nextGroup.code, { replace: true });

      commitGroupRecords((current) => {
        const existingIndex = current.findIndex((item) => item.code === nextGroup.code);
        if (existingIndex !== -1) {
          const next = [...current];
          next[existingIndex] = nextGroup;

          if (normalizedSourceGroupCode && normalizedSourceGroupCode !== nextGroup.code) {
            const sourceIndex = next.findIndex(
              (item, index) => index !== existingIndex && item.code.trim().toUpperCase() === normalizedSourceGroupCode,
            );
            if (sourceIndex !== -1) {
              next.splice(sourceIndex, 1);
            }
          }

          return next;
        }

        if (normalizedSourceGroupCode) {
          const sourceIndex = current.findIndex((item) => item.code.trim().toUpperCase() === normalizedSourceGroupCode);
          if (sourceIndex !== -1) {
            const next = [...current];
            next[sourceIndex] = nextGroup;
            return next;
          }
        }

        return [nextGroup, ...current];
      });

      runBackendSync({
        task: () => updateGroupMutation.mutateAsync({
          groupCode: backendTargetGroupCode,
          group: nextGroup,
        }),
        successMessage: "Perubahan identity group berhasil disimpan.",
        failureMessage: (error: unknown) =>
          resolveDashboardSyncFailureMessage(error, "Perubahan identity group belum berhasil disimpan ke backend."),
        rollbackSnapshot,
      });
      return { ok: true };
    },
    [
      captureGroupRecordsSnapshot,
      commitGroupRecords,
      groupRecordsRef,
      navigateToGroupDetail,
      runBackendSync,
      updateGroupMutation,
    ],
  );

  const handleSaveVisaGroupDetail = useCallback(
    (group: GroupData, sourceGroupCode?: string): { ok: true } | { ok: false; message: string } => {
      const normalizedGroup = normalizeGroupStatus(group);
      const normalizedSourceGroupCode = sourceGroupCode?.trim().toUpperCase();
      const normalizedNextGroupCode = normalizedGroup.code.trim().toUpperCase();
      const normalizedNextGroupName = normalizedGroup.name.trim();
      const nextGroup: GroupData = {
        ...normalizedGroup,
        code: normalizedNextGroupCode,
        name: normalizedNextGroupName,
      };
      if (!normalizedNextGroupCode) {
        return {
          ok: false,
          message: "Group number tidak boleh kosong.",
        };
      }

      if (!normalizedNextGroupName) {
        return {
          ok: false,
          message: "Group name tidak boleh kosong.",
        };
      }

      const hasDuplicateCode = groupRecordsRef.current.some(
        (item) =>
          item.code.trim().toUpperCase() === normalizedNextGroupCode &&
          item.code.trim().toUpperCase() !== normalizedSourceGroupCode,
      );
      if (hasDuplicateCode) {
        return {
          ok: false,
          message: "Group number sudah dipakai oleh group lain.",
        };
      }

      const backendTargetGroupCode = normalizedSourceGroupCode ?? normalizedNextGroupCode;
      const rollbackSnapshot = captureGroupRecordsSnapshot();

      navigateToVisaDetail(nextGroup.code, { replace: true });

      commitGroupRecords((current) => {
        const existingIndex = current.findIndex((item) => item.code === nextGroup.code);
        if (existingIndex !== -1) {
          const next = [...current];
          next[existingIndex] = nextGroup;

          if (normalizedSourceGroupCode && normalizedSourceGroupCode !== nextGroup.code) {
            const sourceIndex = next.findIndex(
              (item, index) => index !== existingIndex && item.code.trim().toUpperCase() === normalizedSourceGroupCode,
            );
            if (sourceIndex !== -1) {
              next.splice(sourceIndex, 1);
            }
          }

          return next;
        }

        if (normalizedSourceGroupCode) {
          const sourceIndex = current.findIndex((item) => item.code.trim().toUpperCase() === normalizedSourceGroupCode);
          if (sourceIndex !== -1) {
            const next = [...current];
            next[sourceIndex] = nextGroup;
            return next;
          }
        }

        return [nextGroup, ...current];
      });

      runBackendSync({
        task: () => replaceGroupMutation.mutateAsync({
          groupCode: backendTargetGroupCode,
          group: nextGroup,
        }),
        successMessage: "Perubahan detail group berhasil disimpan.",
        failureMessage: (error: unknown) =>
          resolveDashboardSyncFailureMessage(error, "Perubahan detail group belum berhasil disimpan ke backend."),
        rollbackSnapshot,
      });
      return { ok: true };
    },
    [
      captureGroupRecordsSnapshot,
      commitGroupRecords,
      groupRecordsRef,
      navigateToVisaDetail,
      replaceGroupMutation,
      runBackendSync,
    ],
  );

  return {
    handleDeleteGroup,
    handleSaveInputGroup,
    handleSaveGroupIdentity,
    handleSaveGroupDetail,
    handleSaveGroupItinerary,
    handlePatchGroupDetail,
    handleSaveVisaGroupDetail,
  };
}
