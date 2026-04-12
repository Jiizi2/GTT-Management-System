import { GroupTone, Prisma, VisaPaymentStatus, VisaStatus } from "@prisma/client";
import { buildGroupSearchDocument, normalizeGroupSearchTokens } from "../domain/groups.search-document";
import type {
  FindAllOptions,
  GroupListFilter,
  GroupResponseProjection,
  MemoryGroupRecord,
  PaginatedGroupList,
} from "../groups.service-types";

type MemoryGroupSummary = Omit<
  MemoryGroupRecord,
  "musyrif" | "timeline" | "visaSetup" | "checklistAssignments"
>;

export function projectMemoryGroupRecord(
  group: MemoryGroupRecord,
  projection: GroupResponseProjection,
): MemoryGroupRecord | MemoryGroupSummary {
  if (projection === "detail") {
    return group;
  }

  return {
    id: group.id,
    code: group.code,
    name: group.name,
    status: group.status,
    arrivalDate: group.arrivalDate,
    returnDate: group.returnDate,
    tone: group.tone,
    pax: group.pax,
    totalBuses: group.totalBuses,
    packageName: group.packageName,
    durationDays: group.durationDays,
    nextActivity: group.nextActivity,
    itinerary: group.itinerary,
    notes: group.notes,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
}

export function findAllFromMemory(
  memoryGroups: MemoryGroupRecord[],
  query?: string,
  rawFilter?: string,
  activeOnly = false,
): MemoryGroupRecord[] {
  const searchTokens = normalizeGroupSearchTokens(query);
  const filter = normalizeGroupListFilter(rawFilter);
  const source =
    searchTokens.length === 0
      ? memoryGroups
      : memoryGroups.filter((item) => {
          const searchDocument = buildGroupSearchDocument({
            code: item.code,
            name: item.name,
            status: item.status,
            packageName: item.packageName,
          });
          return searchTokens.every((token) => searchDocument.includes(token));
        });

  const filtered = source.filter((item) => matchesMemoryFilter(item, filter, activeOnly));
  return [...filtered].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function resolvePaginationState(options?: FindAllOptions): { page: number; pageSize: number } | null {
  const hasPage = Number.isFinite(options?.page);
  const hasPageSize = Number.isFinite(options?.pageSize);
  if (!hasPage && !hasPageSize) {
    return null;
  }

  const page = options?.page && options.page > 0 ? Math.floor(options.page) : 1;
  const requestedSize = options?.pageSize && options.pageSize > 0 ? Math.floor(options.pageSize) : 20;
  const pageSize = Math.max(1, Math.min(100, requestedSize));

  return { page, pageSize };
}

export function paginateGroupItems<T>(
  items: T[],
  options?: FindAllOptions,
): T[] | PaginatedGroupList<T> {
  const pageState = resolvePaginationState(options);
  if (!pageState) {
    return items;
  }

  const start = (pageState.page - 1) * pageState.pageSize;
  const pagedItems = items.slice(start, start + pageState.pageSize);
  return {
    items: pagedItems,
    total: items.length,
    page: pageState.page,
    pageSize: pageState.pageSize,
  };
}

export function normalizeGroupListFilter(rawFilter?: string): GroupListFilter {
  const normalized = rawFilter?.trim().toLowerCase();
  if (normalized === "not-issued" || normalized === "missing-hotel" || normalized === "unpaid") {
    return normalized;
  }
  return "all";
}

function matchesMemoryFilter(item: MemoryGroupRecord, filter: GroupListFilter, activeOnly: boolean): boolean {
  if (activeOnly && item.tone !== GroupTone.ACTIVE) {
    return false;
  }

  if (filter === "all") {
    return true;
  }

  if (filter === "not-issued") {
    return item.visaSetup?.visaStatus !== VisaStatus.ISSUED;
  }

  if (filter === "missing-hotel") {
    return !item.visaSetup || item.visaSetup.hotelAgreements.length === 0;
  }

  return item.visaSetup?.paymentStatus !== VisaPaymentStatus.PAID;
}

export function buildGroupWhere(query?: string, rawFilter?: string, activeOnly = false): Prisma.GroupWhereInput | undefined {
  const searchTokens = normalizeGroupSearchTokens(query);
  const filter = normalizeGroupListFilter(rawFilter);
  const conditions: Prisma.GroupWhereInput[] = [];

  if (searchTokens.length > 0) {
    conditions.push({
      AND: searchTokens.map<Prisma.GroupWhereInput>((token) => ({
        searchDocument: {
          contains: token,
          mode: "insensitive",
        },
      })),
    });
  }

  if (activeOnly) {
    conditions.push({
      tone: GroupTone.ACTIVE,
    });
  }

  if (filter === "not-issued") {
    conditions.push({
      OR: [
        {
          visaSetup: {
            is: null,
          },
        },
        {
          visaSetup: {
            is: {
              visaStatus: {
                not: VisaStatus.ISSUED,
              },
            },
          },
        },
      ],
    });
  } else if (filter === "missing-hotel") {
    conditions.push({
      OR: [
        {
          visaSetup: {
            is: null,
          },
        },
        {
          visaSetup: {
            is: {
              hotelAgreements: {
                none: {},
              },
            },
          },
        },
      ],
    });
  } else if (filter === "unpaid") {
    conditions.push({
      OR: [
        {
          visaSetup: {
            is: null,
          },
        },
        {
          visaSetup: {
            is: {
              paymentStatus: {
                not: VisaPaymentStatus.PAID,
              },
            },
          },
        },
      ],
    });
  }

  if (conditions.length === 0) {
    return undefined;
  }

  return {
    AND: conditions,
  };
}
