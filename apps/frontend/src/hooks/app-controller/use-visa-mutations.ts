import { useCallback, type MutableRefObject } from "react";
import {
  buildItineraryFromVisaData,
  buildVisaTrackingRowsFromGroups,
  formatLocalIsoDate,
  inferCategoryKey,
  normalizeGroupStatus,
  resolveTransportMode,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  sortInputItineraryItems,
} from "../../shared/app-domain";
import {
  buildItineraryFromInputItems,
  buildTimelineAndNextActivity,
  calculateItineraryDurationDays,
} from "../../pages/add-group-workspace/helpers/add-group-workspace-helpers";
import type {
  AgreementApprovalStatus,
  GroupAgreementHotel,
  GroupData,
  GroupVisaSetup,
  InputItineraryItem,
  ItineraryItem,
  VisaFlightDetailsInput,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaStatus,
  VisaTrackingRow,
} from "../../shared/app-domain";

/** Base trip legs the visa generator owns; everything else in an itinerary
 * (city tours, ziarah, manual entries) is preserved across regenerations. */
const BASE_TRIP_CATEGORY_KEYS = new Set(["arrival", "transfer", "departure"]);

function itineraryItemToInput(item: ItineraryItem, index: number): InputItineraryItem {
  return {
    id: `existing-${index}`,
    date: item.isoDate ?? "",
    time: item.time ?? "",
    category: item.category,
    categoryKey: inferCategoryKey(item),
    transportMode: item.transportMode ?? resolveTransportMode(item),
    hotelName: item.hotelName,
    fromHotelName: item.fromHotelName,
    from: item.from ?? "",
    to: item.to ?? "",
    cityTourCity: item.cityTourCity ?? "",
    flightNumber: item.flightNumber ?? "",
    requiresBus: item.requiresBus ?? false,
    notes: item.notes ?? "",
    icon: item.icon,
    transferByTrain: item.transferByTrain ?? false,
    trainDepartureTime: item.trainDepartureTime ?? "",
    destinationPickupTime: item.destinationPickupTime ?? "",
    hotelPickupRequestTime: item.hotelPickupRequestTime ?? "",
  };
}

/**
 * Rebuild the base trip skeleton (arrival -> transfers -> departure) from Visa
 * Detail data (agreements + arrival/return + flight) and merge it back into the
 * group's itinerary, replacing the previous base legs while preserving every
 * non-base item (city tours, ziarah, manual entries). Returns the group patch to
 * apply, or an empty object when there is not enough visa data to build.
 */
export function buildVisaItineraryPatch(group: GroupData, visaSetup: GroupVisaSetup): Partial<GroupData> {
  const generatedBaseItems = buildItineraryFromVisaData({
    arrivalDateIso: group.arrivalDate,
    returnDateIso: group.returnDate,
    makkahAgreements: visaSetup.makkahHotels,
    madinahAgreements: visaSetup.madinahHotels,
    flight: {
      arrivalFlightNumber: visaSetup.arrivalFlightNumber,
      arrivalTime: visaSetup.arrivalTime,
      departureFlightNumber: visaSetup.departureFlightNumber,
      departureTime: visaSetup.departureTime,
    },
  });

  if (generatedBaseItems.length === 0) {
    return {};
  }

  const preservedItems = (group.itinerary ?? [])
    .filter((item) => !BASE_TRIP_CATEGORY_KEYS.has(inferCategoryKey(item)))
    .map((item, index) => itineraryItemToInput(item, index));

  const mergedItems = sortInputItineraryItems([...preservedItems, ...generatedBaseItems]);
  const timelineAndNext = buildTimelineAndNextActivity(mergedItems, group.returnDate);

  return {
    itinerary: buildItineraryFromInputItems(mergedItems),
    durationDays: calculateItineraryDurationDays(mergedItems),
    ...(timelineAndNext
      ? { timeline: timelineAndNext.timeline, nextActivity: timelineAndNext.nextActivity }
      : {}),
  };
}
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
  /** Reads the freshest group list from the query cache. Used after an agreement
   * assign/unassign refetch, where `groupRecordsRef` is one render behind. */
  getLatestGroups: () => GroupData[];
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
  replaceGroupMutation: MutationLike<{ groupCode: string; group: GroupData }, void>;
  replaceGroupItineraryMutation: MutationLike<{ groupCode: string; group: GroupData }, void>;
};

