import { useId } from "react";
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
  const linkedId = useId();
  const rowGroupKey = getVisaRowGroupKey(rowGroup);
  const hasFollowers = rowGroup.followerRows.length > 0;
  const childPax = rowGroup.followerRows.reduce((sum, row) => sum + row.pax, 0);
  const isMobile = view === "mobile";

  const renderAgreementCell = (row: VisaTrackingRow, city: "makkah" | "madinah") => {
    const group = groupByCode.get(row.groupCode);
    const hasAgreement = getGroupAgreementHotelsByCity(group, city).length > 0;
    const agreementStatus = resolveCityAgreementApprovalStatus(row, group, city);
    const dates = resolveVisaAgreementDateRange(row, durationByGroupCode.get(row.groupCode) ?? 8, group);
    const start = city === "makkah" ? dates.makkahStartIso : dates.madinahStartIso;
    const end = city === "makkah" ? dates.makkahEndIso : dates.madinahEndIso;

    return (
      <div className={`visa-compact-agreement visa-compact-${city}`}>
        <span className="visa-compact-label">{city === "makkah" ? "Makkah agreement" : "Madinah agreement"}</span>
        <strong className="visa-compact-agreement-number">{resolveVisaAgreementNumber(row, group, city)}</strong>
        <small className="visa-compact-date">
          {hasAgreement ? `${formatVisaShortDate(start)} – ${formatVisaShortDate(end)}` : "Stay dates pending"}
        </small>
        {hasAgreement && !readOnly ? (
          <div className="visa-approval-touch" data-approval={agreementStatus} data-dark={isDarkMode}>
            <SereneSelect
              value={toAgreementStatusSelectValue(agreementStatus)}
              className={`visa-compact-approval serene-focus-ring ${getAgreementApprovalClasses(agreementStatus, isDarkMode)}`}
              onChange={(event) =>
                onUpdateAgreementStatus(row.groupCode, city, fromAgreementStatusSelectValue(event.target.value))
              }
              aria-label={`Update ${city} agreement status for ${row.groupCode}`}
            >
              <option value="approved">Approved</option>
              <option value="waiting">Waiting</option>
            </SereneSelect>
          </div>
        ) : (
          <span
            className={`visa-compact-readonly-status ${
              hasAgreement
                ? getAgreementApprovalClasses(agreementStatus, isDarkMode)
                : "border-tertiary-fixed/70 bg-tertiary-fixed text-on-tertiary-fixed-variant"
            }`}
          >
            {hasAgreement ? agreementStatus : "Not linked"}
          </span>
        )}
      </div>
    );
  };

  const renderRow = (row: VisaTrackingRow, isFollower = false) => {
    const group = groupByCode.get(row.groupCode);
    const isParent = !isFollower && hasFollowers;
    const role = isParent ? "Parent" : isFollower || group?.parentGroupId ? "Child" : null;
    const familyToggle = isParent ? (
      <button
        type="button"
        className="visa-compact-toggle serene-focus-ring"
        aria-expanded={expanded}
        aria-controls={linkedId}
        aria-label={`${expanded ? "Hide" : "Show"} ${rowGroup.followerRows.length} child groups for ${row.groupCode}`}
        onClick={() => onToggleExpand(rowGroupKey)}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          expand_more
        </span>
        <span>
          {rowGroup.followerRows.length} child {rowGroup.followerRows.length === 1 ? "group" : "groups"}
        </span>
        <span className="visa-compact-family-total">
          · {childPax} Pax · Total {row.pax + childPax} Pax
        </span>
      </button>
    ) : null;
    const packageFields = (
      <>
        {" "}
        <div className="visa-compact-type" role="group" aria-label="Visa type summary">
          <span className="visa-compact-label">Visa type</span>
          <span className="max-w-full whitespace-normal break-words">{resolveVisaTypeLabel(group)}</span>
        </div>
        <div className="visa-compact-syarikah min-w-0" role="group" aria-label="Syarikah summary">
          <span className="visa-compact-label">Syarikah</span>
          <span title={group?.visaSetup?.syarikah || "-"}>{formatSyarikahName(group?.visaSetup?.syarikah)}</span>
        </div>
      </>
    );
    const detailButton = (
      <Button
        variant="secondary"
        size="sm"
        className="visa-compact-detail"
        onClick={() => onOpenDetail(row)}
        aria-label={`View details for group ${row.groupCode}`}
      >
        Detail
        {isMobile ? (
          <span className="material-symbols-outlined" aria-hidden="true">
            chevron_right
          </span>
        ) : null}
      </Button>
    );
    const makkahAgreement = renderAgreementCell(row, "makkah");
    const madinahAgreement = renderAgreementCell(row, "madinah");
    return (
      <article
        key={row.id}
        aria-label={`Group ${row.groupCode}`}
        className={`visa-compact-row ${isFollower ? "visa-compact-child" : ""}`}
        style={isMobile ? undefined : { gridTemplateColumns: desktopTableGridTemplate }}
      >
        <div className="visa-compact-identity">
          <div className="visa-compact-number-line">
            <strong className="visa-compact-number">{row.groupCode}</strong>
            {role ? <span className="visa-compact-role">{role}</span> : null}
          </div>
          <p className="visa-compact-name">{row.groupName}</p>
          {!isMobile ? familyToggle : null}
        </div>
        <section className="visa-compact-summary" aria-label="Visa information">
          <div className="visa-compact-pax">
            <span className="visa-compact-label">{isParent ? "Parent pax" : "Pax"}</span>
            <strong className="tabular-nums">{row.pax}</strong>
          </div>
          <div className="visa-compact-status" role="group" aria-label="Visa status summary">
            <span className="visa-compact-label">Visa status</span>
            <Badge
              status={row.visaStatus === "Issued" ? "success" : row.visaStatus === "Pending" ? "warning" : "neutral"}
              className="visa-compact-badge"
              data-visa-status={row.visaStatus}
            >
              {row.visaStatus}
            </Badge>
          </div>
          {!isMobile ? packageFields : null}
        </section>
        {isMobile ? (
          <div className="visa-compact-agreements">
            {makkahAgreement}
            {madinahAgreement}
          </div>
        ) : (
          <>
            {makkahAgreement}
            {madinahAgreement}
          </>
        )}
        {isMobile ? (
          <div className="visa-compact-footer">
            {packageFields}
            {detailButton}
          </div>
        ) : (
          detailButton
        )}
        {isMobile ? familyToggle : null}
      </article>
    );
  };

  return (
    <div className={`visa-compact-family visa-compact-${view}`}>
      {renderRow(rowGroup.mainRow)}
      {hasFollowers ? (
        <div id={linkedId} className="visa-compact-children" hidden={!expanded}>
          {expanded ? rowGroup.followerRows.map((row) => renderRow(row, true)) : null}
        </div>
      ) : null}
    </div>
  );
}
