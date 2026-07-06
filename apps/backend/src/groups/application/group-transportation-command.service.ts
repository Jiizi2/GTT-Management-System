import { ConflictException, NotFoundException } from "@nestjs/common";
import { ChecklistAssignmentStatus, Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { ConfirmChecklistDriverDto } from "../dto/confirm-checklist-driver.dto";
import type { ResetChecklistDriverDto } from "../dto/reset-checklist-driver.dto";
import {
  confirmChecklistDriverInMemory,
  resetChecklistDriverInMemory,
} from "../infrastructure/groups.memory-store";
import { buildChecklistAssignmentIdentity, toChecklistAssignmentSyncResult } from "../domain/groups.shared";
import type {
  ChecklistAssignmentSyncResult,
  MemoryGroupRecord,
} from "../groups.service-types";

export class GroupTransportationCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataSource: "memory" | "prisma",
    private readonly memoryGroups: MemoryGroupRecord[],
  ) {}

  async confirmChecklistDriver(
    idOrCode: string,
    payload: ConfirmChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    await this.ensureNotChildGroup(idOrCode, "checklist");
    if (this.dataSource === "prisma") {
      return this.confirmChecklistDriverWithPrisma(idOrCode, payload);
    }

    return confirmChecklistDriverInMemory(this.memoryGroups, idOrCode, payload);
  }

  async resetChecklistDriver(
    idOrCode: string,
    payload: ResetChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    await this.ensureNotChildGroup(idOrCode, "checklist");
    if (this.dataSource === "prisma") {
      return this.resetChecklistDriverWithPrisma(idOrCode, payload);
    }

    return resetChecklistDriverInMemory(this.memoryGroups, idOrCode, payload);
  }

  public async ensureNotChildGroup(
    idOrCode: string,
    operation: string,
  ): Promise<void> {
    if (this.dataSource === "prisma") {
      const group = await this.prisma.group.findFirst({
        where: {
          OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
        },
        select: {
          parentGroupId: true,
          code: true,
        },
      });
      if (group && group.parentGroupId) {
        throw new ConflictException(
          `Grup '${group.code}' adalah child group. Silakan edit ${operation} pada parent group.`,
        );
      }
    } else {
      const normalizedCode = idOrCode.trim().toUpperCase();
      const group = this.memoryGroups.find(
        (item) => item.id === idOrCode || item.code === normalizedCode,
      );
      if (group && group.parentGroupId) {
        throw new ConflictException(
          `Grup '${group.code}' adalah child group. Silakan edit ${operation} pada parent group.`,
        );
      }
    }
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

  private async acquirePrismaTransactionLock(
    prismaClient: Pick<PrismaService, "$executeRaw">,
    namespace: string,
    key: string,
  ): Promise<void> {
    await prismaClient.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${namespace}), hashtext(${key}))
    `;
  }

  private async confirmChecklistDriverWithPrisma(
    idOrCode: string,
    payload: ConfirmChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const normalizedTripDate = payload.tripDate.trim().slice(0, 10);
    const normalizedActivity = payload.activity.trim();
    const normalizedTripLabel = payload.tripLabel.trim();
    const normalizedScheduledTime = payload.scheduledTime.trim();
    const requiredBusCount = Math.max(1, payload.requiredBusCount);
    const transferByTrain = payload.transferByTrain ?? false;
    const trainDepartureTime = payload.trainDepartureTime?.trim() || null;
    const stationPickupTime = payload.stationPickupTime?.trim() || null;
    const normalizedDriver = {
      name: payload.driver.name.trim(),
      phone: payload.driver.phone.trim(),
      plateNumber: payload.driver.plateNumber.trim(),
    };
    const tripDate = new Date(`${normalizedTripDate}T00:00:00.000Z`);
    const assignmentIdentity = buildChecklistAssignmentIdentity({
      tripDateIso: normalizedTripDate,
      scheduledTime: normalizedScheduledTime,
      activity: normalizedActivity,
      tripLabel: normalizedTripLabel,
    });

    const syncedAssignment = await this.prisma.$transaction(async (tx) => {
      await this.acquirePrismaTransactionLock(
        tx,
        "checklist-assignment",
        `${group.id}|${assignmentIdentity}`,
      );

      let assignment = await tx.checklistAssignment.findFirst({
        where: {
          groupId: group.id,
          tripDate,
          scheduledTime: normalizedScheduledTime,
          activity: normalizedActivity,
          tripLabel: normalizedTripLabel,
        },
        include: {
          drivers: {
            orderBy: {
              slotNumber: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!assignment) {
        assignment = await tx.checklistAssignment.create({
          data: {
            groupId: group.id,
            tripDate,
            activity: normalizedActivity,
            tripLabel: normalizedTripLabel,
            requiredBusCount,
            scheduledTime: normalizedScheduledTime,
            transferByTrain,
            trainDepartureTime,
            stationPickupTime,
            status: ChecklistAssignmentStatus.NOT_COMPLETE,
          },
          include: {
            drivers: {
              orderBy: {
                slotNumber: "asc",
              },
            },
          },
        });
      } else {
        assignment = await tx.checklistAssignment.update({
          where: {
            id: assignment.id,
          },
          data: {
            activity: normalizedActivity,
            tripLabel: normalizedTripLabel,
            requiredBusCount,
            transferByTrain,
            trainDepartureTime,
            stationPickupTime,
          },
          include: {
            drivers: {
              orderBy: {
                slotNumber: "asc",
              },
            },
          },
        });
      }

      if (assignment.drivers.length < requiredBusCount) {
        for (
          let slotNumber = assignment.drivers.length + 1;
          slotNumber <= requiredBusCount;
          slotNumber += 1
        ) {
          try {
            await tx.checklistDriver.create({
              data: {
                checklistAssignmentId: assignment.id,
                slotNumber,
                name: normalizedDriver.name,
                phone: normalizedDriver.phone,
                plateNumber: normalizedDriver.plateNumber,
                isVerified: true,
              },
            });
            break;
          } catch (error: unknown) {
            if (
              !(error instanceof Prisma.PrismaClientKnownRequestError) ||
              error.code !== "P2002"
            ) {
              throw error;
            }
          }
        }
      }

      const refreshed = await tx.checklistAssignment.findUniqueOrThrow({
        where: {
          id: assignment.id,
        },
        include: {
          drivers: {
            orderBy: {
              slotNumber: "asc",
            },
          },
        },
      });

      const nextStatus =
        refreshed.drivers.length >= requiredBusCount
          ? ChecklistAssignmentStatus.ASSIGNED
          : ChecklistAssignmentStatus.NOT_COMPLETE;

      if (refreshed.status === nextStatus) {
        return refreshed;
      }

      return tx.checklistAssignment.update({
        where: {
          id: refreshed.id,
        },
        data: {
          status: nextStatus,
        },
        include: {
          drivers: {
            orderBy: {
              slotNumber: "asc",
            },
          },
        },
      });
    });

    return toChecklistAssignmentSyncResult(group.code, {
      id: syncedAssignment.id,
      tripDate: syncedAssignment.tripDate.toISOString().slice(0, 10),
      activity: syncedAssignment.activity,
      tripLabel: syncedAssignment.tripLabel,
      requiredBusCount: syncedAssignment.requiredBusCount,
      scheduledTime: syncedAssignment.scheduledTime,
      transferByTrain: syncedAssignment.transferByTrain,
      trainDepartureTime: syncedAssignment.trainDepartureTime ?? undefined,
      stationPickupTime: syncedAssignment.stationPickupTime ?? undefined,
      status: syncedAssignment.status,
      drivers: syncedAssignment.drivers.map((driver) => ({
        slotNumber: driver.slotNumber,
        name: driver.name,
        phone: driver.phone,
        plateNumber: driver.plateNumber,
        isVerified: driver.isVerified,
      })),
    });
  }

  private async resetChecklistDriverWithPrisma(
    idOrCode: string,
    payload: ResetChecklistDriverDto,
  ): Promise<ChecklistAssignmentSyncResult> {
    const group = await this.resolvePrismaGroupIdentity(idOrCode);
    const normalizedTripDate = payload.tripDate.trim().slice(0, 10);
    const normalizedScheduledTime = payload.scheduledTime.trim();
    const normalizedActivity = payload.activity?.trim().toLowerCase();
    const tripDate = new Date(`${normalizedTripDate}T00:00:00.000Z`);

    const resetAssignment = await this.prisma.$transaction(async (tx) => {
      await this.acquirePrismaTransactionLock(
        tx,
        "checklist-assignment-reset",
        `${group.id}|${normalizedTripDate}|${normalizedScheduledTime}|${normalizedActivity ?? "*"}`,
      );

      const assignment = await tx.checklistAssignment.findFirst({
        where: {
          groupId: group.id,
          tripDate,
          scheduledTime: normalizedScheduledTime,
          ...(normalizedActivity
            ? {
                activity: {
                  equals: normalizedActivity,
                  mode: "insensitive",
                },
              }
            : {}),
        },
        include: {
          drivers: {
            orderBy: {
              slotNumber: "asc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!assignment) {
        throw new NotFoundException(
          `Checklist assignment for '${idOrCode}' on '${normalizedTripDate}' at '${normalizedScheduledTime}' not found.`,
        );
      }

      await tx.checklistDriver.deleteMany({
        where: {
          checklistAssignmentId: assignment.id,
        },
      });

      return tx.checklistAssignment.update({
        where: {
          id: assignment.id,
        },
        data: {
          status: ChecklistAssignmentStatus.NOT_COMPLETE,
        },
        include: {
          drivers: {
            orderBy: {
              slotNumber: "asc",
            },
          },
        },
      });
    });

    return toChecklistAssignmentSyncResult(group.code, {
      id: resetAssignment.id,
      tripDate: resetAssignment.tripDate.toISOString().slice(0, 10),
      activity: resetAssignment.activity,
      tripLabel: resetAssignment.tripLabel,
      requiredBusCount: resetAssignment.requiredBusCount,
      scheduledTime: resetAssignment.scheduledTime,
      transferByTrain: resetAssignment.transferByTrain,
      trainDepartureTime: resetAssignment.trainDepartureTime ?? undefined,
      stationPickupTime: resetAssignment.stationPickupTime ?? undefined,
      status: resetAssignment.status,
      drivers: [],
    });
  }
}
