import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import * as Domain from "../shared/app-domain";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { Button } from "../components/button";
import { Badge } from "../components/badge";
import { buildGroupItineraryBuilderPath, buildVisaDetailPath } from "../shared/app-route";
import type {
  EditScheduleFormState,
  GroupData,
  GroupAgreementHotel,
  ItineraryItem,
  Musyrif,
  NoteItem,
  ScheduleFormState,
} from "../shared/app-domain";

const {
  buildItineraryItemFromEditForm,
  buildTransferTrainSummary,
  createEditScheduleForm,
  createInitialScheduleForm,
  createNoteItems,
  createScheduleMeta,
  expandTransferTrainItineraryItems,
  formatVisaShortDate,
  formatScheduleTime,
  formatRouteSummary,
  formatScheduleDate,
  generateWhatsappCopyText,
  getGroupAgreementHotelsByCity,
  getStayPeriods,
  getScheduleTypeOption,
  hasIncompleteTransferTrainFields,
  inferCategoryKey,
  inferCityTourCity,
  isCityTourActivityType,
  isFlightActivityType,
  isIsoDateValue,
  isTransferActivityType,
  normalizeAgreementCityKey,
  parseTimeForInput,
  resolveGroupCompleteness,
  resolveTotalBusCount,
  shouldShowFridayCityTourWarning,
} = Domain;

const LazyDeleteConfirmModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).DeleteConfirmModal,
}));
const LazyDeleteGroupModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).DeleteGroupModal,
}));
const LazyEditScheduleModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).EditScheduleModal,
}));
const LazyGroupEditModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).GroupEditModal,
}));
const LazyMusyrifModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).MusyrifModal,
}));
const LazyUnlinkGroupConfirmModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).UnlinkGroupConfirmModal,
}));
const LazyNoteModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).NoteModal,
}));
const LazyScheduleModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).ScheduleModal,
}));

function GroupDetailModalFallback() {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="serene-modal-overlay z-[140] flex items-center justify-center p-4">
      <div className="inline-flex items-center gap-2 rounded-xl bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface shadow-ambient">
        <span className="material-symbols-outlined animate-pulse text-brand-primary" aria-hidden="true">
          hourglass_top
        </span>
        <span>Loading modal...</span>
      </div>
    </div>,
    document.body,
  );
}

function resolveItinerarySortTimestamp(item: ItineraryItem): number {
  const trimmedIsoDate = item.isoDate?.trim() ?? "";
  if (trimmedIsoDate.length > 0) {
    const parsedIsoDate = Date.parse(`${trimmedIsoDate}T00:00:00`);
    if (Number.isFinite(parsedIsoDate)) {
      return parsedIsoDate;
    }
  }

  const fallbackDate = `${item.date} ${item.year}`.trim();
  const parsedFallbackDate = Date.parse(fallbackDate);
  if (Number.isFinite(parsedFallbackDate)) {
    return parsedFallbackDate;
  }

  return Number.MAX_SAFE_INTEGER;
}

function sortItineraryByNearestDate(items: ItineraryItem[]): ItineraryItem[] {
  return [...items].sort((left, right) => {
    const dateDiff = resolveItinerarySortTimestamp(left) - resolveItinerarySortTimestamp(right);
    if (dateDiff !== 0) {
      return dateDiff;
    }

    const leftTime = left.time?.trim() ?? "";
    const rightTime = right.time?.trim() ?? "";
    if (leftTime !== rightTime) {
      return leftTime.localeCompare(rightTime);
    }

    return left.title.localeCompare(right.title);
  });
}

function isItineraryDateOnOrAfterToday(item: ItineraryItem, todayStartMs: number): boolean {
  const trimmedIsoDate = item.isoDate?.trim() ?? "";
  if (trimmedIsoDate.length > 0) {
    const parsedIsoDate = Date.parse(`${trimmedIsoDate}T00:00:00`);
    if (Number.isFinite(parsedIsoDate)) {
      return parsedIsoDate >= todayStartMs;
    }
  }

  const fallbackDate = `${item.date} ${item.year}`.trim();
  const parsedFallbackDate = Date.parse(fallbackDate);
  if (Number.isFinite(parsedFallbackDate)) {
    return parsedFallbackDate >= todayStartMs;
  }

  return false;
}

function resolveNextActivityFromItinerary(
  itinerary: ItineraryItem[],
  fallback: GroupData["nextActivity"],
): GroupData["nextActivity"] {
  const sortedItinerary = sortItineraryByNearestDate(itinerary);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStartMs = today.getTime();
  const upcomingItinerary = sortedItinerary.filter((item) => isItineraryDateOnOrAfterToday(item, todayStartMs));
  const highlightedItem = upcomingItinerary.find((item) => item.highlighted);
  const candidateItem = highlightedItem ?? upcomingItinerary[0];

  if (!candidateItem) {
    return {
      title: "No upcoming activity",
      date: "-",
      time: "",
      icon: fallback.icon?.trim() || "event",
    };
  }

  const fallbackMetaTime = parseTimeForInput(candidateItem.meta.split(" | ")[0] ?? "");
  const resolvedTime = candidateItem.time?.trim() || fallbackMetaTime;

  return {
    title: candidateItem.title.trim() || fallback.title,
    date: candidateItem.date.trim() || fallback.date,
    time: resolvedTime || "",
    icon: candidateItem.icon.trim() || fallback.icon,
  };
}

function formatItineraryMetaForDisplay(meta: string): string {
  const segments = meta
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return "";
  }

  const [firstSegment, ...restSegments] = segments;
  const normalizedFirstSegment = formatScheduleTime(firstSegment);
  return [normalizedFirstSegment, ...restSegments].join(" | ");
}

function formatItineraryActivityHeading(item: ItineraryItem, categoryKey: string, fallbackLabel: string): string {
  if (categoryKey !== "transfer") {
    return fallbackLabel;
  }

  const normalizedCategory = item.category.toLowerCase();
  if (normalizedCategory.includes("train departure")) {
    return "Transfer (Train Departure)";
  }

  if (normalizedCategory.includes("station pickup")) {
    return "Transfer (Station Pickup)";
  }

  return fallbackLabel;
}

function formatItineraryCompactSummary(item: ItineraryItem, categoryKey: string): string {
  const trimmedFrom = item.from?.trim() ?? "";
  const trimmedTo = item.to?.trim() ?? "";

  if (categoryKey === "city-tour") {
    const cityTourCity = inferCityTourCity(item).trim();
    if (cityTourCity) {
      return `City Tour ${cityTourCity}`;
    }
  }

  if (trimmedFrom && trimmedTo) {
    return `${trimmedFrom} -> ${trimmedTo}`;
  }

  if (trimmedFrom || trimmedTo) {
    return [trimmedFrom, trimmedTo].filter(Boolean).join(" -> ");
  }

  const trimmedTitle = item.title.trim();
  return trimmedTitle || "Activity detail pending";
}

function formatItinerarySupportMeta(item: ItineraryItem, categoryKey: string): string {
  const detailSegments: string[] = [];
  const primaryTime = (item.transferByTrain ? item.trainDepartureTime : item.time)?.trim() ?? "";
  const flightNumber = item.flightNumber?.trim() ?? "";
  const trimmedFrom = item.from?.trim() ?? "";
  const trimmedTo = item.to?.trim() ?? "";
  const inferredFromHotelName = /hotel/i.test(trimmedFrom) ? trimmedFrom : "";
  const inferredToHotelName = /hotel/i.test(trimmedTo) ? trimmedTo : "";
  const fromHotelName = item.fromHotelName?.trim() || inferredFromHotelName;
  const hotelName =
    item.hotelName?.trim() ||
    (categoryKey === "transfer" ? inferredToHotelName : inferredFromHotelName || inferredToHotelName);
  const stationPickupTime = item.destinationPickupTime?.trim() ?? "";
  const hotelPickupRequestTime = item.hotelPickupRequestTime?.trim() ?? "";
  const notes = item.notes?.trim() ?? "";

  if (primaryTime) {
    detailSegments.push(formatScheduleTime(primaryTime));
  }

  if ((categoryKey === "arrival" || categoryKey === "departure") && flightNumber) {
    detailSegments.push(`Flight ${flightNumber}`);
  }

  if (categoryKey === "transfer" && (fromHotelName || hotelName)) {
    if (fromHotelName && hotelName) {
      detailSegments.push(`Hotel ${fromHotelName} -> ${hotelName}`);
    } else {
      detailSegments.push(`Hotel ${fromHotelName || hotelName}`);
    }
  } else if ((categoryKey === "arrival" || categoryKey === "city-tour" || categoryKey === "departure") && hotelName) {
    detailSegments.push(`Hotel ${hotelName}`);
  }

  if (categoryKey === "departure" && hotelPickupRequestTime) {
    detailSegments.push(`Hotel pickup ${formatScheduleTime(hotelPickupRequestTime)}`);
  }

  if (item.transferByTrain && stationPickupTime) {
    detailSegments.push(`Pickup ${formatScheduleTime(stationPickupTime)}`);
  }

  if (item.requiresBus) {
    detailSegments.push("Requires Bus");
  }

  if (notes) {
    detailSegments.push(notes.length > 42 ? `${notes.slice(0, 39).trimEnd()}...` : notes);
  }

  if (detailSegments.length > 0) {
    return detailSegments.join(" | ");
  }

  return formatItineraryMetaForDisplay(item.meta);
}

