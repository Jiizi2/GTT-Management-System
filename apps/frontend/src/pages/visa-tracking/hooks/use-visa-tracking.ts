import { useEffect, useMemo, useState } from "react";
import * as Domain from "../../../shared/app-domain";
import type {
  AgreementApprovalStatus,
  GroupData,
  GroupRaudhahStatus,
  VisaFilterId,
  VisaTrackingRow,
} from "../../../shared/app-domain";

const {
  buildVisaTrackingRowsFromGroups,
  formatLocalIsoDate,
  formatVisaShortDate,
  getGroupAgreementHotelsByCity,
  hasMissingHotelAllocation,
  isVisaRowActionRequired,
  resolveValidRaudhahAppointments,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  VISA_PAGE_SIZE,
} = Domain;

export function resolveVisaTypeLabel(group: GroupData | undefined): "Visa+" | "Visa Only" {
  return group?.visaSetup?.busStatus === "Visa+" ? "Visa+" : "Visa Only";
}

export function formatSyarikahName(syarikah: string | undefined): string {
  if (!syarikah) return "-";
  const trimmed = syarikah.trim();
  if (!trimmed) return "-";
  const words = trimmed.split(/\s+/);
  return words[0] || "-";
}

export function getAgreementApprovalClasses(status: "Approved" | "Waiting for Approval", isDarkMode: boolean): string {
  if (status === "Approved") {
    return isDarkMode
      ? "border-primary/30 bg-primary/14 text-primary"
      : "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  return isDarkMode
    ? "border-secondary/35 bg-secondary/16 text-secondary"
    : "border-amber-200 bg-amber-100 text-amber-800";
}

export function toAgreementStatusSelectValue(status: AgreementApprovalStatus): "approved" | "waiting" {
  return status === "Approved" ? "approved" : "waiting";
}

export function fromAgreementStatusSelectValue(value: string): AgreementApprovalStatus {
  return value === "approved" ? "Approved" : "Waiting for Approval";
}

export type IssuedMonthOption = {
  value: string;
  label: string;
};

export function resolveIssuedMonthKey(isoDate: string): string | null {
  const normalizedIsoDate = isoDate.trim();
  const matchedMonth = normalizedIsoDate.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!matchedMonth) {
    return null;
  }

  return `${matchedMonth[1]}-${matchedMonth[2]}`;
}

export function formatIssuedMonthLabel(monthKey: string): string {
  const parsedDate = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return monthKey;
  }

  return parsedDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

export function resolveRaudhahEntries(
  row: VisaTrackingRow,
  group: GroupData | undefined,
): Array<{ key: string; dateLabel: string; status: GroupRaudhahStatus }> {
  const normalizedAppointments = resolveValidRaudhahAppointments(group);
  if (normalizedAppointments.length === 0) {
    return [
      {
        key: `${row.id}-raudhah-not-set`,
        dateLabel: "Not set",
        status: "Free",
      },
    ];
  }

  const configuredEntries: Array<{
    key: string;
    dateLabel: string;
    status: GroupRaudhahStatus;
    sortDate: string;
  }> = [];
  const seenEntryKeys = new Set<string>();

  normalizedAppointments.forEach((appointment) => {
    const dateIso = appointment.dateIso;
    const dateLabel = appointment.status === "Free" ? "Not set" : formatVisaShortDate(dateIso);

    const dedupeKey = `${dateLabel}-${appointment.status}`;
    if (seenEntryKeys.has(dedupeKey)) {
      return;
    }
    seenEntryKeys.add(dedupeKey);

    configuredEntries.push({
      key: appointment.id,
      dateLabel,
      status: appointment.status,
      sortDate: appointment.status === "Free" ? "9999-12-31" : dateIso,
    });
  });

  configuredEntries.sort((left, right) => left.sortDate.localeCompare(right.sortDate));

  if (configuredEntries.length > 0) {
    return configuredEntries.map(({ key, dateLabel, status }) => ({
      key,
      dateLabel,
      status,
    }));
  }

  return [
    {
      key: `${row.id}-raudhah-not-set`,
      dateLabel: "Not set",
      status: "Free",
    },
  ];
}

