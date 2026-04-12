import { useEffect, useMemo, useRef, useState } from "react";
import * as GroupDomain from "../features/groups/domain";
import {
  DeleteConfirmModal,
  DeleteGroupModal,
  EditScheduleModal,
  GroupEditModal,
  MusyrifModal,
  NoteModal,
  ScheduleModal,
} from "../components/group-detail-modals";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { exportGroupDetailPdf } from "./group-detail-export";
import type {
  EditScheduleFormState,
  GroupData,
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
  formatScheduleTime,
  formatRouteSummary,
  formatScheduleDate,
  getScheduleTypeOption,
  hasIncompleteTransferTrainFields,
  inferCategoryKey,
  inferCityTourCity,
  isCityTourActivityType,
  isFlightActivityType,
  isTransferActivityType,
  normalizeAgreementCityKey,
  parseTimeForInput,
  shouldShowFridayCityTourWarning,
} = GroupDomain;

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
  const upcomingItinerary = sortedItinerary.filter((item) =>
    isItineraryDateOnOrAfterToday(item, todayStartMs),
  );
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

function formatItineraryActivityHeading(
  item: ItineraryItem,
  categoryKey: string,
  fallbackLabel: string,
): string {
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
    (categoryKey === "transfer"
      ? inferredToHotelName
      : inferredFromHotelName || inferredToHotelName);
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
  } else if (
    (categoryKey === "arrival" || categoryKey === "city-tour" || categoryKey === "departure") &&
    hotelName
  ) {
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

export function GroupDetail({
  group,
  onBack,
  onDeleteGroup,
  onSaveGroup,
}: {
  group: GroupData;
  onBack: () => void;
  onDeleteGroup: (groupCode: string) => void;
  onSaveGroup: (
    group: GroupData,
    sourceGroupCode?: string,
  ) => { ok: true } | { ok: false; message: string };
}) {
  const [itineraryItems, setItineraryItems] = useState(() => sortItineraryByNearestDate(group.itinerary));
  const [noteItems, setNoteItems] = useState<NoteItem[]>(() => createNoteItems(group.notes, group.code));
  const [musyrifProfile, setMusyrifProfile] = useState<Musyrif>(group.musyrif);
  const [isMusyrifModalOpen, setIsMusyrifModalOpen] = useState(false);
  const [isMusyrifCopied, setIsMusyrifCopied] = useState(false);
  const musyrifCopyTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormState>(createInitialScheduleForm);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editScheduleForm, setEditScheduleForm] = useState<EditScheduleFormState | null>(null);
  const scheduleSuggestedHotelNameRef = useRef("");
  const scheduleSuggestedFromHotelNameRef = useRef("");
  const editSuggestedHotelNameRef = useRef("");
  const editSuggestedFromHotelNameRef = useRef("");
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
  const [isGroupEditModalOpen, setIsGroupEditModalOpen] = useState(false);
  const isEditModalOpen = editingIndex !== null && editScheduleForm !== null;
  const deletingItem = deletingIndex !== null ? itineraryItems[deletingIndex] ?? null : null;
  const isDeleteModalOpen = deletingItem !== null;
  const hasOpenModal =
    isScheduleModalOpen ||
    isEditModalOpen ||
    isDeleteModalOpen ||
    isNoteModalOpen ||
    isMusyrifModalOpen ||
    isDeleteGroupModalOpen ||
    isGroupEditModalOpen;

  useEffect(() => {
    scheduleSuggestedHotelNameRef.current = "";
    scheduleSuggestedFromHotelNameRef.current = "";
    editSuggestedHotelNameRef.current = "";
    editSuggestedFromHotelNameRef.current = "";
    setItineraryItems(sortItineraryByNearestDate(group.itinerary));
    setNoteItems(createNoteItems(group.notes, group.code));
    setMusyrifProfile(group.musyrif);
    setIsMusyrifCopied(false);
    setIsMusyrifModalOpen(false);
    setIsScheduleModalOpen(false);
    setScheduleForm(applyScheduleHotelAutofill(createInitialScheduleForm()));
    setEditingIndex(null);
    setEditScheduleForm(null);
    setDeletingIndex(null);
    setIsNoteModalOpen(false);
    setIsDeleteGroupModalOpen(false);
    setIsGroupEditModalOpen(false);
  }, [group.code, group.itinerary, group.name, group.notes, group.musyrif]);

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
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [hasOpenModal]);

  useEffect(() => () => {
    if (musyrifCopyTimerRef.current !== null) {
      window.clearTimeout(musyrifCopyTimerRef.current);
      musyrifCopyTimerRef.current = null;
    }
  }, []);

  const isScheduleFlightNumberMissing =
    isFlightActivityType(scheduleForm.category) && !scheduleForm.flightNumber.trim();
  const isScheduleHotelNameMissing =
    (scheduleForm.category === "arrival" ||
      scheduleForm.category === "transfer" ||
      scheduleForm.category === "departure") &&
    !scheduleForm.hotelName.trim();
  const isScheduleFromHotelNameMissing =
    scheduleForm.category === "transfer" && !scheduleForm.fromHotelName.trim();
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
    !!editScheduleForm &&
    isCityTourActivityType(editScheduleForm.category) &&
    !editScheduleForm.cityTourCity.trim();
  const isEditHotelNameMissing =
    !!editScheduleForm &&
    (editScheduleForm.category === "arrival" ||
      editScheduleForm.category === "transfer" ||
      editScheduleForm.category === "departure") &&
    !editScheduleForm.hotelName.trim();
  const isEditFromHotelNameMissing =
    !!editScheduleForm &&
    editScheduleForm.category === "transfer" &&
    !editScheduleForm.fromHotelName.trim();
  const isEditDeparturePickupTimeMissing =
    !!editScheduleForm &&
    editScheduleForm.category === "departure" &&
    !editScheduleForm.hotelPickupRequestTime.trim();
  const isEditDepartureFlightTimeMissing =
    !!editScheduleForm &&
    editScheduleForm.category === "departure" &&
    !editScheduleForm.time.trim();
  const isEditSaveDisabled =
    !editScheduleForm?.date ||
    !editScheduleForm?.from.trim() ||
    !editScheduleForm?.to.trim() ||
    isEditCityTourCityMissing ||
    isEditHotelNameMissing ||
    isEditFromHotelNameMissing ||
    !!(
      editScheduleForm &&
      isFlightActivityType(editScheduleForm.category) &&
      !editScheduleForm.flightNumber.trim()
    ) ||
    isEditDepartureFlightTimeMissing ||
    isEditDeparturePickupTimeMissing ||
    hasEditTransferTrainFieldsMissing;
  const showScheduleFridayCityTourWarning = shouldShowFridayCityTourWarning(
    scheduleForm.category,
    scheduleForm.date,
  );
  const showEditFridayCityTourWarning =
    !!editScheduleForm &&
    shouldShowFridayCityTourWarning(editScheduleForm.category, editScheduleForm.date);
  const cityHotelNames = useMemo(() => {
    const firstMakkahHotel = group.visaSetup?.makkahHotels[0]?.hotelName?.trim() ?? "";
    const firstMadinahHotel = group.visaSetup?.madinahHotels[0]?.hotelName?.trim() ?? "";
    return {
      makkah: firstMakkahHotel,
      madinah: firstMadinahHotel,
    };
  }, [group.visaSetup?.makkahHotels, group.visaSetup?.madinahHotels]);

  const resolveHotelNameByCity = (cityInput: string): string => {
    const cityKey = normalizeAgreementCityKey(cityInput);
    if (!cityKey) {
      return "";
    }

    return cityHotelNames[cityKey]?.trim() ?? "";
  };

  const resolveSuggestedHotelName = (draft: {
    category: string;
    from: string;
    to: string;
    cityTourCity: string;
  }): string => {
    if (draft.category === "departure") {
      return resolveHotelNameByCity(draft.from);
    }

    if (draft.category === "arrival" || draft.category === "transfer") {
      return resolveHotelNameByCity(draft.to);
    }

    if (draft.category === "city-tour") {
      return resolveHotelNameByCity(draft.cityTourCity);
    }

    return "";
  };

  const resolveSuggestedFromHotelName = (draft: {
    category: string;
    from: string;
  }): string => {
    if (draft.category !== "transfer") {
      return "";
    }

    return resolveHotelNameByCity(draft.from);
  };

  const applyScheduleHotelAutofill = (draft: ScheduleFormState): ScheduleFormState => {
    const suggestedHotelName = resolveSuggestedHotelName(draft).trim();
    const suggestedFromHotelName = resolveSuggestedFromHotelName(draft).trim();
    const previousSuggestedHotelName = scheduleSuggestedHotelNameRef.current;
    const previousSuggestedFromHotelName = scheduleSuggestedFromHotelNameRef.current;
    const normalizedFrom = draft.from.trim().toLowerCase();
    const isPlainCityMeetingPoint =
      normalizedFrom === "makkah" || normalizedFrom === "madinah";
    const currentHotelName = draft.hotelName.trim();
    const currentFromHotelName = draft.fromHotelName.trim();
    const shouldRefreshHotelName =
      !currentHotelName ||
      (!!previousSuggestedHotelName && currentHotelName === previousSuggestedHotelName);
    const shouldRefreshFromHotelName =
      !currentFromHotelName ||
      (!!previousSuggestedFromHotelName &&
        currentFromHotelName === previousSuggestedFromHotelName);
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
  };

  const applyEditHotelAutofill = (draft: EditScheduleFormState): EditScheduleFormState => {
    const suggestedHotelName = resolveSuggestedHotelName(draft).trim();
    const suggestedFromHotelName = resolveSuggestedFromHotelName(draft).trim();
    const previousSuggestedHotelName = editSuggestedHotelNameRef.current;
    const previousSuggestedFromHotelName = editSuggestedFromHotelNameRef.current;
    const normalizedFrom = draft.from.trim().toLowerCase();
    const isPlainCityMeetingPoint =
      normalizedFrom === "makkah" || normalizedFrom === "madinah";
    const currentHotelName = draft.hotelName.trim();
    const currentFromHotelName = draft.fromHotelName.trim();
    const shouldRefreshHotelName =
      !currentHotelName ||
      (!!previousSuggestedHotelName && currentHotelName === previousSuggestedHotelName);
    const shouldRefreshFromHotelName =
      !currentFromHotelName ||
      (!!previousSuggestedFromHotelName &&
        currentFromHotelName === previousSuggestedFromHotelName);
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
  };
  const detailKickerClassName =
    "text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant/80";
  const statusToneClassName =
    group.tone === "active"
      ? "border-brand-primary/30 bg-brand-primary/10 text-brand-primary"
      : "border-outline-variant/60 bg-surface-container-high text-on-surface-variant";
  const statusBadgeClassName = `inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${statusToneClassName}`;
  const displayedNextActivity = useMemo(
    () => resolveNextActivityFromItinerary(itineraryItems, group.nextActivity),
    [itineraryItems, group.nextActivity],
  );

  const persistGroupSnapshot = ({
    nextItinerary = itineraryItems,
    nextNoteItems = noteItems,
    nextMusyrif = musyrifProfile,
    nextGroupName = group.name,
    nextGroupCode = group.code,
  }: {
    nextItinerary?: ItineraryItem[];
    nextNoteItems?: NoteItem[];
    nextMusyrif?: Musyrif;
    nextGroupName?: string;
    nextGroupCode?: string;
  }): { ok: true } | { ok: false; message: string } => {
    const normalizedItinerary = sortItineraryByNearestDate(nextItinerary);
    const nextGroup: GroupData = {
      ...group,
      code: nextGroupCode.trim().toUpperCase(),
      name: nextGroupName.trim(),
      nextActivity: resolveNextActivityFromItinerary(normalizedItinerary, group.nextActivity),
      itinerary: normalizedItinerary,
      notes: nextNoteItems.map((item) => item.text),
      musyrif: nextMusyrif,
    };
    return onSaveGroup(nextGroup, group.code);
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
    setEditScheduleForm((current) =>
      current ? applyEditHotelAutofill({ ...current, [field]: value }) : current,
    );
  };

  const handleOpenScheduleModal = () => {
    scheduleSuggestedHotelNameRef.current = "";
    scheduleSuggestedFromHotelNameRef.current = "";
    setScheduleForm(applyScheduleHotelAutofill(createInitialScheduleForm()));
    setIsScheduleModalOpen(true);
  };

  const handleCloseScheduleModal = () => {
    setIsScheduleModalOpen(false);
  };

  const handleSaveSchedule = () => {
    if (isScheduleSaveDisabled) {
      return;
    }

    const typeOption = getScheduleTypeOption(scheduleForm.category);
    const formattedDate = formatScheduleDate(scheduleForm.date);
    const nextFlightNumber = isFlightActivityType(scheduleForm.category)
      ? scheduleForm.flightNumber.trim()
      : "";
    const shouldPersistHotelName =
      scheduleForm.category === "arrival" ||
      scheduleForm.category === "transfer" ||
      scheduleForm.category === "city-tour" ||
      scheduleForm.category === "departure";
    const isTransferCategory = isTransferActivityType(scheduleForm.category);
    const nextHotelName = shouldPersistHotelName
      ? scheduleForm.hotelName.trim() || resolveSuggestedHotelName(scheduleForm)
      : "";
    const nextFromHotelName = isTransferCategory
      ? scheduleForm.fromHotelName.trim() || resolveSuggestedFromHotelName(scheduleForm)
      : "";
    const nextHotelPickupRequestTime =
      scheduleForm.category === "departure" ? scheduleForm.hotelPickupRequestTime.trim() : "";
    const isTransferByTrain =
      isTransferActivityType(scheduleForm.category) && scheduleForm.transferByTrain;
    const scheduleTime = isTransferByTrain ? scheduleForm.trainDepartureTime : scheduleForm.time;
    const transferTrainSummary = buildTransferTrainSummary(scheduleForm);
    const nextCityTourCity = isCityTourActivityType(scheduleForm.category)
      ? scheduleForm.cityTourCity.trim()
      : "";
    const nextTitle = formatRouteSummary(
      scheduleForm.category,
      scheduleForm.from,
      scheduleForm.to,
      nextCityTourCity,
    );
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

    const nextItinerary = sortItineraryByNearestDate(itineraryItems.flatMap((item, index) => {
      if (index !== editingIndex) {
        return [item];
      }

      const nextItem = buildItineraryItemFromEditForm(item, editScheduleForm);
      return expandTransferTrainItineraryItems([nextItem]);
    }));
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
  }: {
    code: string;
    name: string;
  }): { ok: true } | { ok: false; message: string } => {
    const normalizedCurrentGroupCode = group.code.trim().toUpperCase();
    const normalizedCurrentGroupName = group.name.trim();

    if (nextGroupCode === normalizedCurrentGroupCode && nextGroupName === normalizedCurrentGroupName) {
      setIsGroupEditModalOpen(false);
      return { ok: true };
    }

    const result = persistGroupSnapshot({ nextGroupCode, nextGroupName });
    if (!result.ok) {
      return result;
    }

    setIsGroupEditModalOpen(false);
    return { ok: true };
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

  const handleExportPdf = () => {
    exportGroupDetailPdf({
      group,
      itineraryItems,
      noteItems,
      musyrifProfile,
    });
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-24 pt-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-1.5 text-sm font-bold leading-none text-on-surface-variant shadow-ambient transition hover:border-primary/45 hover:text-primary"
          onClick={onBack}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            arrow_back
          </span>
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">Back to Groups</span>
        </button>

        <ThemeToggleButton className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:border-primary/45 hover:text-primary sm:mr-5" />
      </div>

      <header className="flex flex-col gap-4 rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient backdrop-blur md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface sm:text-3xl">Group Detail</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            <span className="sm:hidden">Complete itinerary for {group.name}.</span>
            <span className="hidden sm:inline">View complete itinerary and group information for {group.name}.</span>
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 self-stretch md:w-auto md:self-start">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-tertiary/40 bg-brand-tertiary/10 px-3 py-2 text-sm font-semibold text-brand-tertiary transition hover:bg-brand-tertiary/15 sm:w-auto"
            onClick={handleDeleteGroup}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              delete
            </span>
            <span className="sm:hidden">Delete</span>
            <span className="hidden sm:inline">Delete Group</span>
          </button>

          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-on-surface-variant transition hover:border-primary/45 hover:text-primary sm:w-auto"
            onClick={handleExportPdf}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              picture_as_pdf
            </span>
            <span className="sm:hidden">Export PDF</span>
            <span className="hidden sm:inline">Export to PDF</span>
          </button>
        </div>
      </header>

      <div className="space-y-6">
        <div className="grid gap-4 xl:grid-cols-[1.45fr_0.75fr]">
          <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="space-y-2 md:space-y-1">
                <div className="flex items-start justify-between gap-3 md:hidden">
                  <span className={detailKickerClassName}>Group Number</span>
                  <div className="flex items-center gap-2">
                    <span className={`${statusBadgeClassName} shrink-0 whitespace-nowrap`}>{group.status}</span>
                    <button
                      type="button"
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-brand-primary/35 bg-brand-primary/10 px-2.5 py-1 text-xs font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15"
                      onClick={handleOpenGroupEditModal}
                      aria-label={`Edit group info for ${group.name}`}
                      aria-haspopup="dialog"
                      aria-expanded={isGroupEditModalOpen}
                      aria-controls="group-edit-modal"
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                        edit
                      </span>
                      <span>Edit</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[1.65rem] font-extrabold tracking-tight text-brand-primary sm:text-[2.05rem]">
                    {group.code}
                  </h2>
                  <span className={`${statusBadgeClassName} hidden md:inline-flex`}>{group.status}</span>
                  <button
                    type="button"
                    className="hidden shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-brand-primary/35 bg-brand-primary/10 px-2.5 py-1 text-xs font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15 md:inline-flex"
                    onClick={handleOpenGroupEditModal}
                    aria-label={`Edit group info for ${group.name}`}
                    aria-haspopup="dialog"
                    aria-expanded={isGroupEditModalOpen}
                    aria-controls="group-edit-modal"
                  >
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      edit
                    </span>
                    <span>Edit</span>
                  </button>
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

            <div className="mt-4 flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-high px-2.5 py-1 text-xs font-bold leading-none text-on-surface-variant">
                <span className="material-symbols-outlined" aria-hidden="true">
                  groups
                </span>
                <span>{group.pax} Pilgrims</span>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-high px-2.5 py-1 text-xs font-bold leading-none text-on-surface-variant">
                <span className="material-symbols-outlined" aria-hidden="true">
                  calendar_today
                </span>
                <span>{group.durationDays} Days</span>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient">
            <div className="flex items-start justify-between gap-3">
              <p className={detailKickerClassName}>Assigned Musyrif</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-2.5 py-1 text-xs font-bold leading-none text-on-surface-variant transition hover:border-primary/45 hover:text-primary"
                  onClick={handleCopyMusyrif}
                  aria-label={`Copy musyrif data for ${group.name}`}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    {isMusyrifCopied ? "check" : "content_copy"}
                  </span>
                  <span>{isMusyrifCopied ? "Copied" : "Copy"}</span>
                </button>

                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-primary/35 bg-brand-primary/10 px-2.5 py-1 text-xs font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15"
                  onClick={handleOpenMusyrifModal}
                  aria-label={`Edit musyrif data for ${group.name}`}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    edit
                  </span>
                  <span>Edit</span>
                </button>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="relative">
                <div className="h-14 w-14 overflow-hidden rounded-2xl ring-2 ring-brand-primary/20">
                  <img src={musyrifProfile.avatar} alt={musyrifProfile.name} className="h-full w-full object-cover" />
                </div>
                <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest bg-brand-primary" aria-hidden="true" />
              </div>

              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold text-on-surface">{musyrifProfile.name}</h3>
                <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined" aria-hidden="true">
                    call
                  </span>
                  <span>{musyrifProfile.phone}</span>
                </div>
              </div>
            </div>
          </section>
        </div>

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
                              <strong className="text-base font-bold leading-tight text-brand-primary">{item.date}</strong>
                              <span className="text-[11px] font-medium text-on-surface-variant/80">{item.year}</span>
                            </div>

                            <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary/12 text-brand-primary">
                              <span className="material-symbols-outlined" aria-hidden="true">
                                {typeOption.icon}
                              </span>
                            </div>
                          </div>

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
                        </div>

                        <div className="mt-3 min-w-0">
                          <h4 className="text-[1.2rem] font-semibold leading-tight text-on-surface">{activityHeading}</h4>
                          <p className="mt-1 text-sm text-on-surface-variant">{compactSummary}</p>
                          {supportMeta ? (
                            <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{supportMeta}</span>
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
                          <h4 className="text-[1.18rem] font-semibold leading-tight text-on-surface">{activityHeading}</h4>
                          <p className="mt-1 text-sm text-on-surface-variant">{compactSummary}</p>
                          {supportMeta ? (
                            <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{supportMeta}</span>
                          ) : null}
                        </div>

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
                      </div>
                    </article>
                  );
                })}

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
              </div>
            </section>
          </div>

          <aside>
            <section className="rounded-3xl border border-brand-tertiary/25 bg-brand-tertiary/[0.08] p-5 shadow-ambient xl:sticky xl:top-24">
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
                      {note.pinned ? <span className="ml-2 inline-flex rounded-lg border border-brand-tertiary/30 bg-brand-tertiary/20 px-2 py-0.5 text-[11px] font-bold leading-none text-brand-tertiary">Pinned</span> : null}
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-dashed border-brand-tertiary/55 bg-brand-neutral px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.08em] text-brand-tertiary transition hover:bg-brand-tertiary/12"
                onClick={handleOpenNoteModal}
              >
                <span className="sm:hidden">Add Note</span>
                <span className="hidden sm:inline">Add New Note</span>
              </button>
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

      {isScheduleModalOpen ? (
        <ScheduleModal
          form={scheduleForm}
          isSaveDisabled={isScheduleSaveDisabled}
          showFridayCityTourWarning={showScheduleFridayCityTourWarning}
          onChange={handleScheduleFieldChange}
          onClose={handleCloseScheduleModal}
          onSave={handleSaveSchedule}
        />
      ) : null}

      {isMusyrifModalOpen ? (
        <MusyrifModal
          initialValues={{
            name: musyrifProfile.name,
            phone: musyrifProfile.phone,
          }}
          onClose={handleCloseMusyrifModal}
          onSave={handleSaveMusyrif}
        />
      ) : null}

      {isEditModalOpen && editScheduleForm ? (
        <EditScheduleModal
          form={editScheduleForm}
          isSaveDisabled={isEditSaveDisabled}
          showFridayCityTourWarning={showEditFridayCityTourWarning}
          onChange={handleEditFieldChange}
          onClose={handleCloseEditModal}
          onSave={handleSaveEditedSchedule}
        />
      ) : null}

      {isDeleteModalOpen && deletingItem ? (
        <DeleteConfirmModal
          item={deletingItem}
          onClose={handleCloseDeleteModal}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {isDeleteGroupModalOpen ? (
        <DeleteGroupModal
          groupCode={group.code}
          groupName={group.name}
          onClose={handleCloseDeleteGroupModal}
          onConfirm={handleConfirmDeleteGroup}
        />
      ) : null}

      {isGroupEditModalOpen ? (
        <GroupEditModal
          groupCode={group.code}
          groupName={group.name}
          onClose={handleCloseGroupEditModal}
          onSave={handleSaveGroupEdit}
        />
      ) : null}

      {isNoteModalOpen ? (
        <NoteModal
          onClose={handleCloseNoteModal}
          onSave={handleSaveNote}
        />
      ) : null}
    </div>
  );
}


