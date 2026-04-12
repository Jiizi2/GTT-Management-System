import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as GroupDomain from "../features/groups/domain";
import type {
  ChecklistDriverAssignment,
  ChecklistDriverDraft,
  ChecklistDriverProfile,
  ChecklistItem,
  GroupData,
  GroupChecklistAssignment,
} from "../shared/app-domain";
import { PaginationControls } from "../components/pagination-controls";
import { ThemeToggleButton } from "../components/theme-toggle-button";

const {
  buildChecklistItemsFromGroups,
  CHECKLIST_PAGE_SIZE,
  createEmptyChecklistDraft,
  formatChecklistCopyDate,
  formatScheduleTime,
  getChecklistDayLabel,
} = GroupDomain;

const CHECKLIST_CONFIRMED_DRIVERS_STORAGE_KEY = "gtt-h1-checklist-confirmed-drivers-v1";

const resolveGroupServiceType = (group: GroupData | undefined): "Visa+" | "Visa Only" =>
  group?.visaSetup?.busStatus === "Visa+" ? "Visa+" : "Visa Only";

const isExternalTransportGroup = (group: GroupData | undefined): boolean =>
  resolveGroupServiceType(group) === "Visa Only";

type ChecklistItemsGroup = {
  groupCode: string;
  groupName: string;
  groupPax: number;
  items: ChecklistItem[];
};

const groupChecklistItemsByGroup = (items: ChecklistItem[]): ChecklistItemsGroup[] => {
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

const sanitizeConfirmedDrivers = (
  source: unknown,
): Record<string, ChecklistDriverAssignment> => {
  if (!source || typeof source !== "object") {
    return {};
  }

  return Object.entries(source as Record<string, unknown>).reduce<
    Record<string, ChecklistDriverAssignment>
  >((accumulator, [itemId, assignmentValue]) => {
    if (!assignmentValue || typeof assignmentValue !== "object") {
      return accumulator;
    }

    const driversValue = (assignmentValue as { drivers?: unknown }).drivers;
    if (!Array.isArray(driversValue)) {
      return accumulator;
    }

    const drivers = driversValue
      .map((driverValue) => {
        if (!driverValue || typeof driverValue !== "object") {
          return null;
        }

        const rawDriver = driverValue as {
          name?: unknown;
          phone?: unknown;
          plateNumber?: unknown;
        };

        if (
          typeof rawDriver.name !== "string" ||
          typeof rawDriver.phone !== "string" ||
          typeof rawDriver.plateNumber !== "string"
        ) {
          return null;
        }

        return {
          name: rawDriver.name,
          phone: rawDriver.phone,
          plateNumber: rawDriver.plateNumber,
        };
      })
      .filter((driver): driver is ChecklistDriverProfile => Boolean(driver));

    accumulator[itemId] = { drivers };
    return accumulator;
  }, {});
};

const loadPersistedConfirmedDrivers = (): Record<string, ChecklistDriverAssignment> => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const persistedValue = window.localStorage.getItem(CHECKLIST_CONFIRMED_DRIVERS_STORAGE_KEY);
    if (!persistedValue) {
      return {};
    }

    return sanitizeConfirmedDrivers(JSON.parse(persistedValue));
  } catch {
    return {};
  }
};

const readTrimmedString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

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

const resolveChecklistApiBaseUrl = (): string => {
  const customUrl = (globalThis as { __GTT_API_BASE_URL__?: string }).__GTT_API_BASE_URL__;
  if (customUrl?.trim()) {
    return customUrl.trim().replace(/\/+$/, "");
  }

  const hostname = globalThis.location?.hostname ?? "";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:3001/api";
  }

  return "/api";
};

const ChecklistModalPortal = ({ children }: { children: ReactNode }) => {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(children, document.body);
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
  const apiBaseUrl = resolveChecklistApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/groups/${encodeURIComponent(groupCode)}/checklist/confirm-driver`,
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

  const payload = (await response.json()) as unknown;
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
  const apiBaseUrl = resolveChecklistApiBaseUrl();
  const response = await fetch(
    `${apiBaseUrl}/groups/${encodeURIComponent(groupCode)}/checklist/reset-driver`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tripDate: checklistItem.tripDate,
        activity: checklistItem.activity,
        scheduledTime: checklistItem.scheduledTime,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Checklist reset failed (${response.status})`);
  }
};

