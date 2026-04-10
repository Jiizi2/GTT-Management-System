import {
  AgreementApprovalStatus,
  AgreementCity,
  ChecklistAssignmentStatus,
  GroupRaudhahStatus,
  GroupTone,
  Prisma,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import { CreateGroupDto } from "./dto/create-group.dto";
import { resolveItineraryTitle } from "./groups-itinerary-title";

type BuildGroupWriteDataOptions = {
  nullifyMissingTotalBuses: boolean;
  preserveChecklistItineraryLinks: boolean;
};

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

function toUtcMidnight(input: string): Date {
  const isoDate = toIsoDateOnly(input);
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function buildTimelineCreate(timeline: CreateGroupDto["timeline"]) {
  if (!timeline || timeline.length === 0) {
    return undefined;
  }

  return {
    create: timeline.map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      dateLabel: item.dateLabel.trim(),
      title: item.title.trim(),
      isCurrent: item.isCurrent ?? false,
      nextActivity: item.nextActivity?.trim() || null,
    })),
  };
}

function buildItineraryCreate(itinerary: CreateGroupDto["itinerary"]) {
  if (!itinerary || itinerary.length === 0) {
    return undefined;
  }

  return {
    create: itinerary.map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      dateLabel: item.dateLabel.trim(),
      yearLabel: item.yearLabel.trim(),
      category: item.category.trim(),
      categoryKey: item.categoryKey?.trim() || null,
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
      isoDate: item.isoDate ? toUtcMidnight(item.isoDate) : null,
      time: item.time?.trim() || null,
      flightNumber: item.flightNumber?.trim() || null,
      hotelName: item.hotelName?.trim() || null,
      fromHotelName: item.fromHotelName?.trim() || null,
      fromLocation: item.fromLocation?.trim() || null,
      toLocation: item.toLocation?.trim() || null,
      cityTourCity: item.cityTourCity?.trim() || null,
      requiresBus: item.requiresBus ?? false,
      notes: item.notes?.trim() || null,
      transferByTrain: item.transferByTrain ?? false,
      trainDepartureTime: item.trainDepartureTime?.trim() || null,
      destinationPickupTime: item.destinationPickupTime?.trim() || null,
      hotelPickupRequestTime: item.hotelPickupRequestTime?.trim() || null,
    })),
  };
}

function buildNotesCreate(notes: CreateGroupDto["notes"]) {
  if (!notes || notes.length === 0) {
    return undefined;
  }

  return {
    create: notes.map((item, index) => ({
      sortOrder: item.sortOrder ?? index,
      text: item.text.trim(),
      pinned: item.pinned ?? false,
    })),
  };
}

function buildVisaSetupCreate(visaSetup: CreateGroupDto["visaSetup"]) {
  if (!visaSetup) {
    return undefined;
  }

  return {
    create: {
      visaStatus: visaSetup.visaStatus ?? VisaStatus.DRAFT,
      issuedDate: visaSetup.issuedDate ? toUtcMidnight(visaSetup.issuedDate) : null,
      syarikah: visaSetup.syarikah.trim(),
      paymentStatus: visaSetup.paymentStatus ?? VisaPaymentStatus.UNPAID,
      outstandingAmount: new Prisma.Decimal(visaSetup.outstandingAmount ?? 0),
      hotelAgreements:
        visaSetup.hotelAgreements && visaSetup.hotelAgreements.length > 0
          ? {
              create: visaSetup.hotelAgreements.map((hotel) => ({
                city: hotel.city ?? AgreementCity.MAKKAH,
                hotelName: hotel.hotelName.trim(),
                agreementNumber: hotel.agreementNumber.trim(),
                pax: hotel.pax,
                status: hotel.status ?? AgreementApprovalStatus.WAITING,
                stayStart: toUtcMidnight(hotel.stayStart),
                stayEnd: toUtcMidnight(hotel.stayEnd),
              })),
            }
          : undefined,
      raudhahAppointments:
        visaSetup.raudhahAppointments && visaSetup.raudhahAppointments.length > 0
          ? {
              create: visaSetup.raudhahAppointments.map((appointment) => ({
                date: toUtcMidnight(appointment.date),
                status: appointment.status ?? GroupRaudhahStatus.FREE,
                tasrehPrinted: appointment.tasrehPrinted ?? false,
              })),
            }
          : undefined,
    },
  };
}

