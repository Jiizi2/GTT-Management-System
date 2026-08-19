import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import * as Domain from "../../../shared/app-domain";
import type {
  EditScheduleFormState,
  GroupData,
  GroupAgreementHotel,
  ItineraryItem,
  Musyrif,
  NoteItem,
  ScheduleFormState,
} from "../../../shared/app-domain";

const {
  buildItineraryItemFromEditForm,
  buildTransferTrainSummary,
  createEditScheduleForm,
  createInitialScheduleForm,
  createNoteItems,
  createScheduleMeta,
  expandTransferTrainItineraryItems,
  formatVisaShortDate,
  formatRouteSummary,
  formatScheduleDate,
  generateWhatsappCopyText,
  getGroupAgreementHotelsByCity,
  getStayPeriods,
  getScheduleTypeOption,
  hasIncompleteTransferTrainFields,
  inferCategoryKey,
  isCityTourActivityType,
  isFlightActivityType,
  isIsoDateValue,
  isTransferActivityType,
  normalizeAgreementCityKey,
  parseTimeForInput,
  resolveFormTransportMode,
  resolveGroupCompleteness,
  resolveTotalBusCount,
  getTransportModeIcon,
  shouldShowFridayCityTourWarning,
} = Domain;

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

type AgreementCityKey = "makkah" | "madinah";
interface CompactAgreementSummary {
  city: AgreementCityKey;
  cityLabel: string;
  hotelLabel: string;
  paxLabel: string;
  stayLabel: string;
  primaryHotelLabel: string;
  isMissing: boolean;
}

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

