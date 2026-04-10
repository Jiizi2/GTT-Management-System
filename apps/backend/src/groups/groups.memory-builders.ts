import { randomUUID } from "node:crypto";
import {
  AgreementApprovalStatus,
  GroupRaudhahStatus,
  VisaPaymentStatus,
  VisaStatus,
} from "@prisma/client";
import type {
  MemoryGroupRecord,
  MemoryItineraryItem,
  MemoryRaudhahAppointment,
  MemoryVisaHotelAgreement,
  MemoryVisaSetup,
} from "./groups.service-types";
import { resolveItineraryTitle } from "./groups-itinerary-title";
import type {
  UpsertGroupItineraryItemDto,
  UpsertGroupRaudhahDto,
  UpsertGroupVisaHotelDto,
} from "./dto/group-operations.dto";

export function buildMemoryItineraryItem(
  payload: UpsertGroupItineraryItemDto,
  sortOrder: number,
  id: string = randomUUID(),
): MemoryItineraryItem {
  return {
    id,
    sortOrder,
    dateLabel: payload.dateLabel.trim(),
    yearLabel: payload.yearLabel.trim(),
    category: payload.category.trim(),
    categoryKey: payload.categoryKey?.trim() || undefined,
    title: resolveItineraryTitle({
      title: payload.title,
      category: payload.category,
      categoryKey: payload.categoryKey,
      fromLocation: payload.fromLocation,
      toLocation: payload.toLocation,
      cityTourCity: payload.cityTourCity,
    }),
    meta: payload.meta.trim(),
    icon: payload.icon.trim(),
    highlighted: payload.highlighted ?? false,
    isoDate: payload.isoDate,
    time: payload.time?.trim() || undefined,
    flightNumber: payload.flightNumber?.trim() || undefined,
    fromLocation: payload.fromLocation?.trim() || undefined,
    toLocation: payload.toLocation?.trim() || undefined,
    cityTourCity: payload.cityTourCity?.trim() || undefined,
    requiresBus: payload.requiresBus ?? false,
    notes: payload.notes?.trim() || undefined,
    transferByTrain: payload.transferByTrain ?? false,
    trainDepartureTime: payload.trainDepartureTime?.trim() || undefined,
    destinationPickupTime: payload.destinationPickupTime?.trim() || undefined,
    hotelPickupRequestTime: payload.hotelPickupRequestTime?.trim() || undefined,
  };
}

export function buildMemoryVisaHotelAgreement(
  payload: UpsertGroupVisaHotelDto,
  id: string = randomUUID(),
): MemoryVisaHotelAgreement {
  return {
    id,
    city: payload.city,
    hotelName: payload.hotelName.trim(),
    agreementNumber: payload.agreementNumber.trim(),
    pax: payload.pax,
    status: payload.status ?? AgreementApprovalStatus.WAITING,
    stayStart: payload.stayStart,
    stayEnd: payload.stayEnd,
  };
}

export function buildMemoryRaudhahAppointment(
  payload: UpsertGroupRaudhahDto,
  id: string = randomUUID(),
): MemoryRaudhahAppointment {
  return {
    id,
    date: payload.date,
    status: payload.status ?? GroupRaudhahStatus.FREE,
    tasrehPrinted: payload.tasrehPrinted ?? false,
  };
}

export function ensureMemoryVisaSetup(group: MemoryGroupRecord): MemoryVisaSetup {
  if (!group.visaSetup) {
    group.visaSetup = {
      visaStatus: VisaStatus.DRAFT,
      issuedDate: undefined,
      syarikah: "Not assigned",
      paymentStatus: VisaPaymentStatus.UNPAID,
      outstandingAmount: 0,
      hotelAgreements: [],
      raudhahAppointments: [],
    };
  }

  return group.visaSetup;
}
