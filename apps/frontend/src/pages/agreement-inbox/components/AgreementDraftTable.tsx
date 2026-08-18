import { useState } from "react";
import { Button } from "../../../components/button";
import { DatePickerInput } from "../../../components/date-time-pickers";
import { SereneSelect } from "../../../components/serene-select";
import { Badge, type BadgeStatus } from "../../../components/badge";
import { useAgentsQuery } from "../../../hooks/use-agents-backend";
import type {
  HotelAgreementDraft,
  HotelAgreementDraftFormState,
  AgreementApprovalStatus,
} from "../../../shared/app-domain";
import { formatVisaShortDate } from "../../../shared/app-domain";
import { createDefaultDraftForm, draftSchema } from "../hooks/use-agreement-inbox";

const APPROVAL_STATUSES: AgreementApprovalStatus[] = ["Waiting for Approval", "Approved", "Rejected"];

// Muted pill palette, matching the visa-tracking status selects
// (getAgreementApprovalClasses), extended with a Rejected tone.
function approvalPillClasses(status: AgreementApprovalStatus): string {
  if (status === "Approved") {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }
  if (status === "Rejected") {
    return "border-rose-200 bg-rose-100 text-rose-800";
  }
  return "border-amber-200 bg-amber-100 text-amber-800";
}

function assignmentBadgeStatus(draft: HotelAgreementDraft): BadgeStatus {
  if (draft.assignmentStatus === "Assigned") {
    return "success";
  }
  if (draft.assignmentStatus === "Partially Assigned") {
    return "info";
  }
  return "warning";
}

// Differentiate the two cities by icon shape (monochrome), not colour.
function cityIcon(city: HotelAgreementDraft["city"]): string {
  return city === "makkah" ? "location_city" : "mosque";
}

function paxLabel(draft: HotelAgreementDraft): string {
  return draft.remainingPax !== undefined ? `${draft.remainingPax}/${draft.pax}` : `${draft.pax}`;
}

function cityLabel(city: HotelAgreementDraft["city"]): string {
  return city === "makkah" ? "Makkah" : "Madinah";
}

function StatusSelect({
  draft,
  onChange,
  disabled,
}: {
  draft: HotelAgreementDraft;
  onChange: (draft: HotelAgreementDraft, next: AgreementApprovalStatus) => void;
  disabled: boolean;
}) {
  return (
    <SereneSelect
      className={`serene-select-pill w-full ${approvalPillClasses(draft.status)}`}
      value={draft.status}
      disabled={disabled}
      onChange={(event) => onChange(draft, event.target.value as AgreementApprovalStatus)}
      aria-label={`Ubah status agreement ${draft.agreementNumber}`}
    >
      {APPROVAL_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </SereneSelect>
  );
}

function RowActions({
  draft,
  onEdit,
  onDelete,
  deletePending,
}: {
  draft: HotelAgreementDraft;
  onEdit: (draft: HotelAgreementDraft) => void;
  onDelete: (draft: HotelAgreementDraft) => void;
  deletePending: boolean;
}) {
  const isAssigned = draft.assignmentStatus === "Assigned" || draft.assignmentStatus === "Partially Assigned";
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-surface-container-high hover:text-slate-900"
        aria-label={`Edit agreement ${draft.agreementNumber}`}
        onClick={() => onEdit(draft)}
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          edit
        </span>
      </button>
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 disabled:opacity-40"
        aria-label={`Hapus agreement ${draft.agreementNumber}`}
        title={isAssigned ? "Lepas agreement dari group lewat visa detail sebelum menghapus." : undefined}
        onClick={() => onDelete(draft)}
        disabled={deletePending || isAssigned}
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          delete
        </span>
      </button>
    </div>
  );
}

