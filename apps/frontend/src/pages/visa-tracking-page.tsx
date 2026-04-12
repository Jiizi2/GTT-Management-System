import { useEffect, useMemo, useState } from "react";
import {
  buildVisaTrackingRowsFromGroups,
  formatVisaShortDate,
  getGroupAgreementHotelsByCity,
  hasMissingHotelAllocation,
  isVisaRowActionRequired,
  resolveValidRaudhahAppointments,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
} from "../features/visa/domain";
import type {
  AgreementApprovalStatus,
  GroupData,
  GroupRaudhahStatus,
  VisaFilterId,
  VisaTrackingRow,
} from "../shared/app-domain";
import { VISA_PAGE_SIZE } from "../shared/app-domain";
import { PaginationControls } from "../components/pagination-controls";
import { SereneSelect } from "../components/serene-select";
import { ThemeToggleButton } from "../components/theme-toggle-button";
import { useThemeMode } from "../theme/theme-provider";
import { exportVisaTrackingReportPdf } from "./visa-tracking-export";

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
    return isDarkMode ? "border-primary/30 bg-primary/14 text-primary" : "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "Pending") {
    return isDarkMode
      ? "border-outline-variant/60 bg-surface-container-high text-on-surface-variant"
      : "border-amber-200 bg-amber-100 text-amber-800";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
}

