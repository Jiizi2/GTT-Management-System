import { useEffect, useMemo, useRef, useState } from "react";
import * as Domain from "../../../shared/app-domain";
import { fetchBackendParsed } from "../../../shared/api-client";
import type {
  ChecklistDriverAssignment,
  ChecklistDriverDraft,
  ChecklistDriverProfile,
  ChecklistItem,
  GroupData,
  GroupChecklistAssignment,
} from "../../../shared/app-domain";

const {
  buildChecklistItemsFromGroups,
  CHECKLIST_PAGE_SIZE,
  createEmptyChecklistDraft,
  formatChecklistCopyDate,
  formatScheduleTime,
  getChecklistDayLabel,
  getLocalIsoDateWithOffset,
} = Domain;

export const resolveGroupServiceType = (group: GroupData | undefined): "Visa+" | "Visa Only" =>
  group?.visaSetup?.busStatus === "Visa+" ? "Visa+" : "Visa Only";

export const isExternalTransportGroup = (group: GroupData | undefined): boolean =>
  resolveGroupServiceType(group) === "Visa Only";

export const CHECKLIST_NEUTRAL_BADGE_CLASS =
  "inline-flex items-center rounded-md border border-slate-900/20 bg-surface-container-lowest/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-900";

export type ChecklistItemsGroup = {
  groupCode: string;
  groupName: string;
  groupPax: number;
  items: ChecklistItem[];
};

export const groupChecklistItemsByGroup = (items: ChecklistItem[]): ChecklistItemsGroup[] => {
  const groupedItems = new Map<string, ChecklistItemsGroup>();

  items.forEach((item) => {
    const groupKey = item.groupCode.trim().toUpperCase();
    const existingGroup = groupedItems.get(groupKey);

    if (existingGroup) {
      existingGroup.items.push(item);
      return;
    }

    groupedItems.set(groupKey, {
      groupCode: item.groupCode,
      groupName: item.groupName,
      groupPax: item.groupPax,
      items: [item],
    });
  });

  return Array.from(groupedItems.values());
};

const readTrimmedString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const sanitizeDriverProfile = (source: unknown): ChecklistDriverProfile | null => {
  if (!source || typeof source !== "object") {
    return null;
  }

  const raw = source as {
    name?: unknown;
    phone?: unknown;
    plateNumber?: unknown;
    isVerified?: unknown;
  };
  const name = readTrimmedString(raw.name);
  const phone = readTrimmedString(raw.phone);
  const plateNumber = readTrimmedString(raw.plateNumber);
  if (!name || !phone || !plateNumber) {
    return null;
  }

  return {
    name,
    phone,
    plateNumber,
    isVerified: Boolean(raw.isVerified),
  };
};

const normalizeChecklistIdentityPart = (value: string): string => value.trim().toUpperCase();

const buildChecklistIdentityKey = ({
  groupCode,
  tripDate,
  scheduledTime,
  activity,
  tripLabel,
}: {
  groupCode: string;
  tripDate: string;
  scheduledTime: string;
  activity: string;
  tripLabel?: string;
}): string =>
  [
    normalizeChecklistIdentityPart(groupCode),
    normalizeChecklistIdentityPart(tripDate),
    normalizeChecklistIdentityPart(scheduledTime),
    normalizeChecklistIdentityPart(activity),
    normalizeChecklistIdentityPart(tripLabel ?? ""),
  ].join("|");

const buildConfirmedDriversFromBackendAssignments = (
  groups: GroupData[],
  checklistItems: ChecklistItem[],
): Record<string, ChecklistDriverAssignment> => {
  const assignmentLookup = groups.reduce<Map<string, GroupChecklistAssignment>>((accumulator, group) => {
    const assignments = group.checklistAssignments ?? [];
    assignments.forEach((assignment) => {
      const key = buildChecklistIdentityKey({
        groupCode: group.code,
        tripDate: assignment.tripDate,
        scheduledTime: assignment.scheduledTime,
        activity: assignment.activity,
        tripLabel: assignment.tripLabel,
      });
      accumulator.set(key, assignment);
    });
    return accumulator;
  }, new Map<string, GroupChecklistAssignment>());

  return checklistItems.reduce<Record<string, ChecklistDriverAssignment>>((accumulator, item) => {
    const key = buildChecklistIdentityKey({
      groupCode: item.groupCode,
      tripDate: item.tripDate,
      scheduledTime: item.scheduledTime,
      activity: item.activity,
      tripLabel: item.trip,
    });
    const assignment = assignmentLookup.get(key);
    if (!assignment) {
      return accumulator;
    }

    const drivers = assignment.drivers
      .map((driver) => sanitizeDriverProfile(driver))
      .filter((driver): driver is ChecklistDriverProfile => Boolean(driver));

    if (drivers.length > 0) {
      accumulator[item.id] = { drivers };
    }

    return accumulator;
  }, {});
};