type AgreementCityKey = "makkah" | "madinah";

type CompactAgreementSummary = {
  city: AgreementCityKey;
  cityLabel: string;
  hotelLabel: string;
  paxLabel: string;
  stayLabel: string;
  primaryHotelLabel: string;
  isMissing: boolean;
};

function formatAgreementHotelCount(count: number): string {
  return count === 1 ? "1 hotel" : `${count} hotels`;
}

function formatCompactIsoDateRange(startIso: string, endIso: string): string {
  const normalizedStartIso = startIso.trim();
  const normalizedEndIso = endIso.trim();
  const hasStart = isIsoDateValue(normalizedStartIso);
  const hasEnd = isIsoDateValue(normalizedEndIso);

  if (hasStart && hasEnd) {
    if (normalizedStartIso === normalizedEndIso) {
      return formatVisaShortDate(normalizedStartIso);
    }

    return `${formatVisaShortDate(normalizedStartIso)} - ${formatVisaShortDate(normalizedEndIso)}`;
  }

  if (hasStart) {
    return `Start ${formatVisaShortDate(normalizedStartIso)}`;
  }

  if (hasEnd) {
    return `End ${formatVisaShortDate(normalizedEndIso)}`;
  }

  return "Dates pending";
}

function formatGroupTripWindow(group: GroupData): string {
  return formatCompactIsoDateRange(group.arrivalDate ?? "", group.returnDate ?? "");
}

function formatCompactAgreementStayRange(hotels: GroupAgreementHotel[]): string {
  const sortedDates = hotels
    .flatMap((hotel) => [hotel.stayStartIso.trim(), hotel.stayEndIso.trim()])
    .filter(isIsoDateValue)
    .sort();
  const startIso = sortedDates[0] ?? "";
  const endIso = sortedDates.at(-1) ?? "";

  if (!startIso && !endIso) {
    return "Tanggal pending";
  }

  if (startIso && endIso && startIso !== endIso) {
    return `${formatVisaShortDate(startIso)} - ${formatVisaShortDate(endIso)}`;
  }

  return formatVisaShortDate(startIso || endIso);
}

function buildCompactAgreementSummary(group: GroupData, city: AgreementCityKey): CompactAgreementSummary {
  const hotels = getGroupAgreementHotelsByCity(group, city);
  const hotelCount = hotels.length;
  const calculateTotalPax = (hotelsList: GroupAgreementHotel[]): number => {
    if (hotelsList.length === 0) {
      return 0;
    }
    const periods = getStayPeriods(hotelsList);
    if (periods.length === 0) {
      return 0;
    }
    let minSum = Infinity;
    for (const period of periods) {
      const startMs = Date.parse(period.startIso);
      const endMs = Date.parse(period.endIso);
      
      const periodHotels = hotelsList.filter((h) => {
        const hStart = h.stayStartIso.trim();
        const hEnd = h.stayEndIso.trim();
        if (!isIsoDateValue(hStart) || !isIsoDateValue(hEnd)) {
          return false;
        }
        return Math.max(startMs, Date.parse(hStart)) < Math.min(endMs, Date.parse(hEnd));
      });
      
      const sum = periodHotels.reduce((total, h) => total + Math.max(0, h.pax || 0), 0);
      if (sum < minSum) {
        minSum = sum;
      }
    }
    return Math.min(group.pax, minSum);
  };
  const totalPax = calculateTotalPax(hotels);
  const firstHotelName = hotels[0]?.hotelName.trim() ?? "";
  const fallbackCityLabel = city === "makkah" ? "Makkah" : "Madinah";

  return {
    city,
    cityLabel: fallbackCityLabel,
    hotelLabel: hotelCount > 0 ? formatAgreementHotelCount(hotelCount) : "Belum linked",
    paxLabel: hotelCount > 0 ? `${totalPax}/${group.pax} pax` : `0/${group.pax} pax`,
    stayLabel: hotelCount > 0 ? formatCompactAgreementStayRange(hotels) : "Agreement pending",
    primaryHotelLabel: firstHotelName || `${fallbackCityLabel} hotel pending`,
    isMissing: hotelCount === 0,
  };
}

