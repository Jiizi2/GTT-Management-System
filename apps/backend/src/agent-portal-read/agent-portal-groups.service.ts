import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GroupLifecycleStatus, Prisma } from "@prisma/client";
import { resolveConfiguredDataSource } from "../config/app-config";
import type { MemoryGroupRecord } from "../groups/groups.service-types";
import { GroupMemoryStore } from "../infrastructure/repositories/memory/group-memory-store";
import { PrismaService } from "../prisma/prisma.service";
import type { AgentPortalGroupQueryDto } from "./dto/agent-portal-group-query.dto";

const notFound = (): NotFoundException => new NotFoundException("RESOURCE_NOT_FOUND");
const toIso = (value: Date | string | undefined | null): string | null => value ? new Date(value).toISOString() : null;
const lifecycleOf = (group: MemoryGroupRecord): GroupLifecycleStatus => group.lifecycleStatus ?? GroupLifecycleStatus.ACTIVE;

function summary(group: {
  id: string; code: string; name: string; lifecycleStatus: GroupLifecycleStatus;
  arrivalDate: Date | string; returnDate: Date | string; pax: number;
}) {
  return {
    id: group.id,
    code: group.code,
    name: group.name,
    lifecycleStatus: group.lifecycleStatus,
    arrivalDate: toIso(group.arrivalDate),
    returnDate: toIso(group.returnDate),
    pax: group.pax,
  };
}

/**
 * Source shapes for the Portal Agent projections. Both memory and Prisma records
 * feed these, so optional fields stay optional and are defaulted at projection
 * time. Only what the projections actually read is declared.
 */
type ItinerarySource = {
  id: string;
  sortOrder: number;
  dateLabel: string;
  yearLabel: string;
  category: string;
  title: string;
  isoDate?: Date | string | null;
  time?: string | null;
  transportMode?: string | null;
  flightNumber?: string | null;
  hotelName?: string | null;
  fromHotelName?: string | null;
  fromLocation?: string | null;
  toLocation?: string | null;
  cityTourCity?: string | null;
  requiresBus?: boolean | null;
  transferByTrain?: boolean | null;
  trainDepartureTime?: string | null;
  destinationPickupTime?: string | null;
  hotelPickupRequestTime?: string | null;
};

type TransportSource = {
  id: string;
  tripDate?: Date | string | null;
  activity: string;
  tripLabel: string;
  requiredBusCount: number;
  scheduledTime: string;
  transferByTrain?: boolean | null;
  trainDepartureTime?: string | null;
  stationPickupTime?: string | null;
  status?: string;
  drivers?: Array<{ isVerified?: boolean }>;
};

type OverviewGroup = Parameters<typeof summary>[0] & {
  packageName?: string;
  totalBuses?: number | null;
  musyrif?: { name: string; phone: string; avatar: string } | null;
  notes?: Array<{ id?: string; sortOrder?: number; text: string; pinned?: boolean }>;
  itinerary?: ItinerarySource[];
};

@Injectable()
export class AgentPortalGroupsService {
  private readonly dataSource: "memory" | "prisma";

  constructor(config: ConfigService, private readonly prisma: PrismaService, private readonly store: GroupMemoryStore) {
    this.dataSource = resolveConfiguredDataSource(config);
  }

  async list(agentId: string, query: AgentPortalGroupQueryDto) {
    return this.dataSource === "prisma" ? this.listPrisma(agentId, query) : this.listMemory(agentId, query);
  }

