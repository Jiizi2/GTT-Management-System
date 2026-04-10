import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import * as Domain from "../shared/app-domain";
import { DatePickerInput, TimePickerInput } from "../components/date-time-pickers";
import { SereneSelect } from "../components/serene-select";
import type {
  AgreementApprovalStatus,
  BusStatus,
  GroupAgreementHotel,
  GroupData,
  GroupRaudhahStatus,
  InputItineraryFormState,
  InputItineraryItem,
  ItineraryPrefill,
  NewGroupAgreementFormState,
  NewGroupItineraryDraft,
  NewGroupRaudhahFormState,
  VisaStatus,
} from "../shared/app-domain";
import {
  BASE_TRIP_BLUEPRINTS,
  buildInputItineraryValidationState,
  buildDefaultItineraryNotes,
  buildItineraryFromInputItems,
  buildTimelineAndNextActivity,
  calculateItineraryDurationDays,
  createBaseTripDrafts,
  isBaseTripDraftInvalid,
  resolveEffectiveGroupIdentityState,
  shouldUseSaudiCityDropdown,
  type BaseTripDraft,
  type ItinerarySectionMode,
} from "./add-group-workspace-helpers";
import {
  buildAgreementItineraryPrefill,
  buildNewGroupPayload,
} from "./new-group-screen-helpers";
import { useSaudiCityOptions } from "../hooks/use-saudi-city-options";
const {
  createInitialInputItineraryForm,
  expandInputTransferTrainItems,
  formatRouteSummary,
  formatScheduleDate,
  formatScheduleTime,
  getLocalIsoDateWithOffset,
  getMinimumBusCountForPax,
  getRouteFieldConfigByCategory,
  getScheduleTypeOption,
  getStatusByTone,
  hasIncompleteTransferTrainFields,
  isCityTourActivityType,
  isFlightActivityType,
  isIsoDateValue,
  isTransferActivityType,
  musyrifAvatar,
  normalizeAgreementCityKey,
  normalizeSaudiCityValue,
  resolveGroupToneByItinerary,
  resolveTotalBusCount,
  resolveVisaAgreementNumber,
  saudiCityOptions: defaultSaudiCityOptions,
  scheduleTypeOptions,
  shiftIsoDate,
  shouldShowFridayCityTourWarning,
  sortInputItineraryItems,
  createNewGroupAgreementForm,
  createNewGroupRaudhahForm,
} = Domain;

function createIdentityFormSchema(requireIdentityFields: boolean) {
  return z
    .object({
      groupNumber: requireIdentityFields
        ? z.string().trim().min(1, "Group number wajib diisi.")
        : z.string(),
      groupName: requireIdentityFields
        ? z.string().trim().min(1, "Group name wajib diisi.")
        : z.string(),
      packageType: requireIdentityFields
        ? z.string().trim().min(1, "Package type wajib diisi.")
        : z.string(),
      paxCount: requireIdentityFields
        ? z
            .string()
            .trim()
            .min(1, "Jumlah pax wajib diisi.")
            .refine((value) => {
              const parsed = Number.parseInt(value, 10);
              return Number.isFinite(parsed) && parsed > 0;
            }, "Jumlah pax harus lebih dari 0.")
        : z.string(),
      totalBusRequired: requireIdentityFields
        ? z
            .string()
            .trim()
            .min(1, "Total bus wajib diisi.")
            .refine((value) => {
              const parsed = Number.parseInt(value, 10);
              return Number.isFinite(parsed) && parsed > 0;
            }, "Total bus harus lebih dari 0.")
        : z.string(),
      startDate: requireIdentityFields
        ? z.string().trim().min(1, "Start date wajib diisi.")
        : z.string(),
      endDate: requireIdentityFields
        ? z.string().trim().min(1, "End date wajib diisi.")
        : z.string(),
      musyrifName: requireIdentityFields
        ? z.string().trim().min(1, "Nama musyrif wajib diisi.")
        : z.string(),
      musyrifPhone: requireIdentityFields
        ? z.string().trim().min(1, "Nomor telepon musyrif wajib diisi.")
        : z.string(),
    })
    .superRefine((values, context) => {
      if (!requireIdentityFields) {
        return;
      }

      if (
        values.startDate.trim() &&
        values.endDate.trim() &&
        isIsoDateValue(values.startDate) &&
        isIsoDateValue(values.endDate) &&
        values.endDate < values.startDate
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "End date harus sama atau setelah start date.",
        });
      }
    });
}

type IdentityFormValues = z.infer<ReturnType<typeof createIdentityFormSchema>>;

const manualScheduleFormSchema = z
  .object({
    date: z.string().trim().min(1, "Tanggal aktivitas wajib diisi."),
    time: z.string(),
    category: z.string().trim().min(1, "Jenis aktivitas wajib dipilih."),
    hotelName: z.string(),
    fromHotelName: z.string(),
    from: z.string().trim().min(1, "Lokasi asal wajib diisi."),
    to: z.string().trim().min(1, "Lokasi tujuan wajib diisi."),
    cityTourCity: z.string(),
    flightNumber: z.string(),
    requiresBus: z.boolean(),
    notes: z.string(),
    transferByTrain: z.boolean(),
    trainDepartureTime: z.string(),
    destinationPickupTime: z.string(),
    hotelPickupRequestTime: z.string(),
  })
  .superRefine((values, context) => {
    if (isFlightActivityType(values.category) && !values.flightNumber.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["flightNumber"],
        message: "Nomor penerbangan wajib diisi.",
      });
    }

    const isHotelNameRequired =
      values.category === "arrival" || values.category === "transfer" || values.category === "departure";
    if (isHotelNameRequired && !values.hotelName.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hotelName"],
        message: "Nama hotel wajib diisi.",
      });
    }

    if (values.category === "departure" && !values.time.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["time"],
        message: "Jam flight return wajib diisi.",
      });
    }

    if (values.category === "departure" && !values.hotelPickupRequestTime.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hotelPickupRequestTime"],
        message: "Jam pickup hotel wajib diisi.",
      });
    }

    if (isCityTourActivityType(values.category) && !values.cityTourCity.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cityTourCity"],
        message: "Kota city tour wajib dipilih.",
      });
    }

    if (hasIncompleteTransferTrainFields(values)) {
      if (!values.trainDepartureTime.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["trainDepartureTime"],
          message: "Jam keberangkatan kereta wajib diisi.",
        });
      }

      if (!values.destinationPickupTime.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["destinationPickupTime"],
          message: "Jam pickup di stasiun tujuan wajib diisi.",
        });
      }
    }
  });

type ManualScheduleFormValues = z.infer<typeof manualScheduleFormSchema>;

const baseTripDraftSchema = manualScheduleFormSchema.extend({
  hotelName: z.string().optional(),
  fromHotelName: z.string().optional(),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  isEnabled: z.boolean(),
});

const baseTripFormSchema = z.object({
  trips: z.array(baseTripDraftSchema),
});

type BaseTripFormValues = z.infer<typeof baseTripFormSchema>;

