import { useModalFocusTrap } from "../use-modal-focus-trap";
import { ModalPortal, ModalShell, ModalFooter, ModalFooterButton } from "./shared";

const modalBodyClassName = "serene-dialog-body px-5 py-4";
const modalHeaderBarClassName = "flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4";
const modalInfoSectionClassName = "serene-dialog-section text-sm";

/**
 * Props untuk DeleteGroupModal
 */
type DeleteGroupModalProps = {
  /** Kode grup yang akan dihapus */
  groupCode: string;
  /** Nama grup untuk ditampilkan di konfirmasi */
  groupName: string;
  /** Jumlah child group yang dimiliki (opsional) */
  childGroupCount?: number;
  /** Callback ketika modal ditutup */
  onClose: () => void;
  /** Callback ketika user mengkonfirmasi penghapusan */
  onConfirm: () => void;
};

/**
 * DeleteGroupModal - Modal konfirmasi untuk menghapus grup
 *
 * Komponen ini menampilkan dialog konfirmasi sebelum menghapus grup.
 * Jika grup memiliki child groups, tombol delete akan dinonaktifkan
 * untuk mencegah penghapusan yang tidak aman.
 *
 * @example
 * ```tsx
 * <DeleteGroupModal
 *   groupCode="GRP-001"
 *   groupName="Umrah Januari 2024"
 *   childGroupCount={0}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={() => deleteGroup("GRP-001")}
 * />
 * ```
 *
 * @component
 * @param {DeleteGroupModalProps} props - Komponen props
 * @returns {JSX.Element} Modal konfirmasi penghapusan grup
 */
export function DeleteGroupModal({
  groupCode,
  groupName,
  childGroupCount = 0,
  onClose,
  onConfirm,
}: DeleteGroupModalProps) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });
  const hasChildGroups = childGroupCount > 0;

  return (
    <ModalPortal>
      <ModalShell onClose={onClose} ariaLabelledBy="delete-group-title" size="xl">
        <div ref={dialogRef}>
          <div className={modalHeaderBarClassName}>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-tertiary/15 text-brand-tertiary">
              <span className="material-symbols-outlined" aria-hidden="true">
                warning
              </span>
            </div>

            <button
              type="button"
              className="serene-dialog-close-shell hover:border-brand-primary hover:text-brand-primary"
              onClick={onClose}
              aria-label="Close delete group confirmation popup"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className={modalBodyClassName}>
            <h2 id="delete-group-title" className="text-2xl font-bold tracking-tight text-slate-900">
              Delete this group?
            </h2>
            <p className="text-sm text-slate-600">
              This action will permanently remove the group from overview and detail pages. This action cannot be
              undone.
            </p>

            {hasChildGroups ? (
              <div className="rounded-2xl border border-brand-tertiary/30 bg-brand-tertiary/10 px-3 py-2 text-sm font-semibold text-brand-tertiary">
                This group has {childGroupCount} linked child {childGroupCount === 1 ? "group" : "groups"}. Unlink the
                child {childGroupCount === 1 ? "group" : "groups"} before deleting the parent group.
              </div>
            ) : null}

            <div className={`${modalInfoSectionClassName} grid gap-2`}>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Group Code</span>
                <strong className="mt-1 block text-sm text-slate-900">{groupCode}</strong>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Group Name</span>
                <strong className="mt-1 block text-sm text-slate-900">{groupName}</strong>
              </div>
            </div>
          </div>

          <ModalFooter>
            <ModalFooterButton variant="danger-brand" onClick={onConfirm} disabled={hasChildGroups}>
              <span className="material-symbols-outlined" aria-hidden="true">
                delete
              </span>
              <span>Delete Group</span>
            </ModalFooterButton>
            <ModalFooterButton variant="secondary" onClick={onClose}>
              Cancel
            </ModalFooterButton>
          </ModalFooter>
        </div>
      </ModalShell>
    </ModalPortal>
  );
}
