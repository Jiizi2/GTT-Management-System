import { Link } from "react-router-dom";
import { Badge } from "../../../components/badge";
import { Button } from "../../../components/button";
import { buildVisaDetailPath } from "../../../shared/app-route";
import { useGroupDetailContext } from "../context/GroupDetailContext";

const detailKickerClassName = "text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant/80";

export function GroupVisaTab() {
  const {
    group,
    musyrifProfile,
    isMusyrifCopied,
    handleCopyMusyrif,
    handleOpenMusyrifModal,
    compactAgreementSummaries,
    readOnly,
  } = useGroupDetailContext();

  return (
    <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-4 shadow-ambient sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={detailKickerClassName}>Assigned Musyrif</p>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className={
              isMusyrifCopied
                ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400 hover:bg-emerald-500/15"
                : ""
            }
            onClick={handleCopyMusyrif}
            aria-label={`Copy musyrif data for ${group.name}`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {isMusyrifCopied ? "check" : "content_copy"}
            </span>
            <span>{isMusyrifCopied ? "Copied" : "Copy"}</span>
          </Button>
          {isMusyrifCopied ? (
            <p className="sr-only" role="status" aria-live="polite">
              Musyrif data copied.
            </p>
          ) : null}

          {!readOnly && !group.parentGroupId && (
            <Button
              variant="secondary"
              size="sm"
              className="border-brand-primary/35 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/15"
              onClick={handleOpenMusyrifModal}
              aria-label={`Edit musyrif data for ${group.name}`}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                edit
              </span>
              <span>Edit</span>
            </Button>
          )}
        </div>
      </div>

      <div className="mt-3 flex min-w-0 items-center gap-3">
        <div className="relative">
          <div className="h-12 w-12 overflow-hidden rounded-2xl ring-2 ring-brand-primary/20">
            <img src={musyrifProfile.avatar} alt={musyrifProfile.name} className="h-full w-full object-cover" />
          </div>
          <span
            className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-surface-container-lowest bg-brand-primary"
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-on-surface">{musyrifProfile.name}</h3>
          <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined" aria-hidden="true">
              call
            </span>
            <span>{musyrifProfile.phone}</span>
          </div>
        </div>
      </div>

      <div className="mt-3 border-t border-outline-variant/30 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[15px] text-on-surface-variant/75" aria-hidden="true">
              hotel
            </span>
            <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-on-surface-variant/75">
              Agreement Hotel
            </p>
          </div>
          <Link
            to={readOnly ? `/agent/visa/${encodeURIComponent(group.code)}` : buildVisaDetailPath(group.code)}
            className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand-primary transition hover:text-brand-primary/75"
          >
            <span>Detail</span>
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
              fact_check
            </span>
          </Link>
        </div>

        <div className="mt-2 divide-y divide-outline-variant/25">
          {compactAgreementSummaries.map((summary: any) => (
            <div key={summary.city} className="py-2 first:pt-0 last:pb-0">
              <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge
                    status={summary.isMissing ? "error" : "success"}
                    className="h-6 min-w-[4.75rem] justify-center rounded-lg px-2 font-extrabold uppercase tracking-[0.08em] border-none"
                  >
                    {summary.cityLabel}
                  </Badge>
                  <p className="truncate font-bold text-on-surface" title={summary.primaryHotelLabel}>
                    {summary.primaryHotelLabel}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-[11px] font-bold ${
                    summary.isMissing ? "text-brand-tertiary" : "text-on-surface-variant"
                  }`}
                >
                  {summary.paxLabel}
                </span>
              </div>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pl-[5.25rem] text-[11px] font-medium text-on-surface-variant">
                <span className="truncate">{summary.hotelLabel}</span>
                <span className="text-on-surface-variant/40" aria-hidden="true">
                  |
                </span>
                <span className="truncate">{summary.stayLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
