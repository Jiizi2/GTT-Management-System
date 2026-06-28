import { useEffect, useMemo, useRef, useState } from "react";
import * as Domain from "../shared/app-domain";
import type {
  AgreementApprovalStatus,
  GroupData,
  GroupRaudhahStatus,
  VisaFilterId,
  VisaTrackingRow,
} from "../shared/app-domain";
import { PaginationControls } from "../components/pagination-controls";
import { PageHeroSection } from "../components/page-hero-section";
import { SereneSelect } from "../components/serene-select";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { useThemeMode } from "../theme/theme-provider";

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

function getFilterChipClasses(isActive: boolean, isDarkMode: boolean): string {
  if (isActive) {
    return isDarkMode ? "border-primary/45 bg-primary/18 text-primary" : "border-emerald-700 bg-emerald-700 text-white";
  }

  return isDarkMode
    ? "border-slate-300 bg-surface-container-lowest text-slate-700 hover:border-primary/50 hover:text-primary"
    : "border-slate-300 bg-white text-slate-700 hover:border-emerald-500 hover:text-emerald-700";
}

function getVisaStatusClasses(status: VisaTrackingRow["visaStatus"], isDarkMode: boolean): string {
  if (status === "Issued") {
    return isDarkMode
      ? "border-primary/30 bg-primary/14 text-primary"
      : "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "Pending") {
    return isDarkMode
      ? "border-secondary/35 bg-secondary/16 text-secondary"
      : "border-amber-200 bg-amber-100 text-amber-800";
  }

  return isDarkMode
    ? "border-tertiary/35 bg-tertiary/16 text-tertiary"
    : "border-slate-300 bg-slate-100 text-slate-700";
}

function getVisaTypeClasses(visaType: "Visa+" | "Visa Only", isDarkMode: boolean): string {
  if (visaType === "Visa+") {
    return isDarkMode ? "border-sky-400/35 bg-sky-500/14 text-sky-200" : "border-sky-200 bg-sky-100 text-sky-800";
  }

  return isDarkMode
    ? "border-tertiary/35 bg-tertiary/16 text-tertiary"
    : "border-slate-300 bg-slate-100 text-slate-700";
}

function resolveVisaTypeLabel(group: GroupData | undefined): "Visa+" | "Visa Only" {
  return group?.visaSetup?.busStatus === "Visa+" ? "Visa+" : "Visa Only";
}

function getAgreementApprovalClasses(status: "Approved" | "Waiting for Approval", isDarkMode: boolean): string {
  if (status === "Approved") {
    return isDarkMode
      ? "border-primary/30 bg-primary/14 text-primary"
      : "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  return isDarkMode
    ? "border-secondary/35 bg-secondary/16 text-secondary"
    : "border-amber-200 bg-amber-100 text-amber-800";
}

function getRaudhahStatusClasses(status: GroupRaudhahStatus, isDarkMode: boolean): string {
  if (status === "After") {
    return isDarkMode
      ? "border-primary/30 bg-primary/14 text-primary"
      : "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "Before") {
    return isDarkMode
      ? "border-secondary/35 bg-secondary/16 text-secondary"
      : "border-amber-200 bg-amber-100 text-amber-800";
  }

  return isDarkMode
    ? "border-tertiary/35 bg-tertiary/16 text-tertiary"
    : "border-slate-300 bg-slate-100 text-slate-700";
}

function toAgreementStatusSelectValue(status: AgreementApprovalStatus): "approved" | "waiting" {
  return status === "Approved" ? "approved" : "waiting";
}

function fromAgreementStatusSelectValue(value: string): AgreementApprovalStatus {
  return value === "approved" ? "Approved" : "Waiting for Approval";
}

type IssuedMonthOption = {
  value: string;
  label: string;
};

function resolveIssuedMonthKey(isoDate: string): string | null {
  const normalizedIsoDate = isoDate.trim();
  const matchedMonth = normalizedIsoDate.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!matchedMonth) {
    return null;
  }

  return `${matchedMonth[1]}-${matchedMonth[2]}`;
}

