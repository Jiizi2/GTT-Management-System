import type { VisaTrackingRow, GroupData, AgreementApprovalStatus } from "../../../shared/app-domain";
import { SereneSelect } from "../../../components/serene-select";
import { Badge } from "../../../components/badge";
import { Button } from "../../../components/button";
import {
  formatVisaShortDate,
  getGroupAgreementHotelsByCity,
  resolveVisaAgreementNumber,
  resolveVisaAgreementDateRange,
} from "../../../shared/app-domain";
import {
  resolveVisaTypeLabel,
  formatSyarikahName,
  getAgreementApprovalClasses,
  toAgreementStatusSelectValue,
  fromAgreementStatusSelectValue,
  resolveCityAgreementApprovalStatus,
  desktopTableGridTemplate,
  getVisaRowGroupKey,
  type VisaRowGroup,
} from "../hooks/use-visa-tracking";

export function VisaTrackingRowGroup({
  rowGroup,
  view = "desktop",
  expanded,
  isDarkMode,
  groupByCode,
  durationByGroupCode,
  onToggleExpand,
  onOpenDetail,
  onUpdateAgreementStatus,
  readOnly = false,
}: {
  rowGroup: VisaRowGroup;
  view?: "mobile" | "desktop";
  expanded: boolean;
  isDarkMode: boolean;
  groupByCode: Map<string, GroupData>;
  durationByGroupCode: Map<string, number>;
  onToggleExpand: (key: string) => void;
  onOpenDetail: (row: VisaTrackingRow) => void;
  onUpdateAgreementStatus: (groupCode: string, city: "makkah" | "madinah", status: AgreementApprovalStatus) => void;
  readOnly?: boolean;
}) {
  const rowGroupKey = getVisaRowGroupKey(rowGroup);
  const hasFollowers = rowGroup.followerRows.length > 0;
  const agreementDateTextClassName = isDarkMode ? "text-white" : "text-slate-500";

  const renderAgreementCell = (
    row: VisaTrackingRow,
    city: "makkah" | "madinah",
    cellView: "mobile" | "desktop" = "desktop",
  ) => {
    const group = groupByCode.get(row.groupCode);
    const agreements = getGroupAgreementHotelsByCity(group, city);
    const hasAgreement = agreements.length > 0;
    const agreementNumber = resolveVisaAgreementNumber(row, group, city);
    const agreementStatus = resolveCityAgreementApprovalStatus(row, group, city);
    const agreementDateRange = resolveVisaAgreementDateRange(row, durationByGroupCode.get(row.groupCode) ?? 8, group);

    const isMobile = cellView === "mobile";
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
        {hasAgreement && !readOnly ? (
          <SereneSelect
            value={toAgreementStatusSelectValue(agreementStatus)}
            className={`serene-select-pill mt-1 ${selectWidth} ${selectTextSize} font-bold ${getAgreementApprovalClasses(
              agreementStatus,
              isDarkMode,
            )}`}
            onChange={(event) =>
              onUpdateAgreementStatus(row.groupCode, city, fromAgreementStatusSelectValue(event.target.value))
            }
            aria-label={`Update ${city} agreement status for ${row.groupCode}`}
          >
            <option value="approved">Approved</option>
            <option value="waiting">Waiting</option>
          </SereneSelect>
        ) : hasAgreement ? (
          <span
            className={`mt-1 inline-flex rounded-md border px-2.5 py-1 ${badgeTextSize} font-bold leading-none ${getAgreementApprovalClasses(
              agreementStatus,
              isDarkMode,
            )}`}
          >
            {agreementStatus}
          </span>
        ) : (
          <span
            className={`mt-1 inline-flex rounded-md border border-tertiary-fixed/70 bg-tertiary-fixed px-2.5 py-1 ${badgeTextSize} font-bold leading-none text-on-tertiary-fixed-variant`}
          >
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
                <p className="break-words text-sm font-semibold text-slate-900">{row.groupCode}</p>
              )}
            </div>
            <p className="mt-1 break-words text-sm font-medium leading-snug text-slate-700">{row.groupName}</p>
          </div>

          <div className="flex flex-col gap-1 items-end shrink-0">
            <Badge
              status="neutral"
              className="px-2.5 py-1 text-[11px] font-bold !border-[#cbd5e1] !bg-[#f2f5f3] !text-[#334155]"
            >
              {row.pax} Pax
            </Badge>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Makkah Agreement</p>
            {renderAgreementCell(row, "makkah", "mobile")}
          </div>

          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Madinah Agreement</p>
            {renderAgreementCell(row, "madinah", "mobile")}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-surface-container-lowest p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visa</p>
            <div className="mt-1 flex flex-col gap-1">
              <Badge
                status={row.visaStatus === "Issued" ? "success" : row.visaStatus === "Pending" ? "warning" : "neutral"}
                className={`px-2.5 py-1 text-[11px] font-bold w-fit ${
                  row.visaStatus !== "Issued" && row.visaStatus !== "Pending"
                    ? "!border-[#cbd5e1] !bg-[#f2f5f3] !text-[#334155]"
                    : "border-transparent"
                }`}
              >
                {row.visaStatus}
              </Badge>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-lowest p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Visa Type</p>
            <div className="mt-1 flex flex-col gap-1">
              <Badge
                status="neutral"
                className="px-2.5 py-1 text-[11px] font-bold !border-[#cbd5e1] !bg-[#f2f5f3] !text-[#334155] w-fit"
              >
                {visaTypeLabel}
              </Badge>
            </div>
          </div>

          <div className="rounded-xl bg-surface-container-lowest p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Syarikah</p>
            <div className="mt-1 flex flex-col gap-1">
              <Badge
                status="neutral"
                className="px-2.5 py-1 text-[11px] font-bold !border-[#cbd5e1] !bg-[#f2f5f3] !text-[#334155] w-fit"
                title={group?.visaSetup?.syarikah || "-"}
              >
                <span className="truncate max-w-[120px]">{formatSyarikahName(group?.visaSetup?.syarikah)}</span>
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Button className="w-full" onClick={() => onOpenDetail(row)}>
            View Details
          </Button>
        </div>
      </article>
    );
  };

  const renderDesktopRowSingle = (
    row: VisaTrackingRow,
    isFollower = false,
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

    return (
      <article
        key={row.id}
        className={`grid items-center gap-2.5 px-5 py-4 text-sm transition-colors hover:bg-surface-container-low/40 ${
          isFollower ? "bg-sky-50/20" : ""
        }`}
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

        <div className="min-w-0 break-words py-1 font-medium leading-snug text-slate-700">{row.groupName}</div>

        <div className="flex min-w-0 justify-self-center py-1">
          <Badge
            status="neutral"
            className="px-3 py-1.5 text-xs font-bold !border-[#cbd5e1] !bg-[#f2f5f3] !text-[#334155]"
          >
            {row.pax} Pax
          </Badge>
        </div>

        <div className="min-w-0 space-y-0.5 py-1">{renderAgreementCell(row, "makkah", "desktop")}</div>

        <div className="min-w-0 space-y-0.5 py-1">{renderAgreementCell(row, "madinah", "desktop")}</div>

        <div className="flex min-w-0 flex-col gap-1 justify-self-center py-1">
          <Badge
            status={row.visaStatus === "Issued" ? "success" : row.visaStatus === "Pending" ? "warning" : "neutral"}
            className={`px-3 py-1.5 text-xs font-bold w-fit ${
              row.visaStatus !== "Issued" && row.visaStatus !== "Pending"
                ? "!border-[#cbd5e1] !bg-[#f2f5f3] !text-[#334155]"
                : "border-transparent"
            }`}
          >
            {row.visaStatus}
          </Badge>
        </div>

        <div className="flex min-w-0 flex-col items-center justify-self-center py-1">
          <Badge
            status="neutral"
            className="px-3 py-1.5 text-xs font-bold !border-[#cbd5e1] !bg-[#f2f5f3] !text-[#334155] w-fit"
          >
            {visaTypeLabel}
          </Badge>
        </div>

        <div className="flex min-w-0 items-center justify-self-center py-1">
          <Badge
            status="neutral"
            className="px-3 py-1.5 text-xs font-bold !border-[#cbd5e1] !bg-[#f2f5f3] !text-[#334155] w-fit"
            title={group?.visaSetup?.syarikah || "-"}
          >
            <span className="truncate max-w-[120px]">{formatSyarikahName(group?.visaSetup?.syarikah)}</span>
          </Badge>
        </div>

        <div className="flex min-w-0 justify-self-center py-1">
          <Button
            size="sm"
            onClick={() => onOpenDetail(row)}
            title="View Details"
            aria-label={`View details for group ${row.groupCode}`}
          >
            <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
              search
            </span>
            <span>View</span>
          </Button>
        </div>
      </article>
    );
  };

  if (view === "desktop") {
    return (
      <div className="divide-y divide-slate-100/50">
        {renderDesktopRowSingle(rowGroup.mainRow, false, {
          hasFollowers,
          followerCount: rowGroup.followerRows.length,
          isExpanded: expanded,
          onToggle: hasFollowers ? () => onToggleExpand(rowGroupKey) : undefined,
        })}
        {hasFollowers && expanded ? (
          <div id={`visa-desktop-linked-${rowGroup.mainRow.id}`} className="divide-y divide-slate-100/50">
            {rowGroup.followerRows.map((followerRow) => renderDesktopRowSingle(followerRow, true))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renderMobileCardSingle(rowGroup.mainRow, {
        hasFollowers,
        followerCount: rowGroup.followerRows.length,
        isExpanded: expanded,
        onToggle: hasFollowers ? () => onToggleExpand(rowGroupKey) : undefined,
      })}
      {hasFollowers && expanded ? (
        <div id={`visa-mobile-linked-${rowGroup.mainRow.id}`} className="space-y-3">
          {rowGroup.followerRows.map((followerRow) => renderMobileCardSingle(followerRow))}
        </div>
      ) : null}
    </div>
  );
}
