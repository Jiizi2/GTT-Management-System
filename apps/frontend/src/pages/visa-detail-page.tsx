import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod/v4";
import * as Domain from "../shared/app-domain";
import {
  assignAgreementDraftInBackend,
  unassignAgreementDraftInBackend,
  useAgreementDraftsQuery,
} from "../hooks/use-agreement-drafts-query";
import { buildRaudhahReminderTemplate } from "../shared/raudhah-reminder-template.js";
import { agreementDraftQueryKeys, groupQueryKeys } from "../shared/query-keys";
import { DatePickerInput } from "../components/date-time-pickers";
import { FieldErrorMessage, getFieldAriaInvalid, getFieldDescribedBy } from "../components/form-accessibility";
import { SereneSelect } from "../components/serene-select";
import { useModalFocusTrap } from "../components/use-modal-focus-trap";
import type {
  GroupAgreementHotel,
  GroupData,
  HotelAgreementDraft,
  VisaHotelEditFormState,
  VisaPaymentStatus,
  VisaRaudhahEditFormState,
  VisaStatus,
  VisaTrackingRow,
} from "../shared/app-domain";

const {
  formatVisaDateWithYear,
  formatVisaShortDate,
  generateWhatsappCopyText,
  getGroupAgreementHotelsByCity,
  isIsoDateValue,
  resolveGroupCompleteness,
  resolveTotalBusCount,
  resolveVisaAgreementDateRange,
  resolveVisaAgreementNumber,
  filterAgreementDrafts,
} = Domain;

const LazyDeleteGroupModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).DeleteGroupModal,
}));
const LazyGroupEditModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).GroupEditModal,
}));
const LazyUnlinkGroupConfirmModal = lazy(async () => ({
  default: (await import("../components/group-detail-modals")).UnlinkGroupConfirmModal,
}));
const LazyPaymentStatusModal = lazy(async () => ({
  default: (await import("../components/visa-detail-modals")).PaymentStatusModal,
}));
const LazySyarikahModal = lazy(async () => ({
  default: (await import("../components/visa-detail-modals")).SyarikahModal,
}));
const LazyVisaHotelModal = lazy(async () => ({
  default: (await import("../components/visa-detail-modals")).VisaHotelModal,
}));
const LazyVisaRaudhahModal = lazy(async () => ({
  default: (await import("../components/visa-detail-modals")).VisaRaudhahModal,
}));
const LazyVisaStatusModal = lazy(async () => ({
  default: (await import("../components/visa-detail-modals")).VisaStatusModal,
}));
const LazyVisaTypeModal = lazy(async () => ({
  default: (await import("../components/visa-detail-modals")).VisaTypeModal,
}));

function VisaDetailModalFallback() {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="serene-modal-overlay z-[140] flex items-center justify-center p-4">
      <div className="inline-flex items-center gap-2 rounded-xl bg-surface-container-lowest px-4 py-3 text-sm font-semibold text-on-surface shadow-ambient">
        <span className="material-symbols-outlined animate-pulse text-brand-primary" aria-hidden="true">
          hourglass_top
        </span>
        <span>Loading modal...</span>
      </div>
    </div>,
    document.body,
  );
}

type Tone = "success" | "warning" | "muted";
type RaudhahStatus = "Free" | "Before" | "After";

function getToneClasses(tone: Tone): string {
  if (tone === "success") {
    return "border-brand-primary/25 bg-brand-primary/12 text-brand-primary";
  }

  if (tone === "warning") {
    return "border-brand-tertiary/30 bg-brand-tertiary/12 text-brand-tertiary";
  }

  return "border-brand-secondary/30 bg-brand-secondary/12 text-brand-secondary";
}

function getToneTextClass(tone: Tone): string {
  if (tone === "success") {
    return "text-brand-primary";
  }

  if (tone === "warning") {
    return "text-brand-tertiary";
  }

  return "text-brand-secondary";
}

function getIconButtonClasses(isDanger = false): string {
  if (isDanger) {
    return "inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-tertiary/35 bg-brand-tertiary/12 text-brand-tertiary transition hover:bg-brand-tertiary/20";
  }

  return "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-surface-container-lowest text-slate-600 transition hover:border-brand-primary hover:text-brand-primary";
}

function getCitySummaryClasses(hasMissing: boolean): string {
  if (hasMissing) {
    return "border-brand-tertiary/30 bg-brand-tertiary/12 text-brand-tertiary";
  }

  return "border-brand-primary/25 bg-brand-primary/10 text-brand-primary";
}

function getAgreementStatusClasses(isApproved: boolean): string {
  return isApproved
    ? "border-brand-primary/25 bg-brand-primary/12 text-brand-primary"
    : "border-amber-200 bg-amber-100 text-amber-800";
}

function getAgreementStatusLabel(status: GroupAgreementHotel["status"]): "Approved" | "Waiting for Approval" {
  return status === "Approved" ? "Approved" : "Waiting for Approval";
}

function formatAgreementStayRange(agreement: GroupAgreementHotel): string {
  const stayStartIso = agreement.stayStartIso?.trim() ?? "";
  const stayEndIso = agreement.stayEndIso?.trim() ?? "";

  if (!stayStartIso && !stayEndIso) {
    return "Stay dates pending";
  }

  if (stayStartIso && stayEndIso) {
    return `${formatVisaDateWithYear(stayStartIso)} - ${formatVisaDateWithYear(stayEndIso)}`;
  }

  if (stayStartIso) {
    return `Start ${formatVisaDateWithYear(stayStartIso)}`;
  }

  return `End ${formatVisaDateWithYear(stayEndIso)}`;
}

function formatAgreementStayDate(value: string | undefined): string {
  const isoDate = value?.trim() ?? "";
  return isoDate ? formatVisaDateWithYear(isoDate) : "Pending";
}

function AgreementSummaryFields({ agreement }: { agreement: GroupAgreementHotel }) {
  const agreementNumber = agreement.agreementNumber?.trim() || "Agreement number pending";
  const paxLabel = Number.isFinite(agreement.pax) ? agreement.pax.toString() : "-";

  return (
    <div className="flex w-full flex-wrap gap-2">
      <div className="min-w-[13rem] flex-1 rounded-xl border border-slate-200 bg-surface-container-low px-3 py-2">
        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            confirmation_number
          </span>
          Agreement No
        </span>
        <strong className="mt-1 block break-all text-sm font-extrabold leading-snug text-slate-900">
          {agreementNumber}
        </strong>
      </div>

      <div className="min-w-[5.5rem] rounded-xl border border-slate-200 bg-surface-container-low px-3 py-2">
        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            group
          </span>
          Pax
        </span>
        <strong className="mt-1 block text-lg font-black leading-none text-slate-900">{paxLabel}</strong>
      </div>

      <div className="min-w-[12rem] flex-1 rounded-xl border border-slate-200 bg-surface-container-low px-3 py-2">
        <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            event
          </span>
          Stay
        </span>
        <strong className="mt-1 block text-sm font-extrabold leading-snug text-slate-900">
          {formatAgreementStayRange(agreement)}
        </strong>
      </div>
    </div>
  );
}

function AgreementExpandedFields({ agreement }: { agreement: GroupAgreementHotel }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-surface-container-low px-3 py-2">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">Check In</span>
        <strong className="mt-1 block text-sm font-extrabold text-slate-900">
          {formatAgreementStayDate(agreement.stayStartIso)}
        </strong>
      </div>
      <div className="rounded-xl border border-slate-200 bg-surface-container-low px-3 py-2">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-500">Check Out</span>
        <strong className="mt-1 block text-sm font-extrabold text-slate-900">
          {formatAgreementStayDate(agreement.stayEndIso)}
        </strong>
      </div>
    </div>
  );
}

