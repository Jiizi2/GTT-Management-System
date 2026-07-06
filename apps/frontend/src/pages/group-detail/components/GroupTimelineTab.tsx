import { Link } from "react-router-dom";
import { Badge } from "../../../components/badge";
import { buildGroupItineraryBuilderPath } from "../../../shared/app-route";
import { formatScheduleTime } from "../../../shared/app-domain";
import { useGroupDetailContext } from "../context/GroupDetailContext";

export function GroupTimelineTab() {
  const {
    group,
    completeness,
    shouldShowLinkAgreementAction,
    shouldShowCreateItineraryAction,
    displayedNextActivity,
  } = useGroupDetailContext();

  return (
    <>
      {!completeness.isReadyForOperations ? (
        <section
          className="rounded-2xl border border-tertiary-fixed/65 bg-tertiary-fixed/70 px-4 py-3 text-on-tertiary-fixed-variant shadow-ambient"
          aria-label="Group completion status"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest text-brand-primary"
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-lg">
                  pending_actions
                </span>
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.12em] opacity-80">Workspace Status:</span>
                  <strong className="text-sm font-extrabold tracking-tight">{completeness.badgeLabel}</strong>
                </div>
                <p className="text-xs text-on-tertiary-fixed-variant/90 leading-tight mt-0.5">{completeness.primaryMessage}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5">
                {completeness.issues.map((issue: any) => (
                  <Badge
                    key={issue.key}
                    status="neutral"
                    className="rounded bg-surface-container-lowest/70 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.05em] border-none"
                    title={issue.message}
                  >
                    {issue.label}
                  </Badge>
                ))}
              </div>

              {(shouldShowLinkAgreementAction || shouldShowCreateItineraryAction) && (
                <div className="flex items-center gap-1.5 lg:border-l lg:border-on-tertiary-fixed-variant/15 lg:pl-3">
                  {shouldShowLinkAgreementAction ? (
                    <Link
                      to={`/agreement-inbox?groupCode=${encodeURIComponent(group.code)}`}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-on-tertiary-fixed-variant/20 bg-surface-container-lowest px-2.5 text-xs font-bold text-brand-primary transition hover:bg-surface-container-low"
                    >
                      <span className="material-symbols-outlined text-xs" aria-hidden="true">
                        link
                      </span>
                      <span>Link Agreement</span>
                    </Link>
                  ) : null}

                  {shouldShowCreateItineraryAction ? (
                    <Link
                      to={buildGroupItineraryBuilderPath(group.code)}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-2.5 text-xs font-bold text-on-primary transition hover:bg-primary-container"
                    >
                      <span className="material-symbols-outlined text-xs" aria-hidden="true">
                        add_circle
                      </span>
                      <span>Build Itinerary</span>
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <section className="relative overflow-hidden rounded-3xl border border-brand-primary/20 bg-brand-primary p-5 shadow-ambient">
        <div className="absolute -right-3 top-0 opacity-20" aria-hidden="true">
          <span className="material-symbols-outlined text-[6rem] text-brand-neutral">
            {displayedNextActivity.icon}
          </span>
        </div>

        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-on-primary/80">
            <span className="material-symbols-outlined" aria-hidden="true">
              near_me
            </span>
            <p>Next Activity</p>
          </div>

          <h3 className="mt-2 text-[1.5rem] font-bold tracking-tight text-on-primary sm:text-[2rem]">
            {displayedNextActivity.title}
          </h3>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-on-primary">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-brand-primary/15 bg-surface-container-lowest px-2.5 py-1 text-brand-primary shadow-sm">
              <span className="material-symbols-outlined" aria-hidden="true">
                event
              </span>
              <span>{displayedNextActivity.date}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-brand-primary/15 bg-surface-container-lowest px-2.5 py-1 text-brand-primary shadow-sm">
              <span className="material-symbols-outlined" aria-hidden="true">
                schedule
              </span>
              <span>{formatScheduleTime(displayedNextActivity.time)}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
