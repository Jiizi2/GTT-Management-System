import { useModalFocusTrap } from "../use-modal-focus-trap";
import { ModalPortal, ModalShell, ModalFooter, ModalFooterButton } from "./shared";
import type { ItineraryItem } from "../../shared/app-domain";

const modalBodyClassName = "serene-dialog-body px-5 py-4";
const modalHeaderBarClassName = "flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4";
const modalInfoSectionClassName = "serene-dialog-section text-sm";

/**
 * Props untuk DeleteConfirmModal
 */
type DeleteConfirmModalProps = {
  /** Item itinerary yang akan dihapus */
  item: ItineraryItem;
  /** Callback ketika modal ditutup */
  onClose: () => void;
  /** Callback ketika user mengkonfirmasi penghapusan */
  onConfirm: () => void;
};

/**
 * DeleteConfirmModal - Modal konfirmasi untuk menghapus item itinerary
 *
 * Komponen ini menampilkan dialog konfirmasi sebelum menghapus item itinerary.
 * Menampilkan informasi item yang akan dihapus untuk memastikan user yakin.
 *
 * @example
 * ```tsx
 * <DeleteConfirmModal
 *   item={selectedItem}
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={() => deleteItem(selectedItem.id)}
 * />
 * ```
 *
 * @component
 * @param {DeleteConfirmModalProps} props - Komponen props
 * @returns {JSX.Element} Modal konfirmasi penghapusan
 */
export function DeleteConfirmModal({ item, onClose, onConfirm }: DeleteConfirmModalProps) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });

  return (
    <ModalPortal>
      <ModalShell onClose={onClose} ariaLabelledBy="delete-itinerary-title" size="xl">
        <div ref={dialogRef}>
          <div className={modalHeaderBarClassName}>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <span className="material-symbols-outlined" aria-hidden="true">
                delete_forever
              </span>
            </div>

            <button
              type="button"
              className="serene-dialog-close-shell hover:border-primary"
              onClick={onClose}
              aria-label="Close delete confirmation popup"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className={modalBodyClassName}>
            <h2 id="delete-itinerary-title" className="text-2xl font-bold tracking-tight text-slate-900">
              Delete this itinerary?
            </h2>
            <p className="text-sm text-slate-600">
              This action will remove the selected itinerary item from the group detail page. Please confirm before
              continuing.
            </p>

            <div className={`${modalInfoSectionClassName} grid gap-2`}>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Date</span>
                <strong className="mt-1 block text-sm text-slate-900">
                  {item.date} {item.year}
                </strong>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Activity</span>
                <strong className="mt-1 block text-sm text-slate-900">{item.title}</strong>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Type</span>
                <strong className="mt-1 block text-sm text-slate-900">{item.category}</strong>
              </div>
            </div>
          </div>

          <ModalFooter>
            <ModalFooterButton variant="danger" onClick={onConfirm}>
              <span className="material-symbols-outlined" aria-hidden="true">
                delete
              </span>
              <span>Delete Itinerary</span>
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
