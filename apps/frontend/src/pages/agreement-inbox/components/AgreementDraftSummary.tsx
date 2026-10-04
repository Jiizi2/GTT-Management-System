import type { ReactNode } from "react";
import { formatVisaShortDate } from "../../../shared/app-domain";

type SummaryLabels = { agreement: string; stay: string; status: string; assignment: string };

export function AgreementDraftSummary({
  city,
  hotelName,
  agreementNumber,
  muassasahName,
  stayStart,
  stayEnd,
  pax,
  remainingPax,
  approval,
  assignment,
  actions,
  expanded,
  first,
  last,
  hotelHeading = false,
  groupName,
  labels = { agreement: "Agreement No.", stay: "Stay Period", status: "Status", assignment: "Assignment" },
}: {
  city: "makkah" | "madinah";
  hotelName: string;
  agreementNumber: string;
  muassasahName?: string | null;
  stayStart: string;
  stayEnd: string;
  pax: number;
  remainingPax: number;
  approval: ReactNode;
  assignment: ReactNode;
  actions: ReactNode;
  expanded: boolean;
  first: boolean;
  last: boolean;
  hotelHeading?: boolean;
  groupName?: string;
  labels?: SummaryLabels;
}) {
  const remaining = Math.max(0, remainingPax);
  const percent = pax > 0 ? Math.min(100, (remaining / pax) * 100) : 0;
  const hotelClass = "truncate text-sm font-medium text-on-surface-variant";
  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-4 transition-colors sm:px-5 xl:grid-cols-[minmax(190px,1.45fr)_minmax(125px,.85fr)_minmax(150px,1fr)_minmax(120px,.78fr)_minmax(145px,1fr)_minmax(110px,.78fr)_112px] xl:items-center ${expanded ? "bg-primary/[0.035]" : "hover:bg-primary/[0.025]"} ${first ? "lg:rounded-tl-[15px] lg:rounded-tr-[15px]" : ""} ${last && !expanded ? "lg:rounded-br-[15px] lg:rounded-bl-[15px]" : ""}`}
    >
      <div className="col-span-2 flex min-w-0 items-center gap-3 xl:col-span-1">
        <span
          className="material-symbols-outlined grid h-8 w-8 shrink-0 place-items-center text-xl leading-none text-primary"
          aria-hidden="true"
        >
          {city === "makkah" ? "location_on" : "mosque"}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-on-surface">{city === "makkah" ? "Makkah" : "Madinah"}</p>
          {hotelHeading ? (
            <h2 className={hotelClass} title={hotelName}>
              {hotelName}
            </h2>
          ) : (
            <p className={hotelClass} title={hotelName}>
              {hotelName}
            </p>
          )}
          {groupName ? (
            <p className="mt-1 truncate text-xs text-on-surface-variant" title={groupName}>
              {groupName}
            </p>
          ) : null}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-on-surface-variant">{labels.agreement}</p>
        <p className="mt-1 truncate text-sm font-bold tabular-nums text-on-surface" title={agreementNumber}>
          {agreementNumber}
        </p>
        <p className="mt-1.5 flex min-w-0 items-baseline gap-1" title={muassasahName || "Belum dipilih"}>
          <span className="shrink-0 text-[10px] font-medium text-on-surface-variant">Muassasah</span>
          <span
            className={`truncate text-[11px] ${muassasahName ? "font-bold text-on-surface" : "font-medium text-on-surface-variant"}`}
          >
            {muassasahName || "Belum dipilih"}
          </span>
        </p>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-on-surface-variant">{labels.stay}</p>
        <p className="mt-1 whitespace-nowrap text-sm font-bold text-on-surface">
          {formatVisaShortDate(stayStart)} → {formatVisaShortDate(stayEnd)}
        </p>
      </div>
      <div className="col-span-2 xl:col-span-1">
        <div className="min-w-[118px]">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold text-on-surface-variant">
            <span>Pax</span>
            <span className="tabular-nums text-on-surface">
              {remaining}/{pax}
            </span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-container-high"
            aria-label={`${remaining} dari ${pax} pax tersedia`}
            role="img"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold text-on-surface-variant">{labels.status}</p>
        {approval}
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold text-on-surface-variant">{labels.assignment}</p>
        {assignment}
      </div>
      <div className="col-span-2 mt-1 border-t border-outline-variant/25 pt-2 xl:col-span-1 xl:col-start-7 xl:row-start-1 xl:mt-0 xl:border-0 xl:pt-0">
        {actions}
      </div>
    </div>
  );
}
