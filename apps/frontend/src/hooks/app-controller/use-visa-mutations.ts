import { useCallback, type MutableRefObject } from "react";
import {
  buildVisaTrackingRowsFromGroups,
  formatLocalIsoDate,
  normalizeGroupStatus,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
} from "../../shared/app-domain";
import type {
  AgreementApprovalStatus,
  GroupAgreementHotel,
  GroupData,
  GroupVisaSetup,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaStatus,
  VisaTrackingRow,
} from "../../shared/app-domain";
import {
  deleteGroupInBackend,
  deleteVisaHotelAgreementInBackend,
  getVisaAgreementValidationError,
  saveVisaHotelAgreementInBackend,
  sortHotelsByStayStart,
} from "../use-app-controller-backend";
import type {
  GroupRecordsSnapshot,
  SyncFailureMessage,
  SyncFeedback,
  UpdateVisaSetupForGroupAndSync,
} from "./types";

/** Only `mutateAsync` is used, so the dependency is declared structurally. */
type MutationLike<TVariables, TResult> = {
  mutateAsync: (variables: TVariables) => Promise<TResult>;
};

/**
 * Primitives the visa mutations are built on. They stay owned by
 * useDashboardGroupRecords - the record list, the sync queue, and the rollback
 * snapshots are shared with every other mutation group, so they are injected
 * here rather than duplicated.
 */
export type VisaMutationDeps = {
  groupRecordsRef: MutableRefObject<GroupData[]>;
  updateVisaSetupForGroupAndSync: UpdateVisaSetupForGroupAndSync;
  createDefaultVisaSetup: (group: GroupData, row: VisaTrackingRow) => GroupVisaSetup;
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
  navigateToVisaTracking: (options?: { replace?: boolean }) => void;
  saveVisaHotelMutation: MutationLike<
    Parameters<typeof saveVisaHotelAgreementInBackend>[0],
    Awaited<ReturnType<typeof saveVisaHotelAgreementInBackend>>
  >;
  deleteVisaHotelMutation: MutationLike<
    Parameters<typeof deleteVisaHotelAgreementInBackend>[0],
    Awaited<ReturnType<typeof deleteVisaHotelAgreementInBackend>>
  >;
  deleteGroupMutation: MutationLike<
    Parameters<typeof deleteGroupInBackend>[0],
    Awaited<ReturnType<typeof deleteGroupInBackend>>
  >;
};

/**
 * Visa-domain mutations: group removal from the visa view, agreement and visa
 * status edits, and hotel agreement create/update/delete.
 */
