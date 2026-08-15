import { describe, expect } from "vitest";
import { runCase } from "../../test/run-case";
import { NotFoundException } from "@nestjs/common";
import { AgreementApprovalStatus, AgreementCity, VisaStatus } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { GroupsService } from "../application/groups.service";
import { PrismaGroupRepository } from "../../infrastructure/repositories/prisma/prisma-group.repository";

function createPrismaService(prismaMock: PrismaService): {
  service: GroupsService;
  restore: () => void;
} {
  const previousDataSource = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = "prisma";
  const prismaRecord = prismaMock as unknown as Record<string, unknown>;
  prismaRecord.groupAuditLog ??= {
    create: async () => ({}),
    findMany: async () => [],
  };
  const service = new GroupsService(new PrismaGroupRepository(prismaMock));

  return {
    service,
    restore: () => {
      if (previousDataSource === undefined) {
        delete process.env.DATA_SOURCE;
      } else {
        process.env.DATA_SOURCE = previousDataSource;
      }
    },
  };
}

function createGroupFindFirstMock() {
  return async (args: Record<string, unknown>) => {
    if ("select" in args) {
      return {
        id: "grp-1",
        code: "GRP-PRISMA",
      };
    }

    return {
      id: "grp-1",
      code: "GRP-PRISMA",
      visaSetup: {
        hotelAgreements: [],
      },
    };
  };
}

