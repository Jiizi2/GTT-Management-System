import { z } from "zod";

const backendDateValueSchema = z.union([z.string(), z.date()]);

const assignedGroupSchema = z
  .object({
    groupCode: z.string(),
    pax: z.number(),
  })
  .passthrough();

export const backendHotelAgreementDraftRecordSchema = z
  .object({
    id: z.string().min(1),
    city: z.string().optional(),
    agentName: z.string().nullable().optional(),
    hotelName: z.string().optional(),
    agreementNumber: z.string().optional(),
    pax: z.number().optional(),
    remainingPax: z.number().optional(),
    assignedGroups: z.array(assignedGroupSchema).optional(),
    status: z.string().optional(),
    stayStart: backendDateValueSchema.optional(),
    stayEnd: backendDateValueSchema.optional(),
    notes: z.string().nullable().optional(),
    groupCode: z.string().nullable().optional(),
    assignmentStatus: z.string().optional(),
    assignedAt: backendDateValueSchema.nullable().optional(),
    createdAt: backendDateValueSchema.optional(),
    updatedAt: backendDateValueSchema.optional(),
  })
  .passthrough();

export type BackendHotelAgreementDraftRecord = z.infer<typeof backendHotelAgreementDraftRecordSchema>;

function formatContractError(context: string, error: z.ZodError): Error {
  const paths = error.issues
    .slice(0, 3)
    .map((issue) => issue.path.join(".") || "response")
    .join(", ");
  return new Error(`${context}: invalid backend response${paths ? ` (${paths})` : ""}.`);
}

export function parseBackendAgreementDraftRecord(
  payload: unknown,
  context: string,
): BackendHotelAgreementDraftRecord {
  const result = backendHotelAgreementDraftRecordSchema.safeParse(payload);
  if (!result.success) {
    throw formatContractError(context, result.error);
  }

  return result.data;
}

export function parseBackendAgreementDraftRecordArray(
  payload: unknown,
  context: string,
): BackendHotelAgreementDraftRecord[] {
  const result = z.array(backendHotelAgreementDraftRecordSchema).safeParse(payload);
  if (!result.success) {
    throw formatContractError(context, result.error);
  }

  return result.data;
}
