import { useMemo } from "react";
import { useVisaDetailContext } from "../context/VisaDetailContext";
import { DatePickerInput } from "../../../components/date-time-pickers";
import type { GroupAgreementHotel, HotelAgreementDraft, GroupData } from "../../../shared/app-domain";
import {
  getIconButtonClasses,
  getCitySummaryClasses,
  getAgreementStatusClasses,
  getAgreementStatusLabel,
  formatAgreementStayRange,
  formatAgreementStayDate,
  formatAgreementDraftStayRange,
  normalizeAgreementMatchValue,
} from "../visa-detail-helpers";
import * as Domain from "../../../shared/app-domain";
import { validateConnectedAgreementDates } from "../../../shared/agreement-date-validation";

const { isIsoDateValue, formatVisaShortDate } = Domain;

const agreementWarnClassName =
  "flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-200";

/**
 * Soft warning for non-contiguous Makkah/Madinah stay dates.
 *
 * The backend deliberately accepts gaps (see groups.hotel-validation.ts), so
 * this must stay advisory: it never blocks a save and never renders as an
 * error. Overlaps are a different rule and are rejected server-side.
 */
function AgreementDateGapWarning({ message }: { message: string }) {
  return (
    <div className={agreementWarnClassName} role="status" aria-live="polite">
      <span className="material-symbols-outlined" aria-hidden="true">
        warning
      </span>
      <p>{message}</p>
    </div>
  );
}

export function AgreementSummaryFields({ agreement }: { agreement: GroupAgreementHotel }) {
  const agreementNumber = agreement.agreementNumber?.trim() || "Agreement number pending";
  const paxLabel = Number.isFinite(agreement.pax) ? agreement.pax.toString() : "-";

  return (
    <div className="grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1fr)_5.5rem] gap-2 overflow-hidden md:grid-cols-[minmax(0,1fr)_5.5rem_minmax(12rem,1fr)]">
      <div className="min-w-0 rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 py-2">
        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-on-surface-variant">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            confirmation_number
          </span>
          Agreement No
        </span>
        <strong className="mt-1 block break-all text-sm font-extrabold leading-snug text-on-surface">
          {agreementNumber}
        </strong>
      </div>

      <div className="min-w-0 rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 py-2">
        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-on-surface-variant">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            group
          </span>
          Pax
        </span>
        <strong className="mt-1 block text-lg font-black leading-none text-on-surface">{paxLabel}</strong>
      </div>

      <div className="col-span-2 min-w-0 rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 py-2 md:col-span-1">
        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-on-surface-variant">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            event
          </span>
          Stay
        </span>
        <strong className="mt-1 block break-words text-sm font-extrabold leading-snug text-on-surface">
          {formatAgreementStayRange(agreement)}
        </strong>
      </div>
    </div>
  );
}

function AgreementExpandedFields({ agreement }: { agreement: GroupAgreementHotel }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 py-2">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-on-surface-variant">Check In</span>
        <strong className="mt-1 block text-sm font-extrabold text-on-surface">
          {formatAgreementStayDate(agreement.stayStartIso)}
        </strong>
      </div>
      <div className="rounded-xl border border-outline-variant/50 bg-surface-container-low px-3 py-2">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-on-surface-variant">Check Out</span>
        <strong className="mt-1 block text-sm font-extrabold text-on-surface">
          {formatAgreementStayDate(agreement.stayEndIso)}
        </strong>
      </div>
    </div>
  );
}

interface AgreementInboxDraftAssignmentListProps {
  city: "makkah" | "madinah";
  drafts: HotelAgreementDraft[];
  group: GroupData | null;
  isLoading: boolean;
  isError: boolean;
  assigningDraftId: string | null;
  onAssignDraft: (draft: HotelAgreementDraft, selectedStart: string, selectedEnd: string) => void;
  coverageStartIso: string;
  coverageEndIso: string;
  onCoverageDatesChange: (start: string, end: string) => void;
  onCancel: () => void;
}