export function ChecklistScreen({ groups }: { groups: GroupData[] }) {
  const checklistItems = buildChecklistItemsFromGroups(groups);
  const groupsByCode = useMemo(
    () =>
      new Map(groups.map((group) => [group.code.trim().toUpperCase(), group])),
    [groups],
  );
  const groupsWithItineraryCount = useMemo(
    () => groups.filter((group) => group.itinerary.length > 0).length,
    [groups],
  );
  const backendConfirmedDrivers = useMemo(
    () => buildConfirmedDriversFromBackendAssignments(groups, checklistItems),
    [groups, checklistItems],
  );
  const [driverDrafts, setDriverDrafts] = useState<Record<string, ChecklistDriverDraft>>({});
  const [confirmedDrivers, setConfirmedDrivers] = useState<Record<string, ChecklistDriverAssignment>>(
    () => loadPersistedConfirmedDrivers(),
  );
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const copiedItemTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
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
  const searchedChecklistItems = checklistItems.filter((item) =>
    normalizedGroupCodeQuery ? item.groupCode.toLowerCase().includes(normalizedGroupCodeQuery) : true,
  );
  const pendingItems = searchedChecklistItems.filter((item) => !isChecklistItemCompleted(item));
  const completedItems = searchedChecklistItems.filter((item) => isChecklistItemCompleted(item));
  const pendingGroups = useMemo(() => groupChecklistItemsByGroup(pendingItems), [pendingItems]);
  const completedGroups = useMemo(() => groupChecklistItemsByGroup(completedItems), [completedItems]);
  const isClear = pendingItems.length === 0;
  const pendingTotalPages = Math.max(1, Math.ceil(pendingGroups.length / CHECKLIST_PAGE_SIZE));
  const completedTotalPages = Math.max(1, Math.ceil(completedGroups.length / CHECKLIST_PAGE_SIZE));
  const pendingStartIndex = (pendingPage - 1) * CHECKLIST_PAGE_SIZE;
  const completedStartIndex = (completedPage - 1) * CHECKLIST_PAGE_SIZE;
  const paginatedPendingGroups = pendingGroups.slice(
    pendingStartIndex,
    pendingStartIndex + CHECKLIST_PAGE_SIZE,
  );
  const paginatedCompletedGroups = completedGroups.slice(
    completedStartIndex,
    completedStartIndex + CHECKLIST_PAGE_SIZE,
  );
  const paginatedPendingItems = paginatedPendingGroups.flatMap((group) => group.items);
  const paginatedCompletedItems = paginatedCompletedGroups.flatMap((group) => group.items);
  const pendingRangeStart = pendingGroups.length === 0 ? 0 : pendingStartIndex + 1;
  const pendingRangeEnd =
    pendingGroups.length === 0
      ? 0
      : Math.min(pendingGroups.length, pendingStartIndex + paginatedPendingGroups.length);
  const completedRangeStart = completedGroups.length === 0 ? 0 : completedStartIndex + 1;
  const completedRangeEnd =
    completedGroups.length === 0
      ? 0
      : Math.min(completedGroups.length, completedStartIndex + paginatedCompletedGroups.length);
  const cancelTargetItem =
    cancelTargetItemId
      ? checklistItems.find((item) => item.id === cancelTargetItemId) ?? null
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
        const localDriverCount = nextCurrent[itemId]?.drivers.length ?? 0;
        const backendDriverCount = assignment.drivers.length;

        if (backendDriverCount >= localDriverCount) {
          nextCurrent[itemId] = assignment;
        }
      });

      return nextCurrent;
    });
  }, [checklistItems, backendConfirmedDrivers]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(
        CHECKLIST_CONFIRMED_DRIVERS_STORAGE_KEY,
        JSON.stringify(confirmedDrivers),
      );
    } catch {
      // No-op if storage is blocked or full.
    }
  }, [confirmedDrivers]);

  useEffect(() => () => {
    if (copiedItemTimerRef.current !== null) {
      window.clearTimeout(copiedItemTimerRef.current);
      copiedItemTimerRef.current = null;
    }
  }, []);

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

  if (checklistItems.length === 0) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-slate-200/80 bg-surface-container-lowest p-5 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">H-1 Checklist</h2>
          <p className="mt-2 text-sm text-slate-600">
            <span className="sm:hidden">Driver readiness for next 3 days.</span>
            <span className="hidden sm:inline">
              Driver readiness for trips scheduled today, tomorrow, and the day after tomorrow.
            </span>
          </p>
        </header>

        <article className="rounded-3xl border border-dashed border-slate-300 bg-surface-container-lowest p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">
            event_busy
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-800">No upcoming trips in the next 3 days</h2>
          <p className="mt-2 text-sm text-slate-600">
            <span className="sm:hidden">No trip scheduled in the next 3 days.</span>
            <span className="hidden sm:inline">
              No itinerary is scheduled for today, tomorrow, and the day after tomorrow.
            </span>
          </p>
          {groupsWithItineraryCount > 0 ? (
            <p className="mt-3 text-xs font-medium text-amber-700">
              Beberapa group punya itinerary, tetapi belum masuk rentang H-1 (hari ini s/d H+2) atau tanggal itinerary belum valid.
            </p>
          ) : null}
        </article>
      </div>
    );
  }

  const statusTitle = isClear ? "Clear" : "Not Clear";
  const statusMessage = hasGroupCodeQuery
    ? isClear
      ? "No pending driver assignment found for the searched group number."
      : `${pendingItems.length} searched trips still need driver assignment.`
    : isClear
      ? "All trips for today, tomorrow, and the day after tomorrow already have a verified driver."
      : `${pendingItems.length} trips still do not have a driver assigned in the next 3 days.`;
  const statusMessageMobile = hasGroupCodeQuery
    ? isClear
      ? "No pending driver for this group."
      : `${pendingItems.length} trips still need drivers.`
    : isClear
      ? "All trips already have verified drivers."
      : `${pendingItems.length} trips need driver assignment.`;

  const handleDraftChange = (
    itemId: string,
    field: keyof ChecklistDriverProfile,
    value: string,
  ) => {
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
      // Keep local state as fallback when backend sync is unavailable.
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
    const tripLabel = checklistItem.activity?.trim() || "-";
    const scheduleDetails = checklistItem.transferByTrain
      ? `${scheduleDate} | TRAIN ${formatScheduleTime(checklistItem.trainDepartureTime)} | STATION PICKUP ${formatScheduleTime(checklistItem.stationPickupTime)}`
      : checklistItem.hotelPickupRequestTime
        ? `${scheduleDate} | HOTEL PICKUP ${formatScheduleTime(checklistItem.hotelPickupRequestTime)} | FLIGHT ${formatScheduleTime(checklistItem.departureFlightTime || checklistItem.scheduledTime)}`
      : `${scheduleDate} | ${scheduleTime}`;
    const driverLines = assignment.drivers.flatMap((driver, index) => [
      `DRIVER NAME ${index + 1} : ${(driver.name || "-").toUpperCase()}`,
      `DRIVER PHONE ${index + 1} : ${driver.phone || "-"}`,
      `DRIVER PLATE ${index + 1} : ${(driver.plateNumber || "-").toUpperCase()}`,
    ]);

    const payload = [
      "*GROUP DETAILS*",
      "```",
      `GROUP NUMBER : ${checklistItem.groupCode}`,
      `GROUP NAME   : ${checklistItem.groupName.toUpperCase()}`,
      `TOTAL BUS    : ${checklistItem.requiredBusCount}`,
      `TRIP         : ${tripLabel}`,
      `SCHEDULE     : ${scheduleDetails}`,
      "```",
      "",
      "*DRIVER DETAILS*",
      "```",
      ...driverLines,
      "```",
    ].join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      }
    } catch {
      // No-op fallback for browsers that block clipboard API.
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
    const tripLabel = checklistItem.activity?.trim() || "-";
    const scheduleDetails = checklistItem.transferByTrain
      ? `${scheduleDate} | TRAIN ${formatScheduleTime(checklistItem.trainDepartureTime)} | STATION PICKUP ${formatScheduleTime(checklistItem.stationPickupTime)}`
      : checklistItem.hotelPickupRequestTime
        ? `${scheduleDate} | HOTEL PICKUP ${formatScheduleTime(checklistItem.hotelPickupRequestTime)} | FLIGHT ${formatScheduleTime(checklistItem.departureFlightTime || checklistItem.scheduledTime)}`
      : `${scheduleDate} | ${scheduleTime}`;
    const payload = [
      "*GROUP DETAILS*",
      "```",
      `GROUP NUMBER : ${checklistItem.groupCode}`,
      `GROUP NAME   : ${checklistItem.groupName.toUpperCase()}`,
      `TOTAL BUS    : ${checklistItem.requiredBusCount}`,
      `TRIP         : ${tripLabel}`,
      `SCHEDULE     : ${scheduleDetails}`,
      "```",
    ].join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      }
    } catch {
      // No-op fallback for browsers that block clipboard API.
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
      // Keep local reset as fallback when backend sync is unavailable.
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

  const pendingNeedAttentionCards = paginatedPendingItems.map((item) => {
    const draft = driverDrafts[item.id] ?? createEmptyChecklistDraft();
    const requiredDriverCount = getRequiredDriverCount(item);
    const assignedDrivers = confirmedDrivers[item.id]?.drivers.slice(0, requiredDriverCount) ?? [];
    const assignedProgressCount = assignedDrivers.length;
    const isComplete = assignedProgressCount >= requiredDriverCount;
    const isMultiDriver = requiredDriverCount > 1;
    const groupRecord = groupsByCode.get(item.groupCode.trim().toUpperCase());
    const serviceType = resolveGroupServiceType(groupRecord);
    const isExternalTransport = isExternalTransportGroup(groupRecord);
    const isConfirmDisabled =
      isComplete ||
      !draft.name.trim() ||
      !draft.phone.trim() ||
      !draft.plateNumber.trim();
    const timeCopy = item.transferByTrain
      ? `Train ${formatScheduleTime(item.trainDepartureTime)}`
      : item.hotelPickupRequestTime
        ? `Pickup ${formatScheduleTime(item.hotelPickupRequestTime)}`
      : formatScheduleTime(item.scheduledTime || "");

    return (
      <article
        key={item.id}
        className="overflow-hidden rounded-3xl border-[0.5px] border-black/20 bg-surface-container-lowest shadow-sm"
      >
        <div className="grid gap-0 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="border-b border-dashed border-black/45 bg-surface-container-lowest p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-900">Group No</p>
                <p className="mt-2 text-[2rem] font-extrabold leading-none tracking-tight text-slate-900">
                  {item.groupCode}
                </p>
              </div>
              <button
                type="button"
                className="inline-flex items-center rounded-lg bg-surface-container-lowest/90 p-1.5 text-slate-900 transition hover:bg-surface-container-lowest"
                onClick={() => {
                  void handleCopyTripWithoutDriverName(item.id);
                }}
                title={copiedItemId === item.id ? "Copied" : "Copy details"}
                aria-label={copiedItemId === item.id ? "Copied" : "Copy trip details"}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {copiedItemId === item.id ? "check" : "content_copy"}
                </span>
              </button>
            </div>

            <div className="mt-5 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Activity</p>
              <h4 className="text-lg font-bold leading-snug text-slate-900">{item.activity}</h4>
              <p className="truncate text-sm font-semibold text-slate-900">{item.groupName}</p>
              <span className="inline-flex items-center rounded-md border border-slate-900/20 bg-surface-container-lowest/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-900">
                {serviceType}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Date</p>
                <strong className="mt-1 block text-base font-extrabold text-slate-900">{getChecklistDayLabel(item.tripDate)}</strong>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Time</p>
                <strong className="mt-1 block text-base font-extrabold text-slate-900">{timeCopy}</strong>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Total Pax</p>
                <strong className="mt-1 block text-base font-extrabold text-slate-900">{item.groupPax} Pax</strong>
              </div>
            </div>
          </div>

          <div className="checklist-need-attention-body space-y-4 p-5">
            {isExternalTransport ? (
              <div className="checklist-need-attention-warning flex items-start gap-2 rounded-xl px-3 py-2 text-xs">
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  warning
                </span>
                <p className="font-semibold">
                  Visa Only: transport di-handle vendor eksternal. Pastikan koordinasi vendor luar sebelum konfirmasi assignment.
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant/90">
                Assign Transport (Driver {assignedProgressCount}/{requiredDriverCount})
              </span>

              {isMultiDriver ? (
                <span className="checklist-need-attention-required inline-flex rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em]">
                  {requiredDriverCount} Buses Required
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">Driver Name</span>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={draft.name}
                  onChange={(event) =>
                    handleDraftChange(item.id, "name", event.target.value)
                  }
                  placeholder="Enter name..."
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">Phone</span>
                <input
                  type="tel"
                  className="w-full rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={draft.phone}
                  onChange={(event) =>
                    handleDraftChange(item.id, "phone", event.target.value)
                  }
                  placeholder="+966..."
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">Plate</span>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  value={draft.plateNumber}
                  onChange={(event) =>
                    handleDraftChange(item.id, "plateNumber", event.target.value)
                  }
                  placeholder="ABC-123"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.12em] text-on-primary transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-45"
                onClick={() => handleConfirmDriver(item.id)}
                disabled={isConfirmDisabled}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  check_circle
                </span>
                <span>
                  {isMultiDriver
                    ? `Confirm Driver ${assignedProgressCount + 1}/${requiredDriverCount}`
                    : "Confirm Assignment"}
                </span>
              </button>

              <div
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold leading-none ${
                  isComplete
                    ? "checklist-need-attention-status-complete"
                    : "checklist-need-attention-status-pending"
                }`}
                role="status"
                aria-live="polite"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {isComplete ? "check_circle" : "pending_actions"}
                </span>
                <span>{isComplete ? "Complete" : "Not Complete"}</span>
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <section
        className="flex items-center gap-3"
        aria-label="Search checklist items"
      >
        <div className="flex min-w-0 flex-1 max-w-xl items-center gap-3">
          <label
            className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface-container-lowest px-4 shadow-ambient sm:h-14"
          >
            <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              className="w-full border-none bg-transparent text-sm font-medium text-on-surface-variant outline-none placeholder:text-on-surface-variant/50"
              value={groupCodeQuery}
              onChange={(event) => setGroupCodeQuery(event.target.value)}
              placeholder="Search group number, e.g. 901794508"
            />
          </label>

        </div>

        <ThemeToggleButton className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:border-primary/45 hover:text-primary sm:ml-auto sm:mr-5" />

      </section>

      <header className="rounded-3xl border border-slate-200/80 bg-surface-container-lowest p-5 shadow-sm">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">H-1 Checklist</h2>
        <p className="mt-2 text-sm text-slate-600">
          <span className="sm:hidden">Driver readiness for next 3 days.</span>
          <span className="hidden sm:inline">
            Driver readiness for trips scheduled today, tomorrow, and the day after tomorrow.
          </span>
        </p>
      </header>

      {hasGroupCodeQuery && searchedChecklistItems.length === 0 ? (
        <article className="rounded-3xl border border-dashed border-slate-300 bg-surface-container-lowest p-10 text-center">
          <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">
            search_off
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-800">Group number not found</h2>
          <p className="mt-2 text-sm text-slate-600">
            <span className="sm:hidden">Try another code or clear search.</span>
            <span className="hidden sm:inline">Try another group code or clear search to see all checklist items.</span>
          </p>
        </article>
      ) : null}

      {isClear ? (
        <section className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-lowest" aria-hidden="true">
            <span className="material-symbols-outlined">check_circle</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold">{statusTitle}</h3>
            <p className="text-sm opacity-90">
              <span className="sm:hidden">{statusMessageMobile}</span>
              <span className="hidden sm:inline">{statusMessage}</span>
            </p>
          </div>
        </section>
      ) : null}

      {searchedChecklistItems.length > 0 ? (
        <>
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-rose-700">Need Attention</h3>
              <span className="rounded-lg border border-rose-200 bg-rose-100 px-3 py-1 text-xs font-bold uppercase leading-none tracking-[0.12em] text-rose-700">
                {pendingItems.length} Actions Required
              </span>
              <span className="hidden h-px flex-1 bg-slate-200 sm:block" aria-hidden="true" />
            </div>

            {pendingItems.length > 0 ? (
              <div className="space-y-4">
                {pendingNeedAttentionCards}
              </div>
            ) : (
              <article className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/55 p-8 text-center">
                <span className="material-symbols-outlined text-3xl text-brand-primary" aria-hidden="true">
                  verified
                </span>
                <h2 className="mt-2 text-lg font-bold text-slate-800">All trips are ready</h2>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="sm:hidden">No pending driver assignment.</span>
                  <span className="hidden sm:inline">There are no pending driver assignments in the next 3 days.</span>
                </p>
              </article>
            )}

            <PaginationControls
              currentPage={pendingPage}
              totalPages={pendingTotalPages}
              totalItems={pendingItems.length}
              rangeStart={pendingRangeStart}
              rangeEnd={pendingRangeEnd}
              itemLabel="pending trips"
              onPageChange={(nextPage) =>
                setPendingPage(Math.max(1, Math.min(pendingTotalPages, nextPage)))
              }
            />
          </section>

          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-extrabold uppercase tracking-[0.16em] text-emerald-700">Completed</h3>
              <span className="rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-bold uppercase leading-none tracking-[0.12em] text-emerald-700">
                {completedItems.length} Trips Assigned
              </span>
              <span className="hidden h-px flex-1 bg-slate-200 sm:block" aria-hidden="true" />
            </div>

            <div className="space-y-3">
              {paginatedCompletedItems.map((item) => {
                const assignment = confirmedDrivers[item.id];
                if (!assignment) {
                  return null;
                }
                const groupRecord = groupsByCode.get(item.groupCode.trim().toUpperCase());
                const serviceType = resolveGroupServiceType(groupRecord);
                const isExternalTransport = isExternalTransportGroup(groupRecord);
                const requiredDriverCount = getRequiredDriverCount(item);
                const assignedDrivers = assignment.drivers.slice(0, requiredDriverCount);
                const assignedDriverNames = assignedDrivers
                  .map((driver) => driver.name.trim())
                  .filter((name) => name.length > 0);
                const scheduledPrimary = item.transferByTrain
                  ? `Train ${formatScheduleTime(item.trainDepartureTime)}`
                  : item.hotelPickupRequestTime
                    ? `Pickup ${formatScheduleTime(item.hotelPickupRequestTime)}`
                  : formatScheduleTime(item.scheduledTime || "");
                const scheduledSecondary = item.transferByTrain
                  ? `Pickup ${formatScheduleTime(item.stationPickupTime)}`
                  : item.hotelPickupRequestTime
                    ? `Flight ${formatScheduleTime(item.departureFlightTime || item.scheduledTime)}`
                  : "";

                return (
                  <article key={item.id} className="rounded-2xl border border-slate-200 bg-surface-container-lowest px-4 py-3">
                    <div className="grid items-center gap-3 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.9fr_1.3fr_auto_auto]">
                      <div className="min-w-0">
                        <p className="truncate text-2xl font-extrabold leading-none tracking-tight text-slate-700 sm:text-3xl">
                          {item.groupCode}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{item.groupName}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1 truncate text-sm font-semibold text-slate-600">
                          <span className="material-symbols-outlined text-sm text-slate-500" aria-hidden="true">
                            {item.activityIcon}
                          </span>
                          <span>{item.activity}</span>
                        </p>
                        <span
                          className={`mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                            serviceType === "Visa+"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {serviceType}
                        </span>
                        {isExternalTransport ? (
                          <p className="mt-1 text-[10px] font-semibold text-amber-700">
                            Reminder: transport vendor eksternal.
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-0.5">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">
                          Scheduled Time
                        </span>
                        <strong className="block text-xl font-extrabold leading-none text-slate-700 sm:text-2xl">{scheduledPrimary}</strong>
                        {scheduledSecondary ? (
                          <small className="block text-[10px] text-slate-500">{scheduledSecondary}</small>
                        ) : null}
                      </div>

                      <div className="space-y-0.5">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-400">
                          {requiredDriverCount > 1 ? "Assigned Drivers" : "Assigned Driver"}
                        </span>
                        <div className="space-y-1">
                          {assignedDriverNames.length > 0 ? (
                            assignedDriverNames.map((driverName, index) => (
                              <div
                                key={`${item.id}-driver-${index}`}
                                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1"
                              >
                                <span className="inline-flex min-w-[52px] justify-center rounded-md bg-surface-container-lowest px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-emerald-700">
                                  Supir {index + 1}
                                </span>
                                <strong className="truncate text-sm font-bold leading-tight text-brand-primary" title={driverName}>
                                  {driverName}
                                </strong>
                              </div>
                            ))
                          ) : (
                            <strong className="block truncate text-base font-bold leading-tight text-slate-500">
                              -
                            </strong>
                          )}
                          <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.07em] text-emerald-700">
                            Verified
                          </span>
                        </div>
                      </div>

                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.07em] text-amber-700 transition hover:border-amber-300 hover:bg-amber-100"
                          onClick={() => handleOpenCancelConfirm(item.id)}
                        >
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                            cancel
                          </span>
                          <span>Cancel</span>
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-surface-container-lowest px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-500 transition hover:border-brand-primary hover:text-brand-primary"
                          onClick={() => handleCopyDriver(item.id)}
                        >
                          <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                            {copiedItemId === item.id ? "check" : "content_copy"}
                          </span>
                          <span>{copiedItemId === item.id ? "Copied" : "Copy"}</span>
                        </button>
                      </div>

                      <span className="inline-flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-[0.1em] text-emerald-700">
                        <span className="material-symbols-outlined text-base" aria-hidden="true">
                          check_circle
                        </span>
                        <span>Assigned</span>
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>

            <PaginationControls
              currentPage={completedPage}
              totalPages={completedTotalPages}
              totalItems={completedItems.length}
              rangeStart={completedRangeStart}
              rangeEnd={completedRangeEnd}
              itemLabel="completed trips"
              onPageChange={(nextPage) =>
                setCompletedPage(Math.max(1, Math.min(completedTotalPages, nextPage)))
              }
            />
          </section>
        </>
      ) : null}

      {cancelTargetItem ? (
        <ChecklistModalPortal>
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/60 p-4"
            onClick={handleCloseCancelConfirm}
            role="presentation"
          >
            <div
              className="w-full max-w-md rounded-2xl border border-slate-200 bg-surface-container-lowest p-5 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="cancel-assignment-title"
              aria-describedby="cancel-assignment-description"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <span
                  className="material-symbols-outlined rounded-full bg-amber-100 p-2 text-amber-700"
                  aria-hidden="true"
                >
                  warning
                </span>
                <div className="min-w-0">
                  <h4 id="cancel-assignment-title" className="text-lg font-extrabold text-slate-900">
                    Cancel Driver Assignment?
                  </h4>
                  <p id="cancel-assignment-description" className="mt-1 text-sm text-slate-600">
                    Assignment untuk <strong>{cancelTargetItem.groupCode}</strong> akan dikembalikan ke
                    <strong> Need Attention</strong> dan data supir akan dihapus.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-surface-container-high"
                  onClick={handleCloseCancelConfirm}
                >
                  Keep Assigned
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-rose-700"
                  onClick={() => {
                    void handleConfirmCancelAssignment();
                  }}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    cancel
                  </span>
                  <span>Yes, Cancel</span>
                </button>
              </div>
            </div>
          </div>
        </ChecklistModalPortal>
      ) : null}
    </div>
  );
}