function buildChecklistAssignmentsCreate(
  checklistAssignments: CreateGroupDto["checklistAssignments"],
  preserveChecklistItineraryLinks: boolean,
) {
  if (!checklistAssignments || checklistAssignments.length === 0) {
    return undefined;
  }

  return {
    create: checklistAssignments.map((assignment) => ({
      itineraryItemId: preserveChecklistItineraryLinks ? assignment.itineraryItemId ?? null : null,
      tripDate: toUtcMidnight(assignment.tripDate),
      activity: assignment.activity.trim(),
      tripLabel: assignment.tripLabel.trim(),
      requiredBusCount: assignment.requiredBusCount,
      scheduledTime: assignment.scheduledTime.trim(),
      transferByTrain: assignment.transferByTrain ?? false,
      trainDepartureTime: assignment.trainDepartureTime?.trim() || null,
      stationPickupTime: assignment.stationPickupTime?.trim() || null,
      status: assignment.status ?? ChecklistAssignmentStatus.NOT_COMPLETE,
      drivers:
        assignment.drivers && assignment.drivers.length > 0
          ? {
              create: assignment.drivers.map((driver, index) => ({
                slotNumber: driver.slotNumber ?? index + 1,
                name: driver.name.trim(),
                phone: driver.phone.trim(),
                plateNumber: driver.plateNumber.trim(),
                isVerified: driver.isVerified ?? false,
              })),
            }
          : undefined,
    })),
  };
}

function buildGroupWriteData(
  payload: CreateGroupDto,
  normalizedCode: string,
  options: BuildGroupWriteDataOptions,
) {
  return {
    code: normalizedCode,
    name: payload.name.trim(),
    status: payload.status.trim(),
    arrivalDate: toUtcMidnight(payload.arrivalDate),
    returnDate: toUtcMidnight(payload.returnDate),
    tone: payload.tone ?? GroupTone.ACTIVE,
    pax: payload.pax,
    totalBuses: options.nullifyMissingTotalBuses ? payload.totalBuses ?? null : payload.totalBuses,
    packageName: payload.packageName.trim(),
    durationDays: payload.durationDays,
    musyrif: payload.musyrif
      ? {
          create: {
            name: payload.musyrif.name.trim(),
            phone: payload.musyrif.phone.trim(),
            avatar: payload.musyrif.avatar.trim(),
          },
        }
      : undefined,
    nextActivity: payload.nextActivity
      ? {
          create: {
            title: payload.nextActivity.title.trim(),
            dateLabel: payload.nextActivity.dateLabel.trim(),
            timeLabel: payload.nextActivity.timeLabel.trim(),
            icon: payload.nextActivity.icon.trim(),
          },
        }
      : undefined,
    timeline: buildTimelineCreate(payload.timeline),
    itinerary: buildItineraryCreate(payload.itinerary),
    notes: buildNotesCreate(payload.notes),
    visaSetup: buildVisaSetupCreate(payload.visaSetup),
    checklistAssignments: buildChecklistAssignmentsCreate(
      payload.checklistAssignments,
      options.preserveChecklistItineraryLinks,
    ),
  };
}

export function buildGroupCreateData(
  payload: CreateGroupDto,
  normalizedCode: string,
): Prisma.GroupCreateInput {
  return buildGroupWriteData(payload, normalizedCode, {
    nullifyMissingTotalBuses: false,
    preserveChecklistItineraryLinks: true,
  });
}

export function buildGroupReplaceData(
  payload: CreateGroupDto,
  normalizedCode: string,
): Prisma.GroupUpdateInput {
  return buildGroupWriteData(payload, normalizedCode, {
    nullifyMissingTotalBuses: true,
    preserveChecklistItineraryLinks: false,
  });
}
