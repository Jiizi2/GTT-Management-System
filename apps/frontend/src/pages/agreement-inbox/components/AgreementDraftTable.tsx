import { useEffect, useState } from "react";
import { Button } from "../../../components/button";
import { SereneSelect } from "../../../components/serene-select";
import { Badge, type BadgeStatus } from "../../../components/badge";
import type { HotelAgreementDraft, AgreementApprovalStatus } from "../../../shared/app-domain";
import { formatVisaShortDate } from "../../../shared/app-domain";

const APPROVAL_STATUSES: AgreementApprovalStatus[] = ["Waiting for Approval", "Approved", "Rejected"];

function approvalPillClasses(status: AgreementApprovalStatus): string {
  if (status === "Approved") return "border-emerald-200 bg-emerald-100 text-emerald-800";
  if (status === "Rejected") return "border-rose-200 bg-rose-100 text-rose-800";
  return "border-amber-200 bg-amber-100 text-amber-800";
}

function assignmentBadgeStatus(draft: HotelAgreementDraft): BadgeStatus {
  if (draft.assignmentStatus === "Assigned") return "success";
  if (draft.assignmentStatus === "Partially Assigned") return "info";
  return "warning";
}

function cityLabel(city: HotelAgreementDraft["city"]): string {
  return city === "makkah" ? "Makkah" : "Madinah";
}

function cityIcon(city: HotelAgreementDraft["city"]): "location_on" | "mosque" {
  return city === "makkah" ? "location_on" : "mosque";
}

function availablePax(draft: HotelAgreementDraft): number {
  return Math.max(0, draft.remainingPax ?? draft.pax);
}

