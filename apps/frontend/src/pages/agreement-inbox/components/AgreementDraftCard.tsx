import { Button } from "../../../components/button";
import { DatePickerInput } from "../../../components/date-time-pickers";
import type { HotelAgreementDraft, AgreementApprovalStatus } from "../../../shared/app-domain";
import { formatVisaDateWithYear, getInclusiveDays } from "../../../shared/app-domain";

function getAssignmentBadgeClasses(draft: HotelAgreementDraft): string {
  if (draft.assignmentStatus === "Assigned") {
    return "border-brand-primary/25 bg-brand-primary/12 text-brand-primary";
  }
  if (draft.assignmentStatus === "Partially Assigned") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }
  return "border-amber-200 bg-amber-100 text-amber-800";
}

function getApprovalBadgeClasses(draft: HotelAgreementDraft): string {
  if (draft.status === "Approved") {
    return "border-emerald-500 bg-emerald-600 text-white shadow-sm";
  }
  if (draft.status === "Rejected") {
    return "border-rose-500 bg-rose-600 text-white shadow-sm";
  }
  return "border-amber-300 bg-amber-100 text-amber-900";
}

function getApprovalStatusIconName(draft: HotelAgreementDraft): "check_circle" | "pending_actions" | "cancel" {
  if (draft.status === "Approved") {
    return "check_circle";
  }
  if (draft.status === "Rejected") {
    return "cancel";
  }
  return "pending_actions";
}

function getApprovalStatusLabel(draft: HotelAgreementDraft): AgreementApprovalStatus {
  return draft.status;
}