describe("GroupsServicePrismaVisa", () => {
  runCase("groups prisma add visa hotel agreement", async () => {
    let createdPayload: any = null;
    const prismaMock = {
      group: {
        findFirst: createGroupFindFirstMock(),
      },
      visaSetup: {
        upsert: async () => ({
          id: "visa-1",
          groupId: "grp-1",
          visaStatus: VisaStatus.DRAFT,
        }),
        update: async () => ({ id: "visa-1" }),
      },
      visaHotelAgreement: {
        findMany: async () => [],
        create: async (args: Record<string, unknown>) => {
          createdPayload = args;
          return { id: "hotel-1" };
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaService(prismaMock);
    try {
      const result = (await service.addVisaHotelAgreement("GRP-PRISMA", {
        city: AgreementCity.MAKKAH,
        sourceDraftId: " draft-add-1 ",
        hotelName: " Swissotel ",
        agreementNumber: " AG-PR-1 ",
        pax: 45,
        stayStart: "2026-04-10",
        stayEnd: "2026-04-12",
      })) as { code?: string };

      expect(result.code).toBe("GRP-PRISMA");
      expect(createdPayload).toBeTruthy();
      const data = (
        createdPayload as {
          data: {
            visaSetupId: string;
            sourceDraftId: string | null;
            city: AgreementCity;
            hotelName: string;
            agreementNumber: string;
            pax: number;
            status: AgreementApprovalStatus;
            stayStart: Date;
            stayEnd: Date;
          };
        }
      ).data;

      expect(data.visaSetupId).toBe("visa-1");
      expect(data.sourceDraftId).toBe("draft-add-1");
      expect(data.city).toBe(AgreementCity.MAKKAH);
      expect(data.hotelName).toBe("Swissotel");
      expect(data.agreementNumber).toBe("AG-PR-1");
      expect(data.pax).toBe(45);
      expect(data.status).toBe(AgreementApprovalStatus.WAITING);
      expect(data.stayStart.toISOString().slice(0, 10)).toBe("2026-04-10");
      expect(data.stayEnd.toISOString().slice(0, 10)).toBe("2026-04-12");
    } finally {
      restore();
    }
  });

  runCase("groups prisma update visa hotel agreement", async () => {
    let updatedPayload: any = null;
    const prismaMock = {
      group: {
        findFirst: createGroupFindFirstMock(),
      },
      visaHotelAgreement: {
        findMany: async () => [
          {
            id: "mak-1",
            city: AgreementCity.MAKKAH,
            stayStart: new Date("2026-04-10T00:00:00.000Z"),
            stayEnd: new Date("2026-04-12T00:00:00.000Z"),
          },
          {
            id: "mad-1",
            city: AgreementCity.MADINAH,
            stayStart: new Date("2026-04-12T00:00:00.000Z"),
            stayEnd: new Date("2026-04-15T00:00:00.000Z"),
          },
        ],
        update: async (args: Record<string, unknown>) => {
          updatedPayload = args;
          return { id: "mad-1" };
        },
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaService(prismaMock);
    try {
      const result = (await service.updateVisaHotelAgreement(
        "GRP-PRISMA",
        "mad-1",
        {
          city: AgreementCity.MADINAH,
          sourceDraftId: " draft-update-1 ",
          hotelName: " Pullman ",
          agreementNumber: " AG-PR-2 ",
          pax: 45,
          status: AgreementApprovalStatus.APPROVED,
          stayStart: "2026-04-12",
          stayEnd: "2026-04-15",
        },
      )) as { code?: string };

      expect(result.code).toBe("GRP-PRISMA");
      expect(updatedPayload).toBeTruthy();
      const data = (
        updatedPayload as {
          data: {
            city: AgreementCity;
            sourceDraftId: string | null;
            hotelName: string;
            agreementNumber: string;
            pax: number;
            status: AgreementApprovalStatus;
            stayStart: Date;
            stayEnd: Date;
          };
        }
      ).data;
      expect(data.city).toBe(AgreementCity.MADINAH);
      expect(data.sourceDraftId).toBe("draft-update-1");
      expect(data.hotelName).toBe("Pullman");
      expect(data.agreementNumber).toBe("AG-PR-2");
      expect(data.status).toBe(AgreementApprovalStatus.APPROVED);

      await expect(
        () =>
          service.updateVisaHotelAgreement("GRP-PRISMA", "missing-hotel", {
            city: AgreementCity.MADINAH,
            hotelName: "Pullman",
            agreementNumber: "AG-X",
            pax: 45,
            stayStart: "2026-04-12",
            stayEnd: "2026-04-15",
          }),
      ).rejects.toThrow(NotFoundException);
    } finally {
      restore();
    }
  });

  runCase("groups prisma remove visa hotel agreement guards", async () => {
    {
      let deleteCalled = false;
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        visaSetup: {
          upsert: async () => ({ id: "visa-1", groupId: "grp-1", visaStatus: VisaStatus.PENDING }),
          update: async () => ({ id: "visa-1" }),
        },
        visaHotelAgreement: {
          findMany: async () => [
            {
              id: "mak-1",
              city: AgreementCity.MAKKAH,
              stayStart: new Date("2026-04-10T00:00:00.000Z"),
              stayEnd: new Date("2026-04-12T00:00:00.000Z"),
            },
            {
              id: "mad-1",
              city: AgreementCity.MADINAH,
              stayStart: new Date("2026-04-13T00:00:00.000Z"),
              stayEnd: new Date("2026-04-15T00:00:00.000Z"),
            },
          ],
          deleteMany: async () => {
            deleteCalled = true;
            return { count: 1 };
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaService(prismaMock);
      try {
        const result = (await service.removeVisaHotelAgreement(
          "GRP-PRISMA",
          "mak-1",
        )) as { code?: string };
        expect(deleteCalled).toBe(true);
        expect(result.code).toBe("GRP-PRISMA");
      } finally {
        restore();
      }
    }

    {
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        visaSetup: {
          upsert: async () => ({ id: "visa-1", groupId: "grp-1", visaStatus: VisaStatus.PENDING }),
          update: async () => ({ id: "visa-1" }),
        },
        visaHotelAgreement: {
          findMany: async () => [
            {
              id: "mak-1",
              city: AgreementCity.MAKKAH,
              stayStart: new Date("2026-04-10T00:00:00.000Z"),
              stayEnd: new Date("2026-04-12T00:00:00.000Z"),
            },
            {
              id: "mad-1",
              city: AgreementCity.MADINAH,
              stayStart: new Date("2026-04-13T00:00:00.000Z"),
              stayEnd: new Date("2026-04-15T00:00:00.000Z"),
            },
          ],
          deleteMany: async () => ({ count: 0 }),
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaService(prismaMock);
      try {
        await expect(
          () => service.removeVisaHotelAgreement("GRP-PRISMA", "mad-1"),
        ).rejects.toThrow(NotFoundException);
      } finally {
        restore();
      }
    }

    {
      let deleteCalled = false;
      const prismaMock = {
        group: {
          findFirst: createGroupFindFirstMock(),
        },
        visaSetup: {
          upsert: async () => ({ id: "visa-1", groupId: "grp-1", visaStatus: VisaStatus.PENDING }),
          update: async () => ({ id: "visa-1" }),
        },
        visaHotelAgreement: {
          findMany: async () => [
            {
              id: "mak-1",
              city: AgreementCity.MAKKAH,
              stayStart: new Date("2026-04-10T00:00:00.000Z"),
              stayEnd: new Date("2026-04-12T00:00:00.000Z"),
            },
            {
              id: "mad-1",
              city: AgreementCity.MADINAH,
              stayStart: new Date("2026-04-13T00:00:00.000Z"),
              stayEnd: new Date("2026-04-15T00:00:00.000Z"),
            },
          ],
          deleteMany: async () => {
            deleteCalled = true;
            return { count: 1 };
          },
        },
      } as unknown as PrismaService;

      const { service, restore } = createPrismaService(prismaMock);
      try {
        const result = (await service.removeVisaHotelAgreement(
          "GRP-PRISMA",
          "mad-1",
        )) as { code?: string };
        expect(deleteCalled).toBe(true);
        expect(result.code).toBe("GRP-PRISMA");
      } finally {
        restore();
      }
    }
  });
});
