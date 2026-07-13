import { useModalFocusTrap } from "../use-modal-focus-trap";
import { ModalPortal, ModalShell, ModalFooter, ModalFooterButton } from "./shared";

const modalBodyClassName = "serene-dialog-body px-5 py-4";
const modalHeaderBarClassName = "flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4";

/**
 * Props untuk UnlinkGroupConfirmModal
 */
type UnlinkGroupConfirmModalProps = {
  /** Kode grup yang akan di-unlink dari parent */
  groupCode: string;
  /** Callback ketika modal ditutup */
  onClose: () => void;
  /** Callback ketika user mengkonfirmasi unlink */
  onConfirm: () => void;
};

/**
 * UnlinkGroupConfirmModal - Modal konfirmasi untuk unlink grup dari parent
 *
 * Komponen ini menampilkan dialog konfirmasi sebelum menghapus hubungan
 * antara child group dan parent group. User harus mengkonfirmasi tindakan ini.
 *
 * @example
 * ```tsx
 * <UnlinkGroupConfirmModal
 *   groupCode="GRP-001"
 *   onClose={() => setIsOpen(false)}
 *   onConfirm={() => unlinkGroup("GRP-001")}
 * />
 * ```
 *
 * @component
 * @param {UnlinkGroupConfirmModalProps} props - Komponen props
 * @returns {JSX.Element} Modal konfirmasi unlink grup
 */
export function UnlinkGroupConfirmModal({ groupCode, onClose, onConfirm }: UnlinkGroupConfirmModalProps) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });

  return (
    <ModalPortal>
      <ModalShell onClose={onClose} ariaLabelledBy="unlink-group-title" size="xl">
        <div ref={dialogRef}>
          <div className={modalHeaderBarClassName}>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <span className="material-symbols-outlined" aria-hidden="true">
                link_off
              </span>
            </div>

            <button
              type="button"
              className="serene-dialog-close-shell hover:border-brand-primary hover:text-brand-primary"
              onClick={onClose}
              aria-label="Close unlink confirmation popup"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className={modalBodyClassName}>
            <h2 id="unlink-group-title" className="text-2xl font-bold tracking-tight text-slate-900">
              Pisahkan dari grup utama?
            </h2>
            <div className="mt-2 text-sm leading-relaxed text-slate-600">
              <p>
                Anda akan melepaskan grup <strong>{groupCode}</strong> menjadi mandiri. Sharing Musyrif dan Itinerary
                dengan grup utamanya akan terputus, sementara data visa dan agreement tetap tersimpan di grup ini.
              </p>
            </div>

            <div className="mt-8 flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <ModalFooterButton variant="secondary" onClick={onClose}>
                Batalkan
              </ModalFooterButton>
              <ModalFooterButton
                variant="danger-brand"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
              >
                Pisahkan Grup
              </ModalFooterButton>
            </div>
          </div>
        </div>
      </ModalShell>
    </ModalPortal>
  );
}