export function InputItineraryScreen({
  onSaveGroup,
  hideHeader = false,
  hideSaveAction = false,
  onItineraryDraftChange,
  sectionMode = "full",
  identityDraft = null,
  emitIdentityInDraft = true,
  itineraryPrefill = null,
}: {
  onSaveGroup: (group: GroupData) => void;
  hideHeader?: boolean;
  hideSaveAction?: boolean;
  onItineraryDraftChange?: (draft: NewGroupItineraryDraft | null) => void;
  sectionMode?: ItinerarySectionMode;
  identityDraft?: NewGroupItineraryDraft | null;
  emitIdentityInDraft?: boolean;
  itineraryPrefill?: ItineraryPrefill | null;
}) {
  const saudiCityOptions = useSaudiCityOptions(defaultSaudiCityOptions);
  const identityFormSchema = useMemo(
    () => createIdentityFormSchema(sectionMode !== "schedule-only"),
    [sectionMode],
  );
  const {
    register,
    control,
    watch,
    getValues,
    setValue,
    formState: { errors: identityErrors },
  } = useForm<IdentityFormValues>({
    resolver: zodResolver(identityFormSchema),
    mode: "onChange",
    defaultValues: {
      groupNumber: "",
      groupName: "",
      packageType: "",
      paxCount: "",
      totalBusRequired: "",
      startDate: "",
      endDate: "",
      musyrifName: "",
      musyrifPhone: "",
    },
  });
  const {
    register: registerSchedule,
    control: scheduleControl,
    watch: watchSchedule,
    getValues: getScheduleValues,
    setValue: setScheduleValue,
    reset: resetSchedule,
    handleSubmit: handleSubmitSchedule,
    formState: { errors: scheduleErrors },
  } = useForm<ManualScheduleFormValues>({
    resolver: zodResolver(manualScheduleFormSchema),
    mode: "onChange",
    defaultValues: createInitialInputItineraryForm(),
  });
  const {
    control: baseTripControl,
    watch: watchBaseTrips,
    getValues: getBaseTripValues,
    setValue: setBaseTripValue,
    reset: resetBaseTripForm,
  } = useForm<BaseTripFormValues>({
    resolver: zodResolver(baseTripFormSchema),
    mode: "onChange",
    defaultValues: {
      trips: [],
    },
  });
  const { replace: replaceBaseTripFields } = useFieldArray({
    control: baseTripControl,
    name: "trips",
    keyName: "fieldKey",
  });
  const [itineraryItems, setItineraryItems] = useState<InputItineraryItem[]>([]);
  const form = watchSchedule();
  const baseTripDrafts = watchBaseTrips("trips") ?? [];
  const [baseTripStepIndex, setBaseTripStepIndex] = useState(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isScheduleFormVisible, setIsScheduleFormVisible] = useState(false);
  const [isBaseTripFormVisible, setIsBaseTripFormVisible] = useState(false);
  const [initializedScheduleSeed, setInitializedScheduleSeed] = useState<string | null>(null);
  const manualFormSuggestedHotelNameRef = useRef("");
  const baseTripSuggestedHotelByIdRef = useRef<Record<string, string>>({});
  const groupNumber = watch("groupNumber");
  const groupName = watch("groupName");
  const packageType = watch("packageType");
  const paxCount = watch("paxCount");
  const totalBusRequired = watch("totalBusRequired");
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const musyrifName = watch("musyrifName");
  const musyrifPhone = watch("musyrifPhone");
  const {
    isIdentityOnlyMode,
    isScheduleOnlyMode,
    effectiveGroupCode,
    effectiveGroupName,
    effectivePackageType,
    effectivePaxCountValue,
    effectiveTotalBusRequiredValue,
    effectiveStartDate,
    effectiveEndDate,
    effectiveMusyrifName,
    effectiveMusyrifPhone,
  } = resolveEffectiveGroupIdentityState({
    sectionMode,
    identityDraft,
    itineraryPrefill,
    groupNumber,
    groupName,
    packageType,
    paxCount,
    totalBusRequired,
    startDate,
    endDate,
    musyrifName,
    musyrifPhone,
  });
  const {
    hasInvalidDateRange,
    parsedTotalBusRequired,
    safePaxForBusRule,
    minimumBusCount,
    isTotalBusBelowMinimum,
    isGroupReadyForItinerary,
    showFlightNumberField,
    showHotelNameField,
    showTransferTrainFields,
    showDeparturePickupField,
    showCityTourCityField,
    isFormDisabled,
  } = buildInputItineraryValidationState({
    effectiveGroupCode,
    effectiveGroupName,
    effectivePackageType,
    effectivePaxCountValue,
    effectiveTotalBusRequiredValue,
    effectiveStartDate,
    effectiveEndDate,
    effectiveMusyrifName,
    effectiveMusyrifPhone,
    form,
  });
  const routeFieldConfig = getRouteFieldConfigByCategory(form.category);
  const enabledBaseTripCount = baseTripDrafts.filter((item) => item.isEnabled).length;
  const isBaseTripSaveDisabled =
    !isGroupReadyForItinerary ||
    enabledBaseTripCount === 0 ||
    baseTripDrafts.length !== BASE_TRIP_BLUEPRINTS.length ||
    baseTripDrafts.some((item) => isBaseTripDraftInvalid(item));
  const maxBaseTripStepIndex = Math.max(0, baseTripDrafts.length - 1);
  const currentBaseTripStepIndex = Math.min(baseTripStepIndex, maxBaseTripStepIndex);
  const activeBaseTrip = baseTripDrafts[currentBaseTripStepIndex] ?? null;
  const isFirstBaseTripStep = currentBaseTripStepIndex === 0;
  const isLastBaseTripStep = currentBaseTripStepIndex === maxBaseTripStepIndex;
  const isActiveBaseTripInvalid = activeBaseTrip ? isBaseTripDraftInvalid(activeBaseTrip) : true;
  const isGroupSaveDisabled = !isGroupReadyForItinerary || itineraryItems.length === 0;
  const showFridayCityTourWarning = shouldShowFridayCityTourWarning(form.category, form.date);
  const itineraryPrefillSeed = JSON.stringify(itineraryPrefill ?? {});
  const schedulePrefillSeed = `${effectiveStartDate}|${effectiveEndDate}|${itineraryPrefillSeed}`;

  const cityHotelNames = useMemo(() => {
    const initialMap: { makkah?: string; madinah?: string } = {};
    const directMap = itineraryPrefill?.cityHotelNames;
    if (directMap?.makkah?.trim()) {
      initialMap.makkah = directMap.makkah.trim();
    }
    if (directMap?.madinah?.trim()) {
      initialMap.madinah = directMap.madinah.trim();
    }

    for (const trip of Object.values(itineraryPrefill?.trips ?? {})) {
      if (!trip) {
        continue;
      }

      const tripHotelName = trip?.hotelName?.trim() ?? "";
      if (!tripHotelName) {
        continue;
      }

      const cityCandidate = trip.cityTourCity?.trim() || trip.to?.trim() || trip.from?.trim() || "";
      const cityKey = normalizeAgreementCityKey(cityCandidate);
      if (cityKey && !initialMap[cityKey]) {
        initialMap[cityKey] = tripHotelName;
      }
    }

    return initialMap;
  }, [itineraryPrefill]);

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

  const applyHotelAutofill = <FormShape extends {
    category: string;
    from: string;
    to: string;
    cityTourCity: string;
    hotelName?: string;
  }>(
    draft: FormShape,
    previousSuggestedHotelName = "",
  ): {
    nextDraft: FormShape;
    suggestedHotelName: string;
  } => {
    const suggestedHotelName = resolveSuggestedHotelName(draft).trim();
    const currentHotelName = draft.hotelName?.trim() ?? "";
    const shouldRefreshHotelName =
      !currentHotelName ||
      (!!previousSuggestedHotelName && currentHotelName === previousSuggestedHotelName);
    const nextDraft = {
      ...draft,
      hotelName: shouldRefreshHotelName ? suggestedHotelName : currentHotelName,
    } as FormShape;
    const normalizedFrom = nextDraft.from.trim().toLowerCase();
    const isPlainCityMeetingPoint =
      normalizedFrom === "makkah" || normalizedFrom === "madinah";

    if (
      isCityTourActivityType(nextDraft.category) &&
      suggestedHotelName &&
      (!nextDraft.from.trim() || isPlainCityMeetingPoint)
    ) {
      nextDraft.from = suggestedHotelName;
    }

    return {
      nextDraft,
      suggestedHotelName,
    };
  };

  const applyHotelAutofillForManualForm = (
    draft: InputItineraryFormState,
  ): InputItineraryFormState => {
    const { nextDraft, suggestedHotelName } = applyHotelAutofill(
      draft,
      manualFormSuggestedHotelNameRef.current,
    );
    manualFormSuggestedHotelNameRef.current = suggestedHotelName;
    return nextDraft;
  };

  const applyHotelAutofillForBaseTrip = (draft: BaseTripDraft): BaseTripDraft => {
    const previousSuggestedHotelName = baseTripSuggestedHotelByIdRef.current[draft.id] ?? "";
    const { nextDraft, suggestedHotelName } = applyHotelAutofill(
      draft,
      previousSuggestedHotelName,
    );
    baseTripSuggestedHotelByIdRef.current[draft.id] = suggestedHotelName;
    return nextDraft;
  };

  const seedBaseTripHotelSuggestions = (drafts: BaseTripDraft[]): BaseTripDraft[] => {
    const nextSuggestedById: Record<string, string> = {};
    const nextDrafts = drafts.map((draft) => {
      const { nextDraft, suggestedHotelName } = applyHotelAutofill(draft);
      nextSuggestedById[draft.id] = suggestedHotelName;
      return nextDraft;
    });
    baseTripSuggestedHotelByIdRef.current = nextSuggestedById;
    return nextDrafts;
  };

  const replaceBaseTripDrafts = (drafts: BaseTripDraft[]) => {
    replaceBaseTripFields(drafts);
  };

  const updateBaseTripDraftAtIndex = (
    tripIndex: number,
    updater: (draft: BaseTripDraft) => BaseTripDraft,
  ) => {
    const currentTrips = getBaseTripValues("trips");
    const nextTrips = currentTrips.map((trip, index) =>
      index === tripIndex ? applyHotelAutofillForBaseTrip(updater(trip)) : trip,
    );
    setBaseTripValue("trips", nextTrips, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const applyManualScheduleDraft = (
    draft: ManualScheduleFormValues,
    options?: {
      shouldDirty?: boolean;
      shouldValidate?: boolean;
    },
  ) => {
    const nextDraft = applyHotelAutofillForManualForm(draft);
    const shouldDirty = options?.shouldDirty ?? true;
    const shouldValidate = options?.shouldValidate ?? true;

    (
      Object.entries(nextDraft) as Array<
        [keyof ManualScheduleFormValues, ManualScheduleFormValues[keyof ManualScheduleFormValues]]
      >
    ).forEach(([field, value]) => {
      setScheduleValue(field, value, {
        shouldDirty,
        shouldValidate,
      });
    });
  };

  const handleFormChange = <Key extends keyof ManualScheduleFormValues>(
    field: Key,
    value: ManualScheduleFormValues[Key],
  ) => {
    const current = getScheduleValues();
    applyManualScheduleDraft({
      ...current,
      [field]: value,
    });
  };

  const handlePaxCountChange = (value: string) => {
    setValue("paxCount", value, { shouldDirty: true, shouldValidate: true });

    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return;
    }

    const nextMinimumBusCount = getMinimumBusCountForPax(parsedValue);
    if (!getValues("totalBusRequired").trim()) {
      setValue("totalBusRequired", String(nextMinimumBusCount), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const handleResetForm = () => {
    manualFormSuggestedHotelNameRef.current = "";
    resetSchedule(createInitialInputItineraryForm());
    setEditingItemId(null);
  };

  const handleOpenCreateForm = () => {
    if (!isGroupReadyForItinerary) {
      return;
    }

    setIsScheduleFormVisible(false);
    setEditingItemId(null);
    const nextBaseTripDrafts = createBaseTripDrafts(
      effectiveStartDate,
      effectiveEndDate,
      itineraryPrefill,
    );
    replaceBaseTripDrafts(seedBaseTripHotelSuggestions(nextBaseTripDrafts));
    setBaseTripStepIndex(0);
    setIsBaseTripFormVisible(true);
    setInitializedScheduleSeed(schedulePrefillSeed);
  };

  const handleOpenManualCreateForm = () => {
    if (!isGroupReadyForItinerary) {
      return;
    }

    setIsBaseTripFormVisible(false);
    handleResetForm();
    setIsScheduleFormVisible(true);
  };

  const handleCloseScheduleForm = () => {
    handleResetForm();
    setIsScheduleFormVisible(false);
  };

  const handleCloseBaseTripForm = () => {
    baseTripSuggestedHotelByIdRef.current = {};
    resetBaseTripForm({ trips: [] });
    setBaseTripStepIndex(0);
    setIsBaseTripFormVisible(false);
  };

  useEffect(() => {
    if (!isScheduleFormVisible || typeof document === "undefined") {
      return;
    }

    const previousBodyOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleCloseScheduleForm();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isScheduleFormVisible]);

  const handleBaseTripStepChange = (direction: "next" | "previous") => {
    setBaseTripStepIndex((current) => {
      const candidate = direction === "next" ? current + 1 : current - 1;
      return Math.min(Math.max(candidate, 0), maxBaseTripStepIndex);
    });
  };

  const handleJumpToBaseTripStep = (stepIndex: number) => {
    setBaseTripStepIndex(Math.min(Math.max(stepIndex, 0), maxBaseTripStepIndex));
  };

  const handleBaseTripChange = <Key extends keyof InputItineraryFormState>(
    tripIndex: number,
    field: Key,
    value: InputItineraryFormState[Key],
  ) => {
    updateBaseTripDraftAtIndex(tripIndex, (trip) => ({
      ...trip,
      [field]: value,
    }));
  };

  const handleEditItem = (item: InputItineraryItem) => {
    if (!isGroupReadyForItinerary) {
      return;
    }

    setIsBaseTripFormVisible(false);
    setEditingItemId(item.id);
    manualFormSuggestedHotelNameRef.current = "";
    const nextCategory = item.categoryKey;
    const nextFrom = shouldUseSaudiCityDropdown(nextCategory, "from")
      ? normalizeSaudiCityValue(item.from)
      : item.from;
    const nextTo = shouldUseSaudiCityDropdown(nextCategory, "to")
      ? normalizeSaudiCityValue(item.to)
      : item.to;
    resetSchedule(applyHotelAutofillForManualForm({
      ...createInitialInputItineraryForm(),
      date: item.date,
      time: item.time,
      category: nextCategory,
      hotelName: item.hotelName ?? "",
      from: nextFrom,
      to: nextTo,
      cityTourCity: item.cityTourCity ?? "",
      flightNumber: item.flightNumber,
      requiresBus: item.requiresBus,
      notes: item.notes,
      transferByTrain: item.transferByTrain,
      trainDepartureTime: item.trainDepartureTime,
      destinationPickupTime: item.destinationPickupTime,
      hotelPickupRequestTime: item.hotelPickupRequestTime,
    }));
    setIsScheduleFormVisible(true);
  };

  const handleDeleteItem = (itemId: string) => {
    if (!isGroupReadyForItinerary) {
      return;
    }

    setItineraryItems((current) => current.filter((item) => item.id !== itemId));

    if (editingItemId === itemId) {
      handleCloseScheduleForm();
    }
  };

  const handleSaveItem = handleSubmitSchedule((values) => {
    if (!isGroupReadyForItinerary || isFormDisabled) {
      return;
    }

    const typeOption = getScheduleTypeOption(values.category);
    const nextFlightNumber = showFlightNumberField ? values.flightNumber.trim() : "";
    const isHotelNameRequired =
      values.category === "arrival" || values.category === "transfer" || values.category === "departure";
    const nextHotelName = isHotelNameRequired
      ? values.hotelName?.trim() || resolveSuggestedHotelName(values)
      : "";
    const nextHotelPickupRequestTime =
      values.category === "departure" ? values.hotelPickupRequestTime.trim() : "";
    const isTransferByTrain = isTransferActivityType(values.category) && values.transferByTrain;
    const scheduleTime = isTransferByTrain ? values.trainDepartureTime : values.time;
    const nextItem: InputItineraryItem = {
      id: editingItemId ?? `item-${Date.now()}`,
      date: values.date,
      time: scheduleTime,
      category: typeOption.cardLabel,
      categoryKey: typeOption.value,
      hotelName: nextHotelName,
      from: values.from.trim(),
      to: values.to.trim(),
      cityTourCity: showCityTourCityField ? values.cityTourCity.trim() : "",
      flightNumber: nextFlightNumber,
      requiresBus: isTransferByTrain ? true : values.requiresBus,
      notes: values.notes.trim(),
      icon: typeOption.icon,
      transferByTrain: isTransferByTrain,
      trainDepartureTime: isTransferByTrain ? values.trainDepartureTime.trim() : "",
      destinationPickupTime: isTransferByTrain ? values.destinationPickupTime.trim() : "",
      hotelPickupRequestTime: nextHotelPickupRequestTime,
    };
    const nextItems = expandInputTransferTrainItems([nextItem]);

    setItineraryItems((current) => {
      const draftItems = editingItemId
        ? current.filter((item) => item.id !== editingItemId)
        : current;
      const mergedItems = [...draftItems, ...nextItems];

      return sortInputItineraryItems(mergedItems);
    });

    handleCloseScheduleForm();
  });

  const handleSaveBaseTrips = () => {
    if (isBaseTripSaveDisabled) {
      return;
    }

    const enabledBaseTrips = baseTripDrafts.filter((item) => item.isEnabled);
    if (enabledBaseTrips.length === 0) {
      return;
    }

    const generatedAt = Date.now();
    const nextBaseItems: InputItineraryItem[] = enabledBaseTrips.map((item, index) => {
      const typeOption = getScheduleTypeOption(item.category);
      const isTransferByTrain = isTransferActivityType(item.category) && item.transferByTrain;
      const scheduleTime = isTransferByTrain ? item.trainDepartureTime : item.time;
      const isHotelNameRequired =
        item.category === "arrival" || item.category === "transfer" || item.category === "departure";
      const nextHotelName = isHotelNameRequired
        ? item.hotelName?.trim() || resolveSuggestedHotelName(item)
        : "";
      const hotelPickupRequestTime =
        item.category === "departure" ? item.hotelPickupRequestTime.trim() : "";

      return {
        id: `base-trip-${generatedAt}-${index}`,
        date: item.date,
        time: scheduleTime,
        category: typeOption.cardLabel,
        categoryKey: typeOption.value,
        hotelName: nextHotelName,
        from: item.from.trim(),
        to: item.to.trim(),
        cityTourCity: isCityTourActivityType(item.category) ? item.cityTourCity.trim() : "",
        flightNumber: isFlightActivityType(item.category) ? item.flightNumber.trim() : "",
        requiresBus: isTransferByTrain ? true : item.requiresBus,
        notes: item.notes.trim(),
        icon: typeOption.icon,
        transferByTrain: isTransferByTrain,
        trainDepartureTime: isTransferByTrain ? item.trainDepartureTime.trim() : "",
        destinationPickupTime: isTransferByTrain ? item.destinationPickupTime.trim() : "",
        hotelPickupRequestTime,
      };
    });

    const expandedItems = expandInputTransferTrainItems(nextBaseItems);
    setItineraryItems((current) => sortInputItineraryItems([...current, ...expandedItems]));
    handleCloseBaseTripForm();
  };

  useEffect(() => {
    if (!isScheduleOnlyMode) {
      return;
    }

    if (!isGroupReadyForItinerary) {
      if (initializedScheduleSeed !== null) {
        setInitializedScheduleSeed(null);
      }
      return;
    }

    if (itineraryItems.length > 0 || isScheduleFormVisible) {
      return;
    }

    if (initializedScheduleSeed === schedulePrefillSeed) {
      return;
    }

    const nextBaseTripDrafts = createBaseTripDrafts(
      effectiveStartDate,
      effectiveEndDate,
      itineraryPrefill,
    );
    replaceBaseTripDrafts(seedBaseTripHotelSuggestions(nextBaseTripDrafts));
    setBaseTripStepIndex(0);
    setIsBaseTripFormVisible(true);
    setInitializedScheduleSeed(schedulePrefillSeed);
  }, [
    effectiveEndDate,
    effectiveStartDate,
    initializedScheduleSeed,
    isGroupReadyForItinerary,
    isScheduleFormVisible,
    isScheduleOnlyMode,
    itineraryItems.length,
    itineraryPrefill,
    replaceBaseTripFields,
    schedulePrefillSeed,
  ]);

  useEffect(() => {
    if (!onItineraryDraftChange) {
      return;
    }

    const parsedDraftPax = Number.parseInt(effectivePaxCountValue, 10);
    const parsedDraftTotalBuses = Number.parseInt(effectiveTotalBusRequiredValue, 10);
    const baseDraft: NewGroupItineraryDraft = {
      groupCode: effectiveGroupCode.trim().toUpperCase(),
      groupName: effectiveGroupName.trim(),
      pax:
        Number.isFinite(parsedDraftPax) && parsedDraftPax > 0
          ? parsedDraftPax
          : undefined,
      totalBuses:
        Number.isFinite(parsedDraftTotalBuses) && parsedDraftTotalBuses > 0
          ? parsedDraftTotalBuses
          : undefined,
      packageName: effectivePackageType.trim(),
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      musyrifName: effectiveMusyrifName.trim(),
      musyrifPhone: effectiveMusyrifPhone.trim(),
    };
    const hasDraftBaseValue = Boolean(
      baseDraft.groupCode ||
        baseDraft.groupName ||
        baseDraft.packageName ||
        baseDraft.startDate ||
        baseDraft.endDate ||
        baseDraft.pax ||
        baseDraft.totalBuses ||
        baseDraft.musyrifName ||
        baseDraft.musyrifPhone,
    );
    const sortedItems = sortInputItineraryItems(expandInputTransferTrainItems(itineraryItems));
    const activitySummary = buildTimelineAndNextActivity(sortedItems);
    if (!activitySummary) {
      onItineraryDraftChange(
        emitIdentityInDraft ? (hasDraftBaseValue ? baseDraft : null) : null,
      );
      return;
    }

    const itinerary = buildItineraryFromInputItems(sortedItems);
    const notes = buildDefaultItineraryNotes(sortedItems);
    const itineraryDurationDays = calculateItineraryDurationDays(sortedItems);

    onItineraryDraftChange({
      ...(emitIdentityInDraft ? baseDraft : {}),
      itinerary,
      timeline: activitySummary.timeline,
      nextActivity: activitySummary.nextActivity,
      durationDays: itineraryDurationDays,
      notes,
    });
  }, [
    effectiveGroupCode,
    effectiveGroupName,
    effectivePaxCountValue,
    effectiveTotalBusRequiredValue,
    effectivePackageType,
    effectiveStartDate,
    effectiveEndDate,
    effectiveMusyrifName,
    effectiveMusyrifPhone,
    itineraryItems,
    emitIdentityInDraft,
    onItineraryDraftChange,
  ]);

  const handleSaveGroup = () => {
    if (isGroupSaveDisabled) {
      return;
    }

    const sortedItems = sortInputItineraryItems(expandInputTransferTrainItems(itineraryItems));
    const activitySummary = buildTimelineAndNextActivity(sortedItems, effectiveEndDate);
    if (!activitySummary) {
      return;
    }

    const parsedPax = Number.parseInt(effectivePaxCountValue, 10);
    const safePax = Number.isFinite(parsedPax) && parsedPax > 0 ? parsedPax : 1;
    const safeTotalBuses = resolveTotalBusCount(safePax, parsedTotalBusRequired);
    const startTimestamp = Date.parse(effectiveStartDate);
    const endTimestamp = Date.parse(effectiveEndDate);
    const durationDays =
      Number.isNaN(startTimestamp) || Number.isNaN(endTimestamp)
        ? 1
        : Math.max(1, Math.floor((endTimestamp - startTimestamp) / 86_400_000) + 1);
    const itinerary = buildItineraryFromInputItems(sortedItems);
    const notes = buildDefaultItineraryNotes(sortedItems);
    const groupTone = resolveGroupToneByItinerary(itinerary);

    onSaveGroup({
      code: effectiveGroupCode.trim().toUpperCase(),
      name: effectiveGroupName.trim(),
      status: getStatusByTone(groupTone),
      tone: groupTone,
      pax: safePax,
      totalBuses: safeTotalBuses,
      packageName: effectivePackageType.trim(),
      durationDays,
      arrivalDate: effectiveStartDate,
      returnDate: effectiveEndDate,
      timeline: activitySummary.timeline,
      nextActivity: activitySummary.nextActivity,
      itinerary,
      notes,
      musyrif: {
        name: effectiveMusyrifName.trim(),
        phone: effectiveMusyrifPhone.trim(),
        avatar: musyrifAvatar,
      },
    });
  };

  const fieldClassName = "serene-field";
  const wideFieldClassName = `${fieldClassName} md:col-span-2`;
  const gridClassName = "grid gap-3 md:grid-cols-2";
  const inputClassName = "serene-input";
  const selectClassName = "serene-select";
  const textareaClassName = "serene-textarea";
  const routeHintClassName = "md:col-span-2 text-xs font-medium leading-relaxed text-on-surface-variant";
  const warningClassName =
    "md:col-span-2 flex items-start gap-2 rounded-md bg-tertiary-fixed p-3 text-sm text-on-tertiary-fixed-variant";
  const infoClassName =
    "md:col-span-2 flex items-start gap-2 rounded-md bg-surface-container-high p-3 text-sm text-on-surface-variant";
  const checkClassName =
    "md:col-span-2 inline-flex items-center gap-2 rounded-md bg-surface-container-high px-3 py-2 text-sm font-medium text-on-surface-variant";
  const transferTrainCardClassName = "md:col-span-2 rounded-2xl bg-surface-container-high p-3";
  const transferTrainGridClassName = "mt-2 grid gap-3 md:grid-cols-2";
  const itineraryTagClassMap: Record<string, string> = {
    arrival: "border-emerald-200 bg-emerald-50 text-emerald-700",
    transfer: "border-slate-200 bg-slate-50 text-slate-700",
    "city-tour": "border-amber-200 bg-amber-50 text-amber-700",
    departure: "border-rose-200 bg-rose-50 text-rose-700",
  };
  const itineraryCardClassMap: Record<string, string> = {
    arrival: "border-emerald-200 bg-emerald-50/60",
    transfer: "border-slate-200 bg-slate-50/70",
    "city-tour": "border-amber-200 bg-amber-50/60",
    departure: "border-rose-200 bg-rose-50/60",
  };
  const activityTypeCardClassMap: Record<string, string> = {
    arrival: "border-emerald-200 bg-emerald-50/60",
    transfer: "border-slate-200 bg-slate-50/70",
    "city-tour": "border-amber-200 bg-amber-50/60",
    departure: "border-rose-200 bg-rose-50/60",
  };
  const activityTypeBannerClassMap: Record<string, string> = {
    arrival: "border-emerald-200 bg-emerald-50 text-emerald-700",
    transfer: "border-slate-200 bg-slate-50 text-slate-700",
    "city-tour": "border-amber-200 bg-amber-50 text-amber-700",
    departure: "border-rose-200 bg-rose-50 text-rose-700",
  };
  const activityTypeTitleClassMap: Record<string, string> = {
    arrival: "text-emerald-700",
    transfer: "text-slate-700",
    "city-tour": "text-amber-700",
    departure: "text-rose-700",
  };
  const activityTypeBadgeClassMap: Record<string, string> = {
    arrival: "border-emerald-200 bg-emerald-50 text-emerald-700",
    transfer: "border-slate-200 bg-slate-50 text-slate-700",
    "city-tour": "border-amber-200 bg-amber-50 text-amber-700",
    departure: "border-rose-200 bg-rose-50 text-rose-700",
  };
  const activityTypeActiveStepClassMap: Record<string, string> = {
    arrival: "border-emerald-300 bg-emerald-100 text-emerald-800",
    transfer: "border-slate-300 bg-slate-100 text-slate-800",
    "city-tour": "border-amber-300 bg-amber-100 text-amber-800",
    departure: "border-rose-300 bg-rose-100 text-rose-800",
  };
  const activityTypeFocusLabelMap: Record<string, string> = {
    arrival: "Start Trip - Arrival (Paling Penting)",
    transfer: "Activity Focus - Transfer",
    "city-tour": "Activity Focus - City Tour",
    departure: "End Trip - Departure",
  };

  const containerClassName = hideHeader ? "space-y-6" : "mx-auto max-w-7xl space-y-6";

  return (
    <>
      <div className={containerClassName}>
        {!hideHeader ? (
          <section className="serene-section p-6">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-700/80">
                Operations Form
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                Input Itinerary
              </h1>
              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                <span className="sm:hidden">Fill group info and travel plan.</span>
                <span className="hidden sm:inline">Fill in group information and travel plan for operational execution.</span>
              </p>
            </div>
          </section>
        ) : null}

        {!isScheduleOnlyMode ? (
          <>
        <section className="serene-section">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Group Information</h2>
          </div>

          <div className={gridClassName}>
            <label className={wideFieldClassName}>
              <span>Group Number</span>
              <input
                type="text"
                {...register("groupNumber")}
                placeholder="e.g. GR-7721-UMA"
                className={`${inputClassName} text-lg font-semibold tracking-tight`}
              />
              {identityErrors.groupNumber ? (
                <p className="text-xs font-semibold text-error">{identityErrors.groupNumber.message}</p>
              ) : null}
            </label>

            <label className={fieldClassName}>
              <span>Group Name</span>
              <input
                className={inputClassName}
                type="text"
                {...register("groupName")}
                placeholder="e.g. Jakarta Umrah March Batch"
              />
              {identityErrors.groupName ? (
                <p className="text-xs font-semibold text-error">{identityErrors.groupName.message}</p>
              ) : null}
            </label>

            <label className={fieldClassName}>
              <span>Package Type</span>
              <input
                className={inputClassName}
                type="text"
                {...register("packageType")}
                placeholder="e.g. Custom VIP Package"
              />
              {identityErrors.packageType ? (
                <p className="text-xs font-semibold text-error">{identityErrors.packageType.message}</p>
              ) : null}
            </label>

            <label className={fieldClassName}>
              <span>Number of Pax</span>
              <input
                className={inputClassName}
                type="number"
                min={1}
                value={paxCount}
                onChange={(event) => handlePaxCountChange(event.target.value)}
                placeholder="45"
              />
              {identityErrors.paxCount ? (
                <p className="text-xs font-semibold text-error">{identityErrors.paxCount.message}</p>
              ) : null}
            </label>

            <label className={fieldClassName}>
              <span>Total Bus Required</span>
              <input
                className={inputClassName}
                type="number"
                min={1}
                {...register("totalBusRequired")}
                placeholder={String(minimumBusCount)}
              />
              {identityErrors.totalBusRequired ? (
                <p className="text-xs font-semibold text-error">{identityErrors.totalBusRequired.message}</p>
              ) : null}
            </label>

            <p className={routeHintClassName}>
              <span className="sm:hidden">
                Min {minimumBusCount} bus for {safePaxForBusRule} pax.
              </span>
              <span className="hidden sm:inline">
                Minimum {minimumBusCount} bus for {safePaxForBusRule} pax (maximum 50 pax per bus).
                You can enter a higher number for additional requests.
              </span>
            </p>

            <label className={fieldClassName}>
              <span>Start Date</span>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <DatePickerInput
                    inputClassName={inputClassName}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {identityErrors.startDate ? (
                <p className="text-xs font-semibold text-error">{identityErrors.startDate.message}</p>
              ) : null}
            </label>

            <label className={fieldClassName}>
              <span>End Date</span>
              <Controller
                name="endDate"
                control={control}
                render={({ field }) => (
                  <DatePickerInput
                    inputClassName={inputClassName}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              {identityErrors.endDate ? (
                <p className="text-xs font-semibold text-error">{identityErrors.endDate.message}</p>
              ) : null}
            </label>
          </div>

          {hasInvalidDateRange ? (
            <div className={warningClassName}>
              <span className="material-symbols-outlined" aria-hidden="true">
                warning
              </span>
              <p>
                <span className="sm:hidden">End Date must be same/later than Start Date.</span>
                <span className="hidden sm:inline">End Date must be the same day or later than Start Date.</span>
              </p>
            </div>
          ) : null}

          {isTotalBusBelowMinimum ? (
            <div className={warningClassName}>
              <span className="material-symbols-outlined" aria-hidden="true">
                warning
              </span>
              <p>
                <span className="sm:hidden">Bus kurang. Minimal {minimumBusCount} bus.</span>
                <span className="hidden sm:inline">
                  Total buses are insufficient. For {safePaxForBusRule} pax, a minimum of{" "}
                  {minimumBusCount} buses is required.
                </span>
              </p>
            </div>
          ) : null}
        </section>

        <section className="serene-section">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-900">Musyrif Information</h2>
          </div>

          <div className={gridClassName}>
            <label className={fieldClassName}>
              <span>Musyrif Name</span>
              <input
                className={inputClassName}
                type="text"
                {...register("musyrifName")}
                placeholder="Ustadz Abdul Hakim"
              />
              {identityErrors.musyrifName ? (
                <p className="text-xs font-semibold text-error">{identityErrors.musyrifName.message}</p>
              ) : null}
            </label>

            <label className={fieldClassName}>
              <span>Phone Number</span>
              <input
                className={inputClassName}
                type="tel"
                {...register("musyrifPhone")}
                placeholder="+62 812-3456-7890"
              />
              {identityErrors.musyrifPhone ? (
                <p className="text-xs font-semibold text-error">{identityErrors.musyrifPhone.message}</p>
              ) : null}
            </label>
          </div>
        </section>
          </>
        ) : null}

        {!isIdentityOnlyMode && !isGroupReadyForItinerary ? (
          <section className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800" aria-hidden="true">
              <span className="material-symbols-outlined">assignment_turned_in</span>
            </div>
            <div>
              <h3 className="text-base font-semibold">Complete Group Information First</h3>
              <p className="mt-1 text-sm leading-relaxed text-amber-900/90">
                <span className="sm:hidden">Complete group info before adding itinerary.</span>
                <span className="hidden sm:inline">
                  Please fill in Group Number, Group Name, Package Type, Pax, Total Bus, date range,
                  and Musyrif information before adding itinerary items.
                </span>
              </p>
            </div>
          </section>
        ) : null}

        {!isIdentityOnlyMode ? (
          <>
        <section className="serene-section">
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Itinerary</h2>
            <div className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          </div>

          <div className="space-y-3">
            {itineraryItems.length > 0 ? (
              itineraryItems.map((item, index) => {
                const displayDate = formatScheduleDate(item.date);
                const routeSummary = formatRouteSummary(
                  item.categoryKey,
                  item.from,
                  item.to,
                  item.cityTourCity,
                );
                const fallbackMetaLine = `${item.transferByTrain
                  ? `Train ${formatScheduleTime(item.trainDepartureTime || item.time)} | Station Pickup ${formatScheduleTime(item.destinationPickupTime)}`
                  : formatScheduleTime(item.time)
                }${item.flightNumber ? ` | Flight ${item.flightNumber}` : ""}${
                  item.hotelPickupRequestTime
                    ? ` | Hotel Pickup Request ${formatScheduleTime(item.hotelPickupRequestTime)}`
                    : ""
                }${item.requiresBus ? " | Requires Bus" : ""}`;

                return (
                  <div key={item.id} className="grid grid-cols-[44px_1fr] gap-3">
                    <div className="flex flex-col items-center pt-0.5">
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-brand-neutral"
                        aria-hidden="true"
                      >
                        <span className="material-symbols-outlined text-base">{item.icon}</span>
                      </span>
                      {index < itineraryItems.length - 1 ? (
                        <span className="mt-2 h-full min-h-[54px] w-px bg-slate-200" aria-hidden="true" />
                      ) : null}
                    </div>

                    <article
                      className={`rounded-2xl border p-4 shadow-sm ${
                        itineraryCardClassMap[item.categoryKey] ?? "border-slate-200 bg-surface-container-lowest"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                            {displayDate.date} {displayDate.year}
                          </h3>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${
                                itineraryTagClassMap[item.categoryKey] ??
                                "border-slate-200 bg-slate-50 text-slate-700"
                              }`}
                            >
                              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                                {item.icon}
                              </span>
                              {item.category}
                            </span>
                            <p className="text-sm font-semibold text-slate-700">{routeSummary}</p>
                          </div>
                          <p className="mt-2 text-sm italic text-slate-600">{item.notes || fallbackMetaLine}</p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-brand-primary/10 hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={`Edit ${item.category} itinerary`}
                            onClick={() => handleEditItem(item)}
                            disabled={!isGroupReadyForItinerary}
                          >
                            <span className="material-symbols-outlined text-base" aria-hidden="true">
                              edit
                            </span>
                          </button>

                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-brand-tertiary/12 hover:text-brand-tertiary disabled:cursor-not-allowed disabled:opacity-45"
                            aria-label={`Delete ${item.category} itinerary`}
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={!isGroupReadyForItinerary}
                          >
                            <span className="material-symbols-outlined text-base" aria-hidden="true">
                              delete
                            </span>
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                );
              })
            ) : isBaseTripFormVisible ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-3">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <span className="material-symbols-outlined" aria-hidden="true">
                      route
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Structured 5 Base Trips</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="sm:hidden">Isi trip step 1-5. Yang tidak dipakai bisa di-skip.</span>
                      <span className="hidden sm:inline">
                        Isi trip secara bertahap dari step 1 sampai 5. Trip yang tidak dipakai bisa di-skip.
                      </span>
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        Step {currentBaseTripStepIndex + 1} of {baseTripDrafts.length || 5}
                      </p>
                      {activeBaseTrip ? (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${
                            activityTypeBadgeClassMap[activeBaseTrip.category] ??
                            "border-slate-300 bg-slate-50 text-slate-700"
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">
                            {getScheduleTypeOption(activeBaseTrip.category).icon}
                          </span>
                          <span>
                            {activeBaseTrip.title} - {enabledBaseTripCount} trip dipakai
                          </span>
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Activity type per trip
                    </p>

                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      {baseTripDrafts.map((trip, index) => {
                        const isCurrentStep = index === currentBaseTripStepIndex;
                        const isDisabledStep = !trip.isEnabled;
                        const isCompletedStep = !isBaseTripDraftInvalid(trip);
                        const stepToneClass =
                          activityTypeBadgeClassMap[trip.category] ??
                          "border-slate-300 bg-surface-container-lowest text-slate-600";
                        const activeStepToneClass =
                          activityTypeActiveStepClassMap[trip.category] ??
                          "border-brand-primary/40 bg-brand-primary/10 text-brand-primary";
                        const tripTypeLabel = `${getScheduleTypeOption(trip.category).cardLabel}${
                          trip.category === "city-tour" ? ` ${index === 1 ? "1" : "2"}` : ""
                        }`;

                        return (
                          <button
                            key={trip.id}
                            type="button"
                            className={`inline-flex min-h-12 items-center justify-start gap-2 rounded-xl border-2 px-3 text-left text-sm font-semibold transition ${
                              isCurrentStep
                                ? activeStepToneClass
                                : isDisabledStep
                                  ? "border-slate-200 bg-slate-100 text-slate-400"
                                : isCompletedStep
                                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                                  : `${stepToneClass} hover:border-brand-primary hover:text-brand-primary`
                            }`}
                            onClick={() => handleJumpToBaseTripStep(index)}
                            disabled={!isGroupReadyForItinerary}
                            aria-label={`Go to step ${index + 1}`}
                          >
                            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-surface-container-lowest px-2 text-xs font-bold text-brand-primary shadow-sm">
                              {index + 1}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-base" aria-hidden="true">
                                {getScheduleTypeOption(trip.category).icon}
                              </span>
                              <span className="text-xs sm:text-sm">{tripTypeLabel}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {(activeBaseTrip ? [activeBaseTrip] : []).map((item) => {
                  const showFlightNumberInput = isFlightActivityType(item.category);
                  const showHotelNameInput =
                    item.category === "arrival" ||
                    item.category === "transfer" ||
                    item.category === "departure";
                  const showDeparturePickupRequestInput = item.category === "departure";
                  const showTransferTrainInputs =
                    isTransferActivityType(item.category) && item.transferByTrain;
                  const showCityTourCityInput = isCityTourActivityType(item.category);
                  const activityCardToneClass =
                    activityTypeCardClassMap[item.category] ?? "border-slate-200 bg-surface-container-lowest";
                  const activityBannerToneClass =
                    activityTypeBannerClassMap[item.category] ?? "border-slate-200 bg-slate-50 text-slate-700";
                  const activityTitleToneClass = activityTypeTitleClassMap[item.category] ?? "text-slate-900";
                  const activityFocusLabel =
                    activityTypeFocusLabelMap[item.category] ?? `Activity Focus - ${getScheduleTypeOption(item.category).cardLabel}`;
                  const routeFieldConfigForItem = getRouteFieldConfigByCategory(item.category);
                  const showFridayWarningForItem = shouldShowFridayCityTourWarning(
                    item.category,
                    item.date,
                  );

                  return (
                    <article
                      key={item.id}
                      className={`rounded-2xl border-2 p-4 shadow-sm ${activityCardToneClass}`}
                    >
                      <div className={`mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 ${activityBannerToneClass}`}>
                        <span className="material-symbols-outlined text-base" aria-hidden="true">
                          {getScheduleTypeOption(item.category).icon}
                        </span>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em]">
                          {activityFocusLabel}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className={`text-base font-semibold ${activityTitleToneClass}`}>
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-600">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${
                              activityTypeBadgeClassMap[item.category] ??
                              "border-slate-300 bg-slate-50 text-slate-700"
                            }`}
                          >
                          <span className="material-symbols-outlined text-base" aria-hidden="true">
                            {getScheduleTypeOption(item.category).icon}
                          </span>
                            {getScheduleTypeOption(item.category).cardLabel}
                          </span>
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-surface-container-lowest px-2.5 py-1 text-xs font-bold leading-none text-slate-700">
                            <input
                              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-primary focus:ring-brand-primary/25"
                              type="checkbox"
                              checked={item.isEnabled}
                              onChange={(event) =>
                                updateBaseTripDraftAtIndex(currentBaseTripStepIndex, (trip) => ({
                                  ...trip,
                                  isEnabled: event.target.checked,
                                }))
                              }
                              disabled={!isGroupReadyForItinerary}
                            />
                            <span>Use trip</span>
                          </label>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className={fieldClassName}>
                          <span>Date</span>
                          <DatePickerInput
                            inputClassName={inputClassName}
                            value={item.date}
                            onChange={(nextValue) => handleBaseTripChange(currentBaseTripStepIndex, "date", nextValue)}
                            disabled={!isGroupReadyForItinerary || !item.isEnabled}
                          />
                        </label>

                        {!showTransferTrainInputs ? (
                          <label className={fieldClassName}>
                            <span>{item.category === "departure" ? "Flight Return Time" : "Time (Optional)"}</span>
                            <TimePickerInput
                              inputClassName={inputClassName}
                              value={item.time}
                              onChange={(nextValue) =>
                                handleBaseTripChange(currentBaseTripStepIndex, "time", nextValue)
                              }
                              disabled={!isGroupReadyForItinerary || !item.isEnabled}
                            />
                          </label>
                        ) : null}

                        {showFlightNumberInput ? (
                          <label className={wideFieldClassName}>
                            <span>Flight Number</span>
                            <input
                              className={inputClassName}
                              type="text"
                              value={item.flightNumber}
                              onChange={(event) =>
                                handleBaseTripChange(currentBaseTripStepIndex, "flightNumber", event.target.value)
                              }
                              placeholder="e.g. SV-827"
                              disabled={!isGroupReadyForItinerary || !item.isEnabled}
                            />
                          </label>
                        ) : null}

                        {showHotelNameInput ? (
                          <label className={wideFieldClassName}>
                            <span>Hotel Name</span>
                            <input
                              className={inputClassName}
                              type="text"
                              value={item.hotelName ?? ""}
                              onChange={(event) =>
                                handleBaseTripChange(currentBaseTripStepIndex, "hotelName", event.target.value)
                              }
                              placeholder="e.g. Swissotel Al Maqam"
                              disabled={!isGroupReadyForItinerary || !item.isEnabled}
                            />
                          </label>
                        ) : null}

                        {showDeparturePickupRequestInput ? (
                          <label className={wideFieldClassName}>
                            <span>Hotel Pickup Request Time</span>
                            <TimePickerInput
                              inputClassName={inputClassName}
                              value={item.hotelPickupRequestTime}
                              onChange={(nextValue) =>
                                handleBaseTripChange(currentBaseTripStepIndex, "hotelPickupRequestTime", nextValue)
                              }
                              disabled={!isGroupReadyForItinerary || !item.isEnabled}
                            />
                          </label>
                        ) : null}

                        {showCityTourCityInput ? (
                          <label className={wideFieldClassName}>
                            <span>City Tour City</span>
                            <div className="relative">
                              <span
                                className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                                aria-hidden="true"
                              >
                                location_city
                              </span>
                              <SereneSelect
                                className={`${selectClassName} pl-11`}
                                value={item.cityTourCity}
                                onChange={(event) =>
                                  handleBaseTripChange(currentBaseTripStepIndex, "cityTourCity", event.target.value)
                                }
                                disabled={!isGroupReadyForItinerary || !item.isEnabled}
                              >
                                <option value="">Select city in Saudi</option>
                              {saudiCityOptions.map((city) => (
                                  <option key={city} value={city}>
                                    {city}
                                  </option>
                                ))}
                              </SereneSelect>
                            </div>
                          </label>
                        ) : null}

                        {isTransferActivityType(item.category) ? (
                          <>
                            <div className={infoClassName}>
                              <span className="material-symbols-outlined" aria-hidden="true">
                                info
                              </span>
                              <p>
                                Jika antar kota menggunakan kereta cepat, isi waktu kereta dan waktu
                                pickup stasiun tujuan.
                              </p>
                            </div>

                            <label className={checkClassName}>
                              <input
                                className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                                type="checkbox"
                                checked={item.transferByTrain}
                                onChange={(event) =>
                                  updateBaseTripDraftAtIndex(currentBaseTripStepIndex, (trip) => ({
                                    ...trip,
                                    transferByTrain: event.target.checked,
                                    requiresBus: event.target.checked ? true : trip.requiresBus,
                                    trainDepartureTime: event.target.checked
                                      ? trip.trainDepartureTime
                                      : "",
                                    destinationPickupTime: event.target.checked
                                      ? trip.destinationPickupTime
                                      : "",
                                  }))
                                }
                                disabled={!isGroupReadyForItinerary || !item.isEnabled}
                              />
                              <span>Transfer using High-Speed Train (HHR)</span>
                            </label>
                          </>
                        ) : null}

                        <label className={fieldClassName}>
                          <span>{routeFieldConfigForItem.fromLabel}</span>
                          {shouldUseSaudiCityDropdown(item.category, "from") ? (
                            <div className="relative">
                              <span
                                className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                                aria-hidden="true"
                              >
                                location_city
                              </span>
                              <SereneSelect
                                className={`${selectClassName} pl-11`}
                                value={item.from}
                                onChange={(event) => handleBaseTripChange(currentBaseTripStepIndex, "from", event.target.value)}
                                disabled={!isGroupReadyForItinerary || !item.isEnabled}
                              >
                                <option value="">Select city in Saudi</option>
                              {saudiCityOptions.map((city) => (
                                  <option key={city} value={city}>
                                    {city}
                                  </option>
                                ))}
                              </SereneSelect>
                            </div>
                          ) : (
                            <input
                              className={inputClassName}
                              type="text"
                              value={item.from}
                              onChange={(event) => handleBaseTripChange(currentBaseTripStepIndex, "from", event.target.value)}
                              placeholder={routeFieldConfigForItem.fromPlaceholder}
                              disabled={!isGroupReadyForItinerary || !item.isEnabled}
                            />
                          )}
                        </label>

                        <label className={fieldClassName}>
                          <span>{routeFieldConfigForItem.toLabel}</span>
                          {shouldUseSaudiCityDropdown(item.category, "to") ? (
                            <div className="relative">
                              <span
                                className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                                aria-hidden="true"
                              >
                                location_city
                              </span>
                              <SereneSelect
                                className={`${selectClassName} pl-11`}
                                value={item.to}
                                onChange={(event) => handleBaseTripChange(currentBaseTripStepIndex, "to", event.target.value)}
                                disabled={!isGroupReadyForItinerary || !item.isEnabled}
                              >
                                <option value="">Select city in Saudi</option>
                              {saudiCityOptions.map((city) => (
                                  <option key={city} value={city}>
                                    {city}
                                  </option>
                                ))}
                              </SereneSelect>
                            </div>
                          ) : (
                            <input
                              className={inputClassName}
                              type="text"
                              value={item.to}
                              onChange={(event) => handleBaseTripChange(currentBaseTripStepIndex, "to", event.target.value)}
                              placeholder={routeFieldConfigForItem.toPlaceholder}
                              disabled={!isGroupReadyForItinerary || !item.isEnabled}
                            />
                          )}
                        </label>

                        {routeFieldConfigForItem.helperText ? (
                          <p className={routeHintClassName}>{routeFieldConfigForItem.helperText}</p>
                        ) : null}

                        {showTransferTrainInputs ? (
                          <div className={transferTrainCardClassName}>
                            <p className="text-sm font-semibold text-primary">
                              High-speed train transfer operational details
                            </p>

                            <div className={transferTrainGridClassName}>
                              <label className={fieldClassName}>
                                <span>Train Departure Time</span>
                                <TimePickerInput
                                  inputClassName={inputClassName}
                                  value={item.trainDepartureTime}
                                  onChange={(nextValue) =>
                                    handleBaseTripChange(currentBaseTripStepIndex, "trainDepartureTime", nextValue)
                                  }
                                  disabled={!isGroupReadyForItinerary || !item.isEnabled}
                                />
                              </label>

                              <label className={fieldClassName}>
                                <span>Destination Station Pickup Time</span>
                                <TimePickerInput
                                  inputClassName={inputClassName}
                                  value={item.destinationPickupTime}
                                  onChange={(nextValue) =>
                                    handleBaseTripChange(currentBaseTripStepIndex, "destinationPickupTime", nextValue)
                                  }
                                  disabled={!isGroupReadyForItinerary || !item.isEnabled}
                                />
                              </label>
                            </div>
                          </div>
                        ) : null}

                        {showFridayWarningForItem ? (
                          <div className={warningClassName}>
                            <span className="material-symbols-outlined" aria-hidden="true">
                              warning
                            </span>
                            <p>
                              Friday detected. Please align City Tour timing with Jumu&apos;ah prayer
                              schedule.
                            </p>
                          </div>
                        ) : null}

                        <label className={checkClassName}>
                          <input
                            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                            type="checkbox"
                            checked={showTransferTrainInputs ? true : item.requiresBus}
                            onChange={(event) =>
                              handleBaseTripChange(currentBaseTripStepIndex, "requiresBus", event.target.checked)
                            }
                            disabled={!isGroupReadyForItinerary || showTransferTrainInputs || !item.isEnabled}
                          />
                          <span>
                            {showTransferTrainInputs
                              ? "Bus Required (Luggage + Station Pickup)"
                              : "Requires Bus"}
                          </span>
                        </label>

                        <label className={wideFieldClassName}>
                          <span>Notes</span>
                          <textarea
                            className={textareaClassName}
                            rows={2}
                            value={item.notes}
                            onChange={(event) =>
                              handleBaseTripChange(currentBaseTripStepIndex, "notes", event.target.value)
                            }
                            placeholder="Enter special instructions or details..."
                            disabled={!isGroupReadyForItinerary || !item.isEnabled}
                          />
                        </label>
                      </div>

                      {!item.isEnabled ? (
                        <p className="mt-3 text-xs font-medium text-slate-500">
                          Trip ini di-skip dan tidak akan masuk ke itinerary.
                        </p>
                      ) : null}
                    </article>
                  );
                  })}
                </div>

                <div className="space-y-2 rounded-xl bg-slate-50 px-3 py-3">
                  <p
                    className={`text-xs font-medium ${
                      isActiveBaseTripInvalid ? "text-amber-700" : "text-emerald-700"
                    }`}
                  >
                    {enabledBaseTripCount === 0
                      ? "Pilih minimal 1 trip yang digunakan."
                      : isActiveBaseTripInvalid
                        ? "Step aktif belum lengkap. Pastikan tanggal, rute, dan field wajib sudah terisi."
                        : "Step aktif sudah lengkap."}
                  </p>

                  <div className="grid gap-3 sm:flex sm:items-center sm:justify-between">
                    <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
                      <button
                        type="button"
                        className="serene-btn-secondary min-h-10 w-full sm:w-auto"
                        onClick={() => handleBaseTripStepChange("previous")}
                        disabled={!isGroupReadyForItinerary || isFirstBaseTripStep}
                      >
                        Previous
                      </button>

                      <button
                        type="button"
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-brand-primary/35 bg-brand-primary/10 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                        onClick={() => handleBaseTripStepChange("next")}
                        disabled={!isGroupReadyForItinerary || isLastBaseTripStep}
                      >
                        Next
                      </button>
                    </div>

                    <div className="grid w-full grid-cols-1 gap-2 border-t border-slate-200 pt-3 sm:flex sm:w-auto sm:items-center sm:border-0 sm:pt-0">
                      <button
                        type="button"
                        className="serene-btn-primary min-h-10 w-full sm:w-auto"
                        onClick={handleSaveBaseTrips}
                        disabled={isBaseTripSaveDisabled}
                      >
                        <span className="sm:hidden">Save Trips</span>
                        <span className="hidden sm:inline">Save 5 Base Trips</span>
                      </button>
                      <button
                        type="button"
                        className="serene-btn-secondary min-h-10 w-full sm:w-auto"
                        onClick={handleCloseBaseTripForm}
                        disabled={!isGroupReadyForItinerary}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <article className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center">
                <span className="material-symbols-outlined" aria-hidden="true">
                  search_off
                </span>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">No itinerary found</h2>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="sm:hidden">Add schedule below to start itinerary.</span>
                  <span className="hidden sm:inline">Add a new schedule below to start building this itinerary.</span>
                </p>
              </article>
            )}

            {!isBaseTripFormVisible ? (
              <>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-primary/35 bg-brand-neutral px-4 py-3 text-base font-semibold text-brand-primary transition hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-45"
                  onClick={handleOpenCreateForm}
                  disabled={!isGroupReadyForItinerary}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    add_circle
                  </span>
                  <span className="sm:hidden">Add 5 Trips</span>
                  <span className="hidden sm:inline">Add 5 Base Trips</span>
                </button>

                <button
                  type="button"
                  className="serene-btn-secondary w-full"
                  onClick={handleOpenManualCreateForm}
                  disabled={!isGroupReadyForItinerary}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    add
                  </span>
                  <span className="sm:hidden">Add Manual Schedule</span>
                  <span className="hidden sm:inline">Add Single Schedule (Manual)</span>
                </button>
              </>
            ) : null}
          </div>
        </section>
        {isScheduleFormVisible && typeof document !== "undefined"
          ? createPortal(
              <div
                className="serene-modal-overlay fixed inset-0 z-[130] grid place-items-center p-3 sm:p-6"
                onClick={handleCloseScheduleForm}
                role="presentation"
              >
                <section
                  className="serene-modal-shell relative max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl sm:max-h-[calc(100dvh-3rem)]"
                  role="dialog"
                  aria-modal="true"
                  aria-label={editingItemId ? "Edit schedule details" : "Add schedule details"}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <span className="material-symbols-outlined" aria-hidden="true">
                          event_note
                        </span>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {editingItemId ? "Edit Schedule Details" : "Schedule Details"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          <span className="sm:hidden">Set timeline details.</span>
                          <span className="hidden sm:inline">Set timeline details for this group itinerary.</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant transition hover:text-primary"
                      onClick={handleCloseScheduleForm}
                      aria-label="Close schedule form"
                    >
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        close
                      </span>
                    </button>
                  </div>

                  <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto px-4 py-4 sm:px-5">
                    <div className={gridClassName}>
                <input type="hidden" {...registerSchedule("category")} />
                <input type="hidden" {...registerSchedule("fromHotelName")} />
                <div className={wideFieldClassName}>
                  <span>Activity Type</span>
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {scheduleTypeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 ${
                          form.category === option.value
                            ? "border-primary bg-emerald-50 text-primary"
                            : "border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                        }`}
                        onClick={() => {
                          const current = getScheduleValues();
                          const nextCategory = option.value;
                          const isNextTransfer = isTransferActivityType(nextCategory);
                          const nextFrom = shouldUseSaudiCityDropdown(nextCategory, "from")
                            ? normalizeSaudiCityValue(current.from)
                            : current.from;
                          const nextTo = shouldUseSaudiCityDropdown(nextCategory, "to")
                            ? normalizeSaudiCityValue(current.to)
                            : current.to;
                          const nextDraft: ManualScheduleFormValues = {
                            ...current,
                            category: nextCategory,
                            from: nextFrom,
                            to: nextTo,
                            cityTourCity: isCityTourActivityType(option.value)
                              ? current.cityTourCity
                              : "",
                            flightNumber: isFlightActivityType(option.value)
                              ? current.flightNumber
                              : "",
                            hotelPickupRequestTime: option.value === "departure"
                              ? current.hotelPickupRequestTime
                              : "",
                            transferByTrain: isNextTransfer ? current.transferByTrain : false,
                            trainDepartureTime: isNextTransfer ? current.trainDepartureTime : "",
                            destinationPickupTime: isNextTransfer
                              ? current.destinationPickupTime
                              : "",
                          };

                          applyManualScheduleDraft(nextDraft);
                        }}
                        disabled={!isGroupReadyForItinerary}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {option.icon}
                        </span>
                        <span>{option.modalLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className={fieldClassName}>
                  <span>Date</span>
                  <Controller
                    name="date"
                    control={scheduleControl}
                    render={({ field }) => (
                      <DatePickerInput
                        inputClassName={inputClassName}
                        value={field.value}
                        onChange={(nextValue) => handleFormChange("date", nextValue)}
                        disabled={!isGroupReadyForItinerary}
                      />
                    )}
                  />
                  {scheduleErrors.date ? (
                    <p className="text-xs font-semibold text-error">{scheduleErrors.date.message}</p>
                  ) : null}
                </label>

                {!showTransferTrainFields ? (
                  <label className={fieldClassName}>
                    <span>{form.category === "departure" ? "Flight Return Time" : "Time (Optional)"}</span>
                    <Controller
                      name="time"
                      control={scheduleControl}
                      render={({ field }) => (
                        <TimePickerInput
                          inputClassName={inputClassName}
                          value={field.value}
                          onChange={(nextValue) => handleFormChange("time", nextValue)}
                          disabled={!isGroupReadyForItinerary}
                        />
                      )}
                    />
                    {scheduleErrors.time ? (
                      <p className="text-xs font-semibold text-error">{scheduleErrors.time.message}</p>
                    ) : null}
                  </label>
                ) : null}

                {showFlightNumberField ? (
                  <label className={wideFieldClassName}>
                    <span>Flight Number</span>
                    <Controller
                      name="flightNumber"
                      control={scheduleControl}
                      render={({ field }) => (
                        <input
                          className={inputClassName}
                          type="text"
                          value={field.value}
                          onChange={(event) => handleFormChange("flightNumber", event.target.value)}
                          placeholder="e.g. SV-827"
                          disabled={!isGroupReadyForItinerary}
                        />
                      )}
                    />
                    {scheduleErrors.flightNumber ? (
                      <p className="text-xs font-semibold text-error">{scheduleErrors.flightNumber.message}</p>
                    ) : null}
                  </label>
                ) : null}

                {showHotelNameField ? (
                  <label className={wideFieldClassName}>
                    <span>Hotel Name</span>
                    <Controller
                      name="hotelName"
                      control={scheduleControl}
                      render={({ field }) => (
                        <input
                          className={inputClassName}
                          type="text"
                          value={field.value ?? ""}
                          onChange={(event) => handleFormChange("hotelName", event.target.value)}
                          placeholder="e.g. Pullman Zamzam Madinah"
                          disabled={!isGroupReadyForItinerary}
                        />
                      )}
                    />
                    {scheduleErrors.hotelName ? (
                      <p className="text-xs font-semibold text-error">{scheduleErrors.hotelName.message}</p>
                    ) : null}
                  </label>
                ) : null}

                {showCityTourCityField ? (
                  <label className={wideFieldClassName}>
                    <span>City Tour City</span>
                    <div className="relative">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500" aria-hidden="true">
                        location_city
                      </span>
                      <Controller
                        name="cityTourCity"
                        control={scheduleControl}
                        render={({ field }) => (
                          <SereneSelect
                            className={`${selectClassName} pl-11`}
                            value={field.value}
                            onChange={(event) => handleFormChange("cityTourCity", event.target.value)}
                            disabled={!isGroupReadyForItinerary}
                          >
                            <option value="">Select city in Saudi</option>
                            {saudiCityOptions.map((city) => (
                              <option key={city} value={city}>
                                {city}
                              </option>
                            ))}
                          </SereneSelect>
                        )}
                      />
                    </div>
                    <p className="text-xs text-slate-600">Select the city where the city tour takes place.</p>
                    {scheduleErrors.cityTourCity ? (
                      <p className="text-xs font-semibold text-error">{scheduleErrors.cityTourCity.message}</p>
                    ) : null}
                  </label>
                ) : null}

                {showDeparturePickupField ? (
                  <label className={wideFieldClassName}>
                    <span>Hotel Pickup Request Time</span>
                    <Controller
                      name="hotelPickupRequestTime"
                      control={scheduleControl}
                      render={({ field }) => (
                        <TimePickerInput
                          inputClassName={inputClassName}
                          value={field.value}
                          onChange={(nextValue) => handleFormChange("hotelPickupRequestTime", nextValue)}
                          disabled={!isGroupReadyForItinerary}
                        />
                      )}
                    />
                    {scheduleErrors.hotelPickupRequestTime ? (
                      <p className="text-xs font-semibold text-error">{scheduleErrors.hotelPickupRequestTime.message}</p>
                    ) : null}
                  </label>
                ) : null}

                {showFridayCityTourWarning ? (
                  <div className={warningClassName}>
                    <span className="material-symbols-outlined" aria-hidden="true">
                      warning
                    </span>
                    <p>
                      Friday detected. Please align City Tour timing with Jumu&apos;ah prayer
                      schedule.
                    </p>
                  </div>
                ) : null}

                {isTransferActivityType(form.category) ? (
                  <>
                    <div className={infoClassName}>
                      <span className="material-symbols-outlined" aria-hidden="true">
                        info
                      </span>
                      <p>
                        If transfer uses a high-speed train, buses are still needed for hotel
                        luggage pickup, pilgrim drop-off at the station, and pickup at the
                        destination station.
                      </p>
                    </div>

                    <label className={checkClassName}>
                      <Controller
                        name="transferByTrain"
                        control={scheduleControl}
                        render={({ field }) => (
                          <input
                            className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                            type="checkbox"
                            checked={field.value}
                            onChange={(event) => {
                              const current = getScheduleValues();
                              applyManualScheduleDraft({
                                ...current,
                                transferByTrain: event.target.checked,
                                requiresBus: event.target.checked ? true : current.requiresBus,
                                trainDepartureTime: event.target.checked
                                  ? current.trainDepartureTime
                                  : "",
                                destinationPickupTime: event.target.checked
                                  ? current.destinationPickupTime
                                  : "",
                              });
                            }}
                            disabled={!isGroupReadyForItinerary}
                          />
                        )}
                      />
                      <span>Transfer using High-Speed Train (HHR)</span>
                    </label>
                  </>
                ) : null}

                <label className={fieldClassName}>
                  <span>{routeFieldConfig.fromLabel}</span>
                  {shouldUseSaudiCityDropdown(form.category, "from") ? (
                    <div className="relative">
                      <span
                        className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                        aria-hidden="true"
                      >
                        location_city
                      </span>
                      <Controller
                        name="from"
                        control={scheduleControl}
                        render={({ field }) => (
                          <SereneSelect
                            className={`${selectClassName} pl-11`}
                            value={field.value}
                            onChange={(event) => handleFormChange("from", event.target.value)}
                            disabled={!isGroupReadyForItinerary}
                          >
                            <option value="">Select city in Saudi</option>
                            {saudiCityOptions.map((city) => (
                              <option key={city} value={city}>
                                {city}
                              </option>
                            ))}
                          </SereneSelect>
                        )}
                      />
                    </div>
                  ) : (
                    <Controller
                      name="from"
                      control={scheduleControl}
                      render={({ field }) => (
                        <input
                          className={inputClassName}
                          type="text"
                          value={field.value}
                          onChange={(event) => handleFormChange("from", event.target.value)}
                          placeholder={routeFieldConfig.fromPlaceholder}
                          disabled={!isGroupReadyForItinerary}
                        />
                      )}
                    />
                  )}
                  {scheduleErrors.from ? (
                    <p className="text-xs font-semibold text-error">{scheduleErrors.from.message}</p>
                  ) : null}
                </label>

                <label className={fieldClassName}>
                  <span>{routeFieldConfig.toLabel}</span>
                  {shouldUseSaudiCityDropdown(form.category, "to") ? (
                    <div className="relative">
                      <span
                        className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-slate-500"
                        aria-hidden="true"
                      >
                        location_city
                      </span>
                      <Controller
                        name="to"
                        control={scheduleControl}
                        render={({ field }) => (
                          <SereneSelect
                            className={`${selectClassName} pl-11`}
                            value={field.value}
                            onChange={(event) => handleFormChange("to", event.target.value)}
                            disabled={!isGroupReadyForItinerary}
                          >
                            <option value="">Select city in Saudi</option>
                            {saudiCityOptions.map((city) => (
                              <option key={city} value={city}>
                                {city}
                              </option>
                            ))}
                          </SereneSelect>
                        )}
                      />
                    </div>
                  ) : (
                    <Controller
                      name="to"
                      control={scheduleControl}
                      render={({ field }) => (
                        <input
                          className={inputClassName}
                          type="text"
                          value={field.value}
                          onChange={(event) => handleFormChange("to", event.target.value)}
                          placeholder={routeFieldConfig.toPlaceholder}
                          disabled={!isGroupReadyForItinerary}
                        />
                      )}
                    />
                  )}
                  {scheduleErrors.to ? (
                    <p className="text-xs font-semibold text-error">{scheduleErrors.to.message}</p>
                  ) : null}
                </label>

                {routeFieldConfig.helperText ? (
                  <p className={routeHintClassName}>{routeFieldConfig.helperText}</p>
                ) : null}

                {showTransferTrainFields ? (
                  <div className={transferTrainCardClassName}>
                    <p className="text-sm font-semibold text-primary">
                      High-speed train transfer operational details
                    </p>

                    <div className={transferTrainGridClassName}>
                      <label className={fieldClassName}>
                        <span>Train Departure Time</span>
                        <Controller
                          name="trainDepartureTime"
                          control={scheduleControl}
                          render={({ field }) => (
                            <TimePickerInput
                              inputClassName={inputClassName}
                              value={field.value}
                              onChange={(nextValue) => handleFormChange("trainDepartureTime", nextValue)}
                              disabled={!isGroupReadyForItinerary}
                            />
                          )}
                        />
                        {scheduleErrors.trainDepartureTime ? (
                          <p className="text-xs font-semibold text-error">{scheduleErrors.trainDepartureTime.message}</p>
                        ) : null}
                      </label>

                      <label className={fieldClassName}>
                        <span>Destination Station Pickup Time</span>
                        <Controller
                          name="destinationPickupTime"
                          control={scheduleControl}
                          render={({ field }) => (
                            <TimePickerInput
                              inputClassName={inputClassName}
                              value={field.value}
                              onChange={(nextValue) =>
                                handleFormChange("destinationPickupTime", nextValue)
                              }
                              disabled={!isGroupReadyForItinerary}
                            />
                          )}
                        />
                        {scheduleErrors.destinationPickupTime ? (
                          <p className="text-xs font-semibold text-error">{scheduleErrors.destinationPickupTime.message}</p>
                        ) : null}
                      </label>
                    </div>
                  </div>
                ) : null}

                <label className={checkClassName}>
                  <Controller
                    name="requiresBus"
                    control={scheduleControl}
                    render={({ field }) => (
                      <input
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-200"
                        type="checkbox"
                        checked={showTransferTrainFields ? true : field.value}
                        onChange={(event) => handleFormChange("requiresBus", event.target.checked)}
                        disabled={!isGroupReadyForItinerary || showTransferTrainFields}
                      />
                    )}
                  />
                  <span>
                    {showTransferTrainFields
                      ? "Bus Required (Luggage + Station Pickup)"
                      : "Requires Bus"}
                  </span>
                </label>

                <label className={wideFieldClassName}>
                  <span>Notes</span>
                  <Controller
                    name="notes"
                    control={scheduleControl}
                    render={({ field }) => (
                      <textarea
                        className={textareaClassName}
                        rows={3}
                        value={field.value}
                        onChange={(event) => handleFormChange("notes", event.target.value)}
                        placeholder="Enter special instructions or details..."
                        disabled={!isGroupReadyForItinerary}
                      />
                    )}
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  className="serene-btn-primary min-h-10 w-full sm:w-auto"
                  onClick={handleSaveItem}
                  disabled={isFormDisabled}
                >
                  {editingItemId ? "Update Timeline" : "Add to Timeline"}
                </button>
                <button
                  type="button"
                  className="serene-btn-secondary min-h-10 w-full sm:w-auto"
                  onClick={handleCloseScheduleForm}
                  disabled={!isGroupReadyForItinerary}
                >
                  Cancel
                </button>
              </div>
                  </div>
                </section>
              </div>,
              document.body,
            )
          : null}

        {!hideSaveAction ? (
          <section className="serene-section text-center">
            <button
              type="button"
              className="serene-btn-primary min-h-11 w-full px-5 sm:w-auto"
              onClick={handleSaveGroup}
              disabled={isGroupSaveDisabled}
            >
              Save Itinerary
            </button>
            <p className="mt-2 text-sm text-slate-600">
              <span className="sm:hidden">Saved data will appear on Overview.</span>
              <span className="hidden sm:inline">After saving, the group data will appear on the Overview page.</span>
            </p>
          </section>
        ) : null}
          </>
        ) : null}

      </div>
    </>
  );
}