export function GroupDetail({
  group,
  groups = [],
  onBack,
  onDeleteGroup,
  onSaveGroup,
  onPatchGroup,
}: {
  group: GroupData;
  groups?: GroupData[];
  onBack: () => void;
  onDeleteGroup: (groupCode: string) => void;
  onSaveGroup: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  onPatchGroup: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
}) {
  const [searchParams] = useSearchParams();
  const familyGroups = useMemo(() => {
    const currentGroup = group;
    const parent = currentGroup.parentGroupId
      ? (groups.find((g) => g.id === currentGroup.parentGroupId || g.code === currentGroup.parentGroupId) ?? null)
      : currentGroup;
    if (!parent) return [currentGroup];
    const parentKey = parent.id || parent.code;
    if (!parentKey) return [currentGroup];
    const children = groups.filter(
      (g) => g.parentGroupId && (g.parentGroupId === parent.id || g.parentGroupId === parent.code) && g.code !== parent.code
    );
    return [parent, ...children];
  }, [groups, group]);
  const childGroupCount = useMemo(
    () =>
      groups.filter(
        (candidate) =>
          candidate.parentGroupId &&
          (candidate.parentGroupId === group.id || candidate.parentGroupId === group.code) &&
          candidate.code !== group.code,
      ).length,
    [groups, group],
  );
  const totalPax = useMemo(() => {
    return familyGroups.reduce((acc, g) => acc + g.pax, 0);
  }, [familyGroups]);
  const [itineraryItems, setItineraryItems] = useState(() => sortItineraryByNearestDate(group.itinerary));
  const [noteItems, setNoteItems] = useState<NoteItem[]>(() => createNoteItems(group.notes, group.code));
  const [musyrifProfile, setMusyrifProfile] = useState<Musyrif>(group.musyrif);
  const [isMusyrifModalOpen, setIsMusyrifModalOpen] = useState(false);
  const [isMusyrifCopied, setIsMusyrifCopied] = useState(false);
  const musyrifCopyTimerRef = useRef<any | null>(null);
  const [isWhatsappCopied, setIsWhatsappCopied] = useState(false);
  const whatsappCopyTimerRef = useRef<any | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(createInitialScheduleForm);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editScheduleForm, setEditScheduleForm] = useState<EditScheduleFormState | null>(null);
  const scheduleSuggestedHotelNameRef = useRef("");
  const scheduleSuggestedFromHotelNameRef = useRef("");
  const editSuggestedHotelNameRef = useRef("");
  const editSuggestedFromHotelNameRef = useRef("");
  const handledSetupActionRef = useRef<string | null>(null);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
  const [isGroupEditModalOpen, setIsGroupEditModalOpen] = useState(false);
  const [unlinkingGroup, setUnlinkingGroup] = useState<GroupData | null>(null);

  useEffect(() => {
    setItineraryItems(sortItineraryByNearestDate(group.itinerary));
    setNoteItems((currentNotes) =>
      createNoteItems(group.notes, group.code).map((note) => ({
        ...note,
        pinned: currentNotes.find((currentNote) => currentNote.text === note.text)?.pinned ?? note.pinned,
      })),
    );
    setMusyrifProfile(group.musyrif);
  }, [group.code, group.itinerary, group.musyrif, group.notes]);

  const isEditModalOpen = editingIndex !== null && editScheduleForm !== null;
  const deletingItem = deletingIndex !== null ? (itineraryItems[deletingIndex] ?? null) : null;
  const isDeleteModalOpen = deletingItem !== null;
  const isUnlinkModalOpen = unlinkingGroup !== null;
  const hasOpenModal =
    isScheduleModalOpen ||
    isEditModalOpen ||
    isDeleteModalOpen ||
    isUnlinkModalOpen ||
    isNoteModalOpen ||
    isMusyrifModalOpen ||
    isDeleteGroupModalOpen ||
    isGroupEditModalOpen;

  useEffect(() => {
    if (!hasOpenModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsScheduleModalOpen(false);
        setEditingIndex(null);
        setEditScheduleForm(null);
        setDeletingIndex(null);
        setIsNoteModalOpen(false);
        setIsMusyrifModalOpen(false);
        setIsDeleteGroupModalOpen(false);
        setIsGroupEditModalOpen(false);
        setUnlinkingGroup(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasOpenModal]);

  useEffect(
    () => () => {
      if (musyrifCopyTimerRef.current !== null) {
        window.clearTimeout(musyrifCopyTimerRef.current);
        musyrifCopyTimerRef.current = null;
      }
      if (whatsappCopyTimerRef.current !== null) {
        window.clearTimeout(whatsappCopyTimerRef.current);
        whatsappCopyTimerRef.current = null;
      }
    },
    [],
  );

  const isScheduleFlightNumberMissing =
    isFlightActivityType(scheduleForm.category) && !scheduleForm.flightNumber.trim();
  const isScheduleHotelNameMissing =
    (scheduleForm.category === "arrival" || scheduleForm.category === "departure") && !scheduleForm.hotelName.trim();
  const isScheduleFromHotelNameMissing = false;
  const isScheduleDeparturePickupTimeMissing =
    scheduleForm.category === "departure" && !scheduleForm.hotelPickupRequestTime.trim();
  const isSchedulePrimaryTimeMissing =
    isTransferActivityType(scheduleForm.category) && scheduleForm.transferByTrain
      ? !scheduleForm.trainDepartureTime.trim()
      : !scheduleForm.time.trim();
  const hasScheduleTransferTrainFieldsMissing = hasIncompleteTransferTrainFields(scheduleForm);
  const isScheduleCityTourCityMissing =
    isCityTourActivityType(scheduleForm.category) && !scheduleForm.cityTourCity.trim();
  const isScheduleSaveDisabled =
    !scheduleForm.date ||
    isSchedulePrimaryTimeMissing ||
    !scheduleForm.from.trim() ||
    !scheduleForm.to.trim() ||
    isScheduleFlightNumberMissing ||
    isScheduleHotelNameMissing ||
    isScheduleFromHotelNameMissing ||
    isScheduleDeparturePickupTimeMissing ||
    isScheduleCityTourCityMissing ||
    hasScheduleTransferTrainFieldsMissing;
  const hasEditTransferTrainFieldsMissing = editScheduleForm
    ? hasIncompleteTransferTrainFields(editScheduleForm)
    : false;
  const isEditCityTourCityMissing =
    !!editScheduleForm && isCityTourActivityType(editScheduleForm.category) && !editScheduleForm.cityTourCity.trim();
  const isEditHotelNameMissing =
    !!editScheduleForm &&
    (editScheduleForm.category === "arrival" || editScheduleForm.category === "departure") &&
    !editScheduleForm.hotelName.trim();
  const isEditFromHotelNameMissing = false;
  const isEditDeparturePickupTimeMissing =
    !!editScheduleForm && editScheduleForm.category === "departure" && !editScheduleForm.hotelPickupRequestTime.trim();
  const isEditDepartureFlightTimeMissing =
    !!editScheduleForm && editScheduleForm.category === "departure" && !editScheduleForm.time.trim();
  const isEditSaveDisabled =
    !editScheduleForm?.date ||
    !editScheduleForm?.from.trim() ||
    !editScheduleForm?.to.trim() ||
    isEditCityTourCityMissing ||
    isEditHotelNameMissing ||
    isEditFromHotelNameMissing ||
    !!(editScheduleForm && isFlightActivityType(editScheduleForm.category) && !editScheduleForm.flightNumber.trim()) ||
    isEditDepartureFlightTimeMissing ||
    isEditDeparturePickupTimeMissing ||
    hasEditTransferTrainFieldsMissing;
  const showScheduleFridayCityTourWarning = shouldShowFridayCityTourWarning(scheduleForm.category, scheduleForm.date);
  const showEditFridayCityTourWarning =
    !!editScheduleForm && shouldShowFridayCityTourWarning(editScheduleForm.category, editScheduleForm.date);
  const cityHotelNames = useMemo(() => {
    const firstMakkahHotel = group.visaSetup?.makkahHotels[0]?.hotelName?.trim() ?? "";
    const firstMadinahHotel = group.visaSetup?.madinahHotels[0]?.hotelName?.trim() ?? "";
    return {
      makkah: firstMakkahHotel,
      madinah: firstMadinahHotel,
    };
  }, [group.visaSetup?.makkahHotels, group.visaSetup?.madinahHotels]);

  const resolveHotelNameByCity = useCallback(
    (cityInput: string): string => {
      const cityKey = normalizeAgreementCityKey(cityInput);
      if (!cityKey) {
        return "";
      }

      return cityHotelNames[cityKey]?.trim() ?? "";
    },
    [cityHotelNames],
  );

  const resolveSuggestedHotelName = useCallback(
    (draft: { category: string; from: string; to: string; cityTourCity: string }): string => {
      if (draft.category === "departure") {
        return resolveHotelNameByCity(draft.from);
      }

      if (draft.category === "arrival") {
        return resolveHotelNameByCity(draft.to);
      }

      if (draft.category === "city-tour") {
        return resolveHotelNameByCity(draft.cityTourCity);
      }

      return "";
    },
    [resolveHotelNameByCity],
  );

  const resolveSuggestedFromHotelName = useCallback(
    (draft: { category: string; from: string }): string => {
      if (draft.category !== "transfer") {
        return "";
      }

      return resolveHotelNameByCity(draft.from);
    },
    [resolveHotelNameByCity],
  );

  const applyScheduleHotelAutofill = useCallback(
    (draft: ScheduleFormState): ScheduleFormState => {
      const suggestedHotelName = resolveSuggestedHotelName(draft).trim();
      const suggestedFromHotelName = resolveSuggestedFromHotelName(draft).trim();
      const previousSuggestedHotelName = scheduleSuggestedHotelNameRef.current;
      const previousSuggestedFromHotelName = scheduleSuggestedFromHotelNameRef.current;
      const normalizedFrom = draft.from.trim().toLowerCase();
      const isPlainCityMeetingPoint = normalizedFrom === "makkah" || normalizedFrom === "madinah";
      const currentHotelName = draft.hotelName.trim();
      const currentFromHotelName = draft.fromHotelName.trim();
      const shouldRefreshHotelName =
        !currentHotelName || (!!previousSuggestedHotelName && currentHotelName === previousSuggestedHotelName);
      const shouldRefreshFromHotelName =
        !currentFromHotelName ||
        (!!previousSuggestedFromHotelName && currentFromHotelName === previousSuggestedFromHotelName);
      const nextDraft: ScheduleFormState = {
        ...draft,
        hotelName: shouldRefreshHotelName ? suggestedHotelName : currentHotelName,
        fromHotelName: isTransferActivityType(draft.category)
          ? shouldRefreshFromHotelName
            ? suggestedFromHotelName
            : currentFromHotelName
          : "",
      };

      if (
        isCityTourActivityType(nextDraft.category) &&
        suggestedHotelName &&
        (!nextDraft.from.trim() || isPlainCityMeetingPoint)
      ) {
        nextDraft.from = suggestedHotelName;
      }

      scheduleSuggestedHotelNameRef.current = suggestedHotelName;
      scheduleSuggestedFromHotelNameRef.current = suggestedFromHotelName;
      return nextDraft;
    },
    [resolveSuggestedFromHotelName, resolveSuggestedHotelName],
  );

  const applyEditHotelAutofill = useCallback(
    (draft: EditScheduleFormState): EditScheduleFormState => {
      const suggestedHotelName = resolveSuggestedHotelName(draft).trim();
      const suggestedFromHotelName = resolveSuggestedFromHotelName(draft).trim();
      const previousSuggestedHotelName = editSuggestedHotelNameRef.current;
      const previousSuggestedFromHotelName = editSuggestedFromHotelNameRef.current;
      const normalizedFrom = draft.from.trim().toLowerCase();
      const isPlainCityMeetingPoint = normalizedFrom === "makkah" || normalizedFrom === "madinah";
      const currentHotelName = draft.hotelName.trim();
      const currentFromHotelName = draft.fromHotelName.trim();
      const shouldRefreshHotelName =
        !currentHotelName || (!!previousSuggestedHotelName && currentHotelName === previousSuggestedHotelName);
      const shouldRefreshFromHotelName =
        !currentFromHotelName ||
        (!!previousSuggestedFromHotelName && currentFromHotelName === previousSuggestedFromHotelName);
      const nextDraft: EditScheduleFormState = {
        ...draft,
        hotelName: shouldRefreshHotelName ? suggestedHotelName : currentHotelName,
        fromHotelName: isTransferActivityType(draft.category)
          ? shouldRefreshFromHotelName
            ? suggestedFromHotelName
            : currentFromHotelName
          : "",
      };

      if (
        isCityTourActivityType(nextDraft.category) &&
        suggestedHotelName &&
        (!nextDraft.from.trim() || isPlainCityMeetingPoint)
      ) {
        nextDraft.from = suggestedHotelName;
      }

      editSuggestedHotelNameRef.current = suggestedHotelName;
      editSuggestedFromHotelNameRef.current = suggestedFromHotelName;
      return nextDraft;
    },
    [resolveSuggestedFromHotelName, resolveSuggestedHotelName],
  );

  useEffect(() => {
    scheduleSuggestedHotelNameRef.current = "";
    scheduleSuggestedFromHotelNameRef.current = "";
    editSuggestedHotelNameRef.current = "";
    editSuggestedFromHotelNameRef.current = "";
    setItineraryItems(sortItineraryByNearestDate(group.itinerary));
    setNoteItems(createNoteItems(group.notes, group.code));
    setMusyrifProfile(group.musyrif);
    setIsMusyrifCopied(false);
    setIsWhatsappCopied(false);
    setIsMusyrifModalOpen(false);
    setIsScheduleModalOpen(false);
    setScheduleForm(applyScheduleHotelAutofill(createInitialScheduleForm()));
    setEditingIndex(null);
    setEditScheduleForm(null);
    setDeletingIndex(null);
    setIsNoteModalOpen(false);
    setIsDeleteGroupModalOpen(false);
    setIsGroupEditModalOpen(false);
    setUnlinkingGroup(null);
  }, [applyScheduleHotelAutofill, group.code, group.itinerary, group.name, group.notes, group.musyrif]);

  const detailKickerClassName = "text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant/80";
  const statusToneClassName =
    group.tone === "active"
      ? "border-brand-primary/30 bg-brand-primary/10 text-brand-primary"
      : "border-outline-variant/60 bg-surface-container-high text-on-surface-variant";
  const statusBadgeClassName = `inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${statusToneClassName}`;
  const displayedNextActivity = useMemo(
    () => resolveNextActivityFromItinerary(itineraryItems, group.nextActivity),
    [itineraryItems, group.nextActivity],
  );
  const requiredBusCount = useMemo(
    () => resolveTotalBusCount(group.pax, group.totalBuses),
    [group.pax, group.totalBuses],
  );
  const completeness = useMemo(
    () => resolveGroupCompleteness({ ...group, itinerary: itineraryItems }),
    [group, itineraryItems],
  );
  const compactAgreementSummaries = useMemo(
    () => (["makkah", "madinah"] as const).map((city) => buildCompactAgreementSummary(group, city)),
    [group],
  );
  const shouldShowLinkAgreementAction = completeness.issues.some(
    (issue) =>
      issue.key === "missing-agreement" ||
      issue.key === "missing-makkah-agreement" ||
      issue.key === "missing-madinah-agreement",
  );
  const shouldShowCreateItineraryAction = completeness.issues.some((issue) => issue.key === "missing-itinerary");

  type GroupSnapshotInput = {
    nextItinerary?: ItineraryItem[];
    nextNoteItems?: NoteItem[];
    nextMusyrif?: Musyrif;
    nextGroupName?: string;
    nextGroupCode?: string;
    nextPax?: number;
    nextTotalBuses?: number;
    nextArrivalDate?: string;
    nextReturnDate?: string;
    nextDurationDays?: number;
    nextParentGroupId?: string | null;
  };

  const buildGroupSnapshot = ({
    nextItinerary = itineraryItems,
    nextNoteItems = noteItems,
    nextMusyrif = musyrifProfile,
    nextGroupName = group.name,
    nextGroupCode = group.code,
    nextPax = group.pax,
    nextTotalBuses = group.totalBuses,
    nextArrivalDate = group.arrivalDate,
    nextReturnDate = group.returnDate,
    nextDurationDays = group.durationDays,
    nextParentGroupId = group.parentGroupId,
  }: GroupSnapshotInput): GroupData => {
    const normalizedItinerary = sortItineraryByNearestDate(nextItinerary);
    return {
      ...group,
      code: nextGroupCode.trim().toUpperCase(),
      name: nextGroupName.trim(),
      pax: nextPax,
      totalBuses: nextTotalBuses,
      arrivalDate: nextArrivalDate,
      returnDate: nextReturnDate,
      durationDays: nextDurationDays,
      parentGroupId: nextParentGroupId,
      nextActivity: resolveNextActivityFromItinerary(normalizedItinerary, group.nextActivity),
      itinerary: normalizedItinerary,
      notes: nextNoteItems.map((item) => item.text),
      musyrif: nextMusyrif,
    };
  };

  const persistGroupSnapshot = (input: GroupSnapshotInput): { ok: true } | { ok: false; message: string } => {
    const nextGroup = buildGroupSnapshot(input);
    return onSaveGroup(nextGroup, group.code);
  };

  const patchGroupSnapshot = (input: GroupSnapshotInput): { ok: true } | { ok: false; message: string } => {
    const nextGroup = buildGroupSnapshot(input);
    return onPatchGroup(nextGroup, group.code);
  };

  const handleScheduleFieldChange = <Key extends keyof ScheduleFormState>(
    field: Key,
    value: ScheduleFormState[Key],
  ) => {
    setScheduleForm((current) => applyScheduleHotelAutofill({ ...current, [field]: value }));
  };

  const handleEditFieldChange = <Key extends keyof EditScheduleFormState>(
    field: Key,
    value: EditScheduleFormState[Key],
  ) => {
    setEditScheduleForm((current) => (current ? applyEditHotelAutofill({ ...current, [field]: value }) : current));
  };

  const handleOpenScheduleModal = useCallback(() => {
    scheduleSuggestedHotelNameRef.current = "";
    scheduleSuggestedFromHotelNameRef.current = "";
    setScheduleForm(applyScheduleHotelAutofill(createInitialScheduleForm()));
    setIsScheduleModalOpen(true);
  }, []);

  useEffect(() => {
    const setupAction = searchParams.get("action")?.trim().toLowerCase() ?? "";
    const setupActionKey = `${group.code}:${setupAction}`;
    if (setupAction !== "schedule" || handledSetupActionRef.current === setupActionKey) {
      return;
    }

    handledSetupActionRef.current = setupActionKey;
    handleOpenScheduleModal();
  }, [group.code, handleOpenScheduleModal, searchParams]);

  const handleCloseScheduleModal = () => {
    setIsScheduleModalOpen(false);
  };

  const handleSaveSchedule = () => {
    if (isScheduleSaveDisabled) {
      return;
    }

    const typeOption = getScheduleTypeOption(scheduleForm.category);
    const formattedDate = formatScheduleDate(scheduleForm.date);
    const nextFlightNumber = isFlightActivityType(scheduleForm.category) ? scheduleForm.flightNumber.trim() : "";
    const shouldPersistHotelName =
      scheduleForm.category === "arrival" ||
      scheduleForm.category === "city-tour" ||
      scheduleForm.category === "departure";
    const nextHotelName = shouldPersistHotelName
      ? scheduleForm.hotelName.trim() || resolveSuggestedHotelName(scheduleForm)
      : "";
    const nextFromHotelName = "";
    const nextHotelPickupRequestTime =
      scheduleForm.category === "departure" ? scheduleForm.hotelPickupRequestTime.trim() : "";
    const isTransferByTrain = isTransferActivityType(scheduleForm.category) && scheduleForm.transferByTrain;
    const scheduleTime = isTransferByTrain ? scheduleForm.trainDepartureTime : scheduleForm.time;
    const transferTrainSummary = buildTransferTrainSummary(scheduleForm);
    const nextCityTourCity = isCityTourActivityType(scheduleForm.category) ? scheduleForm.cityTourCity.trim() : "";
    const nextTitle = formatRouteSummary(scheduleForm.category, scheduleForm.from, scheduleForm.to, nextCityTourCity);
    const nextItem: ItineraryItem = {
      date: formattedDate.date,
      year: formattedDate.year,
      category: typeOption.cardLabel,
      title: nextTitle,
      meta: createScheduleMeta({
        category: scheduleForm.category,
        time: scheduleTime,
        flightNumber: nextFlightNumber,
        hotelName: nextHotelName,
        fromHotelName: nextFromHotelName,
        hotelPickupRequestTime: nextHotelPickupRequestTime,
        from: scheduleForm.from,
        to: scheduleForm.to,
        cityTourCity: nextCityTourCity,
        note: scheduleForm.note,
        transferTrainSummary,
      }),
      icon: typeOption.icon,
      highlighted: scheduleForm.highlighted,
      categoryKey: typeOption.value,
      isoDate: scheduleForm.date,
      time: scheduleTime,
      flightNumber: nextFlightNumber,
      hotelName: nextHotelName,
      fromHotelName: nextFromHotelName,
      from: scheduleForm.from.trim(),
      to: scheduleForm.to.trim(),
      cityTourCity: nextCityTourCity,
      notes: scheduleForm.note.trim(),
      requiresBus: isTransferByTrain,
      transferByTrain: isTransferByTrain,
      trainDepartureTime: isTransferByTrain ? scheduleForm.trainDepartureTime.trim() : "",
      destinationPickupTime: isTransferByTrain ? scheduleForm.destinationPickupTime.trim() : "",
      hotelPickupRequestTime: nextHotelPickupRequestTime,
    };
    const nextItems = expandTransferTrainItineraryItems([nextItem]);
    const nextItinerary = sortItineraryByNearestDate([...itineraryItems, ...nextItems]);
    setItineraryItems(nextItinerary);
    persistGroupSnapshot({ nextItinerary });

    handleCloseScheduleModal();
  };

  const handleOpenEditModal = (index: number) => {
    setEditingIndex(index);
    editSuggestedHotelNameRef.current = "";
    editSuggestedFromHotelNameRef.current = "";
    setEditScheduleForm(applyEditHotelAutofill(createEditScheduleForm(itineraryItems[index])));
  };

  const handleCloseEditModal = () => {
    setEditingIndex(null);
    editSuggestedHotelNameRef.current = "";
    editSuggestedFromHotelNameRef.current = "";
    setEditScheduleForm(null);
  };

  const handleOpenDeleteModal = (index: number) => {
    setDeletingIndex(index);
  };

  const handleCloseDeleteModal = () => {
    setDeletingIndex(null);
  };

  const handleOpenNoteModal = () => {
    setIsNoteModalOpen(true);
  };

  const handleCloseNoteModal = () => {
    setIsNoteModalOpen(false);
  };

  const handleSaveEditedSchedule = () => {
    if (editingIndex === null || !editScheduleForm || isEditSaveDisabled) {
      return;
    }

    const nextItinerary = sortItineraryByNearestDate(
      itineraryItems.flatMap((item, index) => {
        if (index !== editingIndex) {
          return [item];
        }

        const nextItem = buildItineraryItemFromEditForm(item, editScheduleForm);
        return expandTransferTrainItineraryItems([nextItem]);
      }),
    );
    setItineraryItems(nextItinerary);
    persistGroupSnapshot({ nextItinerary });

    handleCloseEditModal();
  };

  const handleConfirmDelete = () => {
    if (deletingIndex === null) {
      return;
    }

    const nextItinerary = itineraryItems.filter((_, index) => index !== deletingIndex);
    setItineraryItems(nextItinerary);
    persistGroupSnapshot({ nextItinerary });
    handleCloseDeleteModal();
  };

  const handleSaveNote = ({ text, pinned }: { text: string; pinned: boolean }) => {
    const nextNote: NoteItem = {
      id: `${group.code}-note-${Date.now()}`,
      text: text.trim(),
      pinned,
    };

    const nextNoteItems = pinned ? [nextNote, ...noteItems] : [...noteItems, nextNote];
    setNoteItems(nextNoteItems);
    persistGroupSnapshot({ nextNoteItems });

    handleCloseNoteModal();
  };

  const handleOpenMusyrifModal = () => {
    setIsMusyrifModalOpen(true);
  };

  const handleCloseMusyrifModal = () => {
    setIsMusyrifModalOpen(false);
  };

  const handleDeleteGroup = () => {
    setIsDeleteGroupModalOpen(true);
  };

  const handleCloseDeleteGroupModal = () => {
    setIsDeleteGroupModalOpen(false);
  };

  const handleConfirmDeleteGroup = () => {
    setIsDeleteGroupModalOpen(false);
    onDeleteGroup(group.code);
  };

  const handleOpenGroupEditModal = () => {
    setIsGroupEditModalOpen(true);
  };

  const handleCloseGroupEditModal = () => {
    setIsGroupEditModalOpen(false);
  };

  const handleSaveGroupEdit = ({
    code: nextGroupCode,
    name: nextGroupName,
    pax: nextPax,
    totalBuses: nextTotalBuses,
    arrivalDate: nextArrivalDate,
    returnDate: nextReturnDate,
    parentGroupId: nextParentGroupId,
  }: {
    code: string;
    name: string;
    pax: number;
    totalBuses: number;
    arrivalDate: string;
    returnDate: string;
    parentGroupId?: string | null;
  }): { ok: true } | { ok: false; message: string } => {
    const normalizedCurrentGroupCode = group.code.trim().toUpperCase();
    const normalizedCurrentGroupName = group.name.trim();
    const normalizedNextPax = Math.max(1, Math.floor(nextPax));
    const normalizedNextTotalBuses = resolveTotalBusCount(normalizedNextPax, nextTotalBuses);
    const nextDurationDays = Math.max(
      1,
      Math.floor((Date.parse(nextReturnDate) - Date.parse(nextArrivalDate)) / 86_400_000) + 1
    );

    if (
      nextGroupCode === normalizedCurrentGroupCode &&
      nextGroupName === normalizedCurrentGroupName &&
      normalizedNextPax === group.pax &&
      normalizedNextTotalBuses === requiredBusCount &&
      nextArrivalDate === group.arrivalDate &&
      nextReturnDate === group.returnDate &&
      nextParentGroupId === group.parentGroupId
    ) {
      setIsGroupEditModalOpen(false);
      return { ok: true };
    }

    const result = patchGroupSnapshot({
      nextGroupCode,
      nextGroupName,
      nextPax: normalizedNextPax,
      nextTotalBuses: normalizedNextTotalBuses,
      nextArrivalDate,
      nextReturnDate,
      nextDurationDays,
      nextParentGroupId,
    });
    if (!result.ok) {
      return result;
    }

    setIsGroupEditModalOpen(false);
    return { ok: true };
  };

  const handleOpenUnlinkModal = (childGroup: GroupData) => {
    setUnlinkingGroup(childGroup);
  };

  const handleCloseUnlinkModal = () => {
    setUnlinkingGroup(null);
  };

  const handleConfirmUnlink = () => {
    if (unlinkingGroup) {
      onPatchGroup({ ...unlinkingGroup, parentGroupId: null }, unlinkingGroup.code);
      setUnlinkingGroup(null);
    }
  };

  const handleSaveMusyrif = ({ name, phone }: { name: string; phone: string }) => {
    const nextMusyrif: Musyrif = {
      ...musyrifProfile,
      name: name.trim(),
      phone: phone.trim(),
    };
    setMusyrifProfile(nextMusyrif);
    persistGroupSnapshot({ nextMusyrif });
    handleCloseMusyrifModal();
  };

  const handleCopyMusyrif = async () => {
    const payload = [
      "*MUSYRIF DETAILS*",
      "```",
      `GROUP NUMBER : ${group.code}`,
      `GROUP NAME   : ${group.name.toUpperCase()}`,
      `MUSYRIF NAME : ${musyrifProfile.name.toUpperCase()}`,
      `PHONE NUMBER : ${musyrifProfile.phone}`,
      "```",
    ].join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      }
    } catch {
      // No-op fallback for browsers that block clipboard API.
    }

    setIsMusyrifCopied(true);
    if (musyrifCopyTimerRef.current !== null) {
      window.clearTimeout(musyrifCopyTimerRef.current);
    }

    musyrifCopyTimerRef.current = window.setTimeout(() => {
      setIsMusyrifCopied(false);
      musyrifCopyTimerRef.current = null;
    }, 1600);
  };

  const handleCopyWhatsapp = async () => {
    const text = generateWhatsappCopyText({
      ...group,
      itinerary: itineraryItems,
    }, familyGroups);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // fallback
    }

    setIsWhatsappCopied(true);
    if (whatsappCopyTimerRef.current !== null) {
      window.clearTimeout(whatsappCopyTimerRef.current);
    }
    whatsappCopyTimerRef.current = window.setTimeout(() => {
      setIsWhatsappCopied(false);
      whatsappCopyTimerRef.current = null;
    }, 1600);
  };

  const handleExportPdf = () => {
    const printableWindow = window.open("", "_blank", "width=1120,height=760");
    if (!printableWindow) {
      return;
    }

    void import("./group-detail-export")
      .then(({ exportGroupDetailPdf }) => {
        const exported = exportGroupDetailPdf(
          {
            group,
            itineraryItems,
            noteItems,
            musyrifProfile,
            familyGroups,
          },
          {
            printWindow: printableWindow,
          },
        );

        if (!exported && !printableWindow.closed) {
          printableWindow.close();
        }
      })
      .catch(() => {
        if (!printableWindow.closed) {
          printableWindow.close();
        }
      });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onBack}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">Back to Groups</span>
        </Button>

        <ThemeToggleButton className="ml-auto sm:mr-5" />
      </div>

      {group.parentGroupId && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800 flex items-center gap-3 shadow-sm">
          <span className="material-symbols-outlined text-sky-700" aria-hidden="true">info</span>
          <div>
            <strong>Grup Operasional Terhubung</strong>
            <p className="mt-0.5 text-[11px] text-sky-700 font-medium">
              Grup ini mewarisi data operasional dari Group ({groups.find((g) => g.id === group.parentGroupId || g.code === group.parentGroupId)?.code}) (Musyrif & Itinerary) secara otomatis. Anda tidak dapat mengedit data operasional di grup ini.
            </p>
          </div>
        </div>
      )}

      <header className="flex flex-col gap-4 rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Group Detail</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:w-auto">
          <Link
            to={buildVisaDetailPath(group.code)}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-3.5 py-2 text-xs font-bold text-on-primary transition hover:bg-primary-container"
          >
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              fact_check
            </span>
            <span>Visa Detail</span>
          </Link>

          <Button
            variant="secondary"
            size="sm"
            className={
              isWhatsappCopied
                ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-500/15"
                : ""
            }
            onClick={handleCopyWhatsapp}
            aria-label={`Copy WhatsApp formatted details for ${group.name}`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {isWhatsappCopied ? "check" : "content_copy"}
            </span>
            <span>{isWhatsappCopied ? "Copied" : "Copy WhatsApp"}</span>
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteGroup}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              delete
            </span>
            <span>Delete Group</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportPdf}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              picture_as_pdf
            </span>
            <span>Export to PDF</span>
          </Button>
        </div>
      </header>

      <div className="space-y-6">
        <div className="grid items-stretch gap-4 xl:grid-cols-[1.45fr_0.75fr]">
          <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="space-y-2 md:space-y-1">
                <div className="flex items-start justify-between gap-3 md:hidden">
                  <span className={detailKickerClassName}>Group Number</span>
                  <div className="flex items-center gap-2">
                    <Badge status={group.tone === "active" ? "success" : "neutral"} className="shrink-0 whitespace-nowrap">{group.status}</Badge>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-[22px] px-2 text-[11px] leading-none border-brand-primary/35 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/15"
                      onClick={handleOpenGroupEditModal}
                      aria-label={`Edit group info for ${group.name}`}
                      aria-haspopup="dialog"
                      aria-expanded={isGroupEditModalOpen}
                      aria-controls="group-edit-modal"
                    >
                      <span className="material-symbols-outlined text-[12px] leading-none" aria-hidden="true">
                        edit
                      </span>
                      <span>Edit</span>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[1.65rem] font-extrabold tracking-tight text-brand-primary sm:text-[2.05rem]">
                    {familyGroups.length > 1 ? familyGroups.map(g => g.code).join(" - ") : group.code}
                  </h2>
                  {familyGroups.length > 1 && (
                    <div className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600 sm:inline-flex ${familyGroups.length > 2 ? 'text-[10px]' : 'text-xs'}`}>
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-slate-400" aria-hidden="true">link</span>
                        <span>Terhubung:</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        {familyGroups.filter(g => g.code !== group.code).map((g, index) => (
                          <span key={g.code} className="inline-flex items-center gap-0.5">
                            {index > 0 && <span className="mr-1.5 text-slate-300">,</span>}
                            <Link to={`/groups/${g.code}`} className="font-bold text-slate-900 hover:underline">
                              {g.code}
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleOpenUnlinkModal(g)}
                              className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition"
                              title="Pisahkan grup ini"
                            >
                              <span className="material-symbols-outlined text-[13px]" aria-hidden="true">link_off</span>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Badge status={group.tone === "active" ? "success" : "neutral"} className="hidden md:inline-flex">{group.status}</Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="hidden h-[22px] shrink-0 items-center gap-1 whitespace-nowrap border-brand-primary/35 bg-brand-primary/10 px-2 text-[11px] font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15 md:inline-flex"
                    onClick={handleOpenGroupEditModal}
                    aria-label={`Edit group info for ${group.name}`}
                    aria-haspopup="dialog"
                    aria-expanded={isGroupEditModalOpen}
                    aria-controls="group-edit-modal"
                  >
                    <span className="material-symbols-outlined text-[12px] leading-none" aria-hidden="true">
                      edit
                    </span>
                    <span>Edit</span>
                  </Button>
                </div>
              </div>

              <div className="hidden h-10 w-px bg-outline-variant/35 md:block" aria-hidden="true" />

              <div className="space-y-1">
                <span className={detailKickerClassName}>Group Name</span>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-xl font-semibold text-on-surface sm:text-2xl">{group.name}</h3>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-outline-variant/35 pt-4">
              <div className="grid gap-3 sm:grid-cols-3 sm:gap-0">
                <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-3 sm:border-b-0 sm:pr-4">
                  <div>
                    <span className={detailKickerClassName}>Pilgrims</span>
                    <p className="mt-2 text-[1.7rem] font-bold leading-none text-on-surface">{totalPax}</p>
                    {familyGroups.length > 1 && (
                      <p className="mt-1.5 text-xs text-on-surface-variant/75 font-medium leading-tight">
                        Detail: {familyGroups.map(g => `${g.code} ${g.pax} pax`).join(" dan ")}
                      </p>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-xl text-on-surface-variant/70" aria-hidden="true">
                    groups
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 py-0 pb-3 sm:border-b-0 sm:border-l sm:border-outline-variant/35 sm:px-4 sm:pb-0">
                  <div>
                    <span className={detailKickerClassName}>Trip Duration</span>
                    <p className="mt-2 text-[1.7rem] font-bold leading-none text-on-surface">
                      {group.durationDays} Days
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-xl text-on-surface-variant/70" aria-hidden="true">
                    calendar_today
                  </span>
                </div>

                <div className="flex items-start justify-between gap-3 sm:border-l sm:border-outline-variant/35 sm:pl-4">
                  <div>
                    <span className={detailKickerClassName}>Required Bus</span>
                    <p className="mt-2 text-[1.7rem] font-bold leading-none text-on-surface">{requiredBusCount} Bus</p>
                  </div>
                  <span className="material-symbols-outlined text-xl text-on-surface-variant/70" aria-hidden="true">
                    directions_bus
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 border-t border-outline-variant/25 pt-3 sm:grid-cols-2">
                <div className="flex min-w-0 items-center gap-2 sm:pr-3">
                  <span className="material-symbols-outlined text-lg text-on-surface-variant/70" aria-hidden="true">
                    travel_explore
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/75">
                      Package
                    </span>
                    <p className="mt-0.5 truncate text-sm font-bold text-on-surface" title={group.packageName}>
                      {group.packageName}
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2 sm:border-l sm:border-outline-variant/35 sm:pl-3">
                  <span className="material-symbols-outlined text-lg text-on-surface-variant/70" aria-hidden="true">
                    event_available
                  </span>
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/75">
                      Period
                    </span>
                    <p className="mt-0.5 truncate text-sm font-bold text-on-surface">{formatGroupTripWindow(group)}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-4 shadow-ambient sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className={detailKickerClassName}>Assigned Musyrif</p>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className={
                    isMusyrifCopied
                      ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-500/15"
                      : ""
                  }
                  onClick={handleCopyMusyrif}
                  aria-label={`Copy musyrif data for ${group.name}`}
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {isMusyrifCopied ? "check" : "content_copy"}
                  </span>
                  <span>{isMusyrifCopied ? "Copied" : "Copy"}</span>
                </Button>
                {isMusyrifCopied ? (
                  <p className="sr-only" role="status" aria-live="polite">
                    Musyrif data copied.
                  </p>
                ) : null}

                {!group.parentGroupId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="border-brand-primary/35 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/15"
                    onClick={handleOpenMusyrifModal}
                    aria-label={`Edit musyrif data for ${group.name}`}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      edit
                    </span>
                    <span>Edit</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 flex min-w-0 items-center gap-3">
              <div className="relative">
                <div className="h-12 w-12 overflow-hidden rounded-2xl ring-2 ring-brand-primary/20">
                  <img src={musyrifProfile.avatar} alt={musyrifProfile.name} className="h-full w-full object-cover" />
                </div>
                <span
                  className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest bg-brand-primary"
                  aria-hidden="true"
                />
              </div>

              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-on-surface">{musyrifProfile.name}</h3>
                <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    call
                  </span>
                  <span>{musyrifProfile.phone}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 border-t border-outline-variant/30 pt-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-on-surface-variant/75" aria-hidden="true">
                    hotel
                  </span>
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/75">
                    Agreement Hotel
                  </p>
                </div>
                <Link
                  to={buildVisaDetailPath(group.code)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-primary transition hover:text-brand-primary/75"
                >
                  <span>Detail</span>
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                    fact_check
                  </span>
                </Link>
              </div>

              <div className="mt-2 divide-y divide-outline-variant/25">
                {compactAgreementSummaries.map((summary) => (
                  <div key={summary.city} className="py-2 first:pt-0 last:pb-0">
                    <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge
                          status={summary.isMissing ? "error" : "success"}
                          className="h-6 min-w-[4.75rem] justify-center rounded-lg px-2 font-extrabold uppercase tracking-[0.08em] border-none"
                        >
                          {summary.cityLabel}
                        </Badge>
                        <p className="truncate font-bold text-on-surface" title={summary.primaryHotelLabel}>
                          {summary.primaryHotelLabel}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[11px] font-bold ${
                          summary.isMissing ? "text-brand-tertiary" : "text-on-surface-variant"
                        }`}
                      >
                        {summary.paxLabel}
                      </span>
                    </div>
                    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-[5.25rem] text-[11px] font-medium text-on-surface-variant">
                      <span className="truncate">{summary.hotelLabel}</span>
                      <span className="text-on-surface-variant/40" aria-hidden="true">
                        |
                      </span>
                      <span className="truncate">{summary.stayLabel}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {!completeness.isReadyForOperations ? (
          <section
            className="rounded-2xl border border-tertiary-fixed/65 bg-tertiary-fixed/70 px-4 py-3 text-on-tertiary-fixed-variant shadow-ambient"
            aria-label="Group completion status"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-brand-primary"
                  aria-hidden="true"
                >
                  <span className="material-symbols-outlined text-lg">
                    pending_actions
                  </span>
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">Workspace Status:</span>
                    <strong className="text-sm font-extrabold tracking-tight">{completeness.badgeLabel}</strong>
                  </div>
                  <p className="text-xs text-on-tertiary-fixed-variant/90 leading-tight mt-0.5">{completeness.primaryMessage}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {completeness.issues.map((issue) => (
                    <Badge
                      key={issue.key}
                      status="neutral"
                      className="rounded bg-surface-container-lowest/70 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.05em] border-none"
                      title={issue.message}
                    >
                      {issue.label}
                    </Badge>
                  ))}
                </div>

                {(shouldShowLinkAgreementAction || shouldShowCreateItineraryAction) && (
                  <div className="flex items-center gap-1.5 lg:border-l lg:border-on-tertiary-fixed-variant/15 lg:pl-3">
                    {shouldShowLinkAgreementAction ? (
                      <Link
                        to={`/agreement-inbox?groupCode=${encodeURIComponent(group.code)}`}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-on-tertiary-fixed-variant/20 bg-surface-container-lowest px-2.5 text-xs font-bold text-brand-primary transition hover:bg-surface-container-low"
                      >
                        <span className="material-symbols-outlined text-xs" aria-hidden="true">
                          link
                        </span>
                        <span>Link Agreement</span>
                      </Link>
                    ) : null}

                    {shouldShowCreateItineraryAction ? (
                      <Link
                        to={buildGroupItineraryBuilderPath(group.code)}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-2.5 text-xs font-bold text-on-primary transition hover:bg-primary-container"
                      >
                        <span className="material-symbols-outlined text-xs" aria-hidden="true">
                          add_circle
                        </span>
                        <span>Build Itinerary</span>
                      </Link>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
          <div className="space-y-4">
            <section className="relative overflow-hidden rounded-3xl border border-brand-primary/20 bg-brand-primary p-5 shadow-ambient">
              <div className="absolute -right-3 top-0 opacity-20" aria-hidden="true">
                <span className="material-symbols-outlined text-[6rem] text-brand-neutral">
                  {displayedNextActivity.icon}
                </span>
              </div>

              <div className="relative z-10">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-on-primary/80">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    near_me
                  </span>
                  <p>Next Activity</p>
                </div>

                <h3 className="mt-2 text-[1.5rem] font-bold tracking-tight text-on-primary sm:text-[2rem]">
                  {displayedNextActivity.title}
                </h3>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-on-primary">
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-brand-primary/15 bg-surface-container-lowest px-2.5 py-1 text-brand-primary shadow-sm">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      event
                    </span>
                    <span>{displayedNextActivity.date}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-brand-primary/15 bg-surface-container-lowest px-2.5 py-1 text-brand-primary shadow-sm">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      schedule
                    </span>
                    <span>{formatScheduleTime(displayedNextActivity.time)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-on-surface sm:text-2xl">Full Itinerary</h3>
                  <p className="mt-1 text-sm text-on-surface-variant">
                    <span className="sm:hidden">Timeline and key milestones.</span>
                    <span className="hidden sm:inline">Journey timeline and key milestones</span>
                  </p>
                </div>

                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg px-1 text-sm font-bold leading-none text-brand-primary transition hover:text-brand-primary/80"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    expand_more
                  </span>
                  <span className="sm:hidden">All Days</span>
                  <span className="hidden sm:inline">View All Days</span>
                </button>
              </div>

              {group.parentGroupId && (
                <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800 flex items-center gap-3 shadow-xs">
                  <span className="material-symbols-outlined text-base text-sky-700" aria-hidden="true">info</span>
                  <div>
                    <strong>Data Itinerary Terhubung</strong>
                    <p className="mt-0.5 text-[11px] text-sky-600 font-medium">
                      Grup ini mewarisi itinerary bersama dari Group Utama ({groups.find((g) => g.id === group.parentGroupId || g.code === group.parentGroupId)?.code}). Edit itinerary di halaman Group Utama tersebut.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {itineraryItems.map((item, index) => {
                  const categoryKey = inferCategoryKey(item);
                  const typeOption = getScheduleTypeOption(categoryKey);
                  const activityHeading = formatItineraryActivityHeading(item, categoryKey, typeOption.cardLabel);
                  const compactSummary = formatItineraryCompactSummary(item, categoryKey);
                  const supportMeta = formatItinerarySupportMeta(item, categoryKey);

                  return (
                    <article
                      key={`${group.code}-${index}-${item.date}`}
                      className={`rounded-2xl border bg-surface-container-lowest p-4 ${
                        item.highlighted ? "border-brand-primary/40" : "border-outline-variant/45"
                      }`}
                    >
                      <div className="md:hidden">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex min-w-[74px] flex-col rounded-xl bg-surface-container-high/60 px-2.5 py-2 text-center">
                              <strong className="text-base font-bold leading-tight text-brand-primary">
                                {item.date}
                              </strong>
                              <span className="text-[11px] font-medium text-on-surface-variant/80">{item.year}</span>
                            </div>

                            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/12 text-brand-primary">
                              <span className="material-symbols-outlined" aria-hidden="true">
                                {typeOption.icon}
                              </span>
                            </div>
                          </div>

                          {!group.parentGroupId && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/80 transition hover:bg-brand-primary/10 hover:text-brand-primary"
                                aria-label={`Edit ${item.title}`}
                                onClick={() => handleOpenEditModal(index)}
                              >
                                <span className="material-symbols-outlined" aria-hidden="true">
                                  edit
                                </span>
                              </button>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/80 transition hover:bg-brand-tertiary/12 hover:text-brand-tertiary"
                                aria-label={`Delete ${item.title}`}
                                onClick={() => handleOpenDeleteModal(index)}
                              >
                                <span className="material-symbols-outlined" aria-hidden="true">
                                  delete
                                </span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 min-w-0">
                          <h4 className="text-[1.2rem] font-semibold leading-tight text-on-surface">
                            {activityHeading}
                          </h4>
                          <p className="mt-1 text-sm text-on-surface-variant">{compactSummary}</p>
                          {supportMeta ? (
                            <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                              {supportMeta}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="hidden gap-3 md:grid md:grid-cols-[78px_42px_1fr_auto] md:items-center">
                        <div className="flex flex-col px-1 text-center">
                          <strong className="text-lg font-bold leading-tight text-brand-primary">{item.date}</strong>
                          <span className="text-[11px] font-medium text-on-surface-variant/80">{item.year}</span>
                        </div>

                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary/12 text-brand-primary">
                          <span className="material-symbols-outlined" aria-hidden="true">
                            {typeOption.icon}
                          </span>
                        </div>

                        <div className="min-w-0">
                          <h4 className="text-[1.18rem] font-semibold leading-tight text-on-surface">
                            {activityHeading}
                          </h4>
                          <p className="mt-1 text-sm text-on-surface-variant">{compactSummary}</p>
                          {supportMeta ? (
                            <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                              {supportMeta}
                            </span>
                          ) : null}
                        </div>

                        {!group.parentGroupId && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/80 transition hover:bg-brand-primary/10 hover:text-brand-primary"
                              aria-label={`Edit ${item.title}`}
                              onClick={() => handleOpenEditModal(index)}
                            >
                              <span className="material-symbols-outlined" aria-hidden="true">
                                edit
                              </span>
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant/80 transition hover:bg-brand-tertiary/12 hover:text-brand-tertiary"
                              aria-label={`Delete ${item.title}`}
                              onClick={() => handleOpenDeleteModal(index)}
                            >
                              <span className="material-symbols-outlined" aria-hidden="true">
                                delete
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}

                {!group.parentGroupId && (
                  <button
                    type="button"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-primary/35 bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10 md:text-base"
                    onClick={handleOpenScheduleModal}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      add_circle
                    </span>
                    <span>Add Schedule</span>
                  </button>
                )}
              </div>
            </section>
          </div>

          <aside className="xl:self-start">
            <section className="rounded-3xl border border-brand-tertiary/25 bg-brand-tertiary/[0.08] p-5 shadow-ambient">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-brand-tertiary" aria-hidden="true">
                  sticky_note_2
                </span>
                <h3 className="text-lg font-bold text-brand-tertiary">Important Notes</h3>
              </div>

              <ul className="mt-3 space-y-2">
                {noteItems.map((note) => (
                  <li
                    key={note.id}
                    className={`rounded-xl border px-3 py-2 ${note.pinned ? "border-brand-tertiary/35 bg-brand-neutral" : "border-brand-tertiary/25 bg-brand-neutral"}`}
                  >
                    <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-tertiary" aria-hidden="true" />
                    <div className="inline">
                      <p className="inline text-sm text-on-surface-variant">{note.text}</p>
                      {note.pinned ? (
                        <Badge
                          status="error"
                          className="ml-2 px-2 py-0.5 text-[11px] font-bold leading-none rounded-lg border-none"
                        >
                          Pinned
                        </Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              {!group.parentGroupId && (
                <button
                  type="button"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-dashed border-brand-tertiary/55 bg-brand-neutral px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.08em] text-brand-tertiary transition hover:bg-brand-tertiary/12"
                  onClick={handleOpenNoteModal}
                >
                  <span className="sm:hidden">Add Note</span>
                  <span className="hidden sm:inline">Add New Note</span>
                </button>
              )}
            </section>
          </aside>
        </div>

        <footer className="rounded-2xl border border-outline-variant/45 bg-surface-container-lowest p-3 text-center text-xs font-medium text-on-surface-variant/80">
          <p>
            <span className="sm:hidden">GTT Operations Desk</span>
            <span className="hidden sm:inline">Ghaniya Tour and Travel Management System | GTT Operations Desk</span>
          </p>
        </footer>
      </div>

      {hasOpenModal ? (
        <Suspense fallback={<GroupDetailModalFallback />}>
          {isScheduleModalOpen ? (
            <LazyScheduleModal
              form={scheduleForm}
              isSaveDisabled={isScheduleSaveDisabled}
              showFridayCityTourWarning={showScheduleFridayCityTourWarning}
              onChange={handleScheduleFieldChange}
              onClose={handleCloseScheduleModal}
              onSave={handleSaveSchedule}
            />
          ) : null}

          {isMusyrifModalOpen ? (
            <LazyMusyrifModal
              initialValues={{
                name: musyrifProfile.name,
                phone: musyrifProfile.phone,
              }}
              onClose={handleCloseMusyrifModal}
              onSave={handleSaveMusyrif}
            />
          ) : null}

          {isEditModalOpen && editScheduleForm ? (
            <LazyEditScheduleModal
              form={editScheduleForm}
              isSaveDisabled={isEditSaveDisabled}
              showFridayCityTourWarning={showEditFridayCityTourWarning}
              onChange={handleEditFieldChange}
              onClose={handleCloseEditModal}
              onSave={handleSaveEditedSchedule}
            />
          ) : null}

          {isDeleteModalOpen && deletingItem ? (
            <LazyDeleteConfirmModal
              item={deletingItem}
              onClose={handleCloseDeleteModal}
              onConfirm={handleConfirmDelete}
            />
          ) : null}

          {isDeleteGroupModalOpen ? (
            <LazyDeleteGroupModal
              groupCode={group.code}
              groupName={group.name}
              childGroupCount={childGroupCount}
              onClose={handleCloseDeleteGroupModal}
              onConfirm={handleConfirmDeleteGroup}
            />
          ) : null}

          {isGroupEditModalOpen ? (
            <LazyGroupEditModal
              groupCode={group.code}
              groupName={group.name}
              groupPax={group.pax}
              requiredBusCount={requiredBusCount}
              arrivalDate={group.arrivalDate ?? ""}
              returnDate={group.returnDate ?? ""}
              parentGroupId={group.parentGroupId}
              groups={groups}
              onClose={handleCloseGroupEditModal}
              onSave={handleSaveGroupEdit}
            />
          ) : null}

          {isUnlinkModalOpen && unlinkingGroup ? (
            <LazyUnlinkGroupConfirmModal
              groupCode={unlinkingGroup.code}
              onClose={handleCloseUnlinkModal}
              onConfirm={handleConfirmUnlink}
            />
          ) : null}

          {isNoteModalOpen ? <LazyNoteModal onClose={handleCloseNoteModal} onSave={handleSaveNote} /> : null}
        </Suspense>
      ) : null}
    </div>
  );
}