function StatusSelect({ draft, onChange, disabled }: { draft: HotelAgreementDraft; onChange: (draft: HotelAgreementDraft, next: AgreementApprovalStatus) => void; disabled: boolean }) {
  return (
    <SereneSelect className={`serene-select-pill min-h-11 w-full min-w-0 max-w-[140px] xl:min-h-9 xl:min-w-[140px] ${approvalPillClasses(draft.status)}`} value={draft.status} disabled={disabled} onChange={(event) => onChange(draft, event.target.value as AgreementApprovalStatus)} aria-label={`Ubah status agreement ${draft.agreementNumber}`}>
      {APPROVAL_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
    </SereneSelect>
  );
}

function RowActions({ draft, expanded, onToggle, onEdit, onDelete, deletePending }: { draft: HotelAgreementDraft; expanded: boolean; onToggle: () => void; onEdit: (draft: HotelAgreementDraft) => void; onDelete: (draft: HotelAgreementDraft) => void; deletePending: boolean }) {
  const isAssigned = draft.assignmentStatus === "Assigned" || draft.assignmentStatus === "Partially Assigned";
  const iconButtonClass = "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 xl:h-9 xl:w-9";
  return (
    <div className="flex w-full items-center justify-end gap-1">
      <button type="button" className={iconButtonClass} aria-label={`Edit agreement ${draft.agreementNumber}`} onClick={() => onEdit(draft)}><span className="material-symbols-outlined text-lg" aria-hidden="true">edit</span></button>
      <details className="group relative">
        <summary className={`${iconButtonClass} cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden`} aria-label={`Tindakan lain untuk agreement ${draft.agreementNumber}`}>
          <span className="material-symbols-outlined select-none text-lg" aria-hidden="true">more_vert</span>
        </summary>
        <div className="absolute right-0 top-10 z-20 min-w-36 rounded-xl border border-outline-variant/35 bg-surface-container-lowest p-1.5 shadow-float">
          <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-35" title={isAssigned ? "Lepas agreement dari group sebelum menghapus." : undefined} onClick={() => onDelete(draft)} disabled={deletePending || isAssigned}>
            <span className="material-symbols-outlined text-base" aria-hidden="true">delete</span>Delete draft
          </button>
        </div>
      </details>
      <button type="button" className={iconButtonClass} aria-label={expanded ? `Tutup detail ${draft.agreementNumber}` : `Buka detail ${draft.agreementNumber}`} aria-expanded={expanded} onClick={onToggle}>
        <span className={`material-symbols-outlined text-xl transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} aria-hidden="true">expand_more</span>
      </button>
    </div>
  );
}

function Capacity({ draft }: { draft: HotelAgreementDraft }) {
  const remaining = availablePax(draft);
  const percent = draft.pax > 0 ? Math.min(100, (remaining / draft.pax) * 100) : 0;
  return (
    <div className="min-w-[118px]">
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold text-on-surface-variant"><span>Pax</span><span className="tabular-nums text-on-surface">{remaining}/{draft.pax}</span></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200" aria-label={`${remaining} dari ${draft.pax} pax tersedia`} role="img"><div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function ExpandedGroups({ draft, linkedGroupCode, assignmentGroupCode, onAssignmentGroupCodeChange, onAssignToGroup, onUnassignFromGroup, assignPending, unassignPending, isLastDraft }: { draft: HotelAgreementDraft; linkedGroupCode: string; assignmentGroupCode: string; onAssignmentGroupCodeChange: (draftId: string, groupCode: string) => void; onAssignToGroup: (draft: HotelAgreementDraft) => void; onUnassignFromGroup: (draft: HotelAgreementDraft, groupCode?: string) => void; assignPending: boolean; unassignPending: boolean; isLastDraft: boolean }) {
  const links = draft.assignedGroups ?? [];
  const canAssign = draft.status !== "Rejected" && availablePax(draft) > 0;
  return (
    <div className={`rounded-b-2xl border-t border-outline-variant/25 bg-surface-container-low/65 px-4 py-3 sm:px-5 lg:rounded-none ${isLastDraft ? "lg:rounded-br-[15px] lg:rounded-bl-[15px]" : ""}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-extrabold text-on-surface"><span className="material-symbols-outlined text-lg" aria-hidden="true">groups</span>Linked Groups ({links.length})</p>
        </div>
        {canAssign ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <label className="sr-only" htmlFor={`assign-${draft.id}`}>Group number</label>
            <input id={`assign-${draft.id}`} className="serene-input serene-input-sm min-w-0 sm:w-48" placeholder={linkedGroupCode || "Group number"} value={assignmentGroupCode} onChange={(event) => onAssignmentGroupCodeChange(draft.id, event.target.value)} />
            <Button variant="secondary" size="sm" className="inline-flex shrink-0 items-center gap-1.5" onClick={() => onAssignToGroup(draft)} disabled={assignPending}><span className="material-symbols-outlined text-base" aria-hidden="true">add_link</span><span>{assignPending ? "Linking..." : "Link to Group"}</span></Button>
          </div>
        ) : null}
      </div>
      {links.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {links.map((link) => (
            <div key={link.groupCode} className="flex items-center justify-between gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-3 py-2.5">
              <div className="min-w-0"><p className="truncate text-sm font-extrabold text-on-surface">{link.groupCode}</p><p className="text-xs font-semibold text-on-surface-variant">{link.pax} Pax allocated</p></div>
              <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-on-surface-variant transition hover:bg-amber-50 hover:text-amber-800 disabled:opacity-40 xl:h-9 xl:w-9" onClick={() => onUnassignFromGroup(draft, link.groupCode)} disabled={unassignPending} aria-label={`Lepas ${draft.agreementNumber} dari group ${link.groupCode}`}><span className="material-symbols-outlined text-lg" aria-hidden="true">link_off</span></button>
            </div>
          ))}
        </div>
      ) : <p className="mt-3 rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-lowest px-3 py-2.5 text-sm font-semibold text-on-surface-variant">Belum terhubung ke group.</p>}
      {draft.status === "Rejected" ? <p className="mt-3 text-xs font-semibold text-rose-700">Draft ditolak. Perbarui nomor agreement sebelum menghubungkannya ke group.</p> : null}
    </div>
  );
}