  async detail(agentId: string, idOrCode: string) {
    if (this.dataSource === "memory") {
      const group = this.findMemory(agentId, idOrCode);
      return {
        ...this.overviewSummary({ ...group, lifecycleStatus: lifecycleOf(group) }),
        totalBuses: group.totalBuses ?? null,
        durationDays: group.durationDays,
      };
    }
    const group = await this.prisma.group.findFirst({
      where: this.ownedIdentity(agentId, idOrCode),
      select: {
        id: true, code: true, name: true, lifecycleStatus: true, arrivalDate: true,
        returnDate: true, pax: true, packageName: true, totalBuses: true, durationDays: true,
        musyrif: { select: { name: true, phone: true, avatar: true } },
        notes: { orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true, text: true, pinned: true } },
        itinerary: { orderBy: { sortOrder: "asc" }, select: {
          id: true, sortOrder: true, dateLabel: true, yearLabel: true, category: true, title: true,
          isoDate: true, time: true, flightNumber: true, hotelName: true, fromHotelName: true,
          fromLocation: true, toLocation: true, cityTourCity: true, requiresBus: true,
          transferByTrain: true, trainDepartureTime: true, destinationPickupTime: true,
          hotelPickupRequestTime: true,
        } },
      },
    });
    if (!group) throw notFound();
    return { ...this.overviewSummary(group), totalBuses: group.totalBuses, durationDays: group.durationDays };
  }

  async itinerary(agentId: string, idOrCode: string) {
    if (this.dataSource === "memory") {
      return (this.findMemory(agentId, idOrCode).itinerary ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => this.projectItinerary(item));
    }
    const group = await this.prisma.group.findFirst({
      where: this.ownedIdentity(agentId, idOrCode),
      select: { itinerary: { orderBy: { sortOrder: "asc" }, select: {
        id: true, sortOrder: true, dateLabel: true, yearLabel: true, category: true, title: true,
        isoDate: true, time: true, flightNumber: true, hotelName: true, fromHotelName: true,
        fromLocation: true, toLocation: true, cityTourCity: true, requiresBus: true,
        transferByTrain: true, trainDepartureTime: true, destinationPickupTime: true,
        hotelPickupRequestTime: true,
      } } },
    });
    if (!group) throw notFound();
    return group.itinerary.map((item) => this.projectItinerary(item));
  }

  async timeline(agentId: string, idOrCode: string) {
    if (this.dataSource === "memory") {
      return (this.findMemory(agentId, idOrCode).timeline ?? [])
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map(({ dateLabel, title, isCurrent }) => ({ dateLabel, title, isCurrent: isCurrent ?? false }));
    }
    const group = await this.prisma.group.findFirst({
      where: this.ownedIdentity(agentId, idOrCode),
      select: { timeline: { orderBy: { sortOrder: "asc" }, select: { dateLabel: true, title: true, isCurrent: true } } },
    });
    if (!group) throw notFound();
    return group.timeline;
  }

  async visa(agentId: string, idOrCode: string) {
    if (this.dataSource === "memory") {
      const visa = this.findMemory(agentId, idOrCode).visaSetup;
      return visa ? {
        status: visa.visaStatus,
        issuedDate: toIso(visa.issuedDate),
        syarikah: visa.syarikah,
        busStatus: visa.busStatus ?? null,
        paymentStatus: visa.paymentStatus,
      } : { status: null, issuedDate: null, syarikah: null, busStatus: null, paymentStatus: null };
    }
    const group = await this.prisma.group.findFirst({
      where: this.ownedIdentity(agentId, idOrCode),
      select: { visaSetup: { select: { visaStatus: true, issuedDate: true, syarikah: true, busStatus: true, paymentStatus: true } } },
    });
    if (!group) throw notFound();
    return {
      status: group.visaSetup?.visaStatus ?? null,
      issuedDate: toIso(group.visaSetup?.issuedDate),
      syarikah: group.visaSetup?.syarikah ?? null,
      busStatus: group.visaSetup?.busStatus ?? null,
      paymentStatus: group.visaSetup?.paymentStatus ?? null,
    };
  }

  async hotels(agentId: string, idOrCode: string) {
    if (this.dataSource === "memory") {
      return (this.findMemory(agentId, idOrCode).visaSetup?.hotelAgreements ?? []).map((hotel) => ({
        id: hotel.id, city: hotel.city, hotelName: hotel.hotelName, agreementNumber: hotel.agreementNumber, pax: hotel.pax,
        status: hotel.status, stayStart: toIso(hotel.stayStart), stayEnd: toIso(hotel.stayEnd),
      }));
    }
    const group = await this.prisma.group.findFirst({
      where: this.ownedIdentity(agentId, idOrCode),
      select: { visaSetup: { select: { hotelAgreements: { orderBy: [{ stayStart: "asc" }, { id: "asc" }], select: {
        id: true, city: true, hotelName: true, agreementNumber: true, pax: true, status: true, stayStart: true, stayEnd: true,
      } } } } },
    });
    if (!group) throw notFound();
    return (group.visaSetup?.hotelAgreements ?? []).map((hotel) => ({ ...hotel, stayStart: toIso(hotel.stayStart), stayEnd: toIso(hotel.stayEnd) }));
  }

  async transportation(agentId: string, idOrCode: string) {
    if (this.dataSource === "memory") {
      return (this.findMemory(agentId, idOrCode).checklistAssignments ?? []).map((item) => this.projectTransport(item));
    }
    const group = await this.prisma.group.findFirst({
      where: this.ownedIdentity(agentId, idOrCode),
      select: { checklistAssignments: { orderBy: [{ tripDate: "asc" }, { id: "asc" }], select: {
        id: true, tripDate: true, activity: true, tripLabel: true, requiredBusCount: true,
        scheduledTime: true, transferByTrain: true, trainDepartureTime: true,
        stationPickupTime: true, status: true,
        drivers: { select: { isVerified: true } },
      } } },
    });
    if (!group) throw notFound();
    return group.checklistAssignments.map((item) => this.projectTransport(item));
  }

  private async listPrisma(agentId: string, query: AgentPortalGroupQueryDto) {
    const where = this.listWhere(agentId, query);
    const direction = query.sortDirection ?? "asc";
    const sortBy = query.sortBy ?? "arrivalDate";
    const orderBy: Prisma.GroupOrderByWithRelationInput[] = [{ [sortBy]: direction }, { id: direction }];
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const [total, rows] = await Promise.all([
      this.prisma.group.count({ where }),
      this.prisma.group.findMany({
        where, orderBy, skip: (page - 1) * pageSize, take: pageSize,
        select: {
          id: true, code: true, name: true, lifecycleStatus: true, arrivalDate: true, returnDate: true,
          pax: true, packageName: true, totalBuses: true,
          musyrif: { select: { name: true, phone: true, avatar: true } },
          notes: { orderBy: { sortOrder: "asc" }, select: { id: true, sortOrder: true, text: true, pinned: true } },
          itinerary: { orderBy: { sortOrder: "asc" }, select: {
            id: true, sortOrder: true, dateLabel: true, yearLabel: true, category: true, title: true,
            isoDate: true, time: true, flightNumber: true, hotelName: true, fromHotelName: true,
            fromLocation: true, toLocation: true, cityTourCity: true, requiresBus: true,
            transferByTrain: true, trainDepartureTime: true, destinationPickupTime: true,
            hotelPickupRequestTime: true,
          } },
        },
      }),
    ]);
    return { items: rows.map((group) => this.overviewSummary(group)), total, page, pageSize };
  }

  private listMemory(agentId: string, query: AgentPortalGroupQueryDto) {
    const term = query.q?.trim().toLowerCase();
    const from = query.arrivalFrom ? new Date(`${query.arrivalFrom}T00:00:00.000Z`) : null;
    const to = query.arrivalTo ? new Date(`${query.arrivalTo}T23:59:59.999Z`) : null;
    const sortBy = query.sortBy ?? "arrivalDate";
    const direction = query.sortDirection === "desc" ? -1 : 1;
    const filtered = this.store.groups
      .filter((group) => group.agentId === agentId)
      .filter((group) => !term || `${group.code} ${group.name}`.toLowerCase().includes(term))
      .filter((group) => !query.lifecycle || lifecycleOf(group) === query.lifecycle)
      .filter((group) => !from || new Date(group.arrivalDate) >= from)
      .filter((group) => !to || new Date(group.arrivalDate) <= to)
      .sort((a, b) => String(a[sortBy]).localeCompare(String(b[sortBy])) * direction || a.id.localeCompare(b.id) * direction);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize)
        .map((group) => this.overviewSummary({ ...group, lifecycleStatus: lifecycleOf(group) })),
      total: filtered.length, page, pageSize,
    };
  }

  private listWhere(agentId: string, query: AgentPortalGroupQueryDto): Prisma.GroupWhereInput {
    const q = query.q?.trim();
    return {
      agentId,
      lifecycleStatus: query.lifecycle,
      arrivalDate: query.arrivalFrom || query.arrivalTo ? {
        gte: query.arrivalFrom ? new Date(`${query.arrivalFrom}T00:00:00.000Z`) : undefined,
        lte: query.arrivalTo ? new Date(`${query.arrivalTo}T23:59:59.999Z`) : undefined,
      } : undefined,
      ...(q ? { OR: [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ] } : {}),
    };
  }

  private ownedIdentity(agentId: string, idOrCode: string): Prisma.GroupWhereInput {
    return { agentId, OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }] };
  }

  private findMemory(agentId: string, idOrCode: string): MemoryGroupRecord {
    const normalized = idOrCode.trim().toUpperCase();
    const found = this.store.groups.find((group) => group.agentId === agentId && (group.id === idOrCode || group.code === normalized));
    if (!found) throw notFound();
    return found;
  }

  private projectItinerary(item: ItinerarySource) {
    return {
      id: item.id, sortOrder: item.sortOrder, dateLabel: item.dateLabel, yearLabel: item.yearLabel,
      category: item.category, title: item.title, isoDate: toIso(item.isoDate), time: item.time ?? null,
      transportMode: item.transportMode ?? null,
      flightNumber: item.flightNumber ?? null, hotelName: item.hotelName ?? null,
      fromHotelName: item.fromHotelName ?? null, fromLocation: item.fromLocation ?? null,
      toLocation: item.toLocation ?? null, cityTourCity: item.cityTourCity ?? null,
      requiresBus: item.requiresBus, transferByTrain: item.transferByTrain,
      trainDepartureTime: item.trainDepartureTime ?? null,
      destinationPickupTime: item.destinationPickupTime ?? null,
      hotelPickupRequestTime: item.hotelPickupRequestTime ?? null,
    };
  }

  private overviewSummary(group: OverviewGroup) {
    return {
      ...summary(group),
      packageName: group.packageName ?? "",
      totalBuses: group.totalBuses ?? null,
      musyrif: group.musyrif
        ? { name: group.musyrif.name, phone: group.musyrif.phone, avatar: group.musyrif.avatar }
        : null,
      // Group notes are internal Ops data. Keep the stable array contract without
      // exposing note text to Portal Agent.
      notes: [],
      itinerary: (group.itinerary ?? []).map((item) => this.projectItinerary(item)),
    };
  }

  private projectTransport(item: TransportSource) {
    const drivers = item.drivers ?? [];
    return {
      id: item.id, tripDate: toIso(item.tripDate), activity: item.activity, tripLabel: item.tripLabel,
      requiredBusCount: item.requiredBusCount, scheduledTime: item.scheduledTime,
      transferByTrain: item.transferByTrain ?? false, trainDepartureTime: item.trainDepartureTime ?? null,
      stationPickupTime: item.stationPickupTime ?? null, status: item.status,
      assignedDriverCount: drivers.length,
      verifiedDriverCount: drivers.filter((driver: { isVerified?: boolean }) => driver.isVerified).length,
    };
  }
}
