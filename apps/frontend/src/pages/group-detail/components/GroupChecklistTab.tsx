import { Link } from "react-router-dom";
import { Badge } from "../../../components/badge";
import { Button } from "../../../components/button";
import { useGroupDetailContext } from "../context/GroupDetailContext";

const detailKickerClassName = "text-xs font-semibold uppercase tracking-[0.14em] text-on-surface-variant/80";

function isIsoDateValueLocal(isoDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate.trim());
}

function formatVisaShortDateLocal(isoDate: string): string {
  const parsed = new Date(`${isoDate.trim()}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function formatCompactIsoDateRangeLocal(startIso: string, endIso: string): string {
  const normalizedStartIso = startIso.trim();
  const normalizedEndIso = endIso.trim();
  const hasStart = isIsoDateValueLocal(normalizedStartIso);
  const hasEnd = isIsoDateValueLocal(normalizedEndIso);

  if (hasStart && hasEnd) {
    if (normalizedStartIso === normalizedEndIso) {
      return formatVisaShortDateLocal(normalizedStartIso);
    }
    return `${formatVisaShortDateLocal(normalizedStartIso)} - ${formatVisaShortDateLocal(normalizedEndIso)}`;
  }
  if (hasStart) {
    return `Start ${formatVisaShortDateLocal(normalizedStartIso)}`;
  }
  if (hasEnd) {
    return `End ${formatVisaShortDateLocal(normalizedEndIso)}`;
  }
  return "Dates pending";
}

export function GroupChecklistTab() {
  const {
    group,
    groups,
    familyGroups,
    childGroupCount,
    totalPax,
    requiredBusCount,
    isGroupEditModalOpen,
    handleOpenGroupEditModal,
    handleOpenUnlinkModal,
    noteItems,
    handleOpenNoteModal,
    readOnly,
  } = useGroupDetailContext();

  const formatGroupTripWindowLocal = (g: any) => {
    return formatCompactIsoDateRangeLocal(g.arrivalDate ?? "", g.returnDate ?? "");
  };

  return (
    <section className="rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-5 shadow-ambient xl:h-full flex flex-col justify-between">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="space-y-2 md:space-y-1">
          <div className="flex items-start justify-between gap-3 md:hidden">
            <span className={detailKickerClassName}>Group Number</span>
            <div className="flex items-center gap-2">
              <Badge status={group.tone === "active" ? "success" : "neutral"} className="shrink-0 whitespace-nowrap">
                {group.status}
              </Badge>
              {!readOnly ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-[22px] px-2 text-[11px] leading-none border-brand-primary/35 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/15"
                  onClick={handleOpenGroupEditModal}
                  aria-label={`Edit group info for ${group.name}`}
                  aria-haspopup="dialog"
                  aria-expanded={isGroupEditModalOpen}
                  aria-controls="group-edit-modal"
                >
                  <span className="material-symbols-outlined text-[12px] leading-none" aria-hidden="true">
                    edit
                  </span>
                  <span>Edit</span>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[1.65rem] font-extrabold tracking-tight text-brand-primary sm:text-[2.05rem]">
              {familyGroups.length > 1 ? familyGroups.map((g) => g.code).join(" - ") : group.code}
            </h2>
            {familyGroups.length > 1 && (
              <div
                className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600 sm:inline-flex ${familyGroups.length > 2 ? "text-[10px]" : "text-xs"}`}
              >
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-slate-400" aria-hidden="true">
                    link
                  </span>
                  <span>Terhubung:</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                  {familyGroups
                    .filter((g) => g.code !== group.code)
                    .map((g, index) => (
                      <span key={g.code} className="inline-flex items-center gap-0.5">
                        {index > 0 && <span className="mr-1.5 text-slate-300">,</span>}
                        <Link to={`/groups/${g.code}`} className="font-bold text-slate-900 hover:underline">
                          {g.code}
                        </Link>
                        {!readOnly ? (
                          <button
                            type="button"
                            onClick={() => handleOpenUnlinkModal(g)}
                            className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition"
                            title="Pisahkan grup ini"
                          >
                            <span className="material-symbols-outlined text-[13px]" aria-hidden="true">
                              link_off
                            </span>
                          </button>
                        ) : null}
                      </span>
                    ))}
                </div>
              </div>
            )}
            <Badge status={group.tone === "active" ? "success" : "neutral"} className="hidden md:inline-flex">
              {group.status}
            </Badge>
            {!readOnly ? (
              <Button
                variant="secondary"
                size="sm"
                className="hidden h-[22px] shrink-0 items-center gap-1 whitespace-nowrap border-brand-primary/35 bg-brand-primary/10 px-2 text-[11px] font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15 md:inline-flex"
                onClick={handleOpenGroupEditModal}
                aria-label={`Edit group info for ${group.name}`}
                aria-haspopup="dialog"
                aria-expanded={isGroupEditModalOpen}
                aria-controls="group-edit-modal"
              >
                <span className="material-symbols-outlined text-[12px] leading-none" aria-hidden="true">
                  edit
                </span>
                <span>Edit</span>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="hidden h-10 w-px bg-outline-variant/35 md:block" aria-hidden="true" />

        <div className="space-y-1">
          <span className={detailKickerClassName}>Group Name</span>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold text-on-surface sm:text-2xl">{group.name}</h3>
            <p className="mt-1 text-sm font-bold text-primary">Agent: {group.agent?.name ?? "GTT Direct"}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-outline-variant/35 pt-4">
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-0">
          <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-3 sm:border-b-0 sm:pr-4">
            <div>
              <span className={detailKickerClassName}>Pilgrims</span>
              <p className="mt-2 text-[1.7rem] font-bold leading-none text-on-surface">{totalPax}</p>
              {familyGroups.length > 1 && (
                <p className="mt-1.5 text-xs text-on-surface-variant/75 font-medium leading-tight">
                  Detail: {familyGroups.map((g) => `${g.code} ${g.pax} pax`).join(" dan ")}
                </p>
              )}
            </div>
            <span className="material-symbols-outlined text-xl text-on-surface-variant/70" aria-hidden="true">
              groups
            </span>
          </div>

          <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 py-0 pb-3 sm:border-b-0 sm:border-l sm:border-outline-variant/35 sm:px-4 sm:pb-0">
            <div>
              <span className={detailKickerClassName}>Trip Duration</span>
              <p className="mt-2 text-[1.7rem] font-bold leading-none text-on-surface">{group.durationDays} Days</p>
            </div>
            <span className="material-symbols-outlined text-xl text-on-surface-variant/70" aria-hidden="true">
              calendar_today
            </span>
          </div>

          <div className="flex items-start justify-between gap-3 sm:border-l sm:border-outline-variant/35 sm:pl-4">
            <div>
              <span className={detailKickerClassName}>Required Bus</span>
              <p className="mt-2 text-[1.7rem] font-bold leading-none text-on-surface">{requiredBusCount} Bus</p>
            </div>
            <span className="material-symbols-outlined text-xl text-on-surface-variant/70" aria-hidden="true">
              directions_bus
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-outline-variant/25 pt-3 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-2 sm:pr-3">
            <span className="material-symbols-outlined text-lg text-on-surface-variant/70" aria-hidden="true">
              travel_explore
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/75">
                Package
              </span>
              <p className="mt-0.5 truncate text-sm font-bold text-on-surface" title={group.packageName}>
                {group.packageName}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:border-l sm:border-outline-variant/35 sm:pl-3">
            <span className="material-symbols-outlined text-lg text-on-surface-variant/70" aria-hidden="true">
              event_available
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/75">
                Period
              </span>
              <p className="mt-0.5 truncate text-sm font-bold text-on-surface">{formatGroupTripWindowLocal(group)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
