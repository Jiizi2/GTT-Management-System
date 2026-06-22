import { BadRequestException } from "@nestjs/common";
import { ChecklistAssignmentStatus } from "@prisma/client";
import type { ChecklistAssignmentSyncResult } from "../groups.service-types";
import {
  toIsoDateOnly,
  parseIsoDateOnly as pureParseIsoDateOnly,
  toUtcMidnightDate,
} from "../../utils/date-helpers";

export { toIsoDateOnly, toUtcMidnightDate };

export function parseIsoDateOnly(value: string): string {
  try {
    return pureParseIsoDateOnly(value);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BadRequestException(message);
  }
}

export function toShortDateLabel(value: Date): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${value.getUTCDate()} ${monthNames[value.getUTCMonth()]}`;
}

export function validateTravelDateRangeOrThrow(arrivalDateIso: string, returnDateIso: string): void {
  if (returnDateIso < arrivalDateIso) {
    throw new BadRequestException("Return date must be on or after arrival date.");
  }
}

function normalizeChecklistIdentityPart(value: string): string {
  return value.trim().toUpperCase();
}

export function buildChecklistAssignmentIdentity({
  tripDateIso,
  scheduledTime,
  activity,
  tripLabel,
}: {
  tripDateIso: string;
  scheduledTime: string;
  activity: string;
  tripLabel: string;
}): string {
  return [
    normalizeChecklistIdentityPart(tripDateIso),
    normalizeChecklistIdentityPart(scheduledTime),
    normalizeChecklistIdentityPart(activity),
    normalizeChecklistIdentityPart(tripLabel),
  ].join("|");
}

export function toChecklistAssignmentSyncResult(
  groupCode: string,
  assignment: {
    id: string;
    tripDate: string;
    activity: string;
    tripLabel: string;
    requiredBusCount: number;
    scheduledTime: string;
    transferByTrain?: boolean;
    trainDepartureTime?: string;
    stationPickupTime?: string;
    status?: ChecklistAssignmentStatus;
    drivers: Array<{
      slotNumber: number;
      name: string;
      phone: string;
      plateNumber: string;
      isVerified?: boolean;
    }>;
  },
): ChecklistAssignmentSyncResult {
  return {
    id: assignment.id,
    groupCode: groupCode.trim().toUpperCase(),
    tripDate: assignment.tripDate,
    activity: assignment.activity,
    tripLabel: assignment.tripLabel,
    requiredBusCount: assignment.requiredBusCount,
    scheduledTime: assignment.scheduledTime,
    transferByTrain: Boolean(assignment.transferByTrain),
    trainDepartureTime: assignment.trainDepartureTime,
    stationPickupTime: assignment.stationPickupTime,
    status: assignment.status ?? ChecklistAssignmentStatus.NOT_COMPLETE,
    drivers: assignment.drivers.map((driver) => ({
      slotNumber: driver.slotNumber,
      name: driver.name,
      phone: driver.phone,
      plateNumber: driver.plateNumber,
      isVerified: Boolean(driver.isVerified),
    })),
  };
}
