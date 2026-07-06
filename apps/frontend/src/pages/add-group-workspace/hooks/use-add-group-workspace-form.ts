import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFieldArray, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v4";
import * as Domain from "../../../shared/app-domain";
import { useSaudiCityOptions } from "../../../hooks/use-saudi-city-options";
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
} from "../../add-group-workspace-helpers";
import type {
  GroupData,
  InputItineraryFormState,
  InputItineraryItem,
  ItineraryPrefill,
  NewGroupItineraryDraft,
} from "../../../shared/app-domain";

const {
  createInitialInputItineraryForm,
  expandInputTransferTrainItems,
  getMinimumBusCountForPax,
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
  saudiCityOptions: defaultSaudiCityOptions,
  shouldShowFridayCityTourWarning,
  sortInputItineraryItems,
} = Domain;

function createIdentityFormSchema(requireIdentityFields: boolean) {
  return z
    .object({
      groupNumber: requireIdentityFields ? z.string().trim().min(1, "Group number wajib diisi.") : z.string(),
      groupName: requireIdentityFields ? z.string().trim().min(1, "Group name wajib diisi.") : z.string(),
      packageType: requireIdentityFields ? z.string().trim().min(1, "Package type wajib diisi.") : z.string(),
      busStatus: z.enum(["Visa Only", "Visa+"]),
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
      startDate: requireIdentityFields ? z.string().trim().min(1, "Start date wajib diisi.") : z.string(),
      endDate: requireIdentityFields ? z.string().trim().min(1, "End date wajib diisi.") : z.string(),
      musyrifName: requireIdentityFields ? z.string().trim().min(1, "Nama musyrif wajib diisi.") : z.string(),
      musyrifPhone: requireIdentityFields ? z.string().trim().min(1, "Nomor telepon musyrif wajib diisi.") : z.string(),
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

export type IdentityFormValues = z.infer<ReturnType<typeof createIdentityFormSchema>>;

const manualScheduleFormBaseSchema = z.object({
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
});

type ManualScheduleValidationValues = {
  date: string;
  time: string;
  category: string;
  hotelName?: string;
  fromHotelName?: string;
  from: string;
  to: string;
  cityTourCity: string;
  flightNumber: string;
  requiresBus: boolean;
  notes: string;
  transferByTrain: boolean;
  trainDepartureTime: string;
  destinationPickupTime: string;
  hotelPickupRequestTime: string;
};

function validateManualSchedule(values: ManualScheduleValidationValues, context: z.RefinementCtx): void {
  if (isFlightActivityType(values.category) && !values.flightNumber.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["flightNumber"],
      message: "Nomor penerbangan wajib diisi.",
    });
  }

  const isHotelNameRequired = values.category === "arrival" || values.category === "departure";
  if (isHotelNameRequired && !(values.hotelName?.trim() ?? "")) {
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
}

export const manualScheduleFormSchema = manualScheduleFormBaseSchema.superRefine(validateManualSchedule);

export type ManualScheduleFormValues = z.infer<typeof manualScheduleFormSchema>;

const baseTripDraftSchema = manualScheduleFormBaseSchema
  .omit({
    hotelName: true,
    fromHotelName: true,
  })
  .extend({
    hotelName: z.string().optional(),
    fromHotelName: z.string().optional(),
    id: z.string(),
    title: z.string(),
    description: z.string(),
    isEnabled: z.boolean(),
  })
  .superRefine(validateManualSchedule);

const baseTripFormSchema = z.object({
  trips: z.array(baseTripDraftSchema),
});

export type BaseTripFormValues = z.infer<typeof baseTripFormSchema>;

export function useAddGroupWorkspaceForm({
  onSaveGroup,
  onItineraryDraftChange,
  sectionMode = "full",
  identityDraft = null,
  emitIdentityInDraft = true,
  itineraryPrefill = null,
}: {
  onSaveGroup: (group: GroupData) => void;
  onItineraryDraftChange?: (draft: NewGroupItineraryDraft | null) => void;
  sectionMode?: ItinerarySectionMode;
  identityDraft?: NewGroupItineraryDraft | null;
  emitIdentityInDraft?: boolean;
  itineraryPrefill?: ItineraryPrefill | null;
}) {
  const saudiCityOptions = useSaudiCityOptions(defaultSaudiCityOptions);
  const identityFormSchema = useMemo(() => createIdentityFormSchema(sectionMode !== "schedule-only"), [sectionMode]);
  const identityMethods = useForm<IdentityFormValues>({
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
      busStatus: "Visa Only",
    },
  });

  const scheduleMethods = useForm<ManualScheduleFormValues>({
    resolver: zodResolver(manualScheduleFormSchema),
    mode: "onChange",
    defaultValues: createInitialInputItineraryForm(),
  });

  const baseTripMethods = useForm<BaseTripFormValues>({
    resolver: zodResolver(baseTripFormSchema),
    mode: "onChange",
    defaultValues: {
      trips: [],
    },
  });

  const { replace: replaceBaseTripFields } = useFieldArray({
    control: baseTripMethods.control,
    name: "trips",
    keyName: "fieldKey",
  });

  const [itineraryItems, setItineraryItems] = useState<InputItineraryItem[]>([]);
  const form = scheduleMethods.watch();
  const baseTripDrafts = baseTripMethods.watch("trips") ?? [];
  const [baseTripStepIndex, setBaseTripStepIndex] = useState(0);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isScheduleFormVisible, setIsScheduleFormVisible] = useState(false);
  const [isBaseTripFormVisible, setIsBaseTripFormVisible] = useState(false);
  const [initializedScheduleSeed, setInitializedScheduleSeed] = useState<string | null>(null);
  const manualFormSuggestedHotelNameRef = useRef("");
  const baseTripSuggestedHotelByIdRef = useRef<Record<string, string>>({});

  const groupNumber = identityMethods.watch("groupNumber");
  const groupName = identityMethods.watch("groupName");
  const packageType = identityMethods.watch("packageType");
  const paxCount = identityMethods.watch("paxCount");
  const totalBusRequired = identityMethods.watch("totalBusRequired");
  const startDate = identityMethods.watch("startDate");
  const endDate = identityMethods.watch("endDate");
  const musyrifName = identityMethods.watch("musyrifName");
  const musyrifPhone = identityMethods.watch("musyrifPhone");
  const busStatusValue = identityMethods.watch("busStatus");

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
    effectiveBusStatus,
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
    busStatus: busStatusValue,
  });

  const validationState = buildInputItineraryValidationState({
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

  const { isGroupReadyForItinerary, showFlightNumberField, showCityTourCityField, isFormDisabled } = validationState;

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
    const initialMap: { makkah?: string; madinah?: string; [key: string]: string | undefined } = {};
    const directMap = itineraryPrefill?.cityHotelNames;
    if (directMap?.makkah?.trim()) {
      initialMap.makkah = directMap.makkah.trim();
    }
    if (directMap?.madinah?.trim()) {
      initialMap.madinah = directMap.madinah.trim();
    }

    const trips = (itineraryPrefill?.trips ?? {}) as Record<string, any>;
    for (const trip of Object.values(trips)) {
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

      if (draft.category === "arrival" || draft.category === "transfer") {
        return resolveHotelNameByCity(draft.to);
      }

      if (draft.category === "city-tour") {
        return resolveHotelNameByCity(draft.cityTourCity);
      }

      return "";
    },
    [resolveHotelNameByCity],
  );

  const applyHotelAutofill = useCallback(
    <
      FormShape extends {
        category: string;
        from: string;
        to: string;
        cityTourCity: string;
        hotelName?: string;
      },
    >(
      draft: FormShape,
      previousSuggestedHotelName = "",
    ): {
      nextDraft: FormShape;
      suggestedHotelName: string;
    } => {
      const suggestedHotelName = resolveSuggestedHotelName(draft).trim();
      const currentHotelName = draft.hotelName?.trim() ?? "";
      const shouldRefreshHotelName =
        !currentHotelName || (!!previousSuggestedHotelName && currentHotelName === previousSuggestedHotelName);
      const nextDraft = {
        ...draft,
        hotelName: shouldRefreshHotelName ? suggestedHotelName : currentHotelName,
      } as FormShape;
      const normalizedFrom = nextDraft.from.trim().toLowerCase();
      const isPlainCityMeetingPoint = normalizedFrom === "makkah" || normalizedFrom === "madinah";

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
    },
    [resolveSuggestedHotelName],
  );

  const applyHotelAutofillForManualForm = useCallback(
    (draft: InputItineraryFormState): InputItineraryFormState => {
      const { nextDraft, suggestedHotelName } = applyHotelAutofill(draft, manualFormSuggestedHotelNameRef.current);
      manualFormSuggestedHotelNameRef.current = suggestedHotelName;
      return nextDraft;
    },
    [applyHotelAutofill],
  );

  const applyHotelAutofillForBaseTrip = useCallback(
    (draft: BaseTripDraft): BaseTripDraft => {
      const previousSuggestedHotelName = baseTripSuggestedHotelByIdRef.current[draft.id] ?? "";
      const { nextDraft, suggestedHotelName } = applyHotelAutofill(draft, previousSuggestedHotelName);
      baseTripSuggestedHotelByIdRef.current[draft.id] = suggestedHotelName;
      return nextDraft;
    },
    [applyHotelAutofill],
  );

  const seedBaseTripHotelSuggestions = useCallback(
    (drafts: BaseTripDraft[]): BaseTripDraft[] => {
      const nextSuggestedById: Record<string, string> = {};
      const nextDrafts = drafts.map((draft) => {
        const { nextDraft, suggestedHotelName } = applyHotelAutofill(draft);
        nextSuggestedById[draft.id] = suggestedHotelName;
        return nextDraft;
      });
      baseTripSuggestedHotelByIdRef.current = nextSuggestedById;
      return nextDrafts;
    },
    [applyHotelAutofill],
  );

  const replaceBaseTripDrafts = useCallback(
    (drafts: BaseTripDraft[]) => {
      replaceBaseTripFields(drafts);
    },
    [replaceBaseTripFields],
  );

  const updateBaseTripDraftAtIndex = (tripIndex: number, updater: (draft: BaseTripDraft) => BaseTripDraft) => {
    const currentTrips = baseTripMethods.getValues("trips");
    const nextTrips = currentTrips.map((trip, index) =>
      index === tripIndex ? applyHotelAutofillForBaseTrip(updater(trip)) : trip,
    );
    baseTripMethods.setValue("trips", nextTrips, {
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
      scheduleMethods.setValue(field, value, {
        shouldDirty,
        shouldValidate,
      });
    });
  };

  const handleFormChange = <Key extends keyof ManualScheduleFormValues>(
    field: Key,
    value: ManualScheduleFormValues[Key],
  ) => {
    const current = scheduleMethods.getValues();
    applyManualScheduleDraft({
      ...current,
      [field]: value,
    });
  };

  const handlePaxCountChange = (value: string) => {
    identityMethods.setValue("paxCount", value, { shouldDirty: true, shouldValidate: true });

    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
      return;
    }

    const nextMinimumBusCount = getMinimumBusCountForPax(parsedValue);
    if (!identityMethods.getValues("totalBusRequired").trim()) {
      identityMethods.setValue("totalBusRequired", String(nextMinimumBusCount), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const handleResetForm = useCallback(() => {
    manualFormSuggestedHotelNameRef.current = "";
    scheduleMethods.reset(createInitialInputItineraryForm());
    setEditingItemId(null);
  }, [scheduleMethods]);

  const handleOpenCreateForm = () => {
    if (!isGroupReadyForItinerary) {
      return;
    }

    setIsScheduleFormVisible(false);
    setEditingItemId(null);
    const nextBaseTripDrafts = createBaseTripDrafts(effectiveStartDate, effectiveEndDate, itineraryPrefill);
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

  const handleCloseScheduleForm = useCallback(() => {
    handleResetForm();
    setIsScheduleFormVisible(false);
  }, [handleResetForm]);

  const handleCloseBaseTripForm = () => {
    baseTripSuggestedHotelByIdRef.current = {};
    baseTripMethods.reset({ trips: [] });
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
  }, [handleCloseScheduleForm, isScheduleFormVisible]);

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
    const nextFrom = shouldUseSaudiCityDropdown(nextCategory, "from") ? normalizeSaudiCityValue(item.from) : item.from;
    const nextTo = shouldUseSaudiCityDropdown(nextCategory, "to") ? normalizeSaudiCityValue(item.to) : item.to;
    scheduleMethods.reset(
      applyHotelAutofillForManualForm({
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
      }),
    );
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

  const handleSaveItem = scheduleMethods.handleSubmit((values) => {
    if (!isGroupReadyForItinerary || isFormDisabled) {
      return;
    }

    const typeOption = getScheduleTypeOption(values.category);
    const nextFlightNumber = showFlightNumberField ? values.flightNumber.trim() : "";
    const isHotelNameRequired = values.category === "arrival" || values.category === "departure";
    const nextHotelName = isHotelNameRequired ? values.hotelName?.trim() || resolveSuggestedHotelName(values) : "";
    const nextHotelPickupRequestTime = values.category === "departure" ? values.hotelPickupRequestTime.trim() : "";
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
      const draftItems = editingItemId ? current.filter((item) => item.id !== editingItemId) : current;
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
      const isHotelNameRequired = item.category === "arrival" || item.category === "departure";
      const nextHotelName = isHotelNameRequired ? item.hotelName?.trim() || resolveSuggestedHotelName(item) : "";
      const hotelPickupRequestTime = item.category === "departure" ? item.hotelPickupRequestTime.trim() : "";

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
    const parsedTotalBusRequired = Number.parseInt(effectiveTotalBusRequiredValue, 10);
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

    const nextBaseTripDrafts = createBaseTripDrafts(effectiveStartDate, effectiveEndDate, itineraryPrefill);
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
    replaceBaseTripDrafts,
    schedulePrefillSeed,
    seedBaseTripHotelSuggestions,
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
      pax: Number.isFinite(parsedDraftPax) && parsedDraftPax > 0 ? parsedDraftPax : undefined,
      totalBuses:
        Number.isFinite(parsedDraftTotalBuses) && parsedDraftTotalBuses > 0 ? parsedDraftTotalBuses : undefined,
      packageName: effectivePackageType.trim(),
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      musyrifName: effectiveMusyrifName.trim(),
      musyrifPhone: effectiveMusyrifPhone.trim(),
      busStatus: effectiveBusStatus,
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
      onItineraryDraftChange(emitIdentityInDraft ? (hasDraftBaseValue ? baseDraft : null) : null);
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

  return {
    saudiCityOptions,
    identityMethods,
    scheduleMethods,
    baseTripMethods,
    itineraryItems,
    setItineraryItems,
    form,
    baseTripDrafts,
    baseTripStepIndex,
    editingItemId,
    isScheduleFormVisible,
    isBaseTripFormVisible,
    validationState,
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
     effectiveBusStatus,
    enabledBaseTripCount,
    isBaseTripSaveDisabled,
    isFirstBaseTripStep,
    isLastBaseTripStep,
    isActiveBaseTripInvalid,
    isGroupSaveDisabled,
    showFridayCityTourWarning,
    currentBaseTripStepIndex,
    activeBaseTrip,
    maxBaseTripStepIndex,
    handleFormChange,
    handlePaxCountChange,
    handleOpenCreateForm,
    handleOpenManualCreateForm,
    handleCloseScheduleForm,
    handleCloseBaseTripForm,
    handleBaseTripStepChange,
    handleJumpToBaseTripStep,
    handleBaseTripChange,
    handleEditItem,
    handleDeleteItem,
    handleSaveItem,
    handleSaveBaseTrips,
    handleSaveGroup,
  };
}