function formatIssuedMonthLabel(monthKey: string): string {
  const parsedDate = new Date(`${monthKey}-01T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return monthKey;
  }

  return parsedDate.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
}

function resolveRaudhahEntries(
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

function resolveCityAgreementApprovalStatus(
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


type VisaRowGroup = {
  mainRow: VisaTrackingRow;
  followerRows: VisaTrackingRow[];
};

const desktopTableGridTemplate = "minmax(0, 0.9fr) minmax(0, 1.12fr) minmax(0, 0.64fr) minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(0, 0.72fr) minmax(0, 0.72fr) minmax(0, 0.62fr) minmax(0, 0.66fr)";

function getVisaRowGroupKey(rowGroup: VisaRowGroup): string {
  return rowGroup.mainRow.id || rowGroup.mainRow.groupCode;
}

export function VisaTrackingScreen({
  groups,
  onOpenDetail,
  onUpdateAgreementStatus,
}: {
  groups: GroupData[];
  onOpenDetail: (row: VisaTrackingRow) => void;
  onUpdateAgreementStatus: (groupCode: string, city: "makkah" | "madinah", status: AgreementApprovalStatus) => void;
}) {
  const { theme } = useThemeMode();
  const isDarkMode = theme === "dark";
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

  // Group all visa rows into row groups
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
  
  const heroLabelClassName = isDarkMode
    ? "text-xs font-semibold uppercase tracking-[0.2em] text-primary/85"
    : "text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700";
  const summaryIconClassName = isDarkMode
    ? "material-symbols-outlined text-primary"
    : "material-symbols-outlined text-emerald-700";
  const actionRequiredSummaryCardClassName = isDarkMode
    ? "serene-accent-card flex items-center gap-3 bg-primary p-4 text-on-primary"
    : "serene-stat-card border-amber-200 bg-amber-50";
  const actionRequiredIconClassName = isDarkMode
    ? "material-symbols-outlined text-on-primary"
    : "material-symbols-outlined text-amber-700";
  const actionRequiredLabelClassName = isDarkMode
    ? "text-xs font-bold uppercase tracking-[0.14em] text-on-primary/75"
    : "text-xs font-semibold uppercase tracking-wide text-amber-700";
  const actionRequiredValueClassName = isDarkMode
    ? "text-xl font-extrabold text-on-primary"
    : "text-xl font-bold text-amber-900";
  const agreementDateTextClassName = isDarkMode ? "text-white" : "text-slate-500";

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

    void import("./visa-tracking-export")
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

  const renderAgreementCell = (row: VisaTrackingRow, city: "makkah" | "madinah", view: "mobile" | "desktop" = "desktop") => {
    const group = groupByCode.get(row.groupCode);
    const agreements = getGroupAgreementHotelsByCity(group, city);
    const hasAgreement = agreements.length > 0;
    const agreementNumber = resolveVisaAgreementNumber(row, group, city);
    const agreementStatus = resolveCityAgreementApprovalStatus(row, group, city);
    const agreementDateRange = resolveVisaAgreementDateRange(
      row,
      durationByGroupCode.get(row.groupCode) ?? 8,
      group,
    );

    const isMobile = view === "mobile";
    const selectWidth = isMobile ? "w-[110px]" : "w-[96px]";
    const selectTextSize = isMobile ? "text-[10px]" : "text-[11px]";
    const agreementNumberTextSize = isMobile ? "text-xs" : "text-[13px]";
    const badgeTextSize = isMobile ? "text-[10px]" : "text-[11px]";

    return (
      <div key={row.groupCode} className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <strong className={`break-all ${agreementNumberTextSize} font-semibold leading-tight text-slate-800`}>
            {agreementNumber}
          </strong>
        </div>
        <small className={`block text-[11px] leading-tight ${agreementDateTextClassName}`}>
          {hasAgreement
            ? `${formatVisaShortDate(agreementDateRange.makkahStartIso || agreementDateRange.madinahStartIso)} - ${formatVisaShortDate(
                agreementDateRange.makkahEndIso || agreementDateRange.madinahEndIso,
              )}`
            : "Stay dates pending"}
        </small>
        {hasAgreement ? (
          <SereneSelect
            value={toAgreementStatusSelectValue(agreementStatus)}
            className={`serene-select-pill mt-1 ${selectWidth} ${selectTextSize} font-bold ${getAgreementApprovalClasses(
              agreementStatus,
              isDarkMode,
            )}`}
            onChange={(event) =>
              onUpdateAgreementStatus(
                row.groupCode,
                city,
                fromAgreementStatusSelectValue(event.target.value),
              )
            }
            aria-label={`Update ${city} agreement status for ${row.groupCode}`}
          >
            <option value="approved">Approved</option>
            <option value="waiting">Waiting</option>
          </SereneSelect>
        ) : (
          <span className={`mt-1 inline-flex rounded-md border border-tertiary-fixed/70 bg-tertiary-fixed px-2.5 py-1 ${badgeTextSize} font-bold leading-none text-on-tertiary-fixed-variant`}>
            Not linked
          </span>
        )}
      </div>
    );
  };

  const renderMobileCardSingle = (
    row: VisaTrackingRow,
    options: {
      hasFollowers?: boolean;
      followerCount?: number;
      isExpanded?: boolean;
      onToggle?: () => void;
    } = {},
  ) => {
    const group = groupByCode.get(row.groupCode);
    const visaTypeLabel = resolveVisaTypeLabel(group);
    const { hasFollowers = false, followerCount = 0, isExpanded = false, onToggle } = options;

    const raudhahEntries = resolveRaudhahEntries(row, group);
    const visibleRaudhahEntries = raudhahEntries.slice(0, 2);
    const hiddenRaudhahEntriesCount = Math.max(0, raudhahEntries.length - visibleRaudhahEntries.length);

    return (
      <article
        key={row.id}
        className="rounded-2xl border border-slate-200 p-4 shadow-sm bg-surface-container-lowest transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {hasFollowers ? (
                <button
                  type="button"
                  className={`group inline-flex max-w-full flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1 text-left text-sm font-bold text-primary transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${isExpanded ? "border-primary/45 bg-primary/20 shadow-sm ring-1 ring-primary/15" : "border-primary/25 bg-primary/10 hover:border-primary/40 hover:bg-primary/15"}`}
                  onClick={onToggle}
                  aria-expanded={isExpanded}
                  aria-controls={`visa-mobile-linked-${row.id}`}
                  title={`${isExpanded ? "Hide" : "Show"} ${followerCount} child group${followerCount === 1 ? "" : "s"}`}
                >
                  <span className="min-w-0 break-words text-slate-900">{row.groupCode}</span>
                </button>
              ) : (
                <p className="break-words text-sm font-semibold text-slate-900">
                  {row.groupCode}
                </p>
              )}
            </div>
            <p className="mt-1 break-words text-sm font-medium leading-snug text-slate-700">{row.groupName}</p>
          </div>

          <div className="flex flex-col gap-1 items-end shrink-0">
            <span className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-bold leading-none text-slate-700">
              {row.pax} Pax
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Makkah Agreement
            </p>
            {renderAgreementCell(row, "makkah", "mobile")}
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
              Madinah Agreement
            </p>
            {renderAgreementCell(row, "madinah", "mobile")}
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Raudhah Entry Date
            </p>
            {raudhahEntries.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {visibleRaudhahEntries.map((entry) => (
                  <span
                    key={`${row.id}-mobile-raudhah-${entry.key}`}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-bold leading-none ${getRaudhahStatusClasses(
                      entry.status,
                      isDarkMode,
                    )}`}
                  >
                    <span>{entry.dateLabel}</span>
                    <span aria-hidden="true">|</span>
                    <span>{entry.status}</span>
                  </span>
                ))}
                {hiddenRaudhahEntriesCount > 0 ? (
                  <span className="inline-flex rounded-md border border-slate-300 bg-slate-200 px-2.5 py-1 text-[11px] font-bold leading-none text-slate-700">
                    +{hiddenRaudhahEntriesCount}
                  </span>
                ) : null}
              </div>
            ) : (
              <small className="mt-1 block text-xs text-slate-500">Not set yet</small>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface-container-lowest p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visa</p>
            <div className="mt-1 flex flex-col gap-1">
              <span
                className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-bold leading-none w-fit ${getVisaStatusClasses(
                  row.visaStatus,
                  isDarkMode,
                )}`}
              >
                {row.visaStatus}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-lowest p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visa Type</p>
            <div className="mt-1 flex flex-col gap-1">
              <span
                className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-bold leading-none w-fit ${getVisaTypeClasses(
                  visaTypeLabel,
                  isDarkMode,
                )}`}
              >
                {visaTypeLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-bold tracking-[0.06em] text-on-primary shadow-cta-soft transition hover:bg-primary-container"
            onClick={() => onOpenDetail(row)}
          >
            View Details
          </button>
        </div>
      </article>
    );
  };

  const renderMobileCard = (rowGroup: VisaRowGroup) => {
    const { mainRow, followerRows } = rowGroup;
    const rowGroupKey = getVisaRowGroupKey(rowGroup);
    const hasFollowers = followerRows.length > 0;
    const isExpanded = expandedRowGroupKeys.has(rowGroupKey);
    return (
      <div key={mainRow.id} className="space-y-3">
        {renderMobileCardSingle(mainRow, {
          hasFollowers,
          followerCount: followerRows.length,
          isExpanded,
          onToggle: hasFollowers ? () => toggleRowGroup(rowGroupKey) : undefined,
        })}
        {hasFollowers && isExpanded ? (
          <div id={`visa-mobile-linked-${mainRow.id}`} className="space-y-3">
            {followerRows.map((followerRow) => renderMobileCardSingle(followerRow))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderDesktopRowSingle = (
    row: VisaTrackingRow,
    options: {
      hasFollowers?: boolean;
      followerCount?: number;
      isExpanded?: boolean;
      onToggle?: () => void;
    } = {},
  ) => {
    const group = groupByCode.get(row.groupCode);
    const visaTypeLabel = resolveVisaTypeLabel(group);
    const { hasFollowers = false, followerCount = 0, isExpanded = false, onToggle } = options;
    
    const raudhahEntries = resolveRaudhahEntries(row, group);
    const visibleRaudhahEntries = raudhahEntries.slice(0, 2);
    const hiddenRaudhahEntriesCount = Math.max(0, raudhahEntries.length - visibleRaudhahEntries.length);

    return (
      <article
        key={row.id}
        className="grid items-center gap-2.5 px-4 py-3 text-sm transition-colors hover:bg-slate-50/30"
        style={{ gridTemplateColumns: desktopTableGridTemplate }}
      >
        <div className="flex min-w-0 items-center gap-1.5 py-1 font-semibold text-slate-800">
          {hasFollowers ? (
            <button
              type="button"
              className={`group inline-flex w-full min-w-0 flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1 text-left font-bold text-primary transition-all duration-200 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${isExpanded ? "border-primary/45 bg-primary/20 shadow-sm ring-1 ring-primary/15" : "border-primary/25 bg-primary/10 hover:border-primary/40 hover:bg-primary/15"}`}
              onClick={onToggle}
              aria-expanded={isExpanded}
              aria-controls={`visa-desktop-linked-${row.id}`}
              title={`${isExpanded ? "Hide" : "Show"} ${followerCount} child group${followerCount === 1 ? "" : "s"}`}
            >
              <span className="min-w-0 break-words text-slate-800">{row.groupCode}</span>
            </button>
          ) : (
            <span className="min-w-0 break-words">{row.groupCode}</span>
          )}
        </div>

        <div className="min-w-0 break-words py-1 font-medium leading-snug text-slate-700">
          {row.groupName}
        </div>

        <div className="flex min-w-0 justify-self-center py-1">
          <span className="inline-flex max-w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-bold leading-tight text-slate-700">
            {row.pax} Pax
          </span>
        </div>

        <div className="min-w-0 space-y-0.5 py-1">
          {renderAgreementCell(row, "makkah", "desktop")}
        </div>

        <div className="min-w-0 space-y-0.5 py-1">
          {renderAgreementCell(row, "madinah", "desktop")}
        </div>

        <div className="min-w-0 space-y-0.5 justify-self-center py-1 text-center">
          {raudhahEntries.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-1">
              {visibleRaudhahEntries.map((entry) => (
                <span
                  key={`${row.id}-desktop-raudhah-${entry.key}`}
                  className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-bold leading-none ${getRaudhahStatusClasses(
                    entry.status,
                    isDarkMode,
                  )}`}
                  title={`${entry.dateLabel} - ${entry.status}`}
                >
                  <span>{entry.dateLabel}</span>
                  <span aria-hidden="true">|</span>
                  <span>{entry.status}</span>
                </span>
              ))}
              {hiddenRaudhahEntriesCount > 0 ? (
                <span className="inline-flex rounded-md border border-slate-300 bg-slate-200 px-3 py-1.5 text-xs font-bold leading-none text-slate-700">
                  +{hiddenRaudhahEntriesCount}
                </span>
              ) : null}
            </div>
          ) : (
            <small className="text-[11px] text-slate-500">Not set</small>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-1 justify-self-center py-1">
          <span
            className={`inline-flex rounded-md border px-3 py-1.5 text-xs font-bold leading-none ${getVisaStatusClasses(
              row.visaStatus,
              isDarkMode,
            )}`}
          >
            {row.visaStatus}
          </span>
        </div>

        <div className="flex min-w-0 flex-col items-center justify-self-center py-1">
          <span
            className={`inline-flex rounded-md border px-3 py-1.5 text-xs font-bold leading-none w-fit ${getVisaTypeClasses(
              visaTypeLabel,
              isDarkMode,
            )}`}
          >
            {visaTypeLabel}
          </span>
        </div>

        <div className="flex min-w-0 justify-self-center py-1">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-bold leading-none text-on-primary shadow-cta-soft transition hover:bg-primary-container"
            onClick={() => onOpenDetail(row)}
            title="View Details"
            aria-label={`View details for group ${row.groupCode}`}
          >
            <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
              search
            </span>
            <span>View</span>
          </button>
        </div>
      </article>
    );
  };

  const renderDesktopRow = (rowGroup: VisaRowGroup) => {
    const { mainRow, followerRows } = rowGroup;
    const rowGroupKey = getVisaRowGroupKey(rowGroup);
    const hasFollowers = followerRows.length > 0;
    const isExpanded = expandedRowGroupKeys.has(rowGroupKey);
    return (
      <div key={mainRow.id} className="divide-y divide-slate-100/50">
        {renderDesktopRowSingle(mainRow, {
          hasFollowers,
          followerCount: followerRows.length,
          isExpanded,
          onToggle: hasFollowers ? () => toggleRowGroup(rowGroupKey) : undefined,
        })}
        {hasFollowers && isExpanded ? (
          <div id={`visa-desktop-linked-${mainRow.id}`} className="divide-y divide-slate-100/50">
            {followerRows.map((followerRow) => renderDesktopRowSingle(followerRow))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <header className="serene-page-toolbar">
        <div className="flex min-w-0 flex-1 max-w-xl items-center gap-3">
          <label className="serene-page-search" aria-label="Search groups">
            <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              className="serene-page-search-input"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search groups..."
            />
          </label>
        </div>

        <ThemeToggleButton className="sm:ml-auto sm:mr-5" />
      </header>

      <PageHeroSection
        eyebrow="Visa Control Board"
        title="Visa Tracking"
        description={
          <>
            <span className="sm:hidden">Monitor visa status, agreement, and payment.</span>
            <span className="hidden sm:inline">
              Monitor group agreement numbers, visa issuance, and payment progress in one board.
            </span>
          </>
        }
        className="backdrop-blur"
        actions={
          <button
            type="button"
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:w-auto ${
              hasRowsForExport
                ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                : "cursor-not-allowed bg-surface-container-high/70 text-on-surface-variant/70"
            }`}
            onClick={handleExportPdf}
            disabled={!hasRowsForExport}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              picture_as_pdf
            </span>
            <span className="sm:hidden">Export PDF</span>
            <span className="hidden sm:inline">Export to PDF</span>
          </button>
        }
      />

      <section className="flex flex-wrap items-center gap-2" aria-label="Visa tracking filters">
        <div className="relative flex items-center bg-slate-100 dark:bg-surface-container-high/65 p-1 rounded-xl w-full sm:w-[560px] h-9">
          {/* Sliding background indicator */}
          <div
            className="absolute top-1 bottom-1 bg-white dark:bg-surface-container-lowest rounded-lg shadow-sm transition-all duration-200 ease-out"
            style={{
              width: "calc(25% - 6px)",
              left:
                activeFilter === "all"
                  ? "3px"
                  : activeFilter === "not-issued"
                  ? "calc(25% + 3px)"
                  : activeFilter === "missing-hotel"
                  ? "calc(50% + 3px)"
                  : "calc(75% + 3px)",
            }}
          />
          {(["all", "not-issued", "missing-hotel", "unpaid"] as VisaFilterId[]).map((filter) => {
            const isActive = activeFilter === filter;
            let label = "";
            let count = 0;
            if (filter === "all") {
              label = "All Groups";
              count = visaRows.length;
            } else if (filter === "not-issued") {
              label = "Not Issued";
              count = notIssuedCount;
            } else if (filter === "missing-hotel") {
              label = "Missing Hotel";
              count = missingHotelCount;
            } else {
              label = "Unpaid";
              count = unpaidCount;
            }
            return (
              <button
                key={filter}
                type="button"
                className={`relative z-10 flex-1 h-full rounded-lg text-xs font-extrabold transition-colors duration-200 leading-none text-center ${
                  isActive
                    ? "text-brand-primary dark:text-primary"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                onClick={() => setActiveFilter(filter)}
              >
                <span className="sm:hidden">
                  {filter === "all"
                    ? "All"
                    : filter === "not-issued"
                    ? "Pending"
                    : filter === "missing-hotel"
                    ? "No Hotel"
                    : "Unpaid"}{" "}
                  ({count})
                </span>
                <span className="hidden sm:inline">
                  {label} ({count})
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="relative min-w-[11rem]">
            <SereneSelect
              className="serene-select-pill h-9 w-full pr-9"
              value={issuedMonthFilter}
              onChange={(event) => setIssuedMonthFilter(event.target.value)}
              showCaret={false}
              aria-label="Filter visa month"
            >
              <option value="all">All Months</option>
              {issuedMonthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SereneSelect>
            <span
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-base text-on-surface-variant"
              aria-hidden="true"
            >
              calendar_month
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Visa tracking summary">
        <article className="serene-stat-card">
          <span className={summaryIconClassName} aria-hidden="true">
            group
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="sm:hidden">Groups</span>
              <span className="hidden sm:inline">Total Groups</span>
            </p>
            <strong className="text-xl font-bold text-slate-900">{visaRows.length}</strong>
          </div>
        </article>

        <article className="serene-stat-card">
          <span className={summaryIconClassName} aria-hidden="true">
            task_alt
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="sm:hidden">Issued</span>
              <span className="hidden sm:inline">Visas Issued</span>
            </p>
            <strong className="text-xl font-bold text-slate-900">{issuedPaxCount}</strong>
          </div>
        </article>

        <article className={actionRequiredSummaryCardClassName}>
          <span className={actionRequiredIconClassName} aria-hidden="true">
            warning
          </span>
          <div>
            <p className={actionRequiredLabelClassName}>
              <span className="sm:hidden">Need Action</span>
              <span className="hidden sm:inline">Action Required</span>
            </p>
            <strong className={actionRequiredValueClassName}>{actionRequiredCount}</strong>
          </div>
        </article>

        <article className="serene-stat-card">
          <span className={summaryIconClassName} aria-hidden="true">
            payments
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="sm:hidden">Payment</span>
              <span className="hidden sm:inline">Payment Attention</span>
            </p>
            <strong className="text-xl font-bold text-slate-900">{unpaidCount}</strong>
          </div>
        </article>
      </section>

      {filteredGroupedRows.length === 0 ? (
        <article className="serene-empty-state">
          <span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">
            search_off
          </span>
          <h2 className="mt-3 text-xl font-bold text-slate-800">No visa records found</h2>
          <p className="mt-2 text-sm text-slate-600">
            <span className="sm:hidden">Try another keyword or filter.</span>
            <span className="hidden sm:inline">Try another keyword or switch your filter to view more groups.</span>
          </p>
        </article>
      ) : (
        <>
          <section className="space-y-3 md:hidden" aria-label="Visa tracking cards">
            {paginatedRows.map((rowGroup) => renderMobileCard(rowGroup))}
          </section>

          <section className="serene-table-shell hidden md:block" aria-label="Visa tracking table">
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <div
                  className="grid items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600"
                  style={{ gridTemplateColumns: desktopTableGridTemplate }}
                >
                  <div>Group Number</div>
                  <div>Group Name</div>
                  <div className="text-center">Total Pax</div>
                  <div>Makkah Agreement</div>
                  <div>Madinah Agreement</div>
                  <div className="text-center">Raudhah</div>
                  <div className="text-center">Visa Status</div>
                  <div className="text-center">Visa Type</div>
                  <div className="text-center">Actions</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {paginatedRows.map((rowGroup) => renderDesktopRow(rowGroup))}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredGroupedRows.length}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="groups"
        onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
      />
    </div>
  );
}
