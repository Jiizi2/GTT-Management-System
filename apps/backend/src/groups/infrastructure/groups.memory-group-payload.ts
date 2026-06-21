import { randomUUID } from "node:crypto";
import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupTone,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import type { CreateGroupDto } from "../dto/create-group.dto";
import { resolveItineraryTitle } from "../domain/groups-itinerary-title";
import type { MemoryGroupRecord } from "../groups.service-types";

type MemoryGroupPayloadFields = Pick<
  MemoryGroupRecord,
  | "name"
  | "status"
  | "arrivalDate"
  | "returnDate"
  | "tone"
  | "pax"
  | "totalBuses"
  | "packageName"
  | "durationDays"
  | "musyrif"
  | "nextActivity"
  | "timeline"
  | "itinerary"
  | "notes"
  | "visaSetup"
  | "checklistAssignments"
  | "parentGroupId"
>;

function toIsoDateOnly(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsedDate = new Date(trimmed);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid ISO date value '${value}'.`);
  }

  return parsedDate.toISOString().slice(0, 10);
}

export function buildMemoryGroupPayloadFields(payload: CreateGroupDto): MemoryGroupPayloadFields {
  return {
    name: payload.name.trim(),
    status: payload.status.trim(),
    arrivalDate: toIsoDateOnly(payload.arrivalDate),
    returnDate: toIsoDateOnly(payload.returnDate),
    tone: payload.tone ?? GroupTone.ACTIVE,
    pax: payload.pax,
    totalBuses: payload.totalBuses ?? null,
    packageName: payload.packageName.trim(),
    durationDays: payload.durationDays,
    parentGroupId: payload.parentGroupId?.trim() || null,
    musyrif: payload.musyrif
      ? {
          name: payload.musyrif.name.trim(),
          phone: payload.musyrif.phone.trim(),
          avatar: payload.musyrif.avatar.trim(),
        }
      : undefined,
    nextActivity: payload.nextActivity
      ? {
          title: payload.nextActivity.title.trim(),
          dateLabel: payload.nextActivity.dateLabel.trim(),
          timeLabel: payload.nextActivity.timeLabel.trim(),
          icon: payload.nextActivity.icon.trim(),
        }
      : undefined,
    timeline: (payload.timeline ?? []).map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      dateLabel: item.dateLabel.trim(),
      title: item.title.trim(),
      isCurrent: item.isCurrent ?? false,
      nextActivity: item.nextActivity?.trim() || undefined,
    })),
    itinerary: (payload.itinerary ?? []).map((item, index) => ({
      id: randomUUID(),
      sortOrder: item.sortOrder ?? index,
      dateLabel: item.dateLabel.trim(),
      yearLabel: item.yearLabel.trim(),
      category: item.category.trim(),
      categoryKey: item.categoryKey?.trim() || undefined,
      title: resolveItineraryTitle({
        title: item.title,
        category: item.category,
        categoryKey: item.categoryKey,
        fromLocation: item.fromLocation,
        toLocation: item.toLocation,
        cityTourCity: item.cityTourCity,
      }),
      meta: item.meta.trim(),
      icon: item.icon.trim(),
      highlighted: item.highlighted ?? false,
      isoDate: item.isoDate,
      time: item.time?.trim() || undefined,
      flightNumber: item.flightNumber?.trim() || undefined,
      hotelName: item.hotelName?.trim() || undefined,
      fromHotelName: item.fromHotelName?.trim() || undefined,
      fromLocation: item.fromLocation?.trim() || undefined,
      toLocation: item.toLocation?.trim() || undefined,
      cityTourCity: item.cityTourCity?.trim() || undefined,
      requiresBus: item.requiresBus ?? false,
      notes: item.notes?.trim() || undefined,
      transferByTrain: item.transferByTrain ?? false,
      trainDepartureTime: item.trainDepartureTime?.trim() || undefined,
      destinationPickupTime: item.destinationPickupTime?.trim() || undefined,
      hotelPickupRequestTime: item.hotelPickupRequestTime?.trim() || undefined,
    })),
    notes: (payload.notes ?? []).map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      text: item.text.trim(),
      pinned: item.pinned ?? false,
    })),
    visaSetup: payload.visaSetup
      ? {
          visaStatus: payload.visaSetup.visaStatus ?? VisaStatus.DRAFT,
          issuedDate: payload.visaSetup.issuedDate?.trim() || undefined,
          syarikah: payload.visaSetup.syarikah.trim(),
          paymentStatus: payload.visaSetup.paymentStatus ?? VisaPaymentStatus.UNPAID,
          hotelAgreements: (payload.visaSetup.hotelAgreements ?? []).map((hotel) => ({
            id: randomUUID(),
            city: hotel.city ?? AgreementCity.MAKKAH,
            hotelName: hotel.hotelName.trim(),
            agreementNumber: hotel.agreementNumber.trim(),
            pax: hotel.pax,
            status: hotel.status ?? AgreementApprovalStatus.WAITING,
            stayStart: hotel.stayStart,
            stayEnd: hotel.stayEnd,
          })),
          raudhahAppointments: (payload.visaSetup.raudhahAppointments ?? []).map((appointment) => ({
            id: randomUUID(),
            date: appointment.date,
            status: appointment.status ?? GroupRaudhahStatus.FREE,
            tasrehPrinted: appointment.tasrehPrinted ?? false,
          })),
        }
      : undefined,
    checklistAssignments: (payload.checklistAssignments ?? []).map((assignment) => ({
      id: randomUUID(),
      itineraryItemId: assignment.itineraryItemId,
      tripDate: assignment.tripDate,
      activity: assignment.activity.trim(),
      tripLabel: assignment.tripLabel.trim(),
      requiredBusCount: assignment.requiredBusCount,
      scheduledTime: assignment.scheduledTime.trim(),
      transferByTrain: assignment.transferByTrain ?? false,
      trainDepartureTime: assignment.trainDepartureTime?.trim() || undefined,
      stationPickupTime: assignment.stationPickupTime?.trim() || undefined,
      status: assignment.status ?? ChecklistAssignmentStatus.NOT_COMPLETE,
      drivers: (assignment.drivers ?? []).map((driver, index) => ({
        slotNumber: driver.slotNumber ?? index + 1,
        name: driver.name.trim(),
        phone: driver.phone.trim(),
        plateNumber: driver.plateNumber.trim(),
        isVerified: driver.isVerified ?? false,
      })),
    })),
  };
}