function formatAgreementDraftStayRange(draft: HotelAgreementDraft): string {
  const stayStart = draft.stayStartIso.trim();
  const stayEnd = draft.stayEndIso.trim();

  if (stayStart && stayEnd) {
    return `${formatVisaDateWithYear(stayStart)} - ${formatVisaDateWithYear(stayEnd)}`;
  }

  if (stayStart) {
    return `Start ${formatVisaDateWithYear(stayStart)}`;
  }

  if (stayEnd) {
    return `End ${formatVisaDateWithYear(stayEnd)}`;
  }

  return "Stay dates pending";
}

function normalizeAgreementMatchValue(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function doesAgreementMatchAssignedDraft({
  draft,
  agreement,
  city,
  groupCode,
}: {
  draft: HotelAgreementDraft;
  agreement: GroupAgreementHotel;
  city: "makkah" | "madinah";
  groupCode: string;
}): boolean {
  if (agreement.sourceDraftId && agreement.sourceDraftId === draft.id) {
    return true;
  }

  const isAssignedToGroup = draft.assignedGroups?.some(
    (g) => normalizeAgreementMatchValue(g.groupCode) === normalizeAgreementMatchValue(groupCode)
  ) ?? false;

  return (
    isAssignedToGroup &&
    draft.city === city &&
    normalizeAgreementMatchValue(draft.agreementNumber) === normalizeAgreementMatchValue(agreement.agreementNumber)
  );
}

function formatVisaMutationError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback;
}

function getRaudhahStatusBadgeClasses(status: RaudhahStatus): string {
  if (status === "After") {
    return "border-brand-primary/25 bg-brand-primary/12 text-brand-primary";
  }

  if (status === "Before") {
    return "border-brand-tertiary/30 bg-brand-tertiary/12 text-brand-tertiary";
  }

  return "border-brand-secondary/30 bg-brand-secondary/12 text-brand-secondary";
}



function getUncoveredPeriod(
  city: "makkah" | "madinah",
  groupArrival: string,
  groupReturn: string,
  existingAgreements: GroupAgreementHotel[]
): { start: string; end: string } {
  if (!isIsoDateValue(groupArrival) || !isIsoDateValue(groupReturn)) {
    return { start: "", end: "" };
  }
  const nights: string[] = [];
  const startMs = Date.parse(groupArrival);
  const endMs = Date.parse(groupReturn);
  if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
    return { start: "", end: "" };
  }
  const oneDayMs = 24 * 60 * 60 * 1000;
  for (let currentMs = startMs; currentMs < endMs; currentMs += oneDayMs) {
    nights.push(new Date(currentMs).toISOString().slice(0, 10));
  }

  const covered = new Set<string>();
  for (const agg of existingAgreements) {
    const aggStart = (agg.stayStartIso ?? "").trim();
    const aggEnd = (agg.stayEndIso ?? "").trim();
    if (isIsoDateValue(aggStart) && isIsoDateValue(aggEnd)) {
      const startValMs = Date.parse(aggStart);
      const endValMs = Date.parse(aggEnd);
      for (let currMs = startValMs; currMs < endValMs; currMs += oneDayMs) {
        covered.add(new Date(currMs).toISOString().slice(0, 10));
      }
    }
  }

  const uncovered = nights.filter((n) => !covered.has(n));
  if (uncovered.length === 0) {
    return { start: groupArrival, end: groupReturn };
  }

  const sorted = uncovered.sort();
  const first = sorted[0];
  let last = first;
  for (let i = 1; i < sorted.length; i++) {
    const currentMs = Date.parse(sorted[i]);
    const prevMs = Date.parse(sorted[i - 1]);
    if (currentMs - prevMs === oneDayMs) {
      last = sorted[i];
    } else {
      break;
    }
  }
  const nextDay = new Date(Date.parse(last) + oneDayMs).toISOString().slice(0, 10);
  return { start: first, end: nextDay };
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
}: {
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
}) {
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
        <h4 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500 mb-2">
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
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-surface-container-low p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h5 className="break-words text-sm font-bold text-slate-900">{draft.hotelName}</h5>
                  <span className="inline-flex rounded-md border border-slate-200 bg-surface-container-lowest px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                    Pax {draft.remainingPax !== undefined && draft.remainingPax < draft.pax ? `${minRemaining}/${draft.pax}` : draft.pax}
                  </span>
                  <span
                    className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                      typeLabel === "Full"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {typeLabel === "Full" ? "Full Coverage" : "Partial Coverage"}
                  </span>
                </div>
                {draft.agentName ? (
                  <p className="mt-1 text-xs font-semibold text-brand-primary">Agent: {draft.agentName}</p>
                ) : null}
                <p className="mt-1 break-words text-xs font-semibold text-slate-700">{draft.agreementNumber}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  Validity: {formatAgreementDraftStayRange(draft)}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-700">
                  Coverage: {formatVisaShortDate(overlapStart)} - {formatVisaShortDate(overlapEnd)}
                </p>
                {isAlreadyAssignedToGroup ? (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-700">
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
    <section className="mt-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-primary">Agreement Inbox</p>
          <h3 className="mt-0.5 text-sm font-bold text-slate-900">Available {cityLabel} Agreements</h3>
        </div>
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-surface-container-lowest px-3 text-xs font-semibold text-slate-700 transition hover:border-brand-tertiary hover:text-brand-tertiary"
          onClick={onCancel}
        >
          <span className="material-symbols-outlined text-sm" aria-hidden="true">
            close
          </span>
          <span>Close</span>
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-surface-container-low p-3 shadow-sm sm:flex-row sm:items-center">
        <div className="flex-1">
          <label htmlFor={`coverage-start-${city}`} className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
            Start Date
          </label>
          <DatePickerInput
            id={`coverage-start-${city}`}
            inputClassName="mt-1 block w-full rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={coverageStartIso}
            onChange={(val) => onCoverageDatesChange(val, coverageEndIso)}
          />
        </div>
        <div className="flex-1">
          <label htmlFor={`coverage-end-${city}`} className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
            End Date
          </label>
          <DatePickerInput
            id={`coverage-end-${city}`}
            inputClassName="mt-1 block w-full rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            value={coverageEndIso}
            onChange={(val) => onCoverageDatesChange(coverageStartIso, val)}
          />
        </div>
      </div>

      {isLoading ? (
        <p className="mt-3 rounded-xl bg-surface-container-low px-3 py-2 text-xs font-semibold text-slate-600">
          Loading agreement inbox...
        </p>
      ) : null}

      {isError ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          Agreement inbox belum berhasil dimuat.
        </p>
      ) : null}

      {!isLoading && eligibleDrafts.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs font-semibold text-slate-500">
          Tidak ada draft {cityLabel} yang cocok dengan periode dan kapasitas yang dicari.
        </p>
      ) : null}

      {!isLoading && fullCoverageDrafts.length > 0 ? renderDraftList(fullCoverageDrafts, "Full") : null}
      {!isLoading && partialCoverageDrafts.length > 0 ? renderDraftList(partialCoverageDrafts, "Partial") : null}
    </section>
  );
}

