import { BadRequestException } from "@nestjs/common";
import { ChecklistAssignmentStatus } from "@prisma/client";
import type { ChecklistAssignmentSyncResult } from "../groups.service-types";

export function toIsoDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function toShortDateLabel(value: Date): string {
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${value.getUTCDate()} ${monthNames[value.getUTCMonth()]}`;
}

export function parseIsoDateOnly(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new BadRequestException(`Invalid ISO date value '${value}'.`);
  }

  return parsedDate.toISOString().slice(0, 10);
}

export function toUtcMidnightDate(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
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