export function resolveCityAgreementApprovalStatus(
  row: VisaTrackingRow,
  group: GroupData | undefined,
  city: "makkah" | "madinah",
): "Approved" | "Waiting for Approval" {
  const cityAgreements = getGroupAgreementHotelsByCity(group, city);
  if (cityAgreements.length > 0) {
    const isAllApproved = cityAgreements.every((agreement) => agreement.status === "Approved");
    return isAllApproved ? "Approved" : "Waiting for Approval";
  }

  const verifiedCount = city === "makkah" ? row.makkahVerified : row.madinahVerified;
  return verifiedCount >= row.pax ? "Approved" : "Waiting for Approval";
}

export type VisaRowGroup = {
  mainRow: VisaTrackingRow;
  followerRows: VisaTrackingRow[];
};

export const desktopTableGridTemplate = "minmax(0, 0.9fr) minmax(0, 1.12fr) minmax(0, 0.64fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.72fr) minmax(0, 0.62fr) minmax(0, 0.8fr) minmax(0, 0.66fr)";

export function getVisaRowGroupKey(rowGroup: VisaRowGroup): string {
  return rowGroup.mainRow.id || rowGroup.mainRow.groupCode;
}

export function useVisaTracking({
  groups,
}: {
  groups: GroupData[];
}) {
  const currentIssuedMonthKey = useMemo(() => formatLocalIsoDate(new Date()).slice(0, 7), []);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<VisaFilterId>("all");
  const [issuedMonthFilter, setIssuedMonthFilter] = useState(() => currentIssuedMonthKey);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedRowGroupKeys, setExpandedRowGroupKeys] = useState<Set<string>>(() => new Set());

  const visaRows = useMemo(() => buildVisaTrackingRowsFromGroups(groups), [groups]);
  const groupByCode = useMemo(() => new Map(groups.map((group) => [group.code, group] as const)), [groups]);
  const durationByGroupCode = useMemo(
    () => new Map(groups.map((group) => [group.code, group.durationDays] as const)),
    [groups],
  );
  const normalizedQuery = query.trim().toLowerCase();

  const allGroupedRows = useMemo<VisaRowGroup[]>(() => {
    const followersMap = new Map<string, VisaTrackingRow[]>();
    const rowByGroupId = new Map<string, VisaTrackingRow>();
    const rowByGroupCode = new Map<string, VisaTrackingRow>();

    visaRows.forEach(row => {
      const group = groupByCode.get(row.groupCode);
      if (group) {
        if (group.id) rowByGroupId.set(group.id, row);
        rowByGroupCode.set(group.code, row);
      }
    });

    const followerRowIds = new Set<string>();

    visaRows.forEach(row => {
      const group = groupByCode.get(row.groupCode);
      if (group && group.parentGroupId) {
        const parentRow = rowByGroupId.get(group.parentGroupId) || rowByGroupCode.get(group.parentGroupId);
        if (parentRow) {
          followerRowIds.add(row.id);
          const parentKey = parentRow.id || parentRow.groupCode;
          if (!followersMap.has(parentKey)) {
            followersMap.set(parentKey, []);
          }
          followersMap.get(parentKey)!.push(row);
        }
      }
    });

    const result: VisaRowGroup[] = [];
    visaRows.forEach(row => {
      if (!followerRowIds.has(row.id)) {
        const parentKey = row.id;
        const followers = followersMap.get(parentKey) || [];
        result.push({
          mainRow: row,
          followerRows: followers,
        });
      }
    });

    return result;
  }, [visaRows, groupByCode]);

  const doesRowMatchQuery = (row: VisaTrackingRow): boolean => {
    if (!normalizedQuery) {
      return true;
    }

    const group = groupByCode.get(row.groupCode);
    const makkahAgreementNumber = resolveVisaAgreementNumber(row, group, "makkah");
    const madinahAgreementNumber = resolveVisaAgreementNumber(row, group, "madinah");
    const raudhahEntries = resolveRaudhahEntries(row, group)
      .map((entry) => `${entry.dateLabel} ${entry.status}`)
      .join(" ");

    return [
      row.groupCode,
      row.groupName,
      `${row.pax}`,
      makkahAgreementNumber,
      madinahAgreementNumber,
      raudhahEntries,
      row.visaStatus,
      row.paymentStatus,
    ].some((value) => value.toLowerCase().includes(normalizedQuery));
  };

  const doesRowMatchActiveFilter = (row: VisaTrackingRow): boolean => {
    if (activeFilter === "all") {
      return true;
    }

    if (activeFilter === "not-issued") {
      return row.visaStatus !== "Issued";
    }

    if (activeFilter === "missing-hotel") {
      return hasMissingHotelAllocation(row);
    }

    if (activeFilter === "visa-only") {
      const group = groupByCode.get(row.groupCode);
      return resolveVisaTypeLabel(group) === "Visa Only";
    }

    if (activeFilter === "visa-plus") {
      const group = groupByCode.get(row.groupCode);
      return resolveVisaTypeLabel(group) === "Visa+";
    }

    return row.paymentStatus !== "Paid";
  };

  const filteredGroupedRows = useMemo(() => {
    return allGroupedRows
      .filter(rowGroup => {
        if (!normalizedQuery) return true;
        return doesRowMatchQuery(rowGroup.mainRow) || rowGroup.followerRows.some(f => doesRowMatchQuery(f));
      })
      .filter(rowGroup => {
        if (activeFilter === "all") return true;
        return doesRowMatchActiveFilter(rowGroup.mainRow) || rowGroup.followerRows.some(f => doesRowMatchActiveFilter(f));
      })
      .filter(rowGroup => {
        if (issuedMonthFilter === "all") return true;
        const mainMonth = resolveIssuedMonthKey(rowGroup.mainRow.departureIso);
        if (mainMonth === issuedMonthFilter) return true;
        return rowGroup.followerRows.some(f => resolveIssuedMonthKey(f.departureIso) === issuedMonthFilter);
      });
  }, [allGroupedRows, normalizedQuery, activeFilter, issuedMonthFilter, groupByCode]);

  const issuedMonthOptions = useMemo<IssuedMonthOption[]>(() => {
    const monthCounter = new Map<string, number>();
    monthCounter.set(currentIssuedMonthKey, 0);

    visaRows.forEach((row) => {
      const issuedMonthKey = resolveIssuedMonthKey(row.departureIso);
      if (!issuedMonthKey) {
        return;
      }

      monthCounter.set(issuedMonthKey, (monthCounter.get(issuedMonthKey) ?? 0) + 1);
    });

    return Array.from(monthCounter.entries())
      .sort((left, right) => right[0].localeCompare(left[0]))
      .map(([value]) => ({
        value,
        label: formatIssuedMonthLabel(value),
      }));
  }, [currentIssuedMonthKey, visaRows]);

  const notIssuedCount = visaRows.filter((row) => row.visaStatus !== "Issued").length;
  const missingHotelCount = visaRows.filter((row) => hasMissingHotelAllocation(row)).length;
  const unpaidCount = visaRows.filter((row) => row.paymentStatus !== "Paid").length;
  const visaOnlyCount = visaRows.filter((row) => {
    const group = groupByCode.get(row.groupCode);
    return resolveVisaTypeLabel(group) === "Visa Only";
  }).length;
  const visaPlusCount = visaRows.filter((row) => {
    const group = groupByCode.get(row.groupCode);
    return resolveVisaTypeLabel(group) === "Visa+";
  }).length;
  const issuedPaxCount = useMemo(() => {
    return visaRows
      .filter((row) => row.visaStatus === "Issued")
      .reduce((sum, row) => sum + row.pax, 0);
  }, [visaRows]);
  
  const hasRowsForExport = filteredGroupedRows.length > 0;
  const selectedIssuedMonthLabel =
    issuedMonthFilter === "all"
      ? "All Months"
      : (issuedMonthOptions.find((option) => option.value === issuedMonthFilter)?.label ?? issuedMonthFilter);
  const actionRequiredCount = visaRows.filter((row) => isVisaRowActionRequired(row)).length;

  const totalPages = Math.max(1, Math.ceil(filteredGroupedRows.length / VISA_PAGE_SIZE));
  const startIndex = (currentPage - 1) * VISA_PAGE_SIZE;
  const paginatedRows = filteredGroupedRows.slice(startIndex, startIndex + VISA_PAGE_SIZE);
  const rangeStart = filteredGroupedRows.length === 0 ? 0 : startIndex + 1;
  const rangeEnd = filteredGroupedRows.length === 0 ? 0 : Math.min(filteredGroupedRows.length, startIndex + paginatedRows.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, activeFilter, issuedMonthFilter]);

  useEffect(() => {
    if (issuedMonthFilter === "all") {
      return;
    }

    const isSelectedMonthAvailable = issuedMonthOptions.some((option) => option.value === issuedMonthFilter);
    if (!isSelectedMonthAvailable) {
      setIssuedMonthFilter(currentIssuedMonthKey);
    }
  }, [currentIssuedMonthKey, issuedMonthFilter, issuedMonthOptions]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  const handleExportPdf = () => {
    const printableWindow = window.open("", "_blank", "width=1120,height=760");
    if (!printableWindow) {
      window.alert("Popup diblokir browser. Izinkan pop-up lalu coba Export PDF lagi.");
      return;
    }

    const exportedRows = filteredGroupedRows.flatMap(rg => [rg.mainRow, ...rg.followerRows]);

    void import("../../visa-tracking-export")
      .then(({ exportVisaTrackingReportPdf }) => {
        const exported = exportVisaTrackingReportPdf(
          {
            rows: exportedRows,
            groups,
            query,
            activeFilter,
            issuedMonthLabel: selectedIssuedMonthLabel,
          },
          {
            printWindow: printableWindow,
          },
        );

        if (!exported) {
          if (!printableWindow.closed) {
            printableWindow.close();
          }
          window.alert("Popup diblokir browser. Izinkan pop-up lalu coba Export PDF lagi.");
        }
      })
      .catch(() => {
        if (!printableWindow.closed) {
          printableWindow.close();
        }
        window.alert("Gagal menyiapkan export PDF. Coba lagi.");
      });
  };

  const toggleRowGroup = (rowGroupKey: string) => {
    setExpandedRowGroupKeys((current) => {
      const next = new Set(current);
      if (next.has(rowGroupKey)) {
        next.delete(rowGroupKey);
      } else {
        next.add(rowGroupKey);
      }
      return next;
    });
  };

  return {
    query,
    setQuery,
    activeFilter,
    setActiveFilter,
    issuedMonthFilter,
    setIssuedMonthFilter,
    currentPage,
    setCurrentPage,
    expandedRowGroupKeys,
    visaRows,
    groupByCode,
    durationByGroupCode,
    allGroupedRows,
    filteredGroupedRows,
    issuedMonthOptions,
    notIssuedCount,
    missingHotelCount,
    unpaidCount,
    visaOnlyCount,
    visaPlusCount,
    issuedPaxCount,
    hasRowsForExport,
    selectedIssuedMonthLabel,
    actionRequiredCount,
    totalPages,
    paginatedRows,
    rangeStart,
    rangeEnd,
    handleExportPdf,
    toggleRowGroup,
  };
}