const syncChecklistDriverToBackend = async ({
  groupCode,
  checklistItem,
  driver,
}: {
  groupCode: string;
  checklistItem: ChecklistItem;
  driver: ChecklistDriverProfile;
}): Promise<ChecklistDriverProfile[] | null> => {
  const { response, payload } = await fetchBackendParsed(
    `/groups/${encodeURIComponent(groupCode)}/checklist/confirm-driver`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tripDate: checklistItem.tripDate,
        activity: checklistItem.activity,
        tripLabel: checklistItem.trip,
        requiredBusCount: checklistItem.transferByTrain
          ? Math.max(2, checklistItem.requiredBusCount)
          : checklistItem.requiredBusCount,
        scheduledTime: checklistItem.scheduledTime,
        transferByTrain: checklistItem.transferByTrain,
        trainDepartureTime: checklistItem.trainDepartureTime || undefined,
        stationPickupTime: checklistItem.stationPickupTime || undefined,
        driver: {
          name: driver.name,
          phone: driver.phone,
          plateNumber: driver.plateNumber,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Checklist sync failed (${response.status})`);
  }

  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const rawDrivers = (payload as { drivers?: unknown }).drivers;
  if (!Array.isArray(rawDrivers)) {
    return null;
  }

  return rawDrivers
    .map((rawDriver) => sanitizeDriverProfile(rawDriver))
    .filter((nextDriver): nextDriver is ChecklistDriverProfile => Boolean(nextDriver));
};

const syncChecklistResetToBackend = async ({
  groupCode,
  checklistItem,
}: {
  groupCode: string;
  checklistItem: ChecklistItem;
}): Promise<void> => {
  const { response } = await fetchBackendParsed(`/groups/${encodeURIComponent(groupCode)}/checklist/reset-driver`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tripDate: checklistItem.tripDate,
      activity: checklistItem.activity,
      scheduledTime: checklistItem.scheduledTime,
    }),
  });

  if (!response.ok) {
    throw new Error(`Checklist reset failed (${response.status})`);
  }
};

export function useChecklistWorkspace({ groups }: { groups: GroupData[] }) {
  const checklistItems = useMemo(() => buildChecklistItemsFromGroups(groups), [groups]);
  const dayAfterTomorrowIso = getLocalIsoDateWithOffset(2);
  const groupsByCode = useMemo(
    () => new Map(groups.map((group) => [group.code.trim().toUpperCase(), group])),
    [groups],
  );
  const groupsWithItineraryCount = useMemo(() => groups.filter((group) => group.itinerary.length > 0).length, [groups]);
  const backendConfirmedDrivers = useMemo(
    () => buildConfirmedDriversFromBackendAssignments(groups, checklistItems),
    [groups, checklistItems],
  );
  const [driverDrafts, setDriverDrafts] = useState<Record<string, ChecklistDriverDraft>>({});
  const [confirmedDrivers, setConfirmedDrivers] = useState<Record<string, ChecklistDriverAssignment>>({});
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const copiedItemTimerRef = useRef<any | null>(null);
  const [cancelTargetItemId, setCancelTargetItemId] = useState<string | null>(null);
  const [groupCodeQuery, setGroupCodeQuery] = useState("");
  const [pendingPage, setPendingPage] = useState(1);
  const [completedPage, setCompletedPage] = useState(1);
  const normalizedGroupCodeQuery = groupCodeQuery.trim().toLowerCase();
  const hasGroupCodeQuery = normalizedGroupCodeQuery.length > 0;
  
  const getRequiredDriverCount = (item: ChecklistItem): number =>
    Math.max(1, item.transferByTrain ? Math.max(2, item.requiredBusCount) : item.requiredBusCount);
  
  const isChecklistItemCompleted = (item: ChecklistItem): boolean => {
    const assignedCount = confirmedDrivers[item.id]?.drivers.length ?? 0;
    return assignedCount >= getRequiredDriverCount(item);
  };
  
  const isTwoDaysAwayChecklistItem = (item: ChecklistItem): boolean => item.tripDate === dayAfterTomorrowIso;
  
  const searchedChecklistItems = checklistItems.filter((item) => {
    if (!normalizedGroupCodeQuery) return true;
    const codes = item.groupCodes ?? [item.groupCode];
    return codes.some((code) => code.toLowerCase().includes(normalizedGroupCodeQuery));
  });
  
  const pendingItems = searchedChecklistItems.filter((item) => !isChecklistItemCompleted(item));
  const completedItems = searchedChecklistItems.filter((item) => isChecklistItemCompleted(item));
  
  const pendingGroups = useMemo(() => groupChecklistItemsByGroup(pendingItems), [pendingItems]);
  const completedGroups = useMemo(() => groupChecklistItemsByGroup(completedItems), [completedItems]);
  
  const isClear = pendingItems.length === 0;
  const pendingTotalPages = Math.max(1, Math.ceil(pendingGroups.length / CHECKLIST_PAGE_SIZE));
  const completedTotalPages = Math.max(1, Math.ceil(completedGroups.length / CHECKLIST_PAGE_SIZE));
  
  const pendingStartIndex = (pendingPage - 1) * CHECKLIST_PAGE_SIZE;
  const completedStartIndex = (completedPage - 1) * CHECKLIST_PAGE_SIZE;
  const paginatedPendingGroups = pendingGroups.slice(pendingStartIndex, pendingStartIndex + CHECKLIST_PAGE_SIZE);
  const paginatedCompletedGroups = completedGroups.slice(
    completedStartIndex,
    completedStartIndex + CHECKLIST_PAGE_SIZE,
  );
  
  const paginatedPendingItems = paginatedPendingGroups.flatMap((group) => group.items);
  const paginatedCompletedItems = paginatedCompletedGroups.flatMap((group) => group.items);
  
  const pendingRangeStart = pendingGroups.length === 0 ? 0 : pendingStartIndex + 1;
  const pendingRangeEnd =
    pendingGroups.length === 0 ? 0 : Math.min(pendingGroups.length, pendingStartIndex + paginatedPendingGroups.length);
  const completedRangeStart = completedGroups.length === 0 ? 0 : completedStartIndex + 1;
  const completedRangeEnd =
    completedGroups.length === 0
      ? 0
      : Math.min(completedGroups.length, completedStartIndex + paginatedCompletedGroups.length);
  
  const cancelTargetItem = cancelTargetItemId
    ? (checklistItems.find((item) => item.id === cancelTargetItemId) ?? null)
    : null;

  useEffect(() => {
    const validIds = new Set(checklistItems.map((item) => item.id));

    setDriverDrafts((current) =>
      Object.entries(current).reduce<Record<string, ChecklistDriverDraft>>((accumulator, [key, value]) => {
        if (validIds.has(key)) {
          accumulator[key] = value;
        }

        return accumulator;
      }, {}),
    );

    setConfirmedDrivers((current) => {
      const nextCurrent = Object.entries(current).reduce<Record<string, ChecklistDriverAssignment>>(
        (accumulator, [key, value]) => {
          if (validIds.has(key)) {
            accumulator[key] = value;
          }

          return accumulator;
        },
        {},
      );

      Object.entries(backendConfirmedDrivers).forEach(([itemId, assignment]) => {
        nextCurrent[itemId] = assignment;
      });

      return nextCurrent;
    });
  }, [checklistItems, backendConfirmedDrivers]);

  useEffect(
    () => () => {
      if (copiedItemTimerRef.current !== null) {
        window.clearTimeout(copiedItemTimerRef.current);
        copiedItemTimerRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    setPendingPage((previousPage) => Math.min(previousPage, pendingTotalPages));
  }, [pendingTotalPages]);

  useEffect(() => {
    setCompletedPage((previousPage) => Math.min(previousPage, completedTotalPages));
  }, [completedTotalPages]);

  useEffect(() => {
    setPendingPage(1);
    setCompletedPage(1);
  }, [normalizedGroupCodeQuery]);

  useEffect(() => {
    if (!cancelTargetItem) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCancelTargetItemId(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cancelTargetItem]);

  const handleDraftChange = (itemId: string, field: keyof ChecklistDriverProfile, value: string) => {
    const checklistItem = checklistItems.find((item) => item.id === itemId);
    if (!checklistItem) {
      return;
    }

    setDriverDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? createEmptyChecklistDraft()),
        [field]: value,
      },
    }));
  };

  const handleConfirmDriver = async (itemId: string) => {
    const checklistItem = checklistItems.find((item) => item.id === itemId);
    if (!checklistItem) {
      return;
    }

    const draft = driverDrafts[itemId] ?? createEmptyChecklistDraft();
    const nextDriver: ChecklistDriverProfile = {
      name: draft.name.trim(),
      phone: draft.phone.trim(),
      plateNumber: draft.plateNumber.trim(),
    };

    if (!nextDriver.name || !nextDriver.phone || !nextDriver.plateNumber) {
      return;
    }

    const requiredDriverCount = getRequiredDriverCount(checklistItem);

    setConfirmedDrivers((current) => {
      const existingDrivers = current[itemId]?.drivers ?? [];
      if (existingDrivers.length >= requiredDriverCount) {
        return current;
      }

      return {
        ...current,
        [itemId]: {
          drivers: [...existingDrivers, nextDriver],
        },
      };
    });

    setDriverDrafts((current) => ({
      ...current,
      [itemId]: createEmptyChecklistDraft(),
    }));

    try {
      const syncedDrivers = await syncChecklistDriverToBackend({
        groupCode: checklistItem.groupCode,
        checklistItem,
        driver: nextDriver,
      });

      if (syncedDrivers && syncedDrivers.length > 0) {
        setConfirmedDrivers((current) => ({
          ...current,
          [itemId]: {
            drivers: syncedDrivers,
          },
        }));
      }
    } catch {
      // Keep fallback
    }
  };

  const handleCopyDriver = async (itemId: string) => {
    const checklistItem = checklistItems.find((item) => item.id === itemId);
    const assignment = confirmedDrivers[itemId];
    if (!checklistItem || !assignment) {
      return;
    }

    const scheduleDate = formatChecklistCopyDate(checklistItem.tripDate);
    const scheduleTime = formatScheduleTime(checklistItem.scheduledTime || "");
    const isTransfer = checklistItem.activity?.trim().toLowerCase().startsWith("transfer");
    const tripLabel = isTransfer && checklistItem.trip
      ? checklistItem.trip
      : checklistItem.activity?.trim() || "-";
    const scheduleDetails = checklistItem.transferByTrain
      ? `${scheduleDate} | TRAIN ${formatScheduleTime(checklistItem.trainDepartureTime)} | STATION PICKUP ${formatScheduleTime(checklistItem.stationPickupTime)}`
      : checklistItem.hotelPickupRequestTime
        ? `${scheduleDate} | HOTEL PICKUP ${formatScheduleTime(checklistItem.hotelPickupRequestTime)} | FLIGHT ${formatScheduleTime(checklistItem.departureFlightTime || checklistItem.scheduledTime)}`
        : `${scheduleDate} | ${scheduleTime}`;
    const driverLines = assignment.drivers.flatMap((driver, index) => [
      `👨🏻‍✈️ DRIVER NAME ${index + 1}  : ${(driver.name || "-").toUpperCase()}`,
      `📱 DRIVER PHONE ${index + 1} : ${driver.phone || "-"}`,
      `🪪 DRIVER PLATE ${index + 1} : ${(driver.plateNumber || "-").toUpperCase()}`,
      ...(index < assignment.drivers.length - 1 ? [""] : []),
    ]);

    const payload = [
      "📝 *GROUP DETAILS*",
      "```",
      `🏷️ GROUP NUMBER : ${(checklistItem.groupCodes ?? [checklistItem.groupCode]).join(" - ")}`,
      `👥 GROUP NAME   : ${checklistItem.groupName.toUpperCase()}`,
      `🚌 TOTAL BUS    : ${checklistItem.requiredBusCount}`,
      `🛣️ TRIP         : ${tripLabel}`,
      `⏰ SCHEDULE     : ${scheduleDetails}`,
      "```",
      "",
      "👨🏻‍✈️ *DRIVER DETAILS*",
      "```",
      ...driverLines,
      "```",
    ].join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      }
    } catch {
      // fallback
    }

    setCopiedItemId(itemId);
    if (copiedItemTimerRef.current !== null) {
      window.clearTimeout(copiedItemTimerRef.current);
    }

    copiedItemTimerRef.current = window.setTimeout(() => {
      setCopiedItemId((current) => (current === itemId ? null : current));
      copiedItemTimerRef.current = null;
    }, 1600);
  };

  const handleCopyTripWithoutDriverName = async (itemId: string) => {
    const checklistItem = checklistItems.find((item) => item.id === itemId);
    if (!checklistItem) {
      return;
    }

    const scheduleDate = formatChecklistCopyDate(checklistItem.tripDate);
    const scheduleTime = formatScheduleTime(checklistItem.scheduledTime || "");
    const isTransfer = checklistItem.activity?.trim().toLowerCase().startsWith("transfer");
    const tripLabel = isTransfer && checklistItem.trip
      ? checklistItem.trip
      : checklistItem.activity?.trim() || "-";
    const scheduleDetails = checklistItem.transferByTrain
      ? `${scheduleDate} | TRAIN ${formatScheduleTime(checklistItem.trainDepartureTime)} | STATION PICKUP ${formatScheduleTime(checklistItem.stationPickupTime)}`
      : checklistItem.hotelPickupRequestTime
        ? `${scheduleDate} | HOTEL PICKUP ${formatScheduleTime(checklistItem.hotelPickupRequestTime)} | FLIGHT ${formatScheduleTime(checklistItem.departureFlightTime || checklistItem.scheduledTime)}`
        : `${scheduleDate} | ${scheduleTime}`;
    const payload = [
      "📝 *GROUP DETAILS*",
      "```",
      `🏷️ GROUP NUMBER : ${(checklistItem.groupCodes ?? [checklistItem.groupCode]).join(" - ")}`,
      `👥 GROUP NAME   : ${checklistItem.groupName.toUpperCase()}`,
      `🚌 TOTAL BUS    : ${checklistItem.requiredBusCount}`,
      `🛣️ TRIP         : ${tripLabel}`,
      `⏰ SCHEDULE     : ${scheduleDetails}`,
      "```",
    ].join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      }
    } catch {
      // fallback
    }

    setCopiedItemId(itemId);
    if (copiedItemTimerRef.current !== null) {
      window.clearTimeout(copiedItemTimerRef.current);
    }

    copiedItemTimerRef.current = window.setTimeout(() => {
      setCopiedItemId((current) => (current === itemId ? null : current));
      copiedItemTimerRef.current = null;
    }, 1600);
  };

  const handleResetToNeedAttention = async (itemId: string) => {
    const checklistItem = checklistItems.find((item) => item.id === itemId);
    if (!checklistItem) {
      return;
    }

    setConfirmedDrivers((current) => {
      if (!(itemId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[itemId];
      return next;
    });

    setDriverDrafts((current) => ({
      ...current,
      [itemId]: createEmptyChecklistDraft(),
    }));

    try {
      await syncChecklistResetToBackend({
        groupCode: checklistItem.groupCode,
        checklistItem,
      });
    } catch {
      // fallback
    }
  };

  const handleOpenCancelConfirm = (itemId: string) => {
    setCancelTargetItemId(itemId);
  };

  const handleCloseCancelConfirm = () => {
    setCancelTargetItemId(null);
  };

  const handleConfirmCancelAssignment = async () => {
    if (!cancelTargetItemId) {
      return;
    }

    const targetId = cancelTargetItemId;
    setCancelTargetItemId(null);
    await handleResetToNeedAttention(targetId);
  };

  return {
    checklistItems,
    groupsByCode,
    groupsWithItineraryCount,
    driverDrafts,
    confirmedDrivers,
    copiedItemId,
    cancelTargetItemId,
    groupCodeQuery,
    setGroupCodeQuery,
    pendingPage,
    setPendingPage,
    completedPage,
    setCompletedPage,
    normalizedGroupCodeQuery,
    hasGroupCodeQuery,
    getRequiredDriverCount,
    isChecklistItemCompleted,
    isTwoDaysAwayChecklistItem,
    searchedChecklistItems,
    pendingItems,
    completedItems,
    pendingGroups,
    completedGroups,
    isClear,
    pendingTotalPages,
    completedTotalPages,
    paginatedPendingGroups,
    paginatedCompletedGroups,
    paginatedPendingItems,
    paginatedCompletedItems,
    pendingRangeStart,
    pendingRangeEnd,
    completedRangeStart,
    completedRangeEnd,
    cancelTargetItem,
    handleDraftChange,
    handleConfirmDriver,
    handleCopyDriver,
    handleCopyTripWithoutDriverName,
    handleResetToNeedAttention,
    handleOpenCancelConfirm,
    handleCloseCancelConfirm,
    handleConfirmCancelAssignment,
  };
}
