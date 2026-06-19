import assert from "node:assert/strict";
import { NotFoundException } from "@nestjs/common";
import { AgreementApprovalStatus, AgreementCity } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { GroupsService } from "../application/groups.service";

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
  const service = new GroupsService(prismaMock);

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

async function runCase(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`PASS ${name}`);
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

async function testPrismaAddVisaHotelAgreement(): Promise<void> {
  let createdPayload: Record<string, unknown> | null = null;
  const prismaMock = {
    group: {
      findFirst: createGroupFindFirstMock(),
    },
    visaSetup: {
      upsert: async () => ({
        id: "visa-1",
        groupId: "grp-1",
      }),
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

    assert.equal(result.code, "GRP-PRISMA");
    assert.ok(createdPayload);
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

    assert.equal(data.visaSetupId, "visa-1");
    assert.equal(data.sourceDraftId, "draft-add-1");
    assert.equal(data.city, AgreementCity.MAKKAH);
    assert.equal(data.hotelName, "Swissotel");
    assert.equal(data.agreementNumber, "AG-PR-1");
    assert.equal(data.pax, 45);
    assert.equal(data.status, AgreementApprovalStatus.WAITING);
    assert.equal(data.stayStart.toISOString().slice(0, 10), "2026-04-10");
    assert.equal(data.stayEnd.toISOString().slice(0, 10), "2026-04-12");
  } finally {
    restore();
  }
}

async function testPrismaUpdateVisaHotelAgreement(): Promise<void> {
  let updatedPayload: Record<string, unknown> | null = null;
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

    assert.equal(result.code, "GRP-PRISMA");
    assert.ok(updatedPayload);
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
    assert.equal(data.city, AgreementCity.MADINAH);
    assert.equal(data.sourceDraftId, "draft-update-1");
    assert.equal(data.hotelName, "Pullman");
    assert.equal(data.agreementNumber, "AG-PR-2");
    assert.equal(data.status, AgreementApprovalStatus.APPROVED);

    await assert.rejects(
      () =>
        service.updateVisaHotelAgreement("GRP-PRISMA", "missing-hotel", {
          city: AgreementCity.MADINAH,
          hotelName: "Pullman",
          agreementNumber: "AG-X",
          pax: 45,
          stayStart: "2026-04-12",
          stayEnd: "2026-04-15",
        }),
      (error: unknown) => {
        assert.equal(error instanceof NotFoundException, true);
        assert.match(
          (error as Error).message,
          /Hotel agreement 'missing-hotel' not found/i,
        );
        return true;
      },
    );
  } finally {
    restore();
  }
}

async function testPrismaRemoveVisaHotelAgreementGuards(): Promise<void> {
  {
    let deleteCalled = false;
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
      assert.equal(deleteCalled, true);
      assert.equal(result.code, "GRP-PRISMA");
    } finally {
      restore();
    }
  }

  {
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
            stayStart: new Date("2026-04-13T00:00:00.000Z"),
            stayEnd: new Date("2026-04-15T00:00:00.000Z"),
          },
        ],
        deleteMany: async () => ({ count: 0 }),
      },
    } as unknown as PrismaService;

    const { service, restore } = createPrismaService(prismaMock);
    try {
      await assert.rejects(
        () => service.removeVisaHotelAgreement("GRP-PRISMA", "mad-1"),
        (error: unknown) => {
          assert.equal(error instanceof NotFoundException, true);
          assert.match(
            (error as Error).message,
            /Hotel agreement 'mad-1' not found/i,
          );
          return true;
        },
      );
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
      assert.equal(deleteCalled, true);
      assert.equal(result.code, "GRP-PRISMA");
    } finally {
      restore();
    }
  }
}

async function main(): Promise<void> {
  await runCase(
    "groups prisma add visa hotel agreement",
    testPrismaAddVisaHotelAgreement,
  );
  await runCase(
    "groups prisma update visa hotel agreement",
    testPrismaUpdateVisaHotelAgreement,
  );
  await runCase(
    "groups prisma remove visa hotel agreement guards",
    testPrismaRemoveVisaHotelAgreementGuards,
  );
}

void main().catch((error: unknown) => {
  console.error("Groups prisma visa test failed:", error);
  process.exitCode = 1;
});
