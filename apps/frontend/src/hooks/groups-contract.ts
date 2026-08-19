import { z } from "zod";
import { backendGroupLifecycleStatuses } from "../shared/backend-enums";

const backendDateValueSchema = z.union([z.string(), z.date()]);

const backendNextActivitySchema = z
  .object({
    title: z.string().optional(),
    dateLabel: z.string().optional(),
    timeLabel: z.string().optional(),
    icon: z.string().optional(),
  })
  .passthrough();

const backendTimelineItemSchema = z
  .object({
    sortOrder: z.number().optional(),
    dateLabel: z.string().optional(),
    title: z.string().optional(),
    isCurrent: z.boolean().optional(),
    nextActivity: z.string().nullable().optional(),
  })
  .passthrough();

const backendItineraryItemSchema = z
  .object({
    sortOrder: z.number().optional(),
    dateLabel: z.string().optional(),
    yearLabel: z.string().optional(),
    category: z.string().optional(),
    categoryKey: z.string().nullable().optional(),
    title: z.string().optional(),
    meta: z.string().optional(),
    icon: z.string().optional(),
    highlighted: z.boolean().optional(),
    isoDate: backendDateValueSchema.nullable().optional(),
    time: z.string().nullable().optional(),
    transportMode: z.string().nullable().optional(),
    flightNumber: z.string().nullable().optional(),
    hotelName: z.string().nullable().optional(),
    fromHotelName: z.string().nullable().optional(),
    fromLocation: z.string().nullable().optional(),
    toLocation: z.string().nullable().optional(),
    cityTourCity: z.string().nullable().optional(),
    requiresBus: z.boolean().optional(),
    notes: z.string().nullable().optional(),
    transferByTrain: z.boolean().optional(),
    trainDepartureTime: z.string().nullable().optional(),
    destinationPickupTime: z.string().nullable().optional(),
    hotelPickupRequestTime: z.string().nullable().optional(),
  })
  .passthrough();

const backendNoteSchema = z
  .object({
    sortOrder: z.number().optional(),
    text: z.string().optional(),
    pinned: z.boolean().optional(),
  })
  .passthrough();

const backendHotelAgreementSchema = z
  .object({
    id: z.string().optional(),
    city: z.string().optional(),
    sourceDraftId: z.string().nullable().optional(),
    hotelName: z.string().optional(),
    agreementNumber: z.string().optional(),
    pax: z.number().optional(),
    status: z.string().optional(),
    stayStart: backendDateValueSchema.optional(),
    stayEnd: backendDateValueSchema.optional(),
  })
  .passthrough();

const backendRaudhahAppointmentSchema = z
  .object({
    id: z.string().optional(),
    date: backendDateValueSchema.optional(),
    status: z.string().optional(),
    tasrehPrinted: z.boolean().optional(),
  })
  .passthrough();

const backendVisaSetupSchema = z
  .object({
    visaStatus: z.string().optional(),
    issuedDate: backendDateValueSchema.nullable().optional(),
    syarikah: z.string().optional(),
    busStatus: z.string().nullable().optional(),
    paymentStatus: z.string().optional(),
    makkahHotelWaived: z.boolean().optional(),
    madinahHotelWaived: z.boolean().optional(),
    hotelAgreements: z.array(backendHotelAgreementSchema).nullable().optional(),
    raudhahAppointments: z.array(backendRaudhahAppointmentSchema).nullable().optional(),
  })
  .passthrough();

const backendChecklistDriverSchema = z
  .object({
    slotNumber: z.number().optional(),
    name: z.string().optional(),
    phone: z.string().optional(),
    plateNumber: z.string().optional(),
    isVerified: z.boolean().optional(),
  })
  .passthrough();

const backendChecklistAssignmentSchema = z
  .object({
    id: z.string().optional(),
    itineraryItemId: z.string().nullable().optional(),
    tripDate: backendDateValueSchema.optional(),
    activity: z.string().optional(),
    tripLabel: z.string().optional(),
    requiredBusCount: z.number().optional(),
    scheduledTime: z.string().optional(),
    transferByTrain: z.boolean().optional(),
    trainDepartureTime: z.string().nullable().optional(),
    stationPickupTime: z.string().nullable().optional(),
    status: z.string().optional(),
    drivers: z.array(backendChecklistDriverSchema).nullable().optional(),
  })
  .passthrough();

export const backendGroupRecordSchema = z
  .object({
    id: z.string().optional(),
    agentId: z.string().optional(),
    agent: z.object({
      id: z.string(), code: z.string(), name: z.string(),
      type: z.enum(["DIRECT", "PARTNER"]), status: z.enum(["ACTIVE", "INACTIVE"]),
      picName: z.string().nullable().optional(), phone: z.string().nullable().optional(), email: z.string().nullable().optional(),
    }).nullable().optional(),
    code: z.string().min(1),
    name: z.string().min(1),
    status: z.string().optional(),
    lifecycleStatus: z.enum(backendGroupLifecycleStatuses).nullable().optional(),
    parentGroupId: z.string().nullable().optional(),
    arrivalDate: backendDateValueSchema.nullable().optional(),
    returnDate: backendDateValueSchema.nullable().optional(),
    tone: z.string().optional(),
    pax: z.number().optional(),
    totalBuses: z.number().nullable().optional(),
    packageName: z.string().optional(),
    durationDays: z.number().optional(),
    musyrif: z
      .object({
        name: z.string().optional(),
        phone: z.string().optional(),
        avatar: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    nextActivity: backendNextActivitySchema.nullable().optional(),
    timeline: z.array(backendTimelineItemSchema).nullable().optional(),
    itinerary: z.array(backendItineraryItemSchema).nullable().optional(),
    notes: z.array(backendNoteSchema).nullable().optional(),
    visaSetup: backendVisaSetupSchema.nullable().optional(),
    checklistAssignments: z.array(backendChecklistAssignmentSchema).nullable().optional(),
  })
  .passthrough();

export type BackendGroupRecord = z.infer<typeof backendGroupRecordSchema>;

function formatContractError(context: string, error: z.ZodError): Error {
  const paths = error.issues
    .slice(0, 3)
    .map((issue) => issue.path.join(".") || "response")
    .join(", ");
  return new Error(`${context}: invalid backend response${paths ? ` (${paths})` : ""}.`);
}

export function parseBackendGroupRecord(payload: unknown, context: string): BackendGroupRecord {
  const result = backendGroupRecordSchema.safeParse(payload);
  if (!result.success) {
    throw formatContractError(context, result.error);
  }

  return result.data;
}

export function parseBackendGroupRecordArray(payload: unknown, context: string): BackendGroupRecord[] {
  const result = z.array(backendGroupRecordSchema).safeParse(payload);
  if (!result.success) {
    throw formatContractError(context, result.error);
  }

  return result.data;
}