function InlineNewRow({
  onCancel,
  onCreate,
  isSaving,
}: {
  onCancel: () => void;
  onCreate: (values: HotelAgreementDraftFormState) => Promise<boolean>;
  isSaving: boolean;
}) {
  const agentsQuery = useAgentsQuery();
  const [values, setValues] = useState<HotelAgreementDraftFormState>(createDefaultDraftForm);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<HotelAgreementDraftFormState>) => setValues((current) => ({ ...current, ...patch }));

  const handleSave = async () => {
    const parsed = draftSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Periksa kembali isian baris.");
      return;
    }
    setError(null);
    const ok = await onCreate(values);
    if (ok) {
      onCancel();
    }
  };

  const fieldClass = "serene-input serene-input-sm h-9 w-full";
  const selectClass = "serene-select h-9 w-full text-xs";
  const cellClass = "px-2 pb-2.5 pt-1 align-top";

  return (
    <>
      {/* New-entry header: label on the left, actions on the right */}
      <tr className="bg-brand-primary/[0.06]">
        <td colSpan={10} className="px-3 pt-2.5 pb-1">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-brand-primary">
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                add_circle
              </span>
              Agreement baru
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onCancel} disabled={isSaving}>
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="inline-flex items-center gap-1.5"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {isSaving ? "sync" : "check"}
                </span>
                <span>{isSaving ? "Menyimpan..." : "Simpan"}</span>
              </Button>
            </div>
          </div>
        </td>
      </tr>
      {/* New-entry fields */}
      <tr className="bg-brand-primary/[0.06]">
        <td className={cellClass}>
          <SereneSelect
            className={selectClass}
            value={values.city}
            onChange={(event) => set({ city: event.target.value as HotelAgreementDraftFormState["city"] })}
            aria-label="City"
          >
            <option value="makkah">Makkah</option>
            <option value="madinah">Madinah</option>
          </SereneSelect>
        </td>
        <td className={cellClass}>
          <SereneSelect
            className={selectClass}
            value={values.agentId}
            onChange={(event) => set({ agentId: event.target.value })}
            aria-label="Agent"
          >
            <option value="" disabled>
              Pilih agent
            </option>
            {(agentsQuery.data ?? [])
              .filter((agent) => agent.status === "ACTIVE")
              .map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
          </SereneSelect>
        </td>
        <td className={cellClass}>
          <input
            className={fieldClass}
            placeholder="Group name"
            value={values.groupName}
            onChange={(event) => set({ groupName: event.target.value })}
            aria-label="Group name"
          />
        </td>
        <td className={cellClass}>
          <input
            className={fieldClass}
            placeholder="Hotel"
            value={values.hotelName}
            onChange={(event) => set({ hotelName: event.target.value })}
            aria-label="Hotel name"
          />
        </td>
        <td className={cellClass}>
          <input
            className={fieldClass}
            placeholder="Agreement no"
            value={values.agreementNumber}
            onChange={(event) => set({ agreementNumber: event.target.value })}
            aria-label="Agreement number"
          />
        </td>
        <td className={cellClass}>
          <input
            type="number"
            min={1}
            className={fieldClass}
            value={values.pax}
            onChange={(event) => set({ pax: event.target.value })}
            aria-label="Pax"
          />
        </td>
        <td className={cellClass}>
          <SereneSelect
            className={selectClass}
            value={values.status}
            onChange={(event) => set({ status: event.target.value as AgreementApprovalStatus })}
            aria-label="Status"
          >
            {APPROVAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </SereneSelect>
        </td>
        <td className={cellClass} colSpan={3}>
          <div className="grid grid-cols-2 gap-2">
            <DatePickerInput
              id="inline-stay-start"
              inputClassName={fieldClass}
              value={values.stayStartIso}
              onChange={(next) => set({ stayStartIso: next })}
              placeholder="Check-in"
            />
            <DatePickerInput
              id="inline-stay-end"
              inputClassName={fieldClass}
              value={values.stayEndIso}
              onChange={(next) => set({ stayEndIso: next })}
              placeholder="Check-out"
            />
          </div>
        </td>
      </tr>
      {error ? (
        <tr className="bg-brand-primary/[0.06]">
          <td colSpan={10} className="px-3 pb-2.5 pt-0">
            <p className="flex items-center gap-1 text-xs font-semibold text-rose-600">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">
                error
              </span>
              {error}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function AgreementDraftTable({
  drafts,
  onStartEdit,
  onDeleteRequest,
  onStatusChange,
  onCreateInline,
  statusChangePending,
  deleteDraftMutationPending,
  isSaving,
}: {
  drafts: HotelAgreementDraft[];
  onStartEdit: (draft: HotelAgreementDraft) => void;
  onDeleteRequest: (draft: HotelAgreementDraft) => void;
  onStatusChange: (draft: HotelAgreementDraft, next: AgreementApprovalStatus) => void;
  onCreateInline: (values: HotelAgreementDraftFormState) => Promise<boolean>;
  statusChangePending: boolean;
  deleteDraftMutationPending: boolean;
  isSaving: boolean;
}) {
  const [isAddingRow, setIsAddingRow] = useState(false);

  return (
    <div className="serene-table-shell">
      {/* Mobile + tablet: compact list rows (spreadsheet table needs ~1080px) */}
      <div className="flex flex-col gap-2 p-2 lg:hidden">
        {drafts.map((draft) => (
          <article
            key={`${draft.id}-mobile`}
            className="rounded-xl border border-outline-variant/35 bg-surface-container-low p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-on-surface">{draft.agreementNumber}</p>
                <p className="mt-0.5 truncate text-xs font-semibold text-on-surface-variant">
                  {draft.hotelName} · {cityLabel(draft.city)}
                </p>
                <p className="mt-0.5 text-xs text-on-surface-variant">
                  {formatVisaShortDate(draft.stayStartIso)} → {formatVisaShortDate(draft.stayEndIso)} · {paxLabel(draft)} pax
                </p>
              </div>
              <Badge status={assignmentBadgeStatus(draft)} className="shrink-0">
                {draft.assignmentStatus}
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <StatusSelect draft={draft} onChange={onStatusChange} disabled={statusChangePending} />
              </div>
              <RowActions
                draft={draft}
                onEdit={onStartEdit}
                onDelete={onDeleteRequest}
                deletePending={deleteDraftMutationPending}
              />
            </div>
          </article>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[6%]" />
            <col className="w-[12%]" />
            <col className="w-[11%]" />
            <col className="w-[9%]" />
            <col className="w-[8%]" />
          </colgroup>
          <thead className="border-b border-outline-variant/30 bg-surface-container-low">
            <tr>
              {["City", "Agent", "Group", "Hotel", "Agreement No", "Pax", "Status", "Check-in → out", "Assignment", ""].map(
                (label, index) => (
                  <th
                    key={label || `col-${index}`}
                    className="px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/80"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr key={draft.id} className="border-b border-outline-variant/20 align-middle transition hover:bg-primary/5">
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-on-surface">
                    <span className="material-symbols-outlined text-[18px] leading-none" aria-hidden="true">
                      {cityIcon(draft.city)}
                    </span>
                    {cityLabel(draft.city)}
                  </span>
                </td>
                <td className="truncate px-3 py-2.5 text-xs font-semibold text-on-surface">
                  {draft.agentName ?? "-"}
                </td>
                <td className="px-3 py-2.5 text-xs font-semibold text-on-surface">
                  <span className="line-clamp-2 break-words">{draft.groupName || "-"}</span>
                </td>
                <td className="truncate px-3 py-2.5 text-xs font-semibold text-on-surface">{draft.hotelName}</td>
                <td className="truncate px-3 py-2.5 text-xs font-semibold text-on-surface">{draft.agreementNumber}</td>
                <td className="px-3 py-2.5 text-xs font-semibold text-on-surface">{paxLabel(draft)}</td>
                <td className="px-3 py-2.5">
                  <StatusSelect draft={draft} onChange={onStatusChange} disabled={statusChangePending} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold text-on-surface">
                  {formatVisaShortDate(draft.stayStartIso)} → {formatVisaShortDate(draft.stayEndIso)}
                </td>
                <td className="px-3 py-2.5">
                  <Badge status={assignmentBadgeStatus(draft)}>{draft.assignmentStatus}</Badge>
                </td>
                <td className="px-2 py-2.5">
                  <RowActions
                    draft={draft}
                    onEdit={onStartEdit}
                    onDelete={onDeleteRequest}
                    deletePending={deleteDraftMutationPending}
                  />
                </td>
              </tr>
            ))}
            {isAddingRow ? (
              <InlineNewRow
                onCancel={() => setIsAddingRow(false)}
                onCreate={onCreateInline}
                isSaving={isSaving}
              />
            ) : null}
          </tbody>
        </table>
      </div>

      {drafts.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">
            inventory_2
          </span>
          <p className="mt-1 text-sm font-bold text-slate-900">Belum ada agreement</p>
        </div>
      ) : null}

      {/* Add-row trigger (desktop only; mobile + tablet use the composer form) */}
      <div className="hidden border-t border-outline-variant/25 p-2 lg:block">
        <Button
          variant="secondary"
          size="sm"
          className="inline-flex items-center gap-1.5"
          onClick={() => setIsAddingRow(true)}
          disabled={isAddingRow}
        >
          <span className="material-symbols-outlined text-base" aria-hidden="true">
            add
          </span>
          <span>Tambah agreement</span>
        </Button>
      </div>
    </div>
  );
}