export function useGroupDetailDashboard({
  group,
  groups,
  onBack,
  onDeleteGroup,
  onSaveGroup,
  onPatchGroup,
}: {
  group: GroupData;
  groups: GroupData[];
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

      scheduleSuggestedHotelNameRef.current = suggestedHotelName;
      scheduleSuggestedFromHotelNameRef.current = isPlainCityMeetingPoint ? "" : suggestedFromHotelName;

      return {
        ...draft,
        hotelName: shouldRefreshHotelName ? suggestedHotelName : draft.hotelName,
        fromHotelName: shouldRefreshFromHotelName
          ? isPlainCityMeetingPoint
            ? ""
            : suggestedFromHotelName
          : draft.fromHotelName,
      };
    },
    [resolveSuggestedHotelName, resolveSuggestedFromHotelName],
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

      editSuggestedHotelNameRef.current = suggestedHotelName;
      editSuggestedFromHotelNameRef.current = isPlainCityMeetingPoint ? "" : suggestedFromHotelName;

      return {
        ...draft,
        hotelName: shouldRefreshHotelName ? suggestedHotelName : draft.hotelName,
        fromHotelName: shouldRefreshFromHotelName
          ? isPlainCityMeetingPoint
            ? ""
            : suggestedFromHotelName
          : draft.fromHotelName,
      };
    },
    [resolveSuggestedHotelName, resolveSuggestedFromHotelName],
  );

  const requiredBusCount = resolveTotalBusCount(group.pax, group.totalBuses);

  const compactAgreementSummaries = useMemo(() => {
    return [buildCompactAgreementSummary(group, "makkah"), buildCompactAgreementSummary(group, "madinah")];
  }, [group]);

  const completeness = useMemo(() => resolveGroupCompleteness(group), [group]);

  const displayedNextActivity = useMemo(
    () => resolveNextActivityFromItinerary(itineraryItems, group.nextActivity),
    [itineraryItems, group.nextActivity],
  );

  const shouldShowLinkAgreementAction = completeness.issues.some((issue) => issue.key === "missing-agreement");
  const shouldShowCreateItineraryAction = completeness.issues.some((issue) => issue.key === "missing-itinerary");

  const buildGroupSnapshot = (input: {
    nextGroupCode?: string;
    nextGroupName?: string;
    nextPax?: number;
    nextTotalBuses?: number;
    nextArrivalDate?: string;
    nextReturnDate?: string;
    nextDurationDays?: number;
    nextParentGroupId?: string | null;
    nextItinerary?: ItineraryItem[];
    nextNoteItems?: NoteItem[];
    nextMusyrif?: Musyrif;
  }): GroupData => {
    const nextGroupCode = input.nextGroupCode ?? group.code;
    const nextGroupName = input.nextGroupName ?? group.name;
    const nextPax = input.nextPax ?? group.pax;
    const nextTotalBuses = input.nextTotalBuses ?? group.totalBuses;
    const nextArrivalDate = input.nextArrivalDate ?? group.arrivalDate;
    const nextReturnDate = input.nextReturnDate ?? group.returnDate;
    const nextDurationDays = input.nextDurationDays ?? group.durationDays;
    const nextParentGroupId = input.nextParentGroupId !== undefined ? input.nextParentGroupId : group.parentGroupId;
    const normalizedItinerary = input.nextItinerary ?? itineraryItems;
    const nextNoteItems = input.nextNoteItems ?? noteItems;
    const nextMusyrif = input.nextMusyrif ?? musyrifProfile;

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

  const persistGroupSnapshot = (input: any): { ok: true } | { ok: false; message: string } => {
    const nextGroup = buildGroupSnapshot(input);
    return onSaveGroup(nextGroup, group.code);
  };

  const patchGroupSnapshot = (input: any): { ok: true } | { ok: false; message: string } => {
    const nextGroup = buildGroupSnapshot(input);
    return onPatchGroup(nextGroup, group.code);
  };

  const handleScheduleFieldChange = (field: keyof ScheduleFormState, value: any) => {
    setScheduleForm((current) => applyScheduleHotelAutofill({ ...current, [field]: value }));
  };

  const handleEditFieldChange = (field: keyof EditScheduleFormState, value: any) => {
    setEditScheduleForm((current) => (current ? applyEditHotelAutofill({ ...current, [field]: value }) : current));
  };

  const handleOpenScheduleModal = useCallback(() => {
    scheduleSuggestedHotelNameRef.current = "";
    scheduleSuggestedFromHotelNameRef.current = "";
    setScheduleForm(applyScheduleHotelAutofill(createInitialScheduleForm()));
    setIsScheduleModalOpen(true);
  }, [applyScheduleHotelAutofill]);

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
    const transportMode = resolveFormTransportMode(scheduleForm.category, scheduleForm.transportMode);
    const nextFlightNumber =
      transportMode === "flight" && isFlightActivityType(scheduleForm.category) ? scheduleForm.flightNumber.trim() : "";
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
    const isTransferByTrain = isTransferActivityType(scheduleForm.category) && transportMode === "train";
    const scheduleTime = isTransferByTrain ? scheduleForm.trainDepartureTime : scheduleForm.time;
    const transferTrainSummary = buildTransferTrainSummary({ ...scheduleForm, transportMode });
    const nextCityTourCity = isCityTourActivityType(scheduleForm.category) ? scheduleForm.cityTourCity.trim() : "";
    const nextTitle = formatRouteSummary(scheduleForm.category, scheduleForm.from, scheduleForm.to, nextCityTourCity);
    const nextRequiresBus = isCityTourActivityType(scheduleForm.category) ? false : transportMode === "bus";
    const nextIcon =
      scheduleForm.category === "city-tour" ? "tour" : getTransportModeIcon(transportMode, scheduleForm.category);
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
      icon: nextIcon,
      highlighted: scheduleForm.highlighted,
      categoryKey: typeOption.value,
      isoDate: scheduleForm.date,
      time: scheduleTime,
      transportMode,
      flightNumber: nextFlightNumber,
      hotelName: nextHotelName,
      fromHotelName: nextFromHotelName,
      from: scheduleForm.from.trim(),
      to: scheduleForm.to.trim(),
      cityTourCity: nextCityTourCity,
      notes: scheduleForm.note.trim(),
      requiresBus: nextRequiresBus,
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
      // No-op fallback
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

    void import("../../group-detail-export")
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

  const isDarkMode = false;

  return {
    group,
    groups,
    familyGroups,
    childGroupCount,
    totalPax,
    itineraryItems,
    noteItems,
    musyrifProfile,
    isMusyrifModalOpen,
    isMusyrifCopied,
    isWhatsappCopied,
    isScheduleModalOpen,
    scheduleForm,
    editingIndex,
    editScheduleForm,
    deletingIndex,
    isNoteModalOpen,
    isDeleteGroupModalOpen,
    isGroupEditModalOpen,
    unlinkingGroup,
    requiredBusCount,
    onBack,
    onDeleteGroup,
    onSaveGroup,
    onPatchGroup,

    // Handlers
    handleSaveSchedule,
    handleCloseScheduleModal,
    handleOpenScheduleModal,
    handleScheduleFieldChange,
    handleOpenEditModal,
    handleCloseEditModal,
    handleEditFieldChange,
    handleSaveEditedSchedule,
    handleOpenDeleteModal,
    handleCloseDeleteModal,
    handleConfirmDelete,
    handleOpenNoteModal,
    handleCloseNoteModal,
    handleSaveNote,
    handleSaveMusyrif,
    handleOpenMusyrifModal,
    handleCloseMusyrifModal,
    handleCopyMusyrif,
    handleCopyWhatsapp,
    handleExportPdf,
    handleDeleteGroupBtn: () => setIsDeleteGroupModalOpen(true),
    handleCloseDeleteGroupModal,
    handleConfirmDeleteGroup,
    handleOpenGroupEditModal,
    handleCloseGroupEditModal,
    handleSaveGroupEdit,
    handleOpenUnlinkModal,
    handleCloseUnlinkModal,
    handleConfirmUnlink,

    // Helpers
    isScheduleSaveDisabled,
    showScheduleFridayCityTourWarning,
    isEditSaveDisabled,
    showEditFridayCityTourWarning,
    compactAgreementSummaries,
    completeness,
    displayedNextActivity,
    shouldShowLinkAgreementAction,
    shouldShowCreateItineraryAction,
    isDarkMode,
    hasOpenModal,
    deletingItem,
    isEditModalOpen,
    isDeleteModalOpen,
    isUnlinkModalOpen,
  };
}
