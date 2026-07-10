import { useModalFocusTrap } from "../use-modal-focus-trap";
import { ModalPortal, ModalShell, ModalFooter, ModalFooterButton } from "./shared";
import type { InvoiceRow } from "../../pages/invoice/helpers/invoice-page-shared";

const modalBodyClassName = "serene-dialog-body px-5 py-4";
const modalHeaderBarClassName = "flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4";
const modalInfoSectionClassName = "serene-dialog-section text-sm";

/**
 * Props untuk InvoiceDeleteConfirmModal
 */
type InvoiceDeleteConfirmModalProps = {
  /** Invoice yang akan dihapus */
  invoice: InvoiceRow;
  /** Callback ketika modal ditutup */
  onClose: () => void;
  /** Callback ketika user mengkonfirmasi penghapusan */
  onConfirm: () => void;
};

/**
 * InvoiceDeleteConfirmModal - Modal konfirmasi custom untuk menghapus invoice
 *
 * Komponen ini menyelaraskan desain dialog konfirmasi dengan modal-modal di Group Detail.
 */
export function InvoiceDeleteConfirmModal({ invoice, onClose, onConfirm }: InvoiceDeleteConfirmModalProps) {
  const dialogRef = useModalFocusTrap<HTMLDivElement>({ onClose });

  return (
    <ModalPortal>
      <ModalShell onClose={onClose} ariaLabelledBy="delete-invoice-title" size="xl">
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
              aria-label="Tutup popup konfirmasi hapus"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                close
              </span>
            </button>
          </div>

          <div className={modalBodyClassName}>
            <h2 id="delete-invoice-title" className="text-2xl font-bold tracking-tight text-slate-900">
              Hapus Invoice Ini?
            </h2>
            <p className="text-sm text-slate-600">
              Tindakan ini akan menghapus invoice dan seluruh item rinciannya secara permanen dari database. Harap konfirmasi sebelum melanjutkan.
            </p>

            <div className={`${modalInfoSectionClassName} grid gap-2`}>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nomor Invoice</span>
                <strong className="mt-1 block text-sm text-slate-900">
                  {invoice.invoiceNumber}
                </strong>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Klien</span>
                <strong className="mt-1 block text-sm text-slate-900">{invoice.clientName}</strong>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Jumlah Tagihan</span>
                <strong className="mt-1 block text-sm text-slate-900">
                  IDR {new Intl.NumberFormat("id-ID").format(invoice.amount)}
                </strong>
              </div>
            </div>
          </div>

          <ModalFooter>
            <ModalFooterButton variant="danger" onClick={onConfirm}>
              <span className="material-symbols-outlined" aria-hidden="true">
                delete
              </span>
              <span>Hapus Invoice</span>
            </ModalFooterButton>
            <ModalFooterButton variant="secondary" onClick={onClose}>
              Batal
            </ModalFooterButton>
          </ModalFooter>
        </div>
      </ModalShell>
    </ModalPortal>
  );
}
