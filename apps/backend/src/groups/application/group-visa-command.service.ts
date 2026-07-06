import { ConflictException, NotFoundException } from "@nestjs/common";
import { AgreementApprovalStatus, GroupRaudhahStatus, Prisma, VisaPaymentStatus, VisaStatus } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { UpsertGroupRaudhahDto, UpsertGroupVisaHotelDto } from "../dto/group-operations.dto";
import { randomUUID } from "crypto";
import {
  addVisaHotelAgreementInMemory,
  removeVisaHotelAgreementInMemory,
  updateVisaHotelAgreementInMemory,
  upsertPrimaryRaudhahAppointmentInMemory,
} from "../infrastructure/groups.memory-store";
import { groupDetailSelection } from "../infrastructure/groups.prisma-include";
import { validateHotelAgreementRules } from "../domain/groups.hotel-validation";
import type {
  GroupDetailRecord,
  MemoryGroupRecord,
  PrismaGroupDetailRecord,
} from "../groups.service-types";

export class GroupVisaCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSource: "memory" | "prisma",
    private readonly memoryGroups: MemoryGroupRecord[],
  ) {}

  async addVisaHotelAgreement(
    idOrCode: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<GroupDetailRecord> {
    if (this.dataSource === "prisma") {
      return this.addVisaHotelAgreementWithPrisma(idOrCode, payload);
    }

    return addVisaHotelAgreementInMemory(this.memoryGroups, idOrCode, payload);
  }

  async updateVisaHotelAgreement(
    idOrCode: string,
    hotelId: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<GroupDetailRecord> {
    if (this.dataSource === "prisma") {
      return this.updateVisaHotelAgreementWithPrisma(
        idOrCode,
        hotelId,
        payload,
      );
    }

    return updateVisaHotelAgreementInMemory(
      this.memoryGroups,
      idOrCode,
      hotelId,
      payload,
    );
  }

  async removeVisaHotelAgreement(
    idOrCode: string,
    hotelId: string,
  ): Promise<GroupDetailRecord> {
    if (this.dataSource === "prisma") {
      return this.removeVisaHotelAgreementWithPrisma(idOrCode, hotelId);
    }

    return removeVisaHotelAgreementInMemory(
      this.memoryGroups,
      idOrCode,
      hotelId,
    );
  }

  async upsertPrimaryRaudhahAppointment(
    idOrCode: string,
    payload: UpsertGroupRaudhahDto,
  ): Promise<GroupDetailRecord> {
    if (this.dataSource === "prisma") {
      return this.upsertPrimaryRaudhahAppointmentWithPrisma(idOrCode, payload);
    }

    return upsertPrimaryRaudhahAppointmentInMemory(
      this.memoryGroups,
      idOrCode,
      payload,
    );
  }

  private async resolvePrismaGroupIdentity(
    idOrCode: string,
  ): Promise<{ id: string; code: string }> {
    const group = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (!group) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    return group;
  }

  private async resolveOrCreatePrismaVisaSetup(
    groupId: string,
  ): Promise<{ id: string; groupId: string }> {
    return this.prisma.visaSetup.upsert({
      where: {
        groupId,
      },
      update: {},
      create: {
        groupId,
        visaStatus: VisaStatus.DRAFT,
        syarikah: "Not assigned",
        paymentStatus: VisaPaymentStatus.UNPAID,
      },
      select: {
        id: true,
        groupId: true,
      },
    });
  }

  private async findOneWithPrisma(idOrCode: string): Promise<PrismaGroupDetailRecord> {
    const group = await this.prisma.group.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
      },
      select: groupDetailSelection,
    });

    if (!group) {
      throw new NotFoundException(`Group '${idOrCode}' not found.`);
    }

    return group;
  }

  private async addVisaHotelAgreementWithPrisma(
    idOrCode: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<PrismaGroupDetailRecord> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const visaSetup = await this.resolveOrCreatePrismaVisaSetup(group.id);
    const existingHotels = await this.prisma.visaHotelAgreement.findMany({
      where: {
        visaSetupId: visaSetup.id,
      },
      select: {
        id: true,
        city: true,
        stayStart: true,
        stayEnd: true,
      },
    });
    const nextHotelAgreements = [
      ...existingHotels.map((hotel) => ({
        id: hotel.id,
        city: hotel.city,
        stayStart: hotel.stayStart.toISOString().slice(0, 10),
        stayEnd: hotel.stayEnd.toISOString().slice(0, 10),
      })),
      {
        id: randomUUID(),
        city: payload.city,
        stayStart: payload.stayStart,
        stayEnd: payload.stayEnd,
      },
    ];
    validateHotelAgreementRules(nextHotelAgreements, {
      requireMakkah: false,
    });

    await this.prisma.visaHotelAgreement.create({
      data: {
        visaSetupId: visaSetup.id,
        sourceDraftId: payload.sourceDraftId?.trim() || null,
        city: payload.city,
        hotelName: payload.hotelName.trim(),
        agreementNumber: payload.agreementNumber.trim(),
        pax: payload.pax,
        status: payload.status ?? AgreementApprovalStatus.WAITING,
        stayStart: new Date(`${payload.stayStart}T00:00:00.000Z`),
        stayEnd: new Date(`${payload.stayEnd}T00:00:00.000Z`),
      },
    });

    return this.findOneWithPrisma(group.id);
  }

  private async updateVisaHotelAgreementWithPrisma(
    idOrCode: string,
    hotelId: string,
    payload: UpsertGroupVisaHotelDto,
  ): Promise<PrismaGroupDetailRecord> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const existingHotels = await this.prisma.visaHotelAgreement.findMany({
      where: {
        visaSetup: {
          groupId: group.id,
        },
      },
      select: {
        id: true,
        city: true,
        stayStart: true,
        stayEnd: true,
      },
    });
    const existing = existingHotels.find((hotel) => hotel.id === hotelId);

    if (!existing) {
      throw new NotFoundException(
        `Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`,
      );
    }

    const nextHotelAgreements = existingHotels.map((hotel) =>
      hotel.id === hotelId
        ? {
            id: hotel.id,
            city: payload.city,
            stayStart: payload.stayStart,
            stayEnd: payload.stayEnd,
          }
        : {
            id: hotel.id,
            city: hotel.city,
            stayStart: hotel.stayStart.toISOString().slice(0, 10),
            stayEnd: hotel.stayEnd.toISOString().slice(0, 10),
          },
    );
    validateHotelAgreementRules(nextHotelAgreements, {
      requireMakkah: false,
    });

    await this.prisma.visaHotelAgreement.update({
      where: { id: hotelId },
      data: {
        sourceDraftId: payload.sourceDraftId?.trim() || null,
        city: payload.city,
        hotelName: payload.hotelName.trim(),
        agreementNumber: payload.agreementNumber.trim(),
        pax: payload.pax,
        status: payload.status ?? AgreementApprovalStatus.WAITING,
        stayStart: new Date(`${payload.stayStart}T00:00:00.000Z`),
        stayEnd: new Date(`${payload.stayEnd}T00:00:00.000Z`),
      },
    });

    return this.findOneWithPrisma(group.id);
  }

  private async removeVisaHotelAgreementWithPrisma(
    idOrCode: string,
    hotelId: string,
  ): Promise<PrismaGroupDetailRecord> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const existingHotels = await this.prisma.visaHotelAgreement.findMany({
      where: {
        visaSetup: {
          groupId: group.id,
        },
      },
      select: {
        id: true,
        city: true,
        stayStart: true,
        stayEnd: true,
      },
    });
    const target = existingHotels.find((hotel) => hotel.id === hotelId);
    if (!target) {
      throw new NotFoundException(
        `Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`,
      );
    }

    const nextHotelAgreements = existingHotels
      .filter((hotel) => hotel.id !== hotelId)
      .map((hotel) => ({
        id: hotel.id,
        city: hotel.city,
        stayStart: hotel.stayStart.toISOString().slice(0, 10),
        stayEnd: hotel.stayEnd.toISOString().slice(0, 10),
      }));
    validateHotelAgreementRules(nextHotelAgreements, {
      requireMakkah: false,
    });

    const removed = await this.prisma.visaHotelAgreement.deleteMany({
      where: {
        id: hotelId,
        visaSetup: {
          groupId: group.id,
        },
      },
    });

    if (removed.count === 0) {
      throw new NotFoundException(
        `Hotel agreement '${hotelId}' not found in group '${idOrCode}'.`,
      );
    }

    return this.findOneWithPrisma(group.id);
  }

  private async upsertPrimaryRaudhahAppointmentWithPrisma(
    idOrCode: string,
    payload: UpsertGroupRaudhahDto,
  ): Promise<PrismaGroupDetailRecord> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const visaSetup = await this.resolveOrCreatePrismaVisaSetup(group.id);
    const primary = await this.prisma.raudhahAppointment.findFirst({
      where: {
        visaSetupId: visaSetup.id,
      },
      orderBy: {
        date: "asc",
      },
      select: {
        id: true,
      },
    });

    if (primary) {
      await this.prisma.raudhahAppointment.update({
        where: {
          id: primary.id,
        },
        data: {
          date: new Date(`${payload.date}T00:00:00.000Z`),
          status: payload.status ?? GroupRaudhahStatus.FREE,
          tasrehPrinted: payload.tasrehPrinted ?? false,
        },
      });
    } else {
      await this.prisma.raudhahAppointment.create({
        data: {
          visaSetupId: visaSetup.id,
          date: new Date(`${payload.date}T00:00:00.000Z`),
          status: payload.status ?? GroupRaudhahStatus.FREE,
          tasrehPrinted: payload.tasrehPrinted ?? false,
        },
      });
    }

    return this.findOneWithPrisma(group.id);
  }
}