export function VisaTrackingDetailScreen({
  row: initialRow,
  groups,
  onBack,
  onDeleteGroup,
  onSaveGroup,
  onUpdateVisaStatus,
  onUpdateVisaType,
  onUpdatePaymentStatus,
  onUpdateSyarikah,
  onUpdateVisaHotel,
  onDeleteVisaHotel,
  onUpdateRaudhahAppointment,
  onClearRaudhahAppointment,
}: {
  row: VisaTrackingRow;
  groups: GroupData[];
  onBack: () => void;
  onDeleteGroup: (groupCode: string) => void;
  onSaveGroup: (group: GroupData, sourceGroupCode?: string) => { ok: true } | { ok: false; message: string };
  onUpdateVisaStatus: (groupCode: string, visaStatus: VisaStatus) => void;
  onUpdatePaymentStatus: (groupCode: string, paymentStatus: VisaPaymentStatus) => void;
  onUpdateSyarikah: (groupCode: string, syarikah: string) => void;
  onUpdateVisaHotel: (
    groupCode: string,
    city: "makkah" | "madinah",
    hotel: VisaHotelEditFormState,
    hotelId?: string,
  ) => void;
  onDeleteVisaHotel: (groupCode: string, city: "makkah" | "madinah", hotelId: string) => void;
  onUpdateRaudhahAppointment: (groupCode: string, appointment: VisaRaudhahEditFormState) => void;
  onClearRaudhahAppointment: (groupCode: string) => void;
  onUpdateVisaType: (groupCode: string, visaType: "Visa Only" | "Visa+") => void;
}) {
  const [activeGroupCode, setActiveGroupCode] = useState(initialRow.groupCode);
  const [unlinkingGroup, setUnlinkingGroup] = useState<GroupData | null>(null);
  const allVisaRows = useMemo(() => Domain.buildVisaTrackingRowsFromGroups(groups), [groups]);
  const activeRow = useMemo(() => {
    return allVisaRows.find((r) => r.groupCode === activeGroupCode) ?? initialRow;
  }, [allVisaRows, activeGroupCode, initialRow]);

  useEffect(() => {
    setActiveGroupCode(initialRow.groupCode);
  }, [initialRow.groupCode]);

  // Find family groups for tabs
  const familyGroups = useMemo(() => {
    const currentGroup = groups.find((item) => item.code === activeRow.groupCode) ?? null;
    if (!currentGroup) return [];
    const parent = currentGroup.parentGroupId
      ? (groups.find((g) => g.id === currentGroup.parentGroupId || g.code === currentGroup.parentGroupId) ?? null)
      : currentGroup;
    if (!parent) return [currentGroup];
    const parentKey = parent.id || parent.code;
    if (!parentKey) return [currentGroup];
    const children = groups.filter(
      (g) => g.parentGroupId && (g.parentGroupId === parent.id || g.parentGroupId === parent.code) && g.code !== parent.code
    );
    return [parent, ...children];
  }, [groups, activeRow.groupCode]);

  const operationalGroup = familyGroups[0] ?? groups.find((item) => item.code === activeRow.groupCode) ?? null;
  const row = activeRow;


  const queryClient = useQueryClient();
  const agreementDraftsQuery = useAgreementDraftsQuery("", "all");
  const [paymentStatus, setPaymentStatus] = useState<VisaPaymentStatus>(row.paymentStatus);

  useEffect(() => {
    setPaymentStatus(activeRow.paymentStatus);
  }, [activeRow.groupCode, activeRow.paymentStatus]);

  const [activeModal, setActiveModal] = useState<
    "visa-status" | "payment-status" | "syarikah" | "hotel" | "raudhah" | "visa-type" | null
  >(null);
  const [hotelCityDraft, setHotelCityDraft] = useState<"makkah" | "madinah">("makkah");
  const [hotelDraftMode, setHotelDraftMode] = useState<"add" | "edit">("edit");
  const [hotelDraftId, setHotelDraftId] = useState<string | null>(null);
  const [hotelDraftSeed, setHotelDraftSeed] = useState<VisaHotelEditFormState | null>(null);
  const [hotelDraftOwnerGroupCode, setHotelDraftOwnerGroupCode] = useState<string | null>(null);
  const [addingHotelCity, setAddingHotelCity] = useState<"makkah" | "madinah" | null>(null);
  const [coverageStartIso, setCoverageStartIso] = useState<string>("");
  const [coverageEndIso, setCoverageEndIso] = useState<string>("");
  const [isGroupEditModalOpen, setIsGroupEditModalOpen] = useState(false);
  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
  const [deleteAgreementDraft, setDeleteAgreementDraft] = useState<{
    city: "makkah" | "madinah";
    agreement: GroupAgreementHotel;
    draft?: HotelAgreementDraft;
  } | null>(null);
  const [assigningAgreementDraftId, setAssigningAgreementDraftId] = useState<string | null>(null);
  const [unassigningAgreementDraftId, setUnassigningAgreementDraftId] = useState<string | null>(null);
  const [draftAssignFeedback, setDraftAssignFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const [isRaudhahTemplateCopied, setIsRaudhahTemplateCopied] = useState(false);
  const [isClearRaudhahConfirmOpen, setIsClearRaudhahConfirmOpen] = useState(false);
  const raudhahCopyTimerRef = useRef<any | null>(null);
  const [isWhatsappCopied, setIsWhatsappCopied] = useState(false);
  const whatsappCopyTimerRef = useRef<any | null>(null);
  const hasBlockingModal =
    activeModal !== null ||
    isGroupEditModalOpen ||
    isDeleteGroupModalOpen ||
    isClearRaudhahConfirmOpen ||
    unlinkingGroup !== null ||
    deleteAgreementDraft !== null;
  const clearRaudhahDialogRef = useModalFocusTrap<HTMLDivElement>({
    isActive: isClearRaudhahConfirmOpen,
    onClose: () => setIsClearRaudhahConfirmOpen(false),
  });
  const deleteAgreementDialogRef = useModalFocusTrap<HTMLDivElement>({
    isActive: deleteAgreementDraft !== null,
    onClose: () => setDeleteAgreementDraft(null),
  });

  const group = groups.find((item) => item.code === activeGroupCode) ?? groups.find((item) => item.code === row.groupCode) ?? null;
  const groupCompleteness = group ? resolveGroupCompleteness(group) : null;
  const agreementIssues =
    groupCompleteness?.issues.filter(
      (issue) =>
        issue.key === "missing-agreement" ||
        issue.key === "missing-makkah-agreement" ||
        issue.key === "missing-madinah-agreement" ||
        issue.key === "pax-mismatch" ||
        issue.key === "date-mismatch",
    ) ?? [];
  const shouldShowLinkAgreementAction = agreementIssues.some(
    (issue) =>
      issue.key === "missing-agreement" ||
      issue.key === "missing-makkah-agreement" ||
      issue.key === "missing-madinah-agreement",
  );
  const primaryAgreementMessage = agreementIssues[0]?.message ?? "Agreement hotel sudah tersambung.";

  const totalPax = row.pax ?? group?.pax ?? 0;
  const requiredBusCount = resolveTotalBusCount(totalPax, group?.totalBuses);
  const durationDays = group?.durationDays ?? 8;
  const agreementDateRange = resolveVisaAgreementDateRange(row, durationDays, group ?? undefined);

  const makkahAgreements: GroupAgreementHotel[] = getGroupAgreementHotelsByCity(group ?? undefined, "makkah");
  const madinahAgreements: GroupAgreementHotel[] = getGroupAgreementHotelsByCity(group ?? undefined, "madinah");
  const connectedAgreementKeys = useMemo(
    () =>
      new Set([
        ...makkahAgreements.map((agreement) => `makkah:${agreement.agreementNumber.trim().toUpperCase()}`),
        ...madinahAgreements.map((agreement) => `madinah:${agreement.agreementNumber.trim().toUpperCase()}`),
      ]),
    [madinahAgreements, makkahAgreements],
  );
  const availableAgreementDraftsByCity = useMemo(() => {
    return filterAgreementDrafts(agreementDraftsQuery.data ?? [], {
      groupArrivalDate: group?.arrivalDate,
      groupReturnDate: group?.returnDate,
      rowDepartureIso: row.departureIso,
      rowReturnIso: row.returnIso,
      totalPax,
      connectedAgreementKeys,
      existingAgreements: [
        ...makkahAgreements,
        ...madinahAgreements,
      ],
    });
  }, [
    agreementDraftsQuery.data,
    connectedAgreementKeys,
    group?.arrivalDate,
    group?.returnDate,
    row.departureIso,
    row.returnIso,
    totalPax,
    makkahAgreements,
    madinahAgreements,
  ]);
  const assignedDraftByAgreementId = useMemo(() => {
    const drafts = agreementDraftsQuery.data ?? [];
    const draftByAgreementId = new Map<string, HotelAgreementDraft>();

    for (const agreement of makkahAgreements) {
      const assignedDraft = drafts.find((draft) =>
        doesAgreementMatchAssignedDraft({
          draft,
          agreement,
          city: "makkah",
          groupCode: row.groupCode,
        }),
      );
      if (assignedDraft) {
        draftByAgreementId.set(agreement.id, assignedDraft);
      }
    }

    for (const agreement of madinahAgreements) {
      const assignedDraft = drafts.find((draft) =>
        doesAgreementMatchAssignedDraft({
          draft,
          agreement,
          city: "madinah",
          groupCode: row.groupCode,
        }),
      );
      if (assignedDraft) {
        draftByAgreementId.set(agreement.id, assignedDraft);
      }
    }

    return draftByAgreementId;
  }, [agreementDraftsQuery.data, madinahAgreements, makkahAgreements, row.groupCode]);

  const makkahAssigned = Math.min(totalPax, row.makkahVerified);
  const madinahAssigned = Math.min(totalPax, row.madinahVerified);
  const makkahMissing = Math.max(0, totalPax - makkahAssigned);
  const madinahMissing = Math.max(0, totalPax - madinahAssigned);

  const visaTone: Tone = row.visaStatus === "Issued" ? "success" : row.visaStatus === "Pending" ? "warning" : "muted";
  const paymentTone: Tone = paymentStatus === "Paid" ? "success" : paymentStatus === "Unpaid" ? "warning" : "muted";
  const raudhahAppointments = (group?.visaSetup?.raudhahAppointments ?? [])
    .map((appointment) => ({
      dateIso: appointment.dateIso?.trim() ?? "",
      status: appointment.status,
    }))
    .filter((appointment) => appointment.dateIso.length > 0)
    .sort((left, right) => left.dateIso.localeCompare(right.dateIso))
    .map((appointment) => ({
      ...appointment,
      dateLabel: formatVisaDateWithYear(appointment.dateIso),
    }));
  const hasRaudhahDates = raudhahAppointments.length > 0;
  const raudhahTone: Tone = hasRaudhahDates ? "success" : "muted";
  const raudhahStatusText = hasRaudhahDates ? "Set" : "Not Set";
  const raudhahStatusSummary = hasRaudhahDates
    ? Array.from(new Set(raudhahAppointments.map((appointment) => appointment.status))).join(", ")
    : "";
  const raudhahSecondaryText = hasRaudhahDates
    ? `${raudhahAppointments.length} appointment date${raudhahAppointments.length > 1 ? "s" : ""} selected${
        raudhahStatusSummary ? ` (${raudhahStatusSummary})` : ""
      }`
    : "Appointment pending";
  const raudhahSecondaryTextMobile = hasRaudhahDates
    ? `${raudhahAppointments.length} date${raudhahAppointments.length > 1 ? "s" : ""} set`
    : "Pending";
  const rawSyarikahValue = group?.visaSetup?.syarikah?.trim() ?? "";
  const syarikahValue = rawSyarikahValue.toLowerCase() === "not assigned" ? "" : rawSyarikahValue;
  const providerName = syarikahValue || "Provider pending";
  const raudhahReminderTemplate = buildRaudhahReminderTemplate({
    groupCode: row.groupCode,
    groupName: row.groupName,
    totalPax,
    packageName: row.packageName,
    departureIso: row.departureIso,
    providerName,
    coordinatorName: group?.musyrif?.name,
    appointments: raudhahAppointments,
  });
  const makkahAgreementIdSet = new Set(makkahAgreements.map((agreement) => agreement.id));
  const madinahAgreementIdSet = new Set(madinahAgreements.map((agreement) => agreement.id));

  const buildHotelDraft = (
    city: "makkah" | "madinah",
    mode: "add" | "edit",
    hotelId?: string,
  ): VisaHotelEditFormState => {
    const cityHotels = getGroupAgreementHotelsByCity(group ?? undefined, city);
    const currentHotel = hotelId ? cityHotels.find((entry) => entry.id === hotelId) : cityHotels[0];
    const cityRange = resolveVisaAgreementDateRange(row, durationDays, group ?? undefined);

    if (mode === "add") {
      return {
        sourceDraftId: undefined,
        hotelName: "",
        agreementNumber: "",
        pax: totalPax.toString(),
        status: "Waiting for Approval",
        stayStartIso: city === "makkah" ? cityRange.makkahStartIso : cityRange.madinahStartIso,
        stayEndIso: city === "makkah" ? cityRange.makkahEndIso : cityRange.madinahEndIso,
      };
    }

    return {
      sourceDraftId: currentHotel?.sourceDraftId?.trim() || undefined,
      hotelName: currentHotel?.hotelName?.trim() || "",
      agreementNumber: currentHotel?.agreementNumber?.trim() || "",
      pax: currentHotel?.pax?.toString() || totalPax.toString(),
      status: currentHotel?.status ?? "Waiting for Approval",
      stayStartIso:
        currentHotel?.stayStartIso?.trim() ||
        (city === "makkah" ? cityRange.makkahStartIso : cityRange.madinahStartIso),
      stayEndIso:
        currentHotel?.stayEndIso?.trim() || (city === "makkah" ? cityRange.makkahEndIso : cityRange.madinahEndIso),
    };
  };

  const buildHotelDraftFromAgreement = (agreement: GroupAgreementHotel): VisaHotelEditFormState => ({
    sourceDraftId: agreement.sourceDraftId?.trim() || undefined,
    hotelName: agreement.hotelName.trim(),
    agreementNumber: agreement.agreementNumber.trim(),
    pax: agreement.pax.toString(),
    status: agreement.status,
    stayStartIso: agreement.stayStartIso.trim(),
    stayEndIso: agreement.stayEndIso.trim(),
  });

  const buildRaudhahDraft = (): VisaRaudhahEditFormState => {
    return {
      appointments: (group?.visaSetup?.raudhahAppointments ?? [])
        .map((appointment, index) => ({
          id: appointment.id?.trim() || `${row.groupCode}-raudhah-${Date.now().toString(36)}-${index + 1}`,
          dateIso: appointment.dateIso?.trim() ?? "",
          status: appointment.status,
          tasrehPrinted: Boolean(appointment.tasrehPrinted),
        }))
        .filter((appointment) => appointment.dateIso.length > 0),
    };
  };

  const openVisaStatusModal = () => {
    setActiveModal("visa-status");
  };

  const openVisaTypeModal = () => {
    setActiveModal("visa-type");
  };

  const openPaymentStatusModal = () => {
    setActiveModal("payment-status");
  };

  const openSyarikahModal = () => {
    setActiveModal("syarikah");
  };

  const openHotelModal = (
    city: "makkah" | "madinah",
    mode: "add" | "edit",
    hotelId?: string,
    seed?: VisaHotelEditFormState,
    ownerGroupCode?: string,
  ) => {
    setAddingHotelCity(null);
    setHotelCityDraft(city);
    setHotelDraftMode(mode);
    setHotelDraftId(mode === "edit" ? (hotelId ?? null) : null);
    setHotelDraftSeed(seed ?? null);
    setHotelDraftOwnerGroupCode(ownerGroupCode ?? null);
    setActiveModal("hotel");
  };

  const openAgreementEditor = (
    city: "makkah" | "madinah",
    agreement: GroupAgreementHotel,
    isStoredAgreement: boolean,
  ) => {
    openHotelModal(city, "edit", isStoredAgreement ? agreement.id : undefined, buildHotelDraftFromAgreement(agreement), agreement.ownerGroupCode);
  };

  const openDeleteAgreementConfirm = (
    city: "makkah" | "madinah",
    agreement: GroupAgreementHotel,
    isStoredAgreement: boolean,
    draft?: HotelAgreementDraft,
  ) => {
    if (!isStoredAgreement) {
      return;
    }

    setDeleteAgreementDraft({ city, agreement, draft });
  };

  const openAddHotelInline = (city: "makkah" | "madinah") => {
    setActiveModal(null);
    setHotelDraftSeed(null);
    setAddingHotelCity(city);
    setDraftAssignFeedback(null);

    const groupArrival = group?.arrivalDate || row.departureIso || "";
    const groupReturn = group?.returnDate || row.returnIso || "";
    const existing = city === "makkah" ? makkahAgreements : madinahAgreements;
    const { start, end } = getUncoveredPeriod(city, groupArrival, groupReturn, existing);
    setCoverageStartIso(start);
    setCoverageEndIso(end);
  };

  const cancelAddHotelInline = () => {
    setAddingHotelCity(null);
  };

  const openRaudhahModal = () => {
    setActiveModal("raudhah");
  };

  const closeModal = () => {
    setActiveModal(null);
    setHotelDraftSeed(null);
    setHotelDraftOwnerGroupCode(null);
  };

  const handleOpenUnlinkModal = (g: GroupData) => setUnlinkingGroup(g);
  const handleCloseUnlinkModal = () => setUnlinkingGroup(null);
  const handleConfirmUnlink = () => {
    if (unlinkingGroup) {
      onSaveGroup({ ...unlinkingGroup, parentGroupId: null }, unlinkingGroup.code);
      setUnlinkingGroup(null);
    }
  };

  const openGroupEditModal = () => {
    if (!group) {
      return;
    }

    setIsGroupEditModalOpen(true);
  };

  const closeGroupEditModal = () => {
    setIsGroupEditModalOpen(false);
  };

  const openDeleteGroupModal = () => {
    if (!group) {
      return;
    }

    setIsDeleteGroupModalOpen(true);
  };

  const closeDeleteGroupModal = () => {
    setIsDeleteGroupModalOpen(false);
  };

  const confirmDeleteGroup = () => {
    setIsDeleteGroupModalOpen(false);
    onDeleteGroup(group?.code ?? row.groupCode);
  };

  const saveGroupEdit = ({
    code,
    name,
    pax,
    totalBuses,
    arrivalDate,
    returnDate,
    parentGroupId,
  }: {
    code: string;
    name: string;
    pax: number;
    totalBuses: number;
    arrivalDate: string;
    returnDate: string;
    parentGroupId?: string | null;
  }): { ok: true } | { ok: false; message: string } => {
    if (!group) {
      return { ok: false, message: "Group belum tersedia." };
    }

    const normalizedPax = Math.max(1, Math.floor(pax));
    const normalizedTotalBuses = resolveTotalBusCount(normalizedPax, totalBuses);
    const nextDurationDays = Math.max(
      1,
      Math.floor((Date.parse(returnDate) - Date.parse(arrivalDate)) / 86_400_000) + 1
    );

    const result = onSaveGroup(
      {
        ...group,
        code,
        name,
        pax: normalizedPax,
        totalBuses: normalizedTotalBuses,
        arrivalDate,
        returnDate,
        durationDays: nextDurationDays,
        parentGroupId,
      },
      group.code,
    );

    if (result.ok) {
      setIsGroupEditModalOpen(false);
    }

    return result;
  };

  const saveVisaStatus = (nextStatus: VisaStatus) => {
    onUpdateVisaStatus(row.groupCode, nextStatus);
    closeModal();
  };

  const saveVisaType = (nextType: "Visa Only" | "Visa+") => {
    onUpdateVisaType(row.groupCode, nextType);
    closeModal();
  };

  const savePaymentStatus = (nextValue: VisaPaymentStatus) => {
    onUpdatePaymentStatus(row.groupCode, nextValue);
    setPaymentStatus(nextValue);
    closeModal();
  };

  const saveSyarikah = (nextValue: string) => {
    onUpdateSyarikah(row.groupCode, nextValue);
    closeModal();
  };

  const saveHotel = (hotel: VisaHotelEditFormState) => {
    const targetGroupCode = hotelDraftOwnerGroupCode ?? activeGroupCode;
    onUpdateVisaHotel(
      targetGroupCode,
      hotelCityDraft,
      hotel,
      hotelDraftMode === "edit" ? (hotelDraftId ?? undefined) : undefined,
    );
    closeModal();
  };

  const saveRaudhah = (appointment: VisaRaudhahEditFormState) => {
    onUpdateRaudhahAppointment(row.groupCode, appointment);
    closeModal();
  };



  const assignAgreementDraft = async (
    draft: HotelAgreementDraft,
    selectedStart?: string,
    selectedEnd?: string,
  ) => {
    setAssigningAgreementDraftId(draft.id);
    setDraftAssignFeedback(null);
    try {
      await assignAgreementDraftInBackend({
        draftId: draft.id,
        groupCode: activeGroupCode,
        stayStartIso: selectedStart,
        stayEndIso: selectedEnd,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: groupQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all }),
      ]);
      setAddingHotelCity(null);
      setDraftAssignFeedback({
        tone: "success",
        message: `Agreement ${draft.agreementNumber} berhasil di-assign ke group ${activeGroupCode}.`,
      });
    } catch (error: unknown) {
      setDraftAssignFeedback({
        tone: "error",
        message: formatVisaMutationError(error, "Agreement belum berhasil di-assign."),
      });
    } finally {
      setAssigningAgreementDraftId(null);
    }
  };

  const clearRaudhah = () => {
    onClearRaudhahAppointment(row.groupCode);
    setIsClearRaudhahConfirmOpen(false);
    closeModal();
  };

  const deleteAgreement = async () => {
    if (!deleteAgreementDraft) {
      return;
    }

    if (!deleteAgreementDraft.draft) {
      const targetGroupCode = deleteAgreementDraft.agreement.ownerGroupCode ?? activeGroupCode;
      onDeleteVisaHotel(targetGroupCode, deleteAgreementDraft.city, deleteAgreementDraft.agreement.id);
      setDeleteAgreementDraft(null);
      return;
    }

    setUnassigningAgreementDraftId(deleteAgreementDraft.draft.id);
    setDraftAssignFeedback(null);
    try {
      await unassignAgreementDraftInBackend({
        draftId: deleteAgreementDraft.draft.id,
        groupCode: deleteAgreementDraft.agreement.ownerGroupCode ?? activeGroupCode,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: groupQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: agreementDraftQueryKeys.all }),
      ]);
      setDraftAssignFeedback({
        tone: "success",
        message: `Agreement ${deleteAgreementDraft.agreement.agreementNumber} berhasil dikembalikan ke Unassigned.`,
      });
    } catch (error: unknown) {
      setDraftAssignFeedback({
        tone: "error",
        message: formatVisaMutationError(error, "Agreement belum berhasil di-unassign dari group."),
      });
    } finally {
      setUnassigningAgreementDraftId(null);
      setDeleteAgreementDraft(null);
    }
  };

  const handleCopyRaudhahReminder = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(raudhahReminderTemplate);
      }
    } catch {
      // No-op fallback for browsers that block clipboard API.
    }

    setIsRaudhahTemplateCopied(true);
    if (raudhahCopyTimerRef.current !== null) {
      window.clearTimeout(raudhahCopyTimerRef.current);
    }

    raudhahCopyTimerRef.current = window.setTimeout(() => {
      setIsRaudhahTemplateCopied(false);
      raudhahCopyTimerRef.current = null;
    }, 1600);
  };

  const handleCopyWhatsapp = async () => {
    const text = generateWhatsappCopyText(operationalGroup ?? group ?? undefined, familyGroups);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // fallback
    }

    setIsWhatsappCopied(true);
    if (whatsappCopyTimerRef.current !== null) {
      window.clearTimeout(whatsappCopyTimerRef.current);
    }
    whatsappCopyTimerRef.current = window.setTimeout(() => {
      setIsWhatsappCopied(false);
      whatsappCopyTimerRef.current = null;
    }, 1600);
  };

  useEffect(() => {
    setPaymentStatus(row.paymentStatus);
  }, [row.id, row.paymentStatus]);

  useEffect(() => {
    if (!hasBlockingModal) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasBlockingModal]);

  useEffect(() => {
    if (!hasBlockingModal) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
        setUnlinkingGroup(null);
        setIsGroupEditModalOpen(false);
        setIsDeleteGroupModalOpen(false);
        setIsClearRaudhahConfirmOpen(false);
        setDeleteAgreementDraft(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasBlockingModal]);

  useEffect(() => {
    setAddingHotelCity(null);
    setHotelDraftSeed(null);
    setIsGroupEditModalOpen(false);
    setIsDeleteGroupModalOpen(false);
    setUnlinkingGroup(null);
    setDeleteAgreementDraft(null);
    setIsRaudhahTemplateCopied(false);
    setIsWhatsappCopied(false);
    setIsClearRaudhahConfirmOpen(false);
  }, [row.id]);

  useEffect(
    () => () => {
      if (raudhahCopyTimerRef.current !== null) {
        window.clearTimeout(raudhahCopyTimerRef.current);
        raudhahCopyTimerRef.current = null;
      }
      if (whatsappCopyTimerRef.current !== null) {
        window.clearTimeout(whatsappCopyTimerRef.current);
        whatsappCopyTimerRef.current = null;
      }
    },
    [],
  );

  const deleteAgreementCityLabel = deleteAgreementDraft?.city === "makkah" ? "Makkah" : "Madinah";
  const isUnassigningAgreement =
    deleteAgreementDraft?.draft !== undefined && unassigningAgreementDraftId === deleteAgreementDraft.draft.id;
  const deleteAgreementActionLabel = deleteAgreementDraft?.draft ? "Unassign Agreement" : "Delete Agreement";

  return (
    <div className="mx-auto max-w-7xl space-y-6 overflow-x-hidden px-3 pb-20 pt-4 sm:px-6 lg:px-8">
      <header>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary sm:w-auto sm:justify-start sm:py-1.5"
          onClick={onBack}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            arrow_back
          </span>
          <span className="sm:hidden">Back</span>
          <span className="hidden sm:inline">Back to Visa Tracking</span>
        </button>
      </header>

      {group?.parentGroupId && (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-800 flex items-center gap-3 shadow-xs">
          <span className="material-symbols-outlined text-base text-sky-700" aria-hidden="true">info</span>
          <div>
            <strong>Grup Operasional Terhubung</strong>
            <p className="mt-0.5 text-[11px] text-sky-600 font-medium">
              Grup ini mengikuti data operasional dari Group ({groups.find((g) => g.id === group.parentGroupId || g.code === group.parentGroupId)?.code}). Itinerary dan Musyrif diwarisi secara otomatis.
            </p>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200/70 bg-brand-neutral p-4 shadow-sm sm:p-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Visa Detail</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {row.groupCode}
            </h1>
            {familyGroups.length > 1 && (
              <span className={`inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-600 ${familyGroups.length > 2 ? 'text-[10px]' : 'text-xs'}`}>
                <span className="material-symbols-outlined text-sm text-slate-400" aria-hidden="true">link</span>
                <span>Terhubung:</span>
                {familyGroups.filter(g => g.code !== activeGroupCode).map((g, index) => (
                  <span key={g.code} className="inline-flex items-center gap-1">
                    {index > 0 && ", "}
                    <button
                      type="button"
                      onClick={() => setActiveGroupCode(g.code)}
                      className="font-bold text-slate-900 hover:underline"
                    >
                      {g.code}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenUnlinkModal(g)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition"
                      title="Pisahkan grup ini"
                    >
                      <span className="material-symbols-outlined text-[13px]" aria-hidden="true">link_off</span>
                    </button>
                  </span>
                ))}
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <p className="min-w-0 break-words">{group?.name ?? row.groupName}</p>
            <span className="inline-flex rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-2.5 py-1 text-xs font-bold leading-none text-brand-primary">
              <span className="sm:hidden">{totalPax} Pax</span>
              <span className="hidden sm:inline">{totalPax} Pax Total</span>
            </span>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 self-start md:w-auto">
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            onClick={openGroupEditModal}
            disabled={!group}
            aria-label={`Edit group info for ${row.groupCode}`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              edit
            </span>
            <span>Edit Group</span>
          </button>
          <button
            type="button"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-brand-tertiary/40 bg-brand-tertiary/10 px-3 py-2 text-sm font-semibold text-brand-tertiary transition hover:bg-brand-tertiary/15 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
            onClick={openDeleteGroupModal}
            disabled={!group}
            aria-label={`Delete group ${row.groupCode}`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              delete
            </span>
            <span>Delete Group</span>
          </button>
          <button
            type="button"
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition sm:flex-none ${
              isWhatsappCopied
                ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400"
                : "border-slate-300 bg-surface-container-lowest text-slate-700 hover:border-brand-primary hover:text-brand-primary"
            }`}
            onClick={handleCopyWhatsapp}
            aria-label={`Copy WhatsApp formatted details for ${row.groupCode}`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {isWhatsappCopied ? "check" : "content_copy"}
            </span>
            <span className="sm:hidden">{isWhatsappCopied ? "Copied" : "Copy WA"}</span>
            <span className="hidden sm:inline">{isWhatsappCopied ? "Copied" : "Copy WhatsApp"}</span>
          </button>
        </div>
      </section>

      {agreementIssues.length > 0 ? (
        <section
          className="rounded-2xl border border-tertiary-fixed/65 bg-tertiary-fixed/70 px-4 py-3 text-on-tertiary-fixed-variant shadow-sm"
          aria-label="Agreement setup status"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-lowest"
                aria-hidden="true"
              >
                <span className="material-symbols-outlined text-base">
                  link
                </span>
              </span>
              <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <h2 className="text-sm font-extrabold leading-tight">Agreement Needs Attention</h2>
                <span className="hidden sm:inline text-tertiary-fixed/40">|</span>
                <p className="text-xs font-medium leading-tight">{primaryAgreementMessage}</p>
                <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                  {agreementIssues.slice(0, 4).map((issue) => (
                    <span
                      key={issue.key}
                      className="rounded bg-surface-container-lowest/80 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide"
                      title={issue.message}
                    >
                      {issue.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {shouldShowLinkAgreementAction ? (
              <div className="flex flex-col gap-2 sm:flex-row lg:shrink-0">
                <Link
                  to={`/agreement-inbox?groupCode=${encodeURIComponent(row.groupCode)}`}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-on-tertiary-fixed-variant/20 bg-surface-container-lowest px-3 text-sm font-bold text-brand-primary transition hover:bg-surface-container-low"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    link
                  </span>
                  <span>Link Agreement</span>
                </Link>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Quick status">
        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visa Status</p>
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses(visaTone)}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{row.visaStatus}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit visa status"
            onClick={openVisaStatusModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>

        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Visa Type</p>
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses("success")}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{group?.visaSetup?.busStatus ?? "Visa Only"}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit visa type"
            onClick={openVisaTypeModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>

        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Status</p>
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses(paymentTone)}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{paymentStatus}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit payment status"
            onClick={openPaymentStatusModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>

        <article className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-surface-container-lowest p-3 sm:p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="sm:hidden">Raudhah</span>
              <span className="hidden sm:inline">Raudhah Appointment</span>
            </p>
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm font-bold leading-none ${getToneClasses(raudhahTone)}`}
            >
              <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              <strong>{raudhahStatusText}</strong>
            </div>
          </div>
          <button
            type="button"
            className={`${getIconButtonClasses()} shrink-0`}
            aria-label="Edit Raudhah appointment"
            onClick={openRaudhahModal}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              edit
            </span>
          </button>
        </article>
      </section>

      {draftAssignFeedback ? (
        <section
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
            draftAssignFeedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="material-symbols-outlined mt-0.5 text-base" aria-hidden="true">
            {draftAssignFeedback.tone === "success" ? "check_circle" : "warning"}
          </span>
          <p className="font-semibold">{draftAssignFeedback.message}</p>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
                mosque
              </span>
              <h2 className="text-xl font-bold text-slate-900">Makkah</h2>
            </div>

            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-2 text-xs font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary sm:w-auto sm:justify-start sm:py-1.5"
              onClick={() => openAddHotelInline("makkah")}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                add
              </span>
              <span>Add Hotel</span>
            </button>
          </div>

          <div className="mt-4 space-y-3">
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
                <details key={agreement.id} className="serene-accordion">
                  <summary className="serene-accordion-summary flex-col">
                    <div className="flex w-full items-start gap-3">
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900">
                          {agreement.hotelName.trim() || `Hotel ${index + 1}`}
                        </h3>
                        {agreement.ownerGroupCode && familyGroups.length > 1 && agreement.ownerGroupCode !== activeGroupCode && (
                          <span className="inline-flex rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            Milik: {agreement.ownerGroupCode}
                          </span>
                        )}
                        <span
                          className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${getAgreementStatusClasses(
                            agreement.status === "Approved",
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
              drafts={agreementDraftsQuery.data ?? []}
              group={group}
              isLoading={agreementDraftsQuery.isLoading}
              isError={agreementDraftsQuery.isError}
              assigningDraftId={assigningAgreementDraftId}
              onAssignDraft={(draft, selectedStart, selectedEnd) => void assignAgreementDraft(draft, selectedStart, selectedEnd)}
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
            className={`mt-4 inline-flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium ${getCitySummaryClasses(makkahMissing > 0)}`}
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

        <article className="rounded-3xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
                apartment
              </span>
              <h2 className="text-xl font-bold text-slate-900">Madinah</h2>
            </div>

            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-2 text-xs font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary sm:w-auto sm:justify-start sm:py-1.5"
              onClick={() => openAddHotelInline("madinah")}
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                add
              </span>
              <span>Add Hotel</span>
            </button>
          </div>

          <div className="mt-4 space-y-3">
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
                <details key={agreement.id} className="serene-accordion">
                  <summary className="serene-accordion-summary flex-col">
                    <div className="flex w-full items-start gap-3">
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900">
                          {agreement.hotelName.trim() || `Hotel ${index + 1}`}
                        </h3>
                        {agreement.ownerGroupCode && familyGroups.length > 1 && agreement.ownerGroupCode !== activeGroupCode && (
                          <span className="inline-flex rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            Milik: {agreement.ownerGroupCode}
                          </span>
                        )}
                        <span
                          className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold leading-none ${getAgreementStatusClasses(
                            agreement.status === "Approved",
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
              drafts={agreementDraftsQuery.data ?? []}
              group={group}
              isLoading={agreementDraftsQuery.isLoading}
              isError={agreementDraftsQuery.isError}
              assigningDraftId={assigningAgreementDraftId}
              onAssignDraft={(draft, selectedStart, selectedEnd) => void assignAgreementDraft(draft, selectedStart, selectedEnd)}
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
            className={`mt-4 inline-flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium ${getCitySummaryClasses(madinahMissing > 0)}`}
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

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
                calendar_today
              </span>
              <h3 className="text-lg font-bold text-slate-900">Raudhah</h3>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-1.5 text-xs font-bold leading-none text-slate-700 transition hover:border-brand-primary hover:text-brand-primary"
              onClick={handleCopyRaudhahReminder}
              aria-label={`Copy Raudhah reminder template for ${row.groupCode}`}
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                {isRaudhahTemplateCopied ? "check" : "content_copy"}
              </span>
              <span>{isRaudhahTemplateCopied ? "Copied" : "Copy"}</span>
            </button>
            {isRaudhahTemplateCopied ? (
              <p className="sr-only" role="status" aria-live="polite">
                Raudhah reminder copied.
              </p>
            ) : null}
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Raudhah Dates</p>
            {hasRaudhahDates ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {raudhahAppointments.map((appointment, index) => (
                  <div
                    key={`${appointment.dateLabel}-${appointment.status}-${index}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs"
                  >
                    <span className="font-semibold text-slate-700">{appointment.dateLabel}</span>
                    <span
                      className={`inline-flex rounded-lg border px-1.5 py-0.5 text-[10px] font-bold leading-none ${getRaudhahStatusBadgeClasses(
                        appointment.status,
                      )}`}
                    >
                      {appointment.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <strong className={`block text-base font-semibold ${getToneTextClass(raudhahTone)}`}>Not Set</strong>
            )}
            <small className="mt-2 block text-xs text-slate-500">
              <span className="sm:hidden">
                Status: {raudhahStatusText} - {raudhahSecondaryTextMobile}
              </span>
              <span className="hidden sm:inline">
                Status: {raudhahStatusText} - {raudhahSecondaryText}
              </span>
            </small>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-xs font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15"
              onClick={openRaudhahModal}
            >
              Edit
            </button>
            <button
              type="button"
              className="inline-flex rounded-lg border border-slate-300 bg-surface-container-lowest px-3 py-1.5 text-xs font-bold leading-none text-slate-700 transition hover:border-slate-400"
              onClick={() => setIsClearRaudhahConfirmOpen(true)}
            >
              Clear
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
              business
            </span>
            <h3 className="text-lg font-bold text-slate-900">Syarikah</h3>
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Provider Agency</p>
            <strong className="block text-base font-semibold text-slate-900">{providerName}</strong>
            <small className="text-xs text-slate-500">
              <span className="sm:hidden">Package: {row.packageName}</span>
              <span className="hidden sm:inline">Assigned for {row.packageName} package</span>
            </small>
          </div>

          <button
            type="button"
            className="mt-4 inline-flex rounded-lg border border-brand-primary/30 bg-brand-primary/10 px-3 py-1.5 text-xs font-bold leading-none text-brand-primary transition hover:bg-brand-primary/15"
            onClick={openSyarikahModal}
          >
            <span className="sm:hidden">Edit</span>
            <span className="hidden sm:inline">Edit Syarikah</span>
          </button>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-brand-primary" aria-hidden="true">
              payments
            </span>
            <h3 className="text-lg font-bold text-slate-900">Payment</h3>
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <strong className={`block text-base font-semibold ${getToneTextClass(paymentTone)}`}>
              {paymentStatus}
            </strong>
            <small className="text-xs text-slate-500">
              <span className="sm:hidden">{paymentStatus === "Paid" ? "Payment complete" : "Need follow-up"}</span>
              <span className="hidden sm:inline">
                {paymentStatus === "Paid" ? "Payment is complete" : "Payment still requires follow-up"}
              </span>
            </small>
          </div>

          <button
            type="button"
            className="mt-4 inline-flex rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-bold leading-none text-on-primary transition hover:bg-primary-container"
            onClick={() => {
              const nextStatus = paymentStatus === "Paid" ? "Unpaid" : "Paid";
              setPaymentStatus(nextStatus);
              onUpdatePaymentStatus(row.groupCode, nextStatus);
            }}
          >
            <span className="sm:hidden">{paymentStatus === "Paid" ? "Mark Unpaid" : "Mark Paid"}</span>
            <span className="hidden sm:inline">{paymentStatus === "Paid" ? "Mark as Unpaid" : "Toggle to Paid"}</span>
          </button>
        </article>
      </section>

      {isGroupEditModalOpen && group ? (
        <Suspense fallback={<VisaDetailModalFallback />}>
          <LazyGroupEditModal
            groupCode={group.code}
            groupName={group.name}
            groupPax={group.pax}
            requiredBusCount={requiredBusCount}
            arrivalDate={group.arrivalDate ?? ""}
            returnDate={group.returnDate ?? ""}
            parentGroupId={group.parentGroupId}
            groups={groups}
            onClose={closeGroupEditModal}
            onSave={saveGroupEdit}
          />
        </Suspense>
      ) : null}

      {isDeleteGroupModalOpen && group ? (
        <Suspense fallback={<VisaDetailModalFallback />}>
          <LazyDeleteGroupModal
            groupCode={group.code}
            groupName={group.name}
            onClose={closeDeleteGroupModal}
            onConfirm={confirmDeleteGroup}
          />
        </Suspense>
      ) : null}

      {activeModal ? (
        <Suspense fallback={<VisaDetailModalFallback />}>
          {activeModal === "visa-status" ? (
            <LazyVisaStatusModal initialValue={row.visaStatus} onClose={closeModal} onSave={saveVisaStatus} />
          ) : null}

          {activeModal === "visa-type" ? (
            <LazyVisaTypeModal initialValue={(group?.visaSetup?.busStatus as "Visa Only" | "Visa+") ?? "Visa Only"} onClose={closeModal} onSave={saveVisaType} />
          ) : null}

          {activeModal === "payment-status" ? (
            <LazyPaymentStatusModal initialValue={paymentStatus} onClose={closeModal} onSave={savePaymentStatus} />
          ) : null}

          {activeModal === "syarikah" ? (
            <LazySyarikahModal initialValue={syarikahValue} onClose={closeModal} onSave={saveSyarikah} />
          ) : null}

          {activeModal === "hotel" ? (
            <LazyVisaHotelModal
              city={hotelCityDraft}
              mode={hotelDraftMode}
              initialValue={
                hotelDraftSeed ?? buildHotelDraft(hotelCityDraft, hotelDraftMode, hotelDraftId ?? undefined)
              }
              onClose={closeModal}
              onSave={saveHotel}
            />
          ) : null}

          {activeModal === "raudhah" ? (
            <LazyVisaRaudhahModal
              initialValue={buildRaudhahDraft()}
              appointmentIdPrefix={row.groupCode}
              defaultAppointmentDateIso={row.departureIso}
              onClose={closeModal}
              onSave={saveRaudhah}
            />
          ) : null}
        </Suspense>
      ) : null}

      {unlinkingGroup ? (
        <Suspense fallback={<VisaDetailModalFallback />}>
          <LazyUnlinkGroupConfirmModal
            groupCode={unlinkingGroup.code}
            onClose={handleCloseUnlinkModal}
            onConfirm={handleConfirmUnlink}
          />
        </Suspense>
      ) : null}

      {deleteAgreementDraft ? (
        <div
          ref={deleteAgreementDialogRef}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-agreement-title"
          aria-describedby="delete-agreement-description"
          tabIndex={-1}
          onClick={() => setDeleteAgreementDraft(null)}
        >
          <section
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-surface-container-lowest p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-full bg-rose-100 p-2 text-rose-700" aria-hidden="true">
                warning
              </span>
              <div className="min-w-0">
                <h3 id="delete-agreement-title" className="text-lg font-extrabold text-slate-900">
                  {deleteAgreementDraft.draft ? "Unassign" : "Delete"} {deleteAgreementCityLabel} Agreement?
                </h3>
                <p id="delete-agreement-description" className="mt-1 text-sm leading-relaxed text-slate-600">
                  Agreement <strong>{deleteAgreementDraft.agreement.agreementNumber}</strong> untuk hotel{" "}
                  <strong>{deleteAgreementDraft.agreement.hotelName}</strong>{" "}
                  {deleteAgreementDraft.draft ? (
                    <>
                      akan dilepas dari group <strong>{row.groupCode}</strong> dan dikembalikan ke Agreement Inbox
                      Unassigned.
                    </>
                  ) : (
                    <>
                      akan dihapus dari group <strong>{row.groupCode}</strong>.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-surface-container-high"
                onClick={() => setDeleteAgreementDraft(null)}
              >
                Batal
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-rose-700"
                onClick={() => void deleteAgreement()}
                disabled={isUnassigningAgreement}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {isUnassigningAgreement ? "sync" : deleteAgreementDraft.draft ? "link_off" : "delete"}
                </span>
                <span>{isUnassigningAgreement ? "Unassigning..." : deleteAgreementActionLabel}</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isClearRaudhahConfirmOpen ? (
        <div
          ref={clearRaudhahDialogRef}
          className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-raudhah-title"
          aria-describedby="clear-raudhah-description"
          tabIndex={-1}
          onClick={() => setIsClearRaudhahConfirmOpen(false)}
        >
          <section
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-surface-container-lowest p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined rounded-full bg-rose-100 p-2 text-rose-700" aria-hidden="true">
                warning
              </span>
              <div className="min-w-0">
                <h3 id="clear-raudhah-title" className="text-lg font-extrabold text-slate-900">
                  Clear Raudhah Dates?
                </h3>
                <p id="clear-raudhah-description" className="mt-1 text-sm leading-relaxed text-slate-600">
                  Semua tanggal appointment Raudhah untuk group <strong>{row.groupCode}</strong> akan dihapus. Tindakan
                  ini tidak bisa dibatalkan.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-surface-container-lowest px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-surface-container-high"
                onClick={() => setIsClearRaudhahConfirmOpen(false)}
              >
                Batal
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-on-primary transition hover:bg-rose-700"
                onClick={clearRaudhah}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  delete
                </span>
                <span>Ya, Clear</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