function AgreementInboxDraftAssignmentList({
  city,
  drafts,
  group,
  isLoading,
  isError,
  assigningDraftId,
  onAssignDraft,
  coverageStartIso,
  coverageEndIso,
  onCoverageDatesChange,
  onCancel,
}: AgreementInboxDraftAssignmentListProps) {
  const cityLabel = city === "makkah" ? "Makkah" : "Madinah";

  // Filter drafts that overlap with the selected coverage period
  const eligibleDrafts = useMemo(() => {
    if (!isIsoDateValue(coverageStartIso) || !isIsoDateValue(coverageEndIso)) {
      return [];
    }
    const startMs = Date.parse(coverageStartIso);
    const endMs = Date.parse(coverageEndIso);
    if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
      return [];
    }

    const getStayNights = (startIso: string, endIso: string): string[] => {
      const nights: string[] = [];
      const startValMs = Date.parse(startIso);
      const endValMs = Date.parse(endIso);
      if (isNaN(startValMs) || isNaN(endValMs) || startValMs >= endValMs) {
        return [];
      }
      const oneDayMs = 24 * 60 * 60 * 1000;
      for (let currentMs = startValMs; currentMs < endValMs; currentMs += oneDayMs) {
        nights.push(new Date(currentMs).toISOString().slice(0, 10));
      }
      return nights;
    };

    const targetNights = getStayNights(coverageStartIso, coverageEndIso);

    return drafts
      .filter((draft) => {
        if (draft.city !== city) return false;
        if (draft.assignmentStatus === "Assigned") return false;

        const draftStart = (draft.stayStartIso ?? "").trim();
        const draftEnd = (draft.stayEndIso ?? "").trim();
        if (!isIsoDateValue(draftStart) || !isIsoDateValue(draftEnd)) return false;

        const draftStartMs = Date.parse(draftStart);
        const draftEndMs = Date.parse(draftEnd);

        // Verify overlap with the selected range
        return Math.max(startMs, draftStartMs) < Math.min(endMs, draftEndMs);
      })
      .map((draft) => {
        const draftStart = (draft.stayStartIso ?? "").trim();
        const draftEnd = (draft.stayEndIso ?? "").trim();

        // Calculate actual coverage sub-period
        const overlapStart = new Date(Math.max(startMs, Date.parse(draftStart))).toISOString().slice(0, 10);
        const overlapEnd = new Date(Math.min(endMs, Date.parse(draftEnd))).toISOString().slice(0, 10);

        const overlapNights = targetNights.filter((n) => n >= draftStart && n < draftEnd);

        // Calculate available capacity for this draft on the overlap nights
        let minRemaining = draft.pax;
        const assignedGroups = draft.assignedGroups ?? [];
        if (overlapNights.length > 0) {
          minRemaining = assignedGroups.length > 0
            ? draft.pax
            : (draft.remainingPax !== undefined ? draft.remainingPax : draft.pax);

          for (const night of overlapNights) {
            const occupiedOnNight = assignedGroups
              .filter((g: any) => {
                const gStart = g.stayStart ?? g.stayStartIso;
                const gEnd = g.stayEnd ?? g.stayEndIso;
                if (gStart && gEnd) {
                  return night >= gStart && night < gEnd;
                }
                return true;
              })
              .reduce((sum: number, g: any) => sum + g.pax, 0);
            const remainingOnNight = Math.max(0, draft.pax - occupiedOnNight);
            if (remainingOnNight < minRemaining) {
              minRemaining = remainingOnNight;
            }
          }
        } else {
          minRemaining = draft.remainingPax !== undefined ? draft.remainingPax : draft.pax;
        }

        const isFullCoverage = draftStart <= coverageStartIso && draftEnd >= coverageEndIso;

        return {
          draft,
          minRemaining,
          overlapStart,
          overlapEnd,
          isFullCoverage,
        };
      })
      .filter((item) => item.minRemaining > 0);
  }, [drafts, city, coverageStartIso, coverageEndIso]);

  const fullCoverageDrafts = useMemo(() => eligibleDrafts.filter((d) => d.isFullCoverage), [eligibleDrafts]);
  const partialCoverageDrafts = useMemo(() => eligibleDrafts.filter((d) => !d.isFullCoverage), [eligibleDrafts]);

  const renderDraftList = (items: typeof eligibleDrafts, typeLabel: "Full" | "Partial") => {
    return (
      <div className="space-y-2 mt-4">
        <h4 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-on-surface-variant mb-2">
          {typeLabel === "Full" ? "Full Coverage Available" : "Partial Coverage Available"} ({items.length})
        </h4>
        {items.map(({ draft, minRemaining, overlapStart, overlapEnd }) => {
          const isAssigning = assigningDraftId === draft.id;
          const isAlreadyAssignedToGroup = draft.assignedGroups?.some(
            (g) => normalizeAgreementMatchValue(g.groupCode) === normalizeAgreementMatchValue(group?.code ?? "")
          ) ?? false;
          const isAssignable = minRemaining > 0 && !assigningDraftId && !isAlreadyAssignedToGroup;

          return (
            <article
              key={draft.id}
              className="flex flex-col gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h5 className="break-words text-sm font-bold text-on-surface">{draft.hotelName}</h5>
                  <span className="inline-flex rounded-md border border-outline-variant/50 bg-surface-container-lowest px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
                    Pax {draft.remainingPax !== undefined && draft.remainingPax < draft.pax ? `${minRemaining}/${draft.pax}` : draft.pax}
                  </span>
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                      typeLabel === "Full"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-900/20 dark:text-amber-300"
                    }`}
                  >
                    {typeLabel === "Full" ? "Full Coverage" : "Partial Coverage"}
                  </span>
                </div>
                {draft.agentName ? (
                  <p className="mt-1 text-xs font-semibold text-brand-primary">Agent: {draft.agentName}</p>
                ) : null}
                <p className="mt-1 break-words text-xs font-semibold text-on-surface">{draft.agreementNumber}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">
                  Validity: {formatAgreementDraftStayRange(draft)}
                </p>
                <p className="mt-1 text-xs font-bold text-on-surface">
                  Coverage: {formatVisaShortDate(overlapStart)} - {formatVisaShortDate(overlapEnd)}
                </p>
                {isAlreadyAssignedToGroup ? (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                    Sudah di-assign ke grup ini.
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-brand-primary/35 bg-brand-primary/10 px-3 text-xs font-bold text-brand-primary transition hover:bg-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onAssignDraft(draft, overlapStart, overlapEnd)}
                disabled={!isAssignable}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {isAssigning ? "sync" : "link"}
                </span>
                <span>{isAssigning ? "Assigning..." : "Assign"}</span>
              </button>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <section className="mt-3 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-primary">Agreement Inbox</p>
          <h3 className="mt-0.5 text-sm font-bold text-on-surface">Available {cityLabel} Agreements</h3>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface transition hover:border-brand-tertiary hover:text-brand-tertiary"
          onClick={onCancel}
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            close
          </span>
          <span>Close</span>
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="flex-1">
          <label htmlFor={`coverage-start-${city}`} className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-on-surface-variant">
            Start Date
          </label>
          <DatePickerInput
            id={`coverage-start-${city}`}
            inputClassName="mt-1 block w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={coverageStartIso}
            onChange={(val) => onCoverageDatesChange(val, coverageEndIso)}
          />
        </div>
        <div className="flex-1">
          <label htmlFor={`coverage-end-${city}`} className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-on-surface-variant">
            End Date
          </label>
          <DatePickerInput
            id={`coverage-end-${city}`}
            inputClassName="mt-1 block w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-on-surface focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={coverageEndIso}
            onChange={(val) => onCoverageDatesChange(coverageStartIso, val)}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="mt-3 rounded-xl bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface-variant">
          Loading agreement inbox...
        </p>
      ) : null}

      {isError ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-900/20 dark:text-rose-300">
          Agreement inbox belum berhasil dimuat.
        </p>
      ) : null}

      {!isLoading && eligibleDrafts.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low px-3 py-3 text-xs font-semibold text-on-surface-variant">
          Tidak ada draft {cityLabel} yang cocok dengan periode dan kapasitas yang dicari.
        </p>
      ) : null}

      {!isLoading && fullCoverageDrafts.length > 0 ? renderDraftList(fullCoverageDrafts, "Full") : null}
      {!isLoading && partialCoverageDrafts.length > 0 ? renderDraftList(partialCoverageDrafts, "Partial") : null}
    </section>
  );
}

/**
 * Lets ops mark that a group genuinely does not need a hotel in this city, so
 * the "missing hotel" warning/stat is bypassed. Purely a per-city override.
 */
function HotelWaiverToggle({
  city,
  waived,
  onToggle,
}: {
  city: "makkah" | "madinah";
  waived: boolean;
  onToggle: (city: "makkah" | "madinah", waived: boolean) => void;
}) {
  const cityLabel = city === "makkah" ? "Makkah" : "Madinah";
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold leading-none transition ${
        waived
          ? "border-amber-300 bg-amber-100 text-amber-800 hover:brightness-95 dark:border-amber-500/40 dark:bg-amber-900/30 dark:text-amber-200"
          : "border-outline-variant/60 bg-surface-container-lowest text-on-surface-variant hover:border-brand-primary hover:text-brand-primary"
      }`}
      onClick={() => onToggle(city, !waived)}
      aria-pressed={waived}
      title={
        waived
          ? `Aktifkan kembali persyaratan hotel ${cityLabel}`
          : `Tandai grup ini tidak butuh hotel ${cityLabel}`
      }
    >
      <span className="material-symbols-outlined text-sm" aria-hidden="true">
        {waived ? "block" : "hotel"}
      </span>
      <span>{waived ? "Tidak perlu hotel" : "Tandai tak perlu"}</span>
    </button>
  );
}

export function HotelAgreementSection() {
  const {
    row,
    toggleHotelWaiver,
    group,
    familyGroups,
    activeGroupCode,
    totalPax,
    makkahAgreements,
    madinahAgreements,
    availableAgreementDraftsByCity,
    assignedDraftByAgreementId,
    makkahAssigned,
    madinahAssigned,
    makkahMissing,
    madinahMissing,
    addingHotelCity,
    coverageStartIso,
    coverageEndIso,
    assigningAgreementDraftId,
    openAddHotelInline,
    openAgreementEditor,
    openDeleteAgreementConfirm,
    assignAgreementDraft,
    setCoverageStartIso,
    setCoverageEndIso,
    cancelAddHotelInline,
    agreementDraftsQueryLoading,
    agreementDraftsQueryError,
  } = useVisaDetailContext();

  const makkahAgreementIdSet = useMemo(() => new Set(makkahAgreements.map((agreement) => agreement.id)), [makkahAgreements]);
  const madinahAgreementIdSet = useMemo(() => new Set(madinahAgreements.map((agreement) => agreement.id)), [madinahAgreements]);
  const dateGapWarnings = useMemo(
    () => validateConnectedAgreementDates(makkahAgreements, madinahAgreements),
    [makkahAgreements, madinahAgreements],
  );

  return (
    <section className="grid min-w-0 gap-4 xl:grid-cols-2">
      {dateGapWarnings.crossCityWarning ? (
        <div className="min-w-0 xl:col-span-2">
          <AgreementDateGapWarning message={dateGapWarnings.crossCityWarning} />
        </div>
      ) : null}
      <article className="min-w-0 overflow-hidden rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
              mosque
            </span>
            <h2 className="text-xl font-bold text-on-surface">Makkah</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HotelWaiverToggle city="makkah" waived={Boolean(row.makkahHotelWaived)} onToggle={toggleHotelWaiver} />
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-xs font-bold leading-none text-on-surface transition hover:border-brand-primary hover:text-brand-primary sm:py-1.5"
              onClick={() => openAddHotelInline("makkah")}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                add
              </span>
              <span>Add Hotel</span>
            </button>
          </div>
        </div>

        {dateGapWarnings.cityWarnings.makkah ? (
          <div className="mt-4">
            <AgreementDateGapWarning message={dateGapWarnings.cityWarnings.makkah} />
          </div>
        ) : null}

        <div className="mt-4 min-w-0 space-y-3">
          {makkahAgreements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-tertiary/45 bg-brand-tertiary/10 px-4 py-4 text-sm text-brand-tertiary">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  warning
                </span>
                <div>
                  <p className="font-bold">Agreement Makkah belum tersambung.</p>
                  <p className="mt-1 text-xs font-semibold opacity-85">
                    Tambahkan hotel agreement dari data Nusuk sebelum pax dianggap assigned.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {makkahAgreements.map((agreement, index) => {
            const canDeleteAgreement = makkahAgreementIdSet.has(agreement.id);
            const assignedDraft = assignedDraftByAgreementId.get(agreement.id);
            const statusLabel = getAgreementStatusLabel(agreement.status);

            return (
              <details key={agreement.id} className="serene-accordion min-w-0 max-w-full">
                <summary className="serene-accordion-summary min-w-0 max-w-full flex-col">
                  <div className="flex w-full min-w-0 items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-on-surface">
                          {agreement.hotelName.trim() || `Hotel ${index + 1}`}
                        </h3>
                        {agreement.ownerGroupCode &&
                          familyGroups.length > 1 &&
                          agreement.ownerGroupCode !== activeGroupCode && (
                            <span className="inline-flex max-w-full break-all rounded border border-outline-variant/50 bg-surface-container-high px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
                              Milik: {agreement.ownerGroupCode}
                            </span>
                          )}
                        <span
                          className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${getAgreementStatusClasses(
                            agreement.status === "Approved"
                          )}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className={getIconButtonClasses()}
                        aria-label={`Edit Makkah agreement ${index + 1}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openAgreementEditor("makkah", agreement, canDeleteAgreement);
                        }}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          edit
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`${getIconButtonClasses(true)} disabled:cursor-not-allowed disabled:opacity-45`}
                        aria-label={`${assignedDraft ? "Unassign" : "Delete"} Makkah agreement ${index + 1}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openDeleteAgreementConfirm("makkah", agreement, canDeleteAgreement, assignedDraft);
                        }}
                        disabled={!canDeleteAgreement}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {assignedDraft ? "link_off" : "delete"}
                        </span>
                      </button>
                      <span
                        className="serene-accordion-chevron material-symbols-outlined text-on-surface-variant"
                        aria-hidden="true"
                      >
                        expand_more
                      </span>
                    </div>
                  </div>

                  <AgreementSummaryFields agreement={agreement} />
                </summary>

                <div className="serene-accordion-content">
                  <AgreementExpandedFields agreement={agreement} />
                </div>
              </details>
            );
          })}
        </div>

        {addingHotelCity === "makkah" ? (
          <AgreementInboxDraftAssignmentList
            city="makkah"
            drafts={availableAgreementDraftsByCity.makkah}
            group={group}
            isLoading={agreementDraftsQueryLoading ?? false}
            isError={agreementDraftsQueryError ?? false}
            assigningDraftId={assigningAgreementDraftId}
            onAssignDraft={(draft, selectedStart, selectedEnd) =>
              void assignAgreementDraft(draft, selectedStart, selectedEnd)
            }
            coverageStartIso={coverageStartIso}
            coverageEndIso={coverageEndIso}
            onCoverageDatesChange={(start, end) => {
              setCoverageStartIso(start);
              setCoverageEndIso(end);
            }}
            onCancel={cancelAddHotelInline}
          />
        ) : null}

        <div
          className={`mt-4 inline-flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium ${getCitySummaryClasses(
            makkahMissing > 0
          )}`}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {makkahMissing > 0 ? "error" : "check_circle"}
          </span>
          <p>
            <span className="sm:hidden">
              {makkahAssigned}/{totalPax} Pax - {makkahMissing > 0 ? `${makkahMissing} missing` : "All assigned"}
            </span>
            <span className="hidden sm:inline">
              Total Pax: {makkahAssigned} / {totalPax} -{" "}
              {makkahMissing > 0 ? `${makkahMissing} pax missing hotel in Makkah` : "All pax assigned"}
            </span>
          </p>
        </div>
      </article>

      <article className="min-w-0 overflow-hidden rounded-3xl border border-outline-variant/50 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
              apartment
            </span>
            <h2 className="text-xl font-bold text-on-surface">Madinah</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <HotelWaiverToggle city="madinah" waived={Boolean(row.madinahHotelWaived)} onToggle={toggleHotelWaiver} />
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-xs font-bold leading-none text-on-surface transition hover:border-brand-primary hover:text-brand-primary sm:py-1.5"
              onClick={() => openAddHotelInline("madinah")}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                add
              </span>
              <span>Add Hotel</span>
            </button>
          </div>
        </div>

        {dateGapWarnings.cityWarnings.madinah ? (
          <div className="mt-4">
            <AgreementDateGapWarning message={dateGapWarnings.cityWarnings.madinah} />
          </div>
        ) : null}

        <div className="mt-4 min-w-0 space-y-3">
          {madinahAgreements.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-tertiary/45 bg-brand-tertiary/10 px-4 py-4 text-sm text-brand-tertiary">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  warning
                </span>
                <div>
                  <p className="font-bold">Agreement Madinah belum tersambung.</p>
                  <p className="mt-1 text-xs font-semibold opacity-85">
                    Tambahkan hotel agreement dari data Nusuk sebelum pax dianggap assigned.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {madinahAgreements.map((agreement, index) => {
            const canDeleteAgreement = madinahAgreementIdSet.has(agreement.id);
            const assignedDraft = assignedDraftByAgreementId.get(agreement.id);
            const statusLabel = getAgreementStatusLabel(agreement.status);

            return (
              <details key={agreement.id} className="serene-accordion min-w-0 max-w-full">
                <summary className="serene-accordion-summary min-w-0 max-w-full flex-col">
                  <div className="flex w-full min-w-0 items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-on-surface">
                          {agreement.hotelName.trim() || `Hotel ${index + 1}`}
                        </h3>
                        {agreement.ownerGroupCode &&
                          familyGroups.length > 1 &&
                          agreement.ownerGroupCode !== activeGroupCode && (
                            <span className="inline-flex max-w-full break-all rounded border border-outline-variant/50 bg-surface-container-high px-1.5 py-0.5 text-[10px] font-bold text-on-surface-variant">
                              Milik: {agreement.ownerGroupCode}
                            </span>
                          )}
                        <span
                          className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${getAgreementStatusClasses(
                            agreement.status === "Approved"
                          )}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className={getIconButtonClasses()}
                        aria-label={`Edit Madinah agreement ${index + 1}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openAgreementEditor("madinah", agreement, canDeleteAgreement);
                        }}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          edit
                        </span>
                      </button>
                      <button
                        type="button"
                        className={`${getIconButtonClasses(true)} disabled:cursor-not-allowed disabled:opacity-45`}
                        aria-label={`${assignedDraft ? "Unassign" : "Delete"} Madinah agreement ${index + 1}`}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openDeleteAgreementConfirm("madinah", agreement, canDeleteAgreement, assignedDraft);
                        }}
                        disabled={!canDeleteAgreement}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {assignedDraft ? "link_off" : "delete"}
                        </span>
                      </button>
                      <span
                        className="serene-accordion-chevron material-symbols-outlined text-on-surface-variant"
                        aria-hidden="true"
                      >
                        expand_more
                      </span>
                    </div>
                  </div>

                  <AgreementSummaryFields agreement={agreement} />
                </summary>

                <div className="serene-accordion-content">
                  <AgreementExpandedFields agreement={agreement} />
                </div>
              </details>
            );
          })}
        </div>

        {addingHotelCity === "madinah" ? (
          <AgreementInboxDraftAssignmentList
            city="madinah"
            drafts={availableAgreementDraftsByCity.madinah}
            group={group}
            isLoading={agreementDraftsQueryLoading ?? false}
            isError={agreementDraftsQueryError ?? false}
            assigningDraftId={assigningAgreementDraftId}
            onAssignDraft={(draft, selectedStart, selectedEnd) =>
              void assignAgreementDraft(draft, selectedStart, selectedEnd)
            }
            coverageStartIso={coverageStartIso}
            coverageEndIso={coverageEndIso}
            onCoverageDatesChange={(start, end) => {
              setCoverageStartIso(start);
              setCoverageEndIso(end);
            }}
            onCancel={cancelAddHotelInline}
          />
        ) : null}

        <div
          className={`mt-4 inline-flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium ${getCitySummaryClasses(
            madinahMissing > 0
          )}`}
        >
          <span className="material-symbols-outlined" aria-hidden="true">
            {madinahMissing > 0 ? "error" : "check_circle"}
          </span>
          <p>
            <span className="sm:hidden">
              {madinahAssigned}/{totalPax} Pax - {madinahMissing > 0 ? `${madinahMissing} missing` : "All assigned"}
            </span>
            <span className="hidden sm:inline">
              Total Pax: {madinahAssigned} / {totalPax} -{" "}
              {madinahMissing > 0 ? `${madinahMissing} pax missing hotel in Madinah` : "All pax assigned"}
            </span>
          </p>
        </div>
      </article>
    </section>
  );
}