export function AgreementDraftTable({ drafts, linkedGroupCode, assignmentGroupCodes, onAssignmentGroupCodeChange, onAssignToGroup, onUnassignFromGroup, onStartEdit, onDeleteRequest, onStatusChange, statusChangePending, deleteDraftMutationPending, assignDraftMutationPending, unassignDraftMutationPending }: { drafts: HotelAgreementDraft[]; linkedGroupCode: string; assignmentGroupCodes: Record<string, string>; onAssignmentGroupCodeChange: (draftId: string, groupCode: string) => void; onAssignToGroup: (draft: HotelAgreementDraft) => void; onUnassignFromGroup: (draft: HotelAgreementDraft, groupCode?: string) => void; onStartEdit: (draft: HotelAgreementDraft) => void; onDeleteRequest: (draft: HotelAgreementDraft) => void; onStatusChange: (draft: HotelAgreementDraft, next: AgreementApprovalStatus) => void; statusChangePending: boolean; deleteDraftMutationPending: boolean; assignDraftMutationPending: boolean; unassignDraftMutationPending: boolean }) {
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);

  useEffect(() => {
    if (expandedDraftId && !drafts.some((draft) => draft.id === expandedDraftId)) {
      setExpandedDraftId(null);
    }
  }, [drafts, expandedDraftId]);

  if (drafts.length === 0) {
    return <div className="rounded-2xl border border-outline-variant/35 bg-surface-container-lowest px-5 py-14 text-center shadow-sm lg:rounded-none lg:border-0 lg:shadow-none"><span className="material-symbols-outlined text-4xl text-slate-400" aria-hidden="true">inventory_2</span><p className="mt-2 text-base font-extrabold text-on-surface">Belum ada agreement</p><p className="mt-1 text-sm text-on-surface-variant">Buat draft baru atau ubah filter pencarian.</p></div>;
  }

  return (
    <div className="grid gap-3 rounded-2xl lg:block lg:border lg:border-outline-variant/35 lg:bg-surface-container-lowest lg:shadow-sm">
      {drafts.map((draft, index) => {
        const expanded = expandedDraftId === draft.id;
        const isFirstDraft = index === 0;
        const isLastDraft = index === drafts.length - 1;
        return (
          <article key={draft.id} className={`rounded-2xl border border-outline-variant/35 bg-surface-container-lowest shadow-sm lg:rounded-none lg:border-x-0 lg:border-t-0 lg:border-b-outline-variant/25 lg:shadow-none lg:last:border-b-0 ${isFirstDraft ? "lg:rounded-tl-2xl lg:rounded-tr-2xl" : ""} ${isLastDraft && !expanded ? "lg:rounded-br-2xl lg:rounded-bl-2xl" : ""}`}>
            <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-4 transition-colors sm:px-5 xl:grid-cols-[minmax(190px,1.45fr)_minmax(125px,.85fr)_minmax(150px,1fr)_minmax(120px,.78fr)_minmax(145px,1fr)_minmax(110px,.78fr)_112px] xl:items-center ${expanded ? "bg-primary/[0.035]" : "hover:bg-primary/[0.025]"} ${isFirstDraft ? "lg:rounded-tl-[15px] lg:rounded-tr-[15px]" : ""} ${isLastDraft && !expanded ? "lg:rounded-br-[15px] lg:rounded-bl-[15px]" : ""}`}>
              <div className="col-span-2 flex min-w-0 items-center gap-3 xl:col-span-1">
                <span className="material-symbols-outlined grid h-8 w-8 shrink-0 place-items-center text-xl leading-none text-primary" aria-hidden="true">{cityIcon(draft.city)}</span>
                <div className="min-w-0"><p className="text-sm font-extrabold text-on-surface">{cityLabel(draft.city)}</p><p className="truncate text-sm font-medium text-on-surface-variant">{draft.hotelName}</p></div>
              </div>
              <div className="min-w-0"><p className="text-[11px] font-semibold text-on-surface-variant">Agreement No.</p><p className="mt-1 truncate text-sm font-bold tabular-nums text-on-surface">{draft.agreementNumber}</p></div>
              <div><p className="text-[11px] font-semibold text-on-surface-variant">Stay Period</p><p className="mt-1 whitespace-nowrap text-sm font-bold text-on-surface">{formatVisaShortDate(draft.stayStartIso)} → {formatVisaShortDate(draft.stayEndIso)}</p></div>
              <div className="col-span-2 xl:col-span-1"><Capacity draft={draft} /></div>
              <div><p className="mb-1 text-[11px] font-semibold text-on-surface-variant">Status</p><StatusSelect draft={draft} onChange={onStatusChange} disabled={statusChangePending} /></div>
              <div><p className="mb-1 text-[11px] font-semibold text-on-surface-variant">Assignment</p><Badge status={assignmentBadgeStatus(draft)}>{draft.assignmentStatus}</Badge></div>
              <div className="col-span-2 mt-1 border-t border-outline-variant/25 pt-2 xl:col-span-1 xl:col-start-7 xl:row-start-1 xl:mt-0 xl:border-0 xl:pt-0"><RowActions draft={draft} expanded={expanded} onToggle={() => setExpandedDraftId(expanded ? null : draft.id)} onEdit={onStartEdit} onDelete={onDeleteRequest} deletePending={deleteDraftMutationPending} /></div>
            </div>
            {expanded ? <ExpandedGroups draft={draft} linkedGroupCode={linkedGroupCode} assignmentGroupCode={assignmentGroupCodes[draft.id] ?? ""} onAssignmentGroupCodeChange={onAssignmentGroupCodeChange} onAssignToGroup={onAssignToGroup} onUnassignFromGroup={onUnassignFromGroup} assignPending={assignDraftMutationPending} unassignPending={unassignDraftMutationPending} isLastDraft={isLastDraft} /> : null}
          </article>
        );
      })}
    </div>
  );
}