function formatDraftDateTime(value: string): string {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AgreementDraftCard({
  draft,
  linkedGroupCode,
  assignmentGroupCode,
  hasDatesSelected,
  isDateRangeInvalid,
  startDateFilter,
  endDateFilter,
  deleteDraftMutationPending,
  assignDraftMutationPending,
  unassignDraftMutationPending,
  onStartEdit,
  onDeleteRequest,
  onAssignmentGroupCodeChange,
  onAssignToGroup,
  onUnassignFromGroup,
  readOnly = false,
}: {
  draft: HotelAgreementDraft;
  linkedGroupCode: string;
  assignmentGroupCode: string;
  hasDatesSelected: boolean;
  isDateRangeInvalid: boolean;
  startDateFilter: string;
  endDateFilter: string;
  deleteDraftMutationPending: boolean;
  assignDraftMutationPending: boolean;
  unassignDraftMutationPending: boolean;
  onStartEdit: (draft: HotelAgreementDraft) => void;
  onDeleteRequest: (draft: HotelAgreementDraft) => void;
  onAssignmentGroupCodeChange: (draftId: string, value: string) => void;
  onAssignToGroup: (draft: HotelAgreementDraft) => void;
  onUnassignFromGroup: (draft: HotelAgreementDraft, code?: string) => void;
  readOnly?: boolean;
}) {
  const isAssigned = draft.assignmentStatus === "Assigned" || draft.assignmentStatus === "Partially Assigned";
  const isRejected = draft.status === "Rejected";
  const isApproved = draft.status === "Approved";

  let cardBorderClass = "border-l-[6px] border-l-amber-500";
  let cardBgClass = "bg-surface-container-lowest";
  let opacityClass = "";

  if (isApproved) {
    cardBorderClass = "border-l-[6px] border-l-emerald-500";
  } else if (isRejected) {
    cardBorderClass = "border-l-[6px] border-l-rose-500";
    cardBgClass = "bg-slate-50/75";
    opacityClass = "opacity-90";
  }

  return (
    <article
      className={`overflow-hidden rounded-3xl border-[0.5px] border-black/20 ${cardBgClass} ${cardBorderClass} ${opacityClass} shadow-sm`}
    >
      <div className="grid gap-0 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="border-b border-dashed border-black/45 bg-transparent p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-900">Agreement No</p>
              <p className="mt-2 break-words text-2xl font-extrabold leading-none tracking-tight text-slate-900 sm:text-[2rem]">
                {draft.agreementNumber}
              </p>
            </div>
            {!readOnly ? (
              <button
                type="button"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest/90 text-slate-900 transition hover:bg-surface-container-high"
                aria-label={`Edit agreement draft ${draft.agreementNumber}`}
                onClick={() => onStartEdit(draft)}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  edit
                </span>
              </button>
            ) : null}
          </div>

          <div className="mt-5 space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Hotel</p>
            <h3 className="break-words text-lg font-bold leading-snug text-slate-900">{draft.hotelName}</h3>
            {draft.agentName ? (
              <p className="truncate text-sm font-semibold text-brand-primary">Agent: {draft.agentName}</p>
            ) : (
              <p className="text-sm font-semibold text-slate-500">Agent belum diisi</p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex rounded-lg bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-slate-800">
                {draft.city === "makkah" ? "Makkah" : "Madinah"}
              </span>
              <span className="inline-flex rounded-lg bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-slate-800">
                {draft.remainingPax !== undefined
                  ? `Available: ${draft.remainingPax}/${draft.pax} Pax`
                  : `Available: ${draft.pax} Pax`}
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Check In</p>
              <strong className="mt-1 block text-sm font-extrabold text-slate-900 sm:text-base">
                {formatVisaDateWithYear(draft.stayStartIso)}
              </strong>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-900">Check Out</p>
              <strong className="mt-1 block text-sm font-extrabold text-slate-900 sm:text-base">
                {formatVisaDateWithYear(draft.stayEndIso)}
              </strong>
            </div>
          </div>
        </div>

        <div className="space-y-4 bg-surface-container-low p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-on-surface-variant/90">
                Agreement Status
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] leading-none ${getApprovalBadgeClasses(
                    draft,
                  )}`}
                >
                  <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
                    {getApprovalStatusIconName(draft)}
                  </span>
                  <span>{getApprovalStatusLabel(draft)}</span>
                </span>
                <span
                  className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold uppercase leading-none tracking-[0.08em] ${getAssignmentBadgeClasses(
                    draft,
                  )}`}
                >
                  {draft.assignmentStatus}
                </span>
                {hasDatesSelected &&
                  !isDateRangeInvalid &&
                  (() => {
                    const isFullCoverage = draft.stayStartIso <= startDateFilter && draft.stayEndIso >= endDateFilter;
                    const coverageType = isFullCoverage ? "Full Coverage" : "Partial Coverage";
                    const filterDays = getInclusiveDays(startDateFilter, endDateFilter);
                    const overlapStart = draft.stayStartIso > startDateFilter ? draft.stayStartIso : startDateFilter;
                    const overlapEnd = draft.stayEndIso < endDateFilter ? draft.stayEndIso : endDateFilter;
                    const matchDays = getInclusiveDays(overlapStart, overlapEnd);
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold uppercase leading-none tracking-[0.08em] ${
                          isFullCoverage
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-amber-400 bg-amber-50 text-amber-800"
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm leading-none" aria-hidden="true">
                          {isFullCoverage ? "assignment_turned_in" : "assignment_late"}
                        </span>
                        <span>
                          {coverageType} ({matchDays}/{filterDays} hari)
                        </span>
                      </span>
                    );
                  })()}
              </div>
            </div>
            {!readOnly ? (
              <Button
                variant="danger"
                size="sm"
                className="h-9 w-9 p-0 rounded-full inline-flex items-center justify-center shrink-0"
                aria-label={`Delete agreement draft ${draft.agreementNumber}`}
                title={isAssigned ? "Unassign agreement before deleting it." : undefined}
                onClick={() => onDeleteRequest(draft)}
                disabled={deleteDraftMutationPending || isAssigned}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  delete
                </span>
              </Button>
            ) : null}
          </div>

          <div className="border-t border-dashed border-black/20 pt-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">
                  Group Link
                </p>
                {draft.assignedGroups && draft.assignedGroups.length > 0 ? (
                  <div className="mt-2 space-y-1.5 max-w-md">
                    {draft.assignedGroups.map((link) => (
                      <div
                        key={link.groupCode}
                        className="flex items-center justify-between gap-3 bg-surface-container-high/60 rounded-xl px-3 py-1.5 border border-black/5"
                      >
                        <div className="min-w-0">
                          <span className="font-extrabold text-slate-900 text-sm">{link.groupCode}</span>
                          <span className="ml-2 text-xs font-semibold text-slate-500">({link.pax} Pax)</span>
                        </div>
                        {!readOnly ? (
                          <button
                            type="button"
                            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100 disabled:opacity-50"
                            onClick={() => onUnassignFromGroup(draft, link.groupCode)}
                            disabled={unassignDraftMutationPending}
                          >
                            <span className="material-symbols-outlined text-sm" aria-hidden="true">
                              link_off
                            </span>
                            <span>Lepas</span>
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-sm font-bold text-slate-900">Belum terhubung ke group</p>
                )}
                <p className="mt-2 text-xs font-semibold leading-relaxed text-slate-500">
                  Created {formatDraftDateTime(draft.createdAtIso)}
                </p>
              </div>

              {readOnly ? null : isRejected ? (
                <div className="flex min-w-0 flex-col gap-1 sm:w-64">
                  <p className="text-xs font-semibold text-rose-600 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">
                      error
                    </span>
                    <span>Draft ditolak. Harap edit nomor agreement dengan nomor baru untuk menghubungkan.</span>
                  </p>
                </div>
              ) : draft.remainingPax === undefined || draft.remainingPax > 0 ? (
                <div className="flex min-w-0 flex-col gap-2 sm:w-64">
                  <label className="sr-only" htmlFor={`assign-${draft.id}`}>
                    Group number
                  </label>
                  <input
                    id={`assign-${draft.id}`}
                    type="text"
                    className="serene-input serene-input-md min-w-0"
                    placeholder="Group number"
                    value={assignmentGroupCode}
                    onChange={(event) => onAssignmentGroupCodeChange(draft.id, event.target.value)}
                  />
                  <Button
                    variant="secondary"
                    className="inline-flex items-center gap-1.5"
                    onClick={() => onAssignToGroup(draft)}
                    disabled={assignDraftMutationPending}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      link
                    </span>
                    <span>{assignDraftMutationPending ? "Linking..." : "Link to Group"}</span>
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          {draft.notes ? (
            <div className="border-t border-dashed border-black/20 pt-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/90">Notes</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-600">{draft.notes}</p>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