function getVisaTypeClasses(visaType: "Visa+" | "Visa Only"): string {
  if (visaType === "Visa+") {
    return "border-sky-200 bg-sky-100 text-sky-800";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
}

function resolveVisaTypeLabel(group: GroupData | undefined): "Visa+" | "Visa Only" {
  return group?.visaSetup?.busStatus === "Visa+" ? "Visa+" : "Visa Only";
}

function getAgreementApprovalClasses(status: "Approved" | "Waiting for Approval", isDarkMode: boolean): string {
  if (status === "Approved") {
    return isDarkMode ? "border-primary/30 bg-primary/14 text-primary" : "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  return isDarkMode
    ? "border-outline-variant/60 bg-surface-container-high text-on-surface-variant"
    : "border-amber-200 bg-amber-100 text-amber-800";
}

function getRaudhahStatusClasses(status: GroupRaudhahStatus, isDarkMode: boolean): string {
  if (status === "After") {
    return isDarkMode ? "border-primary/30 bg-primary/14 text-primary" : "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (status === "Before") {
    return isDarkMode
      ? "border-outline-variant/60 bg-surface-container-high text-on-surface-variant"
      : "border-amber-200 bg-amber-100 text-amber-800";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
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
    const dateLabel =
      appointment.status === "Free"
        ? "Not set"
        : formatVisaShortDate(dateIso);

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

const desktopTableGridTemplate = "0.76fr 1.2fr 0.64fr 1.1fr 1.1fr 0.72fr 0.72fr 0.62fr 0.66fr";

export function VisaTrackingScreen({
  groups,
  onOpenDetail,
  onUpdateAgreementStatus,
}: {
  groups: GroupData[];
  onOpenDetail: (row: VisaTrackingRow) => void;
  onUpdateAgreementStatus: (
    groupCode: string,
    city: "makkah" | "madinah",
    status: AgreementApprovalStatus,
  ) => void;
}) {
  const { theme } = useThemeMode();
  const isDarkMode = theme === "dark";
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<VisaFilterId>("all");
  const [issuedMonthFilter, setIssuedMonthFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const visaRows = buildVisaTrackingRowsFromGroups(groups);
  const groupByCode = new Map(groups.map((group) => [group.code, group] as const));
  const durationByGroupCode = new Map(groups.map((group) => [group.code, group.durationDays] as const));
  const normalizedQuery = query.trim().toLowerCase();
  const queriedRows = visaRows.filter((row) => {
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
  });

  const issuedMonthOptions = useMemo<IssuedMonthOption[]>(() => {
    const monthCounter = new Map<string, number>();

    visaRows.forEach((row) => {
      if (row.visaStatus !== "Issued") {
        return;
      }

      const issuedMonthKey = resolveIssuedMonthKey(row.issuedDateIso);
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
  }, [visaRows]);

  const filteredRows = queriedRows
    .filter((row) => {
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
    })
    .filter((row) => {
      if (issuedMonthFilter === "all") {
        return true;
      }

      if (row.visaStatus !== "Issued") {
        return false;
      }

      return resolveIssuedMonthKey(row.issuedDateIso) === issuedMonthFilter;
    });

  const notIssuedCount = visaRows.filter((row) => row.visaStatus !== "Issued").length;
  const missingHotelCount = visaRows.filter((row) => hasMissingHotelAllocation(row)).length;
  const unpaidCount = visaRows.filter((row) => row.paymentStatus !== "Paid").length;
  const issuedCount = visaRows.filter((row) => row.visaStatus === "Issued").length;
  const hasRowsForExport = filteredRows.length > 0;
  const selectedIssuedMonthLabel =
    issuedMonthFilter === "all"
      ? "All Months"
      : issuedMonthOptions.find((option) => option.value === issuedMonthFilter)?.label ?? issuedMonthFilter;
  const actionRequiredCount = visaRows.filter((row) => isVisaRowActionRequired(row)).length;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / VISA_PAGE_SIZE));
  const startIndex = (currentPage - 1) * VISA_PAGE_SIZE;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + VISA_PAGE_SIZE);
  const rangeStart = filteredRows.length === 0 ? 0 : startIndex + 1;
  const rangeEnd =
    filteredRows.length === 0 ? 0 : Math.min(filteredRows.length, startIndex + paginatedRows.length);
  const heroLabelClassName = isDarkMode ? "text-xs font-semibold uppercase tracking-[0.2em] text-primary/85" : "text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700";
  const summaryIconClassName = isDarkMode ? "material-symbols-outlined text-primary" : "material-symbols-outlined text-emerald-700";

  useEffect(() => {
    setCurrentPage(1);
  }, [query, activeFilter, issuedMonthFilter]);

  useEffect(() => {
    if (issuedMonthFilter === "all") {
      return;
    }

    const isSelectedMonthAvailable = issuedMonthOptions.some(
      (option) => option.value === issuedMonthFilter,
    );
    if (!isSelectedMonthAvailable) {
      setIssuedMonthFilter("all");
    }
  }, [issuedMonthFilter, issuedMonthOptions]);

  useEffect(() => {
    setCurrentPage((previousPage) => Math.min(previousPage, totalPages));
  }, [totalPages]);

  return (
    <div className="mx-auto max-w-[88rem] space-y-6 px-4 pb-20 pt-4 sm:px-6 lg:px-8">
      <header className="flex items-center gap-3">
        <div className="flex min-w-0 flex-1 max-w-xl items-center gap-3">
          <label
            className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface-container-lowest px-4 shadow-ambient sm:h-14"
            aria-label="Search groups"
          >
            <span className="material-symbols-outlined text-on-surface-variant/70" aria-hidden="true">
              search
            </span>
            <input
              type="text"
              className="w-full border-none bg-transparent text-sm font-medium text-on-surface-variant outline-none placeholder:text-on-surface-variant/50"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search groups..."
            />
          </label>
        </div>

        <ThemeToggleButton className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant shadow-ambient transition hover:border-primary/45 hover:text-primary sm:ml-auto sm:mr-5" />
      </header>

      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-surface-container-lowest p-5 shadow-sm backdrop-blur md:flex-row md:items-start md:justify-between">
        <div>
          <p className={heroLabelClassName}>Visa Control Board</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Visa Tracking</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            <span className="sm:hidden">Monitor visa status, agreement, and payment.</span>
            <span className="hidden sm:inline">
              Monitor group agreement numbers, visa issuance, and payment progress in one board.
            </span>
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end sm:self-start">
          <button
            type="button"
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition sm:w-auto ${
              hasRowsForExport
                ? "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
                : "cursor-not-allowed bg-surface-container-high/70 text-on-surface-variant/70"
            }`}
            onClick={() => {
              const exported = exportVisaTrackingReportPdf({
                rows: filteredRows,
                groups,
                query,
                activeFilter,
                issuedMonthLabel: selectedIssuedMonthLabel,
              });
              if (!exported) {
                window.alert("Popup diblokir browser. Izinkan pop-up lalu coba Export PDF lagi.");
              }
            }}
            disabled={!hasRowsForExport}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              picture_as_pdf
            </span>
            <span className="sm:hidden">Export PDF</span>
            <span className="hidden sm:inline">Export to PDF</span>
          </button>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2" aria-label="Visa tracking filters">
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm font-bold leading-none transition ${getFilterChipClasses(activeFilter === "all", isDarkMode)}`}
          onClick={() => setActiveFilter("all")}
        >
          <span className="sm:hidden">All ({visaRows.length})</span>
          <span className="hidden sm:inline">All Groups ({visaRows.length})</span>
        </button>
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm font-bold leading-none transition ${getFilterChipClasses(activeFilter === "not-issued", isDarkMode)}`}
          onClick={() => setActiveFilter("not-issued")}
        >
          <span className="sm:hidden">Pending ({notIssuedCount})</span>
          <span className="hidden sm:inline">Not Issued ({notIssuedCount})</span>
        </button>
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm font-bold leading-none transition ${getFilterChipClasses(activeFilter === "missing-hotel", isDarkMode)}`}
          onClick={() => setActiveFilter("missing-hotel")}
        >
          <span className="sm:hidden">No Hotel ({missingHotelCount})</span>
          <span className="hidden sm:inline">Missing Hotel ({missingHotelCount})</span>
        </button>
        <button
          type="button"
          className={`rounded-lg border px-3 py-1.5 text-sm font-bold leading-none transition ${getFilterChipClasses(activeFilter === "unpaid", isDarkMode)}`}
          onClick={() => setActiveFilter("unpaid")}
        >
          <span className="sm:hidden">Unpaid ({unpaidCount})</span>
          <span className="hidden sm:inline">Unpaid ({unpaidCount})</span>
        </button>

        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="relative min-w-[11rem]">
            <SereneSelect
              className="serene-select-pill h-9 w-full pr-9"
              value={issuedMonthFilter}
              onChange={(event) => setIssuedMonthFilter(event.target.value)}
              showCaret={false}
              aria-label="Filter issued month"
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
        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-4">
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

        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-4">
          <span className={summaryIconClassName} aria-hidden="true">
            task_alt
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="sm:hidden">Issued</span>
              <span className="hidden sm:inline">Visas Issued</span>
            </p>
            <strong className="text-xl font-bold text-slate-900">{issuedCount}</strong>
          </div>
        </article>

        <article className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <span className="material-symbols-outlined text-amber-700" aria-hidden="true">
            warning
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              <span className="sm:hidden">Need Action</span>
              <span className="hidden sm:inline">Action Required</span>
            </p>
            <strong className="text-xl font-bold text-amber-900">{actionRequiredCount}</strong>
          </div>
        </article>

        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-4">
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

      {filteredRows.length === 0 ? (
        <article className="rounded-3xl border border-dashed border-slate-300 bg-surface-container-lowest p-10 text-center">
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
            {paginatedRows.map((row) => {
              const group = groupByCode.get(row.groupCode);
              const makkahAgreementNumber = resolveVisaAgreementNumber(row, group, "makkah");
              const madinahAgreementNumber = resolveVisaAgreementNumber(row, group, "madinah");
              const visaTypeLabel = resolveVisaTypeLabel(group);
              const makkahAgreementStatus = resolveCityAgreementApprovalStatus(row, group, "makkah");
              const madinahAgreementStatus = resolveCityAgreementApprovalStatus(row, group, "madinah");
              const raudhahEntries = resolveRaudhahEntries(row, group);
              const visibleRaudhahEntries = raudhahEntries.slice(0, 2);
              const hiddenRaudhahEntriesCount = Math.max(
                0,
                raudhahEntries.length - visibleRaudhahEntries.length,
              );
              const agreementDateRange = resolveVisaAgreementDateRange(
                row,
                durationByGroupCode.get(row.groupCode) ?? 8,
                group,
              );

              return (
                <article key={row.id} className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{row.groupCode}</p>
                      <p className="mt-0.5 truncate text-sm font-medium text-slate-700">{row.groupName}</p>
                    </div>

                    <span className="inline-flex min-h-[28px] min-w-[68px] shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[10px] font-bold leading-none text-slate-700">
                      {row.pax} Pax
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Makkah Agreement
                      </p>
                      <strong className="mt-1 block text-xs font-semibold text-slate-800">{makkahAgreementNumber}</strong>
                      <small className="block text-xs text-slate-500">
                        {formatVisaShortDate(agreementDateRange.makkahStartIso)} - {" "}
                        {formatVisaShortDate(agreementDateRange.makkahEndIso)}
                      </small>
                      <SereneSelect
                        value={toAgreementStatusSelectValue(makkahAgreementStatus)}
                        className={`serene-select-pill mt-1 w-[110px] text-[10px] font-bold ${getAgreementApprovalClasses(
                          makkahAgreementStatus,
                          isDarkMode,
                        )}`}
                        onChange={(event) =>
                          onUpdateAgreementStatus(
                            row.groupCode,
                            "makkah",
                            fromAgreementStatusSelectValue(event.target.value),
                          )
                        }
                        aria-label={`Update Makkah agreement status for ${row.groupCode}`}
                      >
                        <option value="approved">Approved</option>
                        <option value="waiting">Waiting</option>
                      </SereneSelect>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Madinah Agreement
                      </p>
                      <strong className="mt-1 block text-xs font-semibold text-slate-800">{madinahAgreementNumber}</strong>
                      <small className="block text-xs text-slate-500">
                        {formatVisaShortDate(agreementDateRange.madinahStartIso)} - {" "}
                        {formatVisaShortDate(agreementDateRange.madinahEndIso)}
                      </small>
                      <SereneSelect
                        value={toAgreementStatusSelectValue(madinahAgreementStatus)}
                        className={`serene-select-pill mt-1 w-[110px] text-[10px] font-bold ${getAgreementApprovalClasses(
                          madinahAgreementStatus,
                          isDarkMode,
                        )}`}
                        onChange={(event) =>
                          onUpdateAgreementStatus(
                            row.groupCode,
                            "madinah",
                            fromAgreementStatusSelectValue(event.target.value),
                          )
                        }
                        aria-label={`Update Madinah agreement status for ${row.groupCode}`}
                      >
                        <option value="approved">Approved</option>
                        <option value="waiting">Waiting</option>
                      </SereneSelect>
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
                              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[10px] font-bold leading-none ${getRaudhahStatusClasses(
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
                            <span className="inline-flex rounded-md border border-slate-300 bg-slate-200 px-2.5 py-1 text-[10px] font-bold leading-none text-slate-700">
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
                      <span
                        className={`mt-1 inline-flex rounded-md border px-2.5 py-1 text-[10px] font-bold leading-none ${getVisaStatusClasses(
                          row.visaStatus,
                          isDarkMode,
                        )}`}
                      >
                        {row.visaStatus}
                      </span>
                    </div>

                    <div className="rounded-xl bg-surface-container-lowest p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visa Type</p>
                      <span
                        className={`mt-1 inline-flex rounded-md border px-2.5 py-1 text-[10px] font-bold leading-none ${getVisaTypeClasses(visaTypeLabel)}`}
                      >
                        {visaTypeLabel}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-bold tracking-[0.06em] text-on-primary shadow-cta-soft transition hover:bg-primary-container"
                    onClick={() => onOpenDetail(row)}
                  >
                    View Details
                  </button>
                </article>
              );
            })}
          </section>

          <section className="hidden overflow-hidden rounded-3xl border border-slate-200 bg-surface-container-lowest shadow-sm md:block" aria-label="Visa tracking table">
            <div className="overflow-x-auto">
              <div className="min-w-full">
                <div
                  className="grid gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600"
                  style={{ gridTemplateColumns: desktopTableGridTemplate }}
                >
                  <div>Group Number</div>
                  <div>Group Name</div>
                  <div>Total Pax</div>
                  <div>Makkah Agreement</div>
                  <div>Madinah Agreement</div>
                  <div className="text-center">Raudhah</div>
                  <div className="text-center">Visa Status</div>
                  <div>Visa Type</div>
                  <div>Actions</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {paginatedRows.map((row) => {
                    const group = groupByCode.get(row.groupCode);
                    const makkahAgreementNumber = resolveVisaAgreementNumber(row, group, "makkah");
                    const madinahAgreementNumber = resolveVisaAgreementNumber(row, group, "madinah");
                    const visaTypeLabel = resolveVisaTypeLabel(group);
                    const makkahAgreementStatus = resolveCityAgreementApprovalStatus(row, group, "makkah");
                    const madinahAgreementStatus = resolveCityAgreementApprovalStatus(row, group, "madinah");
                    const raudhahEntries = resolveRaudhahEntries(row, group);
                    const visibleRaudhahEntries = raudhahEntries.slice(0, 2);
                    const hiddenRaudhahEntriesCount = Math.max(
                      0,
                      raudhahEntries.length - visibleRaudhahEntries.length,
                    );
                    const agreementDateRange = resolveVisaAgreementDateRange(
                      row,
                      durationByGroupCode.get(row.groupCode) ?? 8,
                      group,
                    );

                    return (
                      <article
                        key={row.id}
                        className="grid items-center gap-2.5 px-4 py-3 text-sm"
                        style={{ gridTemplateColumns: desktopTableGridTemplate }}
                      >
                        <div className="font-semibold text-slate-800">{row.groupCode}</div>

                        <div className="font-medium text-slate-700">{row.groupName}</div>

                        <div>
                          <span className="inline-flex rounded-md border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-bold leading-none text-slate-700">
                            {row.pax} Pax
                          </span>
                        </div>

                        <div className="space-y-0.5">
                          <strong className="block break-all text-[13px] font-semibold leading-tight text-slate-800">
                            {makkahAgreementNumber}
                          </strong>
                          <small className="block text-[11px] leading-tight text-slate-500">
                            {formatVisaShortDate(agreementDateRange.makkahStartIso)} - {" "}
                            {formatVisaShortDate(agreementDateRange.makkahEndIso)}
                          </small>
                          <SereneSelect
                            value={toAgreementStatusSelectValue(makkahAgreementStatus)}
                            className={`serene-select-pill w-[96px] text-[11px] font-bold ${getAgreementApprovalClasses(
                              makkahAgreementStatus,
                              isDarkMode,
                            )}`}
                            onChange={(event) =>
                              onUpdateAgreementStatus(
                                row.groupCode,
                                "makkah",
                                fromAgreementStatusSelectValue(event.target.value),
                              )
                            }
                            aria-label={`Update Makkah agreement status for ${row.groupCode}`}
                          >
                            <option value="approved">Approved</option>
                            <option value="waiting">Waiting</option>
                          </SereneSelect>
                        </div>

                        <div className="space-y-0.5">
                          <strong className="block break-all text-[13px] font-semibold leading-tight text-slate-800">
                            {madinahAgreementNumber}
                          </strong>
                          <small className="block text-[11px] leading-tight text-slate-500">
                            {formatVisaShortDate(agreementDateRange.madinahStartIso)} - {" "}
                            {formatVisaShortDate(agreementDateRange.madinahEndIso)}
                          </small>
                          <SereneSelect
                            value={toAgreementStatusSelectValue(madinahAgreementStatus)}
                            className={`serene-select-pill w-[96px] text-[11px] font-bold ${getAgreementApprovalClasses(
                              madinahAgreementStatus,
                              isDarkMode,
                            )}`}
                            onChange={(event) =>
                              onUpdateAgreementStatus(
                                row.groupCode,
                                "madinah",
                                fromAgreementStatusSelectValue(event.target.value),
                              )
                            }
                            aria-label={`Update Madinah agreement status for ${row.groupCode}`}
                          >
                            <option value="approved">Approved</option>
                            <option value="waiting">Waiting</option>
                          </SereneSelect>
                        </div>

                        <div className="space-y-0.5 justify-self-center text-center">
                          {raudhahEntries.length > 0 ? (
                            <div className="flex flex-wrap justify-center gap-1">
                              {visibleRaudhahEntries.map((entry) => (
                                <span
                                  key={`${row.id}-desktop-raudhah-${entry.key}`}
                                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-bold leading-none ${getRaudhahStatusClasses(
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
                                <span className="inline-flex rounded-md border border-slate-300 bg-slate-200 px-2.5 py-1 text-[11px] font-bold leading-none text-slate-700">
                                  +{hiddenRaudhahEntriesCount}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <small className="text-[11px] text-slate-500">Not set</small>
                          )}
                        </div>

                        <div className="justify-self-center">
                          <span
                            className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-bold leading-none ${getVisaStatusClasses(
                              row.visaStatus,
                              isDarkMode,
                            )}`}
                          >
                            {row.visaStatus}
                          </span>
                        </div>

                        <div>
                          <span
                            className={`inline-flex rounded-md border px-2.5 py-1 text-[11px] font-bold leading-none ${getVisaTypeClasses(visaTypeLabel)}`}
                          >
                            {visaTypeLabel}
                          </span>
                        </div>

                        <div className="flex justify-start">
                          <button
                            type="button"
                            className="inline-flex items-center whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-xs font-bold leading-none text-on-primary shadow-cta-soft transition hover:bg-primary-container"
                            onClick={() => onOpenDetail(row)}
                          >
                            View Details
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredRows.length}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        itemLabel="groups"
        onPageChange={(nextPage) => setCurrentPage(Math.max(1, Math.min(totalPages, nextPage)))}
      />
    </div>
  );
}