export function useVisaMutations({
  groupRecordsRef,
  updateVisaSetupForGroupAndSync,
  createDefaultVisaSetup,
  commitGroupRecords,
  captureGroupRecordsSnapshot,
  runBackendSync,
  showSyncFeedback,
  navigateToVisaTracking,
  saveVisaHotelMutation,
  deleteVisaHotelMutation,
  deleteGroupMutation,
}: VisaMutationDeps) {
  const handleDeleteVisaGroup = useCallback(
    (groupCode: string) => {
      const normalizedGroupCode = groupCode.trim().toUpperCase();
      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) =>
        current.filter((group) => group.code.trim().toUpperCase() !== normalizedGroupCode),
      );
      navigateToVisaTracking({ replace: true });

      runBackendSync({
        task: () => deleteGroupMutation.mutateAsync(groupCode),
        successMessage: "Group berhasil dihapus.",
        failureMessage: "Penghapusan group belum berhasil disimpan ke backend.",
        rollbackSnapshot,
        showSuccess: true,
      });
    },
    [captureGroupRecordsSnapshot, commitGroupRecords, deleteGroupMutation, navigateToVisaTracking, runBackendSync],
  );

  const handleUpdateAgreementStatus = useCallback(
    (groupCode: string, city: "makkah" | "madinah", status: AgreementApprovalStatus) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ group, row, visaSetup }) => {
        const cityHotelKey = city === "makkah" ? "makkahHotels" : "madinahHotels";
        const currentCityHotels = visaSetup[cityHotelKey];
        const agreementDateRange = resolveVisaAgreementDateRange(row, group.durationDays, group);

        const updatedCityHotels =
          currentCityHotels.length > 0
            ? currentCityHotels.map((hotel) => ({ ...hotel, status }))
            : [
                {
                  id: `${group.code}-${city}-auto`,
                  hotelName: city === "makkah" ? "Makkah Hotel" : "Madinah Hotel",
                  agreementNumber: resolveVisaAgreementNumber(row, group, city),
                  pax: group.pax,
                  status,
                  stayStartIso:
                    city === "makkah" ? agreementDateRange.makkahStartIso : agreementDateRange.madinahStartIso,
                  stayEndIso: city === "makkah" ? agreementDateRange.makkahEndIso : agreementDateRange.madinahEndIso,
                },
              ];

        const nextVisaSetup: GroupVisaSetup = {
          ...visaSetup,
          [cityHotelKey]: sortHotelsByStayStart(updatedCityHotels),
        };

        const validationError = getVisaAgreementValidationError(nextVisaSetup);
        if (validationError) {
          showSyncFeedback("error", validationError);
          return visaSetup;
        }

        return nextVisaSetup;
      });
    },
    [showSyncFeedback, updateVisaSetupForGroupAndSync],
  );

  const handleUpdateVisaStatus = useCallback(
    (groupCode: string, visaStatus: VisaStatus, issuedDateIso?: string) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => {
        const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
        const requestedIssuedDate = issuedDateIso?.trim() ?? "";
        const normalizedExistingIssuedDate = visaSetup.issuedDate?.trim() ?? "";
        const todayIso = formatLocalIsoDate(new Date());

        // A caller that picked a date wins. Callers that do not pass one keep
        // the previous behaviour: reuse the stored date, else default to today.
        const nextIssuedDate =
          visaStatus === "Issued"
            ? isIsoDate(requestedIssuedDate)
              ? requestedIssuedDate
              : isIsoDate(normalizedExistingIssuedDate)
                ? normalizedExistingIssuedDate
                : todayIso
            : "";

        return {
          ...visaSetup,
          visaStatus,
          issuedDate: nextIssuedDate,
        };
      });
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleUpdateVisaType = useCallback(
    (groupCode: string, visaType: "Visa Only" | "Visa+") => {
      updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => ({
        ...visaSetup,
        busStatus: visaType,
      }));
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleUpdatePaymentStatus = useCallback(
    (groupCode: string, paymentStatus: VisaPaymentStatus) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => ({
        ...visaSetup,
        paymentStatus,
      }));
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleToggleHotelWaiver = useCallback(
    (groupCode: string, city: "makkah" | "madinah", waived: boolean) => {
      updateVisaSetupForGroupAndSync(
        groupCode,
        ({ visaSetup }) => ({
          ...visaSetup,
          ...(city === "makkah" ? { makkahHotelWaived: waived } : { madinahHotelWaived: waived }),
        }),
        {
          successMessage: waived
            ? `Hotel ${city === "makkah" ? "Makkah" : "Madinah"} ditandai tidak diperlukan.`
            : `Persyaratan hotel ${city === "makkah" ? "Makkah" : "Madinah"} diaktifkan kembali.`,
        },
      );
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleUpdateSyarikah = useCallback(
    (groupCode: string, syarikah: string) => {
      updateVisaSetupForGroupAndSync(groupCode, ({ visaSetup }) => ({
        ...visaSetup,
        syarikah: syarikah.trim() || "Not assigned",
      }));
    },
    [updateVisaSetupForGroupAndSync],
  );

  const handleUpdateVisaHotel = useCallback(
    (groupCode: string, city: "makkah" | "madinah", hotel: VisaHotelEditFormState, hotelId?: string) => {
      const latestGroupRecords = groupRecordsRef.current;
      const currentGroup = latestGroupRecords.find((group) => group.code === groupCode);
      if (!currentGroup) {
        return;
      }

      const currentRow = buildVisaTrackingRowsFromGroups(latestGroupRecords).find((row) => row.groupCode === groupCode);
      if (!currentRow) {
        return;
      }

      const visaSetup = currentGroup.visaSetup ?? createDefaultVisaSetup(currentGroup, currentRow);
      const cityKey = city === "makkah" ? "makkahHotels" : "madinahHotels";
      const currentCityHotels = visaSetup[cityKey];
      const agreementDateRange = resolveVisaAgreementDateRange(currentRow, currentGroup.durationDays, currentGroup);
      const parsedHotelPax = Number.parseInt(hotel.pax, 10);
      const existingHotel = hotelId ? currentCityHotels.find((entry) => entry.id === hotelId) : undefined;
      const fallbackEditableHotel: GroupAgreementHotel = {
        id: existingHotel?.id ?? `${currentGroup.code}-${city}-${Date.now().toString(36)}`,
        hotelName: city === "makkah" ? "Makkah Hotel" : "Madinah Hotel",
        agreementNumber: resolveVisaAgreementNumber(currentRow, currentGroup, city),
        pax: currentGroup.pax,
        status: "Waiting for Approval",
        stayStartIso: city === "makkah" ? agreementDateRange.makkahStartIso : agreementDateRange.madinahStartIso,
        stayEndIso: city === "makkah" ? agreementDateRange.makkahEndIso : agreementDateRange.madinahEndIso,
      };

      const nextPrimaryHotel: GroupAgreementHotel = {
        ...fallbackEditableHotel,
        ...(existingHotel ?? {}),
        hotelName: hotel.hotelName.trim() || fallbackEditableHotel.hotelName,
        agreementNumber: hotel.agreementNumber.trim() || fallbackEditableHotel.agreementNumber,
        pax: Number.isFinite(parsedHotelPax) && parsedHotelPax >= 0 ? parsedHotelPax : fallbackEditableHotel.pax,
        status: hotel.status,
        stayStartIso: hotel.stayStartIso,
        stayEndIso: hotel.stayEndIso,
      };

      const nextCityHotels = sortHotelsByStayStart(
        !hotelId
          ? [...currentCityHotels, nextPrimaryHotel]
          : existingHotel
            ? currentCityHotels.map((entry) => (entry.id === hotelId ? nextPrimaryHotel : entry))
            : [...currentCityHotels, nextPrimaryHotel],
      );
      const nextVisaSetup: GroupVisaSetup = {
        ...visaSetup,
        [cityKey]: nextCityHotels,
      };
      const validationError = getVisaAgreementValidationError(nextVisaSetup);
      if (validationError) {
        showSyncFeedback("error", validationError);
        return;
      }

      const nextGroup = normalizeGroupStatus({
        ...currentGroup,
        visaSetup: nextVisaSetup,
      });

      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => current.map((group) => (group.code === groupCode ? nextGroup : group)));

      runBackendSync({
        task: () => saveVisaHotelMutation
          .mutateAsync({
            groupCode,
            city,
            hotel,
            hotelId: existingHotel ? hotelId : undefined,
          })
          .then((backendGroup) => {
            const normalizedBackendGroup = normalizeGroupStatus(backendGroup);
            commitGroupRecords((current) =>
              current.map((group) => (group.code === groupCode ? normalizedBackendGroup : group)),
            );
          }),
        successMessage: "Agreement hotel berhasil disimpan.",
        failureMessage: "Agreement hotel belum berhasil disimpan ke backend.",
        rollbackSnapshot,
      });
    },
    [
      groupRecordsRef,
      captureGroupRecordsSnapshot,
      commitGroupRecords,
      createDefaultVisaSetup,
      runBackendSync,
      saveVisaHotelMutation,
      showSyncFeedback,
    ],
  );

  const handleDeleteVisaHotel = useCallback(
    (groupCode: string, city: "makkah" | "madinah", hotelId: string) => {
      const latestGroupRecords = groupRecordsRef.current;
      const currentGroup = latestGroupRecords.find((group) => group.code === groupCode);
      if (!currentGroup?.visaSetup) {
        return;
      }

      const cityKey = city === "makkah" ? "makkahHotels" : "madinahHotels";
      const currentCityHotels = currentGroup.visaSetup[cityKey];
      const nextCityHotels = currentCityHotels.filter((entry) => entry.id !== hotelId);
      if (nextCityHotels.length === currentCityHotels.length) {
        return;
      }

      const nextVisaSetup: GroupVisaSetup = {
        ...currentGroup.visaSetup,
        [cityKey]: sortHotelsByStayStart(nextCityHotels),
      };
      const validationError = getVisaAgreementValidationError(nextVisaSetup);
      if (validationError) {
        showSyncFeedback("error", validationError);
        return;
      }

      const nextGroup = normalizeGroupStatus({
        ...currentGroup,
        visaSetup: nextVisaSetup,
      });
      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => current.map((group) => (group.code === groupCode ? nextGroup : group)));

      runBackendSync({
        task: () => deleteVisaHotelMutation
          .mutateAsync({
            groupCode,
            hotelId,
          })
          .then((backendGroup) => {
            const normalizedBackendGroup = normalizeGroupStatus(backendGroup);
            commitGroupRecords((current) =>
              current.map((group) => (group.code === groupCode ? normalizedBackendGroup : group)),
            );
          }),
        successMessage: "Agreement hotel berhasil dihapus.",
        failureMessage: "Penghapusan agreement hotel belum berhasil disimpan ke backend.",
        rollbackSnapshot,
      });
    },
    [
      captureGroupRecordsSnapshot,
      commitGroupRecords,
      deleteVisaHotelMutation,
      groupRecordsRef,
      runBackendSync,
      showSyncFeedback,
    ],
  );

  return {
    handleDeleteVisaGroup,
    handleUpdateAgreementStatus,
    handleUpdateVisaStatus,
    handleUpdateVisaType,
    handleUpdatePaymentStatus,
    handleToggleHotelWaiver,
    handleUpdateSyarikah,
    handleUpdateVisaHotel,
    handleDeleteVisaHotel,
  };
}