/**
 * Visa-domain mutations: group removal from the visa view, agreement and visa
 * status edits, and hotel agreement create/update/delete.
 */
export function useVisaMutations({
  groupRecordsRef,
  getLatestGroups,
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
  replaceGroupMutation,
  replaceGroupItineraryMutation,
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

  const handleUpdateFlightDetails = useCallback(
    (groupCode: string, flight: VisaFlightDetailsInput) => {
      const latestGroupRecords = groupRecordsRef.current;
      const currentGroup = latestGroupRecords.find((group) => group.code === groupCode);
      if (!currentGroup) {
        return;
      }

      const currentRow = buildVisaTrackingRowsFromGroups(latestGroupRecords).find((row) => row.groupCode === groupCode);
      if (!currentRow) {
        return;
      }

      const currentVisaSetup = currentGroup.visaSetup ?? createDefaultVisaSetup(currentGroup, currentRow);
      const nextVisaSetup: GroupVisaSetup = {
        ...currentVisaSetup,
        arrivalFlightNumber: flight.arrivalFlightNumber.trim(),
        arrivalTime: flight.arrivalTime.trim(),
        departureFlightNumber: flight.departureFlightNumber.trim(),
        departureTime: flight.departureTime.trim(),
      };

      // Regenerate the base trip structure from the same visa data (agreements +
      // arrival/return + flight) so the group's itinerary that Group Detail reads
      // stays a single source. Merges the fresh base legs into the existing
      // itinerary (preserving city tours etc.); only patches when there is enough
      // data to build the structure, otherwise it just persists the flight.
      const itineraryPatch = buildVisaItineraryPatch(currentGroup, nextVisaSetup);
      const didRegenerate = Object.keys(itineraryPatch).length > 0;

      const nextGroup = normalizeGroupStatus({
        ...currentGroup,
        visaSetup: nextVisaSetup,
        ...itineraryPatch,
      });

      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => current.map((group) => (group.code === groupCode ? nextGroup : group)));

      runBackendSync({
        task: () => replaceGroupMutation.mutateAsync({ groupCode, group: nextGroup }),
        successMessage:
          didRegenerate
            ? "Detail penerbangan disimpan & itinerary diperbarui dari data visa."
            : "Detail penerbangan berhasil disimpan.",
        failureMessage: "Detail penerbangan belum berhasil disimpan ke backend.",
        rollbackSnapshot,
        showSuccess: true,
      });
    },
    [
      groupRecordsRef,
      createDefaultVisaSetup,
      captureGroupRecordsSnapshot,
      commitGroupRecords,
      replaceGroupMutation,
      runBackendSync,
    ],
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

      // Adding/editing an agreement can complete the second city, so re-derive the
      // base trip skeleton (incl. the Makkah<->Madinah transfer) from the updated
      // agreements + the already-saved flight, keeping the itinerary in sync.
      const nextGroup = normalizeGroupStatus({
        ...currentGroup,
        visaSetup: nextVisaSetup,
        ...buildVisaItineraryPatch(currentGroup, nextVisaSetup),
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
          .then(async (backendGroup) => {
            const normalizedBackendGroup = normalizeGroupStatus(backendGroup);
            const backendVisaSetup = normalizedBackendGroup.visaSetup;
            const itineraryPatch = backendVisaSetup
              ? buildVisaItineraryPatch(normalizedBackendGroup, backendVisaSetup)
              : {};
            const mergedGroup =
              Object.keys(itineraryPatch).length > 0
                ? normalizeGroupStatus({ ...normalizedBackendGroup, ...itineraryPatch })
                : normalizedBackendGroup;
            commitGroupRecords((current) =>
              current.map((group) => (group.code === groupCode ? mergedGroup : group)),
            );
            // The hotel endpoint persists agreements only, so persist the
            // regenerated itinerary separately or it reverts on next fetch.
            if (Object.keys(itineraryPatch).length > 0) {
              await replaceGroupItineraryMutation.mutateAsync({ groupCode, group: mergedGroup });
            }
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
      replaceGroupItineraryMutation,
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

      // Removing an agreement can drop a city (and thus its transfer), so keep the
      // base trip skeleton consistent with the remaining agreements.
      const nextGroup = normalizeGroupStatus({
        ...currentGroup,
        visaSetup: nextVisaSetup,
        ...buildVisaItineraryPatch(currentGroup, nextVisaSetup),
      });
      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => current.map((group) => (group.code === groupCode ? nextGroup : group)));

      runBackendSync({
        task: () => deleteVisaHotelMutation
          .mutateAsync({
            groupCode,
            hotelId,
          })
          .then(async (backendGroup) => {
            const normalizedBackendGroup = normalizeGroupStatus(backendGroup);
            const backendVisaSetup = normalizedBackendGroup.visaSetup;
            const itineraryPatch = backendVisaSetup
              ? buildVisaItineraryPatch(normalizedBackendGroup, backendVisaSetup)
              : {};
            const mergedGroup =
              Object.keys(itineraryPatch).length > 0
                ? normalizeGroupStatus({ ...normalizedBackendGroup, ...itineraryPatch })
                : normalizedBackendGroup;
            commitGroupRecords((current) =>
              current.map((group) => (group.code === groupCode ? mergedGroup : group)),
            );
            if (Object.keys(itineraryPatch).length > 0) {
              await replaceGroupItineraryMutation.mutateAsync({ groupCode, group: mergedGroup });
            }
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
      replaceGroupItineraryMutation,
      showSyncFeedback,
    ],
  );

  /**
   * Re-derive the base trip skeleton for a group after its agreements changed
   * through a path that does not build the group locally (assigning/unassigning
   * an Agreement Inbox draft, which just hits the backend and refetches). Reads
   * the freshly refetched group from the cache, so the caller must await the
   * refetch first.
   */
  const handleSyncVisaItinerary = useCallback(
    (groupCode: string) => {
      const currentGroup = getLatestGroups().find((group) => group.code === groupCode);
      if (!currentGroup?.visaSetup) {
        return;
      }

      const itineraryPatch = buildVisaItineraryPatch(currentGroup, currentGroup.visaSetup);
      if (Object.keys(itineraryPatch).length === 0) {
        return;
      }

      const nextGroup = normalizeGroupStatus({ ...currentGroup, ...itineraryPatch });
      const rollbackSnapshot = captureGroupRecordsSnapshot();
      commitGroupRecords((current) => current.map((group) => (group.code === groupCode ? nextGroup : group)));

      runBackendSync({
        task: () => replaceGroupItineraryMutation.mutateAsync({ groupCode, group: nextGroup }),
        // The assign/unassign flow already surfaces its own feedback; keep this
        // itinerary sync silent so it does not double up on toasts.
        successMessage: "Itinerary diperbarui dari data agreement.",
        failureMessage: "Itinerary belum berhasil diperbarui dari data agreement.",
        rollbackSnapshot,
        showSuccess: false,
      });
    },
    [getLatestGroups, captureGroupRecordsSnapshot, commitGroupRecords, replaceGroupItineraryMutation, runBackendSync],
  );

  return {
    handleDeleteVisaGroup,
    handleUpdateAgreementStatus,
    handleUpdateVisaStatus,
    handleUpdateVisaType,
    handleUpdatePaymentStatus,
    handleToggleHotelWaiver,
    handleUpdateSyarikah,
    handleUpdateFlightDetails,
    handleUpdateVisaHotel,
    handleDeleteVisaHotel,
    handleSyncVisaItinerary,
  };
}
